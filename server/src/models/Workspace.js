import crypto from 'node:crypto';
import mongoose from 'mongoose';

export const ROLES = ['owner', 'admin', 'member'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    inviteCode: { type: String, unique: true, default: () => generateInviteCode() },
  },
  { timestamps: true },
);

workspaceSchema.index({ 'members.user': 1 });

export function generateInviteCode() {
  return crypto.randomBytes(5).toString('hex');
}

workspaceSchema.methods.roleOf = function roleOf(userId) {
  const member = this.members.find((m) => (m.user._id ?? m.user).toString() === userId.toString());
  return member?.role ?? null;
};

export const Workspace = mongoose.model('Workspace', workspaceSchema);
