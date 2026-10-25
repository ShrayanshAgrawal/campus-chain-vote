import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { Spinner, LoadingScreen } from '../components/Spinner';
import {
  Vote,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Lock,
} from 'lucide-react';

export function Ballot() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [election, setElection] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadElection() {
      setLoading(true);
      setError('');
      try {
        const res = await api.getElection(id);
        setElection(res.election);
        if (res.election.hasVoted) {
          navigate(`/results/${id}`, { replace: true });
        }
      } catch (err) {
        setError(err.message || 'Could not load election ballot');
      } finally {
        setLoading(false);
      }
    }
    loadElection();
  }, [id, navigate]);

  async function handleConfirmVote() {
    if (!selectedCandidateId) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await api.castVote(election.id, selectedCandidateId);
      const selectedCandidate = election.candidates.find(
        (c) => c.chainCandidateId === selectedCandidateId || c.id === selectedCandidateId
      );

      navigate('/receipt', {
        state: {
          receipt: res.receipt,
          electionName: election.name,
          candidateName: selectedCandidate ? selectedCandidate.name : 'Chosen Candidate',
        },
      });
    } catch (err) {
      setError(err.message || 'Vote submission failed');
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen message="Preparing official ballot..." />;
  }

  if (!election) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Ballot Unavailable</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">{error || 'Election not found'}</p>
        <Link
          to="/elections"
          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Elections
        </Link>
      </div>
    );
  }

  const selectedCandidate = election.candidates.find(
    (c) => c.chainCandidateId === selectedCandidateId || c.id === selectedCandidateId
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation Breadcrumb */}
      <Link
        to="/elections"
        className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Elections
      </Link>

      {/* Ballot Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <Badge variant="open">OFFICIAL BALLOT</Badge>
              <Badge variant="default">Scope: {election.scope}</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {election.name}
            </h1>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 py-2 px-3 rounded-xl border border-slate-200">
            <Lock className="w-4 h-4 text-brand-600" />
            <span>Anonymous On-Chain Ballot</span>
          </div>
        </div>

        <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          Please review each candidate's profile and manifesto carefully. You may select exactly one candidate.
          Once submitted, your vote is cryptographically blinded and irreversibly recorded on the smart contract.
        </p>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Candidates Selection Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Official Candidates ({election.candidates.length})
          </h2>
          <span className="text-xs text-slate-400">Click a card to select</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {election.candidates.map((cand) => {
            const isSelected = selectedCandidateId === cand.chainCandidateId;

            return (
              <div
                key={cand.id}
                onClick={() => setSelectedCandidateId(cand.chainCandidateId)}
                className={`cursor-pointer rounded-2xl p-6 border-2 transition duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/50 shadow-card ring-2 ring-brand-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-subtle'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-brand-600 bg-brand-100/50 px-2 py-0.5 rounded-md">
                        #{cand.chainCandidateId}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-2">{cand.name}</h3>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cand.branch} • Year {cand.year}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Manifesto & Vision:
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                      "{cand.manifesto}"
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 text-right">
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-brand-700' : 'text-slate-400'
                    }`}
                  >
                    {isSelected ? '✓ Selected' : 'Click to select'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Submit Bottom Bar */}
      <div className="mt-10 sticky bottom-6 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block text-xs text-slate-500">
            Selected Choice:
          </div>
          <div className="font-bold text-slate-900 text-sm">
            {selectedCandidate ? selectedCandidate.name : 'No candidate selected'}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedCandidateId || submitting}
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-6 py-3 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold text-sm shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Vote className="w-4 h-4 mr-2" />
          Review & Submit Vote
        </button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title="Confirm Irreversible Ballot Submission"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
            <p className="font-semibold mb-1">⚠️ You can vote only once and cannot change it.</p>
            <p className="text-amber-800">
              Your vote will be signed and broadcast to the Ethereum smart contract using a cryptographic nullifier.
              No names or enrollment IDs will ever be stored on-chain.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Target Election:</span>
              <span className="font-semibold text-slate-900">{election.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chosen Candidate:</span>
              <span className="font-bold text-brand-600">
                {selectedCandidate?.name} (#{selectedCandidate?.chainCandidateId})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Privacy Guarantee:</span>
              <span className="font-mono text-emerald-600 font-semibold">Deterministic Zero-Knowledge Nullifier</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmVote}
              className="inline-flex items-center px-6 py-2.5 rounded-xl text-white bg-brand-600 hover:bg-brand-700 text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" className="mr-2 border-white" />
                  Broadcasting to Blockchain...
                </>
              ) : (
                'Yes, Submit My Vote'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
