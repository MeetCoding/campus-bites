# Campus Bites — System Architecture

> Official IIT Roorkee dining, mess, canteen & eatery platform.
> Source of truth for product scope: [`PRD.md`](./PRD.md). Build order: [`TASKS.md`](./TASKS.md). Repo rules: [`CLAUDE.md`](./CLAUDE.md).

## 1. Stack at a glance

Two deployable projects plus one managed backend. **No Docker anywhere** (no local Supabase stack, no containers for the API).

| Layer | Tech | Hosting |
| --- | --- | --- |
| Mobile app | Expo (React Native) + Expo Router + NativeWind v4 + TypeScript | EAS Build / EAS Update |
| Business API | FastAPI + Pydantic v2 (Python 3.12, managed by `uv`) | PaaS native Python runtime (default **Render**; Railway/Fly acceptable) |
| Data / Auth / Files / Realtime | Supabase Cloud (Postgres 17, GoTrue, Storage, Realtime, `pg_cron`, `pg_net`) | Supabase Cloud — dev project `sdjghovuyhsiyufhmlga` |
| Push | Expo Push Service (`https://exp.host/--/api/v2/push/send`) | Expo |

Timezone for all business rules: **`Asia/Kolkata`**. Times of day are stored as `time` and interpreted in IST; instants are `timestamptz`.

## 2. Topology

```
                          ┌──────────────────────────────────────────────┐
                          │               Supabase Cloud                 │
                          │                                              │
  ┌───────────────┐  (A)  │  GoTrue Auth ── before_user_created hook     │
  │               │──────▶│              └─ custom_access_token hook     │
  │  Expo app     │       │  PostgREST (RLS)   Realtime   Storage        │
  │ (supabase-js, │◀──────│                                              │
  │  publishable  │       │  Postgres 17                                 │
  │  key + JWT)   │       │   └─ pg_cron ──(every 15 min)── pg_net ──┐   │
  │               │       └──────────────────────────────▲──────────┼───┘
  │               │  (B) HTTPS, Bearer <user JWT>        │ (C)      │ (D) POST /internal/escalations/run
  │               │──────────────────┐                   │ secret   │     X-Internal-Secret
  └───────▲───────┘                  ▼                   │ key      ▼
          │                  ┌──────────────────────────────────────────┐
          │                  │  FastAPI  (verifies JWT via Supabase     │
          │                  │  JWKS, enforces business rules, writes   │
          │                  │  with secret/service-role key)           │
          │                  └───────────────────┬──────────────────────┘
          │       (E) Expo push tickets/receipts │
          └──────────── Expo Push Service ◀──────┘
```

- **(A)** Direct path: auth, reads, realtime, storage, simple owner-scoped writes. Guarded by RLS.
- **(B)** API path: any write with a business rule, a state machine, or a side effect (push).
- **(C)** FastAPI → Supabase with the **secret (service-role) key**, never exposed to the client.
- **(D)** Scheduled path: Postgres cron calls back into FastAPI for time-based logic.
- **(E)** FastAPI is the **only** sender of push notifications.

## 3. Routing & security boundary

### Rule of thumb

> If a write is a plain, owner-scoped CRUD on data the caller owns and RLS can fully express the rule → **direct to Supabase**.
> If a write validates cross-row rules, changes a workflow status, depends on time/cooldowns, or must notify other users → **through FastAPI**.
> Reads always go direct (RLS-filtered), except derived admin aggregates if they ever become too heavy for a view.

### 3.1 Expo → Supabase directly (`@supabase/supabase-js`)

