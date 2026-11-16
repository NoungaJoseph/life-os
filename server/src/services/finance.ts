export interface Amt { amount: number | string; category?: string | null; currency?: string | null }
const num = (v: unknown) => Number(v) || 0;

export function summarizeFinance(opts: {
  currency: string; income: Amt[]; expenses: Amt[];
  budgets: { category: string; amount: number | string }[];
  savings: { id: string; name: string; kind: string; target_amount: number | string; currency?: string }[];
  savingsTx: { savings_goal_id: string; amount: number | string }[];
}) {
  const cur = opts.currency;
  const same = (r: Amt) => !r.currency || r.currency === cur;
  const inc = opts.income.filter(same), exp = opts.expenses.filter(same);
  const skipped = opts.income.length - inc.length + opts.expenses.length - exp.length;
  const income = inc.reduce((s, r) => s + num(r.amount), 0);
  const spent = exp.reduce((s, r) => s + num(r.amount), 0);
  const byCat = new Map<string, number>();
  for (const r of exp) byCat.set(r.category ?? 'Other', (byCat.get(r.category ?? 'Other') ?? 0) + num(r.amount));
  const budgetMap = new Map(opts.budgets.map((b) => [b.category, num(b.amount)]));
  const cats = new Set([...byCat.keys(), ...budgetMap.keys()]);
  const categories = [...cats].map((category) => {
    const s = byCat.get(category) ?? 0, b = budgetMap.get(category) ?? null;
    return { category, spent: s, budget: b, remaining: b === null ? null : b - s, over: b !== null && s > b };
  }).sort((a, b) => b.spent - a.spent);
  const bal = new Map<string, number>();
  for (const t of opts.savingsTx) bal.set(t.savings_goal_id, (bal.get(t.savings_goal_id) ?? 0) + num(t.amount));
  const savings = opts.savings.map((g) => {
    const balance = bal.get(g.id) ?? 0, target = num(g.target_amount);
    return { id: g.id, name: g.name, kind: g.kind, target, balance, pct: target > 0 ? Math.min(100, Math.round((balance / target) * 100)) : 0 };
  });
  return {
    currency: cur, income, spent, net: income - spent,
    savings_rate: income > 0 ? Math.round(((income - spent) / income) * 100) : null,
    categories, savings, over_budget: categories.filter((c) => c.over).map((c) => c.category),
    skipped_other_currency: skipped,
  };
}

export interface DebtIn { id: string; name: string; creditor?: string | null; direction: string; principal: number | string; currency?: string; due_date?: string | null; min_payment?: number | string | null; status: string }
export function summarizeDebts(debts: DebtIn[], payments: { debt_id: string; amount: number | string }[], today: string) {
  const paid = new Map<string, number>();
  for (const p of payments) paid.set(p.debt_id, (paid.get(p.debt_id) ?? 0) + num(p.amount));
  const items = debts.map((d) => {
    const principal = num(d.principal), p = paid.get(d.id) ?? 0, remaining = Math.max(0, principal - p);
    const min = d.min_payment == null ? null : num(d.min_payment);
    return {
      id: d.id, name: d.name, creditor: d.creditor ?? null, direction: d.direction, currency: d.currency, status: d.status,
      principal, paid: p, remaining, pct: principal > 0 ? Math.min(100, Math.round((p / principal) * 100)) : 100,
      due_date: d.due_date ?? null, overdue: !!d.due_date && d.due_date < today && remaining > 0 && d.status === 'active',
      payments_left: min && min > 0 && remaining > 0 ? Math.ceil(remaining / min) : null,
    };
  });
  const open = items.filter((i) => i.status === 'active');
  const sum = (dir: string) => open.filter((i) => i.direction === dir).reduce((s, i) => s + i.remaining, 0);
  return { items, i_owe: sum('owed_by_me'), owed_to_me: sum('owed_to_me'), overdue: open.filter((i) => i.overdue).map((i) => i.name) };
}
