import { Router } from 'express';
import { z } from 'zod';
import { Activity, Board, Comment, DEFAULT_COLUMNS, Task } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { boardForMember, workspaceForMember } from '../lib/access.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { USER_FIELDS, logActivity } from '../lib/activity.js';
import { emitToBoard, emitToWorkspace } from '../lib/realtime.js';

const router = Router();
router.use(requireAuth);

const ADMINS = ['owner', 'admin'];

const boardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(80),
  description: z.string().trim().max(500).optional(),
  useDefaultColumns: z.boolean().optional().default(true),
});

const columnSchema = z.object({
  title: z.string().trim().min(1, 'Column title is required').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value').optional(),
});

router.get('/workspaces/:workspaceId/boards', async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.workspaceId, req.user);
  const boards = await Board.find({ workspace: workspace._id }).sort({ createdAt: 1 }).lean();
  const counts = await Task.aggregate([
    { $match: { board: { $in: boards.map((b) => b._id) } } },
    { $group: { _id: { board: '$board', column: '$column' }, count: { $sum: 1 } } },
  ]);
  const result = boards.map((board) => {
    const lastColumn = board.columns.at(-1)?._id?.toString();
    const mine = counts.filter((c) => c._id.board.toString() === board._id.toString());
    const taskCount = mine.reduce((sum, c) => sum + c.count, 0);
    const doneCount = mine.filter((c) => c._id.column.toString() === lastColumn).reduce((s, c) => s + c.count, 0);
    return { ...board, taskCount, doneCount };
  });
  res.json({ boards: result });
});

router.post('/workspaces/:workspaceId/boards', validate(boardSchema), async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.workspaceId, req.user);
  const { useDefaultColumns, ...fields } = req.body;
  const board = await Board.create({
    ...fields,
    workspace: workspace._id,
    createdBy: req.user._id,
    columns: useDefaultColumns ? DEFAULT_COLUMNS : [],
  });
  const payload = { ...board.toObject(), taskCount: 0, doneCount: 0 };
  emitToWorkspace(workspace._id, 'board:created', payload, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: req.user,
    type: 'board.created',
    message: `${req.user.name} created the board "${board.name}"`,
  });
  res.status(201).json({ board: payload });
});

/** Full board payload: board, its tasks and the workspace members (for assigning). */
router.get('/boards/:id', async (req, res) => {
  const { board, workspace, role } = await boardForMember(req.params.id, req.user);
  await workspace.populate('members.user', USER_FIELDS);
  const tasks = await Task.find({ board: board._id }).sort({ order: 1 }).populate('assignees', USER_FIELDS);
  res.json({
    board,
    tasks,
    workspace: { _id: workspace._id, name: workspace.name, members: workspace.members, role },
  });
});

router.patch('/boards/:id', validate(boardSchema.omit({ useDefaultColumns: true }).partial()), async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  Object.assign(board, req.body);
  await board.save();
  emitToBoard(board._id, 'board:updated', board, req.socketId);
  emitToWorkspace(board.workspace, 'board:updated', board, req.socketId);
  res.json({ board });
});

router.delete('/boards/:id', async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user, { roles: ADMINS });
  await Promise.all([
    Task.deleteMany({ board: board._id }),
    Comment.deleteMany({ board: board._id }),
    Activity.deleteMany({ board: board._id }),
  ]);
  await board.deleteOne();
  emitToBoard(board._id, 'board:deleted', { _id: board._id });
  emitToWorkspace(board.workspace, 'board:deleted', { _id: board._id });
  res.status(204).end();
});

router.get('/boards/:id/activity', async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  const items = await Activity.find({ board: board._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 30, 100))
    .populate('actor', USER_FIELDS);
  res.json({ activity: items });
});

// ---- Columns -------------------------------------------------------------

function broadcastColumns(board, socketId) {
  emitToBoard(board._id, 'board:columns', { boardId: board._id, columns: board.columns }, socketId);
}

router.post('/boards/:id/columns', validate(columnSchema), async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  if (board.columns.length >= 12) throw badRequest('A board can have at most 12 columns');
  board.columns.push(req.body);
  await board.save();
  broadcastColumns(board, req.socketId);
  res.status(201).json({ columns: board.columns });
});

router.patch('/boards/:id/columns/:columnId', validate(columnSchema.partial()), async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  const column = board.columns.id(req.params.columnId);
  if (!column) throw notFound('Column not found');
  Object.assign(column, req.body);
  await board.save();
  broadcastColumns(board, req.socketId);
  res.json({ columns: board.columns });
});

const reorderSchema = z.object({ columnIds: z.array(z.string()).min(1) });

router.put('/boards/:id/columns/order', validate(reorderSchema), async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  const current = board.columns.map((c) => c._id.toString());
  const next = req.body.columnIds;
  if (next.length !== current.length || !next.every((id) => current.includes(id))) {
    throw badRequest('columnIds must contain every column exactly once');
  }
  board.columns = next.map((id) => board.columns.id(id));
  await board.save();
  broadcastColumns(board, req.socketId);
  res.json({ columns: board.columns });
});

router.delete('/boards/:id/columns/:columnId', async (req, res) => {
  const { board } = await boardForMember(req.params.id, req.user);
  const column = board.columns.id(req.params.columnId);
  if (!column) throw notFound('Column not found');
  if (board.columns.length === 1) throw badRequest('A board needs at least one column');
  const taskCount = await Task.countDocuments({ board: board._id, column: column._id });
  if (taskCount > 0) throw badRequest('Move or delete the tasks in this column first');
  column.deleteOne();
  await board.save();
  broadcastColumns(board, req.socketId);
  res.json({ columns: board.columns });
});

export default router;
