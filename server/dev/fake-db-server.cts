/* DEV ONLY - never deploy. Runs the real Express routes and insights engine against an in-memory fake of the
   Supabase query builder with seeded history, a fake auth check, and a stubbed Claude call. Used by `npm run test:api`. */
const SRC = require('node:path').resolve(__dirname, '../src');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'x';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'y';
process.env.ANTHROPIC_API_KEY = process.env.HARNESS_AI === 'off' ? '' : 'test-key';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.API_RATE_LIMIT = '5000';
process.env.CORS_ORIGINS = 'http://localhost:8082,http://127.0.0.1:8082,http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.PAYMENTS_MODE = 'sandbox';
process.env.PAYMENTS_WEBHOOK_SECRET = 'fake-webhook-secret-for-tests';
process.env.SANDBOX_PAYMENT_DELAY_MS = '0';
process.env.SANDBOX_PAYMENT_SUCCESS_RATE = '1';
process.env.PORT = process.env.PORT || '4000';

const crypto = require('node:crypto');
const U = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const uid = () => crypto.randomUUID();
const TZ = 'Africa/Lagos';
const dates = require(`${SRC}/services/dates.ts`);
const today: string = dates.localDate(new Date().toISOString(), TZ);
const day = (n: number) => dates.addDays(today, n);
const at = (d: string, hh: number, mm = 0) => new Date(`${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+01:00`).toISOString();

// ---------- seed ----------
const db: Record<string, any[]> = {};
const pillars = ['Financial Growth', 'Professional Excellence', 'Character Development', 'Health and Wellbeing', 'Peace and Relationships']
  .map((name, i) => ({ id: uid(), user_id: null, slug: name.toLowerCase().replace(/ /g, '-'), name, purpose: null, sort_order: i + 1 }));
const P = (n: string) => pillars.find((p) => p.name.startsWith(n))!.id;
const areaDefs: [string, string, string[]][] = [
  ['work', 'Work and Professional Life', ['Professional']], ['communication', 'Communication and Personal Development', ['Character', 'Peace']],
  ['social-media', 'Social Media and Social Life', ['Peace']], ['food-shopping', 'Food Shopping and Meal Preparation', ['Health']],
  ['nutrition', 'Nutrition and Healthy Eating', ['Health']], ['fitness', 'Fitness and Physical Activity', ['Health']],
  ['reading-study', 'Meditation, Reading and Studying', ['Professional', 'Character']], ['finance', 'Finance and Savings', ['Financial']],
  ['projects', 'Personal Businesses and Projects', ['Financial', 'Professional']], ['relationships', 'Relationships and Personal Life', ['Peace']],
];
const areas = areaDefs.map(([slug, name], i) => ({ id: uid(), user_id: null, slug, name, description: null, sort_order: i + 1 }));
const A = (s: string) => areas.find((a) => a.slug === s)!.id;
db.life_pillars = pillars; db.life_areas = areas;
db.life_area_pillars = areaDefs.flatMap(([slug, , ps]) => ps.map((p) => ({ life_area_id: A(slug), pillar_id: P(p) })));
db.user_life_areas = areas.map((a) => ({ user_id: U, life_area_id: a.id, is_active: true, settings: {} }));
db.profiles = [{ id: U, display_name: 'Joseph', first_name: 'Joseph', last_name: 'Youmi', phone: '+237671063170', timezone: TZ, currency: 'XAF', language: 'en', preferences: {}, onboarding_completed: true }];
db.life_visions = [{ id: uid(), user_id: U, identity_statement: 'A disciplined builder', ideal_life: '', long_term_ambitions: '', pillar_priorities: {} }];
const walletId=uid(), walletAccountId=uid(), clearingId=uid();
db.wallets=[{id:walletId,user_id:U,currency:'XAF',status:'active',daily_limit:500000,created_at:new Date().toISOString()}];
db.ledger_accounts=[{id:walletAccountId,user_id:U,wallet_id:walletId,code:'wallet',kind:'wallet',currency:'XAF',balance:0,locked:false},{id:clearingId,user_id:null,wallet_id:null,code:'provider:sandbox',kind:'provider_clearing',currency:'XAF',balance:0,locked:false}];
db.transactions=[];db.ledger_entries=[];db.payment_requests=[];db.payment_webhook_events=[];db.vault_settings=[];db.money_audit_log=[];

