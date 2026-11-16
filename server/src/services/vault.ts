export type VaultGoal = { id: string; kind?: string; priority: number; target: number; balance: number };
export type VaultAllocation = { goalId: string; amount: number };

const assertInt = (value: number, name: string) => { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`); };

/** Integer-only weighted allocation with emergency reserve, caps and largest-remainder rounding. */
export function allocateVault(amount: number, goals: VaultGoal[], emergencyShare = 20): VaultAllocation[] {
  assertInt(amount, 'amount');
  if (amount === 0) return [];
  if (!Number.isInteger(emergencyShare) || emergencyShare < 10 || emergencyShare > 40) throw new Error('emergencyShare must be between 10 and 40');
  const remainingByGoal = new Map<string, number>();
  const allocated = new Map<string, number>();
  for (const goal of goals) {
    assertInt(goal.target, 'target'); assertInt(goal.balance, 'balance');
    if (!Number.isInteger(goal.priority) || goal.priority < 1 || goal.priority > 5) throw new Error('priority must be between 1 and 5');
    if (remainingByGoal.has(goal.id)) throw new Error('goal ids must be unique');
    remainingByGoal.set(goal.id, Math.max(0, goal.target - goal.balance)); allocated.set(goal.id, 0);
  }
  const totalNeed = [...remainingByGoal.values()].reduce((sum, n) => sum + n, 0);
  if (totalNeed < amount) throw new Error('amount exceeds the remaining need of all goals');
  let left = amount;
  const emergency = goals.find((goal) => goal.kind === 'emergency' && (remainingByGoal.get(goal.id) ?? 0) > 0);
  if (emergency) {
    const reserve = Math.min(Math.floor(amount * emergencyShare / 100), remainingByGoal.get(emergency.id) ?? 0);
    allocated.set(emergency.id, reserve); remainingByGoal.set(emergency.id, (remainingByGoal.get(emergency.id) ?? 0) - reserve); left -= reserve;
  }
  let firstPass = true;
  while (left > 0) {
    let eligible = goals.filter((goal) => (remainingByGoal.get(goal.id) ?? 0) > 0 && (!firstPass || goal.id !== emergency?.id));
    if (!eligible.length) eligible = goals.filter((goal) => (remainingByGoal.get(goal.id) ?? 0) > 0);
    if (!eligible.length) throw new Error('allocation could not consume the full amount');
    const weight = eligible.reduce((sum, goal) => sum + goal.priority, 0);
    const shares = eligible.map((goal) => {
      const numerator = left * goal.priority;
      return { goal, base: Math.floor(numerator / weight), remainder: numerator % weight };
    });
    let distributed = 0;
    for (const share of shares) {
      const give = Math.min(share.base, remainingByGoal.get(share.goal.id) ?? 0);
      allocated.set(share.goal.id, (allocated.get(share.goal.id) ?? 0) + give);
      remainingByGoal.set(share.goal.id, (remainingByGoal.get(share.goal.id) ?? 0) - give); distributed += give;
    }
    let pennies = left - distributed;
    for (const share of [...shares].sort((a, b) => b.remainder - a.remainder || a.goal.id.localeCompare(b.goal.id))) {
      if (!pennies) break;
      if ((remainingByGoal.get(share.goal.id) ?? 0) <= 0) continue;
      allocated.set(share.goal.id, (allocated.get(share.goal.id) ?? 0) + 1);
      remainingByGoal.set(share.goal.id, (remainingByGoal.get(share.goal.id) ?? 0) - 1); pennies -= 1; distributed += 1;
    }
    if (distributed === 0) throw new Error('allocation made no progress');
    left -= distributed; firstPass = false;
  }
  return goals.map((goal) => ({ goalId: goal.id, amount: allocated.get(goal.id) ?? 0 })).filter((part) => part.amount > 0);
}
