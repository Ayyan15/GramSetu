'use strict';

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { uploadDocument, listApplicationDocuments } = require('../controllers/documents.controller');
const { uploadDocumentFile, handleDocumentUploadError } = require('../middleware/document-upload.middleware');
const {
    listApplications,
    submitApplication,
    updateApplicationStatus,
} = require('../controllers/applications.controller');

const router = Router();
router.use(requireAuth);

router.get('/', listApplications);
router.post('/', requireRole('CITIZEN'), submitApplication);
router.post(
    '/:applicationId/documents',
    requireRole('CITIZEN'),
    uploadDocumentFile.single('document'),
    handleDocumentUploadError,
    uploadDocument
);
router.get('/:applicationId/documents', listApplicationDocuments);
router.patch(
    '/:id/status',
    requireRole('PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'),
    updateApplicationStatus
);

module.exports = router;
