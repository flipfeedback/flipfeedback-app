import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, ApiError } from '../lib/api';
import type { Analytics } from '../lib/types';

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#059669',
  NEUTRAL: '#9ca3af',
  NEGATIVE: '#dc2626',
};

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .analytics(days)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load analytics'));
  }, [days]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">Loading analytics…</div>;

  const sentimentData = (Object.keys(data.sentiment) as (keyof typeof data.sentiment)[]).map((k) => ({
    name: k,
    value: data.sentiment[k],
  }));

  const trendArrow = data.trend.direction === 'up' ? '▲' : data.trend.direction === 'down' ? '▼' : '■';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Analytics</h1>
        <select style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="cards">
        <div className="panel card">
          <div className="num">{data.total}</div>
          <div className="lbl">Feedback (window)</div>
        </div>
        <div className="panel card">
          <div className="num">{data.byStatus.NEW}</div>
          <div className="lbl">New (open)</div>
        </div>
        <div className="panel card">
          <div className="num">{data.byStatus.IN_REVIEW}</div>
          <div className="lbl">In review</div>
        </div>
        <div className="panel card">
          <div className="num">{data.byStatus.RESOLVED}</div>
          <div className="lbl">Resolved</div>
        </div>
        <div className="panel card">
          <div className="num">
            {trendArrow} {data.trend.changePct === null ? '—' : `${data.trend.changePct}%`}
          </div>
          <div className="lbl">Volume trend</div>
        </div>
      </div>

      <div className="panel chart-box">
        <h3>Volume over time</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.volumeOverTime} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="panel chart-box">
          <h3>By source</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.bySource} layout="vertical" margin={{ left: 30, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-box">
          <h3>Sentiment</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={90} label>
                {sentimentData.map((entry) => (
                  <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.byCampaign.length > 0 && (
        <div className="panel chart-box">
          <h3>By campaign</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byCampaign} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="campaign" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