| Capability | Supabase surface | Who | Guard |
| --- | --- | --- | --- |
| Google sign-in (`@<dept>.iitr.ac.in` / `@iitr.ac.in`) | Auth `signInWithIdToken` (native Google Sign-In) | Students, secretaries, authorities, admin | `before_user_created` hook rejects non-IITR emails |
| Phone + SMS OTP sign-in | Auth `signInWithOtp({ phone })` / `verifyOtp` | Vendors / staff | `before_user_created` hook rejects numbers not in `vendor_whitelist` |
| Session refresh / sign-out | Auth | All | — |
| Onboarding: choose own Bhawan | `update profiles set bhawan_id` (own row, once) | Student | RLS: `id = auth.uid()`; column-level grant on `bhawan_id` only |
| Read bhawans, outlets, timings, overrides, weekly menus, menu photos, extra items, canteen menus, fixed-rate cards, eatery directory | PostgREST `select` / views | All authenticated | RLS `select` for `authenticated` |
| Read complaint board (public issue list per Bhawan) | view `complaint_board` | All authenticated | View exposes no complainant identity |
| Read own complaints & own rebates | PostgREST | Student | RLS `created_by = auth.uid()` |
| Read assigned complaint / rebate queues | PostgREST | Secretaries, authorities, ADoSW | RLS via JWT scope claims |
| Live open/closed, stock, complaint status | Realtime (Postgres Changes) | All authenticated | RLS applies to Realtime |
| **Noticeboard / menu photo upload** (client-compressed with `expo-image-manipulator`) | Storage bucket `noticeboard-photos` + insert `menu_photos` row | Mess secretary (own Bhawan), vendor (own outlet), Bhawan secretary (canteens of own Bhawan) | Storage policy on path prefix `{outlet_id}/…` matched to JWT scope |
| Complaint / rebate attachment upload | Storage buckets `complaint-attachments`, `rebate-documents` (private) | Student | Path prefix `{auth.uid()}/…`; read via signed URLs |
| Vendor: edit own menu items, price, stock, open/closed toggle | `menu_items`, `outlets.is_open` | Vendor (own outlet) | RLS `outlet_id = any(jwt.outlet_ids)` |
| Mess secretary: weekly structured menu, extra-items rate card | `weekly_menus`, `extra_items` | Mess secretary (own Bhawan) | RLS scoped by Bhawan |
| Bhawan secretary: institute fixed-cost menu | `fixed_rate_items` | Bhawan & Maintenance secretary (own Bhawan) | RLS scoped by Bhawan; vendors have **no** write policy (tamper-proof) |
| Raise a complaint | insert `complaints` (status forced to `open` by column default + trigger) | Student | RLS `created_by = auth.uid()`; trigger derives `domain` & `assignee_role` from outlet |
| Register / remove own Expo push token | `push_tokens` | All | RLS `user_id = auth.uid()` |
| "Report outdated/blurry photo" flag | insert `photo_reports` | Student | RLS `reported_by = auth.uid()`, unique per photo per user |

### 3.2 Expo → FastAPI → Supabase

All endpoints are under `/v1`, require `Authorization: Bearer <supabase access token>`, and are idempotent where noted.

| Endpoint | Purpose | Rules enforced server-side | Side effects |
| --- | --- | --- | --- |
| `POST /v1/rebates` | Submit mess rebate | `start_date ≤ end_date`; length ≥ `MIN_REBATE_DAYS` consecutive days; start not in the past beyond grace window; no overlap with caller's non-rejected rebates; caller has a Bhawan | Insert `rebate_applications` (`pending_verification`) + `rebate_events` |
| `POST /v1/rebates/{id}/transition` | Authority workflow | Caller is `mess_authority` for the rebate's Bhawan; legal transitions only: `pending_verification → biometric_cross_checked → approved \| rejected`; remarks required for `rejected` | Event row; push to student |
| `POST /v1/complaints/{id}/transition` | Complaint state machine | See §5.2; handler-only vs student-only transitions; reply text required for `in_progress`; optional proof photo path for `awaiting_confirmation` | Event row; push to the other party |
| `POST /v1/complaints/{id}/nudge` | Nudge the handler | Caller is the complainant; complaint unresolved and long-standing (≥ 48 h); **24 h cooldown** per complaint; atomic counter increment | `complaint_nudges` row, `nudge_count += 1`, **high-priority** push to handler(s) |
| `POST /v1/outlets/{id}/timing-overrides` | Mess timing override / canteen shift change | Caller is mess secretary (mess outlets) or Bhawan secretary / outlet vendor (canteens); valid IST window, overnight allowed; reason note required for mess | Insert `timing_overrides`; **mess: push to all Bhawan residents**; canteen: push only if `notify=true` |
| `DELETE /v1/timing-overrides/{id}` | End an override early | Same scope as above | Optional push |
| `POST /v1/admin/vendor-whitelist` · `DELETE …/{id}` | Whitelist vendor phone ↔ outlet | `admin` only; E.164 `+91…` normalisation; unique phone | — |
| `POST /v1/admin/role-assignments` · `DELETE …/{id}` | Assign secretary / authority / ADoSW / admin roles | `admin` only; scope required for Bhawan-scoped roles; one mess secretary per Bhawan | Forces user's next token refresh to pick up claims |
| `POST /internal/escalations/run` | 48 h escalation sweep (called by `pg_cron`) | Header `X-Internal-Secret` must match env; not exposed in app client | See §5.3 |
| `GET /healthz` | Liveness | — | — |

