# Property-Based Tests

This directory contains property-based tests using `fast-check`.

Each test file corresponds to a set of correctness properties defined in the design document.

| File | Properties |
|---|---|
| `issueProperties.test.ts` | 1–3 (Issue type round-trip, key format, invalid type rejection) |
| `boardProperties.test.ts` | 4–5 (Reorder set invariant, position uniqueness) |
| `searchProperties.test.ts` | 6–7 (Filter correctness, monotonicity) |
| `workflowProperties.test.ts` | 8–9 (Transition safety, state completeness) |
| `sprintProperties.test.ts` | 10–13 (Date ordering, single active sprint, state machine, close moves issues) |
| `filterProperties.test.ts` | 14 (Saved filter criteria round-trip) |
| `attachmentProperties.test.ts` | 15–16 (Record completeness, download headers) |
| `webhookProperties.test.ts` | 17 (HMAC signature determinism) |
| `auditProperties.test.ts` | 18–19 (Log completeness, timestamp monotonicity) |
| `reportProperties.test.ts` | 20 (Burndown final data point) |
| `tenantProperties.test.ts` | 21 (Tenant isolation) |
| `cacheProperties.test.ts` | 22 (Cache correctness) |
| `aiProperties.test.ts` | 23 (AI estimation Fibonacci) |
| `importExportProperties.test.ts` | 24 (Import/export round-trip) |
| `componentProperties.test.ts` | 25 (Component deletion cascade) |
| `notificationProperties.test.ts` | 26 (Notification fan-out) |
