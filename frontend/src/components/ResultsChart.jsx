import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export function ResultsChart({ candidates = [], isClosed = false, winnerCandidateId = null }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No candidate data available
      </div>
    );
  }

  const data = candidates.map((c) => ({
    name: c.name,
    votes: c.voteCount,
    percentage: c.percentage,
    candidateId: c.chainCandidateId,
  }));

  const maxVotes = Math.max(...data.map((d) => d.votes), 1);

  return (
    <div className="w-full h-80 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 12 }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            domain={[0, Math.ceil(maxVotes * 1.15)]}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs">
                    <p className="font-semibold text-slate-900 mb-1">{item.name}</p>
                    <p className="text-brand-600 font-bold">{item.votes} Votes</p>
                    <p className="text-slate-500">{item.percentage}% of total</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="votes" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((entry, index) => {
              const isWinner = isClosed && entry.candidateId === winnerCandidateId;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isWinner ? '#10b981' : '#2563eb'}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
