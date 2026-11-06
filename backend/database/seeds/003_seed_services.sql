-- Seed 003: Kini Gram Panchayat – Default Services
-- Eight common certificates/services offered by Indian gram panchayats.
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO services (panchayat_id, name, name_marathi, description, category, required_docs, processing_days, fee_amount)
VALUES
  (1, 'Domicile Certificate',      'अधिवास प्रमाणपत्र',   'Proof of residency in Kini village',                        'certificate', '["Aadhaar Card", "Ration Card", "Electricity Bill"]',           7,  50.00),
  (1, 'Income Certificate',        'उत्पन्न प्रमाणपत्र',   'Certification of annual family income',                     'certificate', '["Aadhaar Card", "Bank Statement", "Affidavit"]',               10, 30.00),
  (1, 'Caste Certificate',         'जात प्रमाणपत्र',       'Official caste/community certification',                    'certificate', '["Aadhaar Card", "School Leaving Certificate", "Birth Proof"]', 15, 0.00),
  (1, 'Birth Certificate',         'जन्म प्रमाणपत्र',      'Official record of birth registered with Panchayat',        'certificate', '["Hospital Record / Birth Slip", "Aadhaar Card of Parents"]',  5,  20.00),
  (1, 'Death Certificate',         'मृत्यू प्रमाणपत्र',    'Official record of death registered with Panchayat',        'certificate', '["Hospital Death Record", "Aadhaar Card of Deceased"]',         5,  20.00),
  (1, 'No Objection Certificate',  'ना-हरकत प्रमाणपत्र',  'NOC for construction, business or other civic purpose',     'certificate', '["Application Form", "Aadhaar Card", "Site Plan (if applicable)"]', 7, 100.00),
  (1, 'Property Tax Assessment',   'मालमत्ता कर मूल्यांकन','Assessment of property tax for residential/commercial property','utility',  '["Property Documents", "Aadhaar Card"]',                        10, 0.00),
  (1, 'Marriage Certificate',      'विवाह प्रमाणपत्र',     'Registration and certification of marriage',               'certificate', '["Marriage Invitation / Photo", "Aadhaar of Both Parties", "Witness IDs"]', 10, 50.00)
ON CONFLICT DO NOTHING;
