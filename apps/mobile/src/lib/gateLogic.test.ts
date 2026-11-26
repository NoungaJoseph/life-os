import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGateRoute } from './gateLogic';

const base = {
  visualTutorial: false,
  loading: false,
  chosenLanguage: 'en' as const,
  introSeen: true,
  hasSession: false,
  hasPin: null,
  locked: false,
  profileLoading: false,
  onboardingCompleted: null,
  group: undefined,
};

test('fresh install routes /language -> /tutorial -> /login in order', () => {
  assert.equal(resolveGateRoute({ ...base, chosenLanguage: null, introSeen: false }).redirect, '/language');
  assert.equal(resolveGateRoute({ ...base, chosenLanguage: null, introSeen: false, group: 'language' }).redirect, null);
  assert.equal(resolveGateRoute({ ...base, chosenLanguage: 'fr', introSeen: false }).redirect, '/tutorial');
  assert.equal(resolveGateRoute({ ...base, chosenLanguage: 'fr', introSeen: true }).redirect, '/login');
});

test('signed-out user can browse /language or /tutorial without being bounced back to /login', () => {
  assert.equal(resolveGateRoute({ ...base, group: 'language' }).redirect, null);
  assert.equal(resolveGateRoute({ ...base, group: 'tutorial' }).redirect, null);
});

test('newly registered user with incomplete onboarding is sent to /onboarding (never / or /create-pin)', () => {
  const d = resolveGateRoute({
    ...base,
    hasSession: true,
    hasPin: false,
    onboardingCompleted: false,
    group: '(auth)',
  });
  assert.equal(d.redirect, '/onboarding');

  const stay = resolveGateRoute({
    ...base,
    hasSession: true,
    hasPin: false,
    onboardingCompleted: false,
    group: 'onboarding',
  });
  assert.equal(stay.redirect, null);
});

test('user who completes onboarding with no PIN goes to /create-pin unless on /tutorial', () => {
  assert.equal(
    resolveGateRoute({ ...base, hasSession: true, hasPin: false, onboardingCompleted: true, group: '(tabs)' }).redirect,
    '/create-pin',
  );
  assert.equal(
    resolveGateRoute({ ...base, hasSession: true, hasPin: false, onboardingCompleted: true, group: 'tutorial' }).redirect,
    null,
  );
});

test('returning user with PIN unlocks first and then lands on /', () => {
  assert.equal(
    resolveGateRoute({ ...base, hasSession: true, hasPin: true, locked: true, group: '(tabs)' }).redirect,
    '/unlock',
  );
  assert.equal(
    resolveGateRoute({ ...base, hasSession: true, hasPin: true, locked: false, onboardingCompleted: true, group: 'unlock' }).redirect,
    '/',
  );
});

test('waits while session profile onboarding state is loading on an unlocked session', () => {
  const d = resolveGateRoute({
    ...base,
    hasSession: true,
    hasPin: false,
    profileLoading: true,
    onboardingCompleted: null,
  });
  assert.equal(d.waiting, true);
  assert.equal(d.redirect, null);
});
