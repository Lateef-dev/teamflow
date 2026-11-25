import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Comment = mongoose.model('Comment', commentSchema);
