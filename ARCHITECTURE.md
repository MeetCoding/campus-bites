# Campus Bites — System Architecture

> Official IIT Roorkee dining, mess, canteen & eatery platform.
> Product scope: [`PRD.md`](./PRD.md) · Build order & status: [`TASKS.md`](./TASKS.md) · Repo rules: [`CLAUDE.md`](./CLAUDE.md).
>
> **Status (18 Oct 2026):** M0–M6 built — auth & roles, Mess Hub, canteens & eateries, mess rebates, complaints & accountability (state machine, nudges, 48 h escalation via `pg_cron`). Backend verified end to end against the dev project (51/51 checks); device checks, a production Supabase project and EAS builds remain (see `TASKS.md`).

## 1. Stack at a glance

Three deployable projects plus one managed backend. **No Docker anywhere** (no local Supabase stack, no containers).

| Layer | Tech | Hosting |
| --- | --- | --- |
| Mobile app (`apps/mobile`) | Expo SDK 58 (React Native 0.88, React 19.3, React Compiler) · Expo Router · NativeWind 4 (Tailwind 3.4) · TanStack Query · TypeScript strict | EAS Build |
| Admin website (`apps/web`) | Vite · React 19 · React Router · TanStack Query · Tailwind 4 (same Alexandria tokens) · TypeScript strict | Any static host (SPA fallback to `index.html`) |
| Business API (`apps/api`) | FastAPI · Pydantic v2 · Python 3.12 · `uv` · `supabase-py` (async) · `httpx` | Render web service, native Python runtime |
| Data / Auth / Files / Realtime (`supabase/`) | Supabase Cloud: Postgres 17, GoTrue Auth, PostgREST, Storage, Realtime; extensions `pg_trgm`, `btree_gist`, `moddatetime`, `pg_cron`, `pg_net` | Supabase Cloud — dev project `sdjghovuyhsiyufhmlga` |
| Push | Expo Push Service | Expo |

Timezone for every business rule: **`Asia/Kolkata`** (IST, no DST). Times of day are `time` interpreted in IST; instants are `timestamptz`. Money is integer **paise**, formatted only at render.

## 2. How the app works today

### 2.1 Topology

```
                          ┌───────────────────────────────────────────────┐
                          │                Supabase Cloud                 │
  ┌───────────────┐  (A)  │  Auth ── hook_before_user_created (sign-up)   │
  │  Expo app     │──────▶│       └─ custom_access_token_hook (claims)    │
  │  supabase-js  │◀──────│  PostgREST + RLS · Realtime · Storage         │
  │  publishable  │       │  Postgres 17 (views, RPCs, triggers)          │
  │  key + JWT    │       └──────────────────────────────▲────────────────┘
  │               │  (B) HTTPS  Bearer <user JWT>         │ (C) secret key
  │               │───────────────────┐                   │
  └───────▲───────┘                   ▼                   │
          │                ┌──────────────────────────────┴───────────┐
          │                │ FastAPI: verifies JWT (Supabase JWKS),   │
          │                │ enforces rules, writes as service role   │
          │                └───────────────────┬──────────────────────┘
          │   (D) Expo push (tickets/receipts) │
          └──────────── Expo Push Service ◀────┘
```

- **(A) Direct path** — sign-in, every read, Realtime, Storage uploads, and simple owner-scoped writes. Postgres Row Level Security (RLS) is the guard.
- **(B) API path** — writes with cross-row rules, a workflow/state machine, or a side effect (push): timing overrides, rebates, admin.
- **(C)** FastAPI talks to Supabase with the **secret (service-role) key**, which bypasses RLS — so FastAPI authorises every call itself first.
- **(D)** FastAPI is the **only** sender of push notifications.
- **(E) Scheduled path** — `pg_cron` → `pg_net` → `POST /internal/escalations/run` every 15 min (shared secret from Supabase Vault).

**Rule of thumb for new features:** plain owner-scoped CRUD that RLS can fully express → direct to Supabase. Anything validating several rows, changing a status, depending on time/cooldowns, or notifying other people → FastAPI. When unsure → FastAPI.

### 2.2 Who uses it and what they can do

| Role (`app_role`) | How they get it | App area (mode) | Can do today |
| --- | --- | --- | --- |
| `student` | Automatic for every IITR Google account (except officials, below) | `(student)` | Home dashboard; Mess Hub (live meal status, noticeboard photo + zoom, weekly menu, extra items, report outdated photo); canteens (Day/Night, live status, menu, Institute rate card); eateries directory + food search; apply for mess rebates and track them; raise complaints (≤ 2 photos), confirm/reopen fixes, nudge after 7 days, public anonymised issue board |
| `vendor` | Phone number whitelisted for ≥ 1 outlet | `(staff)` | Per outlet: open/closed toggle, regular hours, temporary shift change, menu photo, menu items + stock, eatery location |
| `mess_secretary` | Assigned by admin (one per Bhawan) | `(staff)` + student | Mess noticeboard photo, weekly menu, extra items, mess timing overrides (residents are pushed); handles mess complaints |
| `bhawan_secretary` | Assigned by admin (per Bhawan) | `(staff)` + student | Same outlet tools as a vendor for both canteens of their Bhawan; Institute fixed-rate card; handles hostel-canteen complaints |
| `mess_authority` (Warden office) | Assigned by admin (per Bhawan) | `(authority)` | Rebate queue for their Bhawan(s): biometric cross-check → approve / reject with remarks; sees (read-only) and is alerted about escalated complaints of their Bhawan |
| `adosw` | Assigned by admin (campus-wide) | `(authority)` | Handles campus-eatery complaints; oversees every complaint, incl. a cross-Bhawan long-standing queue |
| `admin` | Assigned by another admin (first one bootstrapped by SQL, §4.4) | `(admin)` | Vendor whitelist, role assignments, master list of Bhawans and eateries |

