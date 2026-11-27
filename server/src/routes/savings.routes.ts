import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { buildSavingsGoalView } from '../services/savings';
import { walletContext } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, badRequest } from '../utils/errors';
import { created, ok } from '../utils/response';
import { isoDate } from '../validators/schemas';

export const savingsRouter = Router();

const goalBody = z.object({
  name: z.string().trim().min(2).max(100),
  target_amount: z.number().int().positive().max(100_000_000),
  contribution_amount: z.number().int().positive().max(10_000_000).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  target_date: isoDate.optional(),
  locked_until: isoDate.optional(),
}).strict();

const moveBody = z.object({
  amount: z.number().int().positive().max(100_000_000),
  goal_id: z.string().uuid().optional(),
}).strict();

const moneyKey = (req: any) => {
  const value = req.get('Idempotency-Key')?.trim();
  if (!value || value.length < 8 || value.length > 128) {
    throw badRequest('A valid Idempotency-Key header is required');
  }
  return value;
};

const isMissingTable = (msg: string, code?: string) =>
  code === 'PGRST205' ||
  code === '42P01' ||
  code === '42883' ||
  /personal_savings_goals|ledger_accounts|wallet_accounts|ensure_wallet|PGRST205/i.test(msg);

savingsRouter.get('/savings', asyncHandler(async (req, res) => {
  const uid = req.userId!;
  try {
    const { own } = await walletContext(uid, 'sandbox');
    const [account, goals] = await Promise.all([
      adminClient.from('ledger_accounts').select('id,balance').eq('user_id', uid).eq('code', 'savings').maybeSingle(),
      adminClient.from('personal_savings_goals').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);

    const firstErr = account.error ?? goals.error;
    if (firstErr) {
      if (isMissingTable(firstErr.message, firstErr.code)) {
        return ok(res, { wallet_balance: Number(own.balance), available_balance: 0, total_balance: 0, goals: [] });
      }
      throw new AppError(500, 'SAVINGS_ERROR', firstErr.message);
    }

    const goalRows = goals.data ?? [];
    const accountIds = goalRows.map((g: any) => g.account_id).filter(Boolean);
    const balancesRes = accountIds.length
      ? await adminClient.from('ledger_accounts').select('id,balance').in('id', accountIds)
      : { data: [], error: null };
    if (balancesRes.error) {
      throw new AppError(500, 'SAVINGS_ERROR', balancesRes.error.message);
    }
    const balanceMap = new Map((balancesRes.data ?? []).map((a: any) => [a.id, Number(a.balance ?? 0)]));

    const items = goalRows.map((goal: any) =>
      buildSavingsGoalView(goal, balanceMap.get(goal.account_id) ?? 0),
    );
    const goalsTotal = items.reduce((n, g) => n + g.balance, 0);
    const unassigned = Number(account.data?.balance ?? 0);

    ok(res, {
      wallet_balance: Number(own.balance),
      available_balance: unassigned,
      total_balance: goalsTotal + unassigned,
      goals: items,
    });
  } catch (e: any) {
    if (isMissingTable(String(e?.message ?? ''), e?.code)) {
      return ok(res, { wallet_balance: 0, available_balance: 0, total_balance: 0, goals: [] });
    }
    throw e;
  }
}));

savingsRouter.post('/savings/goals', validate(goalBody), asyncHandler(async (req, res) => {
  const uid = req.userId!;
  const { wallet } = await walletContext(uid, 'sandbox');
  const goalId = randomUUID();
  const contributionAmount =
    req.body.contribution_amount ?? Math.max(1, Math.round(Number(req.body.target_amount) / 10));
  const frequency = req.body.frequency ?? 'weekly';

  const account = await adminClient
    .from('ledger_accounts')
    .insert({
      user_id: uid,
      wallet_id: wallet.id,
      code: `savings-goal:${goalId}`,
      kind: 'savings_goal',
      currency: 'XAF',
      locked: true,
      metadata: { goal_id: goalId },
    })
    .select('id')
    .single();
  if (account.error) throw new AppError(500, 'SAVINGS_ERROR', account.error.message);

  const goal = await adminClient
    .from('personal_savings_goals')
    .insert({
      id: goalId,
      user_id: uid,
      name: req.body.name,
      target_amount: req.body.target_amount,
      contribution_amount: contributionAmount,
      frequency,
      ...(req.body.target_date ? { target_date: req.body.target_date } : {}),
      ...(req.body.locked_until ? { locked_until: req.body.locked_until } : {}),
      account_id: account.data.id,
    })
    .select()
    .single();
  if (goal.error) throw new AppError(500, 'SAVINGS_ERROR', goal.error.message);
  created(res, buildSavingsGoalView(goal.data, 0));
}));

for (const action of ['contribute', 'withdraw_goal', 'deposit', 'allocate', 'release', 'withdraw'] as const) {
  const path = action === 'withdraw_goal' ? '/savings/withdraw-goal' : `/savings/${action}`;
  savingsRouter.post(path, validate(moveBody), asyncHandler(async (req, res) => {
    const needsGoal = action === 'contribute' || action === 'withdraw_goal' || action === 'allocate' || action === 'release';
    if (needsGoal && !req.body.goal_id) throw badRequest('Choose a savings goal');
    const { data, error } = await adminClient.rpc('move_personal_savings', {
      p_user: req.userId!,
      p_goal: req.body.goal_id ?? null,
      p_action: action,
      p_amount: req.body.amount,
      p_key: moneyKey(req),
    });
    if (error) {
      const insufficient = /insufficient/i.test(error.message);
      const locked = /locked/i.test(error.message);
      throw new AppError(
        insufficient || locked ? 409 : 400,
        locked ? 'GOAL_LOCKED' : insufficient ? 'INSUFFICIENT_FUNDS' : 'SAVINGS_ERROR',
        error.message,
      );
    }
    created(res, data);
  }));
}
