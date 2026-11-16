'use client';
import { useApi, useRequireSession } from '../../lib/hooks';

type Goal = { id: string; title: string; goal_type: string; status: string; progress: number };

export default function Goals() {
  const ready = useRequireSession();
  const { data, error, loading } = useApi<Goal[]>('/goals-overview', ready);
  if (!ready || loading) return <p className="muted">Loading…</p>;
  if (error || !data) return <p className="err">{error ?? 'Could not load goals.'}</p>;
  return (
    <main>
      <h1>Goals</h1>
      {data.length === 0 ? <p className="muted">No goals yet. Create one in the mobile app.</p> : (
        <div className="grid">{data.map((g) => {
          const pct = Math.round(g.progress ?? 0);
          return (
            <article className="card" key={g.id}>
              <span className="pill">{g.goal_type.replace('_', ' ')}</span>
              <h3 style={{ marginTop: 8 }}>{g.title}</h3>
              <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
              <span className="muted">{pct}% · {g.status.replace('_', ' ')}</span>
            </article>);
        })}</div>)}
    </main>
  );
}
