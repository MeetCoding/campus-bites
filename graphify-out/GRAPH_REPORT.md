# Graph Report - campus-bites  (2026-11-02)

## Corpus Check
- 244 files · ~121,681 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 5, .example 4, .css 2)

## Summary
- 2157 nodes · 6642 edges · 107 communities (69 shown, 38 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 342 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `753e56f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- complaints/components.tsx
- notifications.py
- test_rebates.py
- canteens/components.tsx
- test_timings.py
- services/timings.py
- canteens/queries.ts
- manage.tsx
- public.profiles
- BhawanOut
- Settings
- AdminService
- services/admin.py
- test_complaints.py
- rebates.tsx
- InMemoryAdminRepository
- public.outlets
- web/package.json
- dependencies
- ComplaintOut
- SupabaseAdminRepository
- expo
- devDependencies
- ui.tsx
- publish_github_release
- bearer
- routers/admin.py
- AppRole
- VendorsPage.tsx
- services/complaints.py
- HostelsPage.tsx
- lib/session.tsx
- mobile/tailwind.config.js
- admin/queries.ts
- api
- modes.ts
- EateriesPage.tsx
- compilerOptions
- 011_complaints.sql
- campus.ts
- AdminsPage.tsx
- push.ts
- 004_mess.sql
- routers/timings.py
- auth.ts
- 009_rebates.sql
- Campus Bites — System Architecture
- time.py
- Card
- public.menu_photos
- Campus Bites — Privacy Policy
- ComplaintRules
- metro.config.js
- TASKS.md — Campus Bites implementation checklist
- VendorAccount
- scripts
- mobile/tsconfig.json
- CLAUDE.md — Campus Bites
- Alexandria — High-End Editorial
- 019_master_vendors.sql
- publish-github-release.mjs
- rate-card.tsx
- PRD.md
- 4. Admin operations (runbook)
- 6. Feature flows
- 003_auth.sql
- get_admin_repository
- AGENTS.md
- 5. Code layout & conventions
- expo
- app.run_escalation_sweep
- 3. Core Functional Modules (V1 Scope)
- package.json
- Campus Bites
- vite-env.d.ts
- nativewind-env.d.ts
- campus-bites-api
- auth_rls_test.sql

## God Nodes (most connected - your core abstractions)
1. `InMemoryAdminRepository` - 103 edges
2. `Card()` - 85 edges
3. `AppRole` - 69 edges
4. `react-native` - 63 edges
5. `Screen()` - 62 edges
6. `Button()` - 61 edges
7. `CurrentUser` - 54 edges
8. `useSession()` - 53 edges
9. `AdminService` - 49 edges
10. `ApiError` - 46 edges

## Surprising Connections (you probably didn't know these)
- `API coding constraints` --references--> `CurrentUser`  [INFERRED]
  CLAUDE.md → apps/api/app/core/auth.py
- `5.4 Adding a feature (scales the same way)` --references--> `SupabaseRoleChecks`  [INFERRED]
  ARCHITECTURE.md → apps/api/app/repositories/roles.py
- `6.4 Live open/closed status (`outlet_status_at`)` --references--> `OpenStatusPill()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/features/canteens/components.tsx
- `3.1 Sign-in methods` --references--> `completeWebGoogleSignIn()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/lib/auth.ts
- `5.1 Mobile (`apps/mobile/src`)` --references--> `compressForUpload()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/lib/images.ts

## Import Cycles
- None detected.

## Communities (107 total, 38 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.07
Nodes (49): Audience, SignIn(), BadgeTone, toneClass, AnimatedBrandSymbol(), BITE_PATHS, BrandLogo(), BrandSymbol() (+41 more)

### Community 1 - "complaints/components.tsx"
Cohesion: 0.07
Nodes (60): ActionPanel(), attach(), ComplaintDetail(), CATEGORIES, Place, PLACE_DOMAIN, AttachmentThumb(), BoardCard() (+52 more)

### Community 2 - "notifications.py"
Cohesion: 0.06
Nodes (21): get_supabase(), get_push_token_repository(), PushTokenRepository, SupabasePushTokenRepository, get_push_service(), Notifier, PushMessage, PushReport (+13 more)

### Community 3 - "test_rebates.py"
Cohesion: 0.05
Nodes (49): get_rebate_repository(), RebateOverlapError, RebateRepository, SupabaseRebateRepository, get_rebate_service(), submit_rebate(), transition_rebate(), RebateCreate (+41 more)

### Community 4 - "canteens/components.tsx"
Cohesion: 0.13
Nodes (41): MESS_TOOLS, StaffConsole(), Tool, ToolRow(), CanteenHub(), Shift, Tab, DirectoryCard() (+33 more)

### Community 5 - "test_timings.py"
Cohesion: 0.25
Nodes (21): InMemoryTimingRepository, notifier(), override_body(), post(), RecordingNotifier, repo(), secy(), test_bhawan_secretary_can_notify_canteen_change() (+13 more)

### Community 6 - "services/timings.py"
Cohesion: 0.13
Nodes (10): SupabaseTimingRepository, TimingRepository, MealSlot, OutletInfo, OutletType, TimingOverrideCreate, TimingOverrideOut, describe_override() (+2 more)

### Community 7 - "canteens/queries.ts"
Cohesion: 0.08
Nodes (37): OutletConsole(), Bhawan, campusKeys, Outlet, useOutlets(), ContactEditor(), LocationEditor(), OpenToggleCard() (+29 more)

### Community 8 - "manage.tsx"
Cohesion: 0.06
Nodes (81): ExtraItemsScreen(), MessPhotoScreen(), MessTimingsScreen(), TimingsEditor(), submit(), addPhoto(), hhmm(), MenuPhotoUploader() (+73 more)

### Community 9 - "public.profiles"
Cohesion: 0.13
Nodes (21): on_auth_user_created, profiles_bhawan_id_idx, public.bhawans, public.handle_new_user(), public.profiles, public.role_assignments, public.whitelisted_vendors, role_assignments_assigned_by_idx (+13 more)

### Community 11 - "Settings"
Cohesion: 0.05
Nodes (20): get_current_user(), get_token_verifier(), TokenVerifier, get_settings(), Settings, create_app(), healthz(), require_internal_secret() (+12 more)

### Community 12 - "AdminService"
Cohesion: 0.07
Nodes (9): CurrentUser, require_role(), dependency(), ApiError, AdminRepository, EateryOut, AdminService, 3.4 Authorisation layers (+1 more)

### Community 13 - "services/admin.py"
Cohesion: 0.10
Nodes (19): AdminCreate, BhawanCreate, BhawanUpdate, _check_pin(), _contact_phone(), EateryCreate, EateryUpdate, _iitr_email() (+11 more)

### Community 14 - "test_complaints.py"
Cohesion: 0.21
Nodes (24): ComplaintDomain, act(), code(), InMemoryComplaintRepository, make_complaint(), notifier(), nudge(), RecordingNotifier (+16 more)

### Community 15 - "rebates.tsx"
Cohesion: 0.11
Nodes (38): RebateReview(), NoHostelCard(), RebateForm(), attach(), send(), RebatesScreen(), ZoomableImage(), ZoomableImageProps (+30 more)

### Community 16 - "InMemoryAdminRepository"
Cohesion: 0.05
Nodes (62): DuplicateError, InUseError, admin_headers(), InMemoryAdminRepository, repo(), test_add_admin_with_account_is_active(), test_add_admin_without_account_is_invited(), test_admin_cannot_remove_own_admin_role() (+54 more)

### Community 17 - "public.outlets"
Cohesion: 0.13
Nodes (19): outlets_bhawan_id_idx, outlets_bhawan_type_key, public.outlets, app.can_run_outlet(), default_shift, outlet_shifts_updated_by_idx, public.fixed_rate_items, public.menu_items (+11 more)

### Community 18 - "web/package.json"
Cohesion: 0.06
Nodes (40): dependencies, lucide-react@^1.60.0, motion@^14.5.0, react@^19.3.1, react-dom@^19.3.1, react-router@^7.18.4, @supabase/supabase-js@^2.118.0, @tanstack/react-query@^5.104.5 (+32 more)

### Community 19 - "dependencies"
Cohesion: 0.04
Nodes (66): dependencies, expo-dev-client@~58.0.14, expo-document-picker@~58.0.4, expo-file-system@~58.0.9, expo-glass-effect@~58.0.4, expo-haptics@~58.0.7, expo-image@~58.0.15, expo-image-manipulator@~58.0.14 (+58 more)

### Community 20 - "ComplaintOut"
Cohesion: 0.10
Nodes (9): ComplaintRepository, get_complaint_repository(), _rows(), SupabaseComplaintRepository, get_complaint_service(), ComplaintOut, ComplaintStatus, ComplaintTransition (+1 more)

### Community 21 - "SupabaseAdminRepository"
Cohesion: 0.09
Nodes (8): _raise_duplicate(), _raise_in_use(), _role_assignment(), SupabaseAdminRepository, _whitelist_entry(), AdminOut, RoleAssignmentOut, WhitelistEntry

### Community 22 - "expo"
Cohesion: 0.05
Nodes (39): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, web (+31 more)

### Community 23 - "devDependencies"
Cohesion: 0.10
Nodes (21): { defineConfig }, expoConfig, devDependencies, eslint@^9.0.0, eslint-config-expo@~58.0.4, jest@~30.5.2, jest-expo@~58.0.11, prettier-plugin-tailwindcss@^0.8.1 (+13 more)

### Community 24 - "ui.tsx"
Cohesion: 0.16
Nodes (27): App(), BITE_PATHS, BrandSymbol(), LETTERS, LOGO_SPRING, Tone, Wordmark(), Layout() (+19 more)

### Community 25 - "publish_github_release"
Cohesion: 0.07
Nodes (29): name, params, type, APP_VERSION, BUILD_ID, COMMIT, GITHUB_REPO, jobs (+21 more)

### Community 26 - "bearer"
Cohesion: 0.19
Nodes (12): bearer(), probe(), test_expired_token_is_401(), test_garbage_token_is_401(), test_missing_token_is_401(), test_require_role_allows_any_listed_role(), test_require_role_rejects_others(), test_small_clock_skew_is_tolerated() (+4 more)

### Community 27 - "routers/admin.py"
Cohesion: 0.23
Nodes (20): add_admin(), add_whitelist(), assign_role(), create_bhawan(), create_eatery(), delete_bhawan(), delete_eatery(), delete_vendor() (+12 more)

### Community 29 - "VendorsPage.tsx"
Cohesion: 0.21
Nodes (19): Button(), ConfirmButton(), PasscodeField(), PasscodeReveal(), AddVendorForm(), submit(), MasterOutlets(), OutletList() (+11 more)

### Community 30 - "services/complaints.py"
Cohesion: 0.19
Nodes (8): nudge_complaint(), transition_complaint(), describe_for_handlers(), describe_for_student(), describe_nudge(), hours_until(), TransitionResult, utc_now()

### Community 31 - "HostelsPage.tsx"
Cohesion: 0.21
Nodes (20): Card(), EmptyState(), Notice(), TextField(), AddAdminForm(), AdminsPage(), AddEateryForm(), AddHostelForm() (+12 more)

### Community 32 - "lib/session.tsx"
Cohesion: 0.14
Nodes (12): AccessClaims, isAdminToken(), readClaims(), SessionContext, SessionContextValue, SessionProvider(), apply(), SessionState (+4 more)

### Community 33 - "mobile/tailwind.config.js"
Cohesion: 0.25
Nodes (5): borderRadius, fontFamily, fontSize, spacing, sans

### Community 34 - "admin/queries.ts"
Cohesion: 0.06
Nodes (44): BhawanRow(), close(), save(), BhawansScreen(), EateryRow(), close(), save(), AdminBhawan (+36 more)

### Community 35 - "api"
Cohesion: 0.21
Nodes (16): groupVendors(), useAssignOutlet(), useDeleteVendor(), useInvalidateVendors(), useMakeMasterVendor(), useRemoveMasterVendor(), useSetPasscode(), useUnassignOutlet() (+8 more)

### Community 36 - "modes.ts"
Cohesion: 0.08
Nodes (28): expo-font@~58.0.8, @expo-google-fonts/nunito-sans@^0.4.2, expo-splash-screen@~58.0.10, expo-status-bar@~58.0.3, react-native-gesture-handler@~3.3.0, Index(), queryClient, RootLayout() (+20 more)

### Community 37 - "EateriesPage.tsx"
Cohesion: 0.20
Nodes (15): SelectField(), submit(), EateryItem(), parseContact(), GROUPS, OutletSelect(), EateryInput, Outlet (+7 more)

### Community 38 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 39 - "011_complaints.sql"
Cohesion: 0.15
Nodes (20): complaint_events_actor_idx, complaint_events_attachment_idx, complaint_events_complaint_idx, complaint_nudges_complaint_idx, complaint_nudges_nudged_by_idx, complaints_created_by_idx, complaints_outlet_idx, complaints_queue_idx (+12 more)

### Community 40 - "campus.ts"
Cohesion: 0.18
Nodes (22): EateriesMapScreen(), SelectedEatery(), OutletStatus, CAMPUS_CENTER, CampusMapProps, directionsUrl(), eateryPins(), MapPin (+14 more)

### Community 41 - "AdminsPage.tsx"
Cohesion: 0.19
Nodes (12): Pill(), AdminItem(), adminKeys, AdminRow, useAddAdmin(), useAdmins(), useRemoveAdmin(), API_URL (+4 more)

### Community 42 - "push.ts"
Cohesion: 0.15
Nodes (13): expo-constants@~58.0.12, expo-device@~58.0.5, expo-notifications@~58.1.5, expo-secure-store@~58.0.2, ANDROID_CHANNELS, easProjectId(), PushRegistration, registerForPush() (+5 more)

### Community 43 - "004_mess.sql"
Cohesion: 0.15
Nodes (15): extra_items_updated_by_idx, public.extra_items, public.meal_timings, public.menu_photos_retire_previous(), public.photo_reports, public.push_tokens, public.stamp_updated_by(), public.timing_overrides (+7 more)

### Community 44 - "routers/timings.py"
Cohesion: 0.21
Nodes (4): get_timing_repository(), create_timing_override(), get_timing_service(), revoke_timing_override()

### Community 45 - "auth.ts"
Cohesion: 0.21
Nodes (13): submit(), AuthCallback(), VendorSignIn(), signIn(), save(), AuthResult, completeWebGoogleSignIn(), exchangeRedirect() (+5 more)

### Community 46 - "009_rebates.sql"
Cohesion: 0.27
Nodes (13): guard_transition, log_event, public.rebate_applications, public.rebate_events, public.rebate_guard_transition(), public.rebate_log_event(), rebate_applications_document_idx, rebate_applications_queue_idx (+5 more)

### Community 47 - "Campus Bites — System Architecture"
Cohesion: 0.17
Nodes (12): status(), 10. Non-goals (V1), 1. Stack at a glance, 3.1 Sign-in methods, 3.3 What the app does after sign-in (`src/app/_layout.tsx`, `src/app/index.tsx`), 3.5 Keys & secrets, 3. Authentication & access control, 7.1 Seed roster (`supabase/seed.sql`) (+4 more)

### Community 48 - "time.py"
Cohesion: 0.17
Nodes (5): format_dates(), format_time(), today_ist(), test_format_dates(), test_format_time()

### Community 49 - "Card"
Cohesion: 0.10
Nodes (49): AdminHome(), SECTIONS, EateriesAdminScreen(), ASSIGNABLE, RolesScreen(), WhitelistScreen(), StudentSignIn(), AuthorityHome() (+41 more)

### Community 50 - "public.menu_photos"
Cohesion: 0.19
Nodes (11): public.app_settings, public.menu_photos, retire_previous, public.complaint_escalate_due(), public.complaint_nudge(), enforce_cap, public.menu_photos_enforce_cap(), menu_photos_outlet_kind_created_idx (+3 more)

### Community 51 - "Campus Bites — Privacy Policy"
Cohesion: 0.20
Nodes (8): Campus Bites — Privacy Policy, Changes, Google user data, How we use it, Storage and sharing, What we collect, Your choices, Campus Bites — Terms of Service

### Community 52 - "ComplaintRules"
Cohesion: 0.17
Nodes (4): run_escalations(), ComplaintRules, EscalationReport, describe_escalation()

### Community 53 - "metro.config.js"
Cohesion: 0.22
Nodes (7): config, { getDefaultConfig }, { withNativeWind }, expo@~58.0.14, nativewind@^4.2.7, expo, nativewind

### Community 54 - "TASKS.md — Campus Bites implementation checklist"
Cohesion: 0.20
Nodes (10): M0 — Decisions & accounts (no code) — ✅ COMPLETE, M1 — Foundation — ✅ COMPLETE, M3 — Mess Hub (Module A, minus rebates) — ✅ COMPLETE, M4 — Hostel Canteens & Campus Eateries (Modules B, C) — ✅ COMPLETE, M5 — Mess Rebates (Module A.4) — ✅ COMPLETE, M7 — Campus map (Google Maps) — ✅ COMPLETE, M8 — Admin website (`apps/web`) — ✅ COMPLETE, Release end-to-end checklist (+2 more)

### Community 56 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, ios, lint, start, test, typecheck, web

### Community 57 - "mobile/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, strict, extends, include, @/assets/*, expo/tsconfig.base

### Community 58 - "CLAUDE.md — Campus Bites"
Cohesion: 0.25
Nodes (8): API coding constraints, Boundary rules (summary of ARCHITECTURE.md §2.1, §3.4), CLAUDE.md — Campus Bites, Commands, Database constraints, Repository layout, Stack (zero Docker), Working agreements

### Community 59 - "Alexandria — High-End Editorial"
Cohesion: 0.25
Nodes (7): Alexandria — High-End Editorial, Colors, Components, Elevation, North Star: "The Digital Curator", Rules, Typography

### Community 60 - "019_master_vendors.sql"
Cohesion: 0.26
Nodes (8): admin_invites_invited_by_idx, public.admin_invites, public.admin_vendor_accounts(), public.admin_delete_vendor(), public.admin_make_master_vendor(), public.admin_vendor_accounts(), public.master_vendors, public.outlets_assign_master_vendors()

### Community 61 - "publish-github-release.mjs"
Cohesion: 0.29
Nodes (4): [apkPath], headers, shortSha, uploadUrl

### Community 62 - "rate-card.tsx"
Cohesion: 0.23
Nodes (14): RateCardEditor(), startEdit(), submit(), RateCardScreen(), FixedRateCard(), PriceChip(), FixedRateItem, useDeleteFixedRate() (+6 more)

### Community 64 - "4. Admin operations (runbook)"
Cohesion: 0.29
Nodes (7): 4.1 Onboard a vendor (canteen owner / eatery staff), 4.2 Assign a role (secretary, authority, ADoSW, admin), 4.3 Change business constants, 4.4 Admins and the owner, 4.5 Manage the Bhawans and eateries (master list), 4.6 Admin website (`apps/web`), 4. Admin operations (runbook)

### Community 65 - "6. Feature flows"
Cohesion: 0.29
Nodes (7): 6.1 Mess Hub (migration `004_mess`), 6.2 Canteens & eateries (migrations `005`–`008`), 6.3 Push notifications, 6.4 Live open/closed status (`outlet_status_at`), 6.5 Mess rebates (migrations `009`, `010`), 6.6 Complaints & accountability (migrations `011`–`013`), 6. Feature flows

### Community 66 - "003_auth.sql"
Cohesion: 0.22
Nodes (4): guard_bhawan, public.custom_access_token_hook(), public.hook_before_user_created(), public.profiles_guard_bhawan()

### Community 68 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 69 - "5. Code layout & conventions"
Cohesion: 0.33
Nodes (6): 5.1 Mobile (`apps/mobile/src`), 5.2 API (`apps/api/app`), 5.2a Admin website (`apps/web/src`), 5.3 Database (`supabase/`), 5.4 Adding a feature (scales the same way), 5. Code layout & conventions

### Community 70 - "expo"
Cohesion: 0.40
Nodes (4): projectId, expo, extra, eas

### Community 73 - "3. Core Functional Modules (V1 Scope)"
Cohesion: 0.40
Nodes (5): 3. Core Functional Modules (V1 Scope), Module A: Hostel Mess Management (18 Hostels), Module B: Hostel Canteens (Day & Night Canteens per Bhawan), Module C: Common Campus Eateries, Module D: Unified Complaint, Escalation & Accountability Engine

### Community 75 - "package.json"
Cohesion: 0.67
Nodes (3): dependencies, eas-cli@^25.2.0, eas-cli

### Community 76 - "Campus Bites"
Cohesion: 0.50
Nodes (4): Admin website, Campus Bites, Get the app, Repository

## Knowledge Gaps
- **2 isolated node(s):** `campus-bites-api`, `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 540 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `test_small_clock_skew_is_tolerated()` connect `bearer` to `manage.tsx`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `InMemoryAdminRepository` (e.g. with `DuplicateError` and `InUseError`) actually correct?**
  _`InMemoryAdminRepository` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `campus-bites-api`, `expo/tsconfig.base` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._
- **Why does `AppRole` connect `AppRole` to `test_rebates.py`, `test_timings.py`, `services/timings.py`, `UUID`, `Settings`, `AdminService`, `services/admin.py`, `test_complaints.py`, `InMemoryAdminRepository`, `ComplaintOut`, `SupabaseAdminRepository`, `bearer`, `routers/admin.py`, `services/complaints.py`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `AppRole` (e.g. with `CurrentUser` and `require_role()`) actually correct?**
  _`AppRole` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Should `complaints/components.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07039337474120083 - nodes in this community are weakly interconnected._