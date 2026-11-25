import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface IComment {
  task: Types.ObjectId;
  board: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentDoc = HydratedDocument<IComment>;

const commentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Comment = model<IComment>('Comment', commentSchema);
