import API_BASE_URL from '../config';

const API_BASE = API_BASE_URL;

/**
 * Convert parameters object to URL query string.
 * @param {Record<string, any>} [params]
 * @returns {string}
 */
const buildQueryString = (params) => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
};

/**
 * Generic fetch wrapper for API calls
 * @param {string} endpoint 
 * @param {RequestInit} options 
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  console.log('fetchApi request:', url);
  
  // Set default headers if not uploading files (FormData)
  if (!(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  const response = await fetch(url, options);
  
  // Handle non-JSON responses (like file downloads)
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  return data;
}

export const api = {
  get: (endpoint, headers) => fetchApi(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers) => fetchApi(endpoint, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), headers }),
  put: (endpoint, body, headers) => fetchApi(endpoint, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body), headers }),
  delete: (endpoint, headers) => fetchApi(endpoint, { method: 'DELETE', headers }),
};

/**
 * --- AUTH API ---
 * Services for managing administrator authentication and credentials.
 */
export const authApi = {
  /**
   * Log in an administrator.
   * @param {Object} credentials - The admin login credentials.
   * @param {string} credentials.username - Admin username.
   * @param {string} credentials.password - Admin password.
   * @returns {Promise<Object>} Resolves to login success status and authorization token.
   */
  login: (credentials) => api.post('/login', credentials),

  /**
   * Change the password of the currently authenticated administrator.
   * @param {Object} data - Password change data.
   * @param {string} data.oldPassword - The current password.
   * @param {string} data.newPassword - The new password to set.
   * @returns {Promise<Object>} Resolves to change status message.
   */
  changePassword: (data) => api.post('/change-password', data),
};

/**
 * --- CANDIDATE API ---
 * Services for managing candidate records, recruitment stages, and documents.
 */
export const candidateApi = {
  /**
   * Fetch candidates list with optional search and filter parameters.
   * @param {Object} [params] - Query filter parameters.
   * @param {string} [params.search] - Search keyword (name or NIK).
   * @param {string} [params.status] - Status ('Active', 'Hired', 'Rejected').
   * @param {string|number} [params.stage] - Filter by specific stage ID.
   * @returns {Promise<Object>} Resolves to matching candidates array.
   */
  getAll: (params) => {
    const query = buildQueryString(params);
    return api.get(`/candidates?${query}`);
  },

  /**
   * Retrieve a candidate's complete profile and evaluation stage records.
   * @param {number} id - Candidate ID.
   * @returns {Promise<Object>} Resolves to candidate profile and stage evaluations details.
   */
  getById: (id) => api.get(`/candidates/${id}`),

  /**
   * Add a new candidate to the selection process.
   * @param {Object} data - Candidate biodata object matching database schema.
   * @returns {Promise<Object>} Resolves to creation status and candidate exam access code.
   */
  create: (data) => api.post('/candidates', data),

  /**
   * Update candidate profile biodata.
   * @param {number} id - Candidate ID.
   * @param {Object} data - Form fields to update.
   * @returns {Promise<Object>} Resolves to update status message.
   */
  update: (id, data) => api.put(`/candidates/${id}`, data),

  /**
   * Delete a candidate and cascade delete all their evaluation records and documents.
   * @param {number} id - Candidate ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  delete: (id) => api.delete(`/candidates/${id}`),
  
  /**
   * Retrieve documents uploaded for a candidate.
   * @param {number} id - Candidate ID.
   * @returns {Promise<Object>} Resolves to list of candidate documents.
   */
  getDocuments: (id) => api.get(`/candidates/${id}/documents`),

  /**
   * Upload a new candidate document attachment (CV, KTP, etc.).
   * @param {number} id - Candidate ID.
   * @param {FormData} formData - Multipart form containing file under 'file' and metadata 'doc_type'.
   * @returns {Promise<Object>} Resolves to uploaded document metadata.
   */
  uploadDocument: (id, formData) => api.post(`/candidates/${id}/documents`, formData),

  /**
   * Delete a candidate document.
   * @param {number} id - Candidate ID.
   * @param {number} docId - Document ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  deleteDocument: (id, docId) => api.delete(`/candidates/${id}/documents/${docId}`),

  /**
   * Generate direct download URL for candidate document.
   * @param {number} id - Candidate ID.
   * @param {number} docId - Document ID.
   * @returns {string} Download endpoint URL.
   */
  getDocumentUrl: (id, docId) => `${API_BASE}/candidates/${id}/documents/${docId}/file`,

  /**
   * Update candidate evaluation stage details.
   * @param {number} id - Candidate ID.
   * @param {number} stageNum - Recruitment stage ID (or 8 for onboarding).
   * @param {Object} data - Evaluation form values.
   * @returns {Promise<Object>} Resolves to stage update results and next stage transition status.
   */
  updateStage: (id, stageNum, data) => api.put(`/candidates/${id}/stage/${stageNum}`, data),
};

