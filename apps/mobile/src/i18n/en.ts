/** English is the source catalogue. fr.ts must have exactly the same keys (checked by the type system and by a test). */
const base = {
  common: {
    appName: 'MY LIFE OS', tagline: 'Design your life. Execute your goals. Become better.',
    continue: 'Continue', back: 'Back', cancel: 'Cancel', save: 'Save', delete: 'Delete', retry: 'Try again', next: 'Next', skip: 'Skip', done: 'Done', gotIt: 'Got it',
    loading: 'Loading…', offline: 'You are offline. Showing your last saved data; changes need a connection.', or: 'or', yes: 'Yes', no: 'No', optional: 'optional', edit: 'Edit', close: 'Close',
    errors: { network: 'Cannot reach the server. Check your connection.', generic: 'Something went wrong. Please try again.', required: 'This field is required.',
      notFound: 'We could not find that.', validation: 'Some of the values are not valid.', conflict: 'That already exists.', rateLimited: 'Too many requests. Please wait a moment.', unauthorized: 'Please sign in again.', aiOff: 'The AI coach is not enabled yet.' },
  },
  language: {
    title: 'Choose your language', subtitle: 'You can change it any time in Settings.', french: 'Français', english: 'English', frenchHint: 'French', englishHint: 'Anglais',
    continue: 'Continue', settingsTitle: 'Language',
  },
  auth: {
    welcomeTitle: 'Welcome', welcomeBody: 'Plan your life, reach your goals and grow your savings in one place.',
    welcome: { f1Title: 'Plan your life', f1Body: 'Set goals for every area and see your progress.', f2Title: 'Save with purpose', f2Body: 'Put money aside for what matters, goal by goal.', f3Title: 'Stay private and safe', f3Body: 'Your PIN protects your account on this phone.' },
    createAccount: 'Create account', signIn: 'Sign in', haveAccount: 'Already have an account?', noAccount: 'New here?',
    register: {
      title: 'Create your account', subtitle: 'It takes about a minute.', firstName: 'First name', lastName: 'Last name', email: 'Email address', phone: 'Phone number',
      phoneHint: 'Example: 6 71 06 31 70', password: 'Password', repeatPassword: 'Repeat password', passwordHint: 'At least 8 characters, with a letter and a number.',
      submit: 'Create my account', terms: 'By continuing you accept our terms of use and privacy policy.',
    },
    login: { title: 'Welcome back', subtitle: 'Sign in with your email address.', identifier: 'Email address', password: 'Password', submit: 'Sign in', forgot: 'Forgot your password?', show: 'Show', hide: 'Hide' },
    otp: { title: 'Check your email', subtitle: 'We sent a 6-digit code to {{email}}. Enter it below.', code: 'Verification code', verify: 'Verify', resend: 'Send a new code', resendIn: 'Send a new code in {{s}}s', sent: 'A new code was sent.', wrongEmail: 'Wrong email? Go back' },
    forgot: { title: 'Reset your password', subtitle: 'Enter your email and we will send you a code.', send: 'Send code', newPassword: 'New password', reset: 'Change password', done: 'Password changed. You can sign in now.' },
    pin: {
      currentTitle: 'Enter your current PIN', createTitle: 'Create your PIN', createBody: 'Choose 4 digits. You will use it to open the app each time.', confirmTitle: 'Confirm your PIN', confirmBody: 'Enter the same 4 digits again.',
      mismatch: 'The PINs do not match. Try again.', weak: 'Choose a PIN that is harder to guess, not 1234 or 0000.',
      unlockTitle: 'Hi {{name}}', unlockBody: 'Enter your PIN to continue.', wrong: 'Wrong PIN. {{n}} tries left.', locked: 'Too many wrong tries. Sign in again with your password.',
      forgot: 'Forgot your PIN?', forgotBody: 'You will sign out and sign in again with your password. Then you can create a new PIN.', signOutAndReset: 'Sign out and reset',
    },
    errors: {
      invalidCredentials: 'Wrong email, phone number or password.', emailInUse: 'We could not create this account. Try signing in.', phoneInUse: 'This phone number is already used.',
      badOtp: 'This code is wrong or has expired.', tooMany: 'Too many tries. Please wait a moment.', sessionRevoked: 'This device was signed out. Please sign in again.',
      email: 'Enter a valid email address.', phone: 'Enter a valid phone number.', name: 'Enter your name.', passwordShort: 'Use at least 8 characters.', passwordWeak: 'Add at least one letter and one number.',
      passwordMatch: 'The passwords do not match.',
    },
  },
  tutorial: {
    skip: 'Skip tour', next: 'Next', finish: 'Start my journey', replay: 'Replay tutorial', replayHint: 'Show the welcome tour and first-visit tips again.', progress: '{{current}} of {{total}}',
    cards: {
      oneTitle: 'One calm place for your life', oneBody: 'Bring your goals, plans, routines and money decisions together without the noise.',
      twoTitle: 'Turn direction into action', twoBody: 'Break meaningful goals into today\'s tasks and habits, then see your progress clearly.',
      threeTitle: 'Build consistency gently', threeBody: 'Use reminders, reviews and helpful insights without guilt or judgment.',
      fourTitle: 'Give every franc a purpose', fourBody: 'Track your finances and prepare for savings tools built around your real priorities.',
      fiveTitle: 'Private by design', fiveBody: 'Your account, app PIN and device sessions help keep your personal life protected.',
    },
    tipTitle: 'A quick tip', dismiss: 'Got it',
    tips: {
      home: 'Your Home screen brings today\'s priorities, habits and progress together.', goals: 'Open a goal to update progress, milestones and the next action.', planner: 'Use the date controls to focus on one day and keep your plan realistic.', habits: 'Small repeated actions matter more than a perfect streak.', finance: 'Review income, spending and savings together before making the next money decision.', settings: 'You can replay this tour here whenever you need a refresher.', wallet: 'Your wallet balance and every movement will be recorded in the secure ledger.', vault: 'Vault money is split across priorities and stays locked until a goal is reached.', groups: 'Each member saves their own money and receives their own savings at the end date.', transformation: 'Compare your current and target self with a private, supportive check-in.', screenTime: 'Blocking works only while the required phone permissions remain enabled.',
    },
    checklist: { title: 'Complete your setup', body: '{{done}} of {{total}} ready', profile: 'Complete your profile', goal: 'Create your first goal', habit: 'Add your first habit', money: 'Add money', pin: 'Protect the app with a PIN' },
  },
  wallet: {
    profileButton: 'Wallet', title: 'Wallet', subtitle: 'Your money, recorded clearly', balance: 'Wallet balance', hideBalance: 'Hide balance', showBalance: 'Show balance',
    add: 'Add money', withdraw: 'Withdraw', vault: 'Send to Vault', groups: 'Groups', recent: 'Recent transactions', all: 'All', empty: 'No wallet transactions yet.',
    amount: 'Amount in FCFA', phone: 'Mobile Money number', provider: 'Operator', sandbox: 'Sandbox', mtn: 'MTN MoMo', orange: 'Orange Money', suggested: '{{provider}} looks right for this number. You can change it.',
    submitDeposit: 'Request deposit', submitWithdrawal: 'Request withdrawal', invalidAmount: 'Enter a whole amount above zero.', success: 'Request created.',
    status: { pending: 'Pending', processing: 'Processing', succeeded: 'Successful', failed: 'Failed', reversed: 'Reversed' },
    kind: { deposit: 'Deposit', withdrawal: 'Withdrawal', vault_transfer: 'Vault transfer', vault_release: 'Vault release', group_contribution: 'Group contribution', group_release: 'Group release', reversal: 'Reversal', adjustment: 'Adjustment' },
  },
  vault: {
    title: 'Goal Vault', subtitle: 'Locked savings for what matters', howTitle: 'How the Vault works', howBody: 'Money you send to the Vault is split across your goals and locked. You cannot withdraw it early. Each goal releases automatically to your wallet only when its target is reached.', acknowledge: 'I understand that this money stays locked until the goal is reached.', accept: 'I understand, continue', locked: 'Total locked', nextUnlock: 'Next unlock: {{title}} needs {{amount}} more', goals: 'Vault goals', addGoal: 'Add a goal to the Vault', target: 'Target amount', priority: 'Priority from 1 to 5', emergency: 'Emergency fund', sampleRent: 'Rent reserve', enable: 'Use this goal', deposit: 'Send money to Vault', amount: 'Amount in FCFA', preview: 'Preview split', confirm: 'Confirm locked deposit', split: '{{amount}} to {{title}}', noGoals: 'Create a regular goal first, then return here.', loadError: 'Could not load your Vault.', exact: 'The full {{amount}} FCFA will be allocated exactly.',
  },
  sessions: {
    title: 'Devices and sessions', subtitle: 'See where you are signed in.', thisDevice: 'This device', lastActive: 'Last active {{when}}', signOut: 'Sign out', signOutOthers: 'Sign out all other devices',
    confirmOthers: 'Sign out every device except this one?', lock: 'Lock the app', lockAfter: 'Lock after', lockNow: 'Immediately', lock1: '1 minute', lock5: '5 minutes', empty: 'No other devices.',
    signedOut: 'Device signed out.', changePin: 'Change PIN',
  },
};
import { formsEn } from './ns/forms';
import { moneyEn } from './ns/money';
import { tabsEn } from './ns/tabs';

export const en = { ...base, ...tabsEn, ...formsEn, ...moneyEn };
export type Catalog = typeof en;
export type BaseCatalog = typeof base;
