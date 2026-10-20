# CLAUDE.md — Campus Bites

Official IIT Roorkee dining platform: mess menus & timings, hostel canteens, campus eateries, mess rebates, and an accountable complaint system.

**Read before working:**
- [`PRD.md`](./PRD.md) — product scope, roles, modules (source of truth for *what*).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — routing/security boundary, data model, flows (source of truth for *how*).
- [`TASKS.md`](./TASKS.md) — ordered checklist. Work top-down; do not skip dependencies.
- [`stitch-reference/`](./stitch-reference/) — Stitch screen exports (`*/code.html`, `*/screen.png`) and `alexandria/DESIGN.md`.

## Stack (zero Docker)
- `apps/mobile` — Expo SDK 58 (React Native 0.88, React 19.3, React Compiler on), Expo Router, NativeWind 4.2 (Tailwind CSS 3.4 — NativeWind v4 is **not** compatible with Tailwind v4), TypeScript 6 strict. See `apps/mobile/AGENTS.md`: check the versioned Expo docs before using any Expo API.
- `apps/web` — admin website: Vite 8, React 19, React Router 7, TanStack Query, Tailwind CSS 4 (allowed here: no NativeWind), TypeScript 6 strict. Same boundary as the app: reads via supabase-js (publishable key), writes via FastAPI.
- `apps/api` — FastAPI, Pydantic v2, Python 3.12 (uv-managed, non-packaged app), `uv`.
- `supabase/` — Supabase CLI project **linked to the cloud dev project** (`sdjghovuyhsiyufhmlga`). There is no local Supabase stack: never run `supabase start`.

## Repository layout
```
campus-bites/
├── apps/
│   ├── mobile/
│   │   ├── src/                    # `@/` alias → src/
│   │   │   ├── app/                # Expo Router routes only (thin screens)
│   │   │   │   ├── _layout.tsx     # imports global.css; fonts, splash, QueryClient (+ Session in M2)
│   │   │   │   ├── (auth)/         # sign-in (Google / vendor phone + passcode); onboarding.tsx = Bhawan or "no hostel"
│   │   │   │   ├── (student)/      # stack: home, mess, canteens, eateries, eatery/[id], rebates (+ complaints in M6)
│   │   │   │   ├── (staff)/        # vendor + mess/bhawan secretary consoles
│   │   │   │   ├── (authority)/    # mess authority (rebates), ADoSW (eatery complaints)
│   │   │   │   └── (admin)/        # whitelist + role assignment
│   │   │   ├── components/ui/      # primitives: Button, Card, Pill, Badge, Screen, SectionHeader, TextField, ZoomableImage, HeroCard, IconBadge, LiveDot, PressableScale, Segmented
│   │   │   ├── features/<module>/  # mess, canteens, eateries, rebates, complaints, auth, map: hooks, components, queries
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts     # single supabase-js client (chunked SecureStore session, PKCE)
│   │   │   │   ├── api.ts          # single FastAPI client; attaches session JWT
│   │   │   │   ├── images.ts       # compressForUpload() — expo-image-manipulator
│   │   │   │   ├── haptics.ts      # selectionTap / impactTap / successTap (expo-haptics, never throws)
│   │   │   │   ├── time.ts         # IST helpers, open-now / overnight shift logic
│   │   │   │   ├── cn.ts           # className join helper
│   │   │   │   └── database.types.ts # GENERATED — do not edit
│   │   │   ├── theme/tokens.js     # Alexandria tokens (CommonJS; also imported from TS for hex values)
│   │   │   └── global.css          # @tailwind directives
│   │   ├── tailwind.config.js      # extends theme from src/theme/tokens.js
│   │   ├── babel.config.js / metro.config.js / nativewind-env.d.ts
│   │   └── .env.example            # copy to .env.local (only EXPO_PUBLIC_* values)
│   ├── web/                        # admin website: Vite + React + Tailwind 4 (tokens from apps/mobile/src/theme/tokens.js)
│   │   ├── src/lib/                # supabase.ts (publishable key), api.ts (FastAPI), session.tsx (admin-only gate)
│   │   ├── src/features/           # admins, vendors (whitelist, passcodes, master vendors), hostels, eateries
│   │   └── .env.example            # copy to .env.local (only VITE_* values)
│   └── api/
│       ├── pyproject.toml          # deps, ruff + pytest config
│       ├── env.example             # copy to .env.local (git-ignored; Render uses its Environment tab)
│       ├── app/
│       │   ├── main.py             # app factory, routers, CORS
│       │   ├── core/               # config.py (pydantic-settings), auth.py (JWKS verify, CurrentUser dep), supabase.py (service client), time.py (IST)
│       │   ├── routers/            # rebates.py, complaints.py, timings.py, admin.py, internal.py — thin
│       │   ├── repositories/       # data access via the service-role client, behind Protocols (tests use in-memory fakes); roles.py = shared live role checks
│       │   ├── schemas/            # Pydantic v2 request/response models
│       │   └── services/           # business logic: rebates, complaints, escalation, timings, push
│       └── tests/                  # pytest; mirrors services/ and routers/
├── supabase/
│   ├── config.toml
│   ├── migrations/                 # 001_init, 002_grants, 003_auth, then <timestamp>_<name>.sql — the only way schema changes
│   ├── tests/                      # SQL regression tests, each in a rolled-back transaction (auth_rls_test.sql, mess_test.sql, canteens_test.sql, rebates_test.sql, complaints_test.sql, admin_campus_test.sql, maps_test.sql, admin_web_test.sql, master_vendors_test.sql; plus read-only hardening_test.sql)
│   └── seed.sql                    # 11 Bhawans × 3 outlets, 4 eateries, V1 vendor whitelist
├── stitch-reference/               # design reference — read-only
├── PRD.md  ARCHITECTURE.md  CLAUDE.md  TASKS.md
```

