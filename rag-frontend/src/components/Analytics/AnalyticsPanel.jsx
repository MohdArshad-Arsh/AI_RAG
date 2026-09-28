import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import WeeklyQuestionsChart from './WeeklyQuestionsChart';

// --- AvgMetricsCard Component ---
function AvgMetricsCard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/avg-metrics')
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-surface border border-white/5 rounded-xl p-4">
        <div className="text-green-400 text-3xl font-display">
          {loading ? '...' : error ? '--' : `${metrics?.avgResponseTime?.toFixed(2)}s`}
        </div>
        <div className="text-xs text-white/40 mt-1">Avg Response Time</div>
      </div>

      <div className="bg-surface border border-white/5 rounded-xl p-4">
        <div className="text-yellow-400 text-3xl font-display">
          {loading
            ? '...'
            : error
              ? '--'
              : `${(metrics?.avgConfidence * 100).toFixed(0)}%`}
        </div>
        <div className="text-xs text-white/40 mt-1">Avg Confidence</div>
      </div>
    </div>
  );
}


// --- Main Analytics Panel ---
export default function AnalyticsPanel() {
  const [overview, setOverview] = useState(null);
  const [queryTrend, setQueryTrend] = useState([]);
  const [documentUsage, setDocumentUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/analytics/summary'),
      axios.get('/api/analytics/query-trend'),
      axios.get('/api/analytics/document-usage'),
    ])
      .then(([summaryRes, trendRes, usageRes]) => {
        setOverview(summaryRes.data);
        setQueryTrend(trendRes.data);
        setDocumentUsage(usageRes.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-5 text-white/50">Loading dashboard...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

      {/* Title */}
      <div>
        <h1 className="font-display text-xl">📊 Analytics Dashboard</h1>
        <p className="text-xs text-white/40 mt-1">
          Usage statistics and performance metrics
        </p>
      </div>

      {/* ✅ NEW Avg Metrics */}
      <AvgMetricsCard />

      {/* KPI Cards (no duplicate avg metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="font-display text-3xl text-accent">{overview?.totalDocs ?? 0}</div>
          <div className="text-xs text-white/40 mt-1">Documents Uploaded</div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="font-display text-3xl text-purple-400">{overview?.totalQueries ?? 0}</div>
          <div className="text-xs text-white/40 mt-1">Total Queries</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Document Usage */}
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="text-sm font-semibold mb-4">
            Document Usage (Latest Day)
          </div>

          <div className="flex flex-col gap-3">
            {(() => {
              const latest = [...documentUsage]
                .reverse()
                .find(day => day.documents?.length);

              if (!latest) return <div>No data</div>;

              const max = Math.max(...latest.documents.map(d => d.count), 1);

              return latest.documents.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="text-xs w-36 truncate">{d.name}</div>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${(d.count / max) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs w-8 text-right">{d.count}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Weekly Questions Trend Chart */}
      <WeeklyQuestionsChart />
    </div>
  );
}
