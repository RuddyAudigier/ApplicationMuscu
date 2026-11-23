import sql from '../../scripts/sql/2026-11-23_cycles.sql?raw';

const code = sql.replace(/--.*$/gm, '').toLowerCase();

describe('scripts/sql/2026-11-23_cycles.sql', () => {
  it('is additive and idempotent', () => {
    expect(code).not.toMatch(/\b(drop|delete|truncate|rename)\b/);
    expect(code).toContain("alter table sessions add column if not exists cycle text check (cycle in ('a','b'));");
    expect(code).toContain('create table if not exists cycle_state');
    expect(code).toMatch(/id int primary key default 1 check \(id = 1\)/);
    expect(code).toMatch(/current text not null check \(current in \('a','b'\)\)/);
    expect(code).toMatch(/started_on date not null/);
    expect(code).toMatch(/weeks int not null check \(weeks in \(2,3\)\)/);
    expect(code).toMatch(/updated_at timestamptz default now\(\)/);
  });
});
