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
  datePicker: { choose: 'Choose a date', previousMonth: 'Previous month', nextMonth: 'Next month', clear: 'Clear date', today: 'Today', time: 'Time', invalidDateTime: 'Choose a date and a valid time.' },
  timePicker: { choose: 'Choose a time', hour: 'Hour', minute: 'Minute', clear: 'Clear time' },
  guide: { title: 'App guide' },
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
    amount: 'Amount in FCFA', phone: 'Mobile Money number', phoneHint: '{{count}}/{{max}} digits (Cameroon)', invalidPhone: 'Enter a 9-digit Cameroon mobile number.', provider: 'Operator', sandbox: 'Sandbox', mtn: 'MTN MoMo', orange: 'Orange Money', suggested: '{{provider}} looks right for this number. You can change it.',
    submitDeposit: 'Request deposit', submitWithdrawal: 'Request withdrawal',
    submitDepositPaylink: 'Deposit with Nkwa Paylink', submitWithdrawalPaylink: 'Withdraw with Nkwa Paylink',
    paylinkNote: 'MTN MoMo and Orange Money deposits and withdrawals open a secure Nkwa Paylink to complete and confirm your transaction.',
    paylinkReady: 'Nkwa Paylink ready', paylinkBody: 'Complete your {{amount}} {{currency}} payment in the Nkwa Paylink page, then tap Check status.',
    openPaylink: 'Open Nkwa Paylink', sharePaylink: 'Share paylink', sharePaylinkMessage: 'Complete my {{amount}} {{currency}} payment on Nkwa Pay: {{url}}',
    checkStatus: 'Check payment status', pendingPaylinks: 'Active paylinks',
    statusUpdated: 'Payment status updated: {{status}}.', stillPending: 'Payment is still awaiting confirmation.',
    invalidAmount: 'Enter a whole amount above zero.', success: 'Request created.',
    status: { pending: 'Pending', processing: 'Processing', succeeded: 'Successful', failed: 'Failed', reversed: 'Reversed' },
    kind: { deposit: 'Deposit', withdrawal: 'Withdrawal', vault_transfer: 'Vault transfer', vault_release: 'Vault release', group_contribution: 'Group contribution', group_release: 'Group release', reversal: 'Reversal', adjustment: 'Adjustment' },
  },
  vault: {
    title: 'Goal Vault', subtitle: 'Locked savings for what matters', howTitle: 'How the Vault works', howBody: 'Money you send to the Vault is split across your goals and locked. You cannot withdraw it early. Each goal releases automatically to your wallet only when its target is reached.', acknowledge: 'I understand that this money stays locked until the goal is reached.', accept: 'I understand, continue', locked: 'Total locked', nextUnlock: 'Next unlock: {{title}} needs {{amount}} more', goals: 'Vault goals', addGoal: 'Add a goal to the Vault', createGoal: 'Create a goal', target: 'Target amount', priority: 'Priority from 1 to 5', emergency: 'Emergency fund', sampleRent: 'Rent reserve', enable: 'Use this goal', deposit: 'Send money to Vault', amount: 'Amount in FCFA', preview: 'Preview split', confirm: 'Confirm locked deposit', split: '{{amount}} to {{title}}', noGoals: 'No goals yet. Create one to start locking savings in your Vault.', loadError: 'Could not load your Vault.', exact: 'The full {{amount}} FCFA will be allocated exactly.',
  },
  groups: {
    title: 'Group savings', subtitle: 'Save together, keep what is yours', create: 'Create a group', join: 'Join with a code', empty: 'You have not joined a savings group yet.',
    name: 'Group name', amount: 'Contribution in FCFA', frequency: 'Frequency', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', start: 'Start date', end: 'End date', hideAmounts: 'Hide exact savings from other members',
    lockTitle: 'Your savings stay yours', lockBody: 'This is not a rotating payout group. Every member saves into their own locked share and receives their full savings at the end date. You cannot withdraw before then.', lockCheck: 'I understand my contributions stay locked until the end date.', createAction: 'Create locked savings group', code: 'Invite code', joinAction: 'Review and join', invalid: 'Check the group details and dates.',
    invite: 'Invite members', copyCode: 'Share this code: {{code}}', progress: 'Member progress', schedule: 'My contribution calendar', saved: '{{amount}} FCFA saved', hidden: 'Exact amount hidden', contribute: 'Pay this contribution', catchUp: 'Catch up', nudge: 'Send reminder', nudged: 'Reminder sent', due: 'Due', paid: 'Paid', late: 'Paid late', missed: 'Missed', endHint: 'Your full savings unlock on {{date}}.', details: 'Group details', noChat: 'No group chat. Progress and gentle reminders only.',
  },
  transformation: {
    title: 'Personal transformation', subtitle: 'Notice your progress with kindness and privacy', add: 'Add an area', empty: 'Start with one change that matters to you.', category: 'Life area', name: 'What would you like to work on?', current: 'Who I am now', target: 'Who I want to become', reason: 'Why this matters to me', save: 'Save my area', create: 'Create area', behavior: 'A concrete behavior', build: 'Build', quit: 'Leave behind', addBehavior: 'Add behavior', behaviors: 'My behaviors', checkin: 'Weekly check-in', currentScore: 'Where I am today (1–10)', targetScore: 'Where I want to be (1–10)', note: 'What changed this week?', saveCheckin: 'Save check-in', history: 'My progress', days: '{{count}} days', best: 'Best streak: {{count}} days', urges: 'I had an urge', relapse: 'I slipped', success: 'I kept my promise', trigger: 'What triggered this? (optional)', breathe: 'Take a breath. Pause for 60 seconds, then remember why this matters to you.', noShame: 'A slip does not erase your progress. You can begin again today.', record: 'Record privately', linked: 'Link to an existing goal or habit later', linkGoal: 'Link a goal (optional)', linkHabit: 'Link a habit (optional)', none: 'None',
    preview: { title: 'Make room for rest', current: 'I often work late', target: 'I close my day with care', reason: 'I want energy for family and work', behavior: 'Put my phone away at bedtime' },
    categories: { relationships: 'Relationships', addictions: 'Habits to leave behind', health: 'Health', finance: 'Finances', character: 'Character' },
    templates: {
      relationships: ['Listen without interrupting', 'Make time for family', 'Speak honestly with my partner', 'Reconnect with a friend', 'Set a gentle boundary'],
      addictions: ['Stay away from smoking', 'Choose alcohol-free days', 'Step away from pornography', 'Pause before gambling', 'Use social media intentionally'],
      health: ['Move a little each day', 'Sleep at a steady time', 'Eat a nourishing meal', 'Drink enough water', 'Make room for rest'],
      finance: ['Track spending', 'Save a small amount', 'Pause before buying', 'Plan my weekly budget', 'Reduce one debt'],
      character: ['Keep my word', 'Practice patience', 'Speak with kindness', 'Learn from mistakes', 'Finish what I start'],
    },
  },
  screenTime: {
    title: 'Screen time', subtitle: 'Make room for what matters', unavailable: 'App blocking needs an installed development build.', permission: 'Blocking works only while usage access and accessibility permissions remain enabled. You can turn them off in phone settings. Usage access reads time spent in each app. Accessibility detects only which app is open and shows your block screen; it does not read screen content.', ios: 'iPhone blocking needs the Family Controls entitlement from Apple. It is not enabled in this build.', usageAccess: 'Allow usage access', accessibility: 'Allow accessibility service', apps: 'Choose an app', identifier: 'App package name', name: 'App name', limit: 'Daily limit in minutes', duration: 'Block for', hour: '1 hour', twoHours: '2 hours', commitment: 'Commitment mode', commitmentHint: 'While a block is active, you cannot weaken this rule in the app. Phone settings can still turn off permissions.', add: 'Add app limit', empty: 'No app limits yet. Start with one app that takes more time than you want.', today: 'Today', week: 'This week', minutes: '{{count}} min', startBlock: 'Start block', activeUntil: 'Blocked until {{time}}', enabled: 'Enabled', disabled: 'Paused', pause: 'Pause limit', resume: 'Resume limit', stats: 'Usage by app', save: 'Save limit', remove: 'Remove limit', select: 'Select an installed app', sync: 'Refresh usage', unsupported: 'Usage data is available on Android after granting permission.', error: 'Could not save your screen-time settings.'
  },
  sessions: {
    title: 'Devices and sessions', subtitle: 'See where you are signed in.', thisDevice: 'This device', lastActive: 'Last active {{when}}', signOut: 'Sign out', signOutOthers: 'Sign out all other devices',
    confirmOthers: 'Sign out every device except this one?', lock: 'Lock the app', lockAfter: 'Lock after', lockNow: 'Immediately', lock1: '1 minute', lock5: '5 minutes', empty: 'No other devices.',
    signedOut: 'Device signed out.', changePin: 'Change PIN',
  },
  eveningCheckin: {
    eyebrow: 'DAILY RUNDOWN', title: 'Evening check-in', subtitle: '{{date}} · Bedtime by 23:00', step: 'Step {{current}} of {{total}}',
    popupEyebrow: '10 PM CHECK-IN', popupTitle: 'Time for your daily rundown',
    popupCountdown: '{{minutes}} min left before your 11:00 PM bedtime. Let us check your habits, goals, spending and income.',
    popupPastBedtime: 'It is past your 11:00 PM bedtime window. Do a quick check-in before sleeping.',
    startNow: 'Start check-in now', snooze15: 'Remind me in 15 min', dismissTonight: 'Skip for tonight',
    notifTitle: 'Daily rundown (10:00 PM)', notifBody: 'Check off today’s habits, goals, spending and income before 11:00 PM.',
    steps: { habits: 'Daily habits', goals: 'Goals & tasks', expenses: 'Spending', income: 'New income', reflect: 'Reflection' },
    qHabits: 'Which of today’s habits did you complete?', habitsCount: '{{done}} of {{total}} completed',
    noHabits: 'No habits scheduled for today.', habitDone: 'Done', habitPending: 'Pending',
    qGoals: 'Did you move your goals and tasks forward today?', openTasks: 'Today’s open tasks', noOpenTasks: 'All tasks for today are cleared.',
    activeGoals: 'Active goals', noActiveGoals: 'No active goals yet.', updateValue: 'Update current value',
    saveGoal: 'Save progress', markGoalDone: 'Mark completed', goalSaved: 'Progress saved',
    qExpenses: 'How much did you spend today?', spentToday: 'Total spent today', noExpensesToday: 'No expenses logged today yet.',
    expenseAmount: 'Amount spent', expenseCategory: 'Category', expenseDesc: 'What did you spend on?',
    expenseDescPlaceholder: 'e.g. Lunch, transport, groceries', addExpense: 'Add expense', invalidAmount: 'Enter an amount above zero.',
    qIncome: 'Did you receive any new income today?', incomeToday: 'Total income today', noIncomeToday: 'No income logged today yet.',
    incomeAmount: 'Amount received', incomeSource: 'Source', incomeSourcePlaceholder: 'e.g. Client payment, salary, sale',
    incomeCategory: 'Category (optional)', addIncome: 'Add income',
    qReflect: 'Before you sleep by 11 PM, wrap up your day.', dayRating: 'How did today go?',
    winsLabel: 'What went well today?', lessonsLabel: 'What did you learn or want to adjust?', tomorrowLabel: 'Top priorities for tomorrow',
    complete: 'Complete rundown', completedTitle: 'Rundown complete', completedBody: 'Great job reviewing your day. Rest well before 11:00 PM.',
    backHome: 'Back to Home', next: 'Next', skipStep: 'Nothing to add, next',
  },
};
import { formsEn } from './ns/forms';
import { moneyEn } from './ns/money';
import { tabsEn } from './ns/tabs';
import { savingsEn } from './ns/savings';

export const en = { ...base, ...tabsEn, ...formsEn, ...moneyEn, ...savingsEn };
export type Catalog = typeof en;
export type BaseCatalog = typeof base;
