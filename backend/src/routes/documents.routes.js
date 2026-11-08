'use strict';

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
    listApplicationDocuments,
    downloadDocument,
    updateDocumentVerification,
} = require('../controllers/documents.controller');

const router = Router();
router.use(requireAuth);

router.get('/:documentId/download', downloadDocument);
router.patch(
    '/:documentId/verification',
    requireRole('PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'),
    updateDocumentVerification
);

module.exports = router;
