/**
 * Property-based tests for SavedFilter criteria round-trip.
 * Feature: jira-level-platform
 * Validates: Requirements 8.5
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Types (mirrors SavedFilter.FilterCriteria and SearchService logic)
// ---------------------------------------------------------------------------

interface FilterCriteria {
  query?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  sprintId?: string;
  label?: string[];
  componentId?: string;
  bugSeverity?: string;
  versionId?: string;
  epicId?: string;
  storyPointsMin?: number;
  storyPointsMax?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface Issue {
  id: string;
  projectId: string;
  issueType: 'task' | 'bug' | 'epic';
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  sprintId?: string;
  componentId?: string;
  versionId?: string;
  epicId?: string;
  storyPoints?: number;
  bugSeverity?: 'critical' | 'high' | 'medium' | 'low';
  labels?: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Pure in-memory filter — mirrors SearchService.searchIssues AND logic
// ---------------------------------------------------------------------------

function applyFilters(issues: Issue[], criteria: FilterCriteria): Issue[] {
  return issues.filter((issue) => {
    if (criteria.query && criteria.query.trim().length > 0) {
      const q = criteria.query.trim().toLowerCase();
      const inTitle = issue.title.toLowerCase().includes(q);
      const inDesc = issue.description ? issue.description.toLowerCase().includes(q) : false;
      if (!inTitle && !inDesc) return false;
    }
    if (criteria.issueType && issue.issueType !== criteria.issueType) return false;
    if (criteria.status && issue.status !== criteria.status) return false;
    if (criteria.priority && issue.priority !== criteria.priority) return false;
    if (criteria.assigneeId && issue.assignedTo !== criteria.assigneeId) return false;
    if (criteria.projectId && issue.projectId !== criteria.projectId) return false;
    if (criteria.sprintId && issue.sprintId !== criteria.sprintId) return false;
    if (criteria.componentId && issue.componentId !== criteria.componentId) return false;
    if (criteria.bugSeverity && issue.bugSeverity !== criteria.bugSeverity) return false;
    if (criteria.versionId && issue.versionId !== criteria.versionId) return false;
    if (criteria.epicId && issue.epicId !== criteria.epicId) return false;
    if (criteria.label && criteria.label.length > 0) {
      const issueLabels = issue.labels ?? [];
      if (!criteria.label.every((l) => issueLabels.includes(l))) return false;
    }
    if (criteria.storyPointsMin != null) {
      if (issue.storyPoints == null || issue.storyPoints < criteria.storyPointsMin) return false;
    }
    if (criteria.storyPointsMax != null) {
      if (issue.storyPoints == null || issue.storyPoints > criteria.storyPointsMax) return false;
    }
    if (criteria.createdAtFrom && issue.createdAt < new Date(criteria.createdAtFrom)) return false;
    if (criteria.createdAtTo && issue.createdAt > new Date(criteria.createdAtTo)) return false;
    if (criteria.updatedAtFrom && issue.updatedAt < new Date(criteria.updatedAtFrom)) return false;
    if (criteria.updatedAtTo && issue.updatedAt > new Date(criteria.updatedAtTo)) return false;
    if (criteria.dueDateFrom && (!issue.dueDate || issue.dueDate < new Date(criteria.dueDateFrom))) return false;
    if (criteria.dueDateTo && (!issue.dueDate || issue.dueDate > new Date(criteria.dueDateTo))) return false;
    return true;
  });
}

/**
 * Serializes a FilterCriteria to JSON and back, as SavedFilter.criteria is
 * stored and retrieved via MongoDB (BSON → JSON round-trip).
 */
function roundTripCriteria(criteria: FilterCriteria): FilterCriteria {
  return JSON.parse(JSON.stringify(criteria));
}

/**
 * Returns the sorted list of issue IDs from a result set.
 */
function resultIds(issues: Issue[]): string[] {
  return issues.map((i) => i.id).sort();
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const issueTypeArb = fc.constantFrom<'task' | 'bug' | 'epic'>('task', 'bug', 'epic');
const priorityArb = fc.constantFrom<'low' | 'medium' | 'high' | 'critical'>('low', 'medium', 'high', 'critical');
const bugSeverityArb = fc.constantFrom<'critical' | 'high' | 'medium' | 'low'>('critical', 'high', 'medium', 'low');
const statusArb = fc.constantFrom('To Do', 'In Progress', 'In Review', 'Done');
const idArb = fc.stringMatching(/^[a-f0-9]{8,12}$/);
const labelArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
const isoDateArb = fc
  .date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') })
  .filter((d) => !isNaN(d.getTime()))
  .map((d) => d.toISOString());

const arbitraryIssue = (): fc.Arbitrary<Issue> =>
  fc.record({
    id: idArb,
    projectId: idArb,
    issueType: issueTypeArb,
    title: fc.string({ minLength: 1, maxLength: 60 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
    status: statusArb,
    priority: priorityArb,
    assignedTo: fc.option(idArb, { nil: undefined }),
    sprintId: fc.option(idArb, { nil: undefined }),
    componentId: fc.option(idArb, { nil: undefined }),
    versionId: fc.option(idArb, { nil: undefined }),
    epicId: fc.option(idArb, { nil: undefined }),
    storyPoints: fc.option(fc.nat({ max: 50 }), { nil: undefined }),
    bugSeverity: fc.option(bugSeverityArb, { nil: undefined }),
    labels: fc.option(fc.array(labelArb, { maxLength: 4 }), { nil: undefined }),
    dueDate: fc.option(fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }), { nil: undefined }),
    createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
    updatedAt: fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }),
  });

