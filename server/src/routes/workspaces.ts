import { Router } from 'express';
import { z } from 'zod';
import { Activity, Board, Comment, Task, User, Workspace, generateInviteCode, roleOf } from '../models/index.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { bodyOf, validate } from '../middleware/validate.js';
import { workspaceForMember } from '../lib/access.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { param } from '../lib/params.js';
import { logActivity } from '../lib/activity.js';
import { emit, emitToWorkspace, rooms } from '../lib/realtime.js';
import { activitiesDTO, membersDTO, workspaceDTO } from '../lib/serialize.js';

const router = Router();
router.use(requireAuth);

const ADMINS = ['owner', 'admin'] as const;

const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(500).optional(),
});
const updateSchema = workspaceSchema.partial();
const joinSchema = z.object({ inviteCode: z.string().trim().min(1, 'Invite code is required') });
const roleSchema = z.object({ role: z.enum(['admin', 'member']) });

router.get('/', async (req, res) => {
  const user = currentUser(req);
  const workspaces = await Workspace.find({ 'members.user': user._id }).sort({ updatedAt: -1 });
  res.json({ workspaces: await Promise.all(workspaces.map((w) => workspaceDTO(w, user._id))) });
});

router.post('/', validate(workspaceSchema), async (req, res) => {
  const user = currentUser(req);
  const workspace = await Workspace.create({
    ...bodyOf(req, workspaceSchema),
    owner: user._id,
    members: [{ user: user._id, role: 'owner' }],
  });
  res.status(201).json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.post('/join', validate(joinSchema), async (req, res) => {
  const user = currentUser(req);
  const workspace = await Workspace.findOne({ inviteCode: bodyOf(req, joinSchema).inviteCode });
  if (!workspace) throw notFound('That invite code is not valid');
  if (!roleOf(workspace, user._id)) {
    workspace.members.push({ user: user._id, role: 'member', joinedAt: new Date() });
    await workspace.save();
    emitToWorkspace(workspace._id, 'workspace:members', {
      workspaceId: workspace._id.toString(),
      members: await membersDTO(workspace),
    });
    await logActivity({
      workspace: workspace._id,
      actor: user,
      type: 'member.joined',
      message: `${user.name} joined the workspace`,
    });
  }
  res.json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const { workspace } = await workspaceForMember(param(req, 'id'), user);
  res.json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const user = currentUser(req);
  const { workspace } = await workspaceForMember(param(req, 'id'), user, { roles: ADMINS });
  workspace.set(bodyOf(req, updateSchema));
  await workspace.save();
  emitToWorkspace(
    workspace._id,
    'workspace:updated',
    { _id: workspace._id.toString(), name: workspace.name, description: workspace.description },
    req.socketId,
  );
  res.json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.delete('/:id', async (req, res) => {
  const { workspace } = await workspaceForMember(param(req, 'id'), currentUser(req), { roles: ['owner'] });
  const boardIds = (await Board.find({ workspace: workspace._id }).select('_id')).map((b) => b._id);
  await Promise.all([
    Comment.deleteMany({ board: { $in: boardIds } }),
    Task.deleteMany({ workspace: workspace._id }),
    Activity.deleteMany({ workspace: workspace._id }),
    Board.deleteMany({ workspace: workspace._id }),
  ]);
  await workspace.deleteOne();
  emitToWorkspace(workspace._id, 'workspace:deleted', { _id: workspace._id.toString() });
  res.status(204).end();
});

router.post('/:id/invite-code', async (req, res) => {
  const { workspace } = await workspaceForMember(param(req, 'id'), currentUser(req), { roles: ADMINS });
  workspace.inviteCode = generateInviteCode();
  await workspace.save();
  res.json({ inviteCode: workspace.inviteCode });
});

router.patch('/:id/members/:userId', validate(roleSchema), async (req, res) => {
  const user = currentUser(req);
  const { workspace } = await workspaceForMember(param(req, 'id'), user, { roles: ['owner'] });
  const member = workspace.members.find((m) => m.user.toString() === param(req, 'userId'));
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw badRequest('The owner role cannot be changed');
  member.role = bodyOf(req, roleSchema).role;
  await workspace.save();
  emitToWorkspace(workspace._id, 'workspace:members', {
    workspaceId: workspace._id.toString(),
    members: await membersDTO(workspace),
  });
  res.json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.delete('/:id/members/:userId', async (req, res) => {
  const user = currentUser(req);
  const { workspace, role } = await workspaceForMember(param(req, 'id'), user);
  const targetId = param(req, 'userId');
  const leavingSelf = targetId === user._id.toString();
  if (!leavingSelf && role === 'member') throw forbidden('Only workspace admins can remove members');
  const member = workspace.members.find((m) => m.user.toString() === targetId);
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw badRequest('The owner cannot leave or be removed');
  if (role === 'admin' && member.role === 'admin' && !leavingSelf) throw forbidden('Admins cannot remove other admins');

  workspace.members = workspace.members.filter((m) => m.user.toString() !== targetId);
  await workspace.save();
  await Task.updateMany({ workspace: workspace._id }, { $pull: { assignees: member.user } });
  emitToWorkspace(workspace._id, 'workspace:members', {
    workspaceId: workspace._id.toString(),
    members: await membersDTO(workspace),
  });
  emit(rooms.user(targetId), 'workspace:removed', { _id: workspace._id.toString() });

  const removed = await User.findById(targetId);
  if (removed) {
    await logActivity({
      workspace: workspace._id,
      actor: user,
      type: leavingSelf ? 'member.left' : 'member.removed',
      message: leavingSelf ? `${user.name} left the workspace` : `${user.name} removed ${removed.name}`,
    });
  }
  res.json({ workspace: await workspaceDTO(workspace, user._id) });
});

router.get('/:id/activity', async (req, res) => {
  const { workspace } = await workspaceForMember(param(req, 'id'), currentUser(req));
  const items = await Activity.find({ workspace: workspace._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 30, 100))
    .lean();
  res.json({ activity: await activitiesDTO(items) });
});

export default router;
