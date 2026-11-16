export function ledgerMismatches(accounts: { id: string; balance: number }[], entries: { account_id: string; amount: number }[]) {
  const sums = new Map<string, number>();
  for (const entry of entries) sums.set(entry.account_id, (sums.get(entry.account_id) ?? 0) + entry.amount);
  return accounts.map((account) => ({ accountId: account.id, cached: account.balance, calculated: sums.get(account.id) ?? 0 })).filter((row) => row.cached !== row.calculated);
}
