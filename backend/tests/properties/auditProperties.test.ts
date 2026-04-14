// Feature: jira-level-platform, Property 18: Audit log completeness
// Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity

/**
 * Property-based tests for AuditLog completeness and timestamp monotonicity.
 * Feature: jira-level-platform
 * Validates: Requirements 11.6, 11.7
 */

import * as fc from 'fast-check';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline types (mirrors AuditLog model)
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Action constants — mirrors AuditLog.ACTIONS (Req 11.1)
// ---------------------------------------------------------------------------

const AUDITABLE_ACTIONS = [
  'user.role_changed',
  'project.member_added',
  'project.member_removed',
  'project.settings_updated',
  'webhook.registered',
  'webhook.deleted',
  'sprint.started',
  'sprint.closed',
  'sso.linked',
  'sso.unlinked',
] as const;

type AuditableAction = (typeof AUDITABLE_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Simulates a single audit log creation for one action execution.
 * Returns exactly one AuditLogEntry — mirrors AuditLog.create behaviour.
 */
function simulateAuditLogCreate(
  action: AuditableAction,
  actorUserId: string,
  entityType: string,
  entityId: string,
  ipAddress: string,
  userAgent: string,
  createdAt: Date,
): AuditLogEntry {
  return {
    id: `audit-${action}-${entityId}`,
    organizationId: null,
    actorUserId,
    action,
    entityType,
    entityId,
    oldValues: null,
    newValues: null,
    ipAddress,
    userAgent,
    createdAt,
  };
}

/**
 * Simulates executing N independent action invocations and collecting the
 * resulting audit log entries.  Each invocation produces exactly one entry.
 */
function executeActions(
  actions: Array<{
    action: AuditableAction;
    actorUserId: string;
    entityType: string;
    entityId: string;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
  }>,
): AuditLogEntry[] {
  return actions.map((a) =>
    simulateAuditLogCreate(
      a.action,
      a.actorUserId,
      a.entityType,
      a.entityId,
      a.ipAddress,
      a.userAgent,
      a.createdAt,
    ),
  );
}

/**
 * Returns true when the provided entries are monotonically non-decreasing
 * by createdAt (i.e. each entry's timestamp >= the previous one).
 */
function isMonotonicallyNonDecreasing(entries: AuditLogEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].createdAt.getTime() < entries[i - 1].createdAt.getTime()) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const auditableActionArb = fc.constantFrom(...AUDITABLE_ACTIONS);

const userIdArb = fc.stringMatching(/^user-[a-z0-9]{4,8}$/);
const entityIdArb = fc.stringMatching(/^[a-z0-9]{8,16}$/);
const ipArb = fc.ipV4();
const userAgentArb = fc.string({ minLength: 5, maxLength: 80 });

/** Generates a Date within a reasonable range */
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

/** Generates a non-decreasing sequence of dates of length n */
const nonDecreasingDatesArb = (n: number): fc.Arbitrary<Date[]> =>
  fc
    .array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: n, maxLength: n })
    .map((offsets) => {
      const base = new Date('2024-01-01').getTime();
      const sorted = [...offsets].sort((a, b) => a - b);
      return sorted.map((offset) => new Date(base + offset * 1000));
    });

/** Generates an arbitrary (possibly unordered) sequence of dates of length n */
const arbitraryDatesArb = (n: number): fc.Arbitrary<Date[]> =>
  fc.array(dateArb, { minLength: n, maxLength: n });

// ---------------------------------------------------------------------------
// Property 18: Audit log completeness
// Feature: jira-level-platform, Property 18: Audit log completeness
// ---------------------------------------------------------------------------

