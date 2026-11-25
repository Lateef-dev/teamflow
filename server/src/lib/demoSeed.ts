/**
 * Demo workspace so reviewers can log in and see a populated board.
 * Demo logins (password: password123): demo@teamflow.dev, ada@teamflow.dev, tunde@teamflow.dev
 */
import type { Priority } from '../../../shared/types.js';
import { Activity, Board, Comment, DEFAULT_COLUMNS, Task, User, Workspace, type UserDoc } from '../models/index.js';
import { ORDER_GAP } from './ordering.js';

export const DEMO_EMAIL = 'demo@teamflow.dev';

const people = [
  { name: 'Demo User', email: DEMO_EMAIL, avatarColor: '#6366f1' },
  { name: 'Ada Obi', email: 'ada@teamflow.dev', avatarColor: '#ec4899' },
  { name: 'Tunde Bello', email: 'tunde@teamflow.dev', avatarColor: '#10b981' },
];

type SeedTask = [column: string, title: string, priority: Priority, labels: string[], assignees: number[], dueInDays: number];

const tasks: SeedTask[] = [
  ['To do', 'Design onboarding emails', 'medium', ['design'], [1], 9],
  ['To do', 'Write API docs for webhooks', 'low', ['docs'], [2], 14],
  ['To do', 'Set up error monitoring', 'high', ['infra'], [], 5],
  ['In progress', 'Build checkout page', 'urgent', ['frontend'], [0], 2],
  ['In progress', 'Payment webhook handler', 'high', ['backend'], [2], 3],
  ['In review', 'Landing page hero redesign', 'medium', ['design', 'frontend'], [1, 0], 1],
  ['Done', 'Auth with JWT', 'high', ['backend'], [2], -3],
  ['Done', 'Project kickoff', 'low', [], [0, 1, 2], -7],
];

/** Deletes any previous demo data and recreates it. Expects an open connection. */
export async function seedDemo() {
  const emails = people.map((p) => p.email);
  const existing = await User.find({ email: { $in: emails } });
  if (existing.length) {
    const ws = await Workspace.find({ owner: { $in: existing.map((u) => u._id) } });
    const boards = await Board.find({ workspace: { $in: ws.map((w) => w._id) } });
    await Promise.all([
      Comment.deleteMany({ board: { $in: boards.map((b) => b._id) } }),
      Task.deleteMany({ workspace: { $in: ws.map((w) => w._id) } }),
      Activity.deleteMany({ workspace: { $in: ws.map((w) => w._id) } }),
      Board.deleteMany({ workspace: { $in: ws.map((w) => w._id) } }),
      Workspace.deleteMany({ _id: { $in: ws.map((w) => w._id) } }),
      User.deleteMany({ email: { $in: emails } }),
    ]);
  }

  const users: UserDoc[] = [];
  for (const p of people) users.push(await User.create({ ...p, password: 'password123' }));
  const demo = users[0]!;

  const workspace = await Workspace.create({
    name: 'Acme Studio',
    description: 'Product team for the Acme storefront relaunch',
    owner: demo._id,
    inviteCode: 'acme-demo',
    members: users.map((u, i) => ({ user: u._id, role: i === 0 ? 'owner' : i === 1 ? 'admin' : 'member', joinedAt: new Date() }) as const),
  });

  const board = await Board.create({
    workspace: workspace._id,
    name: 'Storefront relaunch',
    description: 'Sprint 14',
    columns: DEFAULT_COLUMNS,
    createdBy: demo._id,
  });
  await Board.create({ workspace: workspace._id, name: 'Marketing', columns: DEFAULT_COLUMNS, createdBy: demo._id });

  const colId = (title: string) => {
    const column = board.columns.find((c) => c.title === title);
    if (!column) throw new Error(`Unknown column ${title}`);
    return column._id;
  };
  const perColumn: Record<string, number> = {};
  for (const [column, title, priority, labels, assignees, dueIn] of tasks) {
    perColumn[column] = (perColumn[column] ?? 0) + 1;
    const task = await Task.create({
      board: board._id,
      workspace: workspace._id,
      column: colId(column),
      order: perColumn[column] * ORDER_GAP,
      title,
      priority,
      labels,
      assignees: assignees.map((i) => users[i]!._id),
      dueDate: new Date(Date.now() + dueIn * 86400000),
      createdBy: demo._id,
    });
    if (title === 'Build checkout page') {
      await Comment.create({ task: task._id, board: board._id, author: users[1]!._id, body: 'Mockups are in Figma, page 3.' });
      await Comment.create({ task: task._id, board: board._id, author: demo._id, body: 'Thanks! Starting on the form today.' });
      task.commentCount = 2;
      await task.save();
    }
    await Activity.create({
      workspace: workspace._id,
      board: board._id,
      actor: demo._id,
      type: 'task.created',
      message: `${demo.name} added "${title}" to ${column}`,
    });
  }

}

/** Seeds only when the demo account does not exist yet (safe to run on every boot). */
export async function ensureDemoData() {
  if (await User.exists({ email: DEMO_EMAIL })) return false;
  await seedDemo();
  return true;
}
