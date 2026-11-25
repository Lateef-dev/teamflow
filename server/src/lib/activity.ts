import type { Types } from 'mongoose';
import type { Activity as ActivityDTO, ActivityType } from '../../../shared/types.js';
import { Activity, type UserDoc } from '../models/index.js';
import { emitToBoard, emitToWorkspace } from './realtime.js';
import { activityDTO, toPublicUser } from './serialize.js';

interface LogInput {
  workspace: Types.ObjectId;
  board?: Types.ObjectId | null;
  actor: UserDoc;
  type: ActivityType;
  message: string;
  meta?: Record<string, unknown>;
}

/** Persists an activity entry and pushes it to everyone watching the board or workspace. */
export async function logActivity({ workspace, board = null, actor, type, message, meta = {} }: LogInput): Promise<ActivityDTO> {
  const entry = await Activity.create({ workspace, board, actor: actor._id, type, message, meta });
  const payload = activityDTO(entry, new Map([[actor._id.toString(), toPublicUser(actor)]]));
  if (board) emitToBoard(board, 'activity:created', payload);
  emitToWorkspace(workspace, 'activity:created', payload);
  return payload;
}
