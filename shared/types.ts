/**
 * Types shared by the API and the web client: the JSON shapes the REST API
 * returns and the typed Socket.io event maps. Type-only, no runtime code.
 */

export type ID = string;
export type ISODate = string;

export type Role = 'owner' | 'admin' | 'member';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface PublicUser {
  _id: ID;
  name: string;
  email: string;
  avatarColor: string;
}

export interface Member {
  user: PublicUser;
  role: Role;
  joinedAt: ISODate;
}

export interface Workspace {
  _id: ID;
  name: string;
  description: string;
  owner: ID;
  members: Member[];
  /** Only present for owners and admins. */
  inviteCode?: string;
  role: Role;
  boardCount: number;
  taskCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Column {
  _id: ID;
  title: string;
  color: string;
}

export interface Board {
  _id: ID;
  workspace: ID;
  name: string;
  description: string;
  columns: Column[];
  createdBy: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface BoardSummary extends Board {
  taskCount: number;
  doneCount: number;
}

export interface Task {
  _id: ID;
  board: ID;
  workspace: ID;
  column: ID;
  order: number;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  assignees: PublicUser[];
  dueDate: ISODate | null;
  commentCount: number;
  createdBy: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MyTask extends Task {
  boardName: string;
  columnTitle: string | null;
}

export interface Comment {
  _id: ID;
  task: ID;
  board: ID;
  author: PublicUser;
  body: string;
  createdAt: ISODate;
}

export type ActivityType =
  | 'board.created'
  | 'task.created'
  | 'task.assigned'
  | 'task.moved'
  | 'task.deleted'
  | 'comment.created'
  | 'member.joined'
  | 'member.left'
  | 'member.removed';

export interface Activity {
  _id: ID;
  workspace: ID;
  board: ID | null;
  actor: PublicUser;
  type: ActivityType;
  message: string;
  createdAt: ISODate;
}

/** Workspace members plus the caller's role, returned with a board. */
export interface BoardWorkspace {
  _id: ID;
  name: string;
  members: Member[];
  role: Role;
}

// ---- REST payloads ---------------------------------------------------------

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface BoardResponse {
  board: Board;
  tasks: Task[];
  workspace: BoardWorkspace;
}

export interface ApiErrorBody {
  error: string;
  details?: { path: string; message: string }[];
}

export interface CreateTaskInput {
  columnId: ID;
  title: string;
  description?: string;
  priority?: Priority;
  labels?: string[];
  assignees?: ID[];
  dueDate?: ISODate | null;
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'columnId'>>;

export interface MoveTaskInput {
  columnId: ID;
  index: number;
}

// ---- Socket.io events --------------------------------------------------------

export interface ServerToClientEvents {
  'task:created': (task: Task) => void;
  'task:updated': (task: Task) => void;
  'task:moved': (task: Task) => void;
  'task:deleted': (p: { _id: ID; column: ID }) => void;
  'tasks:reordered': (p: { boardId: ID; columnId: ID; orders: { _id: ID; order: number }[] }) => void;
  'board:created': (board: BoardSummary) => void;
  'board:updated': (board: Board) => void;
  'board:deleted': (p: { _id: ID }) => void;
  'board:columns': (p: { boardId: ID; columns: Column[] }) => void;
  'comment:created': (p: { comment: Comment; taskId: ID; commentCount: number }) => void;
  'comment:deleted': (p: { _id: ID; taskId: ID; commentCount: number }) => void;
  'presence:update': (p: { boardId: ID; users: PublicUser[] }) => void;
  'task:focus': (p: { taskId: ID; user: PublicUser }) => void;
  'activity:created': (activity: Activity) => void;
  'workspace:members': (p: { workspaceId: ID; members: Member[] }) => void;
  'workspace:updated': (p: { _id: ID; name: string; description: string }) => void;
  'workspace:deleted': (p: { _id: ID }) => void;
  'workspace:removed': (p: { _id: ID }) => void;
}

export type JoinAck = (res: { ok: true } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  'board:join': (boardId: ID, ack?: JoinAck) => void;
  'board:leave': (boardId: ID) => void;
  'workspace:join': (workspaceId: ID, ack?: JoinAck) => void;
  'workspace:leave': (workspaceId: ID) => void;
  'task:focus': (p: { boardId: ID; taskId: ID }) => void;
}
