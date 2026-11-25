import mongoose from 'mongoose';

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const taskSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    column: { type: mongoose.Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    labels: { type: [String], default: [] },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dueDate: { type: Date, default: null },
    commentCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.index({ board: 1, column: 1, order: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ title: 'text', description: 'text' });

export const Task = mongoose.model('Task', taskSchema);
