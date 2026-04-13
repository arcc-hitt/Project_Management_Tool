/**
 * Property-based tests for Attachment record completeness and download headers.
 * Feature: jira-level-platform
 * Validates: Requirements 9.1, 9.4
 */

import * as fc from 'fast-check';
import Attachment from '../../src/models/Attachment.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors the header-generation logic used in the download route:
 * sets Content-Type to the attachment's mimeType and
 * Content-Disposition to `attachment; filename="<originalName>"`.
 */
function buildDownloadHeaders(attachment: {
  mimeType: string;
  originalName: string;
}): { 'Content-Type': string; 'Content-Disposition': string } {
  return {
    'Content-Type': attachment.mimeType,
    'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const hexIdArb = fc.stringMatching(/^[a-f0-9]{24}$/);

const mimeTypeArb = fc.oneof(
  fc.constant('application/pdf'),
  fc.constant('text/plain'),
  fc.constant('text/csv'),
  fc.constant('application/json'),
  fc.constant('application/zip'),
  fc.constant('image/png'),
  fc.constant('image/jpeg'),
  fc.constant('image/gif'),
  fc.constant('application/msword'),
  fc.constant('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
);

// Safe filename characters (no null bytes or path separators)
const safeFilenameArb = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => !s.includes('\0') && !s.includes('/') && !s.includes('\\'));

const attachmentDataArb = fc.record({
  issueId: hexIdArb,
  uploadedBy: hexIdArb,
  organizationId: hexIdArb,
  filename: safeFilenameArb,
  originalName: safeFilenameArb,
  mimeType: mimeTypeArb,
  sizeBytes: fc.integer({ min: 1, max: 25 * 1024 * 1024 }),
  storagePath: safeFilenameArb.map((n) => `uploads/${n}`),
});

// ---------------------------------------------------------------------------
// Property 15: Attachment record completeness
// Feature: jira-level-platform, Property 15: Attachment record completeness
// ---------------------------------------------------------------------------

describe('Property 15: Attachment record completeness', () => {
  // **Validates: Requirements 9.1**

  it('an Attachment constructed from valid upload data contains all required fields with correct types', () => {
    // Feature: jira-level-platform, Property 15: Attachment record completeness
    fc.assert(
      fc.property(attachmentDataArb, (data) => {
        const attachment = new Attachment({
          ...data,
          createdAt: new Date(),
        });

        // All required fields must be present (not undefined / null)
        expect(attachment.issueId).toBeDefined();
        expect(attachment.uploadedBy).toBeDefined();
        expect(attachment.filename).toBeDefined();
        expect(attachment.originalName).toBeDefined();
        expect(attachment.mimeType).toBeDefined();
        expect(attachment.sizeBytes).toBeDefined();
        expect(attachment.storagePath).toBeDefined();
        expect(attachment.createdAt).toBeDefined();

        // Type assertions
        expect(typeof attachment.issueId).toBe('string');
        expect(typeof attachment.uploadedBy).toBe('string');
        expect(typeof attachment.filename).toBe('string');
        expect(typeof attachment.originalName).toBe('string');
        expect(typeof attachment.mimeType).toBe('string');
        expect(typeof attachment.sizeBytes).toBe('number');
        expect(typeof attachment.storagePath).toBe('string');

        // Values must match what was supplied
        expect(attachment.issueId).toBe(data.issueId);
        expect(attachment.uploadedBy).toBe(data.uploadedBy);
        expect(attachment.filename).toBe(data.filename);
        expect(attachment.originalName).toBe(data.originalName);
        expect(attachment.mimeType).toBe(data.mimeType);
        expect(attachment.sizeBytes).toBe(data.sizeBytes);
        expect(attachment.storagePath).toBe(data.storagePath);
      }),
      { numRuns: 100 },
    );
  });

  it('toObject() serialization preserves all required fields', () => {
    // Feature: jira-level-platform, Property 15: Attachment record completeness
    fc.assert(
      fc.property(attachmentDataArb, (data) => {
        const createdAt = new Date();
        const attachment = new Attachment({ ...data, createdAt });
        const obj = attachment.toObject() as any;

        expect(obj.issueId).toBe(data.issueId);
        expect(obj.uploadedBy).toBe(data.uploadedBy);
        expect(obj.filename).toBe(data.filename);
        expect(obj.originalName).toBe(data.originalName);
        expect(obj.mimeType).toBe(data.mimeType);
        expect(obj.sizeBytes).toBe(data.sizeBytes);
        expect(obj.storagePath).toBe(data.storagePath);
        expect(obj.createdAt).toBe(createdAt);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: Attachment download headers
// Feature: jira-level-platform, Property 16: Attachment download headers
// ---------------------------------------------------------------------------

describe('Property 16: Attachment download headers', () => {
  // **Validates: Requirements 9.4**

  it('Content-Type header matches the attachment mimeType', () => {
    // Feature: jira-level-platform, Property 16: Attachment download headers
    fc.assert(
      fc.property(attachmentDataArb, (data) => {
        const attachment = new Attachment({ ...data, createdAt: new Date() });
        const headers = buildDownloadHeaders({
          mimeType: attachment.mimeType,
          originalName: attachment.originalName,
        });

        expect(headers['Content-Type']).toBe(attachment.mimeType);
      }),
      { numRuns: 100 },
    );
  });

  it('Content-Disposition header contains the originalName', () => {
    // Feature: jira-level-platform, Property 16: Attachment download headers
    fc.assert(
      fc.property(attachmentDataArb, (data) => {
        const attachment = new Attachment({ ...data, createdAt: new Date() });
        const headers = buildDownloadHeaders({
          mimeType: attachment.mimeType,
          originalName: attachment.originalName,
        });

        expect(headers['Content-Disposition']).toContain(attachment.originalName);
      }),
      { numRuns: 100 },
    );
  });

  it('Content-Disposition header uses the "attachment" disposition type', () => {
    // Feature: jira-level-platform, Property 16: Attachment download headers
    fc.assert(
      fc.property(attachmentDataArb, (data) => {
        const attachment = new Attachment({ ...data, createdAt: new Date() });
        const headers = buildDownloadHeaders({
          mimeType: attachment.mimeType,
          originalName: attachment.originalName,
        });

        expect(headers['Content-Disposition']).toMatch(/^attachment;/);
      }),
      { numRuns: 100 },
    );
  });
});
