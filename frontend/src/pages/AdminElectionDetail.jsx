import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Spinner, LoadingScreen } from '../components/Spinner';
import {
  ArrowLeft,
  Plus,
  Upload,
  Play,
  Square,
  Users,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

export function AdminElectionDetail() {
  const { id } = useParams();
  const [election, setElection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add candidate modal state
  const [isAddCandOpen, setIsAddCandOpen] = useState(false);
  const [candName, setCandName] = useState('');
  const [candEnrollment, setCandEnrollment] = useState('');
  const [candBranch, setCandBranch] = useState('CSE');
  const [candYear, setCandYear] = useState(2);
  const [candManifesto, setCandManifesto] = useState('');
  const [addingCand, setAddingCand] = useState(false);

  // Upload CSV modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);

  useEffect(() => {
    loadElectionDetails();
  }, [id]);

  async function loadElectionDetails() {
    setLoading(true);
    try {
      const res = await api.getElection(id);
      setElection(res.election);
    } catch (err) {
      setError(err.message || 'Failed to load election details');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCandidate(e) {
    e.preventDefault();
    setAddingCand(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.addCandidate(election.id, {
        name: candName.trim(),
        enrollmentNo: candEnrollment.trim().toUpperCase(),
        branch: candBranch,
        year: Number(candYear),
        manifesto: candManifesto.trim(),
      });
      setIsAddCandOpen(false);
      setCandName('');
      setCandEnrollment('');
      setCandManifesto('');
      setSuccessMsg('Candidate added to smart contract and database successfully!');
      loadElectionDetails();
    } catch (err) {
      setError(err.message || 'Failed to add candidate');
    } finally {
      setAddingCand(false);
    }
  }

  async function handleUploadCsv(e) {
    e.preventDefault();
    if (!csvFile) return;

    setUploading(true);
    setError('');
    setUploadSummary(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.uploadEligibility(election.id, formData);
      setUploadSummary(res.summary);
      setSuccessMsg(`Voter import complete! ${res.summary.addedCount} voters eligible. ${res.summary.studentsCreated || 0} new students registered.`);
      setCsvFile(null);
      loadElectionDetails();
    } catch (err) {
      setError(err.message || 'CSV upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleOpen() {
    if (!confirm('Open election for active voting? Once opened, candidates can never be changed.')) return;
    try {
      await api.openElection(election.id);
      setSuccessMsg('Election opened successfully on-chain!');
      loadElectionDetails();
    } catch (err) {
      setError(err.message || 'Failed to open election');
    }
  }

  async function handleClose() {
    if (!confirm('Permanently close this election? It cannot be reopened.')) return;
    try {
      await api.closeElection(election.id);
      setSuccessMsg('Election closed successfully on-chain!');
      loadElectionDetails();
    } catch (err) {
      setError(err.message || 'Failed to close election');
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading election management console..." />;
  }

  if (!election) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800">Election Not Found</h2>
        <Link to="/admin" className="text-xs font-semibold text-brand-600 hover:underline">
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  const isCreated = election.status === 'CREATED' || election.status === 'UPCOMING';
  const isOpen = election.status === 'ACTIVE' || election.status === 'OPEN';
  const isClosed = election.status === 'CLOSED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-2 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {election.name}
              </h1>
              <Badge variant={isOpen ? 'open' : isClosed ? 'closed' : 'upcoming'}>
                {election.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              Chain ID: #{election.chainElectionId} • Scope: {election.scope}
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
            {isCreated && (
              <>
                <button
                  onClick={() => setIsAddCandOpen(true)}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Candidate
                </button>

                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Upload Voter CSV
                </button>

                <button
                  onClick={handleOpen}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Open Election
                </button>
              </>
            )}

            {isOpen && (
              <button
                onClick={handleClose}
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition"
              >
                <Square className="w-3.5 h-3.5 mr-1" />
                Close Election
              </button>
            )}

            <Link
              to={`/results/${election.id}`}
              className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              Public Results
            </Link>
          </div>
        </div>
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

      {/* Candidates Management List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Candidates ({election.candidates.length})</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCreated ? 'Candidates are locked permanently once election opens.' : 'Candidate list is locked.'}
            </p>
          </div>
          {isCreated && (
            <button
              onClick={() => setIsAddCandOpen(true)}
              className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Another Candidate
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {election.candidates.map((cand) => (
            <div
              key={cand.id}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                  #{cand.chainCandidateId}
                </span>
                <h3 className="font-bold text-slate-900 mt-2">{cand.name}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {cand.branch} • Year {cand.year} • {cand.enrollmentNo}
                  </span>
                </div>
                <p className="text-xs text-slate-600 italic mt-3 pt-3 border-t border-slate-200/60 leading-relaxed">
                  "{cand.manifesto}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isAddCandOpen}
        onClose={() => setIsAddCandOpen(false)}
        title="Add Candidate to Smart Contract"
      >
        <form onSubmit={handleAddCandidate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Enrollment Number
            </label>
            <input
              type="text"
              required
              value={candEnrollment}
              onChange={(e) => setCandEnrollment(e.target.value)}
              placeholder="e.g. 24100BTCS00339"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Branch
              </label>
              <select
                value={candBranch}
                onChange={(e) => setCandBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
              >
                <option value="CSE">CSE</option>
                <option value="CSE-DS">CSE-DS</option>
                <option value="ECE">ECE</option>
                <option value="IT">IT</option>
                <option value="EE">EE</option>
                <option value="CE">CE</option>
                <option value="ME">ME</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Year
              </label>
              <input
                type="number"
                min={1}
                max={5}
                required
                value={candYear}
                onChange={(e) => setCandYear(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Manifesto & Key Promises
            </label>
            <textarea
              required
              rows={3}
              value={candManifesto}
              onChange={(e) => setCandManifesto(e.target.value)}
              placeholder="e.g. Expand library hours, upgrade campus Wi-Fi..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsAddCandOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingCand}
              className="inline-flex items-center px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {addingCand ? <Spinner size="sm" className="mr-2 border-white" /> : null}
              Add Candidate On-Chain
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload Voter CSV Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadSummary(null);
        }}
        title="Upload Voter CSV"
      >
        <form onSubmit={handleUploadCsv} className="space-y-4">
          {/* How it works info */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 space-y-2">
            <p className="font-bold flex items-center">
              <Users className="w-4 h-4 mr-1.5" /> How Voter Registration Works:
            </p>
            <ol className="list-decimal ml-5 space-y-1 text-blue-700">
              <li>Upload a CSV with columns: <code className="font-mono bg-blue-100 px-1 rounded">name</code>, <code className="font-mono bg-blue-100 px-1 rounded">enrollment_no</code>, <code className="font-mono bg-blue-100 px-1 rounded">password</code></li>
              <li>New voters are <strong>registered automatically</strong> with their password</li>
              <li>All voters in the CSV get <strong>voting eligibility</strong> for this election</li>
              <li>Voters log in using <strong>your Admin ID + enrollment number + password</strong></li>
            </ol>
            <div className="mt-2 p-2 bg-white/80 rounded-lg border border-blue-200 font-mono text-[11px]">
              <div className="text-blue-900 font-bold mb-1">Example CSV format:</div>
              <div>name,enrollment_no,password</div>
              <div>Rahul Sharma,23100BTCSDSI14399,123456</div>
              <div>Priya Singh,24100BTCS00143,mypass99</div>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-brand-400 transition">
            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setCsvFile(e.target.files[0]);
                setUploadSummary(null);
              }}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
            {csvFile && (
              <p className="mt-2 text-xs text-brand-600 font-medium">
                Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {uploadSummary && (
            <div
              className={`p-4 rounded-xl text-xs ${
                uploadSummary.addedCount > 0
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-900'
              }`}
            >
              <div className="font-bold text-sm mb-2">Import Results:</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>📥 Total Rows: <strong>{uploadSummary.totalRows}</strong></div>
                <div>✅ Eligible Voters Added: <strong>{uploadSummary.addedCount}</strong></div>
                <div>👤 New Students Created: <strong>{uploadSummary.studentsCreated || 0}</strong></div>
                <div>🔄 Students Updated: <strong>{uploadSummary.studentsUpdated || 0}</strong></div>
                <div>⏭️ Skipped: <strong>{uploadSummary.skippedCount}</strong></div>
              </div>
              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px] text-slate-700 border-t border-slate-200 pt-2 max-h-28 overflow-y-auto font-mono">
                  {uploadSummary.errors.map((err, idx) => (
                    <div key={idx}>⚠️ {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setIsUploadOpen(false);
                setUploadSummary(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              {uploadSummary ? 'Close' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!csvFile || uploading}
              className="inline-flex items-center px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {uploading ? <Spinner size="sm" className="mr-2 border-white" /> : null}
              Import Voters
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
