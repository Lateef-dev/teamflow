import { Router } from 'express';
import { z } from 'zod';
import type { BoardResponse, BoardSummary } from '../../../shared/types.js';
import { Activity, Board, Comment, DEFAULT_COLUMNS, Task } from '../models/index.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { bodyOf, validate } from '../middleware/validate.js';
import { boardForMember, workspaceForMember } from '../lib/access.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { param } from '../lib/params.js';
import { logActivity } from '../lib/activity.js';
import { emitToBoard, emitToWorkspace } from '../lib/realtime.js';
import { activitiesDTO, boardDTO, columnsDTO, membersDTO, tasksDTO } from '../lib/serialize.js';
import type { BoardDoc } from '../models/index.js';

const router = Router();
router.use(requireAuth);

const ADMINS = ['owner', 'admin'] as const;

const boardFields = {
  name: z.string().trim().min(1, 'Board name is required').max(80),
  description: z.string().trim().max(500).optional(),
};
const createBoardSchema = z.object({ ...boardFields, useDefaultColumns: z.boolean().optional().default(true) });
const updateBoardSchema = z.object(boardFields).partial();

const columnSchema = z.object({
  title: z.string().trim().min(1, 'Column title is required').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value').optional(),
});
const columnUpdateSchema = columnSchema.partial();
const reorderSchema = z.object({ columnIds: z.array(z.string()).min(1) });

router.get('/workspaces/:workspaceId/boards', async (req, res) => {
  const { workspace } = await workspaceForMember(param(req, 'workspaceId'), currentUser(req));
  const boards = await Board.find({ workspace: workspace._id }).sort({ createdAt: 1 });
  const counts = await Task.aggregate<{ _id: { board: string; column: string }; count: number }>([
    { $match: { board: { $in: boards.map((b) => b._id) } } },
    { $group: { _id: { board: '$board', column: '$column' }, count: { $sum: 1 } } },
  ]);
  const result: BoardSummary[] = boards.map((board) => {
    const doneColumn = board.columns.at(-1)?._id.toString();
    const mine = counts.filter((c) => c._id.board.toString() === board._id.toString());
    const taskCount = mine.reduce((sum, c) => sum + c.count, 0);
    const doneCount = mine.filter((c) => c._id.column.toString() === doneColumn).reduce((s, c) => s + c.count, 0);
    return { ...boardDTO(board), taskCount, doneCount };
  });
  res.json({ boards: result });
});

router.post('/workspaces/:workspaceId/boards', validate(createBoardSchema), async (req, res) => {
  const user = currentUser(req);
  const { workspace } = await workspaceForMember(param(req, 'workspaceId'), user);
  const { useDefaultColumns, ...fields } = bodyOf(req, createBoardSchema);
  const board = await Board.create({
    ...fields,
    workspace: workspace._id,
    createdBy: user._id,
    columns: useDefaultColumns ? DEFAULT_COLUMNS : [],
  });
  const payload: BoardSummary = { ...boardDTO(board), taskCount: 0, doneCount: 0 };
  emitToWorkspace(workspace._id, 'board:created', payload, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: user,
    type: 'board.created',
    message: `${user.name} created the board "${board.name}"`,
  });
  res.status(201).json({ board: payload });
});

/** Full board payload: board, its tasks and the workspace members (for assigning). */
router.get('/boards/:id', async (req, res) => {
  const { board, workspace, role } = await boardForMember(param(req, 'id'), currentUser(req));
  const tasks = await Task.find({ board: board._id }).sort({ order: 1 });
  const payload: BoardResponse = {
    board: boardDTO(board),
    tasks: await tasksDTO(tasks),
    workspace: { _id: workspace._id.toString(), name: workspace.name, members: await membersDTO(workspace), role },
  };
  res.json(payload);
});

router.patch('/boards/:id', validate(updateBoardSchema), async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  board.set(bodyOf(req, updateBoardSchema));
  await board.save();
  const payload = boardDTO(board);
  emitToBoard(board._id, 'board:updated', payload, req.socketId);
  emitToWorkspace(board.workspace, 'board:updated', payload, req.socketId);
  res.json({ board: payload });
});

router.delete('/boards/:id', async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req), { roles: ADMINS });
  await Promise.all([
    Task.deleteMany({ board: board._id }),
    Comment.deleteMany({ board: board._id }),
    Activity.deleteMany({ board: board._id }),
  ]);
  await board.deleteOne();
  const payload = { _id: board._id.toString() };
  emitToBoard(board._id, 'board:deleted', payload);
  emitToWorkspace(board.workspace, 'board:deleted', payload);
  res.status(204).end();
});

router.get('/boards/:id/activity', async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  const items = await Activity.find({ board: board._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 30, 100))
    .lean();
  res.json({ activity: await activitiesDTO(items) });
});

// ---- Columns -------------------------------------------------------------

function broadcastColumns(board: BoardDoc, socketId?: string) {
  const columns = columnsDTO(board);
  emitToBoard(board._id, 'board:columns', { boardId: board._id.toString(), columns }, socketId);
  return columns;
}

router.post('/boards/:id/columns', validate(columnSchema), async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  if (board.columns.length >= 12) throw badRequest('A board can have at most 12 columns');
  board.columns.push(bodyOf(req, columnSchema));
  await board.save();
  res.status(201).json({ columns: broadcastColumns(board, req.socketId) });
});

router.patch('/boards/:id/columns/:columnId', validate(columnUpdateSchema), async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  const column = board.columns.id(param(req, 'columnId'));
  if (!column) throw notFound('Column not found');
  column.set(bodyOf(req, columnUpdateSchema));
  await board.save();
  res.json({ columns: broadcastColumns(board, req.socketId) });
});

router.put('/boards/:id/columns/order', validate(reorderSchema), async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  const next = bodyOf(req, reorderSchema).columnIds;
  const current = board.columns.map((c) => c._id.toString());
  if (next.length !== current.length || !current.every((id) => next.includes(id))) {
    throw badRequest('columnIds must contain every column exactly once');
  }
  const byId = new Map(board.columns.map((c) => [c._id.toString(), c.toObject()]));
  board.set('columns', next.map((id) => byId.get(id)));
  await board.save();
  res.json({ columns: broadcastColumns(board, req.socketId) });
});

router.delete('/boards/:id/columns/:columnId', async (req, res) => {
  const { board } = await boardForMember(param(req, 'id'), currentUser(req));
  const column = board.columns.id(param(req, 'columnId'));
  if (!column) throw notFound('Column not found');
  if (board.columns.length === 1) throw badRequest('A board needs at least one column');
  if (await Task.exists({ board: board._id, column: column._id })) {
    throw badRequest('Move or delete the tasks in this column first');
  }
  board.columns.pull(column._id);
  await board.save();
  res.json({ columns: broadcastColumns(board, req.socketId) });
});

export default router;
