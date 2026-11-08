-- Migration 014: Populate dynamic service form schemas
-- Draft field definitions for the eight Kini Gram Panchayat services.

DO $migration$
DECLARE
    expected_service_count INTEGER;
    updated_service_count  INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO expected_service_count
    FROM services
    WHERE panchayat_id = 1
      AND name IN (
          'Domicile Certificate',
          'Income Certificate',
          'Caste Certificate',
          'Birth Certificate',
          'Death Certificate',
          'No Objection Certificate',
          'Property Tax Assessment',
          'Marriage Certificate'
      );

    IF expected_service_count <> 8 THEN
        RAISE EXCEPTION
            'Expected exactly 8 target services in Panchayat %, found %',
            1,
            expected_service_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM services
        WHERE panchayat_id = 1
          AND name IN (
              'Domicile Certificate',
              'Income Certificate',
              'Caste Certificate',
              'Birth Certificate',
              'Death Certificate',
              'No Objection Certificate',
              'Property Tax Assessment',
              'Marriage Certificate'
          )
        GROUP BY name
        HAVING COUNT(*) <> 1
    ) THEN
        RAISE EXCEPTION
            'One or more target services are duplicated in Panchayat %',
            1;
    END IF;

    UPDATE services AS s
    SET form_schema = CASE s.name
        WHEN 'Domicile Certificate' THEN
            '[
                {
                    "key": "applicant_full_name",
                    "label": {"en": "Applicant full name", "mr": "अर्जदाराचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "date_of_birth",
                    "label": {"en": "Date of birth", "mr": "जन्मतारीख"},
                    "type": "date",
                    "required": true,
                    "validation": {"notFuture": true}
                },
                {
                    "key": "residential_address",
                    "label": {"en": "Residential address", "mr": "निवासी पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "village",
                    "label": {"en": "Village", "mr": "गाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 100}
                },
                {
                    "key": "years_of_residence",
                    "label": {"en": "Years of residence", "mr": "निवासाचा कालावधी (वर्षे)"},
                    "type": "number",
                    "required": true,
                    "validation": {"integer": true, "min": 0, "max": 150}
                },
                {
                    "key": "address_proof_type",
                    "label": {"en": "Address proof type", "mr": "पत्त्याच्या पुराव्याचा प्रकार"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "ration_card", "label": {"en": "Ration Card", "mr": "रेशन कार्ड"}},
                        {"value": "electricity_bill", "label": {"en": "Electricity Bill", "mr": "वीज बिल"}},
                        {"value": "property_tax_receipt", "label": {"en": "Property Tax Receipt", "mr": "मालमत्ता कर पावती"}},
                        {"value": "voter_id", "label": {"en": "Voter ID", "mr": "मतदार ओळखपत्र"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                }
            ]'::jsonb
        WHEN 'Income Certificate' THEN
            '[
                {
                    "key": "applicant_full_name",
                    "label": {"en": "Applicant full name", "mr": "अर्जदाराचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "residential_address",
                    "label": {"en": "Residential address", "mr": "निवासी पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "annual_family_income",
                    "label": {"en": "Annual family income", "mr": "वार्षिक कौटुंबिक उत्पन्न"},
                    "type": "number",
                    "required": true,
                    "validation": {"min": 0, "max": 1000000000}
                },
                {
                    "key": "income_year",
                    "label": {"en": "Income year", "mr": "उत्पन्न वर्ष"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "2025-26", "label": {"en": "2025-26", "mr": "२०२५-२६"}},
                        {"value": "2026-27", "label": {"en": "2026-27", "mr": "२०२६-२७"}}
                    ]
                },
                {
                    "key": "income_source",
                    "label": {"en": "Income source", "mr": "उत्पन्नाचा स्रोत"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "agriculture", "label": {"en": "Agriculture", "mr": "शेती"}},
                        {"value": "daily_wage", "label": {"en": "Daily wage", "mr": "रोजंदारी"}},
                        {"value": "salary", "label": {"en": "Salary", "mr": "पगार"}},
                        {"value": "business", "label": {"en": "Business", "mr": "व्यवसाय"}},
                        {"value": "pension", "label": {"en": "Pension", "mr": "निवृत्तीवेतन"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                },
                {
                    "key": "family_member_count",
                    "label": {"en": "Number of family members", "mr": "कुटुंबातील सदस्यांची संख्या"},
                    "type": "number",
                    "required": true,
                    "validation": {"integer": true, "min": 1, "max": 50}
                }
            ]'::jsonb
        WHEN 'Caste Certificate' THEN
            '[
                {
                    "key": "applicant_full_name",
                    "label": {"en": "Applicant full name", "mr": "अर्जदाराचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "father_or_guardian_name",
                    "label": {"en": "Father or guardian name", "mr": "वडिलांचे किंवा पालकांचे नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "residential_address",
                    "label": {"en": "Residential address", "mr": "निवासी पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "community_or_caste_name",
                    "label": {"en": "Community or caste name", "mr": "जात किंवा समुदायाचे नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "caste_category",
                    "label": {"en": "Caste category", "mr": "जात प्रवर्ग"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "SC", "label": {"en": "Scheduled Caste (SC)", "mr": "अनुसूचित जाती (SC)"}},
                        {"value": "ST", "label": {"en": "Scheduled Tribe (ST)", "mr": "अनुसूचित जमाती (ST)"}},
                        {"value": "OBC", "label": {"en": "Other Backward Class (OBC)", "mr": "इतर मागासवर्ग (OBC)"}},
                        {"value": "VJNT", "label": {"en": "VJNT", "mr": "विमुक्त जाती व भटक्या जमाती (VJNT)"}},
                        {"value": "SBC", "label": {"en": "Special Backward Class (SBC)", "mr": "विशेष मागासवर्ग (SBC)"}},
                        {"value": "SEBC", "label": {"en": "SEBC", "mr": "सामाजिक व शैक्षणिक मागासवर्ग (SEBC)"}},
                        {"value": "OPEN", "label": {"en": "Open", "mr": "खुला प्रवर्ग"}},
                        {"value": "OTHER", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                }
            ]'::jsonb
        WHEN 'Birth Certificate' THEN
            '[
                {
                    "key": "child_full_name",
                    "label": {"en": "Child''s full name", "mr": "बालकाचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "date_of_birth",
                    "label": {"en": "Date of birth", "mr": "जन्मतारीख"},
                    "type": "date",
                    "required": true,
                    "validation": {"notFuture": true}
                },
                {
                    "key": "place_of_birth",
                    "label": {"en": "Place of birth", "mr": "जन्मस्थळ"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 200}
                },
                {
                    "key": "father_name",
                    "label": {"en": "Father''s name", "mr": "वडिलांचे नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "mother_name",
                    "label": {"en": "Mother''s name", "mr": "आईचे नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "gender",
                    "label": {"en": "Gender", "mr": "लिंग"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "male", "label": {"en": "Male", "mr": "पुरुष"}},
                        {"value": "female", "label": {"en": "Female", "mr": "स्त्री"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}},
                        {"value": "prefer_not_to_say", "label": {"en": "Prefer not to say", "mr": "सांगू इच्छित नाही"}}
                    ]
                },
                {
                    "key": "birth_registration_number",
                    "label": {"en": "Existing birth registration number", "mr": "विद्यमान जन्म नोंदणी क्रमांक"},
                    "type": "text",
                    "required": false,
                    "validation": {"maxLength": 100, "pattern": "^[A-Za-z0-9\\-/]+$"}
                }
            ]'::jsonb
        WHEN 'Death Certificate' THEN
            '[
                {
                    "key": "deceased_full_name",
                    "label": {"en": "Deceased person''s full name", "mr": "मृत व्यक्तीचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "date_of_death",
                    "label": {"en": "Date of death", "mr": "मृत्यूची तारीख"},
                    "type": "date",
                    "required": true,
                    "validation": {"notFuture": true}
                },
                {
                    "key": "place_of_death",
                    "label": {"en": "Place of death", "mr": "मृत्यूस्थळ"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 200}
                },
                {
                    "key": "applicant_relationship",
                    "label": {"en": "Applicant''s relationship with deceased", "mr": "मृत व्यक्तीशी अर्जदाराचे नाते"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "spouse", "label": {"en": "Spouse", "mr": "पती किंवा पत्नी"}},
                        {"value": "parent", "label": {"en": "Parent", "mr": "पालक"}},
                        {"value": "child", "label": {"en": "Child", "mr": "मुलगा किंवा मुलगी"}},
                        {"value": "sibling", "label": {"en": "Sibling", "mr": "भावंड"}},
                        {"value": "legal_representative", "label": {"en": "Legal representative", "mr": "कायदेशीर प्रतिनिधी"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                },
                {
                    "key": "deceased_address",
                    "label": {"en": "Deceased person''s address", "mr": "मृत व्यक्तीचा पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "death_registration_number",
                    "label": {"en": "Existing death registration number", "mr": "विद्यमान मृत्यू नोंदणी क्रमांक"},
                    "type": "text",
                    "required": false,
                    "validation": {"maxLength": 100, "pattern": "^[A-Za-z0-9\\-/]+$"}
                }
            ]'::jsonb
        WHEN 'No Objection Certificate' THEN
            '[
                {
                    "key": "applicant_full_name",
                    "label": {"en": "Applicant full name", "mr": "अर्जदाराचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "noc_purpose",
                    "label": {"en": "Purpose of NOC", "mr": "ना-हरकत प्रमाणपत्राचा उद्देश"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "construction", "label": {"en": "Construction", "mr": "बांधकाम"}},
                        {"value": "business", "label": {"en": "Business", "mr": "व्यवसाय"}},
                        {"value": "water_connection", "label": {"en": "Water connection", "mr": "पाणी जोडणी"}},
                        {"value": "electricity_connection", "label": {"en": "Electricity connection", "mr": "वीज जोडणी"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                },
                {
                    "key": "purpose_details",
                    "label": {"en": "Purpose details", "mr": "उद्देशाचे तपशील"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 10, "maxLength": 1000}
                },
                {
                    "key": "site_address",
                    "label": {"en": "Site address", "mr": "जागेचा पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "property_plot_identifier",
                    "label": {"en": "Property or plot identifier", "mr": "मालमत्ता किंवा भूखंड क्रमांक"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 1, "maxLength": 100}
                },
                {
                    "key": "construction_business_type",
                    "label": {"en": "Construction or business type", "mr": "बांधकाम किंवा व्यवसायाचा प्रकार"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 200}
                },
                {
                    "key": "site_plan_available",
                    "label": {"en": "Site plan availability", "mr": "जागेचा आराखडा उपलब्धता"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "yes", "label": {"en": "Yes", "mr": "होय"}},
                        {"value": "no", "label": {"en": "No", "mr": "नाही"}}
                    ]
                }
            ]'::jsonb
        WHEN 'Property Tax Assessment' THEN
            '[
                {
                    "key": "property_owner_full_name",
                    "label": {"en": "Property owner''s full name", "mr": "मालमत्ता मालकाचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "property_address",
                    "label": {"en": "Property address", "mr": "मालमत्तेचा पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "property_number",
                    "label": {"en": "Property number", "mr": "मालमत्ता क्रमांक"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 1, "maxLength": 100}
                },
                {
                    "key": "property_type",
                    "label": {"en": "Property type", "mr": "मालमत्तेचा प्रकार"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "residential", "label": {"en": "Residential", "mr": "निवासी"}},
                        {"value": "commercial", "label": {"en": "Commercial", "mr": "व्यावसायिक"}},
                        {"value": "mixed_use", "label": {"en": "Mixed use", "mr": "मिश्र वापर"}},
                        {"value": "vacant_plot", "label": {"en": "Vacant plot", "mr": "रिकामा भूखंड"}},
                        {"value": "other", "label": {"en": "Other", "mr": "इतर"}}
                    ]
                },
                {
                    "key": "built_up_area_sq_m",
                    "label": {"en": "Built-up area in square metres", "mr": "बांधकाम क्षेत्रफळ चौ. मी."},
                    "type": "number",
                    "required": true,
                    "validation": {"min": 0.1, "max": 100000}
                },
                {
                    "key": "construction_year",
                    "label": {"en": "Construction year", "mr": "बांधकामाचे वर्ष"},
                    "type": "number",
                    "required": true,
                    "validation": {"integer": true, "min": 1800, "max": 2100}
                },
                {
                    "key": "occupancy_status",
                    "label": {"en": "Occupancy status", "mr": "वापराची स्थिती"},
                    "type": "select",
                    "required": true,
                    "options": [
                        {"value": "self_occupied", "label": {"en": "Self-occupied", "mr": "स्वतःचा वापर"}},
                        {"value": "rented", "label": {"en": "Rented", "mr": "भाड्याने दिलेले"}},
                        {"value": "vacant", "label": {"en": "Vacant", "mr": "रिक्त"}},
                        {"value": "under_construction", "label": {"en": "Under construction", "mr": "बांधकाम सुरू"}}
                    ]
                }
            ]'::jsonb
        WHEN 'Marriage Certificate' THEN
            '[
                {
                    "key": "first_party_full_name",
                    "label": {"en": "First party''s full name", "mr": "पहिल्या पक्षाचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "second_party_full_name",
                    "label": {"en": "Second party''s full name", "mr": "दुसऱ्या पक्षाचे पूर्ण नाव"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 150}
                },
                {
                    "key": "marriage_date",
                    "label": {"en": "Marriage date", "mr": "विवाहाची तारीख"},
                    "type": "date",
                    "required": true,
                    "validation": {"notFuture": true}
                },
                {
                    "key": "marriage_place",
                    "label": {"en": "Marriage place", "mr": "विवाहस्थळ"},
                    "type": "text",
                    "required": true,
                    "validation": {"minLength": 2, "maxLength": 200}
                },
                {
                    "key": "first_party_address",
                    "label": {"en": "First party''s address", "mr": "पहिल्या पक्षाचा पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "second_party_address",
                    "label": {"en": "Second party''s address", "mr": "दुसऱ्या पक्षाचा पत्ता"},
                    "type": "textarea",
                    "required": true,
                    "validation": {"minLength": 5, "maxLength": 500}
                },
                {
                    "key": "witness_count",
                    "label": {"en": "Number of witnesses", "mr": "साक्षीदारांची संख्या"},
                    "type": "number",
                    "required": true,
                    "validation": {"integer": true, "min": 2, "max": 3}
                }
            ]'::jsonb
    END
    WHERE s.panchayat_id = 1
      AND s.name IN (
          'Domicile Certificate',
          'Income Certificate',
          'Caste Certificate',
          'Birth Certificate',
          'Death Certificate',
          'No Objection Certificate',
          'Property Tax Assessment',
          'Marriage Certificate'
      );

    GET DIAGNOSTICS updated_service_count = ROW_COUNT;

    IF updated_service_count <> 8 THEN
        RAISE EXCEPTION
            'Expected to update exactly 8 service form schemas, updated %',
            updated_service_count;
    END IF;
END;
$migration$;
