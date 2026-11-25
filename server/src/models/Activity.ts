import { Schema, Types, model } from 'mongoose';
import type { ActivityType } from '../../../shared/types.js';

export interface IActivity {
  workspace: Types.ObjectId;
  board: Types.ObjectId | null;
  actor: Types.ObjectId;
  type: ActivityType;
  message: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    board: { type: Schema.Types.ObjectId, ref: 'Board', default: null },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ board: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, createdAt: -1 });

export const Activity = model<IActivity>('Activity', activitySchema);
