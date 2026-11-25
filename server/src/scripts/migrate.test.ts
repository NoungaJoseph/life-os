import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGACY_MIGRATION_SENTINELS, selectPendingMigrations } from './migrate';

const ALL_FILES = [
  '20261102000001_core_schema.sql',
  '20261103000001_journal.sql',
  '20261104000001_life_modules.sql',
  '20261105000001_debts_push.sql',
  '20261111000001_auth_security.sql',
  '20261116000001_wallet_ledger.sql',
  '20261116000002_group_savings.sql',
  '20261117000001_transformation.sql',
  '20261117000002_screen_time.sql',
  '20261118000001_savings_accounts.sql',
  '20261118000002_family_savings.sql',
  '20261125000001_transformation_milestones.sql',
];

test('selectPendingMigrations marks all SQL files pending on a fresh database', () => {
  const res = selectPendingMigrations(ALL_FILES, new Set(), new Set());
  assert.deepEqual(res.baseline, []);
  assert.deepEqual(res.pending, ALL_FILES);
});

test('selectPendingMigrations baselines legacy migrations when their tables already exist', () => {
  const existingTables = new Set(Object.values(LEGACY_MIGRATION_SENTINELS));
  const res = selectPendingMigrations(ALL_FILES, new Set(), existingTables);
  assert.equal(res.baseline.length, 11);
  assert.deepEqual(res.pending, ['20261125000001_transformation_milestones.sql']);
});

test('selectPendingMigrations skips already applied versions on subsequent deploys', () => {
  const applied = new Set(Object.keys(LEGACY_MIGRATION_SENTINELS));
  const filesWithExtra = [...ALL_FILES, '20261126000001_next_feature.sql'];
  const res = selectPendingMigrations(filesWithExtra, applied, new Set());
  assert.deepEqual(res.baseline, []);
  assert.deepEqual(res.pending, [
    '20261125000001_transformation_milestones.sql',
    '20261126000001_next_feature.sql',
  ]);
});
