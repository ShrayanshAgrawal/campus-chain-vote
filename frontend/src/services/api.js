const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getAuthHeader() {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  async adminLogin(adminId, password) {
    const res = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, password }),
    });
    return handleResponse(res);
  },

  async voterLogin(adminId, enrollmentNo, password) {
    const res = await fetch(`${BASE_URL}/auth/voter-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, enrollmentNo, password }),
    });
    return handleResponse(res);
  },

  async registerAdmin(adminId, name, password) {
    const res = await fetch(`${BASE_URL}/auth/register-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, name, password }),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // ── Elections (voter-facing) ─────────────────────────────────────────────────
  async getElections() {
    const res = await fetch(`${BASE_URL}/elections`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getElection(id) {
    const res = await fetch(`${BASE_URL}/elections/${id}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // ── Voting ───────────────────────────────────────────────────────────────────
  async castVote(electionId, candidateId) {
    const res = await fetch(`${BASE_URL}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ electionId, candidateId }),
    });
    return handleResponse(res);
  },

  // ── Verification & Results ───────────────────────────────────────────────────
  async verifyTx(txHash) {
    const res = await fetch(`${BASE_URL}/verify/${txHash}`);
    return handleResponse(res);
  },

  async getResults(electionId) {
    const res = await fetch(`${BASE_URL}/results/${electionId}`);
    return handleResponse(res);
  },

  async getAudit(electionId) {
    const res = await fetch(`${BASE_URL}/audit/${electionId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // ── Admin Elections ──────────────────────────────────────────────────────────
  async getAdminElections() {
    const res = await fetch(`${BASE_URL}/admin/elections`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createElection(payload) {
    const res = await fetch(`${BASE_URL}/admin/elections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async addCandidate(electionId, payload) {
    const res = await fetch(`${BASE_URL}/admin/elections/${electionId}/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async uploadEligibility(electionId, formData) {
    const res = await fetch(`${BASE_URL}/admin/elections/${electionId}/eligibility`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse(res);
  },

  async openElection(electionId) {
    const res = await fetch(`${BASE_URL}/admin/elections/${electionId}/open`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async closeElection(electionId) {
    const res = await fetch(`${BASE_URL}/admin/elections/${electionId}/close`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getAuditLogs() {
    const res = await fetch(`${BASE_URL}/admin/audit-log`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // ── Student Management ───────────────────────────────────────────────────────
  async uploadStudents(formData) {
    const res = await fetch(`${BASE_URL}/admin/students/upload`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse(res);
  },

  async getStudents(queryString = '') {
    const res = await fetch(`${BASE_URL}/admin/students${queryString}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },
};
