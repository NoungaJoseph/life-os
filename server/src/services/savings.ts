export interface RawSavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string;
  contribution_amount?: number | string | null;
  frequency?: 'daily' | 'weekly' | 'monthly' | null;
  target_date?: string | null;
  locked_until?: string | null;
  unlocked_at?: string | null;
  account_id: string;
  created_at?: string;
}

export interface SavingsGoalView {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  contribution_amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  target_date: string | null;
  locked_until: string | null;
  unlocked_at: string | null;
  account_id: string;
  balance: number;
  remaining: number;
  progress_pct: number;
  is_unlocked: boolean;
  installments_remaining: number;
  projected_completion: string;
}

export function buildSavingsGoalView(row: RawSavingsGoalRow, balance: number, now = new Date()): SavingsGoalView {
  const targetAmount = Math.max(1, Number(row.target_amount) || 1);
  const contributionAmount = Math.max(1, Number(row.contribution_amount) || Math.max(1, Math.round(targetAmount / 10)));
  const frequency = row.frequency ?? 'weekly';
  const safeBalance = Math.max(0, Number(balance) || 0);
  const remaining = Math.max(0, targetAmount - safeBalance);
  const progressPct = Math.min(100, Math.round((safeBalance / targetAmount) * 100));
  const isUnlocked = Boolean(row.unlocked_at) || safeBalance >= targetAmount;
  const installmentsRemaining = Math.ceil(remaining / contributionAmount);
  const days = frequency === 'daily' ? installmentsRemaining : frequency === 'weekly' ? installmentsRemaining * 7 : installmentsRemaining * 30;
  const projectedCompletion = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    target_amount: targetAmount,
    contribution_amount: contributionAmount,
    frequency,
    target_date: row.target_date ?? null,
    locked_until: row.locked_until ?? null,
    unlocked_at: row.unlocked_at ?? null,
    account_id: row.account_id,
    balance: safeBalance,
    remaining,
    progress_pct: progressPct,
    is_unlocked: isUnlocked,
    installments_remaining: installmentsRemaining,
    projected_completion: projectedCompletion,
  };
}

export function validateGoalWithdrawal(
  goal: { target_amount: number; balance: number; unlocked_at?: string | null },
  amount: number,
): { ok: true } | { ok: false; code: 'LOCKED' | 'INSUFFICIENT' | 'INVALID'; message: string } {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID', message: 'Enter a valid whole amount above zero.' };
  }
  const unlocked = Boolean(goal.unlocked_at) || goal.balance >= goal.target_amount;
  if (!unlocked) {
    return {
      ok: false,
      code: 'LOCKED',
      message: `Goal is locked until you reach your target of ${goal.target_amount} FCFA.`,
    };
  }
  if (amount > goal.balance) {
    return { ok: false, code: 'INSUFFICIENT', message: 'Insufficient goal balance.' };
  }
  return { ok: true };
}
