import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import type { Priority } from '../../../shared/types.js';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const satisfies readonly Priority[];

export interface ITask {
  board: Types.ObjectId;
  workspace: Types.ObjectId;
  column: Types.ObjectId;
  order: number;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  assignees: Types.ObjectId[];
  dueDate: Date | null;
  commentCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskDoc = HydratedDocument<ITask>;

const taskSchema = new Schema<ITask>(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    column: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    labels: { type: [String], default: [] },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    dueDate: { type: Date, default: null },
    commentCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.index({ board: 1, column: 1, order: 1 });
taskSchema.index({ assignees: 1 });

export const Task = model<ITask>('Task', taskSchema);
