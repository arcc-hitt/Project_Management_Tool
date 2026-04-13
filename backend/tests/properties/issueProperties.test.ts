/**
 * Property-based tests for the Issue model.
 * Feature: jira-level-platform
 * Validates: Requirements 1.5, 1.7, 1.8
 */

import * as fc from 'fast-check';
import Issue from '../../src/models/Issue.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const issueTypeArb = fc.constantFrom('task', 'bug', 'epic');

const bugSeverityArb = fc.constantFrom('critical', 'high', 'medium', 'low');

const storyPointsArb = fc.oneof(
  fc.constant(null),
  fc.nat({ max: 100 }),
);

const childIssueIdsArb = fc.array(
  fc.stringMatching(/^[a-f0-9]{24}$/),
  { maxLength: 10 },
);

// Arbitrary for a plain Issue-like data object (no DB interaction needed)
const issueDataArb = fc.record({
  issueType: issueTypeArb,
  bugSeverity: fc.oneof(fc.constant(null), fc.constant(undefined), bugSeverityArb),
  storyPoints: storyPointsArb,
  childIssueIds: childIssueIdsArb,
});

// ---------------------------------------------------------------------------
// Property 1: Issue type field round-trip
// Feature: jira-level-platform, Property 1: Issue type field round-trip
// ---------------------------------------------------------------------------

describe('Property 1: Issue type field round-trip', () => {
  it('serializing and deserializing an Issue preserves issueType, bugSeverity, storyPoints, and childIssueIds', () => {
    fc.assert(
      fc.property(issueDataArb, (data) => {
        const issue = new Issue(data);
        const serialized = JSON.stringify(issue);
        const deserialized = JSON.parse(serialized);

        // issueType must survive the round-trip
        expect(deserialized.issueType).toBe(issue.issueType);

        // storyPoints must survive the round-trip
        expect(deserialized.storyPoints).toBe(issue.storyPoints);

        // childIssueIds must survive the round-trip (deep equality)
        expect(deserialized.childIssueIds).toEqual(issue.childIssueIds);

        // bugSeverity: null/undefined both serialize to absent; treat both as null
        const expectedSeverity = issue.bugSeverity ?? null;
        const actualSeverity = deserialized.bugSeverity ?? null;
        expect(actualSeverity).toBe(expectedSeverity);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Issue key format invariant
// Feature: jira-level-platform, Property 2: Issue key format invariant
// ---------------------------------------------------------------------------

// Arbitrary for a valid project key: 1–6 uppercase alphanumeric characters
const projectKeyArb = fc.stringMatching(/^[A-Z0-9]{1,6}$/);

// Arbitrary for a positive counter (issue number)
const counterArb = fc.integer({ min: 1, max: 999999 });

describe('Property 2: Issue key format invariant', () => {
  it('issueKey built from projectKey + counter always matches /^[A-Z0-9]+-\\d+$/', () => {
    fc.assert(
      fc.property(projectKeyArb, counterArb, (projectKey, counter) => {
        const issueKey = `${projectKey}-${counter}`;
        const issue = new Issue({ issueKey });

        expect(issue.issueKey).toMatch(/^[A-Z0-9]+-\d+$/);
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Invalid issue type rejected
// Feature: jira-level-platform, Property 3: Invalid issue type rejected
// ---------------------------------------------------------------------------

const validIssueTypes = new Set(['task', 'bug', 'epic']);

// Arbitrary for strings that are NOT valid issue types
const invalidIssueTypeArb = fc.string({ minLength: 1 }).filter(
  (s) => !validIssueTypes.has(s),
);

describe('Property 3: Invalid issue type rejected', () => {
  it('Issue.validateCreate() returns errors for any issueType not in {task, bug, epic}', () => {
    fc.assert(
      fc.property(invalidIssueTypeArb, (invalidType) => {
        const errors = Issue.validateCreate({
          title: 'Test Issue',
          projectId: 'proj123',
          createdBy: 'user123',
          issueType: invalidType,
        });

        // Must have at least one error mentioning issueType
        expect(errors.length).toBeGreaterThan(0);
        const hasIssueTypeError = errors.some((e: string) =>
          e.toLowerCase().includes('issuetype') || e.toLowerCase().includes('issue_type'),
        );
        expect(hasIssueTypeError).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});
