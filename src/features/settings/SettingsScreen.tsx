import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  archiveCount,
  flush,
  OFFLINE_QUEUE_CORRUPT_KEY,
  OFFLINE_QUEUE_FAILED_KEY,
  queryKeys,
  useBackend,
  useCycleState,
  useOfflineQueueStatus,
  useResetBackend,
  useSaveCycleState,
} from '@/data/queries';
import { currentBlock, defaultCycleState } from '@/domain/cycles';
import { compareIso, todayIso } from '@/domain/dates';
import type { CycleId, CycleState } from '@/domain/model';
import { Button, Field, IconButton, Segmented, Sheet, Skeleton, useToast } from '@/ui';
import { applyPreferences, loadPreferences, savePreferences, type DisplayPreferences, type FontScale } from './preferences';
import { plural, safeStorage, syncMessage } from './settingsModel';
import styles from './SettingsScreen.module.css';

const CYCLE_OPTIONS: { value: CycleId; label: string }[] = [
  { value: 'A', label: 'Cycle A' },
  { value: 'B', label: 'Cycle B' },
];

const SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: '100', label: 'Normal' },
  { value: '110', label: 'Grand' },
  { value: '120', label: 'Très grand' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>{title}</h2>
      <div className={styles.card}>{children}</div>
    </section>
  );
}

/* ---------- Cycle en cours ---------- */

function CycleForm({ initial }: { initial: CycleState }) {
  const toast = useToast();
  const save = useSaveCycleState();
  const [current, setCurrent] = useState<CycleId>(initial.current);
  const [startedOn, setStartedOn] = useState(initial.startedOn);
  const [error, setError] = useState<string | undefined>();
  const today = todayIso();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!startedOn) {
      setError('Choisis une date de début.');
      return;
    }
    if (compareIso(startedOn, today) > 0) {
      setError('La date de début ne peut pas être dans le futur.');
      return;
    }
    setError(undefined);
    save.mutate({ ...initial, current, startedOn }, {
      onSuccess: () => { toast.show('Cycle enregistré.', 'success'); },
      onError: () => { toast.show('Le cycle n’a pas pu être enregistré. Réessaie.', 'error'); },
    });
  };

  return (
    <form className={styles.stack} onSubmit={submit} noValidate>
      <p className={styles.text}>
        Corrige ici le cycle en cours si l’appli s’est trompée. La durée ({String(initial.weeks)} semaines) se règle dans
        Programme.
      </p>
      <Segmented label="Cycle courant" options={CYCLE_OPTIONS} value={current} onChange={setCurrent} className={styles.segmented} />
      <Field
        label="Début du cycle"
        type="date"
        value={startedOn}
        max={today}
        error={error}
        onChange={(e) => { setStartedOn(e.target.value); }}
      />
      <Button type="submit" variant="accent" fullWidth loading={save.isPending}>
        Enregistrer le cycle
      </Button>
    </form>
  );
}

function CycleSection() {
  const query = useCycleState();
  let body: ReactNode;
  if (query.isPending) body = <Skeleton height={180} />;
  else if (query.isError) {
    // Pas de formulaire sur des valeurs par défaut : il écraserait l'état réel (durée prolongée…).
    body = <p className={styles.warning}>Le cycle n’a pas pu être chargé. Vérifie ta connexion puis rouvre cet écran.</p>;
  } else {
    // Bloc réel d'aujourd'hui : un état stocké périmé (bascule automatique passée) n'est pas reproposé tel quel.
    const today = todayIso();
    body = <CycleForm initial={currentBlock(query.data ?? defaultCycleState(today), today)} />;
  }
  return <Section title="Cycle en cours">{body}</Section>;
}

/* ---------- Hors-ligne ---------- */

function OfflineSection() {
  const { performances } = useBackend();
  const client = useQueryClient();
  const toast = useToast();
  const status = useOfflineQueueStatus();
  const [syncing, setSyncing] = useState(false);
  // Détail des archives (le statut les additionne) ; relu à chaque rendu, donc à chaque changement de statut.
  const storage = safeStorage();
  const archived = storage ? archiveCount(storage, OFFLINE_QUEUE_FAILED_KEY) : 0;
  const corruptArchived = storage ? archiveCount(storage, OFFLINE_QUEUE_CORRUPT_KEY) : 0;

  const sync = async () => {
    setSyncing(true);
    try {
      const { text, kind } = syncMessage(await flush(performances));
      toast.show(text, kind);
    } catch (e) {
      console.error('[offline] Synchronisation manuelle impossible :', e);
      // Le flush a pu s'arrêter après des envois réussis : on ne connaît pas le décompte exact.
      toast.show(
        'La synchronisation s’est interrompue (stockage de l’appareil). Une partie a pu être envoyée ; le reste est conservé.',
        'error',
      );
    } finally {
      // Toujours recharger : même un flush interrompu peut avoir écrit côté serveur.
      void client.invalidateQueries({ queryKey: queryKeys.performances });
      setSyncing(false);
    }
  };

  return (
    <Section title="Hors-ligne">
      <div className={styles.stack}>
        {!status.corrupt && (
          <p className={styles.row}>
            <span className={styles.big}>{String(status.pending)}</span>
            <span className={styles.text}>
              {status.pending === 0
                ? 'Aucune donnée en attente.'
                : `${plural(status.pending, 'lot', 'lots')} en attente d’envoi.`}
            </span>
          </p>
        )}
        {status.corrupt && (
          <p className={styles.warning}>
            La file d’attente est illisible : elle est conservée telle quelle et rien n’est envoyé. Les séries qu’elle
            contient ne peuvent pas être récupérées automatiquement.
          </p>
        )}
        {archived > 0 && (
          <p className={styles.warning}>
            {plural(archived, 'élément archivé', 'éléments archivés')} à vérifier (refusés, incertains ou bloqués). Ils
            sont conservés sur cet appareil et ne sont pas renvoyés automatiquement : un envoi incertain a pu être
            enregistré malgré tout. Vérifie tes records et ressaisis ce qui manque.
          </p>
        )}
        {corruptArchived > 0 && (
          <p className={styles.warning}>
            {plural(corruptArchived, 'sauvegarde illisible', 'sauvegardes illisibles')} de l’ancienne file, conservée
            telle quelle : son contenu ne peut pas être relu automatiquement.
          </p>
        )}
        <Button
          variant="secondary"
          fullWidth
          loading={syncing}
          disabled={status.pending === 0 || status.corrupt}
          onClick={() => { void sync(); }}
        >
          Synchroniser
        </Button>
      </div>
    </Section>
  );
}

