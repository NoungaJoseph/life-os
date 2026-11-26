import { Router } from 'express';

function legalLayout(title: string, subtitle: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — MY LIFE OS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ECEAE3; color: #181B17; margin: 0; padding: 24px 16px; line-height: 1.6; }
    main { max-width: 760px; margin: 0 auto; background: #F8F7F2; border: 1px solid #CFCDC3; border-radius: 12px; padding: 32px; }
    .eyebrow { color: #A9803D; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 6px; }
    h1 { margin: 0 0 8px; font-size: 28px; color: #181B17; }
    .sub { color: #686E65; font-size: 14px; margin: 0 0 24px; padding-bottom: 16px; border-bottom: 1px solid #CFCDC3; }
    h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; color: #20241F; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
    footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #CFCDC3; font-size: 13px; color: #686E65; }
    a { color: #2F7969; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">MY LIFE OS</div>
    <h1>${title}</h1>
    <p class="sub">${subtitle}</p>
    ${bodyHtml}
    <footer>
      <a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Use</a>
    </footer>
  </main>
</body>
</html>`;
}

export function renderPrivacyHtml(): string {
  return legalLayout(
    'Privacy Policy / Politique de confidentialité',
    'Effective November 2026 — MY LIFE OS respects your privacy and keeps you in full control of your data.',
    `
    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account information:</strong> Name, email address, phone number, language, timezone, and currency preference.</li>
      <li><strong>Personal planning &amp; life records:</strong> Goals, tasks, habits, evening &amp; morning plans, daily reviews, journal entries, food logs, workout logs, reading sessions, personal transformation reflections, and manual income/expense/budget/debt entries.</li>
      <li><strong>Wallet &amp; savings records:</strong> Internal wallet ledger transactions, Goal Vault allocations, group savings contributions, and payment status metadata needed to reconcile deposits/withdrawals.</li>
      <li><strong>Device security &amp; notifications:</strong> Device identifier/platform for active session management and Expo push tokens (when you explicitly enable notifications). Your 4-digit PIN is hashed securely and never stored in plaintext.</li>
      <li><strong>Optional Android Screen Time permissions:</strong> Only when you enable Screen Time limits on Android, <em>Usage Access</em> reads app usage totals and the <em>Accessibility Service</em> detects only which foreground app package is currently open so it can show your block overlay. It never reads messages, passwords, or screen content.</li>
    </ul>

    <h2>2. How We Use &amp; Protect Your Data</h2>
    <ul>
      <li>All personal tables are protected by PostgreSQL Row-Level Security (RLS), scoped strictly to your authenticated account.</li>
      <li>We never sell your personal data and never display third-party advertising.</li>
      <li>When optional AI coaching is enabled, only summary activity numbers are sent unless you explicitly tap <em>Reflect with AI</em> on an entry.</li>
    </ul>

    <h2>3. Data Export &amp; Account Deletion</h2>
    <p>You stay in control of everything you record:</p>
    <ul>
      <li><strong>Export your data:</strong> Open <strong>Settings &rarr; Export my data</strong> in the app to download a complete JSON copy at any time.</li>
      <li><strong>Delete your account &amp; data:</strong> Open <strong>Settings &rarr; Delete account</strong> inside the app and type <code>DELETE</code>. Your authentication account and all associated database records are permanently removed immediately.</li>
    </ul>

    <h2>4. Résumé en français</h2>
    <p>MY LIFE OS protège vos données personnelles par chiffrement, contrôle d'accès strict (RLS) et code PIN. Vos journaux restent privés, aucune donnée n'est vendue à des tiers, le service d'accessibilité Android (facultatif) lit uniquement l'application active sans jamais lire le contenu de l'écran, et vous pouvez exporter ou supprimer définitivement votre compte depuis <strong>Paramètres</strong> à tout moment.</p>
    `,
  );
}

export function renderTermsHtml(): string {
  return legalLayout(
    'Terms of Use / Conditions d’utilisation',
    'Effective November 2026 — Guidelines for using MY LIFE OS.',
    `
    <h2>1. Personal Productivity &amp; Budgeting Tool</h2>
    <p>MY LIFE OS provides personal goal planning, habit tracking, journaling, monthly visual reports, and manual financial tracking. Financial entries you log manually reflect what you enter.</p>

    <h2>2. Goal Vault &amp; Locked Savings Groups</h2>
    <p>When you opt into Goal Vault or Group Savings locks, you acknowledge the lock rules explained before confirmation (funds remain allocated to their selected goal or group end date according to the rules you accepted).</p>

    <h2>3. No Medical, Legal, or Financial Advice</h2>
    <p>Insights, streak statistics, monthly reports, and optional AI coaching are informational tools only and do not constitute medical, psychological, legal, or licensed financial advice.</p>

    <h2>4. Account Responsibility</h2>
    <p>Keep your password and 4-digit app PIN confidential, and manage signed-in devices from <strong>Profile &rarr; Devices and sessions</strong>. You may stop using the service or delete your account permanently at any time in Settings.</p>
    `,
  );
}

export const legalRouter = Router();

legalRouter.get('/privacy', (_req, res) => {
  res.status(200).type('html').send(renderPrivacyHtml());
});

legalRouter.get('/terms', (_req, res) => {
  res.status(200).type('html').send(renderTermsHtml());
});
