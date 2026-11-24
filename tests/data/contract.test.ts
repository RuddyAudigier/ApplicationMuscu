import { createMockBackend } from '../../src/data/mock';
import { ValidationError, type DataBackend } from '../../src/data/ports';
import type { PerformanceInput } from '../../src/domain/model';
import { MemoryStorage, sequentialIds } from './helpers';

const INVALID_PERF =
  'Entrée performance invalide: mets reps > 0 avec un poids >= 0, ou reps=0 et poids vide pour une série non complétée.';

const perf = (over: Partial<PerformanceInput> = {}): PerformanceInput => ({
  exerciseId: 'ex-1', exerciseName: 'Bench', sessionName: 'S1', reps: 5, weight: 100, rpe: 8,
  variantId: null, variantName: 'Touch and Go', serieNumber: 1, performanceDate: '2026-04-01', ...over,
});

function contract(name: string, make: () => DataBackend): void {
  describe(`DataBackend contract — ${name}`, () => {
    let b: DataBackend;
    beforeEach(() => { b = make(); });

    it('creates, updates and removes an exercise with real variant ids', async () => {
      const created = await b.exercises.create({
        name: '  Tirage  ', description: 'dos', muscleGroups: ['Dos', 'dos', ' Biceps '],
        variants: [{ id: null, exerciseId: null, name: 'Prise large', isDefault: false }, { id: null, exerciseId: null, name: 'Prise serrée', isDefault: false }],
      });
      expect(created.name).toBe('Tirage');
      expect(created.muscleGroups).toEqual(['Dos', 'Biceps']);
      expect(created.isCustom).toBe(true);
      expect(created.coachNotes).toBe('');
      expect(created.variants).toHaveLength(2);
      for (const v of created.variants) {
        expect(v.id).not.toBeNull();
        expect(v.exerciseId).toBe(created.id);
      }
      expect(created.variants.filter((v) => v.isDefault)).toHaveLength(1);

      const [first] = created.variants;
      if (!first) throw new Error('variant expected');
      const updated = await b.exercises.update(created.id, {
        name: 'Tirage horizontal', description: 'dos 2', muscleGroups: ['Dos'],
        variants: [{ ...first, name: 'Prise large renommée' }, { id: null, exerciseId: created.id, name: 'Unilatéral', isDefault: false }],
      });
      expect(updated.name).toBe('Tirage horizontal');
      expect(updated.description).toBe('dos 2');
      expect(updated.muscleGroups).toEqual(['Dos']);
      expect(updated.variants.map((v) => v.name)).toEqual(['Prise large renommée', 'Unilatéral']);
      expect(updated.variants.find((v) => v.name === 'Prise large renommée')?.id).toBe(first.id);
      expect(updated.variants.every((v) => v.id !== null)).toBe(true);

      expect((await b.exercises.list()).some((e) => e.id === created.id)).toBe(true);
      await b.exercises.remove(created.id);
      expect((await b.exercises.list()).some((e) => e.id === created.id)).toBe(false);
    });

    it('renaming a variant relabels its performances, legacy null-id rows included (no deletion)', async () => {
      const ex = await b.exercises.create({
        name: 'Rowing', description: '', muscleGroups: [],
        variants: [{ id: null, exerciseId: null, name: 'Touch and Go', isDefault: true }, { id: null, exerciseId: null, name: 'Pause', isDefault: false }],
      });
      const pause = ex.variants.find((v) => v.name === 'Pause');
      if (!pause?.id) throw new Error('variant expected');
      await b.performances.add([
        perf({ exerciseId: ex.id, variantId: null, variantName: ' pause ', reps: 3 }),
        perf({ exerciseId: ex.id, variantId: pause.id, variantName: 'Pause', reps: 4 }),
        perf({ exerciseId: ex.id, variantId: null, variantName: 'Touch and Go', reps: 5 }),
        perf({ exerciseId: 'other', variantId: null, variantName: 'Pause', reps: 6 }),
      ]);
      const before = (await b.performances.list()).length;
      await b.exercises.update(ex.id, { name: 'Rowing', description: '', muscleGroups: [], variants: ex.variants.map((v) => (v.id === pause.id ? { ...v, name: 'Pause 2 s' } : v)) });
      const perfs = await b.performances.list();
      expect(perfs).toHaveLength(before);
      const byReps = (r: number) => perfs.find((p) => p.reps === r);
      expect(byReps(3)).toMatchObject({ variantId: pause.id, variantName: 'Pause 2 s' });
      expect(byReps(4)).toMatchObject({ variantId: pause.id, variantName: 'Pause 2 s' });
      expect(byReps(5)).toMatchObject({ variantId: null, variantName: 'Touch and Go' });
      expect(byReps(6)).toMatchObject({ variantId: null, variantName: 'Pause' });
    });

    it('defaults to a single Touch and Go variant', async () => {
      const e = await b.exercises.create({ name: 'Curl', description: '', muscleGroups: [], variants: [] });
      expect(e.variants).toEqual([expect.objectContaining({ name: 'Touch and Go', isDefault: true })]);
      expect(e.variants[0]?.id).not.toBeNull();
    });

    it('rejects duplicate variant names and empty names', async () => {
      const dup = b.exercises.create({
        name: 'X', description: '', muscleGroups: [],
        variants: [{ id: null, exerciseId: null, name: 'Pause', isDefault: false }, { id: null, exerciseId: null, name: ' pause ', isDefault: false }],
      });
      await expect(dup).rejects.toBeInstanceOf(ValidationError);
      await expect(dup).rejects.toThrow('Deux variantes portent le même nom.');
      await expect(b.exercises.create({ name: '   ', description: '', muscleGroups: [], variants: [] }))
        .rejects.toThrow("Le nom de l'exercice est requis.");
      const [ex] = await b.exercises.list();
      if (!ex) throw new Error('seed expected');
      await expect(b.exercises.update(ex.id, { name: '', description: '', muscleGroups: [], variants: [] }))
        .rejects.toBeInstanceOf(ValidationError);
    });

    it('add() skips reps 0 rows and reports written', async () => {
      const before = (await b.performances.list()).length;
      const res = await b.performances.add([perf(), perf({ serieNumber: 2, reps: 0, weight: null }), perf({ serieNumber: 3, reps: 6 })]);
      expect(res).toEqual({ written: 2 });
      expect((await b.performances.list()).length).toBe(before + 2);
      expect(await b.performances.add([perf({ reps: 0, weight: null })])).toEqual({ written: 0 });
    });

    it('add() rejects the whole batch on one invalid entry', async () => {
      const before = (await b.performances.list()).length;
      const bad = b.performances.add([perf(), perf({ reps: 5, weight: null })]);
      await expect(bad).rejects.toBeInstanceOf(ValidationError);
      await expect(bad).rejects.toThrow(INVALID_PERF);
      await expect(b.performances.add([perf({ reps: -1 })])).rejects.toThrow(INVALID_PERF);
      await expect(b.performances.add([perf({ weight: -5 })])).rejects.toThrow(INVALID_PERF);
      expect((await b.performances.list()).length).toBe(before);
    });

    it('add() applies defaults (rpe 10, Touch and Go) and keeps both identical sets on two dates (D1)', async () => {
      await b.performances.add([perf({ exerciseId: 'ex-z', exerciseName: 'Z', performanceDate: '2026-04-01', rpe: null, variantName: '' })]);
      await b.performances.add([perf({ exerciseId: 'ex-z', exerciseName: 'Z', performanceDate: '2026-04-08', weight: 100 })]);
      const z = (await b.performances.list()).filter((p) => p.exerciseId === 'ex-z');
      expect(z.map((p) => p.performanceDate)).toEqual(['2026-04-08', '2026-04-01']);
      const old = z[1];
      expect(old?.rpe).toBe(10);
      expect(old?.variantName).toBe('Touch and Go');
      expect(old?.weight).toBe(100);
      expect(typeof old?.createdAt).toBe('string');
    });

    it('list() is sorted by performance_date desc', async () => {
      const list = await b.performances.list();
      const dates = list.map((p) => p.performanceDate);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    it('sessions: create, list, rename propagates to performances (D5), remove', async () => {
      const exs = await b.exercises.list();
      const [e1, e2] = exs;
      if (!e1 || !e2) throw new Error('seed expected');
      const s = await b.sessions.create({ cycle: null, name: '  Push  ', exercises: [{ exerciseId: e1.id, series: 4 }, { exerciseId: e2.id, series: 2 }] });
      expect(s.name).toBe('Push');
      expect(s.exercises).toEqual(expect.arrayContaining([
        { exerciseId: e1.id, name: e1.name, series: 4 }, { exerciseId: e2.id, name: e2.name, series: 2 },
      ]));
      expect(Number.isNaN(Date.parse(s.createdAt))).toBe(false);
      await b.performances.add([perf({ sessionName: 'Push' }), perf({ sessionName: 'Autre', serieNumber: 2 })]);

      const renamed = await b.sessions.update(s.id, { cycle: null, name: 'Push A', exercises: [{ exerciseId: e1.id, series: 5 }] });
      expect(renamed).toEqual({ id: s.id, name: 'Push A', createdAt: s.createdAt, cycle: null, exercises: [{ exerciseId: e1.id, name: e1.name, series: 5 }] });
      const perfs = await b.performances.list();
      expect(perfs.filter((p) => p.sessionName === 'Push')).toHaveLength(0);
      expect(perfs.filter((p) => p.sessionName === 'Push A')).toHaveLength(1);
      expect(perfs.filter((p) => p.sessionName === 'Autre')).toHaveLength(1);

      expect((await b.sessions.list()).find((x) => x.id === s.id)?.name).toBe('Push A');
      await b.sessions.remove(s.id);
      expect((await b.sessions.list()).some((x) => x.id === s.id)).toBe(false);
      expect((await b.performances.list()).filter((p) => p.sessionName === 'Push A')).toHaveLength(1);
    });

    it('sessions: exercise order is kept on create, list and update', async () => {
      const [e1, e2] = await b.exercises.list();
      if (!e1 || !e2) throw new Error('seed expected');
      const s = await b.sessions.create({ cycle: null, name: 'Ordre', exercises: [{ exerciseId: e2.id, series: 2 }, { exerciseId: e1.id, series: 3 }] });
      expect(s.exercises.map((e) => e.exerciseId)).toEqual([e2.id, e1.id]);
      expect((await b.sessions.list()).find((x) => x.id === s.id)?.exercises.map((e) => e.exerciseId)).toEqual([e2.id, e1.id]);
      const u = await b.sessions.update(s.id, { cycle: null, name: 'Ordre', exercises: [{ exerciseId: e1.id, series: 3 }, { exerciseId: e2.id, series: 2 }] });
      expect(u.exercises.map((e) => e.exerciseId)).toEqual([e1.id, e2.id]);
    });

    it('sessions: validation', async () => {
      const [e1] = await b.exercises.list();
      if (!e1) throw new Error('seed expected');
      await expect(b.sessions.create({ cycle: null, name: ' ', exercises: [{ exerciseId: e1.id, series: 3 }] })).rejects.toThrow('Nom de séance manquant.');
      await expect(b.sessions.create({ cycle: null, name: 'A', exercises: [] })).rejects.toBeInstanceOf(ValidationError);
      await expect(b.sessions.create({ cycle: null, name: 'A', exercises: [{ exerciseId: e1.id, series: 0 }] })).rejects.toBeInstanceOf(ValidationError);
      await expect(b.sessions.create({ cycle: null, name: 'A', exercises: [{ exerciseId: e1.id, series: 1.5 }] })).rejects.toBeInstanceOf(ValidationError);
    });

    it('sessions.list() ignores exercises that no longer exist (D12)', async () => {
      const e = await b.exercises.create({ name: 'Éphémère', description: '', muscleGroups: [], variants: [] });
      const [keep] = await b.exercises.list();
      if (!keep) throw new Error('seed expected');
      const s = await b.sessions.create({ cycle: null, name: 'Mix', exercises: [{ exerciseId: e.id, series: 2 }, { exerciseId: keep.id, series: 3 }] });
      await b.exercises.remove(e.id);
      const found = (await b.sessions.list()).find((x) => x.id === s.id);
      expect(found?.exercises.map((x) => x.exerciseId)).not.toContain(e.id);
    });

    it('coach notes: save normalises line endings and fills exercises', async () => {
      const [ex] = await b.exercises.list();
      if (!ex) throw new Error('seed expected');
      await b.coachNotes.save(ex.id, 'a\r\nb\rc');
      await b.coachNotes.save(ex.id, 'a\r\nb\rc\nd');
      expect((await b.coachNotes.listAll())[ex.id]).toBe('a\nb\nc\nd');
      expect((await b.exercises.list()).find((e) => e.id === ex.id)?.coachNotes).toBe('a\nb\nc\nd');
    });

    it('advice: null then saved singleton', async () => {
      expect(await b.advice.get()).toBeNull();
      await b.advice.save({ training: 't', nutrition: 'n', sleep: 's' });
      await b.advice.save({ training: 't2', nutrition: 'n', sleep: 's' });
      expect(await b.advice.get()).toEqual({ training: 't2', nutrition: 'n', sleep: 's' });
    });

    it('cycles: null until saved, then the saved state', async () => {
      expect(await b.cycles.get()).toBeNull();
      await b.cycles.save({ current: 'B', startedOn: '2026-11-16', weeks: 3 });
      expect(await b.cycles.get()).toEqual({ current: 'B', startedOn: '2026-11-16', weeks: 3 });
    });

    it('sessions: cycle is stored on create and changed on update', async () => {
      const [e1] = await b.exercises.list();
      if (!e1) throw new Error('seed expected');
      const s = await b.sessions.create({ cycle: 'B', name: 'B1', exercises: [{ exerciseId: e1.id, series: 2 }] });
      expect(s.cycle).toBe('B');
      expect((await b.sessions.list()).find((x) => x.id === s.id)?.cycle).toBe('B');
      const u = await b.sessions.update(s.id, { cycle: 'A', name: 'B1', exercises: [{ exerciseId: e1.id, series: 2 }] });
      expect(u.cycle).toBe('A');
      const n = await b.sessions.update(s.id, { cycle: null, name: 'B1', exercises: [{ exerciseId: e1.id, series: 2 }] });
      expect(n.cycle).toBeNull();
    });
  });
}

contract('mock', () => createMockBackend(new MemoryStorage(), { genId: sequentialIds() }));

describe('mock backend specifics', () => {
  it('seeds INV §4 data under local_test_db_v2', async () => {
    const storage = new MemoryStorage();
    const b = createMockBackend(storage);
    expect(b.kind).toBe('mock');
    const exs = await b.exercises.list();
    expect(exs.map((e) => e.name).sort()).toEqual(['Développé couché', 'Squat']);
    const bench = exs.find((e) => e.name === 'Développé couché');
    expect(bench?.muscleGroups).toEqual(['Pectoraux', 'Triceps']);
    expect(bench?.description).toBe('Exercice de test (mock).');
    expect(bench?.variants.map((v) => [v.name, v.isDefault])).toEqual([['Touch and Go', true], ['Pause', false]]);
    const sessions = await b.sessions.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.name).toBe('Séance test (mock)');
    expect(sessions[0]?.cycle).toBe('A');
    expect(sessions[0]?.exercises.map((e) => e.series)).toEqual([3, 3]);
    const perfs = await b.performances.list();
    expect(perfs.map((p) => [p.exerciseName, p.reps, p.weight, p.rpe, p.serieNumber, p.performanceDate]).sort()).toEqual([
      ['Développé couché', 5, 90, 9, 1, '2026-03-01'],
      ['Développé couché', 6, 90, 9, 1, '2026-03-05'],
      ['Développé couché', 6, 92.5, 9.5, 2, '2026-03-10'],
      ['Squat', 5, 120, 9, 1, '2026-03-01'],
      ['Squat', 5, 122.5, 9, 1, '2026-03-10'],
    ].sort());
    expect(perfs.every((p) => p.sessionName === 'Séance test (mock)' && p.variantName === 'Touch and Go' && p.variantId !== null)).toBe(true);
    const raw = storage.getItem('local_test_db_v2');
    expect(raw).not.toBeNull();
    expect((JSON.parse(raw ?? '{}') as { version: number }).version).toBe(2);
  });

  it('persists across instances and reset() reseeds', async () => {
    const storage = new MemoryStorage();
    const a = createMockBackend(storage);
    await a.exercises.create({ name: 'Persisté', description: '', muscleGroups: [], variants: [] });
    const b = createMockBackend(storage);
    expect((await b.exercises.list()).some((e) => e.name === 'Persisté')).toBe(true);
    await b.reset?.();
    expect((await b.exercises.list()).some((e) => e.name === 'Persisté')).toBe(false);
    expect(await b.exercises.list()).toHaveLength(2);
  });

  it('reseeds when stored JSON is corrupt or an old version, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    storage.setItem('local_test_db_v2', '{oops');
    expect(await createMockBackend(storage).exercises.list()).toHaveLength(2);
    storage.setItem('local_test_db_v2', JSON.stringify({ version: 1 }));
    expect(await createMockBackend(storage).exercises.list()).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('skips malformed stored performance rows with one warning', async () => {
    const storage = new MemoryStorage();
    const b = createMockBackend(storage);
    await b.performances.list();
    const db = JSON.parse(storage.getItem('local_test_db_v2') ?? '{}') as { performances: unknown[] };
    db.performances.push({ id: 'bad' }, { id: 'bad2' });
    storage.setItem('local_test_db_v2', JSON.stringify(db));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await b.performances.list()).toHaveLength(5);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('coach note requires an exercise id; backend exposes no shared repo', async () => {
    const b = createMockBackend(new MemoryStorage());
    expect(b).not.toHaveProperty('shared');
    await expect(b.coachNotes.save('', 'x')).rejects.toThrow('exerciseId manquant.');
  });

  it('keeps a stored db that predates cycles (no cycleState, sessions without cycle)', async () => {
    const storage = new MemoryStorage();
    await createMockBackend(storage).exercises.list();
    const db = JSON.parse(storage.getItem('local_test_db_v2') ?? '{}') as Record<string, unknown>;
    delete db['cycleState'];
    for (const s of db['sessions'] as Record<string, unknown>[]) delete s['cycle'];
    storage.setItem('local_test_db_v2', JSON.stringify(db));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const b = createMockBackend(storage);
    expect((await b.sessions.list())[0]?.cycle).toBeNull();
    expect(await b.cycles.get()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('defaults performanceDate to the local today', async () => {
    const b = createMockBackend(new MemoryStorage(), { now: () => new Date(2026, 4, 2, 0, 30) });
    await b.performances.add([perf({ exerciseId: 'd', performanceDate: '' })]);
    expect((await b.performances.list()).find((p) => p.exerciseId === 'd')?.performanceDate).toBe('2026-05-02');
  });
});

describe('mock reset and the offline queue', () => {
  it('clears the offline queue and its archives', async () => {
    const storage = new MemoryStorage();
    const keys = ['pending_performances_queue_v1', 'pending_performances_queue_v1_failed', 'pending_performances_queue_v1_corrupt'];
    for (const key of keys) storage.setItem(key, '[]');
    storage.setItem('other_key', 'kept');
    await createMockBackend(storage).reset?.();
    for (const key of keys) expect(storage.getItem(key)).toBeNull();
    expect(storage.getItem('other_key')).toBe('kept');
  });
});
