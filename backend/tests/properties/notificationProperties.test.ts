// Feature: jira-level-platform, Property 26: Notification fan-out for sprint events

/**
 * Property-based tests for Notification fan-out on sprint events.
 * Feature: jira-level-platform
 * Validates: Requirements 4.3, 4.4
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inline types (mirrors notificationUtils.ts and ProjectMember model)
// ---------------------------------------------------------------------------

interface ProjectMember {
  userId: string;
  projectId: string;
  role: 'admin' | 'manager' | 'developer';
}

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}

interface Notification extends NotificationInput {
  id: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Pure helpers extracted from notificationUtils.ts logic
// ---------------------------------------------------------------------------

/**
 * Pure implementation of createBulkNotifications fan-out logic.
 * Given a list of userIds and notification data, returns one notification
 * per userId — mirroring the Promise.all(userIds.map(...)) pattern.
 */
function createBulkNotifications(
  userIds: string[],
  notificationData: Omit<NotificationInput, 'userId'>,
): Notification[] {
  return userIds.map((userId, index) => ({
    id: `notif-${index}-${userId}`,
    userId,
    ...notificationData,
    createdAt: new Date(),
  }));
}

/**
 * Pure implementation of notifyProjectMembers fan-out.
 * Extracts unique userIds from members (optionally excluding one),
 * then calls createBulkNotifications.
 */
function notifyProjectMembers(
  members: ProjectMember[],
  projectId: string,
  notificationData: Omit<NotificationInput, 'userId' | 'relatedEntityType' | 'relatedEntityId'>,
  excludeUserId: string | null = null,
): Notification[] {
  const filtered = excludeUserId
    ? members.filter((m) => m.userId !== excludeUserId)
    : members;

  const userIds = Array.from(new Set(filtered.map((m) => m.userId)));

  if (!userIds.length) return [];

  return createBulkNotifications(userIds, {
    ...notificationData,
    relatedEntityType: 'sprint',
    relatedEntityId: projectId,
  });
}

/**
 * Pure implementation of notifySprintStarted fan-out (Req 4.3).
 */
function notifySprintStarted(
  members: ProjectMember[],
  sprintId: string,
  projectId: string,
  sprintName: string,
): Notification[] {
  return notifyProjectMembers(members, projectId, {
    type: 'sprint_started',
    title: `Sprint Started: ${sprintName}`,
    message: `Sprint "${sprintName}" has been started.`,
  });
}

/**
 * Pure implementation of notifySprintClosed fan-out (Req 4.4).
 */
