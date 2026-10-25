import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Spinner, LoadingScreen } from '../components/Spinner';
import {
  LayoutDashboard,
  Plus,
  Play,
  Square,
  Users,
  Vote,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Upload,
  Search,
} from 'lucide-react';

export function AdminDashboard() {
  const [elections, setElections] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Election Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('ALL');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  // Confirm Open/Close Modals
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null, // 'open' | 'close'
    election: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Students Management
  const [students, setStudents] = useState([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [uploadingStudents, setUploadingStudents] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isStudentUploadOpen, setIsStudentUploadOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadStudents(1, '');
  }, []);

  async function loadStudents(page = 1, search = '') {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.set('search', search);
      const res = await api.getStudents(`?${params.toString()}`);
      setStudents(res.students || []);
      setStudentsTotal(res.pagination?.total || 0);
      setStudentPage(page);
    } catch (err) {
      console.warn('Failed to load students:', err.message);
    } finally {
      setStudentsLoading(false);
    }
  }

  async function handleStudentSearch(e) {
    e.preventDefault();
    loadStudents(1, studentSearch);
  }

  async function handleStudentCsvUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('student-csv-input');
    if (!fileInput?.files?.[0]) {
      setError('Please select a CSV file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    setUploadingStudents(true);
    setError('');
    setUploadSummary(null);
    try {
      const res = await api.uploadStudents(formData);
      setUploadSummary(res.summary);
      setIsStudentUploadOpen(false);
      loadStudents(1, studentSearch);
    } catch (err) {
      setError(err.message || 'Failed to upload students CSV');
    } finally {
      setUploadingStudents(false);
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    setError('');
    try {
      const [elecRes, logsRes] = await Promise.all([
        api.getAdminElections(),
        api.getAuditLogs(),
      ]);
      setElections(elecRes.elections || []);
      setAuditLogs(logsRes.logs || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateElection(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.createElection({
        name: name.trim(),
        scope,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setIsCreateOpen(false);
      setName('');
      setSuccessMsg('Election deployed to smart contract and database successfully!');
      loadDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to create election');
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmAction() {
    const { action, election } = confirmModal;
    if (!election) return;

    setActionLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (action === 'open') {
        await api.openElection(election.id);
        setSuccessMsg(`Election "${election.name}" is now OPEN for voting.`);
      } else if (action === 'close') {
        await api.closeElection(election.id);
        setSuccessMsg(`Election "${election.name}" is now permanently CLOSED.`);
      }
      setConfirmModal({ isOpen: false, action: null, election: null });
      loadDashboardData();
    } catch (err) {
      setError(err.message || `Failed to ${action} election`);
      setConfirmModal({ isOpen: false, action: null, election: null });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading administrative portal..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-brand-600 mb-1">
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Administrative Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Election Management Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Deploy smart-contract elections, manage candidates, upload voter eligibility lists, and view audit trails.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="mt-4 sm:mt-0 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Election
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start space-x-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Elections Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Configured Elections ({elections.length})</h2>
          <span className="text-xs text-slate-400">Hybrid Smart Contract & Database Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-6 py-3.5">Election Details</th>
                <th className="px-6 py-3.5">Scope</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Candidates</th>
                <th className="px-6 py-3.5">Eligible / Voted</th>
                <th className="px-6 py-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {elections.map((el) => {
                const isOpen = el.status === 'ACTIVE' || el.status === 'OPEN';
                const isClosed = el.status === 'CLOSED';
                const isCreated = el.status === 'CREATED' || el.status === 'UPCOMING';

                return (
                  <tr key={el.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/elections/${el.id}`}
                        className="font-bold text-slate-900 hover:text-brand-600 flex items-center group"
                      >
                        {el.name}
                        <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-0 group-hover:opacity-100 text-brand-600 transition" />
                      </Link>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Chain Election ID: #{el.chainElectionId || 'Pending'}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant="default">{el.scope}</Badge>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={isOpen ? 'open' : isClosed ? 'closed' : 'upcoming'}>
                        {el.status}
                      </Badge>
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-700">
                      {el.candidateCount} candidates
                    </td>

                    <td className="px-6 py-4 font-mono text-slate-700">
                      {el.votesCastCount || 0} / {el.eligibleVotersCount || 0}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to={`/admin/elections/${el.id}`}
                        className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                      >
                        Manage
                      </Link>

                      {isCreated && (
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, action: 'open', election: el })}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Open
                        </button>
                      )}

                      {isOpen && (
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, action: 'close', election: el })}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
                        >
                          <Square className="w-3 h-3 mr-1" />
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Summary Banner */}
      {uploadSummary && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm">
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">Students CSV uploaded successfully</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-xs">
            <span className="bg-emerald-100 px-2 py-0.5 rounded">✅ Created: {uploadSummary.created}</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">🔄 Updated: {uploadSummary.updated}</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">⏭ Skipped: {uploadSummary.skipped}</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">📋 Total Rows: {uploadSummary.totalRows}</span>
          </div>
          {uploadSummary.errors?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-rose-700 font-semibold text-xs">
                {uploadSummary.errors.length} row error(s) — click to expand
              </summary>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-rose-700 text-xs">
                {uploadSummary.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Student Registry Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-bold text-slate-900">
              Student Registry
              <span className="ml-2 text-xs font-normal text-slate-400">({studentsTotal} total)</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={handleStudentSearch} className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name / enrollment"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 w-56"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Search
              </button>
            </form>
            <button
              onClick={() => { setIsStudentUploadOpen(true); setUploadSummary(null); }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload CSV
            </button>
          </div>
        </div>

        {studentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No students registered yet</p>
            <p className="text-xs mt-1">Upload a CSV with name, enrollment_no, and password columns</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Enrollment No.</th>
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-800 font-semibold">{s.enrollmentNo}</td>
                    <td className="px-6 py-3.5 text-slate-700">{s.name}</td>
                    <td className="px-6 py-3.5">
                      <Badge variant={s.role === 'ADMIN' ? 'open' : 'default'}>{s.role}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {studentsTotal > 50 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-600">
                <span>Page {studentPage} · Showing {students.length} of {studentsTotal}</span>
                <div className="flex gap-2">
                  <button
                    disabled={studentPage <= 1}
                    onClick={() => loadStudents(studentPage - 1, studentSearch)}
                    className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={studentPage * 50 >= studentsTotal}
                    onClick={() => loadStudents(studentPage + 1, studentSearch)}
                    className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-bold text-slate-900">Recent Audit Logs</h2>
          </div>
          <span className="text-xs text-slate-400">Immutable Actor & System Events</span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Actor ID</th>
                <th className="px-6 py-3">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-mono">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600 truncate max-w-xs">
                    {log.actorId || 'SYSTEM'}
                  </td>
                  <td className="px-6 py-3 text-slate-600 truncate max-w-sm">
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Election Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Deploy New Election"
      >
        <form onSubmit={handleCreateElection} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Election Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sports Secretary 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Voter Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">ALL (Campus-Wide)</option>
              <option value="CSE">CSE (Computer Science & Engineering only)</option>
              <option value="ECE">ECE (Electronics only)</option>
              <option value="IT">IT (Information Technology only)</option>
              <option value="ME">ME (Mechanical Engineering only)</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {creating ? <Spinner size="sm" className="mr-2 border-white" /> : null}
              Deploy to Chain
            </button>
          </div>
        </form>
      </Modal>

      {/* Student CSV Upload Modal */}
      <Modal
        isOpen={isStudentUploadOpen}
        onClose={() => setIsStudentUploadOpen(false)}
        title="Upload Student Registry CSV"
      >
        <form onSubmit={handleStudentCsvUpload} className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
            <p className="font-semibold mb-1">Required CSV format:</p>
            <code className="block bg-white border border-blue-100 rounded px-2 py-1.5 font-mono text-xs leading-relaxed">
              name,enrollment_no,password<br />
              Rahul Sharma,23100BTCS14399,123456<br />
              Priya Singh,24100BTEC00605,mypass99
            </code>
            <p className="mt-2 text-xs text-blue-700">
              Students login using their <strong>enrollment number</strong> and the <strong>password</strong> you set here.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select CSV File
            </label>
            <input
              id="student-csv-input"
              type="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 border border-slate-300 rounded-xl cursor-pointer"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsStudentUploadOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadingStudents}
              className="inline-flex items-center px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {uploadingStudents ? <Spinner size="sm" className="mr-2 border-white" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              Upload & Import
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal for Open / Close */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, election: null })}
        title={confirmModal.action === 'open' ? 'Open Election for Voting' : 'Permanently Close Election'}
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600">
            {confirmModal.action === 'open' ? (
              <>
                Are you sure you want to open <strong>{confirmModal.election?.name}</strong>?
                Once opened, candidates can <strong>never</strong> be added or edited on-chain.
              </>
            ) : (
              <>
                Are you sure you want to permanently close <strong>{confirmModal.election?.name}</strong>?
                Closed elections <strong>cannot be reopened</strong> or voted in ever again.
              </>
            )}
          </p>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setConfirmModal({ isOpen: false, action: null, election: null })}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleConfirmAction}
              className={`inline-flex items-center px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition disabled:opacity-50 ${
                confirmModal.action === 'open'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {actionLoading ? <Spinner size="sm" className="mr-2 border-white" /> : null}
              Confirm & Execute On-Chain
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