/**
 * --- EMPLOYEE API ---
 * Services for managing active employee records.
 */
export const employeeApi = {
  /**
   * Retrieve employees list with search/filter options.
   * @param {Object} [params] - Query filters (search, branch_id).
   * @returns {Promise<Object>} Resolves to employees array.
   */
  getAll: (params) => {
    const query = buildQueryString(params);
    return api.get(`/employees?${query}`);
  },

  /**
   * Directly add a pre-existing employee manually.
   * @param {Object} data - Employee profile fields.
   * @returns {Promise<Object>} Resolves to created employee record.
   */
  addManual: (data) => api.post('/employees/manual', data),

  /**
   * Update employee profile or contract info.
   * @param {number} id - Employee ID.
   * @param {Object} data - Form data.
   * @returns {Promise<Object>} Resolves to update status.
   */
  update: (id, data) => api.put(`/employees/${id}`, data),

  /**
   * Import employees from Excel file.
   * @param {FormData} formData - Form data containing the excel file.
   * @returns {Promise<Object>} Resolves to import status.
   */
  importExcel: (formData) => api.post('/employees/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

/**
 * --- DASHBOARD API ---
 * Services for monitoring general recruitment progress statistics.
 */
export const dashboardApi = {
  /**
   * Retrieve statistics counts for the recruitment dashboard.
   * @returns {Promise<Object>} Resolves to metrics: total, active, hired, rejected.
   */
  getStats: () => api.get('/dashboard/stats'),
};

/**
 * --- BRANCH API ---
 * Services for managing outlets/branches.
 */
export const branchApi = {
  /**
   * Fetch all registered branches.
   * @returns {Promise<Object>} Resolves to branches array.
   */
  getAll: () => api.get('/branches'),

  /**
   * Create a new outlet branch.
   * @param {Object} data - Branch information.
   * @returns {Promise<Object>} Resolves to created branch.
   */
  create: (data) => api.post('/branches', data),

  /**
   * Update outlet branch details.
   * @param {number} id - Branch ID.
   * @param {Object} data - Update data fields.
   * @returns {Promise<Object>} Resolves to update status.
   */
  update: (id, data) => api.put(`/branches/${id}`, data),

  /**
   * Delete an outlet branch.
   * @param {number} id - Branch ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  delete: (id) => api.delete(`/branches/${id}`),
};

/**
 * --- ADMIN TEST QUESTIONS API ---
 * Services for managing the written cognitive/personality exam questions pool.
 */
export const adminTestApi = {
  /**
   * Retrieve all test questions.
   * @returns {Promise<Object>} Resolves to list of exam questions.
   */
  getQuestions: () => api.get('/admin/questions'),

  /**
   * Add a new exam question.
   * @param {Object} data - Question content, options, weights.
   * @returns {Promise<Object>} Resolves to added question.
   */
  addQuestion: (data) => api.post('/admin/questions', data),

  /**
   * Update question attributes.
   * @param {number} id - Question ID.
   * @param {Object} data - Update data.
   * @returns {Promise<Object>} Resolves to update status.
   */
  updateQuestion: (id, data) => api.put(`/admin/questions/${id}`, data),

  /**
   * Delete an exam question.
   * @param {number} id - Question ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  deleteQuestion: (id) => api.delete(`/admin/questions/${id}`),
};

/**
 * --- ADMIN TRAINING QUESTIONS API ---
 * Services for managing post-training competency test questions.
 */
export const adminTrainingApi = {
  /**
   * Retrieve all training exam questions.
   * @returns {Promise<Object>} Resolves to training questions array.
   */
  getQuestions: () => api.get('/admin/training-questions'),

  /**
   * Add a training exam question.
   * @param {Object} data - Question fields.
   * @returns {Promise<Object>} Resolves to added question.
   */
  addQuestion: (data) => api.post('/admin/training-questions', data),

  /**
   * Update training exam question attributes.
   * @param {number} id - Question ID.
   * @param {Object} data - Form inputs.
   * @returns {Promise<Object>} Resolves to update status.
   */
  updateQuestion: (id, data) => api.put(`/admin/training-questions/${id}`, data),

  /**
   * Delete a training question.
   * @param {number} id - Question ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  deleteQuestion: (id) => api.delete(`/admin/training-questions/${id}`),
};

/**
 * --- CANDIDATE TEST PORTAL API ---
 * Services consumed directly by candidate portal during examination.
 */
export const portalTestApi = {
  /**
   * Validate a candidate's access code for the written exam.
   * @param {string} code - Candidate exam access code.
   * @returns {Promise<Object>} Resolves to candidate profile info if valid.
   */
  validateAccess: (code) => api.get(`/test/validate/${code}`),

  /**
   * Retrieve questions assigned for the candidate's exam.
   * @param {string} code - Candidate access code.
   * @returns {Promise<Object>} Resolves to test questions.
   */
  getQuestions: (code) => api.get(`/test/questions/${code}`),

  /**
   * Submit exam answers for automatic grading.
   * @param {Object} data - Candidate answers array and access code.
   * @returns {Promise<Object>} Resolves to score and submission status.
   */
  submitTest: (data) => api.post('/test/submit', data),
};

/**
 * --- CANDIDATE TRAINING TEST PORTAL API ---
 * Services consumed directly by trainees during final training evaluation.
 */
export const portalTrainingApi = {
  /**
   * Validate trainee access code.
   * @param {string} code - Access code.
   * @returns {Promise<Object>} Resolves to trainee validation status.
   */
  validateAccess: (code) => api.get(`/training-test/validate/${code}`),

  /**
   * Submit post-training evaluation exam answers.
   * @param {Object} data - Trainee answers.
   * @returns {Promise<Object>} Resolves to score and evaluation status.
   */
  submitEvaluation: (data) => api.post('/training-test/submit', data),
};

/**
 * --- RECRUITMENT STAGES CONFIGURATION API ---
 * Services to configure recruitment pipeline workflow.
 */
export const stageApi = {
  /**
   * Retrieve all stages.
   * @returns {Promise<Object>} Resolves to list of active and inactive stages.
   */
  getAll: () => api.get('/stages'),

  /**
   * Create a new recruitment stage.
   * @param {Object} data - Stage information.
   * @param {string} data.name - Name of stage.
   * @returns {Promise<Object>} Resolves to created stage.
   */
  create: (data) => api.post('/stages', data),

  /**
   * Update recruitment stage attributes (rename, toggle active status, etc.).
   * @param {number} id - Stage ID.
   * @param {Object} data - Updated stage properties.
   * @returns {Promise<Object>} Resolves to update status.
   */
  update: (id, data) => api.put(`/stages/${id}`, data),

  /**
   * Delete a custom recruitment stage.
   * @param {number} id - Stage ID.
   * @returns {Promise<Object>} Resolves to deletion status.
   */
  delete: (id) => api.delete(`/stages/${id}`),

  /**
   * Save the new sorted order of recruitment pipeline stages.
   * @param {Array<number>} stageIds - Array of stage IDs in desired order.
   * @returns {Promise<Object>} Resolves to status.
   */
  reorder: (stageIds) => api.post('/stages/reorder', { stageIds }),
};
