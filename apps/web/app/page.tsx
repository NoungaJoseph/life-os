'use client';
import { api } from '../lib/api';
import { useApi, useRequireSession } from '../lib/hooks';
import { useState } from 'react';

type Dash = {
  momentum: number | null;
  summary: { tasks_open?: number; tasks_done_today: number };
  priorities: { id: string; title: string; due_date: string | null; priority: string }[];
  habits: { id: string; name: string; stats: { streak: number; completed_today: boolean } }[];
  insights?: { title: string; body: string }[];
};

export default function Today() {
  const ready = useRequireSession();
  const { data, error, loading, reload } = useApi<Dash>('/dashboard/today', ready);
  const [busy, setBusy] = useState<string | null>(null);
  if (!ready || loading) return <p className="muted">Loading…</p>;
  if (error || !data) return <p className="err">{error ?? 'Could not load.'} <button onClick={reload}>Retry</button></p>;
  const today = new Date().toISOString().slice(0, 10);
  async function complete(id: string) { setBusy(id); try { await api(`/tasks/${id}`, { method: 'PATCH', body: { completed: true } }); reload(); } finally { setBusy(null); } }
  async function check(id: string, done: boolean) { setBusy(id); try { await api(`/habits/${id}/completions/${today}`, { method: done ? 'DELETE' : 'PUT', body: done ? undefined : {} }); reload(); } finally { setBusy(null); } }
  return (
    <main>
      <section className="hero"><small>Momentum</small><h1 style={{ fontSize: 48, margin: 0 }}>{data.momentum ?? '–'}</h1><span>{data.summary.tasks_done_today} tasks done today</span></section>
      <div className="grid">
        <section className="card"><h2>Today&apos;s priorities</h2>
          {data.priorities.length === 0 ? <p className="muted">Nothing due. Enjoy the space.</p> : (
            <ul className="clean">{data.priorities.map((p) => (
              <li key={p.id}><label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 20, margin: 0 }} disabled={busy === p.id} onChange={() => complete(p.id)} />
                <span>{p.title}{p.due_date && p.due_date < today ? <span className="pill" style={{ marginLeft: 8, color: 'var(--danger)' }}>overdue</span> : null}</span></label></li>))}</ul>)}
        </section>
        <section className="card"><h2>Daily habits</h2>
          <ul className="clean">{data.habits.map((h) => (
            <li key={h.id}><label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 20, margin: 0 }} checked={h.stats.completed_today} disabled={busy === h.id} onChange={() => check(h.id, h.stats.completed_today)} />
              <span>{h.name} <span className="muted">· {h.stats.streak}-day streak</span></span></label></li>))}</ul>
        </section>
      </div>
      {data.insights?.length ? <section className="card" style={{ marginTop: 16 }}><h2>Smart insights</h2><ul className="clean">{data.insights.map((i, k) => <li key={k}><strong>{i.title}</strong><div className="muted">{i.body}</div></li>)}</ul></section> : null}
    </main>
  );
}
