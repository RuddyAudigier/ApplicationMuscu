import { beforeEach, describe, expect, it } from 'vitest';
import { loadActiveWorkout, loadLastReport, saveActiveWorkout, saveLastReport } from '@/features/workout';

describe('workout storage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renvoie null sans séance ni compte rendu', () => {
    expect(loadActiveWorkout()).toBeNull();
    expect(loadLastReport()).toBeNull();
  });

  it('ignore un contenu corrompu', () => {
    localStorage.setItem('workout_state_v2', '{oops');
    localStorage.setItem('mymuscle_last_report_v1', '"x"');
    expect(loadActiveWorkout()).toBeNull();
    expect(loadLastReport()).toBeNull();
  });

  it('efface avec null', () => {
    saveLastReport({ exercises: [] } as never);
    expect(loadLastReport()).not.toBeNull();
    saveLastReport(null);
    saveActiveWorkout(null);
    expect(loadLastReport()).toBeNull();
  });
});
