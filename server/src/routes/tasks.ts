import { Router } from 'express';
import mongoose, { type Types } from 'mongoose';
import { z } from 'zod';
import type { MyTask } from '../../../shared/types.js';
import { Board, Comment, PRIORITIES, Task, type BoardDoc, type WorkspaceDoc } from '../models/index.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { bodyOf, validate } from '../middleware/validate.js';
import { boardForMember, isMemberOf, taskForMember } from '../lib/access.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { param } from '../lib/params.js';
import { logActivity } from '../lib/activity.js';
import { emitToBoard } from '../lib/realtime.js';
import { ORDER_GAP, orderBetween } from '../lib/ordering.js';
import { commentDTO, loadUsers, oneTaskDTO, tasksDTO, toPublicUser } from '../lib/serialize.js';

const router = Router();
router.use(requireAuth);

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const taskFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000),
  priority: z.enum(PRIORITIES),
  labels: z.array(z.string().trim().min(1).max(24)).max(8),
  assignees: z.array(objectId).max(10),
  dueDate: z.coerce.date().nullable(),
});

const createSchema = taskFields.partial().required({ title: true }).extend({ columnId: objectId });
const updateSchema = taskFields.partial();
const moveSchema = z.object({ columnId: objectId, index: z.number().int().min(0) });
const commentSchema = z.object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(2000) });

function assertAssigneesAreMembers(workspace: WorkspaceDoc, assignees: string[] = []) {
  if (assignees.some((id) => !isMemberOf(workspace, id))) {
    throw badRequest('Assignees must be members of the workspace');
  }
}

function columnOrThrow(board: BoardDoc, columnId: string | Types.ObjectId) {
  const column = board.columns.id(columnId);
  if (!column) throw badRequest('Column does not belong to this board');
  return column;
}

/** Re-spaces a column's orders when fractional gaps get too small to split. */
async function rebalanceColumn(boardId: Types.ObjectId, columnId: Types.ObjectId) {
  const tasks = await Task.find({ board: boardId, column: columnId }).sort({ order: 1 }).select('_id');
  const orders = tasks.map((t, i) => ({ _id: t._id, order: (i + 1) * ORDER_GAP }));
  if (orders.length) {
    await Task.bulkWrite(orders.map((o) => ({ updateOne: { filter: { _id: o._id }, update: { order: o.order } } })));
  }
  emitToBoard(boardId, 'tasks:reordered', {
    boardId: boardId.toString(),
    columnId: columnId.toString(),
    orders: orders.map((o) => ({ _id: o._id.toString(), order: o.order })),
  });
}

router.post('/boards/:id/tasks', validate(createSchema), async (req, res) => {
  const user = currentUser(req);
  const { board, workspace } = await boardForMember(param(req, 'id'), user);
  const { columnId, ...fields } = bodyOf(req, createSchema);
  const column = columnOrThrow(board, columnId);
  assertAssigneesAreMembers(workspace, fields.assignees);

  const last = await Task.findOne({ board: board._id, column: column._id }).sort({ order: -1 }).select('order');
  const doc = await Task.create({
    ...fields,
    board: board._id,
    workspace: workspace._id,
    column: column._id,
    order: orderBetween(last?.order, undefined),
    createdBy: user._id,
  });
  const task = await oneTaskDTO(doc);
  emitToBoard(board._id, 'task:created', task, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: user,
    type: 'task.created',
    message: `${user.name} added "${task.title}" to ${column.title}`,
    meta: { taskId: task._id },
  });
  res.status(201).json({ task });
});

router.get('/tasks/:id', async (req, res) => {
  const { task } = await taskForMember(param(req, 'id'), currentUser(req));
  res.json({ task: await oneTaskDTO(task) });
});

router.patch('/tasks/:id', validate(updateSchema), async (req, res) => {
  const user = currentUser(req);
  const { task: doc, workspace, board } = await taskForMember(param(req, 'id'), user);
  const body = bodyOf(req, updateSchema);
  if (body.assignees) assertAssigneesAreMembers(workspace, body.assignees);

  const previous = new Set(doc.assignees.map(String));
  const newlyAssigned = (body.assignees ?? []).filter((id) => !previous.has(id));
  doc.set(body);
  await doc.save();
  const task = await oneTaskDTO(doc);
  emitToBoard(board._id, 'task:updated', task, req.socketId);

  if (newlyAssigned.length) {
    const names = task.assignees.filter((a) => newlyAssigned.includes(a._id)).map((a) => a.name);
    await logActivity({
      workspace: workspace._id,
      board: board._id,
      actor: user,
      type: 'task.assigned',
      message: `${user.name} assigned ${names.join(', ')} to "${task.title}"`,
      meta: { taskId: task._id },
    });
  }
  res.json({ task });
});

