import express from 'express';
import multer from 'multer';
import attachmentService from '../services/attachmentService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /api/issues/:id/attachments — upload attachment
router.post('/issues/:id/attachments', authenticateToken, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File size exceeds the 25 MB limit' });
      }
      return next(err);
    }
    try {
      const attachment = await attachmentService.uploadAttachment(
        req.params.id,
        req.file,
        req.user.id
      );
      return res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  });
});

// GET /api/issues/:id/attachments/:aid/download — download attachment
router.get('/issues/:id/attachments/:aid/download', authenticateToken, async (req, res, next) => {
  try {
    const { attachment, stream } = await attachmentService.downloadAttachment(
      req.params.aid,
      req.user.id
    );
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    stream.pipe(res);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// DELETE /api/issues/:id/attachments/:aid — delete attachment
router.delete('/issues/:id/attachments/:aid', authenticateToken, async (req, res, next) => {
  try {
    await attachmentService.deleteAttachment(req.params.aid, req.user.id);
    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

export default router;
