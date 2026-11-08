'use strict';

const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const uploadDocumentFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 1, parts: 2, fieldSize: 200 },
    fileFilter: (req, file, callback) => {
        const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
        if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
            return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'document'));
        }
        return callback(null, true);
    },
});

function handleDocumentUploadError(error, req, res, next) {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'Document must not exceed 5 MB.'
            : 'Only PDF, JPG, JPEG, and PNG documents are allowed.';
        return res.status(400).json({ success: false, message });
    }
    console.error('[documents:uploadMiddleware]', error.message);
    return res.status(400).json({ success: false, message: 'Invalid document upload.' });
}

module.exports = { uploadDocumentFile, handleDocumentUploadError, MAX_FILE_SIZE };
