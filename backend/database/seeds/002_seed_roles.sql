-- Seed 002: Insert the four application roles
-- These values are application constants and must never be changed after seeding.
-- This seed is idempotent: INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO roles (id, name, description) VALUES
    (1, 'CITIZEN',              'Registered village resident who can apply for services and submit grievances'),
    (2, 'PANCHAYAT_OFFICIAL',   'Elected or appointed Gram Panchayat staff member'),
    (3, 'FIELD_WORKER',         'On-ground task executor assigned by officials'),
    (4, 'SYSTEM_ADMIN',         'Platform administrator with full system access')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to avoid conflicts with the explicit IDs above
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
