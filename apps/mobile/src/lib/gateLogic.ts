export interface GateInput {
  visualTutorial: boolean;
  loading: boolean;
  chosenLanguage: 'en' | 'fr' | null | undefined;
  introSeen: boolean | undefined;
  hasSession: boolean;
  hasPin: boolean | null;
  locked: boolean;
  profileLoading: boolean;
  onboardingCompleted: boolean | null;
  group: string | undefined;
}

export interface GateDecision {
  waiting: boolean;
  redirect: string | null;
}

export function resolveGateRoute(s: GateInput): GateDecision {
  if (s.visualTutorial) {
    return { waiting: false, redirect: null };
  }

  const checkingOnboarding =
    s.hasSession && !(s.hasPin && s.locked) && s.profileLoading && s.onboardingCompleted === null;

  if (
    s.loading ||
    s.chosenLanguage === undefined ||
    s.introSeen === undefined ||
    (s.hasSession && s.hasPin === null) ||
    checkingOnboarding
  ) {
    return { waiting: true, redirect: null };
  }

  if (s.chosenLanguage === null) {
    return { waiting: false, redirect: s.group === 'language' ? null : '/language' };
  }

  if (!s.hasSession) {
    if (!s.introSeen) {
      const allowed = s.group === 'tutorial' || s.group === 'language';
      return { waiting: false, redirect: allowed ? null : '/tutorial' };
    }
    const allowed = s.group === '(auth)' || s.group === 'language' || s.group === 'tutorial';
    return { waiting: false, redirect: allowed ? null : '/login' };
  }

  if (s.hasPin && s.locked) {
    return { waiting: false, redirect: s.group === 'unlock' ? null : '/unlock' };
  }

  if (s.onboardingCompleted === false) {
    const allowed = s.group === 'onboarding' || s.group === 'language';
    return { waiting: false, redirect: allowed ? null : '/onboarding' };
  }

  if (s.hasPin === false) {
    const allowed =
      s.group === 'create-pin' ||
      s.group === 'onboarding' ||
      s.group === 'tutorial' ||
      s.group === 'language';
    return { waiting: false, redirect: allowed ? null : '/create-pin' };
  }

  if (s.group === '(auth)' || s.group === 'unlock') {
    return { waiting: false, redirect: '/' };
  }

  return { waiting: false, redirect: null };
}
