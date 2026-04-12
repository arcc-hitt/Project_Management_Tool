/**
 * Property-based tests for Board reorder logic.
 * Feature: jira-level-platform
 * Validates: Requirements 2.4, 2.5, 2.9
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure helpers extracted from BoardService.reorderIssues logic
// ---------------------------------------------------------------------------

/**
 * Pure reorder function that mirrors the set-invariant + sequential-position
 * logic in BoardService.reorderIssues.
 *
 * Given a current list of issue IDs and a desired ordering (also a list of
 * issue IDs), validates that the sets are equal and returns the reordered
 * list with sequential position values starting at 0.
 *
 * Throws if the set invariant is violated.
 */
function reorder(
  currentIds: string[],
  orderedIds: string[],
): Array<{ id: string; position: number }> {
  const currentSet = new Set(currentIds);
  const incomingSet = new Set(orderedIds);

  if (currentSet.size !== incomingSet.size) {
    throw new Error('Reorder set invariant violated: ID count mismatch');
  }
  for (const id of incomingSet) {
    if (!currentSet.has(id)) {
      throw new Error(`Reorder set invariant violated: unknown id ${id}`);
    }
  }

  return orderedIds.map((id, index) => ({ id, position: index }));
}

/**
 * Helper: compare two Sets for equality.
 */
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty array of unique string IDs and a permutation of them.
 * This guarantees the set invariant holds so we can test the happy path.
 */
const reorderInputArb = fc
  .array(fc.string({ minLength: 1, maxLength: 24 }), { minLength: 1, maxLength: 20 })
  .chain((ids) => {
    // Deduplicate to ensure unique IDs (mirrors real DB behaviour)
    const unique = Array.from(new Set(ids));
    // Generate a shuffled permutation of the same IDs
    return fc.shuffledSubarray(unique, { minLength: unique.length, maxLength: unique.length }).map(
      (shuffled) => ({ currentIds: unique, orderedIds: shuffled }),
    );
  });

// ---------------------------------------------------------------------------
// Property 4: Board reorder set invariant
// Feature: jira-level-platform, Property 4: Board reorder set invariant
// ---------------------------------------------------------------------------

describe('Property 4: Board reorder set invariant', () => {
  // **Validates: Requirements 2.4, 2.9**

  it('reordering preserves the exact set of issue IDs — no additions or removals', () => {
    // Feature: jira-level-platform, Property 4: Board reorder set invariant
    fc.assert(
      fc.property(reorderInputArb, ({ currentIds, orderedIds }) => {
        const before = new Set(currentIds);
        const result = reorder(currentIds, orderedIds);
        const after = new Set(result.map((r) => r.id));

        expect(setsEqual(before, after)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('reorder throws when incoming IDs contain an unknown ID', () => {
    // Feature: jira-level-platform, Property 4: Board reorder set invariant
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1 }),
        (currentIds, unknownId) => {
          const unique = Array.from(new Set(currentIds));
          fc.pre(!unique.includes(unknownId));

          // Replace one element with the unknown ID to violate the set invariant
          const tampered = [...unique.slice(0, -1), unknownId];

          expect(() => reorder(unique, tampered)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('reorder throws when incoming IDs count differs from current IDs count', () => {
    // Feature: jira-level-platform, Property 4: Board reorder set invariant
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
        (ids) => {
          const unique = Array.from(new Set(ids));
          fc.pre(unique.length >= 2);

          // Drop one ID to create a count mismatch
          const truncated = unique.slice(0, -1);

          expect(() => reorder(unique, truncated)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Board reorder position uniqueness
// Feature: jira-level-platform, Property 5: Board reorder position uniqueness
// ---------------------------------------------------------------------------

describe('Property 5: Board reorder position uniqueness', () => {
  // **Validates: Requirements 2.5**

  it('all positions after reorder are unique non-negative integers', () => {
    // Feature: jira-level-platform, Property 5: Board reorder position uniqueness
    fc.assert(
      fc.property(reorderInputArb, ({ currentIds, orderedIds }) => {
        const result = reorder(currentIds, orderedIds);

        const positions = result.map((r) => r.position);

        // All positions must be non-negative integers
        for (const pos of positions) {
          expect(Number.isInteger(pos)).toBe(true);
          expect(pos).toBeGreaterThanOrEqual(0);
        }

        // All positions must be unique
        const positionSet = new Set(positions);
        expect(positionSet.size).toBe(positions.length);
      }),
      { numRuns: 200 },
    );
  });

  it('positions form a contiguous sequence starting at 0', () => {
    // Feature: jira-level-platform, Property 5: Board reorder position uniqueness
    fc.assert(
      fc.property(reorderInputArb, ({ currentIds, orderedIds }) => {
        const result = reorder(currentIds, orderedIds);
        const sorted = result.map((r) => r.position).sort((a, b) => a - b);

        // Must be exactly [0, 1, 2, ..., n-1]
        for (let i = 0; i < sorted.length; i++) {
          expect(sorted[i]).toBe(i);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('position of each issue equals its index in the ordered list', () => {
    // Feature: jira-level-platform, Property 5: Board reorder position uniqueness
    fc.assert(
      fc.property(reorderInputArb, ({ currentIds, orderedIds }) => {
        const result = reorder(currentIds, orderedIds);

        for (let i = 0; i < result.length; i++) {
          expect(result[i].id).toBe(orderedIds[i]);
          expect(result[i].position).toBe(i);
        }
      }),
      { numRuns: 200 },
    );
  });
});
