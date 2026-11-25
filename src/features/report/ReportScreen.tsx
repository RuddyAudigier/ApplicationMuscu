import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Feeling, Form } from '@/domain/journal';
import { formatDecimal } from '@/domain/numbers';
import type { Report } from '@/domain/report';
import { buildPdf, preloadPdf } from '@/platform/pdf';
import { shareFile } from '@/platform/share';
import {
  Badge,
  Button,
  buttonClasses,
  EmptyState,
  Field,
  PageHeader,
  SectionTitle,
  Segmented,
  StatTile,
  type SegmentedOption,
  useToast,
} from '@/ui';
import {
  FeelingChips,
  JOURNAL_NOT_SYNCED_MESSAGE,
  loadLastReport,
  pushReport,
  saveLastReport,
  useJournalSync,
  usePendingReportSync,
} from '@/features/workout';
import styles from './ReportScreen.module.css';
import {
  FORM_LABEL,
  PR_KIND_LABEL,
  PR_KIND_LONG,
  formatDuration,
  formatPerf,
  formatWarmupSets,
  reportFileName,
  reportPdfModel,
  shortDate,
  summaryLine,
  warmupLabel,
  type ReportSerie,
} from './format';

function SerieRow({ s }: { s: ReportSerie }) {
  const kind = s.isPr && s.prKind ? s.prKind : null;
  return (
    <li className={styles.serie}>
      <span className={styles.n}>S{s.n}</span>
      <span className={styles.perfCol}>
        <span className={styles.perf}>{formatPerf(s)}</span>
        <span className={styles.variant}>{s.variant}</span>
      </span>
      <span className={styles.rpe}>RPE {formatDecimal(s.rpe)}</span>
      <span className={styles.prCol}>
        {s.isPr && (
          <>
            <Badge tone="pr">
              <span aria-hidden="true">PR</span>
              <span className="visually-hidden">
                {kind ? `Record personnel : ${PR_KIND_LONG[kind]}` : 'Record personnel'}
              </span>
            </Badge>
            {kind && (
              <span className={styles.prKind} aria-hidden="true">
                {PR_KIND_LABEL[kind]}
              </span>
            )}
          </>
        )}
      </span>
    </li>
  );
}

const FORM_OPTIONS: SegmentedOption<Form | ''>[] = (['frais', 'fatigue'] as const).map((value) => ({
  value,
  label: FORM_LABEL[value],
}));

