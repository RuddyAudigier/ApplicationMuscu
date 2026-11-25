import { useId, useState } from 'react';
import { useJournal } from '@/data/queries';
import { removeWarmupItem, type Journal, type WarmupItem } from '@/domain/journal';
import { useJournalSync } from '@/features/workout';
import { Button, ConfirmDialog, EmptyState, ErrorNotice, Field, IconButton, SectionTitle, Sheet, Skeleton, useToast } from '@/ui';
import styles from './WarmupSection.module.css';

const SAVE_ERROR = 'Échauffements non enregistrés. Vérifie ta connexion et réessaie.';

/** Ajoute ou remplace (même id) un élément du catalogue. */
const upsertItem = (j: Journal, item: WarmupItem): Journal => {
  const exists = j.warmups.catalog.some((w) => w.id === item.id);
  const catalog = exists ? j.warmups.catalog.map((w) => (w.id === item.id ? item : w)) : [...j.warmups.catalog, item];
  return { ...j, warmups: { ...j.warmups, catalog } };
};

/** « Échauffements » : catalogue (nom + détail) réutilisable dans les séances. */
export function WarmupSection() {
  const id = useId();
  const toast = useToast();
  const journalQuery = useJournal();
  const sync = useJournalSync();
  /** `undefined` = fermé, `null` = nouvel élément. */
  const [editing, setEditing] = useState<WarmupItem | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catalog = journalQuery.data?.warmups.catalog ?? [];

  const open = (item: WarmupItem | null): void => {
    setEditing(item);
    setName(item?.name ?? '');
    setDetail(item?.detail ?? '');
    setSubmitted(false);
  };
  const close = (): void => {
    setEditing(undefined);
    setConfirmDelete(false);
  };

  const onSave = async (): Promise<void> => {
    setSubmitted(true);
    if (editing === undefined || name.trim() === '') return;
    const item: WarmupItem = { id: editing?.id ?? crypto.randomUUID(), name: name.trim(), detail: detail.trim() };
    setBusy(true);
    const ok = await sync((j) => upsertItem(j, item));
    setBusy(false);
    if (ok) close();
    else toast.show(SAVE_ERROR, 'error');
  };

  const onDelete = async (): Promise<void> => {
    if (!editing) return;
    const target = editing.id;
    setBusy(true);
    const ok = await sync((j) => removeWarmupItem(j, target));
    setBusy(false);
    setConfirmDelete(false);
    if (ok) close();
    else toast.show(SAVE_ERROR, 'error');
  };

  let body;
  if (journalQuery.isError) {
    body = (
      <ErrorNotice message="Impossible de charger tes échauffements." onRetry={() => { void journalQuery.refetch(); }} />
    );
  } else if (journalQuery.isPending) {
    body = <Skeleton height={64} />;
  } else if (catalog.length === 0) {
    body = (
      <EmptyState
        icon="list"
        title="Aucun échauffement"
        message="Crée tes exercices d’échauffement, puis choisis-les dans tes séances."
      />
    );
  } else {
    body = (
      <ul className={styles.list} aria-label="Échauffements">
        {catalog.map((w) => (
          <li key={w.id} className={styles.item}>
            <span className={styles.text}>
              <span className={styles.name}>{w.name}</span>
              {w.detail !== '' && <span className={styles.detail}>{w.detail}</span>}
            </span>
            <IconButton icon="edit" label={`Modifier ${w.name}`} onClick={() => { open(w); }} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <SectionTitle id={`${id}-title`}>Échauffements</SectionTitle>
        <Button
          variant="secondary"
          icon="plus"
          disabled={!journalQuery.isSuccess}
          onClick={() => { open(null); }}
        >
          Ajouter
        </Button>
      </div>
      {body}

      <Sheet
        open={editing !== undefined}
        onClose={close}
        title={editing ? 'Modifier l’échauffement' : 'Nouvel échauffement'}
        footer={
          <>
            {editing && (
              <Button variant="dangerGhost" size="lg" icon="trash" disabled={busy} onClick={() => { setConfirmDelete(true); }}>
                Supprimer
              </Button>
            )}
            <Button variant="accent" size="lg" data-grow="2" loading={busy} onClick={() => { void onSave(); }}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Field
            label="Nom"
            placeholder="Ex : Rotations d’épaules"
            value={name}
            maxLength={80}
            error={submitted && name.trim() === '' ? 'Donne un nom à l’échauffement.' : undefined}
            onChange={(e) => { setName(e.target.value); }}
          />
          <Field
            label="Détail (facultatif)"
            placeholder="Ex : 2 × 15, élastique"
            value={detail}
            maxLength={160}
            onChange={(e) => { setDetail(e.target.value); }}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer l’échauffement ?"
        message={`« ${editing?.name ?? ''} » sera retiré du catalogue et de toutes tes séances. Les comptes rendus passés sont conservés.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { void onDelete(); }}
        onCancel={() => { setConfirmDelete(false); }}
      />
    </section>
  );
}
