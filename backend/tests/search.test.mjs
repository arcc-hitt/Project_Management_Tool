import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.ts';
import database from '../src/config/database.ts';
import { cleanupUsersByEmails, clearProjectDomainData } from './dbTestUtils.mjs';

jest.setTimeout(30000);

async function registerAndLogin(user) {
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Search API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['mgr-search@example.com', 'dev-search@example.com']);
    manager = await registerAndLogin({ email: 'mgr-search@example.com', password: 'Password123!', firstName: 'MgrS', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-search@example.com', password: 'Password123!', firstName: 'DevS', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('filters').deleteMany({});

    const createProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Searchable Project', description: 'Find me' })
      .expect(201);
    projectId = createProj.body.data.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: dev.user.id, role: 'developer' })
      .expect(200);

    const createTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Searchable Task', description: 'Task to be found', projectId, assignedTo: dev.user.id })
      .expect(201);
    taskId = createTask.body.data.id;
  });

  test('unified search returns results for query', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('tasks');
  });

  test('project-only and task-only search endpoints work', async () => {
    const projRes = await request(app)
      .get('/api/search/projects')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(projRes.body.success).toBe(true);

    const taskRes = await request(app)
      .get('/api/search/tasks')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(taskRes.body.success).toBe(true);
  });
});

// ─── Advanced Issue Search (Req 8.1) ────────────────────────────────────────

describe('Advanced Issue Search', () => {
  let manager, projectId, bugId, epicId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['mgr-advsearch@example.com']);
    manager = await registerAndLogin({ email: 'mgr-advsearch@example.com', password: 'Password123!', firstName: 'MgrAdv', lastName: 'User', role: 'manager' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});

    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Adv Search Proj' })
      .expect(201);
    projectId = proj.body.data.id;

    const bug = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Critical Login Bug', projectId, issueType: 'bug', bugSeverity: 'critical', priority: 'high', labels: ['auth', 'login'], storyPoints: 3 })
      .expect(201);
    bugId = bug.body.data.id;

    const epic = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Auth Epic', projectId, issueType: 'epic', priority: 'medium', storyPoints: 13 })
      .expect(201);
    epicId = epic.body.data.id;

    // A plain task
    await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Simple Task', projectId, issueType: 'task', priority: 'low', storyPoints: 1 })
      .expect(201);
  });

  test('filters by issueType=bug returns only bugs', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ issueType: 'bug', projectId })
      .expect(200);

    expect(res.body.success).toBe(true);
    const issues = res.body.data.issues;
    expect(issues.length).toBeGreaterThan(0);
    issues.forEach((i) => expect(i.issueType).toBe('bug'));
  });

  test('filters by bugSeverity=critical returns only critical bugs', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ bugSeverity: 'critical', projectId })
      .expect(200);

    const issues = res.body.data.issues;
    expect(issues.length).toBeGreaterThan(0);
    issues.forEach((i) => expect(i.bugSeverity).toBe('critical'));
  });

  test('filters by storyPointsMin and storyPointsMax', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ storyPointsMin: 2, storyPointsMax: 5, projectId })
      .expect(200);

    const issues = res.body.data.issues;
    expect(issues.length).toBeGreaterThan(0);
    issues.forEach((i) => {
      expect(i.storyPoints).toBeGreaterThanOrEqual(2);
      expect(i.storyPoints).toBeLessThanOrEqual(5);
    });
  });

  test('filters by label returns only issues with that label', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ label: 'auth', projectId })
      .expect(200);

    const issues = res.body.data.issues;
    expect(issues.length).toBeGreaterThan(0);
    issues.forEach((i) => expect(i.labels).toContain('auth'));
  });

  test('filters by epicId returns only child issues of that epic', async () => {
    // Create a task linked to the epic
    await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Epic Child Task', projectId, issueType: 'task', epicId })
      .expect(201);

    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ epicId, projectId })
      .expect(200);

    const issues = res.body.data.issues;
    expect(issues.length).toBeGreaterThan(0);
    issues.forEach((i) => expect(i.epicId).toBe(epicId));
  });

  test('filters by createdAt date range', async () => {
    const from = new Date(Date.now() - 60000).toISOString();
    const to = new Date(Date.now() + 60000).toISOString();

    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ createdAtFrom: from, createdAtTo: to, projectId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.issues.length).toBeGreaterThan(0);
  });

  test('returns empty array when no issues match criteria (Req 5.7)', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ issueType: 'bug', bugSeverity: 'low', projectId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.issues).toEqual([]);
  });

  test('pagination: default page size is 25, max is 100', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ projectId })
      .expect(200);

    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.itemsPerPage).toBeLessThanOrEqual(25);

    const resMax = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ projectId, limit: 200 })
      .expect(200);

    expect(resMax.body.data.pagination.itemsPerPage).toBeLessThanOrEqual(100);
  });

  test('multiple filters apply AND logic (Req 5.3)', async () => {
    const res = await request(app)
      .get('/api/search/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .query({ issueType: 'bug', priority: 'high', projectId })
      .expect(200);

    const issues = res.body.data.issues;
    issues.forEach((i) => {
      expect(i.issueType).toBe('bug');
      expect(i.priority).toBe('high');
    });
  });
});