function ReportView({ initial }: { initial: Report }) {
  const toast = useToast();
  const navigate = useNavigate();
  const syncJournal = useJournalSync();
  // Séance terminée hors ligne : le compte rendu rejoint le journal dès qu'il est lisible.
  usePendingReportSync(true);
  const [report, setReport] = useState(initial);
  const [mood, setMood] = useState(initial.mood);

  /** Garde le compte rendu local, puis le journal (même id) ; un échec du journal ne perd rien. */
  const edit = (patch: Partial<Pick<Report, 'form' | 'mood' | 'exercises'>>): void => {
    const next: Report = { ...report, ...patch, logId: report.logId ?? crypto.randomUUID() };
    setReport(next);
    saveLastReport(next);
    void pushReport(syncJournal, next).then((ok) => {
      if (!ok) toast.show(JOURNAL_NOT_SYNCED_MESSAGE, 'error');
    });
  };

  const flushMood = (): void => {
    if (mood !== report.mood) edit({ mood });
  };
  // Quitter l'écran sans quitter le champ : le texte est quand même gardé (compte rendu local).
  const pending = useRef({ mood, report, syncJournal });
  useEffect(() => {
    pending.current = { mood, report, syncJournal };
  }, [mood, report, syncJournal]);
  useEffect(
    () => () => {
      const { mood: m, report: r, syncJournal: sync } = pending.current;
      if (m === r.mood) return;
      const next: Report = { ...r, mood: m, logId: r.logId ?? crypto.randomUUID() };
      saveLastReport(next);
      void pushReport(sync, next);
    },
    [],
  );

  const [sending, setSending] = useState(false);

  // Charge jsPDF dès l'affichage : au clic, le partage reste dans la fenêtre d'activation.
  useEffect(() => {
    preloadPdf().catch(() => undefined);
  }, []);

  const send = async (): Promise<void> => {
    setSending(true);
    try {
      let file: File;
      const name = reportFileName(report);
      try {
        const blob = await buildPdf(reportPdfModel(report));
        file = new File([blob], name, { type: 'application/pdf' });
      } catch {
        toast.show('Impossible de générer le PDF. Réessaie dans un instant.', 'error');
        return;
      }
      try {
        const result = await shareFile(file, {
          title: `Compte rendu · ${report.title}`,
          text: `Compte rendu de la séance ${report.title} (${shortDate(report.date)}) : ${summaryLine(report)}.`,
          dialogTitle: 'Envoyer au coach',
        });
        if (result === 'shared') toast.show('Compte rendu partagé.', 'success');
        else if (result === 'downloaded') toast.show(`PDF téléchargé : ${name}`, 'success');
      } catch {
        toast.show("Le partage du PDF a échoué : il n’a pas été envoyé. Réessaie dans un instant.", 'error');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.screen}>
      <PageHeader
        title="Séance terminée"
        onBack={() => {
          void navigate('/');
        }}
      />
      <p className={styles.meta}>
          {report.cycle ? (
            <span className={styles.cycle}>
              <span className="visually-hidden">Cycle </span>
              {report.cycle}
            </span>
          ) : (
            <span>Hors cycle ·</span>
          )}{' '}
          {report.title} · {shortDate(report.date)} · {formatDuration(report.durationMin)}
      </p>

      <div className={styles.stats}>
        <StatTile size="sm" tone="accent" value={report.prCount} label="PR" />
        <StatTile size="sm" value={report.seriesCount} label={report.seriesCount > 1 ? 'séries' : 'série'} />
        <StatTile size="sm" value={report.exerciseCount} label={report.exerciseCount > 1 ? 'exercices' : 'exercice'} />
      </div>

      <section className={styles.state} aria-label="État du jour">
        <SectionTitle level="eyebrow">Forme du jour</SectionTitle>
        <Segmented<Form | ''>
          label="Forme du jour"
          options={FORM_OPTIONS}
          value={report.form ?? ''}
          onChange={(form) => {
            if (form !== '') edit({ form });
          }}
        />
        <Field
          as="textarea"
          label="État général"
          rows={3}
          value={mood}
          onChange={(e) => {
            setMood(e.target.value);
          }}
          onBlur={flushMood}
        />
      </section>

      {report.warmup.length > 0 && (
        <section className={styles.warmup} aria-label="Échauffement">
          <SectionTitle level="eyebrow">Échauffement</SectionTitle>
          <ul className={styles.warmupList}>
            {report.warmup.map((w, i) => (
              <li key={i}>{warmupLabel(w)}</li>
            ))}
          </ul>
        </section>
      )}

      {report.exercises.length === 0 ? (
        <p className={styles.none}>Aucune série validée pendant cette séance.</p>
      ) : (
        <ul className={styles.list} aria-label="Exercices de la séance">
          {report.exercises.map((ex, i) => (
            <li key={`${ex.name}-${String(i)}`} className={styles.exercise}>
              <div className={styles.exHead}>
                <h2 className={styles.exName}>{ex.name}</h2>
                <span className={styles.exCount}>{ex.seriesLabel}</span>
              </div>
              <FeelingChips
                label={`Ressenti — ${ex.name}`}
                value={ex.feeling}
                onChange={(feeling: Feeling | null) => {
                  edit({ exercises: report.exercises.map((x, k) => (k === i ? { ...x, feeling } : x)) });
                }}
              />
              {ex.warmupSets.length > 0 && (
                <p className={styles.warmupSets}>
                  <span className={styles.warmupLabel}>Chauffe :</span> {formatWarmupSets(ex.warmupSets)}
                </p>
              )}
              <ul className={styles.series} aria-label={`Séries — ${ex.name}`}>
                {ex.series.map((s) => (
                  <SerieRow key={s.n} s={s} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button variant="accent" size="lg" fullWidth icon="share" loading={sending} onClick={() => void send()}>
          Envoyer au coach (PDF)
        </Button>
        <Link to="/" className={buttonClasses('ghost')}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

export function ReportScreen() {
  const navigate = useNavigate();
  const [report] = useState(loadLastReport);
  if (!report) {
    return (
      <div className={styles.screen}>
        <PageHeader
          title="Compte rendu"
          onBack={() => {
            void navigate('/');
          }}
        />
        <EmptyState
          icon="list"
          title="Aucune séance terminée"
          message="Termine une séance pour voir son compte rendu et l’envoyer à ton coach."
          action={
            <Link to="/" className={buttonClasses('accent')}>
              Retour à l&apos;accueil
            </Link>
          }
        />
      </div>
    );
  }
  return <ReportView initial={report} />;
}
