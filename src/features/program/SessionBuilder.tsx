import { useId, useMemo, useState } from 'react';
import { useDeleteSession, useExercises, useJournal, useSaveSession, useSessions } from '@/data/queries';
import type { CycleId, Exercise, Id, Session } from '@/domain/model';
import { normalizeSearch } from '@/domain/names';
import { Button, ConfirmDialog, Field, Icon, IconButton, Segmented, Sheet, useToast } from '@/ui';
import { loadActiveWorkout, saveActiveWorkout, useJournalSync } from '@/features/workout';
import { DEFAULT_SERIES, MAX_SERIES, MIN_SERIES, isDuplicateName } from './programModel';
import styles from './SessionBuilder.module.css';

interface Item { exerciseId: Id; name: string; series: number }

export interface SessionBuilderProps {
  /** Séance modifiée, `null` pour une création. */
  session: Session | null;
  /** Cycle proposé pour une nouvelle séance (onglet affiché). */
  defaultCycle: CycleId;
  onClose: () => void;
}

const CYCLE_OPTIONS = [
  { value: 'A' as const, label: 'Cycle A' },
  { value: 'B' as const, label: 'Cycle B' },
];

const SERIES_OPTIONS = Array.from({ length: MAX_SERIES - MIN_SERIES + 1 }, (_, i) => {
  const n = String(MIN_SERIES + i);
  return { value: n, label: n };
});

const clampSeries = (n: number): number => Math.min(MAX_SERIES, Math.max(MIN_SERIES, n));

const matches = (exercise: Exercise, query: string): boolean => {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(exercise.name).includes(q) || exercise.muscleGroups.some((m) => normalizeSearch(m).includes(q));
};

