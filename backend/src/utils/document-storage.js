'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STORAGE_ROOT = path.resolve(
    process.env.DOCUMENT_STORAGE_PATH || path.join(__dirname, '../../storage/documents')
);
const GRIEVANCE_ATTACHMENT_STORAGE_ROOT = path.resolve(
    process.env.GRIEVANCE_ATTACHMENT_STORAGE_PATH
        || path.join(__dirname, '../../storage/grievance-attachments')
);
const LEGACY_STORAGE_ROOT_CONFIG = process.env.DOCUMENT_LEGACY_STORAGE_PATH;

const SIGNATURES = [
    { mimeType: 'application/pdf', extension: 'pdf', matches: buffer => buffer.subarray(0, 5).toString() === '%PDF-' },
    { mimeType: 'image/png', extension: 'png', matches: buffer => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { mimeType: 'image/jpeg', extension: 'jpg', matches: buffer => buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) },
    { mimeType: 'image/webp', extension: 'webp', matches: buffer => (
        buffer.length >= 12
        && buffer.subarray(0, 4).toString() === 'RIFF'
        && buffer.subarray(8, 12).toString() === 'WEBP'
    ) },
];

function identifyFileSignature(buffer) {
    return SIGNATURES.find(signature => signature.matches(buffer)) || null;
}

function getStoragePath(storedFilename) {
    if (typeof storedFilename !== 'string'
        || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(storedFilename)) {
        throw new Error('Invalid stored document filename.');
    }

    function getSafeStoragePath(storageRoot, storedFilename) {
        if (typeof storedFilename !== 'string'
            || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(storedFilename)) {
            throw new Error('Invalid stored attachment filename.');
        }
        const safeFilename = path.basename(storedFilename);
        if (safeFilename !== storedFilename) {
            throw new Error('Invalid stored attachment filename.');
        }
        return path.resolve(storageRoot, storedFilename);
    }
    const safeFilename = path.basename(storedFilename);
    if (safeFilename !== storedFilename) {
        throw new Error('Invalid stored document filename.');
    }
    return path.resolve(STORAGE_ROOT, storedFilename);
}

async function getLegacyStoragePath(legacyFilePath) {
    if (!LEGACY_STORAGE_ROOT_CONFIG) {
        const error = new Error('Legacy document storage is not configured.');
        error.code = 'LEGACY_STORAGE_NOT_CONFIGURED';
        throw error;
    }

    const trustedRoot = await fs.promises.realpath(path.resolve(LEGACY_STORAGE_ROOT_CONFIG));
    const candidate = path.isAbsolute(legacyFilePath)
        ? path.resolve(legacyFilePath)
        : path.resolve(trustedRoot, legacyFilePath);
    const resolvedCandidate = await fs.promises.realpath(candidate);
    const relative = path.relative(trustedRoot, resolvedCandidate);
    if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || relative === '..') {
        const error = new Error('Legacy document path is outside the configured storage directory.');
        error.code = 'LEGACY_STORAGE_PATH_INVALID';
        throw error;
    }
    return resolvedCandidate;
}

async function saveDocument(buffer, signature) {
    await fs.promises.mkdir(STORAGE_ROOT, { recursive: true, mode: 0o700 });
    const storedFilename = `${crypto.randomUUID()}.${signature.extension}`;
    const filePath = getStoragePath(storedFilename);
    await fs.promises.writeFile(filePath, buffer, { flag: 'wx', mode: 0o600 });
    return { storedFilename, filePath };
}

async function removeDocument(storedFilename) {
    if (!storedFilename) return;
    try {
        await fs.promises.unlink(getStoragePath(storedFilename));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

async function saveGrievanceAttachment(buffer, signature) {
    await fs.promises.mkdir(GRIEVANCE_ATTACHMENT_STORAGE_ROOT, { recursive: true, mode: 0o700 });
    const storedFilename = `${crypto.randomUUID()}.${signature.extension}`;
    const filePath = getSafeStoragePath(GRIEVANCE_ATTACHMENT_STORAGE_ROOT, storedFilename);
    await fs.promises.writeFile(filePath, buffer, { flag: 'wx', mode: 0o600 });
    return { storedFilename, filePath };
}

async function removeGrievanceAttachment(storedFilename) {
    if (!storedFilename) return;
    try {
        await fs.promises.unlink(
            getSafeStoragePath(GRIEVANCE_ATTACHMENT_STORAGE_ROOT, storedFilename)
        );
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

function getGrievanceAttachmentPath(storedFilename) {
    return getSafeStoragePath(GRIEVANCE_ATTACHMENT_STORAGE_ROOT, storedFilename);
}

module.exports = {
    STORAGE_ROOT,
    GRIEVANCE_ATTACHMENT_STORAGE_ROOT,
    identifyFileSignature,
    saveDocument,
    removeDocument,
    getStoragePath,
    getLegacyStoragePath,
    saveGrievanceAttachment,
    removeGrievanceAttachment,
    getGrievanceAttachmentPath,
};
