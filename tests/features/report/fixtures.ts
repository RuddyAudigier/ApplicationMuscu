import type { Report } from '@/domain/report';

export const sampleReport: Report = {
  title: 'Haut du corps',
  cycle: 'A',
  date: '2026-11-23',
  durationMin: 52,
  prCount: 2,
  seriesCount: 3,
  exerciseCount: 2,
  logId: null,
  form: null,
  mood: '',
  exercises: [
    {
      exerciseId: 'bench',
      feeling: null,
      name: 'Développé couché',
      seriesLabel: '2 séries',
      series: [
        { n: 1, variant: 'Classique', reps: 4, weight: 100, rpe: 9, isPr: true, prKind: 'reps' },
        { n: 2, variant: 'Pausé 2 ct', reps: 5, weight: 82.5, rpe: 9, isPr: false, prKind: null },
      ],
    },
    {
      exerciseId: 'curl',
      feeling: null,
      name: 'Curl',
      seriesLabel: '1 série · fatigué',
      series: [{ n: 1, variant: 'Wide curl', reps: 8, weight: 20, rpe: 10, isPr: true, prKind: 'hybride' }],
    },
  ],
};
