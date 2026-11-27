export interface OnboardingValidationInput {
  isEdit: boolean;
  name: string;
  timezone: string;
  identity: string;
  idealLife: string;
  ambitions: string;
  priorities: Record<string, string>;
  active: Record<string, boolean>;
  obstacles: string;
  distractions: string;
  improve: string;
  planning: { daily: boolean; weekly: boolean; monthly: boolean };
  goals: { title: string; goal_type: string }[];
  routine: {
    work_start?: string;
    work_end?: string;
    reading_time?: string;
    exercise_days?: number[];
    exercise_time?: string;
  };
}

export interface OnboardingValidationResult {
  errorKey: string | null;
  missingFields: string[];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateOnboardingStep(
  step: number,
  data: OnboardingValidationInput,
): OnboardingValidationResult {
  switch (step) {
    case 0: {
      const missing: string[] = [];
      if (!data.name.trim()) missing.push('name');
      if (!data.timezone.trim()) missing.push('timezone');
      if (missing.includes('name')) return { errorKey: 'onboarding.errors.name', missingFields: missing };
      if (missing.includes('timezone')) return { errorKey: 'onboarding.errors.timezone', missingFields: missing };
      return { errorKey: null, missingFields: [] };
    }
    case 1: {
      const missing: string[] = [];
      if (!data.identity.trim()) missing.push('identity');
      if (!data.idealLife.trim()) missing.push('idealLife');
      if (!data.ambitions.trim()) missing.push('ambitions');
      if (missing.length > 0) return { errorKey: 'onboarding.errors.vision', missingFields: missing };
      return { errorKey: null, missingFields: [] };
    }
    case 2: {
      const hasAny = Object.values(data.priorities).some((v) => v.trim().length > 0);
      return hasAny
        ? { errorKey: null, missingFields: [] }
        : { errorKey: 'onboarding.errors.pillars', missingFields: ['pillars'] };
    }
    case 3: {
      const hasAny = Object.values(data.active).some(Boolean);
      return hasAny
        ? { errorKey: null, missingFields: [] }
        : { errorKey: 'onboarding.errors.areas', missingFields: ['areas'] };
    }
    case 4: {
      const missing: string[] = [];
      if (!data.obstacles.trim()) missing.push('obstacles');
      if (!data.distractions.trim()) missing.push('distractions');
      if (!data.improve.trim()) missing.push('improve');
      if (missing.length > 0) return { errorKey: 'onboarding.errors.challenges', missingFields: missing };
      return { errorKey: null, missingFields: [] };
    }
    case 5: {
      const p = data.planning;
      return p.daily || p.weekly || p.monthly
        ? { errorKey: null, missingFields: [] }
        : { errorKey: 'onboarding.errors.planning', missingFields: ['planning'] };
    }
    case 6: {
      if (data.isEdit) return { errorKey: null, missingFields: [] };
      const hasGoal = data.goals.some((g) => g.title.trim().length > 0);
      return hasGoal
        ? { errorKey: null, missingFields: [] }
        : { errorKey: 'onboarding.errors.goals', missingFields: ['goal0'] };
    }
    case 7: {
      const timeFields: ['work_start' | 'work_end' | 'reading_time' | 'exercise_time', string | undefined][] = [
        ['work_start', data.routine.work_start],
        ['work_end', data.routine.work_end],
        ['reading_time', data.routine.reading_time],
        ['exercise_time', data.routine.exercise_time],
      ];
      const invalidTime = timeFields.find(([, v]) => v && v.trim() && !TIME_RE.test(v.trim()));
      if (invalidTime) {
        return { errorKey: 'onboarding.errors.time', missingFields: [invalidTime[0]] };
      }
      const missing: string[] = [];
      for (const [k, v] of timeFields) {
        if (!v || !v.trim()) missing.push(k);
      }
      if ((data.routine.exercise_days ?? []).length === 0) missing.push('exercise_days');
      if (missing.length > 0) {
        return { errorKey: 'onboarding.errors.routine', missingFields: missing };
      }
      return { errorKey: null, missingFields: [] };
    }
    default:
      return { errorKey: null, missingFields: [] };
  }
}