/* ---------- Affichage ---------- */

function DisplaySection() {
  const toast = useToast();
  const motionId = useId();
  const [prefs, setPrefs] = useState<DisplayPreferences>(() => loadPreferences());

  const update = (next: DisplayPreferences) => {
    setPrefs(next);
    applyPreferences(next);
    if (!savePreferences(next)) toast.show('Réglage appliqué, mais il n’a pas pu être mémorisé sur cet appareil.', 'error');
  };

  return (
    <Section title="Affichage">
      <div className={styles.stack}>
        <div className={styles.row}>
          <span className={styles.label} id={motionId}>Réduire les animations</span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.reduceMotion}
            aria-labelledby={motionId}
            className={styles.switch}
            onClick={() => { update({ ...prefs, reduceMotion: !prefs.reduceMotion }); }}
          >
            <span className={styles.knob} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Taille du texte</span>
          <Segmented
            label="Taille du texte"
            options={SCALE_OPTIONS}
            value={prefs.fontScale}
            onChange={(fontScale) => { update({ ...prefs, fontScale }); }}
            className={styles.segmented}
          />
        </div>
      </div>
    </Section>
  );
}

/* ---------- Données ---------- */

function DataSection() {
  const backend = useBackend();
  const reset = useResetBackend();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const descId = useId();
  const isMock = backend.kind === 'mock';

  const confirm = () => {
    setConfirming(false);
    reset.mutate(undefined, {
      onSuccess: () => {
        // La file hors-ligne vient d'être vidée par le reset : relance la lecture du statut (même onglet).
        window.dispatchEvent(new StorageEvent('storage'));
        toast.show('Données de démo réinitialisées.', 'success');
      },
      onError: () => { toast.show('La réinitialisation a échoué. Les données n’ont pas changé.', 'error'); },
    });
  };

  return (
    <Section title="Données">
      <div className={styles.stack}>
        <p className={styles.row}>
          <span className={styles.badge}>{isMock ? 'Mock' : 'Supabase'}</span>
          <span className={styles.text}>
            {isMock
              ? 'Mode démo : données fictives stockées sur cet appareil uniquement.'
              : 'Données synchronisées avec Supabase.'}
          </span>
        </p>
        {isMock && (
          <Button variant="danger" fullWidth loading={reset.isPending} onClick={() => { setConfirming(true); }}>
            Réinitialiser les données de démo
          </Button>
        )}
      </div>
      <Sheet
        open={confirming}
        onClose={() => { setConfirming(false); }}
        title="Réinitialiser les données de démo ?"
        role="alertdialog"
        aria-describedby={descId}
        footer={
          <div className={styles.actions}>
            <Button variant="secondary" fullWidth onClick={() => { setConfirming(false); }}>Annuler</Button>
            <Button variant="danger" fullWidth onClick={confirm}>Réinitialiser</Button>
          </div>
        }
      >
        <p id={descId} className={styles.text}>
          Séances, exercices et performances de démo reviennent à leur état initial, et la file hors-ligne (lots en
          attente et archives) est vidée. Ce que tu as saisi en mode démo sera perdu.
        </p>
      </Sheet>
    </Section>
  );
}

/* ---------- Écran ---------- */

export function SettingsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  /* Ouvert directement (lien, rechargement) : pas d’historique interne, retour à l’accueil. */
  const goBack = () => {
    if (location.key === 'default') void navigate('/');
    else void navigate(-1);
  };
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <IconButton icon="back" label="Retour" className={styles.back} onClick={goBack} />
        <h1 className={styles.title}>Réglages</h1>
      </header>
      <CycleSection />
      <OfflineSection />
      <DisplaySection />
      <DataSection />
      <Section title="À propos">
        <p className={styles.text}>
          MyMuscle suit la méthode fontesque : deux cycles A/B alternés toutes les deux semaines, une tentative de PR
          choisie avant chaque série, et des séries modulables selon la forme du jour.
        </p>
      </Section>
    </div>
  );
}
