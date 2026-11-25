import crypto from 'node:crypto';
import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import type { Role } from '../../../shared/types.js';

export const ROLES = ['owner', 'admin', 'member'] as const satisfies readonly Role[];

export interface IMember {
  user: Types.ObjectId;
  role: Role;
  joinedAt: Date;
}

export interface IWorkspace {
  name: string;
  description: string;
  owner: Types.ObjectId;
  members: IMember[];
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDoc = HydratedDocument<IWorkspace>;

export function generateInviteCode() {
  return crypto.randomBytes(5).toString('hex');
}

const memberSchema = new Schema<IMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    inviteCode: { type: String, unique: true, default: generateInviteCode },
  },
  { timestamps: true },
);

workspaceSchema.index({ 'members.user': 1 });

export const Workspace = model<IWorkspace>('Workspace', workspaceSchema);

/** The member's role, or null if they are not in the workspace. */
export function roleOf(workspace: Pick<IWorkspace, 'members'>, userId: Types.ObjectId | string): Role | null {
  const id = userId.toString();
  return workspace.members.find((m) => m.user.toString() === id)?.role ?? null;
}
