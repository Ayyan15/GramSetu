'use strict';

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const {
    identifyFileSignature,
    saveDocument,
    removeDocument,
    getStoragePath,
    getLegacyStoragePath,
} = require('../utils/document-storage');
const {
    createNotifications,
    findRecipients,
    forRecipients,
} = require('../services/notification.service');

const REVIEW_ROLES = ['PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'];

function isReviewer(role) {
    return REVIEW_ROLES.includes(role);
}

function canAccessApplication(role, userId, panchayatId, row) {
    if (row.panchayat_id !== panchayatId) return false;
    if (role === 'CITIZEN') return row.citizen_id === userId;
    return isReviewer(role);
}

function publicDocument(row) {
    return {
        id: row.id,
        application_id: row.application_id,
        original_filename: row.original_filename,
        document_type: row.document_type,
        mime_type: row.mime_type,
        file_size_bytes: row.file_size_bytes,
        verification_status: row.verification_status,
        verified_by: row.verified_by,
        verified_at: row.verified_at,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function normalizeDocumentType(documentType) {
    return documentType.trim().replace(/\s+/g, ' ');
}

async function uploadDocument(req, res) {
    const { applicationId } = req.params;
    const { document_type: documentType } = req.body || {};
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'A document file is required.' });
    }
    if (typeof documentType !== 'string' || documentType.trim().length === 0 || documentType.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'A valid document type is required.' });
    }

    const normalizedDocumentType = normalizeDocumentType(documentType);
    const signature = identifyFileSignature(req.file.buffer);
    if (!signature || signature.mimeType !== req.file.mimetype) {
        return res.status(400).json({ success: false, message: 'The uploaded document content is invalid.' });
    }

    let savedDocument;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const applicationResult = await client.query(
            `SELECT id
             FROM applications
             WHERE id = $1 AND citizen_id = $2 AND panchayat_id = $3`,
            [applicationId, req.user.id, req.user.panchayat_id]
        );
        if (applicationResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const duplicateResult = await client.query(
            `SELECT id
             FROM application_documents
             WHERE application_id = $1
               AND verification_status <> 'REJECTED'
               AND LOWER(REGEXP_REPLACE(BTRIM(document_type), '\\s+', ' ', 'g'))
                   = LOWER(REGEXP_REPLACE(BTRIM($2), '\\s+', ' ', 'g'))
             LIMIT 1`,
            [applicationId, normalizedDocumentType]
        );
        if (duplicateResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'A document of this type is already active for the application.',
            });
        }

        savedDocument = await saveDocument(req.file.buffer, signature);
        const result = await client.query(
            `INSERT INTO application_documents
                (application_id, document_name, file_path, original_filename,
                 stored_filename, document_type, storage_type, panchayat_id,
                 file_size_bytes, mime_type)
             VALUES ($1, $2, $3, $4, $5, $6, 'PRIVATE', $7, $8, $9)
             RETURNING id, application_id, original_filename, document_type, mime_type,
                       file_size_bytes, verification_status, verified_by, verified_at,
                       rejection_reason, created_at, updated_at`,
            [
                applicationId,
                normalizedDocumentType,
                savedDocument.storedFilename,
                req.file.originalname.slice(0, 255),
                savedDocument.storedFilename,
                normalizedDocumentType,
                req.user.panchayat_id,
                req.file.size,
                signature.mimeType,
            ]
        );
        const officials = await findRecipients(client, {
            panchayatId: req.user.panchayat_id,
            roles: ['PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'],
        });
        await createNotifications(client, forRecipients(officials, {
            panchayatId: req.user.panchayat_id,
            actorId: req.user.id,
            notificationType: 'DOCUMENT_UPLOADED',
            title: 'New document uploaded',
            message: `A document was uploaded for application ${applicationId}. नवीन कागदपत्र अर्जासाठी अपलोड झाले आहे.`,
            referenceType: 'application_document',
            referenceId: result.rows[0].id,
            metadata: { application_id: applicationId, document_type: normalizedDocumentType },
        }));
        await client.query('COMMIT');
        return res.status(201).json({
            success: true,
            message: 'Document uploaded successfully.',
            document: publicDocument(result.rows[0]),
        });
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) {
                console.error('[documents:upload] Rollback failed:', rollbackError.message);
            }
        }
        if (savedDocument) {
            try {
                await removeDocument(savedDocument.storedFilename);
            } catch (cleanupError) {
                console.error('[documents:upload] Cleanup failed:', cleanupError.message);
            }
        }
        console.error('[documents:upload]', error.message);
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'A document of this type is already active for the application.',
            });
        }
        return res.status(500).json({ success: false, message: 'Document upload failed. Please try again.' });
    } finally {
        if (client) client.release();
    }
}

async function listApplicationDocuments(req, res) {
    const { applicationId } = req.params;
    try {
        const result = await pool.query(
            `SELECT d.id, d.application_id, d.original_filename, d.document_type,
                    d.mime_type, d.file_size_bytes, d.verification_status,
                    d.verified_by, d.verified_at, d.rejection_reason,
                    d.created_at, d.updated_at,
                    a.citizen_id, a.panchayat_id
             FROM application_documents d
             JOIN applications a ON a.id = d.application_id
             WHERE d.application_id = $1 AND a.panchayat_id = $2`,
            [applicationId, req.user.panchayat_id]
        );
        if (result.rowCount > 0
            && !canAccessApplication(req.user.role, req.user.id, req.user.panchayat_id, result.rows[0])) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (result.rowCount === 0) {
            const applicationResult = await pool.query(
                'SELECT citizen_id, panchayat_id FROM applications WHERE id = $1 AND panchayat_id = $2',
                [applicationId, req.user.panchayat_id]
            );
            if (applicationResult.rowCount === 0
                || !canAccessApplication(req.user.role, req.user.id, req.user.panchayat_id, applicationResult.rows[0])) {
                return res.status(404).json({ success: false, message: 'Application not found.' });
            }
        }
        return res.json({ success: true, documents: result.rows.map(publicDocument) });
    } catch (error) {
        console.error('[documents:list]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load documents.' });
    }
}

