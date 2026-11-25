import mongoose, { type Types } from 'mongoose';
import type { Role } from '../../../shared/types.js';
import { Board, Task, Workspace, roleOf, type UserDoc } from '../models/index.js';
import { HttpError, forbidden, notFound } from './httpError.js';

type Id = Types.ObjectId | string;
interface Options {
  roles?: readonly Role[];
}

const rethrowAs = (message: string) => (err: unknown) => {
  if (err instanceof HttpError && err.status === 404) throw notFound(message);
  throw err;
};

/** Loads a workspace and checks the user is a member (optionally with one of `roles`). */
export async function workspaceForMember(workspaceId: Id, user: UserDoc, { roles }: Options = {}) {
  if (!mongoose.isValidObjectId(workspaceId)) throw notFound('Workspace not found');
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw notFound('Workspace not found');
  const role = roleOf(workspace, user._id);
  if (!role) throw notFound('Workspace not found'); // do not leak that it exists
  if (roles && !roles.includes(role)) throw forbidden('Only workspace admins can do that');
  return { workspace, role };
}

export async function boardForMember(boardId: Id, user: UserDoc, opts?: Options) {
  if (!mongoose.isValidObjectId(boardId)) throw notFound('Board not found');
  const board = await Board.findById(boardId);
  if (!board) throw notFound('Board not found');
  const ctx = await workspaceForMember(board.workspace, user, opts).catch(rethrowAs('Board not found'));
  return { board, ...ctx };
}

export async function taskForMember(taskId: Id, user: UserDoc) {
  if (!mongoose.isValidObjectId(taskId)) throw notFound('Task not found');
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task not found');
  const ctx = await boardForMember(task.board, user).catch(rethrowAs('Task not found'));
  return { task, ...ctx };
}

export const isMemberOf = (workspace: { members: { user: Types.ObjectId }[] }, userId: Id) =>
  workspace.members.some((m) => m.user.toString() === userId.toString());
