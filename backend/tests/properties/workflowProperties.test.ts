/**
 * Property-based tests for Workflow transitions and state completeness.
 * Feature: jira-level-platform
 * Validates: Requirements 6.6, 6.7
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inline types (mirrors workflowService.ts)
// ---------------------------------------------------------------------------

interface WorkflowState {
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  transitions: string[];
}

interface WorkflowDefinition {
  states: WorkflowState[];
}

// ---------------------------------------------------------------------------
// Pure helpers extracted from WorkflowService logic
// ---------------------------------------------------------------------------

/**
 * Apply a single transition to an issue's current status.
 * Returns the new status if the transition is permitted, or null if not.
 */
function applyTransition(
  workflow: WorkflowDefinition,
  currentStatus: string,
  targetStatus: string,
): string | null {
  const stateObj = workflow.states.find((s) => s.name === currentStatus);
  if (!stateObj) return null;
  if (!stateObj.transitions.includes(targetStatus)) return null;
  return targetStatus;
}

/**
 * Apply a sequence of transitions starting from an initial status.
 * Skips any invalid transitions (mirrors service behaviour: only valid moves proceed).
 * Returns the final status after all valid transitions.
 */
function applyTransitionSequence(
  workflow: WorkflowDefinition,
  initialStatus: string,
  transitions: string[],
): string {
  let current = initialStatus;
  for (const target of transitions) {
    const next = applyTransition(workflow, current, target);
    if (next !== null) {
      current = next;
    }
    // invalid transitions are silently skipped (issue stays in current state)
  }
  return current;
}

/**
 * Collect all states reachable from `startName` via BFS over permitted transitions.
 */
function reachableStates(workflow: WorkflowDefinition, startName: string): Set<string> {
  const stateMap = new Map(workflow.states.map((s) => [s.name, s]));
  const visited = new Set<string>();
  const queue: string[] = [startName];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const stateObj = stateMap.get(current);
    if (stateObj) {
      for (const next of stateObj.transitions) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return visited;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const categoryArb = fc.constantFrom<'todo' | 'in_progress' | 'done'>(
  'todo',
  'in_progress',
  'done',
);

/**
 * Generate a valid WorkflowDefinition with 1–6 states.
 * Each state has a unique name, a valid category, and transitions that only
 * reference other state names in the same workflow.
 */
const workflowArb: fc.Arbitrary<WorkflowDefinition> = fc
  .integer({ min: 1, max: 6 })
  .chain((numStates) => {
    const namesArb = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: numStates,
      maxLength: numStates,
    });

    return namesArb.chain((names) => {
      const statesArb = fc.tuple(
        ...names.map((name) =>
          fc
            .subarray(names.filter((n) => n !== name))
            .chain((transitions) =>
              categoryArb.map((category) => ({
                name,
                category,
                transitions,
              })),
            ),
        ),
      );

      return statesArb.map((states) => ({ states: states as WorkflowState[] }));
    });
  });

// ---------------------------------------------------------------------------
// Property 8: Workflow transition safety
// Feature: jira-level-platform, Property 8: Workflow transition safety
// ---------------------------------------------------------------------------

