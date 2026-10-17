# TASKS.md — Campus Bites implementation checklist

Execute top-down. Each task is atomic (one commit), lists its dependencies when they aren't the task directly above, and ends with a **done when** criterion. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for table/endpoint names and [`CLAUDE.md`](./CLAUDE.md) for conventions.

Legend: `[ ]` todo · `[x]` done · **dep:** prerequisite task IDs · ✅ done when

---

## M0 — Decisions & accounts (no code)
- [ ] **M0.1** Choose SMS provider for Supabase phone auth (Twilio Verify / MSG91 / Textlocal) and start DLT sender + OTP template registration. ✅ provider chosen, registration submitted.
- [ ] **M0.2** Choose FastAPI host (default Render). ✅ account + empty service created.
- [ ] **M0.3** Create Google Cloud OAuth clients (Web — used by Supabase; Android with debug/release SHA-1; iOS). ✅ client IDs recorded in a password manager.
- [ ] **M0.4** Confirm `MIN_REBATE_DAYS`, nudge eligibility rule, and the official list/names of 18 Bhawans + campus eateries (ARCHITECTURE §8). ✅ values written into ARCHITECTURE §8.

## M1 — Foundation
### Repo & tooling
- [ ] **M1.1** Create monorepo skeleton: `apps/mobile`, `apps/api`, `supabase/`, root `.gitignore`, `.editorconfig`, `.env.example` files per app. ✅ tree matches CLAUDE.md layout.
- [ ] **M1.2** Scaffold Expo app in `apps/mobile` (TypeScript, Expo Router template), enable `strict`, add path alias `@/`. ✅ `npx tsc --noEmit` passes; app boots in dev client.
- [ ] **M1.3** Install & configure NativeWind v4 + Tailwind 3.4 (`babel`, `metro`, `global.css`, `nativewind-env.d.ts`). ✅ a `className="bg-primary"` view renders blue.
- [ ] **M1.4** Port Alexandria tokens from `stitch-reference/*/code.html` `tailwind.config` into `tailwind.config.js` (colors, radius, spacing, fontSize) and load Noto Serif / Inter / Public Sans via `expo-font`. **dep:** M1.3. ✅ token preview screen shows all surface tiers and three font families.
- [ ] **M1.5** Build `components/ui` primitives: `Button` (primary gradient / secondary / tertiary), `Card` (surface-tier, no border), `Pill`, `Badge`, `Screen`, `SectionHeader`, `TextField`. **dep:** M1.4. ✅ primitives render on preview screen; no 1px borders.
- [ ] **M1.6** Scaffold FastAPI in `apps/api` with `uv init`; deps: `fastapi[standard]`, `pydantic-settings`, `httpx`, `pyjwt[crypto]`, `supabase`, `pytest`, `pytest-asyncio`, `ruff`. ✅ `uv run fastapi dev app/main.py` serves `/docs`.
- [ ] **M1.7** `core/config.py` (`Settings` via pydantic-settings) + `GET /healthz` + CORS. **dep:** M1.6. ✅ `uv run pytest` passes a health test.

### Supabase
- [ ] **M1.8** `npx supabase init` + `link --project-ref sdjghovuyhsiyufhmlga`. ✅ `npx supabase migration list` runs against remote.
- [ ] **M1.9** Migration `extensions`: enable `pg_cron`, `pg_net`, `moddatetime`, `pg_trgm`. **dep:** M1.8. ✅ extensions listed as installed.
- [ ] **M1.10** Migration `enums`: `app_role`, `outlet_type`, `complaint_domain`, `complaint_category`, `complaint_status`, `rebate_status`, `meal_slot`, `day_type`. ✅ pushed.
- [ ] **M1.11** Migration `core_tables`: `bhawans`, `outlets`, `profiles`, `role_assignments`, `vendor_whitelist` + RLS (read-all for authenticated on bhawans/outlets; own-row on profiles; none on whitelist/roles). ✅ advisors show no RLS errors.
- [ ] **M1.12** Trigger `on auth.users insert → profiles` row. **dep:** M1.11. ✅ creating a test user creates a profile.
- [ ] **M1.13** `seed.sql`: 18 Bhawans, per-Bhawan mess + day canteen + night canteen outlets, campus eateries (CCD, Amul, CBRI Canteen, Yippee Kiosk…). **dep:** M0.4, M1.11. ✅ row counts verified via SQL.
- [ ] **M1.14** Generate types into `apps/mobile/lib/database.types.ts`; create `lib/supabase.ts` with SecureStore session adapter. **dep:** M1.11, M1.2. ✅ typed `select` from `bhawans` returns seed data in app.

