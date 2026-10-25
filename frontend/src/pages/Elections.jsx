import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/Card';
import { Badge } from '../components/Badge';
import { LoadingScreen } from '../components/Spinner';
import { Vote, CheckCircle2, Clock, Calendar, Users, BarChart3, ShieldCheck, ArrowRight } from 'lucide-react';

export function Elections() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchElections();
  }, []);

  async function fetchElections() {
    setLoading(true);
    try {
      const res = await api.getElections();
      setElections(res.elections || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch elections');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading eligible campus elections..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Campus Elections
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select an active election to cast your anonymous on-chain ballot, or view live audited results.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <Link
            to="/audit"
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-subtle hover:bg-slate-50 transition"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5 text-brand-600" />
            Audit Blockchain Logs
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Elections Grid */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {elections.map((election) => {
          const isOpen = election.status === 'ACTIVE' || election.status === 'OPEN';
          const isClosed = election.status === 'CLOSED';
          const isUpcoming = election.status === 'UPCOMING' || election.status === 'CREATED';

          return (
            <Card key={election.id} hover className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant={isOpen ? 'open' : isClosed ? 'closed' : 'upcoming'}>
                      {election.status}
                    </Badge>
                    <span className="text-xs font-medium text-slate-400">
                      Scope: {election.scope}
                    </span>
                  </div>

                  {election.hasVoted && (
                    <Badge variant="primary" className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-brand-600" />
                      Voted
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-lg font-bold leading-snug">
                  {election.name}
                </CardTitle>

                <div className="mt-4 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-slate-400" />
                    <span>{election.candidateCount} Official Candidates</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    <span>
                      {isClosed
                        ? `Ended ${new Date(election.endTime).toLocaleDateString()}`
                        : `Closes ${new Date(election.endTime).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>

              <CardFooter className="mt-6">
                {isOpen && !election.hasVoted ? (
                  <Link
                    to={`/ballot/${election.id}`}
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-semibold text-xs shadow-sm transition"
                  >
                    <Vote className="w-4 h-4 mr-1.5" />
                    Cast Ballot
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                ) : (
                  <Link
                    to={`/results/${election.id}`}
                    className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 font-semibold text-xs transition"
                  >
                    <BarChart3 className="w-4 h-4 mr-1.5 text-slate-500" />
                    {isClosed ? 'View Final Results' : 'View Live Results'}
                  </Link>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {elections.length === 0 && !loading && (
        <div className="mt-12 text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No Eligible Elections Found</h3>
          <p className="text-sm text-slate-500 mt-1">
            You are currently not enrolled in any upcoming or active election scope.
          </p>
        </div>
      )}
    </div>
  );
}