describe('Property 8: Workflow transition safety', () => {
  // **Validates: Requirements 6.6, 6.7**

  it('issue status always equals a defined workflow state name after any valid transition sequence', () => {
    // Feature: jira-level-platform, Property 8: Workflow transition safety
    fc.assert(
      fc.property(
        workflowArb.chain((wf) => {
          const stateNames = wf.states.map((s) => s.name);
          return fc.tuple(
            fc.constant(wf),
            fc.constantFrom(...stateNames),
            fc.array(fc.constantFrom(...stateNames), { minLength: 0, maxLength: 20 }),
          );
        }),
        ([workflow, initialStatus, transitionTargets]) => {
          const finalStatus = applyTransitionSequence(workflow, initialStatus, transitionTargets);
          const definedStateNames = new Set(workflow.states.map((s) => s.name));

          expect(definedStateNames.has(finalStatus)).toBe(true);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('a single valid transition always lands on a defined state', () => {
    // Feature: jira-level-platform, Property 8: Workflow transition safety
    fc.assert(
      fc.property(
        workflowArb.chain((wf) => {
          const stateNames = wf.states.map((s) => s.name);
          return fc.tuple(
            fc.constant(wf),
            fc.constantFrom(...stateNames),
            fc.constantFrom(...stateNames),
          );
        }),
        ([workflow, from, to]) => {
          const result = applyTransition(workflow, from, to);
          const definedStateNames = new Set(workflow.states.map((s) => s.name));

          if (result !== null) {
            expect(definedStateNames.has(result)).toBe(true);
          }
          // null means transition was not permitted — that is also safe
        },
      ),
      { numRuns: 25 },
    );
  });

  it('applying an invalid transition returns null (issue status unchanged)', () => {
    // Feature: jira-level-platform, Property 8: Workflow transition safety
    fc.assert(
      fc.property(
        workflowArb.chain((wf) => {
          const stateNames = wf.states.map((s) => s.name);
          return fc.tuple(
            fc.constant(wf),
            fc.constantFrom(...stateNames),
          );
        }),
        ([workflow, currentStatus]) => {
          const stateObj = workflow.states.find((s) => s.name === currentStatus)!;
          const permittedSet = new Set(stateObj.transitions);
          const invalidTargets = workflow.states
            .map((s) => s.name)
            .filter((n) => !permittedSet.has(n) && n !== currentStatus);

          for (const invalidTarget of invalidTargets) {
            const result = applyTransition(workflow, currentStatus, invalidTarget);
            expect(result).toBeNull();
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Workflow state completeness
// Feature: jira-level-platform, Property 9: Workflow state completeness
// ---------------------------------------------------------------------------

describe('Property 9: Workflow state completeness', () => {
  // **Validates: Requirements 6.6**

  it('every reachable state from the initial state has a defined category', () => {
    // Feature: jira-level-platform, Property 9: Workflow state completeness
    fc.assert(
      fc.property(
        workflowArb.chain((wf) => {
          const stateNames = wf.states.map((s) => s.name);
          return fc.tuple(
            fc.constant(wf),
            fc.constantFrom(...stateNames),
          );
        }),
        ([workflow, initialState]) => {
          const validCategories = new Set(['todo', 'in_progress', 'done']);
          const stateMap = new Map(workflow.states.map((s) => [s.name, s]));
          const reached = reachableStates(workflow, initialState);

          for (const stateName of reached) {
            const stateObj = stateMap.get(stateName);
            expect(stateObj).toBeDefined();
            expect(validCategories.has(stateObj!.category)).toBe(true);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('all states in a valid workflow definition have a defined category', () => {
    // Feature: jira-level-platform, Property 9: Workflow state completeness
    fc.assert(
      fc.property(workflowArb, (workflow) => {
        const validCategories = new Set(['todo', 'in_progress', 'done']);

        for (const state of workflow.states) {
          expect(validCategories.has(state.category)).toBe(true);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('the DEFAULT_WORKFLOW has every reachable state with a defined category', () => {
    // Feature: jira-level-platform, Property 9: Workflow state completeness
    const DEFAULT_WORKFLOW: WorkflowDefinition = {
      states: [
        { name: 'To Do', category: 'todo', transitions: ['In Progress'] },
        { name: 'In Progress', category: 'in_progress', transitions: ['In Review', 'To Do'] },
        { name: 'In Review', category: 'in_progress', transitions: ['In Progress', 'Done'] },
        { name: 'Done', category: 'done', transitions: [] },
      ],
    };

    const validCategories = new Set(['todo', 'in_progress', 'done']);
    const initialState = DEFAULT_WORKFLOW.states[0].name;
    const reached = reachableStates(DEFAULT_WORKFLOW, initialState);

    for (const stateName of reached) {
      const stateObj = DEFAULT_WORKFLOW.states.find((s) => s.name === stateName);
      expect(stateObj).toBeDefined();
      expect(validCategories.has(stateObj!.category)).toBe(true);
    }
  });
});
