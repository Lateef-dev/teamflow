import mongoose from 'mongoose';

const columnSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 60 },
  color: { type: String, default: '#94a3b8' },
});

const boardSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    // Array order is the display order of the columns.
    columns: { type: [columnSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const DEFAULT_COLUMNS = [
  { title: 'To do', color: '#94a3b8' },
  { title: 'In progress', color: '#6366f1' },
  { title: 'In review', color: '#f59e0b' },
  { title: 'Done', color: '#10b981' },
];

export const Board = mongoose.model('Board', boardSchema);