### 3.3 Security model

1. **RLS on every table in `public`, deny-by-default.** A table is enabled for RLS in the same migration that creates it.
2. **API-only tables/columns have no client write policy.** `rebate_applications`, `rebate_events`, `complaint_events`, `complaint_nudges`, `timing_overrides`, `vendor_whitelist`, `role_assignments`, and the `complaints.status / nudge_count / long_standing_at / escalated_at` columns can be written only by the service role (FastAPI). Students may `insert` complaints, but a `before insert` trigger pins `status = 'open'`, `created_by = auth.uid()`, and computes routing.
3. **Identity claims.** A `custom_access_token` auth hook adds to the JWT:
   `app_role` (highest role), `roles[]`, `bhawan_id` (student's own), `scope_bhawan_ids[]`, `outlet_ids[]`. RLS helper functions (`auth_has_role(text)`, `auth_scope_bhawans()`, `auth_outlets()`) read `auth.jwt()` so RLS and FastAPI share one definition of "who can do what". Claims are refreshed on token refresh after role changes.
4. **Sign-up gate.** `before_user_created` hook (Postgres function):
   - Email identities: must match `^[^@]+@([a-z0-9-]+\.)?iitr\.ac\.in$` (case-insensitive) → covers `@ece.iitr.ac.in`, `@cse.iitr.ac.in`, `@iitr.ac.in`.
   - Phone identities: must exist in `vendor_whitelist` and be `active`.
   - Anything else → rejected with a user-facing error.
   Google's `hd` parameter is a UX hint only and is **not** relied on.
5. **Keys.** App ships only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon), `EXPO_PUBLIC_API_URL`. The secret (service-role) key lives only in the FastAPI host's env. FastAPI verifies user JWTs against `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` (asymmetric signing keys) and checks `aud = authenticated`, `exp`.
6. **Storage.**
   | Bucket | Visibility | Write | Read |
   | --- | --- | --- | --- |
   | `noticeboard-photos` | public | role + path-scoped (`{outlet_id}/{yyyy-ww}/{uuid}.jpg`) | public CDN URL (cacheable by `expo-image`) |
   | `complaint-attachments` | private | complainant, path `{uid}/…`; handler proof photos via FastAPI | signed URLs (complainant + assigned handler) |
   | `rebate-documents` | private | applicant, path `{uid}/…` | signed URLs (applicant + scoped authority) |
   Bucket-level limits: max 5 MB per object, MIME `image/jpeg`, `image/png`, `image/webp` (+ `application/pdf` for rebates).
7. **Session storage on device**: `expo-secure-store` adapter (chunked for large sessions); never AsyncStorage for tokens.
8. **Internal endpoints** (`/internal/*`) check a shared secret stored in Supabase Vault (read by `pg_net` call) and in the API env; rotate together.
9. **Advisors**: run Supabase security advisors after every DDL migration; zero `ERROR`-level findings is a merge gate.

## 4. Data model (outline — SQL lives in `supabase/migrations/`)

Enums
- `app_role`: `student`, `mess_secretary`, `bhawan_secretary`, `mess_authority`, `adosw`, `vendor`, `admin`
- `outlet_type`: `mess`, `day_canteen`, `night_canteen`, `eatery`
- `complaint_domain`: `mess`, `hostel_canteen`, `campus_eatery`
- `complaint_category`: `hygiene`, `seating`, `lighting`, `food_quality`, `overcharging`, `other`
- `complaint_status`: `open`, `in_progress`, `awaiting_confirmation`, `resolved`, `reopened`
- `rebate_status`: `pending_verification`, `biometric_cross_checked`, `approved`, `rejected`
- `meal_slot`: `breakfast`, `lunch`, `dinner` · `day_type`: `weekday`, `weekend_holiday`

