import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Search,
  ExternalLink,
  ArrowRight,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { Spinner } from '../components/Spinner';

export function Receipt() {
  const location = useLocation();
  const navigate = useNavigate();
  const receiptState = location.state?.receipt;
  const electionName = location.state?.electionName || 'Campus Election';

  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedNullifier, setCopiedNullifier] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  if (!receiptState) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">No Active Receipt Found</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Receipts are generated immediately after casting a confirmed blockchain vote.
        </p>
        <Link
          to="/elections"
          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700"
        >
          View Elections
        </Link>
      </div>
    );
  }

  const { txHash, blockNumber, nullifier, electionId } = receiptState;

  function copyToClipboard(text, setFn) {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyError('');
    setVerificationResult(null);

    try {
      const res = await api.verifyTx(txHash);
      setVerificationResult(res);
    } catch (err) {
      setVerifyError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Success Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-subtle">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Vote Confirmed On-Chain!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your ballot for <strong className="text-slate-800">{electionName}</strong> has been mined and permanently etched into the blockchain.
        </p>
      </div>

      {/* Main Cryptographic Receipt Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Cryptographic Vote Receipt</h2>
          </div>
          <Badge variant="success">Confirmed & Immutable</Badge>
        </div>

        {/* Transaction Hash */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Blockchain Transaction Hash
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 font-mono text-xs sm:text-sm bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 break-all select-all">
              {txHash}
            </div>
            <button
              onClick={() => copyToClipboard(txHash, setCopiedTx)}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center justify-center"
              title="Copy Transaction Hash"
            >
              {copiedTx ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Block Number & Nullifier Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Block Number
            </label>
            <div className="font-mono text-sm bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800">
              #{blockNumber}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Cryptographic Nullifier (Proof of Vote)
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 font-mono text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 truncate">
                {nullifier}
              </div>
              <button
                onClick={() => copyToClipboard(nullifier, setCopiedNullifier)}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center justify-center"
                title="Copy Nullifier"
              >
                {copiedNullifier ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Explanation Note */}
        <div className="bg-brand-50/50 rounded-xl p-4 border border-brand-100 text-xs text-brand-900 leading-relaxed">
          <p className="font-semibold mb-1 flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-brand-600" />
            How this receipt guarantees your privacy:
          </p>
          <p>
            Your nullifier was computed via <code>keccak256(enrollmentNo, electionId, secret)</code>.
            It acts as an anonymous voucher preventing double-voting while containing <strong>zero personally identifiable data</strong> on-chain.
          </p>
        </div>

        {/* Verification Action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            disabled={verifying}
            onClick={handleVerify}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition disabled:opacity-50"
          >
            {verifying ? (
              <>
                <Spinner size="sm" className="mr-2 border-white" />
                Querying Blockchain Node...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-1.5" />
                Verify Receipt on Chain
              </>
            )}
          </button>

          <Link
            to={electionId ? `/results/${electionId}` : '/elections'}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
          >
            View Live Results
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </div>

        {/* Verified Event Details */}
        {verifyError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {verifyError}
          </div>
        )}

        {verificationResult && (
          <div className="mt-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 animate-fadeIn space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-emerald-900 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                Smart Contract Log Verification Passed
              </span>
              <Badge variant="success">Decoded Event: VoteCast</Badge>
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2 pt-2 border-t border-emerald-200/60 font-medium">
              <div>
                <span className="text-emerald-700">Election ID:</span>{' '}
                <span className="font-mono text-emerald-950">#{verificationResult.electionId}</span>
              </div>
              <div>
                <span className="text-emerald-700">Block Timestamp:</span>{' '}
                <span className="text-emerald-950">{verificationResult.timestamp}</span>
              </div>
              <div>
                <span className="text-emerald-700">Candidate Choice:</span>{' '}
                <span className="font-bold text-emerald-950">{verificationResult.candidateName}</span>
              </div>
              <div>
                <span className="text-emerald-700">Block Number:</span>{' '}
                <span className="font-mono text-emerald-950">#{verificationResult.blockNumber}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
