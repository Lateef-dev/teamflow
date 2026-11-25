import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Comment, PRIORITIES, Task } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { boardForMember, isMemberOf, taskForMember } from '../lib/access.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { USER_FIELDS, logActivity } from '../lib/activity.js';
import { emitToBoard } from '../lib/realtime.js';
import { ORDER_GAP, orderBetween } from '../lib/ordering.js';

const router = Router();
router.use(requireAuth);

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

const taskFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000),
  priority: z.enum(PRIORITIES),
  labels: z.array(z.string().trim().min(1).max(24)).max(8),
  assignees: z.array(objectId).max(10),
  dueDate: z.coerce.date().nullable(),
};

const createSchema = z.object({
  ...Object.fromEntries(Object.entries(taskFields).map(([k, v]) => [k, k === 'title' ? v : v.optional()])),
  columnId: objectId,
});

const updateSchema = z.object(taskFields).partial();

const moveSchema = z.object({
  columnId: objectId,
  index: z.number().int().min(0),
});

const populateTask = (task) => task.populate('assignees', USER_FIELDS);

function assertAssigneesAreMembers(workspace, assignees = []) {
  const outsider = assignees.find((id) => !isMemberOf(workspace, id));
  if (outsider) throw badRequest('Assignees must be members of the workspace');
}

function columnOrThrow(board, columnId) {
  const column = board.columns.id(columnId);
  if (!column) throw badRequest('Column does not belong to this board');
  return column;
}

/** Re-spaces a column's orders when fractional gaps get too small to split. */
async function rebalanceColumn(boardId, columnId) {
  const tasks = await Task.find({ board: boardId, column: columnId }).sort({ order: 1 }).select('_id');
  const updates = tasks.map((t, i) => ({
    updateOne: { filter: { _id: t._id }, update: { order: (i + 1) * ORDER_GAP } },
  }));
  if (updates.length) await Task.bulkWrite(updates);
  const orders = tasks.map((t, i) => ({ _id: t._id, order: (i + 1) * ORDER_GAP }));
  emitToBoard(boardId, 'tasks:reordered', { boardId, columnId, orders });
}

router.post('/boards/:id/tasks', validate(createSchema), async (req, res) => {
  const { board, workspace } = await boardForMember(req.params.id, req.user);
  const { columnId, ...fields } = req.body;
  const column = columnOrThrow(board, columnId);
  assertAssigneesAreMembers(workspace, fields.assignees);

  const last = await Task.findOne({ board: board._id, column: column._id }).sort({ order: -1 }).select('order');
  const task = await Task.create({
    ...fields,
    board: board._id,
    workspace: workspace._id,
    column: column._id,
    order: orderBetween(last?.order, null),
    createdBy: req.user._id,
  });
  await populateTask(task);
  emitToBoard(board._id, 'task:created', task, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: req.user,
    type: 'task.created',
    message: `${req.user.name} added "${task.title}" to ${column.title}`,
    meta: { taskId: task._id },
  });
  res.status(201).json({ task });
});

router.get('/tasks/:id', async (req, res) => {
  const { task } = await taskForMember(req.params.id, req.user);
  await populateTask(task);
  res.json({ task });
});

router.patch('/tasks/:id', validate(updateSchema), async (req, res) => {
  const { task, workspace, board } = await taskForMember(req.params.id, req.user);
  if (req.body.assignees) assertAssigneesAreMembers(workspace, req.body.assignees);

  const newlyAssigned = (req.body.assignees ?? []).filter(
    (id) => !task.assignees.some((a) => a.toString() === id),
  );
  Object.assign(task, req.body);
  await task.save();
  await populateTask(task);
  emitToBoard(board._id, 'task:updated', task, req.socketId);

  if (newlyAssigned.length) {
    const names = task.assignees.filter((a) => newlyAssigned.includes(a._id.toString())).map((a) => a.name);
    await logActivity({
      workspace: workspace._id,
      board: board._id,
      actor: req.user,
      type: 'task.assigned',
      message: `${req.user.name} assigned ${names.join(', ')} to "${task.title}"`,
      meta: { taskId: task._id },
    });
  }
  res.json({ task });
});

