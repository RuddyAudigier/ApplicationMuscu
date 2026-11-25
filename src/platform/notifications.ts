import { App } from '@capacitor/app';
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
const GROUP = 'mymuscle';
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

/** Vrai si l'autorisation d'afficher des notifications est accordée (natif uniquement). */
export async function reminderPermissionGranted(): Promise<boolean> {
  if (!isNative()) return false;
  return (await LocalNotifications.checkPermissions()).display === 'granted';
}

/** Appelle `cb` à chaque retour de l'appli au premier plan (natif uniquement). Retourne le désabonnement. */
export function onAppResume(cb: () => void): () => void {
  if (!isNative()) return () => undefined;
  const handle = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) cb();
  });
  return () => {
    void handle.then((h) => h.remove());
  };
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

let syncChain: Promise<void> = Promise.resolve();
let syncGeneration = 0;

/**
 * Annule les notifications en attente de l'appli puis programme `reminders`.
 * Appels sérialisés dans l'ordre ; seul le dernier appel en file s'exécute (les périmés sont ignorés).
 * `stillValid` : ids des rappels encore d'actualité, y compris ceux d'aujourd'hui déjà affichés
 * (absents de `reminders` une fois l'heure passée) ; les autres notifications affichées sont retirées.
 */
export function syncReminders(reminders: Reminder[], time: string, stillValid: number[] = reminders.map((r) => r.id)): Promise<void> {
  if (!isNative()) return Promise.resolve();
  const generation = ++syncGeneration;
  const run = syncChain.then(() => {
    if (generation !== syncGeneration) return;
    return doSync(reminders, time, stillValid);
  });
  // Une erreur ne casse pas la chaîne ; elle reste visible pour l'appelant via `run`.
  syncChain = run.catch(() => undefined);
  return run;
}

async function exactAlarmsAllowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return false;
  }
}

async function doSync(reminders: Reminder[], time: string, stillValid: number[]): Promise<void> {
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications });

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;

  // Retire du tiroir les rappels déjà affichés qui ne sont plus d'actualité (séance faite depuis).
  try {
    const keep = new Set(stillValid);
    const { notifications: shown } = await LocalNotifications.getDeliveredNotifications();
    const stale = shown.filter((n) => !keep.has(n.id));
    if (stale.length > 0) await LocalNotifications.removeDeliveredNotifications({ notifications: stale });
  } catch (e) {
    console.warn('[rappels] Nettoyage des notifications affichées impossible :', e);
  }

  if (reminders.length === 0) return;
  await setup();
  // Alarme exacte seulement si Android l'autorise déjà (USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM) :
  // sinon le plugin ouvrirait l'écran « Alarmes et rappels » à chaque synchro. Une alarme non exacte
  // peut être retardée de plusieurs minutes, voire plus, une fois l'appli fermée.
  const exact = await exactAlarmsAllowed();
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      largeBody: r.largeBody,
      schedule: { at: fireDate(r.date, time), allowWhileIdle: true, isExactNotification: exact },
      smallIcon: SMALL_ICON,
      iconColor: ICON_COLOR,
      group: GROUP,
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