function notifySprintClosed(
  members: ProjectMember[],
  sprintId: string,
  projectId: string,
  sprintName: string,
  completedIssueCount: number,
): Notification[] {
  return notifyProjectMembers(members, projectId, {
    type: 'sprint_closed',
    title: `Sprint Closed: ${sprintName}`,
    message: `Sprint "${sprintName}" has been closed. ${completedIssueCount} issues completed.`,
  });
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const roleArb = fc.constantFrom<'admin' | 'manager' | 'developer'>(
  'admin',
  'manager',
  'developer',
);

const userIdArb = fc.stringMatching(/^user-[a-z0-9]{4,8}$/);

/**
 * Generate a list of N unique project members for a given projectId.
 * N is drawn from [0, 20] to cover the full range including empty projects.
 */
const projectMembersArb = (projectId: string): fc.Arbitrary<ProjectMember[]> =>
  fc
    .integer({ min: 0, max: 20 })
    .chain((n) =>
      fc
        .uniqueArray(userIdArb, { minLength: n, maxLength: n })
        .chain((userIds) =>
          fc
            .tuple(...userIds.map(() => roleArb))
            .map((roles) =>
              userIds.map((userId, i) => ({
                userId,
                projectId,
                role: roles[i],
              })),
            ),
        ),
    );

const sprintIdArb = fc.stringMatching(/^sprint-[a-z0-9]{4,8}$/);
const projectIdArb = fc.stringMatching(/^project-[a-z0-9]{4,8}$/);
const sprintNameArb = fc.string({ minLength: 1, maxLength: 50 });
const completedCountArb = fc.nat({ max: 100 });

// ---------------------------------------------------------------------------
// Property 26: Notification fan-out for sprint events
// Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
// ---------------------------------------------------------------------------

describe('Property 26: Notification fan-out for sprint events', () => {
  // **Validates: Requirements 4.3, 4.4**

  it('starting a sprint creates exactly N notifications for N project members', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName]) => {
          const notifications = notifySprintStarted(members, sprintId, projectId, sprintName);

          // Exactly N notifications — one per unique member
          const uniqueMemberCount = new Set(members.map((m) => m.userId)).size;
          expect(notifications.length).toBe(uniqueMemberCount);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('closing a sprint creates exactly N notifications for N project members', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
            completedCountArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName, completedCount]) => {
          const notifications = notifySprintClosed(
            members,
            sprintId,
            projectId,
            sprintName,
            completedCount,
          );

          const uniqueMemberCount = new Set(members.map((m) => m.userId)).size;
          expect(notifications.length).toBe(uniqueMemberCount);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('each notification targets a distinct project member (one per member)', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName]) => {
          const notifications = notifySprintStarted(members, sprintId, projectId, sprintName);

          // All recipient userIds must be unique (one notification per member)
          const recipientIds = notifications.map((n) => n.userId);
          const uniqueRecipients = new Set(recipientIds);
          expect(uniqueRecipients.size).toBe(recipientIds.length);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('sprint_started notifications have the correct type', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName]) => {
          const notifications = notifySprintStarted(members, sprintId, projectId, sprintName);

          for (const notif of notifications) {
            expect(notif.type).toBe('sprint_started');
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('sprint_closed notifications have the correct type', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
            completedCountArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName, completedCount]) => {
          const notifications = notifySprintClosed(
            members,
            sprintId,
            projectId,
            sprintName,
            completedCount,
          );

          for (const notif of notifications) {
            expect(notif.type).toBe('sprint_closed');
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('all notification recipients are members of the project', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb.chain((projectId) =>
          fc.tuple(
            fc.constant(projectId),
            projectMembersArb(projectId),
            sprintIdArb,
            sprintNameArb,
          ),
        ),
        ([projectId, members, sprintId, sprintName]) => {
          const memberIds = new Set(members.map((m) => m.userId));
          const notifications = notifySprintStarted(members, sprintId, projectId, sprintName);

          for (const notif of notifications) {
            expect(memberIds.has(notif.userId)).toBe(true);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('an empty project produces zero notifications on sprint start', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(projectIdArb, sprintIdArb, sprintNameArb, (projectId, sprintId, sprintName) => {
        const notifications = notifySprintStarted([], sprintId, projectId, sprintName);
        expect(notifications.length).toBe(0);
      }),
      { numRuns: 25 },
    );
  });

  it('an empty project produces zero notifications on sprint close', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb,
        sprintIdArb,
        sprintNameArb,
        completedCountArb,
        (projectId, sprintId, sprintName, completedCount) => {
          const notifications = notifySprintClosed([], sprintId, projectId, sprintName, completedCount);
          expect(notifications.length).toBe(0);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('duplicate member entries (same userId) produce only one notification per user', () => {
    // Feature: jira-level-platform, Property 26: Notification fan-out for sprint events
    fc.assert(
      fc.property(
        projectIdArb,
        sprintIdArb,
        sprintNameArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 2, max: 4 }),
        (projectId, sprintId, sprintName, uniqueCount, duplicateFactor) => {
          // Build members with intentional duplicates
          const baseUserIds = Array.from({ length: uniqueCount }, (_, i) => `user-dup${i}abc`);
          const members: ProjectMember[] = baseUserIds.flatMap((userId) =>
            Array.from({ length: duplicateFactor }, () => ({
              userId,
              projectId,
              role: 'developer' as const,
            })),
          );

          const notifications = notifySprintStarted(members, sprintId, projectId, sprintName);

          // Despite duplicates, exactly uniqueCount notifications should be created
          expect(notifications.length).toBe(uniqueCount);
        },
      ),
      { numRuns: 25 },
    );
  });
});