router.patch('/tasks/:id/move', validate(moveSchema), async (req, res) => {
  const { task, workspace, board } = await taskForMember(req.params.id, req.user);
  const toColumn = columnOrThrow(board, req.body.columnId);
  const fromColumn = board.columns.id(task.column);

  const siblings = await Task.find({ board: board._id, column: toColumn._id, _id: { $ne: task._id } })
    .sort({ order: 1 })
    .select('order');
  const index = Math.min(req.body.index, siblings.length);
  const before = siblings[index - 1]?.order;
  const after = siblings[index]?.order;
  let order = orderBetween(before, after);

  task.column = toColumn._id;
  task.order = order;
  await task.save();

  const needsRebalance = before != null && after != null && Math.abs(after - before) < 1e-6;
  if (needsRebalance) {
    await rebalanceColumn(board._id, toColumn._id);
    order = (await Task.findById(task._id).select('order')).order;
    task.order = order;
  }

  await populateTask(task);
  emitToBoard(board._id, 'task:moved', task, req.socketId);

  if (fromColumn?._id.toString() !== toColumn._id.toString()) {
    await logActivity({
      workspace: workspace._id,
      board: board._id,
      actor: req.user,
      type: 'task.moved',
      message: `${req.user.name} moved "${task.title}" from ${fromColumn?.title ?? 'a deleted column'} to ${toColumn.title}`,
      meta: { taskId: task._id, from: fromColumn?._id, to: toColumn._id },
    });
  }
  res.json({ task });
});

router.delete('/tasks/:id', async (req, res) => {
  const { task, workspace, board } = await taskForMember(req.params.id, req.user);
  await Promise.all([Comment.deleteMany({ task: task._id }), task.deleteOne()]);
  emitToBoard(board._id, 'task:deleted', { _id: task._id, column: task.column }, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: req.user,
    type: 'task.deleted',
    message: `${req.user.name} deleted "${task.title}"`,
  });
  res.status(204).end();
});

// ---- Comments ------------------------------------------------------------

const commentSchema = z.object({ body: z.string().trim().min(1, 'Comment cannot be empty').max(2000) });

router.get('/tasks/:id/comments', async (req, res) => {
  const { task } = await taskForMember(req.params.id, req.user);
  const comments = await Comment.find({ task: task._id }).sort({ createdAt: 1 }).populate('author', USER_FIELDS);
  res.json({ comments });
});

router.post('/tasks/:id/comments', validate(commentSchema), async (req, res) => {
  const { task, workspace, board } = await taskForMember(req.params.id, req.user);
  const comment = await Comment.create({ task: task._id, board: board._id, author: req.user._id, body: req.body.body });
  await comment.populate('author', USER_FIELDS);
  task.commentCount += 1;
  await task.save();
  emitToBoard(board._id, 'comment:created', { comment, taskId: task._id, commentCount: task.commentCount }, req.socketId);
  await logActivity({
    workspace: workspace._id,
    board: board._id,
    actor: req.user,
    type: 'comment.created',
    message: `${req.user.name} commented on "${task.title}"`,
    meta: { taskId: task._id },
  });
  res.status(201).json({ comment, commentCount: task.commentCount });
});

router.delete('/comments/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Comment not found');
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw notFound('Comment not found');
  const { task, board } = await taskForMember(comment.task, req.user);
  if (comment.author.toString() !== req.user._id.toString()) throw forbidden('You can only delete your own comments');
  await comment.deleteOne();
  task.commentCount = Math.max(0, task.commentCount - 1);
  await task.save();
  emitToBoard(board._id, 'comment:deleted', { _id: comment._id, taskId: task._id, commentCount: task.commentCount }, req.socketId);
  res.status(204).end();
});

// ---- My tasks across every workspace ---------------------------------------

router.get('/me/tasks', async (req, res) => {
  const tasks = await Task.find({ assignees: req.user._id })
    .sort({ dueDate: 1, updatedAt: -1 })
    .limit(50)
    .populate('assignees', USER_FIELDS)
    .populate('board', 'name columns workspace');
  const result = tasks
    .filter((t) => t.board)
    .map((t) => {
      const obj = t.toObject();
      const column = t.board.columns.find((c) => c._id.toString() === t.column.toString());
      return { ...obj, board: { _id: t.board._id, name: t.board.name, workspace: t.board.workspace }, columnTitle: column?.title };
    });
  res.json({ tasks: result });
});

export default router;