| Table | Key columns | Notes |
| --- | --- | --- |
| `bhawans` | `id`, `name`, `slug`, `is_girls` | Seed 18 Bhawans |
| `outlets` | `id`, `type`, `bhawan_id?`, `name`, `location_tag`, `is_open`, `status_updated_at` | Each Bhawan has 1 mess + day + night canteen; eateries have `bhawan_id null` |
| `profiles` | `id → auth.users`, `email?`, `phone?`, `full_name`, `bhawan_id?`, `onboarded_at` | Created by `on auth.users insert` trigger |
| `role_assignments` | `user_id`, `role`, `bhawan_id?`, `outlet_id?` | Source of JWT claims |
| `vendor_whitelist` | `phone_e164` (unique), `outlet_id`, `active`, `added_by` | Admin-only |
| `meal_timings` | `bhawan_id?` (null = institute default), `slot`, `day_type`, `opens_at`, `closes_at` | Defaults from PRD §3A.1 |
| `outlet_shifts` | `outlet_id`, `opens_at`, `closes_at` | Canteen defaults; overnight when `closes_at < opens_at` |
| `timing_overrides` | `outlet_id`, `slot?`, `starts_on`, `ends_on`, `opens_at`, `closes_at`, `reason`, `created_by` | Seasonal/daily; covers holidays |
| `weekly_menus` | `bhawan_id`, `week_start` (Monday), `items jsonb` (day × slot → dishes) | Unique (`bhawan_id`, `week_start`) |
| `menu_photos` | `outlet_id`, `week_start?`, `storage_path`, `width`, `height`, `uploaded_by`, `is_current` | Noticeboard + canteen menu boards |
| `photo_reports` | `photo_id`, `reported_by`, `reason` | "Report outdated / blurry" |
| `extra_items` | `bhawan_id`, `name`, `unit`, `price_paise`, `available` | Read-only for students in V1 |
| `menu_items` | `outlet_id`, `name`, `description`, `price_paise`, `in_stock`, `category` | Custom vendor menu |
| `fixed_rate_items` | `bhawan_id?`, `name`, `ceiling_price_paise`, `circular_ref`, `effective_from` | Institute rate card; vendor cannot write |
| `rebate_applications` | `student_id`, `bhawan_id`, `start_date`, `end_date`, `reason`, `document_path?`, `status`, `authority_remarks?` | API-only writes |
| `rebate_events` | `rebate_id`, `from_status`, `to_status`, `actor_id`, `remarks`, `at` | Audit trail |
| `complaints` | `created_by`, `outlet_id`, `bhawan_id?`, `domain`, `category`, `title`, `body`, `status`, `assignee_role`, `nudge_count`, `last_nudged_at`, `long_standing_at?`, `escalated_at?`, `opened_at` | `opened_at` resets on `reopened` |
| `complaint_events` | `complaint_id`, `from_status`, `to_status`, `actor_id`, `message`, `attachment_path?` | Timeline UI |
| `complaint_nudges` | `complaint_id`, `nudged_by`, `at` | Cooldown source |
| `push_tokens` | `user_id`, `expo_token` (unique), `platform`, `last_seen_at` | Pruned on `DeviceNotRegistered` |

Money is stored as integer **paise** (`price_paise`). Views: `complaint_board` (public, anonymised, includes computed `is_long_standing`), `outlet_live_status` (resolves default + override for "OPEN NOW • Closes at …").

## 5. Key flows

### 5.1 Authentication
**Students / staff with IITR email**
1. App → native Google Sign-In (`@react-native-google-signin/google-signin`, `hd` hint `iitr.ac.in`) → ID token.
2. `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
3. First login: `before_user_created` validates domain → `profiles` row created → app routes to Bhawan picker (students) → claims hook populates JWT on next refresh.

**Vendors**
1. Phone entry (`+91` fixed) → `signInWithOtp({ phone })`. Non-whitelisted numbers fail at user creation; the UI shows "Admin pre-whitelisted numbers only".
2. `verifyOtp` → JWT contains `app_role = vendor`, `outlet_ids`.
3. SMS provider configured in Supabase Auth (see §8).

Routing after login (Expo Router groups): `student → (student)`, `vendor | mess_secretary | bhawan_secretary → (staff)`, `mess_authority | adosw → (authority)`, `admin → (admin)`. Users holding several roles get a role switcher.

### 5.2 Complaint state machine

```
            handler reply                   handler marks fixed
  open ─────────────────────▶ in_progress ───────────────────────▶ awaiting_confirmation
   ▲                               ▲                                      │       │
   │                               │ handler reply                        │       │ student "Confirm Resolved"
   │                               │                                      │       ▼
   │                           reopened ◀──── student "Still Unresolved" ─┘    resolved (terminal)