const wd = (d: string) => dates.weekday(d);
const mkHabit = (o: any) => ({ id: uid(), user_id: U, goal_id: null, description: null, frequency: 'daily', days_of_week: null, target_per_period: 1,
  preferred_time: null, start_date: day(-70), reminder_enabled: false, paused_at: null, archived_at: null, created_at: at(day(-70), 8), ...o });
const hRead = mkHabit({ name: 'Read for 20 minutes', life_area_id: A('reading-study') });
const hWork = mkHabit({ name: 'Home workout', life_area_id: A('fitness'), frequency: 'custom', days_of_week: [1, 3, 5] });
const hMed = mkHabit({ name: 'Morning meditation', life_area_id: A('reading-study') });
const hExp = mkHabit({ name: 'Record expenses', life_area_id: A('finance') });
const hRev = mkHabit({ name: 'Weekly review', life_area_id: A('communication'), frequency: 'weekly', target_per_period: 1 });
db.habits = [hRead, hWork, hMed, hExp, hRev];
db.habit_completions = [];
const comp = (h: any, d: string) => db.habit_completions.push({ id: uid(), user_id: U, habit_id: h.id, completed_on: d, note: null });
for (let i = 1; i <= 56; i++) {
  const d = day(-i);
  if (i <= 11) comp(hRead, d);                                  // 11-day streak
  else if (i % 4 !== 0) comp(hRead, d);
  if ([1, 3, 5].includes(wd(d)) && i % 5 !== 0) comp(hWork, d);
  if (wd(d) !== wd(today)) comp(hMed, d);                       // never on today's weekday -> lapse prediction
  if (i % 3 !== 0) comp(hExp, d);
  if (wd(d) === 0) comp(hRev, d);
}
comp(hRead, today);

const mkTask = (o: any) => ({ id: uid(), user_id: U, goal_id: null, life_area_id: null, notes: null, priority: 'medium', due_date: null,
  scheduled_start: null, scheduled_end: null, recurrence_rule: null, completed_at: null, created_at: at(day(-40), 9), ...o });
db.tasks = [];
const titles = ['Review client proposal', 'Write weekly report', 'Call supplier', 'Update budget sheet', 'Plan content calendar', 'Fix onboarding bug'];
for (let i = 1; i <= 27; i++) {
  const d = day(-i); const w = wd(d);
  const n = w === 2 || w === 4 ? 3 : 1;
  for (let k = 0; k < n; k++) db.tasks.push(mkTask({ title: titles[(i + k) % titles.length], due_date: day(-i - (k === 2 ? 0 : 0)), priority: k === 0 ? 'high' : 'medium',
    life_area_id: [A('work'), A('projects'), A('finance')][(i + k) % 3], completed_at: i % 7 === 0 && k === 0 ? null : at(d, w === 2 || w === 4 ? 10 : 18, 10 + k * 7) }));
}
const gSave = uid();
db.tasks.push(
  mkTask({ title: 'Send invoice to Acme', due_date: day(-2), priority: 'high', life_area_id: A('finance') }),
  mkTask({ title: 'Book dentist appointment', due_date: day(-1), life_area_id: A('relationships') }),
  mkTask({ title: 'Finish pitch deck', due_date: today, priority: 'high', life_area_id: A('projects') }),
  mkTask({ title: 'Reply to customer emails', due_date: today, life_area_id: A('work') }),
  mkTask({ title: 'Buy groceries for the week', due_date: today, priority: 'low', life_area_id: A('food-shopping') }),
  mkTask({ title: 'Plan tomorrow', due_date: day(1), life_area_id: A('work') }),
  mkTask({ title: 'Team sync preparation', due_date: day(2), life_area_id: A('work') }),
  mkTask({ title: 'Deposit savings', due_date: today, goal_id: gSave, life_area_id: A('finance'), completed_at: at(today, 8, 5) }),
);
const gLong = uid(), gAnnual = uid(), gWeek = uid(), gBooks = uid();
const mkGoal = (o: any) => ({ id: uid(), user_id: U, parent_goal_id: null, pillar_id: null, life_area_id: null, description: null, success_criteria: null, notes: null,
  priority: 'medium', status: 'active', start_date: null, target_date: null, measurement_type: 'percentage', target_value: null, current_value: 0, unit: null,
  completed_at: null, created_at: at(day(-60), 9), ...o });
