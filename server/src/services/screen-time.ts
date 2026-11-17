export type ScreenRule = { app_identifier: string; daily_limit_minutes: number; block_minutes: number; commitment_mode: boolean; enabled: boolean; blocked_until?: string | null };

export function activeCommitment(rule: ScreenRule, now = new Date()) {
  return rule.commitment_mode && !!rule.blocked_until && new Date(rule.blocked_until).getTime() > now.getTime();
}

export function weakensCommitment(rule: ScreenRule, changes: Partial<ScreenRule>, now = new Date()) {
  if (!activeCommitment(rule, now)) return false;
  return changes.enabled === false || changes.commitment_mode === false ||
    (changes.daily_limit_minutes !== undefined && changes.daily_limit_minutes > rule.daily_limit_minutes) ||
    (changes.block_minutes !== undefined && changes.block_minutes < rule.block_minutes) ||
    (changes.app_identifier !== undefined && changes.app_identifier !== rule.app_identifier);
}