router.patch('/tasks/:id/move', validate(moveSchema), async (req, res) => {
  const user = currentUser(req);
  const { task: doc, workspace, board } = await taskForMember(param(req, 'id'), user);
  const body = bodyOf(req, moveSchema);
  const toColumn = columnOrThrow(board, body.columnId);
  const fromColumn = board.columns.id(doc.column);

  const siblings = await Task.find({ board: board._id, column: toColumn._id, _id: { $ne: doc._id } })
    .sort({ order: 1 })
    .select('order');
  const index = Math.min(body.index, siblings.length);
  const before = siblings[index - 1]?.order;
  const after = siblings[index]?.order;

  doc.column = toColumn._id;
  doc.order = orderBetween(before, after);
  await doc.save();

  if (before != null && after != null && Math.abs(after - before) < 1e-6) {
    await rebalanceColumn(board._id, toColumn._id);
    const fresh = await Task.findById(doc._id).select('order');
    if (fresh) doc.order = fresh.order;
  }

  const task = await oneTaskDTO(doc);
  emitToBoard(board._id, 'task:moved', task, req.socketId);

  if (fromColumn?._id.toString() !== toColumn._id.toString()) {
    await logActivity({
      workspace: workspace._id,
      board: board._id,
      actor: user,
      type: 'task.moved',
      message: `${user.name} moved "${task.title}" from ${fromColumn?.title ?? 'a deleted column'} to ${toColumn.title}`,
      meta: { taskId: task._id, from: fromColumn?._id, to: toColumn._id },
    });
  }
  res.json({ task });
});

router.delete('/tasks/:id', async (req, res) => {
  const user = currentUser(req);
  const { task, workspace, board } = await taskForMember(param(req, 'id'), user);
  await Promise.all([Comment.deleteMany({ task: task._id }), task.deleteOne()]);
  emitToBoard(board._id, 'task:deleted', { _id: task._id.toString(), column: task.column.toString() }, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: user,
    type: 'task.deleted',
    message: `${user.name} deleted "${task.title}"`,
  });
  res.status(204).end();
});

// ---- Comments ------------------------------------------------------------

router.get('/tasks/:id/comments', async (req, res) => {
  const { task } = await taskForMember(param(req, 'id'), currentUser(req));
  const comments = await Comment.find({ task: task._id }).sort({ createdAt: 1 });
  const users = await loadUsers(comments.map((c) => c.author));
  res.json({ comments: comments.map((c) => commentDTO(c, users)) });
});

router.post('/tasks/:id/comments', validate(commentSchema), async (req, res) => {
  const user = currentUser(req);
  const { task, workspace, board } = await taskForMember(param(req, 'id'), user);
  const doc = await Comment.create({ task: task._id, board: board._id, author: user._id, body: bodyOf(req, commentSchema).body });
  task.commentCount += 1;
  await task.save();
  const comment = commentDTO(doc, new Map([[user._id.toString(), toPublicUser(user)]]));
  const taskId = task._id.toString();
  emitToBoard(board._id, 'comment:created', { comment, taskId, commentCount: task.commentCount }, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: user,
    type: 'comment.created',
    message: `${user.name} commented on "${task.title}"`,
    meta: { taskId },
  });
  res.status(201).json({ comment, commentCount: task.commentCount });
});

router.delete('/comments/:id', async (req, res) => {
  const user = currentUser(req);
  if (!mongoose.isValidObjectId(param(req, 'id'))) throw notFound('Comment not found');
  const comment = await Comment.findById(param(req, 'id'));
  if (!comment) throw notFound('Comment not found');
  const { task, board } = await taskForMember(comment.task, user);
  if (!comment.author.equals(user._id)) throw forbidden('You can only delete your own comments');
  await comment.deleteOne();
  task.commentCount = Math.max(0, task.commentCount - 1);
  await task.save();
  emitToBoard(
    board._id,
    'comment:deleted',
    { _id: comment._id.toString(), taskId: task._id.toString(), commentCount: task.commentCount },
    req.socketId,
  );
  res.status(204).end();
});

// ---- My tasks across every workspace ---------------------------------------

router.get('/me/tasks', async (req, res) => {
  const user = currentUser(req);
  const docs = await Task.find({ assignees: user._id }).sort({ dueDate: 1, updatedAt: -1 }).limit(50);
  const boards = await Board.find({ _id: { $in: docs.map((t) => t.board) } }).select('name columns');
  const boardById = new Map(boards.map((b) => [b._id.toString(), b]));
  const tasks = await tasksDTO(docs);
  const result: MyTask[] = tasks.flatMap((t) => {
    const board = boardById.get(t.board);
    if (!board) return [];
    const column = board.columns.find((c) => c._id.toString() === t.column);
    return [{ ...t, boardName: board.name, columnTitle: column?.title ?? null }];
  });
  res.json({ tasks: result });
});

export default router;
