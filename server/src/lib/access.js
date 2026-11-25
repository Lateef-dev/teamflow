import mongoose from 'mongoose';
import { Board, Task, Workspace } from '../models/index.js';
import { forbidden, notFound } from './httpError.js';

const isId = (id) => mongoose.isValidObjectId(id);

/** Loads a workspace and checks that `user` is a member. Optionally require a role. */
export async function workspaceForMember(workspaceId, user, { roles } = {}) {
  if (!isId(workspaceId)) throw notFound('Workspace not found');
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw notFound('Workspace not found');
  const role = workspace.roleOf(user._id);
  if (!role) throw notFound('Workspace not found'); // do not leak existence
  if (roles && !roles.includes(role)) throw forbidden('Only workspace admins can do that');
  return { workspace, role };
}

export async function boardForMember(boardId, user, opts) {
  if (!isId(boardId)) throw notFound('Board not found');
  const board = await Board.findById(boardId);
  if (!board) throw notFound('Board not found');
  const { workspace, role } = await workspaceForMember(board.workspace, user, opts).catch((err) => {
    if (err.status === 404) throw notFound('Board not found');
    throw err;
  });
  return { board, workspace, role };
}

export async function taskForMember(taskId, user) {
  if (!isId(taskId)) throw notFound('Task not found');
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');
  const ctx = await boardForMember(task.board, user).catch((err) => {
    if (err.status === 404) throw notFound('Task not found');
    throw err;
  });
  return { task, ...ctx };
}

export const isMemberOf = (workspace, userId) =>
  workspace.members.some((m) => m.user.toString() === userId.toString());
