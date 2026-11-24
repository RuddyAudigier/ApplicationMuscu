import { useEffect, useState } from 'react';
import { useCycleState, usePerformances, useSessions, useWeekPlan } from '@/data/queries';
import { defaultCycleState } from '@/domain/cycles';
import { todayIso } from '@/domain/dates';
import { emptyWeekPlan } from '@/domain/planning';
import { planReminders } from '@/domain/reminders';
import {
  loadReminderPrefs,
  REMINDER_PREFS_EVENT,
  remindersAvailable,
  syncReminders,
  type ReminderPrefs,
} from '@/platform/notifications';

/** Reprogramme les notifications locales quand la semaine type, les séances, le cycle ou les préférences changent. */
export function useReminderSync(): void {
  const available = remindersAvailable();
  const plan = useWeekPlan();
  const sessions = useSessions();
  const cycle = useCycleState();
  const perfs = usePerformances();
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => loadReminderPrefs());

  useEffect(() => {
    if (!available) return;
    const reload = () => { setPrefs(loadReminderPrefs()); };
    window.addEventListener(REMINDER_PREFS_EVENT, reload);
    return () => { window.removeEventListener(REMINDER_PREFS_EVENT, reload); };
  }, [available]);

  const planData = plan.data;
  const sessionsData = sessions.data;
  const cycleData = cycle.data;
  const perfsData = perfs.data;
  const ready = plan.isSuccess && sessions.isSuccess && cycle.isSuccess && perfs.isSuccess;

  useEffect(() => {
    if (!available || !ready || !sessionsData || !perfsData) return;
    const run = async () => {
      if (!prefs.enabled) {
        await syncReminders([], prefs.time);
        return;
      }
      const today = todayIso();
      const now = new Date();
      const [hh = 0, mm = 0] = prefs.time.split(':').map(Number);
      const reminders = planReminders({
        plan: planData ?? emptyWeekPlan(),
        sessions: sessionsData,
        cycleState: cycleData ?? defaultCycleState(today),
        perfs: perfsData,
        today,
        nowMinutes: now.getHours() * 60 + now.getMinutes(),
        timeMinutes: hh * 60 + mm,
      });
      await syncReminders(reminders, prefs.time);
    };
    run().catch((e: unknown) => { console.warn('[rappels] Synchronisation impossible :', e); });
  }, [available, ready, planData, sessionsData, cycleData, perfsData, prefs]);
}