A user can hold several roles (e.g. a student who is also Mess Secretary). Officials (`mess_authority`, `adosw`) do **not** also get `student`.

### 2.3 A request, end to end

*Student opens a canteen:* `useLiveStatus()` (TanStack Query) → `supabase.from('outlet_live_status').select()` with the user's JWT → PostgREST runs the view under RLS → the view calls `outlet_status_at()` which computes open/closed in IST (§6.4) → the app renders `OpenStatusPill`. A Realtime subscription on `outlets` / `outlet_shifts` / `menu_items` invalidates the query when a vendor changes something; the query also refetches every 60 s because shift boundaries pass with time.

*Vendor toggles "Closed":* `update outlets set is_open = false` direct to Supabase → RLS policy `app.can_run_outlet(id)` re-checks the whitelist **live** → trigger stamps `status_updated_at = now()` → Realtime notifies every subscribed device → their status query refetches.

*Student submits a rebate:* photo compressed on device → uploaded to the private `rebate-documents/{uid}/…` → `POST /v1/rebates` (via `lib/api.ts`, JWT attached) → FastAPI verifies the JWT against Supabase JWKS → `RebateService` validates every rule (§6.5) → service-role insert → a DB trigger writes the audit event → `201`. When the Mess Authority acts, FastAPI updates conditionally and pushes the student.

## 3. Authentication & access control

### 3.1 Sign-in methods

**IITR Google account** (students, secretaries, authorities, admins)
1. App: `signInWithOAuth({ provider: 'google' })` with PKCE and `skipBrowserRedirect`, opened in an in-app browser (`WebBrowser.openAuthSessionAsync`). `hd=iitr.ac.in` is passed as a UX hint only.
2. Google → Supabase → redirect back to `campusbites://…` (dev/production build) or `exp://…` (Expo Go); both are on the Supabase redirect allow-list.
3. App: `exchangeCodeForSession(code)` (`src/app/auth-callback.tsx`).
   - **Web build** (`expo start --web`, single-page output): no popup — Google's Cross-Origin-Opener-Policy stops a popup handing the code back. The whole page redirects to Google and returns to `<origin>/auth-callback?code=…`, where the screen calls `completeWebGoogleSignIn()`. The origin (e.g. `http://localhost:8081/**`) must be on the redirect allow-list and in the API's `CORS_ORIGINS`.
4. **First sign-in only:** before the user row is created, `public.hook_before_user_created` runs: the identity must be the **google** provider and the email must match `^[^@\s]+@([a-z0-9-]+\.)?iitr\.ac\.in$` (covers `@iitr.ac.in` and every `@<dept>.iitr.ac.in`). Anything else is rejected with a readable error and no account is created. Email/password sign-ups are rejected by the same hook.
5. Trigger `handle_new_user` creates the `profiles` row (email, name, avatar from Google).

**Vendor phone + passcode** (canteen owners, eatery staff)
1. An admin whitelists the phone for an outlet and sets a **6-digit passcode** in the admin website (§4.1). The API creates (or updates) the vendor's Supabase phone account with that passcode as its **password** (`auth.admin.create_user` / `update_user_by_id`, `phone_confirm: true`) and stamps `app_metadata.passcode_set_at`. Only whitelisted phones get an account (`VENDOR_NOT_WHITELISTED`), and `hook_before_user_created` still rejects any phone that is not an **active** `whitelisted_vendors` row. GoTrue stores phones without `+`; the hook and `handle_new_user` normalise to E.164.
2. App: `+91` phone + **"6-Digit Vendor Passcode"** → `signInWithPassword({ phone, password })` in one step. No SMS is sent, so there's no SMS gateway or test-number list to maintain.
3. Supabase stores only a hash: admins can set or reset a passcode but never read it back. Passcodes are exactly 6 digits and not trivially guessable (`000000`, `123456`… refused, API and website share the rule); Supabase's own sign-in rate limits slow guessing. Keep Auth's *leaked password protection* **off** — almost every 6-digit number is in HaveIBeenPwned, so it would refuse them (`PASSCODE_REJECTED`).

**Session storage:** the Supabase session is persisted in `expo-secure-store` (chunked, `src/lib/supabase.ts`), never AsyncStorage. Tokens auto-refresh.

### 3.2 JWT claims (`public.custom_access_token_hook`)

Every access token Supabase issues carries:

| Claim | Meaning | Source |
| --- | --- | --- |
| `roles[]` | All roles, e.g. `["student","mess_secretary"]` | `student` for IITR emails (unless an official), assigned roles from `role_assignments`, `vendor` if the phone has active whitelist rows |
| `app_role` | Highest role (admin > adosw > mess_authority > mess_secretary > bhawan_secretary > vendor > student) | derived |
| `bhawan_id` | The student's own Bhawan (`profiles.bhawan_id`) | profile |
| `scope_bhawan_ids[]` | Bhawans of all Bhawan-scoped role assignments | `role_assignments` |
| `outlet_ids[]` | Outlets the vendor phone is whitelisted for | `whitelisted_vendors` |

