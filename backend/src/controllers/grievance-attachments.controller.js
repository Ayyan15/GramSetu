'use strict';

const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const {
    identifyFileSignature,
    saveGrievanceAttachment,
    removeGrievanceAttachment,
    getGrievanceAttachmentPath,
} = require('../utils/document-storage');
const {
    createNotifications,
    findRecipients,
    forRecipients,
} = require('../services/notification.service');

const MAX_ATTACHMENTS = 5;
const VALID_ATTACHMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
]);

function isOfficial(role) {
    return role === 'PANCHAYAT_OFFICIAL' || role === 'SYSTEM_ADMIN';
}

function canAccessGrievance(user, grievance) {
    if (grievance.panchayat_id !== user.panchayat_id) return false;
    if (user.role === 'CITIZEN') return grievance.citizen_id === user.id;
    if (user.role === 'FIELD_WORKER') return grievance.assigned_to === user.id;
    return isOfficial(user.role);
}

function publicAttachment(row) {
    return {
        id: row.id,
        grievance_id: row.grievance_id,
        original_filename: row.original_filename,
        mime_type: row.mime_type,
        file_size: row.file_size,
        created_at: row.created_at,
    };
}

function safeOriginalFilename(filename) {
    const rawFilename = typeof filename === 'string' ? filename : 'attachment';
    const basename = path.basename(path.win32.basename(rawFilename));
    return basename.replace(/[\u0000-\u001f]/g, '_').slice(0, 255) || 'attachment';
}

async function loadGrievanceForUser(grievanceId, user) {
    const result = await pool.query(
        `SELECT id, panchayat_id, citizen_id, assigned_to, status
         FROM grievances
         WHERE id = $1 AND panchayat_id = $2`,
        [grievanceId, user.panchayat_id]
    );
    if (result.rowCount === 0 || !canAccessGrievance(user, result.rows[0])) return null;
    return result.rows[0];
}

async function listGrievanceAttachments(req, res) {
    try {
        const grievance = await loadGrievanceForUser(req.params.id, req.user);
        if (!grievance) return res.status(404).json({ success: false, message: 'Grievance not found.' });
        const result = await pool.query(
            `SELECT id, grievance_id, original_filename, mime_type, file_size, created_at
             FROM grievance_attachments
             WHERE grievance_id = $1 AND panchayat_id = $2
             ORDER BY created_at ASC`,
            [grievance.id, grievance.panchayat_id]
        );
        return res.json({ success: true, attachments: result.rows.map(publicAttachment) });
    } catch (error) {
        console.error('[grievances:attachments:list]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load grievance attachments.' });
    }
}

