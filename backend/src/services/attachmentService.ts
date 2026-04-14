import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Attachment from '../models/Attachment.js';
import Issue from '../models/Issue.js';
import ProjectMember from '../models/ProjectMember.js';
import webhookService from './webhookService.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const createError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const isMimeTypeAllowed = (mimeType: string): boolean => {
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith('image/')) return true;
  return false;
};

const attachmentService = {
  async uploadAttachment(
    issueId: string,
    file: Express.Multer.File,
    userId: string
  ): Promise<Attachment> {
    if (!isMimeTypeAllowed(file.mimetype)) {
      throw createError(`File type '${file.mimetype}' is not allowed`, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw createError('File size exceeds the 25 MB limit', 413);
    }

    const uniqueFilename = `${crypto.randomUUID()}-${file.originalname}`;
    const storagePath = path.join('uploads', uniqueFilename);

    await fs.promises.mkdir('uploads', { recursive: true });
    await fs.promises.writeFile(storagePath, file.buffer);

    const attachment = await Attachment.create({
      issueId,
      uploadedBy: userId,
      filename: uniqueFilename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath,
    });

    // Dispatch webhook event (Req 10.2)
    const issue = await Issue.findById(issueId).catch(() => null);
    if (issue) {
      webhookService.dispatchEvent('attachment.uploaded', issue.projectId, { attachment, issueId }).catch((err) => {
        console.error('webhook dispatch (attachment.uploaded) error:', err);
      });
    }

    return attachment;
  },

  async downloadAttachment(
    attachmentId: string,
    userId: string
  ): Promise<{ attachment: Attachment; stream: fs.ReadStream }> {
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      throw createError('Attachment not found', 404);
    }

    const issue = await Issue.findById(attachment.issueId);
    if (!issue) {
      throw createError('Issue not found', 404);
    }

    const member = await ProjectMember.findOne({ projectId: issue.projectId, userId });
    if (!member) {
      throw createError('Access denied: not a member of this project', 403);
    }

    const stream = fs.createReadStream(attachment.storagePath);
    return { attachment, stream };
  },

  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      throw createError('Attachment not found', 404);
    }

    const issue = await Issue.findById(attachment.issueId);
    if (!issue) {
      throw createError('Issue not found', 404);
    }

    const member = await ProjectMember.findOne({ projectId: issue.projectId, userId });
    if (!member) {
      throw createError('Access denied: not a member of this project', 403);
    }

    try {
      await fs.promises.unlink(attachment.storagePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }

    await Attachment.delete(attachmentId);
  },
};

export default attachmentService;
