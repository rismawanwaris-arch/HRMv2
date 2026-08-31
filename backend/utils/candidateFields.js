/**
 * Single source of truth for the candidate/employee biodata columns and the
 * defaulting rules the API applies when reading them off a request body.
 *
 * The controllers used to repeat these ~40 fields (name + defaults + positional
 * value arrays) in five places; keep new fields in sync here instead.
 */

// Most string columns: treat empty/omitted as NULL (matches the old `x || null`).
const orNull = (b, key) => b[key] || null;

const FIELD_GETTERS = {
  name: (b) => (typeof b.name === 'string' ? b.name.trim() : b.name),
  nik: (b) => orNull(b, 'nik'),
  email: (b) => orNull(b, 'email'),
  phone: (b) => orNull(b, 'phone'),
  gender: (b) => orNull(b, 'gender'),
  birth_place: (b) => orNull(b, 'birth_place'),
  birth_date: (b) => orNull(b, 'birth_date'),
  religion: (b) => orNull(b, 'religion'),
  marital_status: (b) => orNull(b, 'marital_status'),
  dependents: (b) => b.dependents || 0,
  blood_type: (b) => orNull(b, 'blood_type'),
  height: (b) => orNull(b, 'height'),
  weight: (b) => orNull(b, 'weight'),
  physical_condition: (b) => orNull(b, 'physical_condition'),
  address_ktp: (b) => orNull(b, 'address_ktp'),
  address_domicile: (b) => orNull(b, 'address_domicile'),
  emergency_contact_1: (b) => orNull(b, 'emergency_contact_1'),
  emergency_contact_2: (b) => orNull(b, 'emergency_contact_2'),
  father_name: (b) => orNull(b, 'father_name'),
  mother_name: (b) => orNull(b, 'mother_name'),
  spouse_name: (b) => orNull(b, 'spouse_name'),
  children_data: (b) => orNull(b, 'children_data'),
  education_level: (b) => orNull(b, 'education_level'),
  education_institution: (b) => orNull(b, 'education_institution'),
  education_major: (b) => orNull(b, 'education_major'),
  education_years: (b) => orNull(b, 'education_years'),
  education_grade: (b) => orNull(b, 'education_grade'),
  work_experience: (b) => orNull(b, 'work_experience'),
  npwp: (b) => orNull(b, 'npwp'),
  bank_account: (b) => orNull(b, 'bank_account'),
  bank_name: (b) => orNull(b, 'bank_name'),
  bpjs_health: (b) => orNull(b, 'bpjs_health'),
  bpjs_employment: (b) => orNull(b, 'bpjs_employment'),
  bpjs_active: (b) => b.bpjs_active || 'Tidak Aktif',
  uniform_size: (b) => orNull(b, 'uniform_size'),
  health_history: (b) => orNull(b, 'health_history'),
  allergies: (b) => orNull(b, 'allergies'),
  medications: (b) => orNull(b, 'medications'),
  color_blind_test: (b) => orNull(b, 'color_blind_test'),
  branch_id: (b) => orNull(b, 'branch_id'),
  hire_date: (b) => orNull(b, 'hire_date'),
};

// Order matters: these arrays drive both the SQL column list and the value list.
const CANDIDATE_FIELDS = [
  'name', 'nik', 'email', 'phone', 'gender', 'birth_place', 'birth_date', 'religion',
  'marital_status', 'dependents', 'blood_type', 'height', 'weight', 'physical_condition',
  'address_ktp', 'address_domicile', 'emergency_contact_1', 'emergency_contact_2',
  'father_name', 'mother_name', 'spouse_name', 'children_data',
  'education_level', 'education_institution', 'education_major', 'education_years', 'education_grade',
  'work_experience', 'npwp', 'bank_account', 'bank_name', 'bpjs_health', 'bpjs_employment',
  'bpjs_active', 'uniform_size', 'health_history', 'allergies', 'medications', 'color_blind_test',
];

const EMPLOYEE_FIELDS = [
  'name', 'nik', 'gender', 'birth_place', 'birth_date', 'religion',
  'marital_status', 'dependents', 'blood_type',
  'phone', 'email', 'address_ktp', 'address_domicile',
  'emergency_contact_1', 'emergency_contact_2',
  'father_name', 'mother_name', 'spouse_name',
  'education_level', 'education_institution', 'education_major', 'education_years', 'education_grade',
  'height', 'weight', 'physical_condition', 'color_blind_test', 'health_history', 'allergies',
  'npwp', 'bank_name', 'bank_account', 'bpjs_health', 'bpjs_employment', 'uniform_size',
  'branch_id', 'hire_date',
];

/**
 * Build the pieces of an INSERT for the given ordered field list.
 * @returns {{ columns: string, placeholders: string, values: any[] }}
 */
function buildInsert(fields, body) {
  return {
    columns: fields.join(', '),
    placeholders: fields.map(() => '?').join(', '),
    values: fields.map((f) => FIELD_GETTERS[f](body)),
  };
}

/**
 * Build the pieces of an UPDATE SET clause for the given ordered field list.
 * @returns {{ assignments: string, values: any[] }}
 */
function buildUpdate(fields, body) {
  return {
    assignments: fields.map((f) => `${f} = ?`).join(', '),
    values: fields.map((f) => FIELD_GETTERS[f](body)),
  };
}

module.exports = { FIELD_GETTERS, CANDIDATE_FIELDS, EMPLOYEE_FIELDS, buildInsert, buildUpdate };
