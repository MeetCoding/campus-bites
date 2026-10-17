# CLAUDE.md — Campus Bites

Official IIT Roorkee dining platform: mess menus & timings, hostel canteens, campus eateries, mess rebates, and an accountable complaint system.

**Read before working:**
- [`PRD.md`](./PRD.md) — product scope, roles, modules (source of truth for *what*).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — routing/security boundary, data model, flows (source of truth for *how*).
- [`TASKS.md`](./TASKS.md) — ordered checklist. Work top-down; do not skip dependencies.
- [`stitch-reference/`](./stitch-reference/) — Stitch screen exports (`*/code.html`, `*/screen.png`) and `alexandria/DESIGN.md`.

## Stack (zero Docker)
- `apps/mobile` — Expo (latest stable SDK, pinned in `package.json`), Expo Router, NativeWind v4 (Tailwind CSS 3.4 — NativeWind v4 is **not** compatible with Tailwind v4), TypeScript strict.
- `apps/api` — FastAPI, Pydantic v2, Python 3.12, `uv`.
- `supabase/` — Supabase CLI project **linked to the cloud dev project** (`sdjghovuyhsiyufhmlga`). There is no local Supabase stack: never run `supabase start`.

## Repository layout
```
campus-bites/
├── apps/
│   ├── mobile/
│   │   ├── app/                    # Expo Router routes only (thin screens)
│   │   │   ├── _layout.tsx         # providers: QueryClient, Session, fonts, theme
│   │   │   ├── (auth)/             # sign-in (Google / vendor OTP), bhawan onboarding
│   │   │   ├── (student)/          # tabs: home, mess, canteens, eateries, complaints, rebates
│   │   │   ├── (staff)/            # vendor + mess/bhawan secretary consoles
│   │   │   ├── (authority)/        # mess authority (rebates), ADoSW (eatery complaints)
│   │   │   └── (admin)/            # whitelist + role assignment
│   │   ├── components/ui/          # design-system primitives (Button, Card, Pill, Badge, ZoomableImage…)
│   │   ├── features/<module>/      # mess, canteens, eateries, rebates, complaints, auth: hooks, components, queries
│   │   ├── lib/
│   │   │   ├── supabase.ts         # single supabase-js client (SecureStore session adapter)
│   │   │   ├── api.ts              # single FastAPI client; attaches session JWT
│   │   │   ├── images.ts           # compressForUpload() — expo-image-manipulator
│   │   │   ├── time.ts             # IST helpers, open-now / overnight shift logic
│   │   │   └── database.types.ts   # GENERATED — do not edit
│   │   ├── theme/                  # tokens re-exported for non-className use
│   │   ├── tailwind.config.js      # Alexandria tokens
│   │   └── global.css
│   └── api/
│       ├── pyproject.toml
│       ├── app/
│       │   ├── main.py             # app factory, routers, CORS
│       │   ├── core/               # config.py (pydantic-settings), auth.py (JWKS verify, CurrentUser dep), supabase.py (service client)
│       │   ├── routers/            # rebates.py, complaints.py, timings.py, admin.py, internal.py — thin
│       │   ├── schemas/            # Pydantic v2 request/response models
│       │   └── services/           # business logic: rebates, complaints, escalation, timings, push
│       └── tests/                  # pytest; mirrors services/ and routers/
├── supabase/
│   ├── config.toml
│   ├── migrations/                 # <timestamp>_<name>.sql — the only way schema changes
│   └── seed.sql                    # 18 Bhawans, outlets, default timings, eateries
├── stitch-reference/               # design reference — read-only
├── PRD.md  ARCHITECTURE.md  CLAUDE.md  TASKS.md
```

## Boundary rules (summary of ARCHITECTURE.md §3)
- **Direct Expo → Supabase**: auth, all reads, Realtime, Storage uploads, owner-scoped CRUD that RLS fully expresses (vendor menu/stock/open toggle, weekly menu, extra items, fixed-rate card, complaint *creation*, push tokens).
- **Expo → FastAPI**: rebates (submit + transitions), complaint status transitions, nudges, timing overrides (+ push), admin whitelist/roles. Anything with cross-row validation, a state machine, a cooldown, or a push notification.
- **pg_cron → FastAPI** `/internal/escalations/run` for the 48 h sweep.
- If you're unsure where a new write belongs, it goes through FastAPI.

## Mobile coding constraints
- **Routing**: Expo Router file-based routes. Role groups guard themselves in their `_layout.tsx` using the session's `app_role` claim; redirect, never render-then-hide.
- **Styling**: NativeWind v4 `className` only. No `StyleSheet.create` except measured perf hotspots or reanimated styles. No inline hex colors — use tokens.
- **Data**: TanStack Query for all server state; query keys live in `features/<module>/queries.ts`. Supabase reads via typed client (`Database` from `database.types.ts`). Realtime subscriptions invalidate queries, they don't hold state.
- **FastAPI calls**: only through `lib/api.ts`. Never call `fetch` to the API elsewhere.
- **Images**: display with `expo-image` (disk cache). **Every upload must pass through `compressForUpload()`** in `lib/images.ts` (`expo-image-manipulator`: long edge ≤ 2560 px, JPEG ≈ 0.82; ≤ 1600 px for complaint/rebate attachments). Pinch-to-zoom viewer = `react-native-gesture-handler` + `react-native-reanimated`.
- **Auth**: native Google Sign-In → `signInWithIdToken`; vendor `signInWithOtp({ phone })`. Session persisted with an `expo-secure-store` adapter. Requires a dev build (not Expo Go).
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
- API-only tables/columns get no `insert/update/delete` policy for `authenticated`.
- After every migration: regenerate types (`npx supabase gen types typescript --linked > apps/mobile/lib/database.types.ts`) and run Supabase security advisors; fix all ERROR findings before moving on.
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
npx expo start --dev-client          # dev server for the dev build
npx expo run:android                 # local dev build (or: eas build --profile development)
npx tsc --noEmit                     # typecheck (also runs automatically after edits via hook)
npx expo lint
npx expo install <pkg>               # always use this for RN/Expo deps (SDK-compatible versions)

# API (apps/api)
cd apps/api && uv sync
uv run fastapi dev app/main.py       # http://127.0.0.1:8000/docs
uv run pytest
uv run ruff check . && uv run ruff format .

# Supabase (repo root)
npx supabase login
npx supabase link --project-ref sdjghovuyhsiyufhmlga
npx supabase migration new <name>
npx supabase db push                 # apply pending migrations to the linked project
npx supabase gen types typescript --linked > apps/mobile/lib/database.types.ts
```

## Working agreements
- Execute `TASKS.md` in order; tick `[x]` when a task's done-criterion is met. One task (or a tight group) per commit.
- Do not write code that the current task doesn't need. No speculative abstractions.
- Never read or print `.env*` files (blocked in settings). Add new vars to `.env.example` with a placeholder.
- Keep `ARCHITECTURE.md` in sync when a boundary, table, or endpoint changes — in the same commit.
- Before marking a milestone done: `npx tsc --noEmit`, `uv run pytest`, security advisors clean.
