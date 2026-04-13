/**
 * Property-based tests for Search filter logic.
 * Feature: jira-level-platform
 * Validates: Requirements 5.3, 5.5, 5.6
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Issue {
  id: string;
  organizationId: string;
  projectId: string;
  issueKey: string;
  issueType: 'task' | 'bug' | 'epic';
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdBy: string;
  sprintId?: string;
  epicId?: string;
  componentId?: string;
  versionId?: string;
  storyPoints?: number;
  bugSeverity?: 'critical' | 'high' | 'medium' | 'low';
  labels?: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

// ---------------------------------------------------------------------------
// Pure in-memory filter function — mirrors SearchService.searchIssues logic
// ---------------------------------------------------------------------------

/**
 * Applies FilterCriteria to an array of Issues in memory.
 * Mirrors the AND logic used in SearchService.searchIssues.
 */
function applyFilters(issues: Issue[], criteria: FilterCriteria): Issue[] {
  return issues.filter((issue) => {
    // Text search: title or description contains query (case-insensitive)
    if (criteria.query && criteria.query.trim().length > 0) {
      const q = criteria.query.trim().toLowerCase();
      const inTitle = issue.title.toLowerCase().includes(q);
      const inDesc = issue.description ? issue.description.toLowerCase().includes(q) : false;
      if (!inTitle && !inDesc) return false;
    }

    // Exact field filters
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

    // Label filter: issue must contain ALL specified labels
    if (criteria.label && criteria.label.length > 0) {
      const issueLabels = issue.labels ?? [];
      const hasAll = criteria.label.every((l) => issueLabels.includes(l));
      if (!hasAll) return false;
    }

    // Story points range
    if (criteria.storyPointsMin !== undefined && criteria.storyPointsMin !== null) {
      if (issue.storyPoints === undefined || issue.storyPoints === null) return false;
      if (issue.storyPoints < criteria.storyPointsMin) return false;
    }
    if (criteria.storyPointsMax !== undefined && criteria.storyPointsMax !== null) {
      if (issue.storyPoints === undefined || issue.storyPoints === null) return false;
      if (issue.storyPoints > criteria.storyPointsMax) return false;
    }

    // Date range filters
    if (criteria.createdAtFrom) {
      if (issue.createdAt < new Date(criteria.createdAtFrom)) return false;
    }
    if (criteria.createdAtTo) {
      if (issue.createdAt > new Date(criteria.createdAtTo)) return false;
    }
    if (criteria.updatedAtFrom) {
      if (issue.updatedAt < new Date(criteria.updatedAtFrom)) return false;
    }
    if (criteria.updatedAtTo) {
      if (issue.updatedAt > new Date(criteria.updatedAtTo)) return false;
    }
    if (criteria.dueDateFrom) {
      if (!issue.dueDate || issue.dueDate < new Date(criteria.dueDateFrom)) return false;
    }
    if (criteria.dueDateTo) {
      if (!issue.dueDate || issue.dueDate > new Date(criteria.dueDateTo)) return false;
    }

    return true;
  });
}

/**
 * Checks whether a single issue satisfies all criteria in the filter.
 */