Claims are computed when a token is issued, so a change (new role, Bhawan chosen) reaches the token on the next refresh: automatically within the token lifetime (1 h by default), immediately after onboarding (the app calls `refreshSession()`), on "Refresh access" on the no-access screen, or on sign-out/in. **Claims drive UI only.** Every privileged write re-checks the database live (§3.4), so a removed role loses write access immediately even with an old token.

### 3.3 What the app does after sign-in (`src/app/_layout.tsx`, `src/app/index.tsx`)

`SessionProvider` (`features/auth/session.tsx`) decodes the claims (unverified — UI decisions only) and derives:
- **modes** — role groups the user may enter: `student → (student)`, `vendor | mess_secretary | bhawan_secretary → (staff)`, `mess_authority | adosw → (authority)`, `admin → (admin)`. Default mode = the group of `app_role`; multi-role users switch in the Account panel.
- **needsOnboarding** — a student with no Bhawan must pick one first (written once: column grant + RLS + trigger make `profiles.bhawan_id` set-once).

The root stack gates every group with `Stack.Protected guard={…}`; a screen whose guard is false is unreachable (no render-then-hide). `index.tsx` redirects: signed out → `/sign-in`; signed in without any role (e.g. vendor whose whitelist was removed) → `/no-access`; onboarding → `/onboarding`; otherwise the mode's home (`/home`, `/console`, `/review`, `/admin`).

On sign-in the device registers for push (`register_push_token` RPC, which moves a device token to the current user); on sign-out the token is deleted first.

### 3.4 Authorisation layers

1. **RLS on every `public` table, deny by default**, enabled in the migration that creates the table. Explicit grants: `anon` gets nothing; `authenticated` gets `select` plus only the writes a policy allows.
2. **Live scope helpers** (private `app` schema): `app.has_bhawan_role(role, bhawan)`, `app.can_manage_outlet(outlet)` (mess → its Mess Secretary; canteens → Bhawan Secretary or whitelisted vendor; eateries → whitelisted vendor) and `app.can_run_outlet(outlet)` (same, messes excluded). They read `role_assignments` / `whitelisted_vendors` directly, not the JWT.
3. **API-only data has no client write policy:** `app_settings`, `whitelisted_vendors`, `role_assignments`, `timing_overrides`, `rebate_applications`, `rebate_events`, `complaint_events`, `complaint_nudges`, and every `complaints` column except the five a student supplies on insert. Only FastAPI (service role) writes them — complaint changes go through service-role-only RPCs (`complaint_transition`, `complaint_nudge`, `complaint_escalate_due`) that apply the change and its audit event in one statement.
4. **FastAPI** verifies every `/v1` request's JWT (ES256/RS256 via `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, `aud = authenticated`, issuer, expiry, 60 s clock-skew leeway) → `CurrentUser`. `/internal/*` instead requires the `X-Internal-Secret` header (constant-time compare). Services check the JWT role **and** re-check the database (`repositories/roles.py`, `AdminService._ensure_admin`) before acting.
5. **Database triggers as the last line:** set-once Bhawan, legal rebate transitions, audit events, `status_updated_at` pinned to `now()`, one current noticeboard photo per outlet.

### 3.5 Keys & secrets

