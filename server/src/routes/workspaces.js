import { Router } from 'express';
import { z } from 'zod';
import { Activity, Board, Comment, Task, User, Workspace } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { workspaceForMember } from '../lib/access.js';
import { badRequest, forbidden, notFound } from '../lib/httpError.js';
import { USER_FIELDS, logActivity } from '../lib/activity.js';
import { emitToWorkspace, rooms, emit } from '../lib/realtime.js';
import { generateInviteCode } from '../models/Workspace.js';

const router = Router();
router.use(requireAuth);

const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(500).optional(),
});

async function serialize(workspace, userId) {
  await workspace.populate('members.user', USER_FIELDS);
  const [boardCount, openTasks] = await Promise.all([
    Board.countDocuments({ workspace: workspace._id }),
    Task.countDocuments({ workspace: workspace._id }),
  ]);
  const obj = workspace.toObject();
  const role = workspace.roleOf(userId);
  // Only admins see the invite code.
  if (!['owner', 'admin'].includes(role)) delete obj.inviteCode;
  return { ...obj, role, boardCount, taskCount: openTasks };
}

router.get('/', async (req, res) => {
  const workspaces = await Workspace.find({ 'members.user': req.user._id }).sort({ updatedAt: -1 });
  res.json({ workspaces: await Promise.all(workspaces.map((w) => serialize(w, req.user._id))) });
});

router.post('/', validate(workspaceSchema), async (req, res) => {
  const workspace = await Workspace.create({
    ...req.body,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
  });
  res.status(201).json({ workspace: await serialize(workspace, req.user._id) });
});

const joinSchema = z.object({ inviteCode: z.string().trim().min(1, 'Invite code is required') });

router.post('/join', validate(joinSchema), async (req, res) => {
  const workspace = await Workspace.findOne({ inviteCode: req.body.inviteCode });
  if (!workspace) throw notFound('That invite code is not valid');
  if (!workspace.roleOf(req.user._id)) {
    workspace.members.push({ user: req.user._id, role: 'member' });
    await workspace.save();
    const data = await serialize(workspace, req.user._id);
    emitToWorkspace(workspace._id, 'workspace:members', { workspaceId: workspace._id, members: data.members });
    await logActivity({
      workspace: workspace._id,
      actor: req.user,
      type: 'member.joined',
      message: `${req.user.name} joined the workspace`,
    });
    return res.json({ workspace: data });
  }
  res.json({ workspace: await serialize(workspace, req.user._id) });
});

router.get('/:id', async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user);
  res.json({ workspace: await serialize(workspace, req.user._id) });
});

router.patch('/:id', validate(workspaceSchema.partial()), async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user, { roles: ['owner', 'admin'] });
  Object.assign(workspace, req.body);
  await workspace.save();
  const data = await serialize(workspace, req.user._id);
  emitToWorkspace(workspace._id, 'workspace:updated', { _id: workspace._id, name: data.name, description: data.description }, req.socketId);
  res.json({ workspace: data });
});

router.delete('/:id', async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user, { roles: ['owner'] });
  const boards = await Board.find({ workspace: workspace._id }).select('_id');
  const boardIds = boards.map((b) => b._id);
  await Promise.all([
    Comment.deleteMany({ board: { $in: boardIds } }),
    Task.deleteMany({ workspace: workspace._id }),
    Activity.deleteMany({ workspace: workspace._id }),
    Board.deleteMany({ workspace: workspace._id }),
  ]);
  await workspace.deleteOne();
  emitToWorkspace(workspace._id, 'workspace:deleted', { _id: workspace._id });
  res.status(204).end();
});

router.post('/:id/invite-code', async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user, { roles: ['owner', 'admin'] });
  workspace.inviteCode = generateInviteCode();
  await workspace.save();
  res.json({ inviteCode: workspace.inviteCode });
});

const roleSchema = z.object({ role: z.enum(['admin', 'member']) });

router.patch('/:id/members/:userId', validate(roleSchema), async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user, { roles: ['owner'] });
  const member = workspace.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw badRequest('The owner role cannot be changed');
  member.role = req.body.role;
  await workspace.save();
  const data = await serialize(workspace, req.user._id);
  emitToWorkspace(workspace._id, 'workspace:members', { workspaceId: workspace._id, members: data.members });
  res.json({ workspace: data });
});

router.delete('/:id/members/:userId', async (req, res) => {
  const { workspace, role } = await workspaceForMember(req.params.id, req.user);
  const leavingSelf = req.params.userId === req.user._id.toString();
  if (!leavingSelf && !['owner', 'admin'].includes(role)) throw forbidden('Only workspace admins can remove members');
  const member = workspace.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) throw notFound('Member not found');
  if (member.role === 'owner') throw badRequest('The owner cannot leave or be removed');
  if (role === 'admin' && member.role === 'admin' && !leavingSelf) throw forbidden('Admins cannot remove other admins');

  workspace.members = workspace.members.filter((m) => m.user.toString() !== req.params.userId);
  await workspace.save();
  await Task.updateMany({ workspace: workspace._id }, { $pull: { assignees: member.user } });
  const removed = await User.findById(req.params.userId);
  const data = await serialize(workspace, req.user._id);
  emitToWorkspace(workspace._id, 'workspace:members', { workspaceId: workspace._id, members: data.members });
  emit(rooms.user(req.params.userId), 'workspace:removed', { _id: workspace._id });
  if (removed) {
    await logActivity({
      workspace: workspace._id,
      actor: req.user,
      type: leavingSelf ? 'member.left' : 'member.removed',
      message: leavingSelf ? `${req.user.name} left the workspace` : `${req.user.name} removed ${removed.name}`,
    });
  }
  res.json({ workspace: data });
});

router.get('/:id/activity', async (req, res) => {
  const { workspace } = await workspaceForMember(req.params.id, req.user);
  const items = await Activity.find({ workspace: workspace._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 30, 100))
    .populate('actor', USER_FIELDS);
  res.json({ activity: items });
});

export default router;
