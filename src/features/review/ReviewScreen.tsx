import { useEffect, useMemo, useRef, useState } from 'react';
import { useCycleState, useJournal, usePerformances, useSessions, useWeekPlan } from '@/data/queries';
import { blockReview, feelingCountsLabel, recentBlocks, type BlockRange, type BlockReview } from '@/domain/blockReview';
import { defaultCycleState } from '@/domain/cycles';
import { isoToShortFr, todayIso } from '@/domain/dates';
import { setBlockNote, type Journal } from '@/domain/journal';
import { buildPdf, preloadPdf } from '@/platform/pdf';
import { shareFile } from '@/platform/share';
import { useJournalSync } from '@/features/workout';
import { Button, Field, PageHeader, Skeleton, StatTile, useToast } from '@/ui';
import styles from './ReviewScreen.module.css';
import { blockLabel, prLabel, prValue, reviewFileName, reviewPdfModel } from './format';

const NOTE_ERROR = 'Ressenti non enregistré : vérifie ta connexion.';

/** Ressenti du bloc : enregistré à la sortie du champ (journal sérialisé, jamais écrasé hors ligne). */
function BlockNote({ block, journal, onNote }: { block: BlockRange; journal: Journal | null; onNote: (note: string) => void }) {
  const toast = useToast();
  const syncJournal = useJournalSync();
  const saved = journal?.blockNotes[block.start] ?? '';
  const [text, setText] = useState(saved);
  // Quitter l'écran sans quitter le champ : le ressenti est quand même enregistré.
  const pending = useRef({ text, saved, start: block.start, syncJournal });
  useEffect(() => {
    pending.current = { text, saved, start: block.start, syncJournal };
  }, [text, saved, block.start, syncJournal]);
  useEffect(
    () => () => {
      const { text: t, saved: s, start, syncJournal: sync } = pending.current;
      if (t !== s) void sync((j) => setBlockNote(j, start, t));
    },
    [],
  );
  return (
    <section className={styles.section} aria-labelledby="review-note">
      <h2 id="review-note" className={styles.sectionTitle}>Ressenti du bloc</h2>
      <Field
        as="textarea"
        label="Ressenti du bloc"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onNote(e.target.value);
        }}
        onBlur={() => {
          if (text === saved) return;
          void syncJournal((j) => setBlockNote(j, block.start, text)).then((ok) => {
            if (!ok) toast.show(NOTE_ERROR, 'error');
          });
        }}
      />
    </section>
  );
}

