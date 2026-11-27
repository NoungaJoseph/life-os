import assert from 'node:assert/strict';
import test from 'node:test';
import { OnboardingValidationInput, validateOnboardingStep } from './onboardingValidation';

const empty: OnboardingValidationInput = {
  isEdit: false,
  name: '',
  timezone: '',
  identity: '',
  idealLife: '',
  ambitions: '',
  priorities: {},
  active: {},
  obstacles: '',
  distractions: '',
  improve: '',
  planning: { daily: false, weekly: false, monthly: false },
  goals: [{ title: '', goal_type: 'long_term' }],
  routine: {},
};

const filled: OnboardingValidationInput = {
  isEdit: false,
  name: 'Nounga',
  timezone: 'Africa/Douala',
  identity: 'Consistent builder',
  idealLife: 'Focused and balanced',
  ambitions: 'Launch and scale',
  priorities: { health: 'Stay active' },
  active: { area1: true },
  obstacles: 'Late nights',
  distractions: 'Social media',
  improve: 'Morning focus',
  planning: { daily: true, weekly: false, monthly: false },
  goals: [{ title: 'Save 500k', goal_type: 'annual' }],
  routine: {
    work_start: '08:00',
    work_end: '17:00',
    reading_time: '20:30',
    exercise_days: [1, 3, 5],
    exercise_time: '06:30',
  },
};

test('every onboarding step rejects empty required fields', () => {
  for (let step = 0; step < 8; step++) {
    const res = validateOnboardingStep(step, empty);
    assert.ok(res.errorKey, `step ${step} should return an errorKey`);
    assert.ok(res.missingFields.length > 0, `step ${step} should flag missingFields`);
  }
});

test('every onboarding step passes when required fields are completed', () => {
  for (let step = 0; step < 8; step++) {
    const res = validateOnboardingStep(step, filled);
    assert.equal(res.errorKey, null, `step ${step} should pass`);
    assert.deepEqual(res.missingFields, []);
  }
});

test('step 6 allows empty goals when editing existing setup and step 7 rejects bad time format', () => {
  assert.deepEqual(validateOnboardingStep(6, { ...empty, isEdit: true }), { errorKey: null, missingFields: [] });
  assert.deepEqual(
    validateOnboardingStep(7, { ...filled, routine: { ...filled.routine, work_start: '99:99' } }),
    { errorKey: 'onboarding.errors.time', missingFields: ['work_start'] },
  );
});
