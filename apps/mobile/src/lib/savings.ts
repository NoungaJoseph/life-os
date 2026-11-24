export type SavingsGoal = { id:string; name:string; target_amount:number; contribution_amount:number; frequency:'daily'|'weekly'|'monthly'; target_date:string|null; locked_until:string|null; balance:number; installments_remaining:number; projected_completion:string };
export type SavingsOverview = { wallet_balance:number; available_balance:number; total_balance:number; goals:SavingsGoal[] };
export const moneyKey = () => `savings-${Date.now()}-${Math.random().toString(36).slice(2)}`;
