export type GroupFrequency = 'daily' | 'weekly' | 'monthly';
export type ContributionState = 'due' | 'paid' | 'late' | 'missed';
export type ContributionSlot = { dueOn: string; status: ContributionState; paidAt?: string | null };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const parse = (value: string) => new Date(`${value}T12:00:00Z`);

function nextDate(date: Date, frequency: Exclude<GroupFrequency, 'monthly'>) {
  const next = new Date(date);
  if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export function contributionDates(startOn: string, endOn: string, frequency: GroupFrequency) {
  const start = parse(startOn); const end = parse(endOn);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error('Invalid contribution dates');
  const out: string[] = [];
  if (frequency === 'monthly') {
    const anchor = start.getUTCDate();
    for (let offset = 0; offset < 240; offset++) {
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1, 12));
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(anchor, lastDay), 12));
      if (cursor > end) break;
      out.push(iso(cursor));
    }
  } else for (let cursor = start, guard = 0; cursor <= end && guard < 3700; cursor = nextDate(cursor, frequency), guard++) out.push(iso(cursor));
  return out;
}

export function scheduleStatus(dueOn: string, paidAt: string | null | undefined, today = iso(new Date())): ContributionState {
  if (paidAt) return paidAt.slice(0, 10) > dueOn ? 'late' : 'paid';
  if (dueOn < today) return 'missed';
  return 'due';
}

export function buildContributionSchedule(startOn: string, endOn: string, frequency: GroupFrequency, payments: Array<{ due_on: string; paid_at?: string | null }> = [], today?: string): ContributionSlot[] {
  const byDate = new Map(payments.map((payment) => [payment.due_on, payment.paid_at]));
  return contributionDates(startOn, endOn, frequency).map((dueOn) => ({ dueOn, paidAt: byDate.get(dueOn), status: scheduleStatus(dueOn, byDate.get(dueOn), today) }));
}