## M2 — Authentication & RBAC
- [ ] **M2.1** Postgres fn + migration for `before_user_created` hook: allow email matching `^[^@]+@([a-z0-9-]+\.)?iitr\.ac\.in$`, allow phone only if active in `vendor_whitelist`; enable hook in Auth settings. ✅ gmail.com sign-up rejected; `x@ece.iitr.ac.in` accepted; un-whitelisted phone rejected.
- [ ] **M2.2** RLS helper fns `auth_has_role()`, `auth_scope_bhawans()`, `auth_outlets()` reading `auth.jwt()`. ✅ unit SQL checks pass.
- [ ] **M2.3** `custom_access_token` hook adding `app_role`, `roles[]`, `bhawan_id`, `scope_bhawan_ids[]`, `outlet_ids[]` (vendors resolved via `vendor_whitelist`). **dep:** M2.2. ✅ decoded JWT contains claims for a seeded secretary and vendor.
- [ ] **M2.4** `core/auth.py`: JWKS-verified `CurrentUser` dependency exposing claims; `require_role()` helper. **dep:** M1.7, M2.3. ✅ tests: valid token 200, expired/forged 401, wrong role 403.
- [ ] **M2.5** Configure Google provider in Supabase (Web client ID, authorized client IDs for Android/iOS). **dep:** M0.3. ✅ provider enabled.
- [ ] **M2.6** `(auth)/sign-in` screen per `dual_login_onboarding` design: Google button (native Google Sign-In → `signInWithIdToken`). **dep:** M2.5, M1.5. ✅ IITR account signs in on device; non-IITR shows friendly error.
- [ ] **M2.7** Configure phone auth with chosen SMS provider. **dep:** M0.1. ✅ test OTP delivered to a whitelisted number.
- [ ] **M2.8** Vendor OTP flow on sign-in screen (`+91` input → OTP verify). **dep:** M2.7, M2.6. ✅ whitelisted vendor lands in `(staff)`.
- [ ] **M2.9** Session provider + role-group redirects in `_layout.tsx` files; role switcher for multi-role users. **dep:** M2.6. ✅ each role lands in its group; deep-linking into another group redirects.
- [ ] **M2.10** Student onboarding: Bhawan picker (18 pills) writes `profiles.bhawan_id` once (column grant + RLS). ✅ second write rejected by DB.
- [ ] **M2.11** API `POST/DELETE /v1/admin/vendor-whitelist` with E.164 normalisation + tests. **dep:** M2.4. ✅ pytest green.
- [ ] **M2.12** API `POST/DELETE /v1/admin/role-assignments` (one mess secretary per Bhawan) + tests. **dep:** M2.4. ✅ pytest green.
- [ ] **M2.13** `(admin)` screens: whitelist list/add/remove, role assignment by email + Bhawan. **dep:** M2.11, M2.12. ✅ admin can whitelist a phone and that phone can then sign in.
- [ ] **M2.14** RLS test script (SQL with `set local role authenticated` + `request.jwt.claims`) covering profiles/roles/whitelist. ✅ script passes; advisors clean.