db.goals = [
  mkGoal({ id: gLong, title: 'Become a financially independent entrepreneur', goal_type: 'long_term', pillar_id: P('Financial'), life_area_id: A('projects'), start_date: day(-60), target_date: day(900), priority: 'high' }),
  mkGoal({ id: gAnnual, parent_goal_id: gLong, title: 'Build a sustainable business income stream', goal_type: 'annual', pillar_id: P('Financial'), life_area_id: A('projects'), start_date: day(-60), target_date: day(300), measurement_type: 'currency', target_value: 3000000, current_value: 450000, unit: 'XAF' }),
  mkGoal({ id: gSave, parent_goal_id: gAnnual, title: 'Save 200,000 XAF this month', goal_type: 'monthly', pillar_id: P('Financial'), life_area_id: A('finance'), start_date: day(-24), target_date: day(6), measurement_type: 'currency', target_value: 200000, current_value: 50000, unit: 'XAF', priority: 'high' }),
  mkGoal({ id: gWeek, parent_goal_id: gSave, title: 'Contact 10 prospective customers', goal_type: 'weekly', pillar_id: P('Professional'), life_area_id: A('projects'), start_date: day(-3), target_date: day(4), measurement_type: 'numeric', target_value: 10, current_value: 6, unit: 'contacts' }),
  mkGoal({ id: gBooks, title: 'Read 12 books this year', goal_type: 'annual', pillar_id: P('Character'), life_area_id: A('reading-study'), start_date: day(-200), target_date: day(160), measurement_type: 'numeric', target_value: 12, current_value: 8, unit: 'books' }),
  mkGoal({ title: 'Run a 5 km without stopping', goal_type: 'quarterly', pillar_id: P('Health'), life_area_id: A('fitness'), start_date: day(-30), target_date: day(60), measurement_type: 'milestones' }),
];
const g5k = db.goals[5].id;
db.goal_milestones = [
  { id: uid(), user_id: U, goal_id: g5k, title: 'Run 1 km', due_date: null, completed_at: at(day(-20), 7), sort_order: 0, created_at: at(day(-30), 9) },
  { id: uid(), user_id: U, goal_id: g5k, title: 'Run 3 km', due_date: null, completed_at: null, sort_order: 1, created_at: at(day(-30), 9) },
  { id: uid(), user_id: U, goal_id: g5k, title: 'Run 5 km', due_date: null, completed_at: null, sort_order: 2, created_at: at(day(-30), 9) },
];
db.journal_entries = [
  { id: uid(), user_id: U, life_area_id: null, entry_date: day(-1), mood: 4, title: null, content: 'Good focus in the morning. I lost an hour on social media after lunch.', ai_reflection: null, created_at: at(day(-1), 21) },
];
// Another user's data, to prove isolation
db.goals.push(mkGoal({ id: '99999999-9999-4999-8999-999999999999', user_id: OTHER, title: 'SOMEONE ELSES GOAL', goal_type: 'monthly' }));

