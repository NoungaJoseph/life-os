import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

export const LEGACY_MIGRATION_SENTINELS: Record<string, string> = {
  '20261102000001': 'profiles',
  '20261103000001': 'journal_entries',
  '20261104000001': 'food_logs',
  '20261105000001': 'debts',
  '20261111000001': 'user_security',
  '20261116000001': 'ledger_accounts',
  '20261116000002': 'savings_groups',
  '20261117000001': 'transformation_areas',
  '20261117000002': 'screen_time_rules',
  '20261118000001': 'savings_accounts',
  '20261118000002': 'family_savings_groups',
};

export function migrationVersion(filename: string): string {
  return filename.split('_')[0] ?? filename;
}

export function selectPendingMigrations(
  files: string[],
  applied: Set<string>,
  existingTables: Set<string>,
): { baseline: string[]; pending: string[] } {
  const sorted = [...files].filter((f) => f.endsWith('.sql')).sort();
  const baseline: string[] = [];
  const pending: string[] = [];

  for (const file of sorted) {
    const version = migrationVersion(file);
    if (applied.has(version)) continue;

    const sentinel = LEGACY_MIGRATION_SENTINELS[version];
    if (applied.size === 0 && sentinel && existingTables.has(sentinel)) {
      baseline.push(file);
      continue;
    }
    pending.push(file);
  }
  return { baseline, pending };
}

function findMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../supabase/migrations'),
    path.resolve(process.cwd(), '../supabase/migrations'),
    path.resolve(process.cwd(), 'supabase/migrations'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`Could not locate supabase/migrations directory. Checked: ${candidates.join(', ')}`);
  }
  return found;
}

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log('[migrate] DATABASE_URL not set; skipping automatic migrations.');
    return;
  }

  const migrationsDir = findMigrationsDir();
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const useSsl = !/localhost|127\.0\.0\.1/.test(databaseUrl);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    await client.query(`
      create table if not exists public.app_schema_migrations (
        version text primary key,
        filename text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedRes = await client.query<{ version: string }>('select version from public.app_schema_migrations');
    const tablesRes = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );

    const applied = new Set(appliedRes.rows.map((r) => r.version));
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
    const { baseline, pending } = selectPendingMigrations(files, applied, existingTables);

    for (const file of baseline) {
      const version = migrationVersion(file);
      await client.query(
        'insert into public.app_schema_migrations (version, filename) values ($1, $2) on conflict (version) do nothing',
        [version, file],
      );
    }
    if (baseline.length > 0) {
      console.log(`[migrate] Recorded ${baseline.length} pre-existing migration(s) in app_schema_migrations.`);
    }

    for (const file of pending) {
      const version = migrationVersion(file);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] Applying ${file}...`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into public.app_schema_migrations (version, filename) values ($1, $2)',
          [version, file],
        );
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }

    console.log(
      pending.length === 0
        ? `[migrate] Database is up to date (${files.length} migration file(s) tracked).`
        : `[migrate] Successfully applied ${pending.length} new migration(s).`,
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('[migrate] Failed:', err);
    process.exit(1);
  });
}
