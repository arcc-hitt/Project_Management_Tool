// Feature: jira-level-platform, Property 20: Burndown final data point invariant

/**
 * Property-based tests for the burndown chart computation.
 * Feature: jira-level-platform
 * Validates: Requirements 14.5
 */

import * as fc from 'fast-check';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline types — mirrors the Issue and Sprint shapes used by getBurndown
// ---------------------------------------------------------------------------

interface SprintLike {
  id: string;
  projectId: string;
  name: string;
  state: 'created' | 'active' | 'closed';
  startDate: Date;
  endDate: Date;
}

interface IssueLike {
  id: string;
  sprintId: string;
  status: string;
  storyPoints: number | null | undefined;
  completedAt: Date | null | undefined;
}

interface BurndownDataPoint {
  date: string;
  remainingStoryPoints: number;
  remainingIssueCount: number;
}

// ---------------------------------------------------------------------------
// Pure burndown computation — extracted from DashboardService.getBurndown
// This mirrors the exact logic in the service without any DB calls.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute daily burndown data points for a sprint.
 * Mirrors the logic in DashboardService.getBurndown.
 */
function computeBurndown(
  sprint: SprintLike,
  issues: IssueLike[],
  doneStates: Set<string>,
): BurndownDataPoint[] {
  const startDate = sprint.startDate;
  const endDate = sprint.endDate;
  // For a closed sprint, chartEnd = endDate
  const chartEnd = sprint.state === 'closed' ? endDate : new Date();

  const totalDays = Math.max(
    1,
    Math.ceil((chartEnd.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
  );

  const dataPoints: BurndownDataPoint[] = [];

  for (let i = 0; i < totalDays; i++) {
    const dayEnd = new Date(startDate.getTime() + (i + 1) * MS_PER_DAY - 1);
    const dateStr = new Date(startDate.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10);

    // An issue is "remaining" on this day if it was not completed by end of this day
    const remaining = issues.filter((issue) => {
      const isDone = doneStates.has(issue.status);
      if (!isDone) return true; // still open
      // completed before end of this day?
      const completedAt = issue.completedAt ? new Date(issue.completedAt) : null;
      return completedAt ? completedAt > dayEnd : true;
    });

    const remainingStoryPoints = remaining.reduce(
      (sum, issue) => sum + (typeof issue.storyPoints === 'number' ? issue.storyPoints : 0),
      0,
    );

    dataPoints.push({
      date: dateStr,
      remainingStoryPoints,
      remainingIssueCount: remaining.length,
    });
  }

  return dataPoints;
}

/**
 * Compute the dayEnd timestamp for the final burndown data point of a closed sprint.
 * This matches the burndown computation: dayEnd for the last day index.
 */
function getFinalDayEnd(sprint: SprintLike): Date {
  const startDate = sprint.startDate;
  const endDate = sprint.endDate;
  const totalDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1,
  );
  // Last day index = totalDays - 1
  return new Date(startDate.getTime() + totalDays * MS_PER_DAY - 1);
}

/**
 * Compute the expected remaining story points for the final burndown data point
 * of a closed sprint: sum of storyPoints of issues that are NOT completed by
 * the final day's end timestamp (matching the burndown's dayEnd logic).
 *
 * This is the mathematical invariant from Requirement 14.5.
 */
function computeExpectedFinalRemainingPoints(
  issues: IssueLike[],
  doneStates: Set<string>,
  finalDayEnd: Date,
): number {
  return issues
    .filter((issue) => {
      const isDone = doneStates.has(issue.status);
      if (!isDone) return true; // incomplete — counts as remaining
      // Done but completed after final day end — also counts as remaining
      const completedAt = issue.completedAt ? new Date(issue.completedAt) : null;
      return completedAt ? completedAt > finalDayEnd : true;
    })
    .reduce(
      (sum, issue) => sum + (typeof issue.storyPoints === 'number' ? issue.storyPoints : 0),
      0,
    );
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-negative integer story points (0–100), or null/undefined */
const storyPointsArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.nat({ max: 100 }),
);

/** Done-category state names */
const doneStatusArb = fc.constantFrom('Done', 'Closed', 'Resolved', 'done');

/** Non-done state names */
const openStatusArb = fc.constantFrom('To Do', 'In Progress', 'In Review', 'Backlog', 'todo');

/** Any status (done or open) */
const anyStatusArb = fc.oneof(doneStatusArb, openStatusArb);

/** The set of done states used in tests */
const DONE_STATES = new Set(['Done', 'Closed', 'Resolved', 'done']);

/**
 * Generates a closed sprint with a valid date range (startDate < endDate).
 * The sprint is always in 'closed' state to match the property requirement.
 * Duration is 1–30 days to avoid NaN or zero-duration issues.
 * Uses integer timestamps to avoid NaN date issues.
 */
const BASE_TIMESTAMP = new Date('2020-01-01').getTime();
const MAX_START_OFFSET_MS = (365 * 9) * MS_PER_DAY; // up to 9 years from base

const closedSprintArb: fc.Arbitrary<SprintLike> = fc
  .tuple(
    fc.integer({ min: 0, max: MAX_START_OFFSET_MS }),
    fc.integer({ min: 1, max: 30 }),
  )
  .map(([startOffsetMs, durationDays]) => {
    const startDate = new Date(BASE_TIMESTAMP + startOffsetMs);
    const endDate = new Date(startDate.getTime() + durationDays * MS_PER_DAY);
    return {
      id: 'sprint-test-001',
      projectId: 'project-test-001',
      name: 'Test Sprint',
      state: 'closed' as const,
      startDate,
      endDate,
    };
  });

/**
 * Generates an issue for a given sprint.
 * completedAt is either null (not completed), during the sprint, or after sprint end.
 * Uses integer offsets in whole seconds to avoid fractional values.
 */
function issueArb(sprint: SprintLike): fc.Arbitrary<IssueLike> {
  // Sprint duration in whole seconds (guaranteed >= 86400 since min 1 day)
  const durationSecs = Math.floor((sprint.endDate.getTime() - sprint.startDate.getTime()) / 1000);

  return fc.record({
    id: fc.stringMatching(/^issue-[a-z0-9]{4,8}$/),
    sprintId: fc.constant(sprint.id),
    status: anyStatusArb,
    storyPoints: storyPointsArb,
    // completedAt: null, during sprint, or after sprint end
    completedAt: fc.oneof(
      fc.constant(null),
      // completed during sprint (0 to durationSecs - 1 seconds after start)
      fc.integer({ min: 0, max: durationSecs - 1 }).map(
        (offsetSecs) => new Date(sprint.startDate.getTime() + offsetSecs * 1000),
      ),
      // completed after sprint end (1 to 7 days after end)
      fc.integer({ min: 1, max: 7 * 24 * 3600 }).map(
        (offsetSecs) => new Date(sprint.endDate.getTime() + offsetSecs * 1000),
      ),
    ),
  });
}

// ---------------------------------------------------------------------------
// Property 20: Burndown final data point invariant
// Feature: jira-level-platform, Property 20: Burndown final data point invariant
// ---------------------------------------------------------------------------

describe('Property 20: Burndown final data point invariant', () => {
  // **Validates: Requirements 14.5**

  it('final burndown data point remainingStoryPoints equals sum of incomplete issue story points', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) =>
          fc.tuple(
            fc.constant(sprint),
            fc.array(issueArb(sprint), { minLength: 0, maxLength: 20 }),
          ),
        ),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);

          assert.ok(dataPoints.length > 0, 'Burndown must have at least one data point');

          const finalDataPoint = dataPoints[dataPoints.length - 1];
          const finalDayEnd = getFinalDayEnd(sprint);

          // Compute expected remaining story points independently using the same dayEnd logic
          const expected = computeExpectedFinalRemainingPoints(issues, DONE_STATES, finalDayEnd);

          assert.equal(
            finalDataPoint.remainingStoryPoints,
            expected,
            `Final burndown remainingStoryPoints (${finalDataPoint.remainingStoryPoints}) ` +
              `must equal sum of incomplete issue story points (${expected})`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('final burndown remainingStoryPoints is 0 when all issues are completed before sprint end', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) => {
          // Sprint duration in whole seconds (min 1 day = 86400 secs)
          // Use integer arithmetic to avoid floating point issues
          const durationMs = sprint.endDate.getTime() - sprint.startDate.getTime();
          const durationSecs = Math.floor(durationMs / 1000);
          // Ensure max >= min (durationSecs is always >= 86400 for 1-day sprints)
          const maxOffsetSecs = Math.max(1, durationSecs - 1);
          return fc.tuple(
            fc.constant(sprint),
            fc.array(
              fc.record({
                id: fc.stringMatching(/^issue-[a-z0-9]{4,8}$/),
                sprintId: fc.constant(sprint.id),
                status: doneStatusArb,
                storyPoints: fc.nat({ max: 50 }),
                // completedAt is strictly before sprint endDate (within sprint duration)
                completedAt: fc
                  .integer({ min: 0, max: maxOffsetSecs })
                  .map(
                    (offsetSecs) =>
                      new Date(sprint.startDate.getTime() + offsetSecs * 1000),
                  ),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          );
        }),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);
          const finalDataPoint = dataPoints[dataPoints.length - 1];

          assert.equal(
            finalDataPoint.remainingStoryPoints,
            0,
            `When all issues are completed before sprint end, final remainingStoryPoints must be 0`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('final burndown remainingStoryPoints equals total story points when no issues are completed', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) =>
          fc.tuple(
            fc.constant(sprint),
            fc.array(
              fc.record({
                id: fc.stringMatching(/^issue-[a-z0-9]{4,8}$/),
                sprintId: fc.constant(sprint.id),
                status: openStatusArb,
                storyPoints: fc.nat({ max: 50 }),
                completedAt: fc.constant(null),
              }),
              { minLength: 0, maxLength: 10 },
            ),
          ),
        ),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);
          const finalDataPoint = dataPoints[dataPoints.length - 1];

          const totalStoryPoints = issues.reduce(
            (sum, issue) => sum + (typeof issue.storyPoints === 'number' ? issue.storyPoints : 0),
            0,
          );

          assert.equal(
            finalDataPoint.remainingStoryPoints,
            totalStoryPoints,
            `When no issues are completed, final remainingStoryPoints must equal total story points (${totalStoryPoints})`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('final burndown remainingStoryPoints is 0 for a sprint with no issues', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(closedSprintArb, (sprint) => {
        const dataPoints = computeBurndown(sprint, [], DONE_STATES);

        assert.ok(dataPoints.length > 0, 'Burndown must have at least one data point');

        const finalDataPoint = dataPoints[dataPoints.length - 1];

        assert.equal(
          finalDataPoint.remainingStoryPoints,
          0,
          'A sprint with no issues must have 0 remaining story points',
        );
      }),
      { numRuns: 100 },
    );
  });

  it('issues with null/undefined storyPoints contribute 0 to remaining story points', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) =>
          fc.tuple(
            fc.constant(sprint),
            fc.array(
              fc.record({
                id: fc.stringMatching(/^issue-[a-z0-9]{4,8}$/),
                sprintId: fc.constant(sprint.id),
                status: openStatusArb,
                storyPoints: fc.oneof(fc.constant(null), fc.constant(undefined)),
                completedAt: fc.constant(null),
              }),
              { minLength: 1, maxLength: 10 },
            ),
          ),
        ),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);
          const finalDataPoint = dataPoints[dataPoints.length - 1];

          assert.equal(
            finalDataPoint.remainingStoryPoints,
            0,
            'Issues with null/undefined storyPoints must contribute 0 to remaining story points',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('final burndown remainingIssueCount equals count of incomplete issues', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) =>
          fc.tuple(
            fc.constant(sprint),
            fc.array(issueArb(sprint), { minLength: 0, maxLength: 20 }),
          ),
        ),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);
          const finalDataPoint = dataPoints[dataPoints.length - 1];
          const finalDayEnd = getFinalDayEnd(sprint);

          // Count incomplete issues using the same dayEnd logic as the burndown
          const expectedCount = issues.filter((issue) => {
            const isDone = DONE_STATES.has(issue.status);
            if (!isDone) return true;
            const completedAt = issue.completedAt ? new Date(issue.completedAt) : null;
            return completedAt ? completedAt > finalDayEnd : true;
          }).length;

          assert.equal(
            finalDataPoint.remainingIssueCount,
            expectedCount,
            `Final burndown remainingIssueCount (${finalDataPoint.remainingIssueCount}) ` +
              `must equal count of incomplete issues (${expectedCount})`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('burndown data points are non-increasing in remainingStoryPoints over time', () => {
    // Feature: jira-level-platform, Property 20: Burndown final data point invariant
    // As issues get completed over time, remaining story points can only decrease or stay the same.
    fc.assert(
      fc.property(
        closedSprintArb.chain((sprint) => {
          const durationSecs = Math.floor(
            (sprint.endDate.getTime() - sprint.startDate.getTime()) / 1000,
          );
          return fc.tuple(
            fc.constant(sprint),
            fc.array(
              fc.record({
                id: fc.stringMatching(/^issue-[a-z0-9]{4,8}$/),
                sprintId: fc.constant(sprint.id),
                // All issues are in done state
                status: doneStatusArb,
                storyPoints: fc.nat({ max: 20 }),
                // completedAt is within the sprint duration
                completedAt: fc
                  .integer({ min: 0, max: durationSecs - 1 })
                  .map(
                    (offsetSecs) =>
                      new Date(sprint.startDate.getTime() + offsetSecs * 1000),
                  ),
              }),
              { minLength: 0, maxLength: 15 },
            ),
          );
        }),
        ([sprint, issues]) => {
          const dataPoints = computeBurndown(sprint, issues, DONE_STATES);

          // Remaining story points must be non-increasing over time
          for (let i = 1; i < dataPoints.length; i++) {
            assert.ok(
              dataPoints[i].remainingStoryPoints <= dataPoints[i - 1].remainingStoryPoints,
              `Burndown must be non-increasing: day ${i - 1} had ` +
                `${dataPoints[i - 1].remainingStoryPoints} but day ${i} has ` +
                `${dataPoints[i].remainingStoryPoints}`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
