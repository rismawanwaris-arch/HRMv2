const { FIELD_GETTERS: BASE } = require('./candidateFields');
const { encrypt, blindIndex } = require('./fieldCrypto');

const orNull = (b, key) => b[key] || null;

const STAFF_GETTERS = {
  ...BASE,
  // work-specific fields not present in candidateFields
  position:      (b) => orNull(b, 'position'),
  employee_type: (b) => b.employee_type || 'Frontliner',
  contract_type: (b) => b.contract_type || 'PKWT',
  contract_start:(b) => orNull(b, 'contract_start'),
  contract_end:  (b) => orNull(b, 'contract_end'),
  probation_end: (b) => orNull(b, 'probation_end'),
  ptkp_status:   (b) => b.ptkp_status || 'TK/0',
  enable_bpjs:   (b) => (b.enable_bpjs === 1 || b.enable_bpjs === true || b.enable_bpjs === '1') ? 1 : 0,
  enable_pph21:  (b) => (b.enable_pph21 === 1 || b.enable_pph21 === true || b.enable_pph21 === '1') ? 1 : 0,
  salary:        (b) => parseFloat(b.salary) || 0,
  allowance:     (b) => parseFloat(b.allowance) || 0,
  candidate_id:  (b) => b.candidate_id ? parseInt(b.candidate_id, 10) : null,
  // branch_id and hire_date already in BASE (from candidateFields)
};

const STAFF_BIODATA_FIELDS = [
  'name', 'nik', 'nik_bidx', 'gender', 'birth_place', 'birth_date', 'religion',
  'marital_status', 'dependents', 'blood_type', 'phone', 'email',
  'address_ktp', 'address_domicile', 'emergency_contact_1', 'emergency_contact_2',
  'father_name', 'mother_name', 'spouse_name', 'children_data',
  'education_level', 'education_institution', 'education_major', 'education_years', 'education_grade',
  'work_experience', 'npwp', 'bank_name', 'bank_account', 'bpjs_health', 'bpjs_employment',
  'bpjs_active', 'uniform_size', 'height', 'weight', 'physical_condition',
  'health_history', 'allergies', 'medications', 'color_blind_test',
];

const STAFF_WORK_FIELDS = [
  'position', 'employee_type', 'contract_type', 'contract_start', 'contract_end', 'probation_end',
  'ptkp_status', 'enable_bpjs', 'enable_pph21', 'branch_id', 'hire_date', 'salary', 'allowance',
];

const STAFF_ALL_FIELDS = [...STAFF_BIODATA_FIELDS, ...STAFF_WORK_FIELDS];

function buildInsert(fields, body) {
  return {
    columns: fields.join(', '),
    placeholders: fields.map(() => '?').join(', '),
    values: fields.map((f) => STAFF_GETTERS[f](body)),
  };
}

function buildUpdate(fields, body) {
  return {
    assignments: fields.map((f) => `${f} = ?`).join(', '),
    values: fields.map((f) => STAFF_GETTERS[f](body)),
  };
}

module.exports = { STAFF_GETTERS, STAFF_BIODATA_FIELDS, STAFF_WORK_FIELDS, STAFF_ALL_FIELDS, buildInsert, buildUpdate };