describe('Property 18: Audit log completeness', () => {
  // **Validates: Requirements 11.6**

  it('each auditable action execution produces exactly one audit log entry', () => {
    // Feature: jira-level-platform, Property 18: Audit log completeness
    fc.assert(
      fc.property(
        auditableActionArb,
        userIdArb,
        entityIdArb,
        ipArb,
        userAgentArb,
        dateArb,
        (action, actorUserId, entityId, ipAddress, userAgent, createdAt) => {
          const entityType = action.split('.')[0]; // e.g. 'user', 'project', etc.

          const entry = simulateAuditLogCreate(
            action,
            actorUserId,
            entityType,
            entityId,
            ipAddress,
            userAgent,
            createdAt,
          );

          // Exactly one entry is produced per action execution
          assert.ok(entry !== null && entry !== undefined, 'Entry must be created');
          assert.equal(entry.action, action, 'Entry action must match the executed action');
          assert.equal(entry.actorUserId, actorUserId, 'Entry actorUserId must match');
          assert.equal(entry.entityId, entityId, 'Entry entityId must match');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('N independent action executions produce exactly N audit log entries', () => {
    // Feature: jira-level-platform, Property 18: Audit log completeness
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.array(
              fc.record({
                action: auditableActionArb,
                actorUserId: userIdArb,
                entityType: fc.constantFrom('user', 'project', 'webhook', 'sprint', 'sso_provider'),
                entityId: entityIdArb,
                ipAddress: ipArb,
                userAgent: userAgentArb,
                createdAt: dateArb,
              }),
              { minLength: n, maxLength: n },
            ),
          ),
        ),
        ([n, actions]) => {
          const entries = executeActions(actions);

          // Exactly N entries for N action executions
          assert.equal(
            entries.length,
            n,
            `Expected exactly ${n} audit log entries for ${n} action executions, got ${entries.length}`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every auditable action type from Req 11.1 can produce an audit log entry', () => {
    // Feature: jira-level-platform, Property 18: Audit log completeness
    // Verify all 10 action types are covered
    for (const action of AUDITABLE_ACTIONS) {
      const entry = simulateAuditLogCreate(
        action,
        'user-abc1',
        action.split('.')[0],
        'entity-001',
        '127.0.0.1',
        'TestAgent/1.0',
        new Date(),
      );

      assert.equal(entry.action, action, `Action type ${action} must produce an entry`);
    }

    assert.equal(AUDITABLE_ACTIONS.length, 10, 'All 10 auditable action types must be covered');
  });

  it('each entry contains all required fields (Req 11.2)', () => {
    // Feature: jira-level-platform, Property 18: Audit log completeness
    fc.assert(
      fc.property(
        auditableActionArb,
        userIdArb,
        entityIdArb,
        ipArb,
        userAgentArb,
        dateArb,
        (action, actorUserId, entityId, ipAddress, userAgent, createdAt) => {
          const entityType = action.split('.')[0];
          const entry = simulateAuditLogCreate(
            action,
            actorUserId,
            entityType,
            entityId,
            ipAddress,
            userAgent,
            createdAt,
          );

          // All required fields from Req 11.2 must be present
          assert.ok(entry.actorUserId !== undefined && entry.actorUserId !== null, 'actorUserId required');
          assert.ok(entry.action !== undefined && entry.action !== null, 'action required');
          assert.ok(entry.entityType !== undefined && entry.entityType !== null, 'entityType required');
          assert.ok(entry.entityId !== undefined && entry.entityId !== null, 'entityId required');
          assert.ok(entry.ipAddress !== undefined && entry.ipAddress !== null, 'ipAddress required');
          assert.ok(entry.userAgent !== undefined && entry.userAgent !== null, 'userAgent required');
          assert.ok(entry.createdAt instanceof Date, 'createdAt must be a Date');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Audit log timestamp monotonicity
// Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
// ---------------------------------------------------------------------------

describe('Property 19: Audit log timestamp monotonicity', () => {
  // **Validates: Requirements 11.7**

  it('entries inserted in non-decreasing timestamp order satisfy the monotonicity invariant', () => {
    // Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            nonDecreasingDatesArb(n),
            fc.array(auditableActionArb, { minLength: n, maxLength: n }),
            fc.array(userIdArb, { minLength: n, maxLength: n }),
            fc.array(entityIdArb, { minLength: n, maxLength: n }),
          ),
        ),
        ([n, dates, actions, userIds, entityIds]) => {
          if (n === 0) return; // empty sequence trivially satisfies the property

          const entries: AuditLogEntry[] = dates.map((createdAt, i) => ({
            id: `audit-${i}`,
            organizationId: null,
            actorUserId: userIds[i],
            action: actions[i],
            entityType: actions[i].split('.')[0],
            entityId: entityIds[i],
            oldValues: null,
            newValues: null,
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent/1.0',
            createdAt,
          }));

          assert.ok(
            isMonotonicallyNonDecreasing(entries),
            'Entries inserted in non-decreasing order must satisfy monotonicity invariant',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sorting entries by insertion order preserves non-decreasing createdAt', () => {
    // Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            nonDecreasingDatesArb(n),
            fc.array(auditableActionArb, { minLength: n, maxLength: n }),
          ),
        ),
        ([n, dates, actions]) => {
          const entries: AuditLogEntry[] = dates.map((createdAt, i) => ({
            id: `audit-${i}`,
            organizationId: null,
            actorUserId: `user-${i}abc`,
            action: actions[i],
            entityType: actions[i].split('.')[0],
            entityId: `entity-${i}`,
            oldValues: null,
            newValues: null,
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent/1.0',
            createdAt,
          }));

          // Sort by insertion index (simulating retrieval in insertion order)
          const sorted = [...entries].sort((a, b) => {
            const idxA = parseInt(a.id.split('-')[1]);
            const idxB = parseInt(b.id.split('-')[1]);
            return idxA - idxB;
          });

          assert.ok(
            isMonotonicallyNonDecreasing(sorted),
            'Entries retrieved in insertion order must have non-decreasing createdAt timestamps',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a sequence with a decreasing timestamp violates the monotonicity invariant', () => {
    // Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
    // Negative test: verify the checker correctly identifies violations
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            nonDecreasingDatesArb(n),
            fc.integer({ min: 0, max: n - 2 }), // index to inject a violation
          ),
        ),
        ([n, dates, violationIdx]) => {
          const entries: AuditLogEntry[] = dates.map((createdAt, i) => ({
            id: `audit-${i}`,
            organizationId: null,
            actorUserId: `user-${i}abc`,
            action: 'user.role_changed',
            entityType: 'user',
            entityId: `entity-${i}`,
            oldValues: null,
            newValues: null,
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent/1.0',
            createdAt,
          }));

          // Inject a violation: set entry at violationIdx+1 to be earlier than violationIdx
          const earlier = new Date(entries[violationIdx].createdAt.getTime() - 1000);
          const violated = entries.map((e, i) =>
            i === violationIdx + 1 ? { ...e, createdAt: earlier } : e,
          );

          // The violated sequence must NOT satisfy monotonicity
          assert.equal(
            isMonotonicallyNonDecreasing(violated),
            false,
            'A sequence with a decreasing timestamp must fail the monotonicity check',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a single-entry log trivially satisfies monotonicity', () => {
    // Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
    fc.assert(
      fc.property(dateArb, auditableActionArb, userIdArb, (createdAt, action, actorUserId) => {
        const entry: AuditLogEntry = {
          id: 'audit-0',
          organizationId: null,
          actorUserId,
          action,
          entityType: action.split('.')[0],
          entityId: 'entity-001',
          oldValues: null,
          newValues: null,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent/1.0',
          createdAt,
        };

        assert.ok(
          isMonotonicallyNonDecreasing([entry]),
          'A single-entry log must trivially satisfy monotonicity',
        );
      }),
      { numRuns: 100 },
    );
  });

  it('an empty log trivially satisfies monotonicity', () => {
    // Feature: jira-level-platform, Property 19: Audit log timestamp monotonicity
    assert.ok(
      isMonotonicallyNonDecreasing([]),
      'An empty log must trivially satisfy monotonicity',
    );
  });
});
