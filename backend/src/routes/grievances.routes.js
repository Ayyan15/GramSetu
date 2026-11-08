'use strict';

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
    listGrievances,
    listFieldWorkers,
    createGrievance,
    assignGrievance,
    updateGrievanceStatus,
} = require('../controllers/grievances.controller');
const {
    listGrievanceAttachments,
    uploadGrievanceAttachment,
    downloadGrievanceAttachment,
} = require('../controllers/grievance-attachments.controller');
const {
    uploadGrievanceAttachment: uploadMiddleware,
    handleGrievanceUploadError,
} = require('../middleware/grievance-upload.middleware');

const router = Router();
router.use(requireAuth);

router.get('/',              listGrievances);
router.get('/workers',       requireRole('PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'), listFieldWorkers);
router.get('/attachments/:attachmentId/download', downloadGrievanceAttachment);
router.post('/',             requireRole('CITIZEN'), createGrievance);
router.get('/:id/attachments', listGrievanceAttachments);
router.post(
    '/:id/attachments',
    requireRole('CITIZEN'),
    uploadMiddleware.single('attachment'),
    handleGrievanceUploadError,
    uploadGrievanceAttachment
);
router.patch('/:id/assign',  requireRole('PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'), assignGrievance);
router.patch('/:id/status', updateGrievanceStatus);

module.exports = router;