## Boundary rules (summary of ARCHITECTURE.md §2.1, §3.4)
- **Direct Expo → Supabase**: auth, all reads, Realtime, Storage uploads, owner-scoped CRUD that RLS fully expresses (vendor menu/stock/open toggle, weekly menu, extra items, fixed-rate card, complaint *creation*, push tokens).
- **Expo → FastAPI**: rebates (submit + transitions), complaint status transitions, nudges, timing overrides (+ push), admin whitelist/roles. Anything with cross-row validation, a state machine, a cooldown, or a push notification.
- **pg_cron → FastAPI** `/internal/escalations/run` for the 48 h sweep.
- If you're unsure where a new write belongs, it goes through FastAPI.

## Mobile coding constraints
- **Routing**: Expo Router file-based routes. Access is gated in `src/app/_layout.tsx` with `Stack.Protected` guards driven by `useSession()` (signed-in, onboarding, current mode); `src/app/index.tsx` is the anchor that redirects to the right home. Multi-role users switch mode via `AccountPanel`. Never render-then-hide.
- **Styling**: NativeWind v4 `className` only. No `StyleSheet.create` except measured perf hotspots or reanimated styles. No inline hex colors — use tokens.
- **Data**: TanStack Query for all server state; query keys live in `features/<module>/queries.ts`. Supabase reads via typed client (`Database` from `database.types.ts`). Realtime subscriptions invalidate queries, they don't hold state.
- **FastAPI calls**: only through `lib/api.ts`. Never call `fetch` to the API elsewhere.
- **Images**: display with `expo-image` (disk cache). **Every upload must pass through `compressForUpload()`** in `lib/images.ts` (`expo-image-manipulator`: long edge ≤ 2560 px, JPEG ≈ 0.82; ≤ 1600 px for complaint/rebate attachments). Pinch-to-zoom viewer = `react-native-gesture-handler` + `react-native-reanimated`.
- **Auth**: Google via `signInWithOAuth` (PKCE) + `expo-web-browser` `openAuthSessionAsync` + `exchangeCodeForSession`, redirecting to `campusbites://` / `exp://`. Vendors via `signInWithPassword({ phone, password })`; the field is labelled "6-Digit Vendor Passcode". Passcodes are set by admins in the admin website (FastAPI → Supabase Auth admin API) and stored only as password hashes — never hard-code, log or commit one. Session persisted with an `expo-secure-store` adapter.
- **Business constants** (`min_rebate_days`, 48 h long-standing, 7-day nudge eligibility, 24 h cooldown) come from the `app_settings` row — never hard-code them in the app or API.
- **Secrets**: only `EXPO_PUBLIC_*` vars in the app. Never import or reference the Supabase secret/service-role key in `apps/mobile`.
- **Time**: all "open now" / "closes at" / 48 h logic uses IST helpers in `lib/time.ts`; handle overnight windows (`closes_at < opens_at`).
- **TypeScript**: `strict: true`, no `any`, no `@ts-ignore` without a comment explaining why.
- **Money**: integer paise end-to-end; format only at render (`₹` with `Intl.NumberFormat('en-IN')`).