## M3 — Mess Hub (Module A, minus rebates)
- [ ] **M3.1** Migration `push_tokens` + RLS (own rows). ✅ pushed, types regenerated.
- [ ] **M3.2** App: request notification permission, register Expo push token on login, delete on sign-out. **dep:** M3.1, M2.9. ✅ row appears per device.
- [ ] **M3.3** API `services/push.py`: batch send (≤100), priority/channel support, receipt check, prune `DeviceNotRegistered`. **dep:** M1.7. ✅ unit tests with mocked httpx.
- [ ] **M3.4** Migration `meal_timings`, `timing_overrides` + seed PRD defaults (weekday/weekend breakfast, lunch, dinner). ✅ seed visible.
- [ ] **M3.5** View `outlet_live_status` resolving default + active override (IST, overnight-safe). **dep:** M3.4. ✅ SQL tests for weekday, weekend, override, overnight.
- [ ] **M3.6** `lib/time.ts` IST helpers mirroring the view (current slot, "closes in N min", next slot). ✅ unit tests for edge times.
- [ ] **M3.7** API `POST /v1/outlets/{id}/timing-overrides` + `DELETE /v1/timing-overrides/{id}`; mess overrides push to all Bhawan residents. **dep:** M3.3, M3.4, M2.4. ✅ tests: scope check, reason required, push called.
- [ ] **M3.8** Migration `weekly_menus` (jsonb day×slot) + RLS (mess secretary write own Bhawan). ✅ pushed.
- [ ] **M3.9** Migration `menu_photos`, `photo_reports`; buckets `noticeboard-photos` (public) + storage policies by path/scope; `is_current` flip trigger. ✅ upload by wrong-Bhawan secretary rejected.
- [ ] **M3.10** `lib/images.ts` `compressForUpload()` with `expo-image-manipulator` (≤2560 px, JPEG 0.82) + upload helper. ✅ 12 MP photo uploads < 1.5 MB, still legible.
- [ ] **M3.11** `components/ui/ZoomableImage` full-screen lightbox (pinch, double-tap, pan, close) per noticeboard design. ✅ smooth on mid-range Android.
- [ ] **M3.12** Student Mess Hub screen per `dedicated_hostel_mess_noticeboard`: Bhawan pill selector, override banner, live serving status, noticeboard photo card ("Tap to Zoom", uploader, age, "Report outdated"), structured weekly menu cards. **dep:** M3.5, M3.8, M3.9, M3.11. ✅ matches design intent with seeded data.
- [ ] **M3.13** Migration `extra_items` + RLS; student read-only rate card section. ✅ prices render from paise.
- [ ] **M3.14** `(staff)` Mess Secretary console per `vendor_secretary_upload_portal`: upload noticeboard photo, edit weekly menu, edit extra items, publish timing override (calls API). **dep:** M3.7, M3.10, M3.13. ✅ override reaches a resident's device as a push.
- [ ] **M3.15** Home dashboard per `campus_bites_home_dashboard`: today's meal status, quick links (mess, canteens, eateries, rebates, complaints). **dep:** M3.12. ✅ renders live slot correctly across a day.

## M4 — Hostel Canteens & Campus Eateries (Modules B, C)
- [ ] **M4.1** Migration `outlet_shifts` + seed Day (10:30–22:30) / Night (22:30–10:30) defaults; extend `outlet_live_status` for canteens/eateries + `outlets.is_open` manual toggle. ✅ overnight shift tests pass.
- [ ] **M4.2** Migration `menu_items` + RLS (vendor own outlet; Bhawan secretary for own Bhawan canteens). ✅ cross-outlet write rejected.
- [ ] **M4.3** Migration `fixed_rate_items` + RLS (Bhawan secretary write; vendors none; all read). ✅ vendor write rejected.
- [ ] **M4.4** `OpenStatusPill` component: "OPEN NOW • Closes at [time]" / "OPENS AT …" / "CLOSED". **dep:** M3.6, M4.1. ✅ snapshot cases incl. overnight.
- [ ] **M4.5** Canteen screen per `hostel_canteen_photo_ceiling_rates`: Day/Night switch, Tab 1 full menu (+ menu photo lightbox), Tab 2 Institute Fixed-Rate Card (gold "official" styling, circular ref). **dep:** M4.2, M4.3, M4.4, M3.11. ✅ both tabs render seeded data.
- [ ] **M4.6** Realtime subscription on `outlets` / `menu_items` invalidating queries. ✅ vendor toggle reflects on another device < 3 s.
- [ ] **M4.7** Vendor console: open/closed toggle, item add/edit, price, In Stock/Sold Out, menu photo upload, shift change (via timing-override API with `notify` flag). **dep:** M4.2, M3.7, M3.10. ✅ vendor can run a full shift update end-to-end.
- [ ] **M4.8** Bhawan secretary console: canteen shift timings + fixed-rate card editor. **dep:** M4.3, M3.7. ✅ edits visible to students.
- [ ] **M4.9** Eateries directory: list with location tags + live status, `pg_trgm`-backed search across outlets and menu items, eatery detail menu. **dep:** M4.4. ✅ search "maggi" finds items across outlets.

## M5 — Mess Rebates (Module A.4)
- [ ] **M5.1** Migration `rebate_applications`, `rebate_events` + RLS (student reads own; authority reads scoped Bhawans; **no client writes**) + private bucket `rebate-documents`. ✅ direct insert from app rejected.
- [ ] **M5.2** API `services/rebates.py` submit validation (dates, `MIN_REBATE_DAYS`, overlap, Bhawan set) + `POST /v1/rebates`. **dep:** M2.4, M5.1. ✅ pytest covers each rule with stable error codes.
- [ ] **M5.3** API `POST /v1/rebates/{id}/transition` (legal transitions, remarks required on reject, scope check) + student push. **dep:** M5.2, M3.3. ✅ illegal transitions return 409.
- [ ] **M5.4** Student rebate form (date range, reason, optional document via `compressForUpload` or PDF) + history with status timeline. **dep:** M5.2. ✅ error codes map to friendly copy.
- [ ] **M5.5** `(authority)` rebate queue: filter by status/Bhawan, detail, "Biometric cross-checked", approve/reject with remarks. **dep:** M5.3. ✅ full lifecycle works on device.

## M6 — Complaints, Accountability & Release (Module D)
- [ ] **M6.1** Migration `complaints`, `complaint_events`, `complaint_nudges` + RLS (student inserts own; handler reads by scope; status/nudge/escalation columns not client-writable) + private bucket `complaint-attachments`. ✅ client status update rejected.
- [ ] **M6.2** `before insert` trigger on `complaints`: force `status='open'`, `created_by`, `opened_at`, derive `domain`, `bhawan_id`, `assignee_role` from outlet type. ✅ SQL tests for mess / canteen / eatery routing.
- [ ] **M6.3** View `complaint_board` (anonymised, `is_long_standing`, ordered long-standing first). ✅ 49 h-old open complaint flagged.
- [ ] **M6.4** API `services/complaints.py` state machine + `POST /v1/complaints/{id}/transition` (handler vs student-only gates, `reopened` resets clock) + push to the other party. **dep:** M6.1, M3.3. ✅ pytest matrix of every (role, from, to).
- [ ] **M6.5** API `POST /v1/complaints/{id}/nudge`: complainant-only, long-standing, 24 h cooldown via conditional UPDATE, counter, high-priority push. **dep:** M6.4. ✅ concurrent double-tap yields one nudge.
- [ ] **M6.6** API `POST /internal/escalations/run` (secret header, idempotent sweep, notify handler + Warden office). **dep:** M6.4. ✅ running twice sends one notification set.
- [ ] **M6.7** Migration: Vault secrets (`internal_cron_secret`, `api_base_url`) + `pg_cron` job `escalation-sweep` every 15 min via `net.http_post`. **dep:** M6.6, API deployed (M6.13 or a dev tunnel). ✅ `cron.job_run_details` shows successes.
- [ ] **M6.8** Student "Raise complaint" flow per `accountability_complaint_hub`: outlet picker, category chips, description, up to 2 photos. **dep:** M6.2. ✅ complaint appears in handler queue.
- [ ] **M6.9** Complaint detail: 3-step tracker (Raised → In Work → Student Signoff), timeline, elapsed "T+52h" counter, LONG-STANDING badge, Nudge button with "Nudged N×" + cooldown, Confirm Resolved / Still Unresolved. **dep:** M6.4, M6.5. ✅ all states render; buttons hidden when not allowed.
- [ ] **M6.10** Public Bhawan issue board (pinned long-standing). **dep:** M6.3. ✅ ordering correct.
- [ ] **M6.11** Handler consoles: mess secretary, Bhawan secretary, ADoSW (eatery complaints + cross-Bhawan long-standing view); reply, mark fixed with optional proof photo. **dep:** M6.4. ✅ each handler only sees their domain.
- [ ] **M6.12** Hardening: security + performance advisors clean, indexes on FK/status/`opened_at`, RLS test script extended to all tables. ✅ zero ERROR advisors.
- [ ] **M6.13** Deploy FastAPI to host (native Python build, env vars set, `/healthz` monitored). **dep:** M0.2. ✅ prod URL healthy.
- [ ] **M6.14** Create prod Supabase project, `db push` migrations, seed, configure auth hooks/providers/SMS. ✅ smoke test login on prod.
- [ ] **M6.15** EAS: `eas.json` profiles (development / preview / production), app icons with IITR crest, production build + internal test track. ✅ installable build passes the end-to-end checklist below.

### Release end-to-end checklist
- [ ] Student: Google login → Bhawan onboarding → mess menu photo zoom → canteen fixed-rate tab → rebate submit → complaint raise → nudge after 48 h → confirm resolved.
- [ ] Vendor: OTP login → toggle open/closed → mark item Sold Out → visible to student in real time.
- [ ] Mess secretary: upload noticeboard photo → timing override → residents receive push.
- [ ] Authority: cross-check & approve a rebate. ADoSW: resolve an eatery complaint.
- [ ] Admin: whitelist a phone, assign a secretary role.