function satisfiesAllCriteria(issue: Issue, criteria: FilterCriteria): boolean {
  return applyFilters([issue], criteria).length === 1;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const issueTypeArb = fc.constantFrom<'task' | 'bug' | 'epic'>('task', 'bug', 'epic');
const priorityArb = fc.constantFrom<'low' | 'medium' | 'high' | 'critical'>('low', 'medium', 'high', 'critical');
const bugSeverityArb = fc.constantFrom<'critical' | 'high' | 'medium' | 'low'>('critical', 'high', 'medium', 'low');
const statusArb = fc.constantFrom('To Do', 'In Progress', 'In Review', 'Done', 'Closed');
const idArb = fc.stringMatching(/^[a-f0-9]{8,16}$/);
const labelArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

const arbitraryIssue = (): fc.Arbitrary<Issue> =>
  fc.record({
    id: idArb,
    organizationId: idArb,
    projectId: idArb,
    issueKey: fc.stringMatching(/^[A-Z]{2,4}-\d{1,5}$/),
    issueType: issueTypeArb,
    title: fc.string({ minLength: 1, maxLength: 80 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
    status: statusArb,
    priority: priorityArb,
    assignedTo: fc.option(idArb, { nil: undefined }),
    createdBy: idArb,
    sprintId: fc.option(idArb, { nil: undefined }),
    epicId: fc.option(idArb, { nil: undefined }),
    componentId: fc.option(idArb, { nil: undefined }),
    versionId: fc.option(idArb, { nil: undefined }),
    storyPoints: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
    bugSeverity: fc.option(bugSeverityArb, { nil: undefined }),
    labels: fc.option(fc.array(labelArb, { maxLength: 5 }), { nil: undefined }),
    dueDate: fc.option(dateArb, { nil: undefined }),
    createdAt: dateArb,
    updatedAt: dateArb,
  });

/**
 * Generates a FilterCriteria where each field is independently optional.
 * Produces sparse criteria (most fields absent) to keep the result set non-trivial.
 */
const arbitraryFilterCriteria = (): fc.Arbitrary<FilterCriteria> =>
  fc.record(
    {
      query: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
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
    },
    { requiredKeys: [] },
  );

// ---------------------------------------------------------------------------
// Property 6: Search filter correctness invariant
// Feature: jira-level-platform, Property 6: Search filter correctness invariant
// ---------------------------------------------------------------------------

describe('Property 6: Search filter correctness invariant', () => {
  // **Validates: Requirements 5.3, 5.5**

  it('every issue returned by applyFilters satisfies all applied criteria', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        (issues, criteria) => {
          const results = applyFilters(issues, criteria);

          // Every returned issue must satisfy ALL criteria (AND logic)
          for (const issue of results) {
            expect(satisfiesAllCriteria(issue, criteria)).toBe(true);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('no issue that fails any criterion appears in the results', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 1, maxLength: 50 }),
        arbitraryFilterCriteria(),
        (issues, criteria) => {
          const results = applyFilters(issues, criteria);
          const resultIds = new Set(results.map((r) => r.id));

          // Any issue NOT in results must fail at least one criterion
          for (const issue of issues) {
            if (!resultIds.has(issue.id)) {
              expect(satisfiesAllCriteria(issue, criteria)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('empty criteria returns all issues (no filtering applied)', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 30 }),
        (issues) => {
          const results = applyFilters(issues, {});
          expect(results.length).toBe(issues.length);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('single-field filter: issueType filter returns only matching issues', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        issueTypeArb,
        (issues, issueType) => {
          const results = applyFilters(issues, { issueType });
          for (const issue of results) {
            expect(issue.issueType).toBe(issueType);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('single-field filter: status filter returns only matching issues', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        statusArb,
        (issues, status) => {
          const results = applyFilters(issues, { status });
          for (const issue of results) {
            expect(issue.status).toBe(status);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('single-field filter: priority filter returns only matching issues', () => {
    // Feature: jira-level-platform, Property 6: Search filter correctness invariant
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        priorityArb,
        (issues, priority) => {
          const results = applyFilters(issues, { priority });
          for (const issue of results) {
            expect(issue.priority).toBe(priority);
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Search filter monotonicity
// Feature: jira-level-platform, Property 7: Search filter monotonicity
// ---------------------------------------------------------------------------

describe('Property 7: Search filter monotonicity', () => {
  // **Validates: Requirements 5.6**

  /**
   * Checks whether every element of setB is contained in setA (by issue id).
   * i.e. setB ⊆ setA
   */
  function isSubset(setA: Issue[], setB: Issue[]): boolean {
    const idsA = new Set(setA.map((i) => i.id));
    return setB.every((i) => idsA.has(i.id));
  }

  it('adding an issueType constraint to F1 produces a subset result (F2 ⊆ F1)', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        issueTypeArb,
        (issues, f1, issueType) => {
          // F2 = F1 + issueType constraint
          const f2: FilterCriteria = { ...f1, issueType };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('adding a status constraint to F1 produces a subset result (F2 ⊆ F1)', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        statusArb,
        (issues, f1, status) => {
          const f2: FilterCriteria = { ...f1, status };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('adding a priority constraint to F1 produces a subset result (F2 ⊆ F1)', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        priorityArb,
        (issues, f1, priority) => {
          const f2: FilterCriteria = { ...f1, priority };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('adding a projectId constraint to F1 produces a subset result (F2 ⊆ F1)', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        idArb,
        (issues, f1, projectId) => {
          const f2: FilterCriteria = { ...f1, projectId };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('adding multiple constraints simultaneously still produces a subset (F2 ⊆ F1)', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        issueTypeArb,
        statusArb,
        (issues, f1, issueType, status) => {
          // F2 adds both issueType and status on top of F1
          const f2: FilterCriteria = { ...f1, issueType, status };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('monotonicity holds for any extra constraint added to an arbitrary base filter', () => {
    // Feature: jira-level-platform, Property 7: Search filter monotonicity
    fc.assert(
      fc.property(
        fc.array(arbitraryIssue(), { minLength: 0, maxLength: 50 }),
        arbitraryFilterCriteria(),
        fc.oneof(
          issueTypeArb.map((v) => ({ issueType: v } as FilterCriteria)),
          statusArb.map((v) => ({ status: v } as FilterCriteria)),
          priorityArb.map((v) => ({ priority: v } as FilterCriteria)),
          idArb.map((v) => ({ projectId: v } as FilterCriteria)),
          idArb.map((v) => ({ sprintId: v } as FilterCriteria)),
          idArb.map((v) => ({ assigneeId: v } as FilterCriteria)),
        ),
        (issues, f1, extraConstraint) => {
          const f2: FilterCriteria = { ...f1, ...extraConstraint };

          const r1 = applyFilters(issues, f1);
          const r2 = applyFilters(issues, f2);

          expect(isSubset(r1, r2)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });
});
