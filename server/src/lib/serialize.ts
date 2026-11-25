/**
 * Converts Mongoose documents into the JSON shapes in shared/types.ts.
 * Users are loaded in one batched query per response instead of populate(),
 * which keeps queries predictable and the output fully typed.
 */
import type { Types } from 'mongoose';
import type * as Api from '../../../shared/types.js';
import {
  Board as BoardModel,
  Task as TaskModel,
  User,
  roleOf,
  type BoardDoc,
  type CommentDoc,
  type IActivity,
  type IUser,
  type TaskDoc,
  type WorkspaceDoc,
} from '../models/index.js';

type Id = Types.ObjectId | string;
type UserLike = Pick<IUser, 'name' | 'email' | 'avatarColor'> & { _id: Id };
export type UserMap = Map<string, Api.PublicUser>;

const iso = (d: Date) => d.toISOString();
const str = (id: Id) => id.toString();

export function toPublicUser(user: UserLike): Api.PublicUser {
  return { _id: str(user._id), name: user.name, email: user.email, avatarColor: user.avatarColor };
}

const deletedUser = (id: string): Api.PublicUser => ({ _id: id, name: 'Deleted user', email: '', avatarColor: '#94a3b8' });

export async function loadUsers(ids: Iterable<Id>): Promise<UserMap> {
  const unique = [...new Set([...ids].map(str))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('name email avatarColor').lean();
  return new Map(users.map((u) => [str(u._id), toPublicUser(u)]));
}

const pick = (users: UserMap, id: Id) => users.get(str(id)) ?? deletedUser(str(id));

export function boardDTO(board: BoardDoc): Api.Board {
  return {
    _id: str(board._id),
    workspace: str(board.workspace),
    name: board.name,
    description: board.description,
    columns: columnsDTO(board),
    createdBy: str(board.createdBy),
    createdAt: iso(board.createdAt),
    updatedAt: iso(board.updatedAt),
  };
}

export function columnsDTO(board: BoardDoc): Api.Column[] {
  return board.columns.map((c) => ({ _id: str(c._id), title: c.title, color: c.color }));
}

export function taskDTO(task: TaskDoc, users: UserMap): Api.Task {
  return {
    _id: str(task._id),
    board: str(task.board),
    workspace: str(task.workspace),
    column: str(task.column),
    order: task.order,
    title: task.title,
    description: task.description,
    priority: task.priority,
    labels: [...task.labels],
    assignees: task.assignees.map((id) => pick(users, id)),
    dueDate: task.dueDate ? iso(task.dueDate) : null,
    commentCount: task.commentCount,
    createdBy: str(task.createdBy),
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
  };
}

export async function tasksDTO(tasks: TaskDoc[]): Promise<Api.Task[]> {
  const users = await loadUsers(tasks.flatMap((t) => t.assignees));
  return tasks.map((t) => taskDTO(t, users));
}

export const oneTaskDTO = async (task: TaskDoc) => taskDTO(task, await loadUsers(task.assignees));

export async function membersDTO(workspace: WorkspaceDoc): Promise<Api.Member[]> {
  const users = await loadUsers(workspace.members.map((m) => m.user));
  return workspace.members.map((m) => ({ user: pick(users, m.user), role: m.role, joinedAt: iso(m.joinedAt) }));
}

export async function workspaceDTO(workspace: WorkspaceDoc, viewerId: Id): Promise<Api.Workspace> {
  const role = roleOf(workspace, viewerId) ?? 'member';
  const [members, boardCount, taskCount] = await Promise.all([
    membersDTO(workspace),
    BoardModel.countDocuments({ workspace: workspace._id }),
    TaskModel.countDocuments({ workspace: workspace._id }),
  ]);
  return {
    _id: str(workspace._id),
    name: workspace.name,
    description: workspace.description,
    owner: str(workspace.owner),
    members,
    // Only admins see the invite code.
    ...(role === 'owner' || role === 'admin' ? { inviteCode: workspace.inviteCode } : {}),
    role,
    boardCount,
    taskCount,
    createdAt: iso(workspace.createdAt),
    updatedAt: iso(workspace.updatedAt),
  };
}

export function commentDTO(comment: CommentDoc, users: UserMap): Api.Comment {
  return {
    _id: str(comment._id),
    task: str(comment.task),
    board: str(comment.board),
    author: pick(users, comment.author),
    body: comment.body,
    createdAt: iso(comment.createdAt),
  };
}

type ActivityLike = IActivity & { _id: Id };

export function activityDTO(entry: ActivityLike, users: UserMap): Api.Activity {
  return {
    _id: str(entry._id),
    workspace: str(entry.workspace),
    board: entry.board ? str(entry.board) : null,
    actor: pick(users, entry.actor),
    type: entry.type,
    message: entry.message,
    createdAt: iso(entry.createdAt),
  };
}

export async function activitiesDTO(entries: ActivityLike[]): Promise<Api.Activity[]> {
  const users = await loadUsers(entries.map((e) => e.actor));
  return entries.map((e) => activityDTO(e, users));
}
