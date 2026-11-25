import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // e.g. task.created, task.moved, comment.created, member.joined
    type: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ board: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);
