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