## API coding constraints
- **Pydantic v2 only**: `model_config = ConfigDict(...)`, `field_validator` / `model_validator`, `pydantic-settings` `BaseSettings` for config. No v1 `class Config`, no `@validator`.
- **Auth**: every `/v1` route depends on `CurrentUser` (JWT verified against Supabase JWKS, `aud=authenticated`). Role/scope checks happen in the service layer using JWT claims **and** a DB re-check for privileged actions.
- **Supabase access**: one service-role client from `core/supabase.py`. Prefer single-statement conditional updates (`UPDATE … WHERE <precondition> RETURNING`) or Postgres RPCs for race-sensitive logic (nudge cooldown, state transitions).
- **Layering**: routers parse/serialize only; business rules live in `services/`; every rule has a unit test.
- **Async**: `async def` endpoints, `httpx.AsyncClient` for Expo Push; batch push ≤ 100 messages per request, handle receipts, delete `DeviceNotRegistered` tokens.
- **Errors**: raise `HTTPException` with stable `detail.code` strings (e.g. `REBATE_OVERLAP`, `NUDGE_COOLDOWN`) the app maps to copy.
- **Lint/format**: `ruff` (lint + format). Type hints everywhere.

## Database constraints
- Schema changes **only** via `npx supabase migration new <name>` → edit SQL → `npx supabase db push`. Never edit the remote schema by hand or via ad-hoc SQL.
- Enable RLS and write policies **in the same migration** that creates a table. Default deny.
- Grant table privileges explicitly (`grant select … to authenticated`); never rely on Supabase's default Data API grants (being made opt-in). `anon` gets nothing.
- API-only tables/columns get no `insert/update/delete` policy for `authenticated`.
- After every migration: regenerate types (`npx supabase gen types typescript --linked > apps/mobile/src/lib/database.types.ts`) and run Supabase security advisors; fix all ERROR findings before moving on.
- Snake_case names, `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` via `moddatetime` trigger.
- **Never** run `npx supabase db reset --linked` (it wipes the cloud DB; blocked in settings).

## Design rules (Alexandria — `stitch-reference/alexandria/DESIGN.md`)
- Colors / spacing / type-size / radius tokens come from the Stitch export `tailwind.config` (primary `#094cb2`, tertiary gold `#6d5e00`, surface tiers `surface-container-lowest → surface-dim`).
- Where exports and DESIGN.md disagree, **DESIGN.md wins**:
  - Fonts: Noto Serif (headlines), Inter (body), Public Sans (labels) — not Plus Jakarta Sans.
  - **No-Line Rule**: no 1 px borders; separate with surface-tier shifts. If unavoidable, ghost border = `outline-variant` at 15 % opacity.
  - Depth via tonal layering, not shadows; modals only get a diffused 4–6 % shadow.
  - Minimum `sm` radius, no sharp corners. One primary action per view; primary buttons use the `primary → primary-container` gradient.
- Status semantics: green pill = open/serving; amber/red `LONG-STANDING ISSUE` badge; tertiary gold for official/verified (institute rate card, signed noticeboard).
- Use screen PNGs for layout intent, not pixel values.

## Commands
Run from the repo root unless noted. (Windows: use Git Bash or PowerShell; paths below are POSIX.)

```bash
# Mobile (apps/mobile)
cd apps/mobile && npm install
npx expo start                       # Expo Go; add --dev-client for a dev build
npx expo run:android                 # local dev build (or: eas build --profile development)
npx tsc --noEmit                     # typecheck (also runs automatically after edits via hook)
npx expo lint
npm test                             # Jest (jest-expo); import describe/it/expect from '@jest/globals'
npx expo install <pkg>               # always use this for RN/Expo deps (SDK-compatible versions)

# Admin website (apps/web)
cd apps/web && npm install
npm run dev                          # http://localhost:5173 (Supabase redirect URL + API CORS origin)
npm run build                        # tsc + vite build → dist/
npm test                             # Vitest

# API (apps/api)
cd apps/api && uv sync
uv run fastapi dev app/main.py       # http://127.0.0.1:8000/docs
uv run pytest
uv run ruff check . && uv run ruff format .
# (if `uv` isn't on PATH: `python -m uv …`)
# Render start command: uv run fastapi run app/main.py --host 0.0.0.0 --port $PORT

# Supabase (repo root)
npx supabase login
npx supabase link --project-ref sdjghovuyhsiyufhmlga
npx supabase migration new <name>
npx supabase db push                 # apply pending migrations to the linked project
npx supabase gen types typescript --linked > apps/mobile/src/lib/database.types.ts
```

## Working agreements
- Execute `TASKS.md` in order; tick `[x]` when a task's done-criterion is met. One task (or a tight group) per commit.
- Do not write code that the current task doesn't need. No speculative abstractions.
- Never read or print `.env*` files (blocked in settings). Add new vars to `apps/mobile/.env.example` / `apps/api/env.example` with a placeholder.
- Keep `ARCHITECTURE.md` in sync when a boundary, table, or endpoint changes — in the same commit.
- Before marking a milestone done: `npx tsc --noEmit`, `npm test`, `npx expo lint`, `apps/web`: `npm run build` + `npm test`, `uv run pytest`, `uv run ruff check .`, the `supabase/tests/*.sql` scripts, and security advisors clean.
