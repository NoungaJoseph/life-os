'use client';
import { useApi, useRequireSession } from '../../lib/hooks';

type S = { month: string; currency: string; income: number; spent: number; net: number; savings_rate: number | null;
  categories: { category: string; spent: number; budget: number | null; over: boolean }[]; savings: { id: string; name: string; balance: number; target: number; pct: number }[] };
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function Finance() {
  const ready = useRequireSession();
  const { data, error, loading } = useApi<S>('/finance/summary', ready);
  if (!ready || loading) return <p className="muted">Loading…</p>;
  if (error || !data) return <p className="err">{error ?? 'Could not load.'}</p>;
  return (
    <main>
      <section className="hero"><small>Left this month ({data.currency})</small><h1 style={{ fontSize: 44, margin: 0 }}>{fmt(data.net)}</h1>
        <span>{data.savings_rate === null ? 'Add income in the app to see your savings rate.' : `You kept ${data.savings_rate}% of what you earned.`}</span></section>
      <div className="grid">
        <section className="card"><h3>Income</h3><strong style={{ fontSize: 28 }}>{fmt(data.income)}</strong></section>
        <section className="card"><h3>Spent</h3><strong style={{ fontSize: 28 }}>{fmt(data.spent)}</strong></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}><h2>Where it went</h2>
        {data.categories.length === 0 ? <p className="muted">No spending recorded this month.</p> : data.categories.map((c) => (
          <div key={c.category}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{c.category}</span><span className="muted">{fmt(c.spent)}{c.budget !== null ? ` / ${fmt(c.budget)}` : ''}</span></div>
            <div className={`bar ${c.over ? 'bad' : ''}`}><i style={{ width: `${c.budget ? Math.min(100, (c.spent / c.budget) * 100) : 100}%` }} /></div></div>))}
      </section>
      <section className="card" style={{ marginTop: 16 }}><h2>Savings</h2>
        {data.savings.length === 0 ? <p className="muted">No savings goals yet.</p> : data.savings.map((g) => (
          <div key={g.id}><strong>{g.name}</strong><div className="bar"><i style={{ width: `${g.pct}%` }} /></div><span className="muted">{fmt(g.balance)} of {fmt(g.target)}</span></div>))}
      </section>
      <p className="muted">All figures come from what you record. Nothing is connected to your bank.</p>
    </main>
  );
}
