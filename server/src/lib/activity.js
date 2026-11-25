import { Activity } from '../models/index.js';
import { emitToBoard, emitToWorkspace } from './realtime.js';

export const USER_FIELDS = 'name email avatarColor';

/** Persists an activity entry and pushes it to everyone watching the board or workspace. */
export async function logActivity({ workspace, board = null, actor, type, message, meta = {} }) {
  const entry = await Activity.create({ workspace, board, actor: actor._id, type, message, meta });
  const payload = { ...entry.toObject(), actor: actor.toPublic() };
  if (board) emitToBoard(board, 'activity:created', payload);
  emitToWorkspace(workspace, 'activity:created', payload);
  return payload;
}
