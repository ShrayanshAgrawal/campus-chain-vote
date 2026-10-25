import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { ResultsChart } from '../components/ResultsChart';
import { Badge } from '../components/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { LoadingScreen } from '../components/Spinner';
import {
  BarChart3,
  Trophy,
  Users,
  Vote,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export function Results() {
  const { id } = useParams();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function fetchResults(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getResults(id);
      setResults(data);
    } catch (err) {
      setError(err.message || 'Could not fetch election results');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchResults();

    // Auto-refresh interval if election is OPEN
    const interval = setInterval(() => {
      if (results?.status === 'OPEN' || results?.status === 'ACTIVE') {
        fetchResults(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, results?.status]);

  if (loading) {
    return <LoadingScreen message="Querying live blockchain tallies..." />;
  }

  if (!results) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800">Results Unavailable</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">{error || 'Election not found'}</p>
        <Link to="/elections" className="text-xs font-semibold text-brand-600 hover:underline">
          Back to Elections
        </Link>
      </div>
    );
  }

  const isClosed = results.status === 'CLOSED';
  const isOpen = results.status === 'OPEN' || results.status === 'ACTIVE';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div>
          <Link
            to="/elections"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Elections
          </Link>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {results.name}
            </h1>
            <Badge variant={isOpen ? 'open' : isClosed ? 'closed' : 'upcoming'}>
              {results.status}
            </Badge>
          </div>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={() => fetchResults(true)}
            disabled={refreshing}
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-subtle hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Tallies
          </button>

          <Link
            to={`/audit`}
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Audit Blockchain Logs
          </Link>
        </div>
      </div>

      {/* Winner Banner when Closed */}
      {isClosed && results.winner && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center space-x-4 text-center sm:text-left mb-4 sm:mb-0">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
              <Trophy className="w-9 h-9 text-amber-300" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-emerald-100">
                Official Election Winner
              </div>
              <h2 className="text-2xl font-extrabold mt-0.5">{results.winner.name}</h2>
              <p className="text-xs text-emerald-100 mt-1">
                {results.winner.branch} • Year {results.winner.year}
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20">
            <div className="text-3xl font-black">{results.winner.voteCount}</div>
            <div className="text-xs text-emerald-100 font-medium">Verified On-Chain Votes ({results.winner.percentage}%)</div>
          </div>
        </div>
      )}

      {/* Turnout Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
            <Vote className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Ballots Cast</div>
            <div className="text-2xl font-black text-slate-900">{results.totalVotes}</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Eligible Voters</div>
            <div className="text-2xl font-black text-slate-900">{results.totalEligible}</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Voter Turnout</div>
            <div className="text-2xl font-black text-emerald-600">{results.turnoutPercentage}%</div>
          </div>
        </Card>
      </div>

      {/* Results Chart and Table */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recharts Visual Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Vote Distribution</h3>
            <span className="text-xs text-slate-400">Direct Smart Contract Tallies</span>
          </div>
          <ResultsChart
            candidates={results.candidates}
            isClosed={isClosed}
            winnerCandidateId={results.winner?.chainCandidateId}
          />
        </div>

        {/* Candidate Breakdown List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Candidate Standings</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ranked by on-chain votes</p>
            </div>

            <div className="mt-4 space-y-4">
              {[...results.candidates]
                .sort((a, b) => b.voteCount - a.voteCount)
                .map((cand, idx) => {
                  const isTop = idx === 0 && cand.voteCount > 0;

                  return (
                    <div key={cand.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center">
                          {isTop && isClosed && (
                            <Trophy className="w-3.5 h-3.5 mr-1 text-amber-500 inline" />
                          )}
                          {cand.name}
                        </span>
                        <span className="font-mono font-semibold text-slate-900">
                          {cand.voteCount} votes ({cand.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isTop && isClosed ? 'bg-emerald-500' : 'bg-brand-600'
                          }`}
                          style={{ width: `${cand.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Last polled from contract:</span>
            <span className="font-mono text-slate-700">Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
