import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Spinner, LoadingScreen } from '../components/Spinner';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileSearch,
  Hash,
  Database,
  Blocks,
  FileCheck,
} from 'lucide-react';

export function Audit() {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [loadingElections, setLoadingElections] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadElections() {
      try {
        const res = await api.getElections();
        const list = res.elections || [];
        setElections(list);
        if (list.length > 0) {
          setSelectedElectionId(list[0].id);
          runAudit(list[0].id);
        }
      } catch (err) {
        setError(err.message || 'Failed to load elections');
      } finally {
        setLoadingElections(false);
      }
    }
    loadElections();
  }, []);

  async function runAudit(electionId) {
    const idToAudit = electionId || selectedElectionId;
    if (!idToAudit) return;

    setAuditing(true);
    setError('');
    try {
      const report = await api.getAudit(idToAudit);
      setAuditData(report);
    } catch (err) {
      setError(err.message || 'Audit execution failed');
      setAuditData(null);
    } finally {
      setAuditing(false);
    }
  }

  if (loadingElections) {
    return <LoadingScreen message="Initializing cryptographic audit engine..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-brand-600 mb-1">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Independent Public Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Cryptographic Blockchain Audit
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Recounts every raw <code>VoteCast</code> event log directly from the Ethereum smart contract,
            verifies nullifier uniqueness, and detects database tampering.
          </p>
        </div>

        {/* Election Selector & Recount Button */}
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedElectionId}
            onChange={(e) => {
              setSelectedElectionId(e.target.value);
              runAudit(e.target.value);
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-brand-500"
          >
            {elections.map((el) => (
              <option key={el.id} value={el.id}>
                {el.name} ({el.status})
              </option>
            ))}
          </select>

          <button
            onClick={() => runAudit()}
            disabled={auditing}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${auditing ? 'animate-spin' : ''}`} />
            {auditing ? 'Recounting...' : 'Recount from Blockchain'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Audit Big Match / Mismatch Status Banner */}
      {auditData && (
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-sm transition duration-200 ${
            auditData.match
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div
                className={`p-3 rounded-2xl flex-shrink-0 ${
                  auditData.match ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {auditData.match ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <AlertTriangle className="w-8 h-8" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-block px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                      auditData.match ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                    }`}
                  >
                    {auditData.match ? 'ALL TOTALS MATCH' : 'MISMATCH DETECTED'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Target: {auditData.electionName} (Chain #{auditData.chainElectionId})
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mt-1">
                  {auditData.match
                    ? 'Cryptographic Log Verification Passed (100% Match)'
                    : 'Discrepancy Detected Between Blockchain and Database!'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed opacity-90">
                  {auditData.match
                    ? 'Every individual VoteCast event queried directly from the smart contract matches the contract tally and the off-chain database cache. Zero duplicate nullifiers detected.'
                    : 'The database tally does NOT match the immutable blockchain event logs. Possible database tampering or unauthorized manipulation detected!'}
                </p>
              </div>
            </div>

            <div className="text-right text-xs opacity-80 flex-shrink-0 font-mono">
              Audited: {new Date(auditData.auditedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Metrics Cards */}
      {auditData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center space-x-4">
            <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
              <Blocks className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Blockchain Logs Recounted
              </div>
              <div className="text-2xl font-black text-slate-900">
                {auditData.totalEvents} Events
              </div>
            </div>
          </Card>

          <Card className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unique Nullifiers
              </div>
              <div className="text-2xl font-black text-slate-900">
                {auditData.uniqueNullifiers} Valid
              </div>
            </div>
          </Card>

          <Card className="flex items-center space-x-4">
            <div
              className={`p-3 rounded-xl ${
                auditData.duplicateNullifiers === 0
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Duplicate Nullifiers
              </div>
              <div
                className={`text-2xl font-black ${
                  auditData.duplicateNullifiers === 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {auditData.duplicateNullifiers} Violations
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Comparison Table */}
      {auditData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Multi-Source Tallies Comparison Table
            </h3>
            <span className="text-xs text-slate-400">
              Comparing Event Logs vs Smart Contract vs Database
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5">
                    <div className="flex items-center space-x-1">
                      <Blocks className="w-3.5 h-3.5 text-brand-600" />
                      <span>Blockchain Logs</span>
                    </div>
                  </th>
                  <th className="px-6 py-3.5">
                    <div className="flex items-center space-x-1">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Smart Contract (getResults)</span>
                    </div>
                  </th>
                  <th className="px-6 py-3.5">
                    <div className="flex items-center space-x-1">
                      <Database className="w-3.5 h-3.5 text-slate-500" />
                      <span>Database (resultCache)</span>
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-right">Integrity Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {auditData.comparisonTable.map((row) => (
                  <tr key={row.candidateId} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      #{row.candidateId} {row.name}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-700">
                      {row.eventVotes} votes
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-700">
                      {row.chainVotes} votes
                    </td>
                    <td className="px-6 py-4 font-mono font-medium">
                      <span
                        className={
                          row.match
                            ? 'text-slate-700'
                            : 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded'
                        }
                      >
                        {row.dbVotes} votes
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.match ? (
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                          VERIFIED MATCH
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-300 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                          TAMPER DETECTED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
