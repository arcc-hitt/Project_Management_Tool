import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.ts';
import database from '../src/config/database.ts';
import { cleanupUsersByEmails, clearProjectDomainData } from './dbTestUtils.mjs';

// Requirements: 14.1–14.5
jest.setTimeout(30000);

async function registerAndLogin(user) {
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

const yesterday = new Date(Date.now() - 86400000).toISOString();
const nextWeek = new Date(Date.now() + 86400000 * 7).toISOString();

describe('Reports API', () => {
  let manager;

  beforeAll(async () => {
    await cleanupUsersByEmails(['reports-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'reports-mgr@example.com',
      password: 'Password123!',
      firstName: 'ReportsMgr',
      lastName: 'User',
      role: 'manager',
    });
  });

  async function setupProjectAndSprint({ withIssues = [] } = {}) {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('sprints').deleteMany({});

    // Create project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Reports Test Project' })
      .expect(201);
    const projectId = projRes.body.data.id;

    // Create and start a sprint
    const sprintRes = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);
    const sprintId = sprintRes.body.data.id;

    await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Create issues in the sprint
    const issueIds = [];
    for (const issueData of withIssues) {
      const issueRes = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, createdBy: manager.user.id, sprintId, ...issueData })
        .expect(201);
      issueIds.push(issueRes.body.data.id);
    }

    return { projectId, sprintId, issueIds };
  }

  // ─── Burndown Chart (Requirement 14.1) ────────────────────────────────────

  describe('GET /api/projects/:id/reports/burndown', () => {
    test('returns 400 when sprintId query param is missing', async () => {
      const { projectId } = await setupProjectAndSprint();

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    test('returns 404 for non-existent sprint', async () => {
      const { projectId } = await setupProjectAndSprint();

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=000000000000000000000000`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test('returns burndown data with correct shape', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({
        withIssues: [
          { title: 'Issue A', storyPoints: 3, issueType: 'task' },
          { title: 'Issue B', storyPoints: 5, issueType: 'task' },
        ],
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.sprintId).toBe(sprintId);
      expect(data.sprintName).toBe('Sprint 1');
      expect(Array.isArray(data.dataPoints)).toBe(true);
      expect(data.dataPoints.length).toBeGreaterThanOrEqual(1);

      // Each data point must have the required fields
      for (const point of data.dataPoints) {
        expect(typeof point.date).toBe('string');
        expect(typeof point.remainingStoryPoints).toBe('number');
        expect(typeof point.remainingIssueCount).toBe('number');
      }
    });

    test('burndown data points reflect total story points at start', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({
        withIssues: [
          { title: 'Issue A', storyPoints: 3, issueType: 'task' },
          { title: 'Issue B', storyPoints: 5, issueType: 'task' },
        ],
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const firstPoint = res.body.data.dataPoints[0];
      // Both issues are open, so remaining story points should be 8
      expect(firstPoint.remainingStoryPoints).toBe(8);
      expect(firstPoint.remainingIssueCount).toBe(2);
    });

    // Requirement 14.4 — zero story points returns 0 not null
    test('returns 0 (not null) for story points when no story points assigned', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({
        withIssues: [
          { title: 'No Points Issue', issueType: 'task' }, // no storyPoints field
        ],
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      for (const point of res.body.data.dataPoints) {
        expect(point.remainingStoryPoints).toBe(0);
        expect(point.remainingStoryPoints).not.toBeNull();
        expect(point.remainingStoryPoints).not.toBeUndefined();
      }
    });

    test('returns 0 story points for sprint with no issues', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({ withIssues: [] });

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      for (const point of res.body.data.dataPoints) {
        expect(point.remainingStoryPoints).toBe(0);
        expect(point.remainingIssueCount).toBe(0);
      }
    });

    // Requirement 14.5 — final data point invariant for closed sprint
    // Note: The implementation clears sprintId on incomplete issues when closing a sprint
    // (moving them to backlog). The burndown for a closed sprint therefore shows 0 remaining
    // for incomplete issues (they're no longer in the sprint). The completed issue remains
    // queryable by sprintId and shows 0 remaining story points (it's done).
    test('final burndown data point shows 0 remaining after sprint close with all issues resolved', async () => {
      const { projectId, sprintId, issueIds } = await setupProjectAndSprint({
        withIssues: [
          { title: 'Complete Me', storyPoints: 3, issueType: 'task' },
        ],
      });

      // Set up a workflow with lowercase state names matching the default issue status 'todo'
      const workflow = {
        states: [
          { name: 'todo', category: 'todo', transitions: ['done'] },
          { name: 'done', category: 'done', transitions: [] },
        ],
      };
      await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ workflow })
        .expect(200);

      // Transition the issue to done
      await request(app)
        .post(`/api/issues/${issueIds[0]}/transition`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ targetState: 'done' })
        .expect(200);

      // Close the sprint
      await request(app)
        .post(`/api/sprints/${sprintId}/close`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const dataPoints = res.body.data.dataPoints;
      const lastPoint = dataPoints[dataPoints.length - 1];

      // The completed issue is in 'done' state, so remaining = 0
      expect(lastPoint.remainingStoryPoints).toBe(0);
      expect(lastPoint.remainingIssueCount).toBe(0);
    });

    test('requires authentication', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint();

      await request(app)
        .get(`/api/projects/${projectId}/reports/burndown?sprintId=${sprintId}`)
        .expect(401);
    });
  });

  // ─── Velocity Chart (Requirement 14.2) ────────────────────────────────────

  describe('GET /api/projects/:id/reports/velocity', () => {
    test('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/000000000000000000000000/reports/velocity')
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test('returns velocity data with correct shape', async () => {
      const { projectId } = await setupProjectAndSprint();

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.projectId).toBe(projectId);
      expect(Array.isArray(data.velocityData)).toBe(true);
    });

    test('returns empty velocityData when no closed sprints exist', async () => {
      const { projectId } = await setupProjectAndSprint(); // sprint is active, not closed

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.data.velocityData).toHaveLength(0);
    });

    test('returns velocity entry for a closed sprint', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({
        withIssues: [
          { title: 'Done Issue', storyPoints: 8, issueType: 'task' },
        ],
      });

      // Transition issue to done then close sprint
      const db = await database.connect();
      const issuesCol = db.collection('issues');
      await issuesCol.updateOne({ sprintId }, { $set: { status: 'Done', completedAt: new Date() } });

      await request(app)
        .post(`/api/sprints/${sprintId}/close`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.data.velocityData.length).toBeGreaterThanOrEqual(1);
      const entry = res.body.data.velocityData[0];
      expect(entry.sprintId).toBe(sprintId);
      expect(typeof entry.completedStoryPoints).toBe('number');
      expect(typeof entry.completedIssueCount).toBe('number');
    });

    test('velocity entry story points are 0 (not null) when sprint has no story points', async () => {
      const { projectId, sprintId } = await setupProjectAndSprint({
        withIssues: [{ title: 'No Points', issueType: 'task' }],
      });

      await request(app)
        .post(`/api/sprints/${sprintId}/close`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const entry = res.body.data.velocityData.find((v) => v.sprintId === sprintId);
      expect(entry).toBeDefined();
      expect(entry.completedStoryPoints).toBe(0);
      expect(entry.completedStoryPoints).not.toBeNull();
      expect(entry.completedIssueCount).toBe(0);
      expect(entry.completedIssueCount).not.toBeNull();
    });

    test('returns at most 10 closed sprints', async () => {
      await clearProjectDomainData();
      const db = await database.connect();
      await db.collection('issues').deleteMany({});
      await db.collection('sprints').deleteMany({});

      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ name: 'Velocity 10 Sprints Project' })
        .expect(201);
      const projectId = projRes.body.data.id;

      // Insert 12 closed sprints directly into the DB to avoid slow API calls
      const sprintsCol = db.collection('sprints');
      const now = new Date();
      const sprintDocs = Array.from({ length: 12 }, (_, i) => ({
        projectId,
        name: `Sprint ${i + 1}`,
        state: 'closed',
        startDate: new Date(now.getTime() - (12 - i) * 14 * 86400000),
        endDate: new Date(now.getTime() - (11 - i) * 14 * 86400000),
        completedStoryPoints: i * 2,
        completedIssueCount: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      await sprintsCol.insertMany(sprintDocs);

      const res = await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.data.velocityData.length).toBeLessThanOrEqual(10);
    });

    test('requires authentication', async () => {
      const { projectId } = await setupProjectAndSprint();

      await request(app)
        .get(`/api/projects/${projectId}/reports/velocity`)
        .expect(401);
    });
  });

  // ─── Issue Stats (Requirement 14.3) ───────────────────────────────────────

  describe('GET /api/projects/:id/reports/issue-stats', () => {
    let sharedProjectId;
    let sharedSprintId;

    beforeAll(async () => {
      // Create a shared project + sprint for issue-stats tests to avoid rate limiting
      const setup = await setupProjectAndSprint({
        withIssues: [
          { title: 'Shared Task 1', issueType: 'task', priority: 'high' },
          { title: 'Shared Bug 1', issueType: 'bug', priority: 'critical' },
          { title: 'Shared Epic 1', issueType: 'epic', priority: 'medium' },
        ],
      });
      sharedProjectId = setup.projectId;
      sharedSprintId = setup.sprintId;
    });

    test('returns 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/000000000000000000000000/reports/issue-stats')
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    test('returns issue stats with correct shape', async () => {
      const res = await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.projectId).toBe(sharedProjectId);
      expect(typeof data.total).toBe('number');
      expect(typeof data.byIssueType).toBe('object');
      expect(typeof data.byStatus).toBe('object');
      expect(typeof data.byPriority).toBe('object');
      expect(typeof data.byAssigneeId).toBe('object');
    });

    test('groups issues correctly by issueType', async () => {
      const res = await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const { byIssueType, total } = res.body.data;
      expect(total).toBeGreaterThanOrEqual(3);
      expect(byIssueType.task).toBeGreaterThanOrEqual(1);
      expect(byIssueType.bug).toBeGreaterThanOrEqual(1);
      expect(byIssueType.epic).toBeGreaterThanOrEqual(1);
    });

    test('groups issues correctly by priority', async () => {
      const res = await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const { byPriority } = res.body.data;
      expect(byPriority.high).toBeGreaterThanOrEqual(1);
      expect(byPriority.critical).toBeGreaterThanOrEqual(1);
      expect(byPriority.medium).toBeGreaterThanOrEqual(1);
    });

    test('groups issues correctly by status', async () => {
      const res = await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const { byStatus } = res.body.data;
      // All issues start in 'todo' state
      const totalGrouped = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      expect(totalGrouped).toBeGreaterThanOrEqual(3);
    });

    test('returns total count matching sum of byIssueType counts', async () => {
      const res = await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const { total, byIssueType } = res.body.data;
      const sumByType = Object.values(byIssueType).reduce((sum, count) => sum + count, 0);
      expect(sumByType).toBe(total);
    });

    test('returns zero counts for project with no issues', async () => {
      // Create a fresh project with no issues directly via DB to avoid rate limiting
      const db = await database.connect();
      const projectsCol = db.collection('projects');
      const result = await projectsCol.insertOne({
        name: 'Empty Project',
        status: 'active',
        priority: 'medium',
        createdBy: manager.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const emptyProjectId = result.insertedId.toHexString();

      const res = await request(app)
        .get(`/api/projects/${emptyProjectId}/reports/issue-stats`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.data.total).toBe(0);
      expect(Object.keys(res.body.data.byIssueType)).toHaveLength(0);
    });

    test('requires authentication', async () => {
      await request(app)
        .get(`/api/projects/${sharedProjectId}/reports/issue-stats`)
        .expect(401);
    });
  });
});