/**
 * Generates a FilterCriteria with all fields optional.
 * Date range fields are generated as ISO strings to survive JSON round-trip.
 */
const arbitraryFilterCriteria = (): fc.Arbitrary<FilterCriteria> =>
  fc.record(
    {
      query: fc.option(fc.string({ minLength: 1, maxLength: 15 }), { nil: undefined }),
      issueType: fc.option(issueTypeArb, { nil: undefined }),
      status: fc.option(statusArb, { nil: undefined }),
      priority: fc.option(priorityArb, { nil: undefined }),
      assigneeId: fc.option(idArb, { nil: undefined }),
      projectId: fc.option(idArb, { nil: undefined }),
      sprintId: fc.option(idArb, { nil: undefined }),
      label: fc.option(fc.array(labelArb, { minLength: 1, maxLength: 2 }), { nil: undefined }),
      componentId: fc.option(idArb, { nil: undefined }),
      bugSeverity: fc.option(bugSeverityArb, { nil: undefined }),
      versionId: fc.option(idArb, { nil: undefined }),
      epicId: fc.option(idArb, { nil: undefined }),
      storyPointsMin: fc.option(fc.nat({ max: 20 }), { nil: undefined }),
      storyPointsMax: fc.option(fc.integer({ min: 21, max: 50 }), { nil: undefined }),
      createdAtFrom: fc.option(isoDateArb, { nil: undefined }),
      createdAtTo: fc.option(isoDateArb, { nil: undefined }),
      updatedAtFrom: fc.option(isoDateArb, { nil: undefined }),
      updatedAtTo: fc.option(isoDateArb, { nil: undefined }),
      dueDateFrom: fc.option(isoDateArb, { nil: undefined }),
      dueDateTo: fc.option(isoDateArb, { nil: undefined }),
    },
    { requiredKeys: [] },
  );

// ---------------------------------------------------------------------------
// Property 14: Saved filter criteria round-trip
// Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
// ---------------------------------------------------------------------------

describe('Property 14: Saved filter criteria round-trip', () => {
  // **Validates: Requirements 8.5**

  it('JSON round-trip of FilterCriteria preserves all field values', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(arbitraryFilterCriteria(), (criteria) => {
        const restored = roundTripCriteria(criteria);

        // Every key present in the original must survive with the same value
        for (const key of Object.keys(criteria) as (keyof FilterCriteria)[]) {
          const original = criteria[key];
          const after = restored[key];

          if (Array.isArray(original)) {
            expect(after).toEqual(original);
          } else {
            expect(after).toBe(original);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('executing criteria before and after JSON round-trip returns the same issue IDs', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 40 }),
        arbitraryFilterCriteria(),
        (issues, criteria) => {
          const beforeRoundTrip = applyFilters(issues, criteria);
          const afterRoundTrip = applyFilters(issues, roundTripCriteria(criteria));

          expect(resultIds(afterRoundTrip)).toEqual(resultIds(beforeRoundTrip));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('round-tripped criteria produces identical results for every individual issue', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 1, maxLength: 30 }),
        arbitraryFilterCriteria(),
        (issues, criteria) => {
          const restored = roundTripCriteria(criteria);

          for (const issue of issues) {
            const matchesBefore = applyFilters([issue], criteria).length === 1;
            const matchesAfter = applyFilters([issue], restored).length === 1;
            expect(matchesAfter).toBe(matchesBefore);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty criteria survives round-trip and still returns all issues', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 30 }),
        (issues) => {
          const empty: FilterCriteria = {};
          const restored = roundTripCriteria(empty);

          expect(applyFilters(issues, restored).length).toBe(issues.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('single-field criteria survives round-trip with correct filtering', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 40 }),
        issueTypeArb,
        (issues, issueType) => {
          const criteria: FilterCriteria = { issueType };
          const restored = roundTripCriteria(criteria);

          expect(restored.issueType).toBe(issueType);
          expect(resultIds(applyFilters(issues, restored))).toEqual(
            resultIds(applyFilters(issues, criteria)),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('label array survives round-trip and filters correctly', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 40 }),
        fc.array(labelArb, { minLength: 1, maxLength: 3 }),
        (issues, label) => {
          const criteria: FilterCriteria = { label };
          const restored = roundTripCriteria(criteria);

          expect(restored.label).toEqual(label);
          expect(resultIds(applyFilters(issues, restored))).toEqual(
            resultIds(applyFilters(issues, criteria)),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('numeric range fields survive round-trip without type coercion', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(
        fc.nat({ max: 20 }),
        fc.integer({ min: 21, max: 50 }),
        (storyPointsMin, storyPointsMax) => {
          const criteria: FilterCriteria = { storyPointsMin, storyPointsMax };
          const restored = roundTripCriteria(criteria);

          expect(typeof restored.storyPointsMin).toBe('number');
          expect(typeof restored.storyPointsMax).toBe('number');
          expect(restored.storyPointsMin).toBe(storyPointsMin);
          expect(restored.storyPointsMax).toBe(storyPointsMax);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ISO date string fields survive round-trip unchanged', () => {
    // Feature: jira-level-platform, Property 14: Saved filter criteria round-trip
    fc.assert(
      fc.property(isoDateArb, isoDateArb, (createdAtFrom, createdAtTo) => {
        const criteria: FilterCriteria = { createdAtFrom, createdAtTo };
        const restored = roundTripCriteria(criteria);

        expect(restored.createdAtFrom).toBe(createdAtFrom);
        expect(restored.createdAtTo).toBe(createdAtTo);
      }),
      { numRuns: 100 },
    );
  });
});
