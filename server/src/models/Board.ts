import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface IColumn {
  _id: Types.ObjectId;
  title: string;
  color: string;
}

export interface IBoard {
  workspace: Types.ObjectId;
  name: string;
  description: string;
  /** Array order is the display order of the columns. */
  columns: Types.DocumentArray<IColumn>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BoardDoc = HydratedDocument<IBoard>;

const columnSchema = new Schema<IColumn>({
  title: { type: String, required: true, trim: true, maxlength: 60 },
  color: { type: String, default: '#94a3b8' },
});

const boardSchema = new Schema<IBoard>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    columns: { type: [columnSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const DEFAULT_COLUMNS = [
  { title: 'To do', color: '#94a3b8' },
  { title: 'In progress', color: '#6366f1' },
  { title: 'In review', color: '#f59e0b' },
  { title: 'Done', color: '#10b981' },
];

export const Board = model<IBoard>('Board', boardSchema);
