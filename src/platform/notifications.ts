import { LocalNotifications } from '@capacitor/local-notifications';
import { useEffect, useRef } from 'react';
import type { Reminder } from '../domain/reminders';
import { isNative } from './native';

export interface ReminderPrefs {
  enabled: boolean;
  /** Heure locale d'envoi, 'HH:mm'. */
  time: string;
}

export const REMINDER_PREFS_EVENT = 'mymuscle:reminder-prefs';

const PREFS_KEY = 'reminder_prefs_v1';
const DEFAULT_TIME = '08:00';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const SESSION_CHANNEL = 'seances';
const SWITCH_CHANNEL = 'cycles';
const SESSION_ACTION_TYPE = 'session';
const START_ACTION = 'start';
const SMALL_ICON = 'ic_stat_mymuscle';
const ICON_COLOR = '#d4f53c';

/** Lecture tolérante : stockage indisponible ou contenu illisible → défauts. */
export function loadReminderPrefs(): ReminderPrefs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return { enabled: false, time: DEFAULT_TIME };
    const { enabled, time } = parsed as Record<string, unknown>;
    return {
      enabled: enabled === true,
      time: typeof time === 'string' && TIME_RE.test(time) ? time : DEFAULT_TIME,
    };
  } catch {
    return { enabled: false, time: DEFAULT_TIME };
  }
}

/** Enregistre (sans erreur si le stockage refuse) puis notifie les écouteurs de la session. */
export function saveReminderPrefs(p: ReminderPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Stockage refusé : le réglage reste appliqué pour la session via l'événement.
  }
  window.dispatchEvent(new Event(REMINDER_PREFS_EVENT));
}

export function remindersAvailable(): boolean {
  return isNative();
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
}

let setupDone = false;

/** Canaux et type d'action : créés une seule fois par exécution de l'appli. */
async function setup(): Promise<void> {
  if (setupDone) return;
  await LocalNotifications.createChannel({ id: SESSION_CHANNEL, name: 'Séances', importance: 4 });
  await LocalNotifications.createChannel({ id: SWITCH_CHANNEL, name: 'Cycles', importance: 4 });
  await LocalNotifications.registerActionTypes({
    types: [{ id: SESSION_ACTION_TYPE, actions: [{ id: START_ACTION, title: 'Démarrer la séance' }] }],
  });
  setupDone = true;
}

/** Date locale du rappel à l'heure `time` ('HH:mm'). */
function fireDate(date: string, time: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = (TIME_RE.test(time) ? time : DEFAULT_TIME).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Annule les notifications en attente de l'appli puis programme `reminders`. */
export async function syncReminders(reminders: Reminder[], time: string): Promise<void> {
  if (!isNative()) return;
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications });

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' || reminders.length === 0) return;

  await setup();
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      largeBody: r.largeBody,
      schedule: { at: fireDate(r.date, time), allowWhileIdle: true },
      smallIcon: SMALL_ICON,
      iconColor: ICON_COLOR,
      group: r.kind === 'session' ? SESSION_CHANNEL : SWITCH_CHANNEL,
      channelId: r.kind === 'session' ? SESSION_CHANNEL : SWITCH_CHANNEL,
      ...(r.kind === 'session' ? { actionTypeId: SESSION_ACTION_TYPE } : {}),
    })),
  });
}

/** Appelle `open` quand l'utilisateur touche une notification (ou son bouton « Démarrer »). */
export function useReminderTap(open: () => void): void {
  const ref = useRef(open);
  useEffect(() => {
    ref.current = open;
  }, [open]);
  useEffect(() => {
    if (!isNative()) return;
    const handle = LocalNotifications.addListener('localNotificationActionPerformed', () => {
      ref.current();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}