// ---------- fake query builder ----------
const DEFAULTS: Record<string, () => any> = {
  tasks: () => ({ priority: 'medium', notes: null, due_date: null, goal_id: null, life_area_id: null, completed_at: null }),
  habits: () => ({ frequency: 'daily', days_of_week: null, target_per_period: 1, start_date: today, reminder_enabled: false, paused_at: null, archived_at: null, goal_id: null, life_area_id: null, description: null, preferred_time: null }),
  goals: () => ({ status: 'not_started', priority: 'medium', measurement_type: 'percentage', current_value: 0, completed_at: null, parent_goal_id: null, pillar_id: null, life_area_id: null, target_value: null, unit: null, description: null, start_date: null, target_date: null }),
  debts: () => ({ status: 'active', direction: 'owed_by_me', currency: 'XAF' }),
  goal_milestones: () => ({ due_date: null, completed_at: null, sort_order: 0 }),
  journal_entries: () => ({ entry_date: today, mood: null, title: null, ai_reflection: null, life_area_id: null }),
  ledger_accounts: () => ({ balance: 0, locked: false, metadata: {} }),
  payment_requests: () => ({ status: 'pending', provider_reference: null, transaction_id: null, failure_code: null, metadata: {} }),
  vault_settings: () => ({ emergency_share: 20, lock_accepted_at: null }),
};
class Q {
  op = 'select'; payload: any; filters: ((r: any) => boolean)[] = []; mode: 'many' | 'single' | 'maybe' = 'many';
  orders: any[] = []; rng: [number, number] | null = null; lim: number | null = null; wantCount = false; onConflict: string[] | null = null; embed = false;
  constructor(public table: string) {}
  select(cols?: string, o?: any) { if (this.op === 'select' || !this.payload) this.op = this.op === 'select' ? 'select' : this.op; if (o?.count) this.wantCount = true; if (cols?.includes('life_area_pillars')) this.embed = true; this.returning = true; return this; }
  returning = false;
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  upsert(p: any, o?: any) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict?.split(',') ?? null; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: any) { this.filters.push((r) => r[k] !== v); return this; }
  is(k: string, v: any) { this.filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return this; }
  gte(k: string, v: any) { this.filters.push((r) => r[k] != null && r[k] >= v); return this; }
  lte(k: string, v: any) { this.filters.push((r) => r[k] != null && r[k] <= v); return this; }
  in(k: string, vs: any[]) { this.filters.push((r) => vs.includes(r[k])); return this; }
  not(k: string, op: string, v: any) {
    if (op === 'is') this.filters.push((r) => (v === null ? r[k] != null : r[k] !== v));
    else if (op === 'in') { const list = String(v).replace(/[()]/g, '').split(','); this.filters.push((r) => !list.includes(r[k])); }
    return this;
  }
  or(expr: string) {
    const conds = expr.split(',').map((c) => { const [k, op, ...rest] = c.split('.'); const v = rest.join('.'); return (r: any) => op === 'is' ? (v === 'null' ? r[k] == null : r[k] === v) : op === 'gte' ? r[k] != null && r[k] >= v : op === 'lte' ? r[k] != null && r[k] <= v : r[k] === v; });
    this.filters.push((r) => conds.some((c) => c(r))); return this;
  }
  order(k: string, o: any = {}) { this.orders.push([k, o.ascending !== false]); return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  run() {
    const rows = (db[this.table] ??= []);
    const apply = (arr: any[]) => arr.filter((r) => this.filters.every((f) => f(r)));
    let result: any[] = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const p of list) {
        if (this.op === 'upsert' && this.onConflict) {
          const ex = rows.find((r) => this.onConflict!.every((k) => r[k] === p[k]));
          if (ex) { Object.assign(ex, p); result.push(ex); continue; }
        }
        // fake of the DB-level FK / RLS-ish checks we care about
        if (this.table === 'habit_completions' && !db.habits.some((h) => h.id === p.habit_id)) return { data: null, error: { code: '23503', message: 'fk violation' } };
        const row = { id: uid(), created_at: new Date().toISOString(), ...(DEFAULTS[this.table]?.() ?? {}), ...p };
        rows.push(row); result.push(row);
      }
    } else if (this.op === 'update') {
      result = apply(rows); result.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      const del = new Set(apply(rows)); db[this.table] = rows.filter((r) => !del.has(r)); result = [];
      return { data: null, error: null };
    } else result = apply(rows);

    if (this.op === 'select') {
      for (const [k, asc] of [...this.orders].reverse()) result = [...result].sort((a, b) => {
        const x = a[k], y = b[k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); });
    }
    const total = result.length;
    if (this.rng) result = result.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim !== null) result = result.slice(0, this.lim);
    if (this.embed && this.table === 'life_areas') result = result.map((a) => ({ ...a, life_area_pillars: db.life_area_pillars.filter((l) => l.life_area_id === a.id).map((l) => ({ pillar_id: l.pillar_id })) }));
    const out = result.map((r) => JSON.parse(JSON.stringify(r)));
    if ((this.op === 'insert' || this.op === 'update' || this.op === 'upsert') && !this.returning) return { data: null, error: null };
    if (this.mode === 'single') return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null };
    return { data: out, error: null, count: this.wantCount ? total : null };
  }
  then(res: any, rej: any) { try { return Promise.resolve(this.run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
}
const fakeDb = { from: (t: string) => new Q(t) };

// ---------- stub auth + Claude ----------
const authPath = require.resolve(`${SRC}/middleware/auth.ts`);
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, children: [], paths: [], exports: {
  requireAuth: (req: any, res: any, next: any) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    req.userId = U; req.accessToken = 'x'; req.sessionId = (req.headers['x-test-session'] as string) || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; req.db = fakeDb; next();
  } } } as any;

