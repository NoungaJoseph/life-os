# MY LIFE OS

*Design your life. Execute your goals. Become better.*

A personal life operating system: Life Vision → 5 Pillars → 10 Life Areas → Goals (long-term to daily) → Tasks and Habits → Reviews.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: monorepo, Express API, Supabase schema + RLS + seed, Render config, design tokens | Done |
| 2 | Auth and onboarding (mobile) | Done. Web app not started |
| 3–4 | Goals, tasks, habits, dashboard, smart insights, AI coach, journal, weekly and monthly reviews (mobile) | Done |
| 5 | Finance, projects, food, fitness, reading, social, relationships, reminders (API + mobile) | Done, tested against a fake DB only |
| 6 | Debts, push reminders, offline reading, EAS config, web companion | Done (see notes) |
| 7 | Real-device and real-Supabase testing, store release | Yours to run (see below) |

## Layout

```
apps/mobile/               Expo React Native app (auth, onboarding, dashboard, goals, planner, coach)
server/                    Express + TypeScript API (/api/v1)
apps/web/                  Next.js web companion (sign in, today, goals, finance)
supabase/migrations/       SQL migrations: core_schema, journal, life_modules, debts_push (date order)
supabase/seed.sql          Default 5 pillars, 10 life areas
packages/design-tokens/    Shared colours, spacing, radii, type sizes
render.yaml                Render deployment blueprint
```

Mobile app: `apps/mobile` (Expo SDK 58, Expo Router, TanStack Query, React Hook Form + Zod). The Next.js web app is not started yet.

## Setup

1. Create a Supabase project. In the SQL editor (or with the Supabase CLI) run `supabase/migrations/*.sql`, then `supabase/seed.sql`.
2. `cp server/.env.example server/.env` and fill in the Supabase URL and keys. The service-role key stays on the server only.
3. `npm install`
4. `npm run dev:server` (API on http://localhost:4000, health check at `/health`)

## API (v1)

All `/api/v1` routes need `Authorization: Bearer <Supabase access token>`. The user ID is taken from the verified token, never from the request.

| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | `/profile` | Read / update profile |
| GET / PUT | `/life-vision` | Read / save life vision |
| GET | `/pillars`, `/life-areas` | Default (and custom) pillars and areas |
| GET | `/me/life-areas` | Areas the user has activated |
| GET / POST | `/goals`, `/goals/:id` | List (filters, pagination, sorting) / create goals |
| PUT | `/me/life-areas/:id` | Activate / deactivate an area `{ "is_active": true }` |
| GET / POST / PATCH / DELETE | `/tasks`, `/tasks/:id` | Tasks. `PATCH { "completed": true }` completes one |
| GET / POST / PATCH | `/habits`, `/habits/:id` | Habits (`paused`, `archived` flags) |
| PUT / DELETE | `/habits/:id/completions/:date` | Mark a habit done / not done for a date |
| PATCH / DELETE | `/goals/:id` | Update progress or status, delete |
| GET / POST / PATCH / DELETE | `/goals/:id/milestones` | Milestones |
| GET / POST / DELETE | `/journal` | Journal entries |
| GET | `/dashboard/today` | Today's priorities, habits, goals, momentum, balance, insights |
| GET | `/insights`, `/goals-overview` | Predictions and behaviour patterns; goals with progress and forecast |
| GET/POST/PATCH/DELETE | `/projects`, `/project-tasks`, `/project-metrics`, `/income`, `/expenses`, `/budgets`, `/savings-goals`, `/savings-transactions`, `/external-savings`, `/daily-reviews`, `/daily-schedules`, `/calendar-events`, `/work-responsibilities`, `/social-platforms`, `/social-content`, `/grocery-lists`, `/grocery-items`, `/food-inventory`, `/meals`, `/meal-plans`, `/food-logs`, `/water-logs`, `/workouts`, `/workout-logs`, `/reading-items`, `/reading-sessions`, `/learning-notes`, `/relationship-notes`, `/reminders` | Generic CRUD (`modules/resources.ts`): validated, owner-scoped, paginated, `?from=&to=` date filters |
| GET / PUT | `/reviews/weekly/current`, `/reviews/weekly/:date`, same for `monthly`; GET `/reviews/weekly` | Review with server-computed stats |
| GET | `/finance/summary?month=`, `/projects/:id/dashboard` | Totals, budgets, savings; project tasks, metrics, profit |
| GET / PUT | `/notification-preferences` | Quiet hours, daily cap |
| GET / DELETE | `/me/export`, `/me` (body `{"confirm":"DELETE"}`) | Data export, account deletion |
| POST | `/ai/coach`, `/ai/goal-breakdown`, `/ai/reflect` | Claude-powered (needs `ANTHROPIC_API_KEY`; rate-limited) |

Responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }`.

## Security notes

- Every user table has RLS (`user_id = auth.uid()`); the API queries with a per-request client acting as the user, so RLS applies even if API code has a bug.
- Request bodies are not logged; the `Authorization` header is redacted.

## Deploy API to Render

Connect the repo and use `render.yaml`; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` in the dashboard.

