import Body, { type ExtendedBodyPart, type Slug } from '@mjcdev/react-body-highlighter';
import { useMemo } from 'react';
import { bodySlugsFor } from '@/domain/muscles';
import styles from './ExerciseDetailScreen.module.css';

/** Hauteur du corps : 400 px × échelle (largeur 200 px × échelle). */
const SCALE = 0.62;

/**
 * Carte musculaire avant / arrière. Le surlignage utilise `currentColor`
 * (citron via la feuille de style) : pas de couleur en dur dans le JS.
 */
export function MuscleMap({ muscles }: { muscles: string[] }) {
  const data = useMemo<ExtendedBodyPart[]>(
    () => bodySlugsFor(muscles).map((slug) => ({ slug: slug as Slug })),
    [muscles],
  );
  const label =
    data.length > 0
      ? `Carte musculaire : ${muscles.join(', ')}`
      : 'Carte musculaire : aucun muscle reconnu';

  return (
    <section className={styles.mapSection} aria-labelledby="muscle-map-title">
      <h2 id="muscle-map-title" className={styles.sectionLabel}>
        Muscles sollicités
      </h2>
      <div className={styles.map} role="img" aria-label={label}>
        <figure className={styles.mapSide}>
          <Body data={data} side="front" gender="male" scale={SCALE} colors={['currentColor']} border="none" />
          <figcaption>Avant</figcaption>
        </figure>
        <figure className={styles.mapSide}>
          <Body data={data} side="back" gender="male" scale={SCALE} colors={['currentColor']} border="none" />
          <figcaption>Arrière</figcaption>
        </figure>
      </div>
      {data.length === 0 && <p className={styles.mapEmpty}>Aucun muscle reconnu pour cet exercice.</p>}
    </section>
  );
}