function Counts({ r }: { r: BlockReview }) {
  return (
    <>
      <section className={styles.section} aria-labelledby="review-pr">
        <h2 id="review-pr" className={styles.sectionTitle}>Records</h2>
        {r.prs.length === 0 ? (
          <p className={styles.none}>Aucun PR sur ce bloc.</p>
        ) : (
          <ul className={styles.list}>
            {r.prs.map((pr) => (
              <li key={pr.key} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{prLabel(pr)}</span>
                  <span className={styles.rowMeta}>{isoToShortFr(pr.date)}</span>
                </span>
                <span className={styles.rowValue}>{prValue(pr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="review-nopr">
        <h2 id="review-nopr" className={styles.sectionTitle}>Sans PR</h2>
        {r.exercisesWithoutPr.length === 0 ? (
          <p className={styles.none}>Aucun exercice sans PR.</p>
        ) : (
          <ul className={styles.list}>
            {r.exercisesWithoutPr.map((n) => (
              <li key={n} className={styles.row}>
                <span className={styles.rowName}>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="review-form">
        <h2 id="review-form" className={styles.sectionTitle}>Forme</h2>
        <p className={styles.line}>Frais : {r.forms.frais} · Fatigué : {r.forms.fatigue}</p>
      </section>

      <section className={styles.section} aria-labelledby="review-feel">
        <h2 id="review-feel" className={styles.sectionTitle}>États par exercice</h2>
        {r.feelings.length === 0 ? (
          <p className={styles.none}>Aucun ressenti noté.</p>
        ) : (
          <ul className={styles.list}>
            {r.feelings.map((f) => (
              <li key={f.exercise} className={styles.row}>
                <span className={styles.rowName}>{f.exercise}</span>
                <span className={styles.rowMeta}>{feelingCountsLabel(f.counts)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="review-mood">
        <h2 id="review-mood" className={styles.sectionTitle}>États généraux</h2>
        {r.moods.length === 0 ? (
          <p className={styles.none}>Aucun état général noté.</p>
        ) : (
          <ul className={styles.list}>
            {r.moods.map((m, i) => (
              <li key={`${m.date}-${String(i)}`} className={styles.moodRow}>
                <span className={styles.rowMeta}>{isoToShortFr(m.date)} · {m.sessionName}</span>
                <span>{m.mood}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function ReviewScreen() {
  const toast = useToast();
  const today = todayIso();
  const cycleQuery = useCycleState();
  const sessionsQuery = useSessions();
  const perfsQuery = usePerformances();
  const planQuery = useWeekPlan();
  const journalQuery = useJournal();

  const cycleState = cycleQuery.isSuccess ? (cycleQuery.data ?? defaultCycleState(today)) : null;
  const blocks = useMemo(() => (cycleState ? recentBlocks(cycleState, today) : []), [cycleState, today]);
  const [selected, setSelected] = useState<string | null>(null);
  const block = blocks.find((b) => b.start === selected) ?? blocks[0] ?? null;

  const sessions = sessionsQuery.data;
  const perfs = perfsQuery.data;
  const review = useMemo(
    () =>
      block && cycleState && sessions && perfs && journalQuery.isSuccess
        ? blockReview({
            block, today, plan: planQuery.data ?? null, sessions, cycleState, perfs,
            journal: journalQuery.data ?? { logs: [], blockNotes: {}, warmups: { catalog: [], bySession: {} } },
          })
        : null,
    [block, today, planQuery.data, sessions, cycleState, perfs, journalQuery.isSuccess, journalQuery.data],
  );

  // Note en cours de saisie, pour l'export (le journal n'est écrit qu'à la sortie du champ).
  const [draft, setDraft] = useState<{ start: string; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Charge jsPDF dès l'affichage : au clic, le partage reste dans la fenêtre d'activation.
  useEffect(() => {
    preloadPdf().catch(() => undefined);
  }, []);

  const failed = [cycleQuery, sessionsQuery, perfsQuery, journalQuery, planQuery].filter((q) => q.isError);
  const loading = !failed.length && (!block || !review || planQuery.isPending);

  const send = async (): Promise<void> => {
    if (!block || !review) return;
    const savedNote = journalQuery.data?.blockNotes[block.start] ?? '';
    const note = draft?.start === block.start ? draft.text : savedNote;
    setSending(true);
    try {
      let file: File;
      const name = reviewFileName(block);
      try {
        const blob = await buildPdf(reviewPdfModel(block, review, note));
        file = new File([blob], name, { type: 'application/pdf' });
      } catch {
        toast.show('Impossible de générer le PDF. Réessaie dans un instant.', 'error');
        return;
      }
      try {
        const result = await shareFile(file, {
          title: `Bilan du bloc · ${blockLabel(block)}`,
          text: `Bilan du bloc : ${blockLabel(block)}.`,
          dialogTitle: 'Envoyer au coach',
        });
        if (result === 'shared') toast.show('Bilan partagé.', 'success');
        else if (result === 'downloaded') toast.show(`PDF téléchargé : ${name}`, 'success');
      } catch {
        toast.show('Le partage du PDF a échoué : il n’a pas été envoyé. Réessaie dans un instant.', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.screen}>
      <PageHeader title="Bilan du bloc" />

      {failed.length > 0 && (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>Impossible de charger le bilan. Vérifie ta connexion puis réessaie.</p>
          <Button
            variant="secondary"
            onClick={() => {
              for (const q of failed) void q.refetch();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}

      {loading && (
        <div aria-busy="true" className={styles.skeletons}>
          <span className="visually-hidden">Chargement du bilan…</span>
          <Skeleton height={44} />
          <Skeleton height={90} />
          <Skeleton height={160} />
        </div>
      )}

      {block && review && !loading && failed.length === 0 && (
        <>
          <Field
            as="select"
            label="Bloc"
            value={block.start}
            onChange={(e) => {
              setSelected(e.target.value);
            }}
          >
            {blocks.map((b) => (
              <option key={b.start} value={b.start}>{blockLabel(b)}</option>
            ))}
          </Field>

          <div className={styles.stats}>
            <StatTile
              tone="accent"
              value={`${String(review.sessionsDone)}/${String(review.sessionsPlanned)}`}
              label="séances faites"
            />
            <StatTile value={review.sessionsSkipped} label={review.sessionsSkipped > 1 ? 'sautées' : 'sautée'} />
            <StatTile value={review.sessionsMissed} label={review.sessionsMissed > 1 ? 'manquées' : 'manquée'} />
            <StatTile value={review.prs.length} label="PR" />
          </div>

          <Counts r={review} />

          <BlockNote
            key={block.start}
            block={block}
            journal={journalQuery.data ?? null}
            onNote={(text) => {
              setDraft({ start: block.start, text });
            }}
          />

          <Button variant="accent" size="lg" fullWidth icon="share" loading={sending} onClick={() => void send()}>
            Exporter en PDF
          </Button>
        </>
      )}
    </div>
  );
}
