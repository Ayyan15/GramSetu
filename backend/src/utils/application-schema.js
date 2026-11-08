'use strict';

const SUPPORTED_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select']);

function isBlank(value) {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function validateApplicationData(formSchema, applicationData) {
    if (!Array.isArray(formSchema)) {
        return {
            valid: false,
            errors: ['The selected service does not have a valid application form.'],
        };
    }

    if (applicationData === null || typeof applicationData !== 'object' || Array.isArray(applicationData)) {
        return {
            valid: false,
            errors: ['application_data must be a JSON object.'],
        };
    }

    const errors = [];
    const fields = new Map();

    for (const field of formSchema) {
        if (!field || typeof field !== 'object' || typeof field.key !== 'string' || field.key.trim() === '') {
            errors.push('The selected service contains an invalid form field.');
            continue;
        }
        if (fields.has(field.key)) {
            errors.push(`The selected service contains duplicate field "${field.key}".`);
            continue;
        }
        fields.set(field.key, field);
        if (!SUPPORTED_TYPES.has(field.type)) {
            errors.push(`The selected service contains unsupported field "${field.key}".`);
        }
    }

    for (const key of Object.keys(applicationData)) {
        if (!fields.has(key)) {
            errors.push(`Unknown application field: ${key}.`);
        }
    }

    for (const [key, field] of fields) {
        const value = applicationData[key];
        if (isBlank(value)) {
            if (field.required === true) {
                errors.push(`${key} is required.`);
            }
            continue;
        }

        const rules = field.validation && typeof field.validation === 'object'
            ? field.validation
            : {};

        if (field.type === 'text' || field.type === 'textarea') {
            if (typeof value !== 'string') {
                errors.push(`${key} must be text.`);
                continue;
            }
            const length = value.trim().length;
            if (rules.minLength !== undefined && length < rules.minLength) {
                errors.push(`${key} must be at least ${rules.minLength} characters.`);
            }
            if (rules.maxLength !== undefined && length > rules.maxLength) {
                errors.push(`${key} must not exceed ${rules.maxLength} characters.`);
            }
        } else if (field.type === 'number') {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                errors.push(`${key} must be a valid number.`);
                continue;
            }
            if (rules.integer === true && !Number.isInteger(value)) {
                errors.push(`${key} must be a whole number.`);
            }
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${key} must be at least ${rules.min}.`);
            }
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${key} must not exceed ${rules.max}.`);
            }
        } else if (field.type === 'date') {
            if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                errors.push(`${key} must be a valid date.`);
                continue;
            }
            const parsedDate = new Date(`${value}T00:00:00Z`);
            if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
                errors.push(`${key} must be a valid date.`);
            } else if (rules.notFuture === true) {
                const today = new Date().toISOString().slice(0, 10);
                if (value > today) {
                    errors.push(`${key} cannot be a future date.`);
                }
            }
        } else if (field.type === 'select') {
            const options = Array.isArray(field.options) ? field.options : [];
            if (!options.some(option => option && option.value === value)) {
                errors.push(`${key} must be one of the available options.`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateApplicationData };
