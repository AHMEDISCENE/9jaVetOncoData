CREATE OR REPLACE VIEW shared_cases_view AS
SELECT
  c.id,
  c.case_number,
  c.clinic_id,
  c.created_by,
  -- Mask patient names to first letter followed by anonymous marker
  CASE
    WHEN c.patient_name IS NULL OR length(trim(c.patient_name)) = 0 THEN NULL
    ELSE upper(left(trim(c.patient_name), 1)) || '***'
  END AS patient_alias,
  c.species,
  c.breed,
  c.sex,
  c.age_years,
  c.age_months,
  c.tumour_type_id,
  c.tumour_type_custom,
  c.anatomical_site_id,
  c.anatomical_site_custom,
  c.laterality,
  c.stage,
  c.diagnosis_method,
  c.diagnosis_date,
  c.treatment_plan,
  c.treatment_start,
  c.outcome,
  c.last_follow_up,
  c.notes,
  c.status,
  c.extra,
  c.created_at,
  c.updated_at,
  cl.name        AS clinic_name,
  cl.state       AS clinic_state,
  cl.city        AS clinic_city
FROM cases c
LEFT JOIN clinics cl ON cl.id = c.clinic_id;

CREATE INDEX IF NOT EXISTS idx_cases_shared_diagnosis_date ON cases (diagnosis_date DESC);
CREATE INDEX IF NOT EXISTS idx_cases_shared_species ON cases (species);
CREATE INDEX IF NOT EXISTS idx_cases_shared_outcome ON cases (outcome);