/** Constructeur de séance (création / modification / suppression) dans un panneau du bas. */
export function SessionBuilder({ session, defaultCycle, onClose }: SessionBuilderProps) {
  const toast = useToast();
  const exercisesQuery = useExercises();
  const sessionsQuery = useSessions();
  const save = useSaveSession();
  const remove = useDeleteSession();
  const journalQuery = useJournal();
  const syncJournal = useJournalSync();
  const [name, setName] = useState(session?.name ?? '');
  const [cycle, setCycle] = useState<CycleId>(session?.cycle ?? defaultCycle);
  const [items, setItems] = useState<Item[]>(
    () => session?.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, series: clampSeries(e.series) })) ?? [],
  );
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = useId();

  // Échauffement : `null` = non touché (valeur du journal), sinon sélection ordonnée de ids du catalogue.
  const catalog = journalQuery.data?.warmups.catalog ?? [];
  const storedWarmup = session ? (journalQuery.data?.warmups.bySession[session.id] ?? []) : [];
  const [pickedWarmup, setPickedWarmup] = useState<Id[] | null>(null);
  const warmupIds = pickedWarmup ?? storedWarmup.filter((id) => catalog.some((w) => w.id === id));
  const warmupOrder = [
    ...warmupIds.flatMap((id) => catalog.find((w) => w.id === id) ?? []),
    ...catalog.filter((w) => !warmupIds.includes(w.id)),
  ];

  const toggleWarmup = (id: Id) => {
    setPickedWarmup(warmupIds.includes(id) ? warmupIds.filter((x) => x !== id) : [...warmupIds, id]);
  };
  const moveWarmup = (index: number, delta: -1 | 1) => {
    const next = [...warmupIds];
    const a = next[index];
    const b = next[index + delta];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[index + delta] = a;
    setPickedWarmup(next);
  };

  const library = exercisesQuery.data;
  const results = useMemo(() => (library ?? []).filter((e) => matches(e, query)), [library, query]);
  const duplicate = isDuplicateName(sessionsQuery.data ?? [], name, cycle, session?.id ?? null);
  const nameError = !submitted
    ? undefined
    : !name.trim()
      ? 'Donne un nom à la séance.'
      : duplicate
        ? `Une séance du cycle ${cycle} porte déjà ce nom.`
        : undefined;
  const renamed = session !== null && name.trim() !== '' && name.trim() !== session.name;
  const isActive = session !== null && loadActiveWorkout()?.sessionId === session.id;
  const itemsError = submitted && items.length === 0 ? 'Ajoute au moins un exercice.' : undefined;

  const toggle = (exercise: Exercise) => {
    setItems((list) =>
      list.some((i) => i.exerciseId === exercise.id)
        ? list.filter((i) => i.exerciseId !== exercise.id)
        : [...list, { exerciseId: exercise.id, name: exercise.name, series: DEFAULT_SERIES }],
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    setItems((list) => {
      const target = index + delta;
      const a = list[index];
      const b = list[target];
      if (!a || !b) return list;
      const next = [...list];
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const setSeries = (index: number, series: number) => {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, series } : item)));
  };

  const removeAt = (index: number) => {
    setItems((list) => list.filter((_, i) => i !== index));
  };

  const onSave = () => {
    setSubmitted(true);
    if (!name.trim() || duplicate || items.length === 0) return;
    save.mutate(
      {
        id: session?.id ?? null,
        draft: { name: name.trim(), cycle, exercises: items.map((i) => ({ exerciseId: i.exerciseId, series: i.series })) },
      },
      {
        onSuccess: (saved) => {
          // Après la séance : un échec du journal ne la remet pas en cause.
          const finish = (): void => {
            toast.show(session ? 'Séance modifiée.' : 'Séance créée.', 'success');
            onClose();
          };
          if (pickedWarmup === null) {
            finish();
            return;
          }
          void syncJournal((j) => ({
            ...j,
            warmups: { ...j.warmups, bySession: { ...j.warmups.bySession, [saved.id]: pickedWarmup } },
          })).then((ok) => {
            if (ok) finish();
            else {
              toast.show('Séance enregistrée, mais pas son échauffement. Modifie la séance pour réessayer.', 'error');
              onClose();
            }
          });
        },
        onError: () => {
          toast.show('La séance n’a pas pu être enregistrée. Vérifie ta connexion et réessaie.', 'error');
        },
      },
    );
  };

  const onDelete = () => {
    if (!session) return;
    remove.mutate(session.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        if (isActive) saveActiveWorkout(null);
        toast.show('Séance supprimée.', 'success');
        onClose();
      },
      onError: () => {
        setConfirmDelete(false);
        toast.show('La séance n’a pas pu être supprimée. Vérifie ta connexion et réessaie.', 'error');
      },
    });
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={session ? 'Modifier la séance' : 'Nouvelle séance'}
        footer={
          <>
            {session && (
              <Button variant="danger" size="lg" icon="trash" onClick={() => { setConfirmDelete(true); }}>
                Supprimer
              </Button>
            )}
            <Button variant="accent" size="lg" loading={save.isPending} onClick={onSave}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Field
            label="Nom de la séance"
            placeholder="Ex : Haut du corps"
            value={name}
            maxLength={80}
            error={nameError}
            hint={renamed ? 'Les performances déjà enregistrées sous l’ancien nom seront renommées aussi.' : undefined}
            onChange={(e) => { setName(e.target.value); }}
          />

          <div className={styles.group}>
            <span className={styles.groupLabel} aria-hidden="true">Cycle</span>
            <Segmented label="Cycle de la séance" options={CYCLE_OPTIONS} value={cycle} onChange={setCycle} />
          </div>

          <section className={styles.group} aria-labelledby={`${ids}-composition`}>
            <h3 className={styles.groupLabel} id={`${ids}-composition`}>
              Composition ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className={itemsError ? styles.error : styles.muted} role={itemsError ? 'alert' : undefined}>
                {itemsError ?? 'Ta séance est vide : ajoute des exercices ci-dessous.'}
              </p>
            ) : (
              <ol className={styles.items}>
                {items.map((item, index) => (
                  <li key={item.exerciseId} className={styles.item}>
                    <div className={styles.itemHead}>
                      <span className={styles.itemIndex} aria-hidden="true">{index + 1}</span>
                      <span className={styles.itemName}>{item.name}</span>
                      <IconButton
                        icon="chevron"
                        label={`Monter ${item.name}`}
                        className={styles.up}
                        disabled={index === 0}
                        onClick={() => { move(index, -1); }}
                      />
                      <IconButton
                        icon="chevron"
                        label={`Descendre ${item.name}`}
                        className={styles.down}
                        disabled={index === items.length - 1}
                        onClick={() => { move(index, 1); }}
                      />
                      <IconButton icon="x" label={`Retirer ${item.name}`} onClick={() => { removeAt(index); }} />
                    </div>
                    <Segmented
                      label={`Séries prévues pour ${item.name}`}
                      options={SERIES_OPTIONS}
                      value={String(item.series)}
                      onChange={(v) => { setSeries(index, Number(v)); }}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={styles.group} aria-labelledby={`${ids}-warmup`}>
            <h3 className={styles.groupLabel} id={`${ids}-warmup`}>Échauffement ({warmupIds.length})</h3>
            {catalog.length === 0 ? (
              <p className={styles.muted}>Crée tes échauffements dans Programme → Échauffements.</p>
            ) : (
              <ul className={styles.items}>
                {warmupOrder.map((w) => {
                  const index = warmupIds.indexOf(w.id);
                  const checked = index >= 0;
                  return (
                    <li key={w.id} className={styles.warmupRow}>
                      <label className={styles.warmupLabel}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => { toggleWarmup(w.id); }}
                        />
                        <span className={styles.libraryText}>
                          <span>{w.name}</span>
                          {w.detail !== '' && <span className={styles.muscles}>{w.detail}</span>}
                        </span>
                      </label>
                      {checked && (
                        <>
                          <IconButton
                            icon="chevron"
                            label={`Monter ${w.name}`}
                            className={styles.up}
                            disabled={index === 0}
                            onClick={() => { moveWarmup(index, -1); }}
                          />
                          <IconButton
                            icon="chevron"
                            label={`Descendre ${w.name}`}
                            className={styles.down}
                            disabled={index === warmupIds.length - 1}
                            onClick={() => { moveWarmup(index, 1); }}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.group} aria-labelledby={`${ids}-library`}>
            <h3 className={styles.groupLabel} id={`${ids}-library`}>Exercices</h3>
            <Field
              label="Rechercher un exercice"
              type="search"
              placeholder="Nom ou muscle"
              value={query}
              onChange={(e) => { setQuery(e.target.value); }}
            />
            {exercisesQuery.isError && (
              <p className={styles.error} role="alert">Impossible de charger les exercices.</p>
            )}
            {library && results.length === 0 && <p className={styles.muted}>Aucun exercice trouvé.</p>}
            <ul className={styles.library}>
              {results.map((exercise) => {
                const added = items.some((i) => i.exerciseId === exercise.id);
                return (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      aria-pressed={added}
                      className={styles.libraryItem}
                      onClick={() => { toggle(exercise); }}
                    >
                      <span className={styles.libraryText}>
                        <span>{exercise.name}</span>
                        {exercise.muscleGroups.length > 0 && (
                          <span className={styles.muscles}>{exercise.muscleGroups.slice(0, 2).join(' · ')}</span>
                        )}
                      </span>
                      <span className={added ? styles.badgeOn : styles.badgeOff} aria-hidden="true">
                        <Icon name={added ? 'check' : 'plus'} size={18} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer la séance ?"
        message={`« ${session?.name ?? ''} » sera retirée du programme. Les performances déjà enregistrées sont conservées.${isActive ? ' Cette séance est en cours : elle sera abandonnée et ses séries non enregistrées perdues.' : ''}`}
        confirmLabel="Supprimer"
        danger
        onConfirm={onDelete}
        onCancel={() => { setConfirmDelete(false); }}
      />
    </>
  );
}
