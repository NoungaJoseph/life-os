let pendingOtpEmail: string | null = null;

/** Signup OTP state is deliberately memory-only so a full app reload cannot reopen a stale OTP screen. */
export const beginOtpFlow = (email: string) => { pendingOtpEmail = email.trim().toLowerCase(); };
export const isOtpFlowActive = (email?: string) => !!email && pendingOtpEmail === email.trim().toLowerCase();
export const endOtpFlow = () => { pendingOtpEmail = null; };
