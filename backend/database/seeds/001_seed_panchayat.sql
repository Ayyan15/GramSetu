-- Seed 001: Insert Kini Gram Panchayat record
-- Official deployment panchayat for GramSetu Phase 2.
-- Taluka and pincode remain NULL pending administrative verification.
-- This seed is idempotent: INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO panchayats (id, name, marathi_name, village, taluka, district, state, country, pincode, is_active)
VALUES (
    1,
    'Kini Gram Panchayat',
    'किनी ग्रामपंचायत',
    'Kini',
    NULL,
    'Kolhapur',
    'Maharashtra',
    'India',
    NULL,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence past the explicit ID
SELECT setval('panchayats_id_seq', (SELECT MAX(id) FROM panchayats));