## Run the mobile app

```
cd apps/mobile
cp .env.example .env     # Supabase URL + anon key, API URL (use your LAN IP on a phone)
npm install
npx expo start
```

In Supabase > Authentication > Email Templates, keep email confirmation enabled and use `{{ .Token }}` in the **Confirm signup** and **Reset password** templates. The mobile app verifies the emailed code directly with Supabase Auth.

Supabase sessions are persisted in encrypted `expo-secure-store` chunks on iOS and Android (with `localStorage` only for the web preview). This avoids the native secure-store payload limit while keeping refresh tokens out of AsyncStorage.

Styling uses NativeWind v4 (Tailwind classes). `src/theme/tokens.ts` is the single source of colours; `src/theme/vars.ts` turns it into CSS variables, so classes like `bg-surface`, `text-ink`, `border-line` follow light and dark mode automatically. A few values that depend on runtime state (animations, conditional colours) still use inline styles.

## Smart features

Predictions and behaviour patterns are calculated from the user's own records in `server/src/services/insights.ts`. They need no AI key and are unit-tested:

- **Goal pace forecast:** compares real progress with the time used, projects a finish date, and flags goals as on track, slipping or behind.
- **Habit streaks and lapse risk:** warns when you are likely to miss a habit today, based on how you did on the same weekday over the last 8 weeks.
- **Behaviour patterns:** your best weekday and hour for finishing tasks, how late tasks tend to finish, and overload warnings.
- **Life balance:** which of the five pillars got attention in the last 14 days. **Momentum:** one 0 to 100 score from habits, tasks and goals.

The AI coach, goal breakdown and journal reflections call the Claude API. Set `ANTHROPIC_API_KEY` in `server/.env` (and in Render) to enable them. The mobile app sends its active `en`/`fr` locale and the API also falls back to `Accept-Language`, so Claude is explicitly instructed to answer in the user's language. The coach only receives summary numbers, never journal text or task notes, except an entry you explicitly ask it to reflect on. Without a key the rest of the app works and the AI screens explain how to enable it.

## Tests

```
cd server
npm test            # unit tests: insights engine, AI output parsing
npm run test:api    # 136 API checks against an in-memory fake database (no Supabase needed)
```

`server/dev/fake-db-server.cts` is development-only test tooling. It fakes the database, auth and the Claude call, and must never be deployed. It does not replace testing against a real Supabase project.

## Run order for Supabase

SQL editor: run `20261102000001_core_schema.sql`, `20261103000001_journal.sql`, `20261104000001_life_modules.sql`, `20261105000001_debts_push.sql`, then `seed.sql`. Fill `server/.env` from `.env.example`.

## Web app

```
cd apps/web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
```
Add `http://localhost:3000` (and your deployed web URL) to `CORS_ORIGINS` on the API. The web app covers sign-in, today (tick tasks and habits), goals and finance; everything else lives in the mobile app.

## Push reminders

Reminders and quiet hours are stored through the API. With `ENABLE_SCHEDULER=true` on exactly one API instance, a once-a-minute job sends due reminders through Expo's push service, respecting weekdays, quiet hours and your daily cap, and never twice per day. A phone must run a development or production build (not Expo Go), tap "Enable notifications" in Settings, and the build needs an EAS project ID (`eas init`).

## Build the mobile app (EAS)

```
cd apps/mobile
npm i -g eas-cli && eas login && eas init
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR.supabase.co --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --visibility plaintext
# edit EXPO_PUBLIC_API_URL in eas.json, then:
eas build --profile preview --platform android    # installable APK
```

## CI/CD pipeline

GitHub Actions runs `.github/workflows/ci.yml` for every pull request and every push to `main`:

- **Server:** clean install, TypeScript check, unit tests, the 136-check fake-database API suite, and production build.
- **Mobile:** clean install, TypeScript check, i18n tests, untranslated-copy audit, and an Expo web export.
- CI uses Node.js 20, matching the server's supported runtime.

API deployment is described by `render.yaml`. Connect this repository to Render as a Blueprint and enable automatic deploys from `main`. Render builds `server/` with `npm install --include=dev && npm run build`, starts it with `npm start`, and checks `/health`. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `CORS_ORIGINS` in Render's secret environment settings; never commit them.

Mobile releases remain an explicit EAS step. Create preview/production builds after CI passes; public Expo variables must be configured in EAS, while server secrets must never enter the mobile build.

## Offline

Screens you have opened keep their last data on the phone for 7 days and show it with an "offline" banner. Saving changes needs a connection (no offline write queue). The cache is wiped on sign out.

## Not built

an offline write queue, iOS/Android store submission, and a real-device test of push. Real Supabase and real Claude calls are untested here; everything was verified against an in-memory fake.