const sbPath = require.resolve(`${SRC}/config/supabase.ts`);
const deletedUsers: string[] = [];
const killedAuthSessions: string[] = [];
// Tiny in-memory auth: users by email, OTP is always 123456
const users = new Map<string, { id: string; email: string; password: string; confirmed: boolean }>();
users.set('joseph@example.com', { id: U, email: 'joseph@example.com', password: 'Passw0rdOK', confirmed: true });
const b64u = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Looks like a real Supabase JWT (the app decodes the expiry); the signature is fake because the fake backend never checks it.
const mkSession = (id: string) => { const exp = Math.floor(Date.now() / 1000) + 3600; return { access_token: `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', exp, role: 'authenticated' })}.sig`, refresh_token: `ref.${id}`, expires_in: 3600, expires_at: exp }; };
const authErr = (message: string, status = 400) => ({ message, status });
const fakeAnon = { auth: {
  signUp: async ({ email, password, options }: any) => {
    const d = options?.data ?? {};
    if (d.phone && db.profiles.some((p) => p.phone === d.phone)) return { data: {}, error: authErr('Database error saving new user', 500) };
    if (!users.has(email)) {
      const id = uid(); users.set(email, { id, email, password, confirmed: false });
      db.profiles.push({ id, display_name: d.first_name, first_name: d.first_name, last_name: d.last_name, phone: d.phone ?? null, timezone: 'Africa/Douala', currency: 'XAF', language: 'en', preferences: {}, onboarding_completed: false });
    }
    return { data: { user: { id: users.get(email)!.id }, session: null }, error: null };
  },
  verifyOtp: async ({ email, token, type }: any) => {
    const u = users.get(email);
    if (!u || token !== '123456') return { data: {}, error: authErr('Token has expired or is invalid') };
    if (type === 'email') u.confirmed = true;
    return { data: { user: { id: u.id, email }, session: mkSession(u.id) }, error: null };
  },
  resend: async () => ({ data: {}, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  signInWithPassword: async ({ email, password }: any) => {
    const u = users.get(email);
    if (!u || u.password !== password) return { data: {}, error: authErr('Invalid login credentials') };
    if (!u.confirmed) return { data: {}, error: authErr('Email not confirmed') };
    return { data: { user: { id: u.id, email }, session: mkSession(u.id) }, error: null };
  },
  getUser: async () => ({ data: { user: { id: U } }, error: null }),
} };
const fakeAdmin = {
  from: (t: string) => new Q(t),
  rpc: async (name: string, args: any) => {
    if(name==='ensure_wallet')return{data:db.wallets.find((w)=>w.user_id===args.p_user),error:null};
    if(name==='post_ledger_transaction'){
      const existing=db.transactions.find((t)=>t.user_id===args.p_user&&t.idempotency_key===args.p_idempotency_key);if(existing)return{data:existing,error:null};
      const total=args.p_entries.reduce((n:number,e:any)=>n+e.amount,0);if(total!==0)return{data:null,error:{message:'Transaction entries must balance'}};
      for(const e of args.p_entries){const a=db.ledger_accounts.find((x)=>x.id===e.account_id);if(!a)return{data:null,error:{message:'Ledger account missing'}};if(a.kind==='wallet'&&a.balance+e.amount<0)return{data:null,error:{message:'Insufficient wallet balance'}};}
      const tx={id:uid(),user_id:args.p_user,wallet_id:walletId,idempotency_key:args.p_idempotency_key,kind:args.p_kind,status:'succeeded',amount:args.p_amount,currency:'XAF',metadata:args.p_metadata??{},created_at:new Date().toISOString()};db.transactions.push(tx);
      for(const e of args.p_entries){const a=db.ledger_accounts.find((x)=>x.id===e.account_id);a.balance+=e.amount;db.ledger_entries.push({id:uid(),transaction_id:tx.id,account_id:e.account_id,amount:e.amount,created_at:new Date().toISOString()});}return{data:tx,error:null};
    }
    killedAuthSessions.push(`${name}:${args.p_session ?? 'others-keep-' + args.p_keep}`); return { data: null, error: null };
  },
  auth: { admin: {
    deleteUser: async (id: string) => { deletedUsers.push(id); return { error: null }; },
    getUserById: async (id: string) => { const u = [...users.values()].find((x) => x.id === id); return { data: { user: u ? { id, email: u.email } : null }, error: null }; },
    updateUserById: async (id: string, patch: any) => { const u = [...users.values()].find((x) => x.id === id); if (u && patch.password) u.password = patch.password; return { data: {}, error: null }; },
    signOut: async () => ({ error: null }),
  } },
};
require.cache[sbPath] = { id: sbPath, filename: sbPath, loaded: true, children: [], paths: [], exports: {
  createUserClient: () => fakeDb, anonClient: fakeAnon, adminClient: fakeAdmin } } as any;
(globalThis as any).__fake = { killedAuthSessions, deletedUsers };

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.anthropic.com')) {
    const body = JSON.parse(init.body);
    const user = body.messages[0].content as string;
    let text = 'Focus on finishing your pitch deck first, then protect your reading time. Your meditation streak is at risk today, so do it early. You are doing well: eleven days of reading in a row.';
    if (String(body.system).includes('JSON only')) text = 'Here you go:\n{"steps":[{"title":"Open a dedicated savings wallet and move 50,000 XAF","goal_type":"weekly","rationale":"Separating the money removes daily temptation."},{"title":"Set aside 5,000 XAF every day","goal_type":"daily","rationale":"A small fixed amount is easier to keep than a big weekly one."}]}';
    else if (user.includes('<entry')) text = 'It sounds like you had real focus early and then drifted after lunch. A pattern worth noticing: the dip follows social media. Try putting the phone in another room for the first hour after lunch.';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
}) as any;

const { createApp } = require(`${SRC}/app.ts`);
createApp().listen(Number(process.env.PORT), () => console.log(`HARNESS_READY port ${process.env.PORT} today=${today}`));