async function uploadGrievanceAttachment(req, res) {
    if (req.user.role !== 'CITIZEN') {
        return res.status(403).json({ success: false, message: 'Only citizens can upload grievance evidence.' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'An attachment file is required.' });
    }

    const signature = identifyFileSignature(req.file.buffer);
    if (!signature || signature.mimeType !== req.file.mimetype
        || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(signature.mimeType)) {
        return res.status(400).json({ success: false, message: 'The uploaded attachment content is invalid.' });
    }

    let savedAttachment;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const grievanceResult = await client.query(
            `SELECT id, panchayat_id, citizen_id, status
             FROM grievances
             WHERE id = $1 AND panchayat_id = $2 AND citizen_id = $3
             FOR UPDATE`,
            [req.params.id, req.user.panchayat_id, req.user.id]
        );
        if (grievanceResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Grievance not found.' });
        }
        const grievance = grievanceResult.rows[0];
        if (['CLOSED', 'REJECTED'].includes(grievance.status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Attachments cannot be added to a closed or rejected grievance.' });
        }

        const countResult = await client.query(
            'SELECT COUNT(*)::integer AS count FROM grievance_attachments WHERE grievance_id = $1',
            [grievance.id]
        );
        if (countResult.rows[0].count >= MAX_ATTACHMENTS) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: `A grievance may have at most ${MAX_ATTACHMENTS} attachments.` });
        }

        savedAttachment = await saveGrievanceAttachment(req.file.buffer, signature);
        const result = await client.query(
            `INSERT INTO grievance_attachments
                (grievance_id, panchayat_id, uploaded_by, original_filename,
                 stored_filename, mime_type, file_size, storage_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $5)
             RETURNING id, grievance_id, original_filename, mime_type, file_size, created_at`,
            [
                grievance.id,
                grievance.panchayat_id,
                req.user.id,
                safeOriginalFilename(req.file.originalname),
                savedAttachment.storedFilename,
                signature.mimeType,
                req.file.size,
            ]
        );
        const officials = await findRecipients(client, {
            panchayatId: grievance.panchayat_id,
            roles: ['PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'],
        });
        const recipients = [...officials, grievance.assigned_to].filter(Boolean)
            .filter((recipientId, index, values) => values.indexOf(recipientId) === index);
        await createNotifications(client, forRecipients(recipients, {
            panchayatId: grievance.panchayat_id,
            actorId: req.user.id,
            notificationType: 'GRIEVANCE_ATTACHMENT_UPLOADED',
            title: 'New grievance evidence',
            message: 'New evidence was added to a grievance. नवीन पुरावा तक्रारीला जोडला आहे.',
            referenceType: 'grievance_attachment',
            referenceId: result.rows[0].id,
            metadata: { grievance_id: grievance.id },
        }));
        await client.query(
            `INSERT INTO audit_logs
                (user_id, panchayat_id, action, entity_type, entity_id, old_values, new_values)
             VALUES ($1, $2, 'GRIEVANCE_ATTACHMENT_UPLOADED', 'grievance_attachment', $3, NULL, $4::jsonb)`,
            [
                req.user.id,
                grievance.panchayat_id,
                result.rows[0].id,
                JSON.stringify({ grievance_id: grievance.id, mime_type: signature.mimeType, file_size: req.file.size }),
            ]
        );
        await client.query('COMMIT');
        return res.status(201).json({
            success: true,
            message: 'Grievance attachment uploaded successfully.',
            attachment: publicAttachment(result.rows[0]),
        });
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rollbackError) {
                console.error('[grievances:attachments] Rollback failed:', rollbackError.message);
            }
        }
        if (savedAttachment) {
            try { await removeGrievanceAttachment(savedAttachment.storedFilename); } catch (cleanupError) {
                console.error('[grievances:attachments] Cleanup failed:', cleanupError.message);
            }
        }
        console.error('[grievances:attachments:upload]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to upload grievance attachment.' });
    } finally {
        if (client) client.release();
    }
}

async function downloadGrievanceAttachment(req, res) {
    try {
        const result = await pool.query(
            `SELECT a.id, a.original_filename, a.mime_type, a.storage_path,
                    g.panchayat_id, g.citizen_id, g.assigned_to
             FROM grievance_attachments a
             JOIN grievances g ON g.id = a.grievance_id
             WHERE a.id = $1 AND a.panchayat_id = $2`,
            [req.params.attachmentId, req.user.panchayat_id]
        );
        if (result.rowCount === 0 || !canAccessGrievance(req.user, result.rows[0])) {
            return res.status(404).json({ success: false, message: 'Attachment not found.' });
        }
        const attachment = result.rows[0];
        if (!VALID_ATTACHMENT_MIME_TYPES.has(attachment.mime_type)) {
            throw new Error('Stored attachment MIME type is invalid.');
        }
        const filePath = getGrievanceAttachmentPath(attachment.storage_path);
        await fs.promises.access(filePath, fs.constants.R_OK);
        return res.download(filePath, safeOriginalFilename(attachment.original_filename), {
            headers: {
                'Content-Type': attachment.mime_type,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ success: false, message: 'Attachment file is no longer available.' });
        }
        console.error('[grievances:attachments:download]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to download grievance attachment.' });
    }
}

module.exports = {
    listGrievanceAttachments,
    uploadGrievanceAttachment,
    downloadGrievanceAttachment,
    MAX_ATTACHMENTS,
};
