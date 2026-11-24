import { useState } from 'react';
import { isoToFr, isoToShortFr } from '@/domain/dates';
import type { DayPoint } from '@/domain/progression';
import { formatWeight } from '@/domain/numbers';
import styles from './Records.module.css';

const W = 342;
const H = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 36 };

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Courbe du 1RM estimé (Epley) par date : SVG simple, ligne 2 px citron, survol / focus = valeur. */
export function E1rmChart({ points }: { points: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.bestE1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number): number =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number): number => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.bestE1rm).toFixed(1)}`).join(' ');
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const first = points[0];
  const last = points[points.length - 1];
  const shown = active !== null ? points[active] : undefined;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartCaption}>
        {shown ? (
          <>
            <strong>{formatWeight(round1(shown.bestE1rm))} kg</strong> le {isoToFr(shown.date)}
          </>
        ) : (
          '1RM estimé (Epley) par séance'
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className={styles.chartSvg}
        role="img"
        aria-label={`Courbe du 1RM estimé sur ${String(points.length)} séance${points.length > 1 ? 's' : ''}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.chartGrid} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className={styles.chartAxis}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        {first && (
          <text x={x(0)} y={H - 6} textAnchor={points.length === 1 ? 'middle' : 'start'} className={styles.chartAxis}>
            {isoToShortFr(first.date)}
          </text>
        )}
        {last && points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 6} textAnchor="end" className={styles.chartAxis}>
            {isoToShortFr(last.date)}
          </text>
        )}
        <path d={path} className={styles.chartLine} />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.bestE1rm)} r={active === i ? 6 : 4} className={styles.chartDot} />
        ))}
        {/* Zones de survol plus larges que les points (souris) ; le tableau masqué couvre le clavier. */}
        {points.map((p, i) => (
          <circle
            key={`hit-${p.date}`}
            data-testid="chart-hit"
            cx={x(i)}
            cy={y(p.bestE1rm)}
            r={14}
            className={styles.chartHit}
            onMouseEnter={() => {
              setActive(i);
            }}
            onMouseLeave={() => {
              setActive(null);
            }}
          />
        ))}
      </svg>
      <table className={styles.srOnly}>
        <caption>1RM estimé par date</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">1RM estimé</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{isoToFr(p.date)}</td>
              <td>{formatWeight(round1(p.bestE1rm))} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
