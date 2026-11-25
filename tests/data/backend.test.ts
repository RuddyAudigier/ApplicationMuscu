import { createBackend } from '../../src/data/backend';

describe('createBackend', () => {
  it.each(['mock', ' LOCAL ', 'test'])('selects the mock backend for %j', (v) => {
    expect(createBackend({ VITE_DATA_BACKEND: v }).kind).toBe('mock');
  });

  it('builds a Supabase backend from the URL and anon key', () => {
    const b = createBackend({ VITE_DATA_BACKEND: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' });
    expect(b.kind).toBe('supabase');
    expect(b.reset).toBeUndefined();
  });

  it('throws a clear French error when Supabase config is missing', () => {
    expect(() => createBackend({})).toThrow('Configuration Supabase manquante : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
    expect(() => createBackend({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: ' ' })).toThrow('Configuration Supabase manquante');
  });
});
