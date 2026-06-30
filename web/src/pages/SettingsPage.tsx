import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Label, Source, TeamMember } from '../lib/types';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { session } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New source form.
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState('CHANNEL');
  const [srcCampaign, setSrcCampaign] = useState('');

  // New label form.
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#6366f1');

  // Invite form.
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');

  const canManage = session?.user.role === 'OWNER' || session?.user.role === 'ADMIN';

  function reload() {
    Promise.all([api.listSources(), api.listTeam(), api.listLabels()])
      .then(([s, t, l]) => {
        setSources(s);
        setTeam(t);
        setLabels(l);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load settings'));
  }

  useEffect(reload, []);

  async function addSource(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createSource({ name: srcName, type: srcType, campaign: srcCampaign || undefined });
      setSrcName('');
      setSrcCampaign('');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add source');
    }
  }

  async function toggleSource(s: Source) {
    try {
      await api.updateSource(s.id, { connected: !s.connected });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update source');
    }
  }

  async function addLabel(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createLabel({ name: labelName, color: labelColor });
      setLabelName('');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add label');
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.addTeamMember({ name: memberName, email: memberEmail, password: memberPassword });
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      {error && <div className="error">{error}</div>}

      <div className="panel chart-box">
        <h3>Connected sources</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Campaign</th>
              <th>Feedback</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{s.campaign ?? '—'}</td>
                <td>{s.feedbackCount ?? 0}</td>
                <td>{s.connected ? 'Connected' : 'Disconnected'}</td>
                <td>
                  <button onClick={() => toggleSource(s)}>{s.connected ? 'Disconnect' : 'Reconnect'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="inline-form" style={{ marginTop: 14 }} onSubmit={addSource}>
          <div className="field">
            <label>Name</label>
            <input value={srcName} onChange={(e) => setSrcName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={srcType} onChange={(e) => setSrcType(e.target.value)}>
              <option value="CHANNEL">Channel</option>
              <option value="CAMPAIGN">Campaign</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </div>
          <div className="field">
            <label>Campaign (optional)</label>
            <input value={srcCampaign} onChange={(e) => setSrcCampaign(e.target.value)} />
          </div>
          <button className="primary" type="submit">
            Add source
          </button>
        </form>
      </div>

      <div className="panel chart-box">
        <h3>Labels</h3>
        <div className="feedback-meta" style={{ marginBottom: 12 }}>
          {labels.map((l) => (
            <span key={l.id} className="label-chip" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
          {labels.length === 0 && <span className="muted">No labels yet.</span>}
        </div>
        <form className="inline-form" onSubmit={addLabel}>
          <div className="field">
            <label>Name</label>
            <input value={labelName} onChange={(e) => setLabelName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Color</label>
            <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} style={{ width: 60, padding: 2 }} />
          </div>
          <button className="primary" type="submit">
            Add label
          </button>
        </form>
      </div>

      <div className="panel chart-box">
        <h3>Team members</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canManage ? (
          <form className="inline-form" style={{ marginTop: 14 }} onSubmit={invite}>
            <div className="field">
              <label>Name</label>
              <input value={memberName} onChange={(e) => setMemberName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Temp password</label>
              <input
                type="password"
                value={memberPassword}
                onChange={(e) => setMemberPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button className="primary" type="submit">
              Add member
            </button>
          </form>
        ) : (
          <p className="muted">Only owners and admins can add team members.</p>
        )}
      </div>
    </div>
  );
}
