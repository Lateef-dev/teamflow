import { describe, expect, it } from 'vitest';
import type { Activity, Column, Task } from '../../shared/types.js';
import { api, boardFixture, columnId, registerUser } from './helpers.js';

describe('boards and tasks', () => {
  it('creates a board with default columns and returns it with tasks', async () => {
    const { owner, board } = await boardFixture();
    expect(board.columns.map((c) => c.title)).toEqual(['To do', 'In progress', 'In review', 'Done']);

    const res = await api().get(`/api/boards/${board._id}`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.workspace.members).toHaveLength(1);
  });

  it('keeps outsiders out', async () => {
    const { board } = await boardFixture();
    const outsider = await registerUser('Outsider');
    expect((await api().get(`/api/boards/${board._id}`).set(outsider.auth)).status).toBe(404);
    const create = await api()
      .post(`/api/boards/${board._id}/tasks`)
      .set(outsider.auth)
      .send({ title: 'Nope', columnId: columnId(board, 0) });
    expect(create.status).toBe(404);
  });

  it('creates, updates, moves and deletes tasks', async () => {
    const { owner, board } = await boardFixture();
    const todo = { _id: columnId(board, 0) };
    const doing = { _id: columnId(board, 1) };
    const make = (title: string) =>
      api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title, columnId: todo._id });

    const a = (await make('A')).body.task;
    const b = (await make('B')).body.task;
    const c = (await make('C')).body.task;
    expect(a.order).toBeLessThan(b.order);
    expect(b.order).toBeLessThan(c.order);

    // Move C to the top of the same column.
    const moved = await api().patch(`/api/tasks/${c._id}/move`).set(owner.auth).send({ columnId: todo._id, index: 0 });
    expect(moved.status).toBe(200);
    let tasks = (await api().get(`/api/boards/${board._id}`).set(owner.auth)).body.tasks;
    expect(tasks.filter((t: Task) => t.column === todo._id).map((t: Task) => t.title)).toEqual(['C', 'A', 'B']);

    // Move A into "In progress".
    await api().patch(`/api/tasks/${a._id}/move`).set(owner.auth).send({ columnId: doing._id, index: 0 });
    tasks = (await api().get(`/api/boards/${board._id}`).set(owner.auth)).body.tasks;
    expect(tasks.find((t: Task) => t._id === a._id).column).toBe(doing._id);

    const updated = await api()
      .patch(`/api/tasks/${b._id}`)
      .set(owner.auth)
      .send({ priority: 'urgent', assignees: [owner.user._id], labels: ['api'], dueDate: '2030-01-01' });
    expect(updated.status).toBe(200);
    expect(updated.body.task.assignees[0].name).toBe('Owner');
    expect(updated.body.task.priority).toBe('urgent');

    const mine = await api().get('/api/me/tasks').set(owner.auth);
    expect(mine.body.tasks.map((t: Task) => t._id)).toEqual([b._id]);
    expect(mine.body.tasks[0].columnTitle).toBe('To do');

    expect((await api().delete(`/api/tasks/${b._id}`).set(owner.auth)).status).toBe(204);
    expect((await api().get(`/api/tasks/${b._id}`).set(owner.auth)).status).toBe(404);
  });

  it('rebalances a column when fractional gaps run out', async () => {
    const { owner, board } = await boardFixture();
    const col = columnId(board, 0);
    const first = (await api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title: 'first', columnId: col })).body.task;
    const last = (await api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title: 'last', columnId: col })).body.task;
    // Repeatedly insert at index 1, halving the gap each time.
    for (let i = 0; i < 45; i += 1) {
      const t = (await api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title: `t${i}`, columnId: col })).body.task;
      await api().patch(`/api/tasks/${t._id}/move`).set(owner.auth).send({ columnId: col, index: 1 });
    }
    const tasks = (await api().get(`/api/boards/${board._id}`).set(owner.auth)).body.tasks;
    const orders = tasks.map((t: Task) => t.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(tasks[0]._id).toBe(first._id);
    expect(tasks.at(-1)._id).toBe(last._id);
    expect(tasks[1].title).toBe('t44');
  });

  it('rejects assignees from outside the workspace', async () => {
    const { owner, board } = await boardFixture();
    const outsider = await registerUser('Outsider');
    const res = await api()
      .post(`/api/boards/${board._id}/tasks`)
      .set(owner.auth)
      .send({ title: 'X', columnId: columnId(board, 0), assignees: [outsider.user._id] });
    expect(res.status).toBe(400);
  });

  it('manages columns', async () => {
    const { owner, board } = await boardFixture();
    const added = await api().post(`/api/boards/${board._id}/columns`).set(owner.auth).send({ title: 'Blocked', color: '#ef4444' });
    expect(added.status).toBe(201);
    const ids = added.body.columns.map((c: Column) => c._id).reverse();
    const reordered = await api().put(`/api/boards/${board._id}/columns/order`).set(owner.auth).send({ columnIds: ids });
    expect(reordered.body.columns[0].title).toBe('Blocked');

    await api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title: 'X', columnId: ids[0] });
    expect((await api().delete(`/api/boards/${board._id}/columns/${ids[0]}`).set(owner.auth)).status).toBe(400);
    expect((await api().delete(`/api/boards/${board._id}/columns/${ids[1]}`).set(owner.auth)).status).toBe(200);
  });

  it('adds comments and records activity', async () => {
    const { owner, board } = await boardFixture();
    const task = (await api().post(`/api/boards/${board._id}/tasks`).set(owner.auth).send({ title: 'Ship it', columnId: columnId(board, 0) })).body.task;
    const comment = await api().post(`/api/tasks/${task._id}/comments`).set(owner.auth).send({ body: 'On it' });
    expect(comment.status).toBe(201);
    expect(comment.body.commentCount).toBe(1);

    const list = await api().get(`/api/tasks/${task._id}/comments`).set(owner.auth);
    expect(list.body.comments[0].author.name).toBe('Owner');

    const activity = await api().get(`/api/boards/${board._id}/activity`).set(owner.auth);
    expect(activity.body.activity.map((a: Activity) => a.type)).toEqual(['comment.created', 'task.created', 'board.created']);

    expect((await api().delete(`/api/comments/${comment.body.comment._id}`).set(owner.auth)).status).toBe(204);
  });
});
