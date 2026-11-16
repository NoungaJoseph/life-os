import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { Dashboard, GoalView, InsightsPayload, Task } from './types';

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard/today') });
export const useGoalsOverview = () => useQuery({ queryKey: ['goals', 'overview'], queryFn: () => api<GoalView[]>('/goals-overview') });
export const useInsights = () => useQuery({ queryKey: ['insights'], queryFn: () => api<InsightsPayload>('/insights') });

/** Everything derived from tasks, habits or goals must refresh together so numbers never disagree. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => Promise.all(['dashboard', 'goals', 'insights', 'tasks', 'journal'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** One-tap task completion with an optimistic update. */
export function useToggleTask() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api<Task>(`/tasks/${id}`, { method: 'PATCH', body: { completed } }),
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: ['dashboard'] });
      const prev = qc.getQueryData<Dashboard>(['dashboard']);
      if (prev && completed) {
        qc.setQueryData<Dashboard>(['dashboard'], {
          ...prev,
          priorities: prev.priorities.filter((t) => t.id !== id),
          summary: { ...prev.summary, tasks_open: Math.max(0, prev.summary.tasks_open - 1), tasks_done_today: prev.summary.tasks_done_today + 1 },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['dashboard'], ctx.prev); },
    onSettled: () => { void refresh(); },
  });
}

/** One-tap habit completion for a date, optimistic on the dashboard. */
export function useToggleHabit() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, date, done }: { id: string; date: string; done: boolean }) =>
      api(`/habits/${id}/completions/${date}`, { method: done ? 'PUT' : 'DELETE' }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['dashboard'] });
      const prev = qc.getQueryData<Dashboard>(['dashboard']);
      if (prev) {
        const habits = prev.habits.map((h) => (h.id === id ? { ...h, stats: { ...h.stats, completed_today: done } } : h));
        qc.setQueryData<Dashboard>(['dashboard'], {
          ...prev, habits, summary: { ...prev.summary, habits_done: habits.filter((h) => h.stats.completed_today).length },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['dashboard'], ctx.prev); },
    onSettled: () => { void refresh(); },
  });
}