| Where | What | Secret? |
| --- | --- | --- |
| App bundle | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` (Maps JavaScript API, HTTP-referrer restricted) | No — public by design; RLS protects data |
| Native build config (`app.config.ts`, local `.env.local` or EAS env vars) | `GOOGLE_MAPS_ANDROID_API_KEY`, `GOOGLE_MAPS_IOS_API_KEY` (Maps SDKs, restricted to the app's package/SHA-1 and bundle id) | No — restricted keys, but kept out of the repo |
| FastAPI host (Render env / local `apps/api/.env.local`) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (bypasses RLS), `INTERNAL_CRON_SECRET`, `EXPO_ACCESS_TOKEN?`, `ENVIRONMENT`, `CORS_ORIGINS?` | Yes |
| Admin website bundle (`apps/web/.env.local` / host env) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` | No — public by design |
| Supabase dashboard | Google OAuth client secret; Vault `internal_cron_secret` (generated inside Postgres; copy it to the API's `INTERNAL_CRON_SECRET`) and `api_base_url` | Yes |

Templates: `apps/mobile/.env.example`, `apps/web/.env.example`, `apps/api/env.example` (committed). Vendor passcodes are stored only as Supabase password hashes. Real files (`.env`, `.env.local`) are git-ignored.

## 4. Admin operations (runbook)

All admin actions go through FastAPI (`/v1/admin/*`), which re-checks `admin` in the database on **every** call. Two front ends use it:
- **Admin website** (`apps/web`, §4.6): Vendors (phones, their outlets, passcodes), Eateries (add / rename / remove), Admins (by email).
- **App → `(admin)` area:** Whitelist, Roles, Bhawans and Campus eateries (incl. map pins).

### 4.1 Onboard a vendor (canteen owner / eatery staff)
1. **Website → Vendors → Add a vendor:** phone (`+91…`, normalised to E.164), optional name, the outlet, and a 6-digit passcode (pre-filled with a random one) → `POST /v1/admin/vendor-whitelist` then `POST /v1/admin/vendor-accounts/passcode {phone, passcode}`. One phone may run many outlets (one whitelist row per outlet; *Assign outlet* on the vendor's card); duplicates → `WHITELIST_DUPLICATE`.
2. The website shows the passcode **once** — give it to the vendor privately. Lost it? *Reset passcode* (the old one stops working at once; signed-in devices stay signed in).
3. Vendor signs in with phone + passcode → lands in the Staff console with those outlets.
- **Status:** `GET /v1/admin/vendor-accounts` (service-role RPC `admin_vendor_accounts()`: one row per whitelisted phone with `has_account`, `passcode_set_at`, `last_sign_in_at`).
- **Remove / unassign:** delete the whitelist row (`DELETE /v1/admin/vendor-whitelist/{id}`). Writes stop immediately (live checks); the console disappears at their next token refresh. With no outlets left the account remains but has no role (→ `/no-access`).

### 4.2 Assign a role (secretary, authority, ADoSW, admin)
1. The person signs in once with their IITR Google account (so a profile exists).
2. **App → Admin → Roles:** email + role (+ Bhawan for `mess_secretary`, `bhawan_secretary`, `mess_authority`) → `POST /v1/admin/role-assignments`. Errors: `USER_NOT_FOUND` (hasn't signed in yet), `MESS_SECRETARY_EXISTS` (one per Bhawan — remove the old one first), `ROLE_DUPLICATE`.
3. Their write access is live at once; the new console appears after their next token refresh (or sign-out/in).
- **Revoke:** `DELETE /v1/admin/role-assignments/{id}`. An admin cannot remove their own admin role (`CANNOT_REMOVE_OWN_ADMIN`), so at least one admin always remains.

### 4.3 Change business constants
`app_settings` (single row): `min_rebate_days` (3), `rebate_backdate_days` (0), `long_standing_after_hours` (48), `nudge_eligible_after_hours` (168), `nudge_cooldown_hours` (24), `max_menu_photos` (10). Change with a migration (`update public.app_settings set …`); the app and API read them live. Outlet hours are changed in the app (Staff console), not here.

### 4.4 Admins and the owner
- **Owner:** `app_settings.owner_admin_email` (`meet_s@ece.iitr.ac.in`, set by migration `017`). Migration `017` made the owner an admin (or, on a fresh project, an invite redeemed at first sign-in), and the API refuses to remove the owner's admin role (`OWNER_ADMIN`). Change the owner with a migration.
- **Website → Admins:** add any IITR email → `POST /v1/admin/admins {email}`: an `admin` role assignment if they've signed in before, otherwise a row in `admin_invites`, which `handle_new_user` turns into the role at their first Google sign-in (so the very first token already says admin). `GET /v1/admin/admins` lists both (`status: active | invited`, `is_owner`); `DELETE /v1/admin/admins/{email}` removes either. Errors: `ADMIN_DUPLICATE`, `ADMIN_NOT_FOUND`, `OWNER_ADMIN`, `CANNOT_REMOVE_OWN_ADMIN`.
- The admin website lets in **only** these accounts: after Google sign-in it checks the token's `roles` for `admin` and signs anyone else straight out ("… isn't a Campus Bites admin"). Non-IITR Google accounts are refused earlier by `hook_before_user_created`.

### 4.5 Manage the Bhawans and eateries (master list)
- **App → Admin → Bhawans:** add by name → `POST /v1/admin/bhawans` (slug derived from the name minus "Bhawan", e.g. `kasturba`; appended to the end of lists). The service-role RPC `admin_create_bhawan` creates the Bhawan **and** its Mess, Day Canteen and Night Canteen in one transaction; canteens get default shifts (trigger, §6.4) and the mess uses the institute meal timings. Then assign its secretaries (§4.2) and whitelist the canteen owners (§4.1).
- **Rename / reorder:** `PATCH /v1/admin/bhawans/{id}` (`name`, `sort_order`) → `admin_update_bhawan` renames its three outlets to match; slugs never change.
- **Remove:** `DELETE /v1/admin/bhawans/{id}` → `admin_delete_bhawan`, only for a Bhawan added by mistake: refused with `BHAWAN_IN_USE` once a student has picked it or it has rebate/complaint history. Menus, rate cards, shifts, overrides, whitelist rows and role assignments cascade.
- **App → Admin → Campus eateries:** `POST /v1/admin/eateries` (`name`, optional `location_tag`, optional map pin `latitude` + `longitude`; default 10:00–22:00 hours), `PATCH /v1/admin/eateries/{id}` (only the fields sent; `location_tag: null` clears it; the pin is sent as a pair, both `null` removes it — set by tapping the map), `DELETE /v1/admin/eateries/{id}` (`EATERY_IN_USE` if it has complaints; its menu, hours and whitelist rows cascade). Whitelist the owner afterwards (§4.1).
- **Website → Eateries:** the same `POST` / `PATCH` (name, location) / `DELETE` endpoints, listing each eatery's vendor phones. Map pins stay in the app.
- Errors: `BHAWAN_DUPLICATE` / `EATERY_DUPLICATE` (name or slug taken), `NOTHING_TO_UPDATE`, `INVALID_NAME`, `BHAWAN_NOT_FOUND` / `EATERY_NOT_FOUND`. Mutations refetch every query in the app, since Bhawans and outlets feed most screens.

### 4.6 Admin website (`apps/web`)
- **Sign-in:** Google via `signInWithOAuth` (PKCE, full-page redirect back to `<origin>/`; supabase-js exchanges the code). OAuth errors from the sign-up hook come back in the URL and are shown on the sign-in card. Session in `localStorage` (supabase-js default).
- **Data:** reads outlets straight from Supabase (publishable key, RLS); every write and every admin list goes through `src/lib/api.ts` → FastAPI. No service-role key in the browser.
- **Deploy:** `npm run build` → static `dist/` on any host with an SPA fallback (rewrite `/*` → `/index.html`). Add the site origin to Supabase → Authentication → URL Configuration → Redirect URLs (`https://<site>/**`, and `http://localhost:5173/**` for dev) and to the API's `CORS_ORIGINS`.

## 5. Code layout & conventions

### 5.1 Mobile (`apps/mobile/src`)
```
app/                       Expo Router routes only — thin screens composing feature components
  _layout.tsx              fonts, QueryClient, SessionProvider, Stack.Protected guards, push-tap routing
  index.tsx                dispatcher (sign-in / no-access / onboarding / mode home)
  (auth)/ (student)/ (staff)/ (authority)/ (admin)/   one Stack per role group
  complaint/[id].tsx       shared by every role (guard: signed in + onboarded); RLS decides visibility
features/<module>/         queries.ts (query keys + hooks + mutations), components, pure logic (+ __tests__)
  auth/ campus/ mess/ canteens/ rebates/ complaints/ admin/ notifications/
components/ui/             design-system primitives (Button, Card, Pill, Badge, Screen, TextField, ZoomableImage…)
lib/                       supabase.ts (single client) · api.ts (single FastAPI client) · images.ts (compress,
                           pick, upload) · time.ts (IST) · money.ts · jwt.ts · database.types.ts (generated)
theme/tokens.js            Alexandria design tokens (Tailwind + TS)
```
Rules: server state only in TanStack Query (keys in each `queries.ts`); Realtime only invalidates queries; FastAPI only via `lib/api.ts`; every upload through `compressForUpload()`; styling via NativeWind classes and tokens (no inline hex); IST logic via `lib/time.ts`.

### 5.2 API (`apps/api/app`)
```
main.py              app factory: settings, JWKS verifier, routers
core/                config (pydantic-settings) · auth (JWT → CurrentUser) · errors (ApiError{code,message})
                     · supabase (lazy service-role client) · time (IST helpers)
routers/             HTTP only: parse, call a service, schedule push in BackgroundTasks; internal.py = cron
services/            business rules (admin, timings, rebates, complaints), push (Expo batching/receipts), notifications
repositories/        data access behind Protocols; Supabase implementations; roles.py = shared live role checks
schemas/             Pydantic v2 request/response models
tests/               pytest with in-memory repositories + an ES256 token factory (no network)
```
Errors are `{"detail": {"code": "REBATE_OVERLAP", "message": "…"}}`; the app maps codes to copy.

### 5.2a Admin website (`apps/web/src`)
```
main.tsx / App.tsx         QueryClient, SessionProvider, router; nothing but sign-in renders until the session is an admin's
lib/                       supabase.ts (publishable key, PKCE) · api.ts (single FastAPI client) · session.tsx (admin gate)
                           · jwt.ts · format.ts (phones, IST dates) · passcode.ts (rules shared with the API) (+ __tests__)
features/<module>/         queries.ts + page: admins/ vendors/ eateries/
components/                ui.tsx (Alexandria primitives) · Layout.tsx
```
Tailwind 4 loads `tailwind.config.js`, which reuses `apps/mobile/src/theme/tokens.js` (colors, sizes, radii, spacing); fonts come from Google Fonts. Types come from `apps/mobile/src/lib/database.types.ts`.

### 5.3 Database (`supabase/`)
Migrations `001`–`018` are the only way the schema changes (applied to the linked project, version = file prefix); `seed.sql` holds the roster; `tests/*.sql` are regression scripts run inside a rolled-back transaction (`auth_rls`, `mess`, `canteens`, `rebates`, `complaints`, `admin_campus`, `maps`, `admin_web`) plus the read-only `hardening` check (RLS everywhere, no anon grants, API-only tables unwritable, indexed FKs, definer functions pin `search_path`, private buckets, cron scheduled). After each migration: regenerate `database.types.ts`, run the security + performance advisors.

### 5.4 Adding a feature (scales the same way)
1. Migration: table + RLS + explicit grants (+ helper/trigger) in one file; extend a `supabase/tests/*.sql` script.
2. Reads/simple writes: a hook in `features/<module>/queries.ts`. Rule-heavy writes: `schemas/` → `repositories/` (Protocol + Supabase class inheriting `SupabaseRoleChecks` if it needs scope checks) → `services/` (rules + stable error codes) → thin `routers/` → `main.py`; pytest with an in-memory repo.
3. Screen under the right role group; register it in that group's `_layout.tsx`.
4. Update this file and `TASKS.md`.

## 6. Feature flows

### 6.1 Mess Hub (migration `004_mess`)
- **Timings:** `meal_timings` (institute default or per Bhawan, weekday/weekend) + `timing_overrides` (newest active wins). `mess_day_schedule(bhawan, date)` and `mess_schedule_at(bhawan, instant)` resolve them in IST; view `mess_schedule_today` feeds the live "Serving now · closes in N min" card.
- **Timing override:** Mess Secretary → `POST /v1/outlets/{id}/timing-overrides` → validated (`PAST_DATE`, `SLOT_REQUIRED`, `INVALID_WINDOW`…) → inserted → **every resident of the Bhawan is pushed** (batches of 100, receipts checked, dead tokens pruned). `DELETE /v1/timing-overrides/{id}` ends it early.
- **Weekly menu / extra items:** direct RLS writes by the Mess Secretary (`weekly_menus.items` JSON validated in SQL).
- **Noticeboard photo:** pick → `compressForUpload` (≤ 2560 px, JPEG 0.82, EXIF stripped) → `noticeboard-photos/{outlet_id}/{date}-{random}.jpg` (public bucket; upload allowed by `app.can_manage_outlet` on the folder) → `menu_photos` row on top of the outlet's **photo stack** (migration `015`): every photo stays published, newest first, until an outlet manager deletes it (row first under RLS `app.can_manage_outlet`, then the storage object). The stack is capped at `app_settings.max_menu_photos` by a trigger (`MENU_PHOTO_LIMIT`; the app removes the just-uploaded file and disables upload when full). Students swipe through the stack (dots for web), zoom (pinch/double-tap) and can report each photo outdated once. Managers see every photo with its report count. Canteen and eatery menu photos use the same stack.

### 6.2 Canteens & eateries (migrations `005`–`008`)
- **Regular hours** `outlet_shifts`: defaults by trigger — Day 10:30–22:30, Night 22:30–10:30, eateries 10:00–22:00 (owner decision; adjust in the app). Edited directly by the outlet's vendor / Bhawan Secretary (no push).
- **Temporary change:** same override endpoint with `slot = null`, overnight allowed; canteens push residents only when `notify = true`; eateries never push. Push data carries `outlet_type` so a tap opens that canteen.
- **Menu & stock** `menu_items` (vendor-managed); **Institute Fixed-Rate Card** `fixed_rate_items` (Bhawan Secretary only — vendors cannot write it).
- **Campus map** (migration `016`): `outlets.latitude/longitude` (both or neither) — set by the admin (API, above) or the eatery's own vendor (Staff console → Location; column grant + `app.can_run_outlet`). `outlet_live_status` carries the pin, so the map colours pins by live status (green open, grey closed) and Realtime/60 s refetch keep them current. `features/map/CampusMap` is Google Maps everywhere: `react-native-maps` with `PROVIDER_GOOGLE` on Android/iOS (`CampusMap.tsx`) and the Maps JavaScript API via `@vis.gl/react-google-maps` on web (`CampusMap.web.tsx`), sharing one minimal style (`mapStyle.ts`: no POI/transit, surface-tier land and roads). Screens: Home "Around campus" still map → `/eateries-map` (full map, tap a pin → status, View menu, Directions); eatery detail location card; "View on map" in the directory. Directions open Google Maps by URL (no key). Native maps need a development build with the keys in §3.5 (Expo Go on Android works without one).
- **Search** `search_food(q)`: trigram-indexed substring match ranked first, fuzzy `word_similarity` for typos, messes excluded.

### 6.3 Push notifications
App registers an Expo token per device (`push_tokens`, needs `eas init` + a development build). FastAPI resolves the audience (Bhawan residents or one user), sends in batches of ≤ 100, checks receipts and deletes `DeviceNotRegistered` tokens. Android channels: `mess-updates`, `nudges`. Tapping: rebate → Rebates; mess override → Mess Hub; canteen override → that canteen.

### 6.4 Live open/closed status (`outlet_status_at`)
1. One **shift occurrence** per IST date: newest active slot-less override, else `outlet_shifts`; ends next day if it crosses midnight; a closed override yields none.
2. **Schedule:** open iff the instant is inside an occurrence (end-exclusive) → `closes_at`; otherwise `next_opens_at` (within 7 days).
3. **Manual toggle** (`outlets.is_open`) wins only if made after the latest shift boundary — it expires when the schedule next changes, so a forgotten toggle never sticks. Re-asserting the same value still counts (clients touch `status_updated_at`; a trigger pins it to `now()`).
4. App: `OpenStatusPill` ("OPEN NOW • Closes at 10:30 PM" / "OPENS TOMORROW 10:30 AM" / "CLOSED"), applying boundaries passed since the last fetch.

### 6.5 Mess rebates (migrations `009`, `010`)
1. Student: dates + reason (+ optional photo ≤ 1600 px or PDF ≤ 5 MB → private `rebate-documents/{uid}/…`).
2. `POST /v1/rebates` checks: student role; Bhawan chosen; `start ≤ end`; ≥ `min_rebate_days` and ≤ 180 days; start ≥ today − `rebate_backdate_days`; document inside the caller's folder; no overlap with a non-rejected rebate (pre-check + a `btree_gist` exclusion constraint for races). Name/email are snapshotted for the authority (profiles stay private).
3. Mess Authority queue (RLS: own Bhawans) → **Biometric cross-checked** → **Approve**, or **Reject** (remarks required) at either step via `POST /v1/rebates/{id}/transition`: legal-transition table (409 `ILLEGAL_TRANSITION`), live scope check, conditional update (409 `REBATE_STALE`). A trigger guards transitions and writes `rebate_events`; the student is pushed each step.
4. Documents open through 10-minute signed URLs; storage RLS lets an authority read a file only while a visible application cites it.

### 6.6 Complaints & accountability (migrations `011`–`013`)
1. **Raise** (student, direct insert): outlet + category + title + description + ≤ 2 photos (compressed ≤ 1600 px → private `complaint-attachments/{uid}/…`). Column grants allow only those five fields; trigger `complaints_prepare` pins `status = open`, `created_by`, `opened_at` and **routes** by outlet type: mess → Mess Secretary of that Bhawan, hostel canteen → Bhawan Secretary, eatery → ADoSW (`domain`, `bhawan_id`, `assignee_role`). A "created" event is logged.
2. **Who can read** (RLS): the complainant, the routed handler (`app.can_handle_complaint`, live), the Bhawan's Mess Authority (Warden office) and ADoSW (all). Photos follow the same rule through storage RLS.
3. **State machine** — `POST /v1/complaints/{id}/transition` (FastAPI):
   - handler: `open | reopened → in_progress` (reply required), `in_progress → in_progress` ("Post update"), `in_progress → awaiting_confirmation` ("Mark fixed", optional proof photo);
   - complainant only: `awaiting_confirmation → resolved` ("Confirm resolved", final) or `→ reopened` ("Still unresolved").
   Errors: `FORBIDDEN`, `ONLY_COMPLAINANT`, `ONLY_HANDLER`, `ILLEGAL_TRANSITION`, `MESSAGE_REQUIRED`, `BAD_ATTACHMENT`, `COMPLAINT_STALE` (conditional update). `reopened` restarts the 48 h clock (`opened_at`) and clears the escalation flags. A DB trigger enforces the same legal moves. Each action pushes **the other party** (handler acts → student; student acts → handlers).
4. **Nudge** — `POST /v1/complaints/{id}/nudge`: complainant only, not resolved, ≥ `nudge_eligible_after_hours` (168 h) since `created_at`, ≥ `nudge_cooldown_hours` (24 h) since the last nudge — all re-checked in one conditional `UPDATE` (a double tap nudges once). Increments `nudge_count`, logs it, and sends a **high-priority** push on the `nudges` channel to the handlers. Errors: `NUDGE_TOO_EARLY`, `NUDGE_COOLDOWN` (with hours left), `COMPLAINT_RESOLVED`.
5. **48 h escalation** — `pg_cron` job `escalation-sweep` (`*/15 * * * *`) runs `app.run_escalation_sweep()`, which reads `api_base_url` + `internal_cron_secret` from Vault and `net.http_post`s `/internal/escalations/run` (30 s timeout; no-op if a secret is missing). The endpoint calls `complaint_escalate_due()`: every open / in-progress / reopened complaint whose `opened_at` is ≥ `long_standing_after_hours` old and not yet flagged gets `long_standing_at` + `escalated_at` — **exactly once** — and its handlers plus (for Bhawan complaints) the Warden office get a high-priority push. Running it twice sends one set of alerts. Job runs: `cron.job_run_details`; HTTP results: `net._http_response`.
6. **Public issue board** — RPC `complaint_board(p_bhawan, p_domain)` (security definer, signed-in only): anonymised rows (outlet, category, title, status, ages, nudge count, `is_long_standing`, `is_escalated`, `is_mine` — never the author or body), open issues plus those resolved in the last 7 days, **long-standing pinned first**. The app shows Active / Critical > 48 h / within-48 h stats.
7. **Screens** — student: Complaints hub (mine + board) and Raise complaint (also linked from the canteen rate card "Report overcharging", eatery detail and Mess Hub); everyone: `/complaint/[id]` with the 3-step tracker (Raised → In work → Student sign-off), `T+52h 14m` clock, LONG-STANDING badge, timeline, Nudge (hidden until day 7, cooldown countdown, "Nudged N×"), Confirm resolved / Still unresolved, and the handler's reply / mark fixed + proof photo; staff: "Complaints routed to you"; authority: ADoSW eatery queue + cross-Bhawan long-standing, Warden office escalations. Realtime on `complaints` keeps them live.

## 7. Data model

Enums: `app_role` · `outlet_type` (`mess`, `day_canteen`, `night_canteen`, `eatery`) · `meal_slot` · `day_type` · `rebate_status` (`pending_verification`, `biometric_cross_checked`, `approved`, `rejected`) · `complaint_*` (created for M6).

| Table | Key columns | Writes |
| --- | --- | --- |
| `app_settings` | single row of business constants (§4.3) + `owner_admin_email` (§4.4) | migration only |
| `bhawans` | `name`, `slug`, `sort_order` | seed; API (admin, via `admin_*_bhawan` RPCs) |
| `outlets` | `type`, `bhawan_id?` (null = eatery), `name`, `slug`, `location_tag`, `latitude`/`longitude` (map pin), `is_open`, `status_updated_at` | seed; API (admin: Bhawan outlets via the RPCs, eateries directly); outlet managers: `is_open`, `location_tag`, `latitude`, `longitude` (column grants) |
| `profiles` | `id → auth.users`, `email`, `phone`, `full_name`, `bhawan_id` (set once), `onboarded_at` | trigger; owner sets Bhawan once |
| `role_assignments` | `user_id`, `role`, `bhawan_id?`, `assigned_by` — one Mess Secretary per Bhawan | API (admin) |
| `whitelisted_vendors` | `phone_e164`, `outlet_id`, `label`, `active` | API (admin) |
| `admin_invites` | `email` (lower-case IITR), `invited_by` — redeemed into an `admin` role by `handle_new_user` at first sign-in | API (admin) |
| `push_tokens` | `user_id`, `expo_token` (unique), `platform` | RPC / owner delete |
| `meal_timings`, `timing_overrides` | defaults per slot/day type; overrides with dates, window or closed, reason | migration; API |
| `weekly_menus`, `extra_items` | per Bhawan | Mess Secretary |
| `menu_photos`, `photo_reports` | photo stack per outlet (`is_current`, newest first, ≤ `max_menu_photos`); one report per student per photo | outlet managers (insert/delete); students (reports) |
| `outlet_shifts` | one regular window per outlet | outlet managers |
| `menu_items` | per outlet, `price_paise`, `in_stock` | outlet managers (not messes) |
| `fixed_rate_items` | per Bhawan, `ceiling_price_paise`, `circular_ref` | Bhawan Secretary |
| `rebate_applications`, `rebate_events` | application + audit trail | API only |
| `complaints` | `created_by`, `outlet_id`, routed `domain`/`bhawan_id`/`assignee_role`, `category`, `title`, `body`, `attachment_paths` (≤ 2), `status`, `opened_at`, `resolved_at`, `nudge_count`, `last_nudged_at`, `long_standing_at`, `escalated_at` | student insert (5 columns); everything else via API RPCs |
| `complaint_events`, `complaint_nudges` | timeline (created / status / reply / nudged / escalated, message, proof photo) and nudge log | triggers + API RPCs |

Views/RPCs: `mess_schedule_today`, `outlet_live_status`, `search_food()`, `register_push_token()`, `complaint_board()`; service-role only: `complaint_transition()`, `complaint_nudge()`, `complaint_escalate_due()`. Storage buckets: `noticeboard-photos` (public, 5 MB, images), `rebate-documents` (private, 5 MB, images + PDF), `complaint-attachments` (private, 5 MB, images).

### 7.1 Seed roster (`supabase/seed.sql`)
Seeded with 11 Bhawans (admins add more in the app, §4.5) — Rajendra, Radhakrishna, Ganga, Cautley, Rajiv, Himalaya, Vivekananda, Govind, Vigyan, Sarojini, Jawahar — each with a Mess, Day Canteen and Night Canteen, plus 4 eateries (CBRI Canteen, Cafe Coffee Day, Amul, Yippe Kiosk) = 37 outlets. V1 vendor whitelist: one shared owner phone `+919510709195` for all 22 canteens + 4 eateries (replace per outlet via the admin console as owners onboard).

## 8. Environments & deployment

| Env | Supabase | API | App |
| --- | --- | --- | --- |
| dev | `sdjghovuyhsiyufhmlga` | Render `https://campus-bites-0dim.onrender.com` (free tier sleeps: ~40 s cold start) or `uv run fastapi dev app/main.py` locally | Expo Go for UI; a development build (`campusbites://`) for push |
| prod (to create) | separate project — run migrations `001`–`016` + `seed.sql`, enable both auth hooks + Google provider, create the two Vault secrets | Render, `ENVIRONMENT=production` (hides `/docs`) | EAS `production` profile (point its `EXPO_PUBLIC_*` in `eas.json` at the prod project) |

Render start command: `uv run fastapi run app/main.py --host 0.0.0.0 --port $PORT`. Redeploy the API whenever `apps/api` changes — the app's API features depend on the deployed version.

**Mobile builds** (`apps/mobile/eas.json`): `development` (dev client, internal APK), `preview` (internal APK), `production` (store build, auto-incremented version). EAS does not upload git-ignored `.env.local`, so each profile carries the public `EXPO_PUBLIC_*` values. App id `in.ac.iitr.campusbites` (Android package + iOS bundle). Icons are generated from `assets/images/iitr-crest.png` (a 316 px source — replace with a vector or 1024 px crest for a crisp store icon). Run `eas init` once to link the project (adds `extra.eas.projectId`, needed for push).

## 9. Decisions

| # | Decision | Value |
| --- | --- | --- |
| M0.1 | Vendor phone auth | Phone + 6-digit passcode stored as the Supabase password, set by admins in the admin website (M8; replaced *Phone numbers for testing*); no SMS gateway |
| M0.2 | API hosting | Render, native Python runtime |
| M0.3 | Google OAuth | Google Web client + browser PKCE flow; redirect allow-list `campusbites://**`, `exp://**` |
| M0.4 | Constants | `min_rebate_days` 3 · long-standing 48 h · nudge after 168 h, 24 h cooldown |
| M4 | Default hours | Day 10:30–22:30 · Night 22:30–10:30 · eateries 10:00–22:00; manual toggle expires at the next shift boundary |
| M5 | Rebate backdating | `rebate_backdate_days` = 0; rejection allowed before or after the cross-check; approval requires the cross-check |
| M6 | Complaint board | An anonymising security-definer RPC instead of a view (students can't read others' rows); accepted advisor WARN like `register_push_token` |
| M6 | Complaint audience | Mess Authority and ADoSW read for oversight; only the routed handler acts. New complaints aren't pushed (handlers work from their queue); nudges and 48 h escalations are |
| M6 | Cron secret | Generated inside Postgres into Vault (never in the repo or chat); the same value must be set as `INTERNAL_CRON_SECRET` on the API host |
| M6 | JWT clock skew | 60 s leeway on `iat`/`nbf`/`exp` (found by the end-to-end run: this host's clock was 9 s behind Supabase) |

Open: second-tier complaint escalation (out of V1 unless requested); pushing handlers on new complaints (V1 relies on the queue + escalation); a real SMS provider before onboarding many independent vendors.

## 10. Non-goals (V1)
In-app payments; automated biometric integration (the authority checks the register manually); web app; offline writes.