// ─── Saved Filter CRUD (Req 8.2–8.4, 8.7) ───────────────────────────────────

describe('Saved Filters CRUD', () => {
  let manager, outsider, projectId, filterId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['mgr-filter@example.com', 'outsider-filter@example.com']);
    manager = await registerAndLogin({ email: 'mgr-filter@example.com', password: 'Password123!', firstName: 'MgrF', lastName: 'User', role: 'manager' });
    outsider = await registerAndLogin({ email: 'outsider-filter@example.com', password: 'Password123!', firstName: 'Out', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('filters').deleteMany({});

    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Filter Test Proj' })
      .expect(201);
    projectId = proj.body.data.id;
  });

  test('POST /api/filters creates a saved filter (Req 8.2)', async () => {
    const res = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'My Bugs', criteria: { issueType: 'bug', projectId } })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Bugs');
    expect(res.body.data.criteria.issueType).toBe('bug');
    filterId = res.body.data.id;
  });

  test('POST /api/filters returns 400 when name or criteria missing', async () => {
    await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'No Criteria' })
      .expect(400);

    await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ criteria: { issueType: 'bug' } })
      .expect(400);
  });

  test('GET /api/filters returns only the authenticated user\'s filters (Req 8.4)', async () => {
    // Manager creates a filter
    await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Manager Filter', criteria: { issueType: 'task' } })
      .expect(201);

    // Outsider creates a filter
    await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Outsider Filter', criteria: { issueType: 'epic' } })
      .expect(201);

    const res = await request(app)
      .get('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const names = res.body.data.map((f) => f.name);
    expect(names).toContain('Manager Filter');
    expect(names).not.toContain('Outsider Filter');
  });

  test('GET /api/filters/:id/run executes saved filter criteria (Req 8.3)', async () => {
    // Create an issue to match
    await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Bug to find', projectId, issueType: 'bug' })
      .expect(201);

    const createRes = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Bug Filter', criteria: { issueType: 'bug', projectId } })
      .expect(201);
    filterId = createRes.body.data.id;

    const runRes = await request(app)
      .get(`/api/filters/${filterId}/run`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(runRes.body.success).toBe(true);
    expect(runRes.body.data.issues).toBeDefined();
    runRes.body.data.issues.forEach((i) => expect(i.issueType).toBe('bug'));
  });

  test('DELETE /api/filters/:id returns 204 and removes the filter (Req 8.7)', async () => {
    const createRes = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'To Delete', criteria: { issueType: 'task' } })
      .expect(201);
    const id = createRes.body.data.id;

    await request(app)
      .delete(`/api/filters/${id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(204);

    // Confirm it's gone from the list
    const listRes = await request(app)
      .get('/api/filters')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    const ids = listRes.body.data.map((f) => f.id);
    expect(ids).not.toContain(id);
  });

  test('DELETE /api/filters/:id returns 404 for non-existent filter', async () => {
    await request(app)
      .delete('/api/filters/000000000000000000000000')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(404);
  });
});

// ─── 403 on inaccessible project filter (Req 8.6) ───────────────────────────

describe('Saved Filter access control', () => {
  let owner, nonMember, memberProject, nonMemberProject, filterId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['filter-owner@example.com', 'filter-nonmember@example.com']);
    owner = await registerAndLogin({ email: 'filter-owner@example.com', password: 'Password123!', firstName: 'Owner', lastName: 'User', role: 'manager' });
    nonMember = await registerAndLogin({ email: 'filter-nonmember@example.com', password: 'Password123!', firstName: 'NonMember', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('filters').deleteMany({});

    // Project that owner belongs to but nonMember does not
    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Owner Only Project' })
      .expect(201);
    memberProject = proj.body.data.id;

    // nonMember saves a filter pointing at a project they don't belong to
    const filterRes = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${nonMember.token}`)
      .send({ name: 'Restricted Filter', criteria: { issueType: 'bug', projectId: memberProject } })
      .expect(201);
    filterId = filterRes.body.data.id;
  });

  test('running a filter scoped to an inaccessible project returns 403 (Req 8.6)', async () => {
    const res = await request(app)
      .get(`/api/filters/${filterId}/run`)
      .set('Authorization', `Bearer ${nonMember.token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  test('running another user\'s filter returns 403', async () => {
    // owner creates a filter
    const ownerFilter = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Owner Filter', criteria: { issueType: 'task' } })
      .expect(201);

    // nonMember tries to run it
    await request(app)
      .get(`/api/filters/${ownerFilter.body.data.id}/run`)
      .set('Authorization', `Bearer ${nonMember.token}`)
      .expect(403);
  });

  test('deleting another user\'s filter returns 403', async () => {
    const ownerFilter = await request(app)
      .post('/api/filters')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Owner Filter 2', criteria: { issueType: 'task' } })
      .expect(201);

    await request(app)
      .delete(`/api/filters/${ownerFilter.body.data.id}`)
      .set('Authorization', `Bearer ${nonMember.token}`)
      .expect(403);
  });

  test('unauthenticated request to filters returns 401', async () => {
    await request(app).get('/api/filters').expect(401);
    await request(app).post('/api/filters').send({ name: 'x', criteria: {} }).expect(401);
  });
});