```
- Handler transitions (`open|reopened → in_progress`, `in_progress → awaiting_confirmation`) are allowed only for the routed role & scope:
  `mess → mess_secretary(bhawan)`, `hostel_canteen → bhawan_secretary(bhawan)`, `campus_eatery → adosw`.
- Student transitions (`awaiting_confirmation → resolved | reopened`) are allowed **only for `created_by`**.
- `reopened` resets `opened_at` (restarts the 48 h clock) and clears `long_standing_at`.

### 5.3 48-hour long-standing & escalation
- `is_long_standing = status in (open, in_progress, reopened) and now() - opened_at ≥ 48h` — computed in the `complaint_board` view so the badge never depends on a job.
- `pg_cron` job `escalation-sweep` runs `*/15 * * * *` → `net.http_post` to `/internal/escalations/run`.
- FastAPI sweep (idempotent): for each complaint newly crossing 48 h with `long_standing_at is null` → set `long_standing_at`, `escalated_at`; push high-priority alert to the handler(s); for Bhawan-scoped domains also notify the Bhawan's `mess_authority` (Warden office); eatery complaints are already with ADoSW. Board orders long-standing first.

### 5.4 Nudge
Complainant taps **Nudge Secretary** → `POST /v1/complaints/{id}/nudge` → check long-standing & `last_nudged_at < now() - 24h` in one `UPDATE … WHERE … RETURNING` (race-safe) → insert `complaint_nudges` → push (`priority: high`, channel `nudges`) → app shows "Nudged N times".

### 5.5 Noticeboard photo upload
1. Secretary/vendor picks or captures photo (`expo-image-picker` / camera).
2. `expo-image-manipulator`: resize long edge to **≤ 2560 px**, JPEG `compress ≈ 0.82` (keeps handwriting legible, target < 1.5 MB); EXIF stripped by re-encode.
3. Upload to `noticeboard-photos/{outlet_id}/{yyyy-ww}/{uuid}.jpg`.
4. Insert `menu_photos` row (`is_current = true`; trigger flips previous to false).
5. Students see a card with "Tap to Zoom" → full-screen pinch-to-zoom lightbox (gesture-handler + reanimated), uploader + relative timestamp, "Report outdated photo" action.

### 5.6 Mess timing override
Secretary saves override → FastAPI validates → inserts `timing_overrides` → resolves residents (`profiles.bhawan_id`) → batched Expo push (100 / request) → stores tickets, prunes dead tokens on receipts.

## 6. Environments

| Env | Supabase | API | App |
| --- | --- | --- | --- |
| dev | `sdjghovuyhsiyufhmlga` (current, empty) | `uv run fastapi dev` locally, or Render preview | Expo dev client (Google Sign-In needs a dev build, not Expo Go) |
| prod | separate project (created at M6) | Render service | EAS production build |

Environment variables

| App | Var | Secret? |
| --- | --- | --- |
| mobile | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | no (public by design) |
| api | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `INTERNAL_CRON_SECRET`, `EXPO_ACCESS_TOKEN`, `MIN_REBATE_DAYS`, `CORS_ORIGINS` | yes |
| supabase | Vault secrets `internal_cron_secret`, `api_base_url` | yes |

## 7. Non-goals (V1)
In-app payments for extra items; automated biometric integration (authority cross-checks manually and records it); web app; offline writes.

## 8. Open decisions
1. **SMS provider** for Supabase phone auth — Twilio Verify vs MSG91/Textlocal. Indian SMS requires DLT sender/template registration; lead time affects M2.
2. **FastAPI host** — Render (default) vs Railway/Fly; free tiers sleep, so `pg_cron` calls must tolerate cold starts (retry, 30 s timeout).
3. **`MIN_REBATE_DAYS`** — value per institute rule (configurable; placeholder 3).
4. **Nudge eligibility** — assumed: only once a complaint is long-standing (≥ 48 h). Confirm vs "any unresolved complaint".
5. **Second-tier escalation** (e.g. 96 h → ADoSW for hostel complaints) — out of V1 unless requested.