async function downloadDocument(req, res) {
    const { documentId } = req.params;
    try {
        const result = await pool.query(
            `SELECT d.id, d.original_filename, d.stored_filename, d.storage_type,
                    d.legacy_file_path, d.mime_type,
                    a.citizen_id, a.panchayat_id
             FROM application_documents d
             JOIN applications a ON a.id = d.application_id
             WHERE d.id = $1 AND a.panchayat_id = $2`,
            [documentId, req.user.panchayat_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }
        const document = result.rows[0];
        if (!canAccessApplication(req.user.role, req.user.id, req.user.panchayat_id, document)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const filePath = document.storage_type === 'LEGACY'
            ? await getLegacyStoragePath(document.legacy_file_path)
            : getStoragePath(document.stored_filename);
        await fs.promises.access(filePath, fs.constants.R_OK);
        res.type(document.mime_type);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${path.basename(document.original_filename).replace(/["\\\r\n]/g, '_')}"`
        );
        return res.sendFile(filePath);
    } catch (error) {
        if (error.code === 'LEGACY_STORAGE_NOT_CONFIGURED'
            || error.code === 'LEGACY_STORAGE_PATH_INVALID') {
            console.error('[documents:download]', error.message);
            return res.status(503).json({
                success: false,
                message: 'This historical document is not available through the configured storage.',
            });
        }
        if (error.code === 'ENOENT') {
            return res.status(404).json({ success: false, message: 'Document file is unavailable.' });
        }
        console.error('[documents:download]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to download document.' });
    }
}

async function updateDocumentVerification(req, res) {
    const { documentId } = req.params;
    const { status, rejection_reason: rejectionReason } = req.body || {};
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Verification status must be APPROVED or REJECTED.' });
    }
    if (status === 'REJECTED'
        && (typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0)) {
        return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const currentResult = await client.query(
            `SELECT d.id, d.application_id, d.verification_status,
                    a.panchayat_id, a.citizen_id, s.name AS service_name
             FROM application_documents d
             JOIN applications a ON a.id = d.application_id
             JOIN services s ON s.id = a.service_id
             WHERE d.id = $1 AND a.panchayat_id = $2
             FOR UPDATE`,
            [documentId, req.user.panchayat_id]
        );
        if (currentResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }
        const currentDocument = currentResult.rows[0];
        if (currentDocument.verification_status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'This document has already been reviewed.',
            });
        }

        const result = await client.query(
            `UPDATE application_documents d
             SET verification_status = $1,
                 verified_by = $2,
                 verified_at = NOW(),
                 rejection_reason = $3,
                 updated_at = NOW()
             FROM applications a
             WHERE d.id = $4
               AND a.id = d.application_id
               AND a.panchayat_id = $5
               AND d.verification_status = 'PENDING'
             RETURNING d.id, d.application_id, d.original_filename, d.document_type,
                       d.mime_type, d.file_size_bytes, d.verification_status,
                       d.verified_by, d.verified_at, d.rejection_reason,
                       d.created_at, d.updated_at`,
            [
                status,
                req.user.id,
                status === 'REJECTED' ? rejectionReason.trim() : null,
                documentId,
                req.user.panchayat_id,
            ]
        );
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'This document could not be reviewed because its status changed.',
            });
        }
        await client.query(
            `INSERT INTO audit_logs
                (user_id, panchayat_id, action, entity_type, entity_id, old_values, new_values)
             VALUES ($1, $2, 'DOCUMENT_VERIFICATION', 'application_document', $3, $4::jsonb, $5::jsonb)`,
            [
                req.user.id,
                req.user.panchayat_id,
                documentId,
                JSON.stringify({
                    application_id: result.rows[0].application_id,
                    verification_status: currentDocument.verification_status,
                }),
                JSON.stringify({
                    application_id: result.rows[0].application_id,
                    verification_status: status,
                    rejection_reason: status === 'REJECTED' ? rejectionReason.trim() : null,
                    verified_by: req.user.id,
                }),
            ]
        );
        const readableStatus = status.toLowerCase();
        await createNotifications(client, [{
            panchayatId: req.user.panchayat_id,
            recipientId: currentDocument.citizen_id,
            actorId: req.user.id,
            notificationType: 'DOCUMENT_VERIFIED',
            title: `Document ${readableStatus}`,
            message: `Your ${currentDocument.service_name} document was ${readableStatus}.${status === 'REJECTED' ? ` Reason: ${rejectionReason.trim()}` : ''} तुमचे कागदपत्र ${readableStatus} झाले आहे.`,
            referenceType: 'application_document',
            referenceId: documentId,
            metadata: {
                application_id: result.rows[0].application_id,
                verification_status: status,
            },
        }]);
        await client.query('COMMIT');
        return res.json({
            success: true,
            message: `Document ${status.toLowerCase()} successfully.`,
            document: publicDocument(result.rows[0]),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[documents:verify]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to update document verification.' });
    } finally {
        client.release();
    }
}

module.exports = {
    uploadDocument,
    listApplicationDocuments,
    downloadDocument,
    updateDocumentVerification,
};
