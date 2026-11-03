# Graph Report - campus-bites  (2026-11-02)

## Corpus Check
- 248 files · ~123,709 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 5, .example 4, .css 2)

## Summary
- 2201 nodes · 6883 edges · 124 communities (84 shown, 40 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 346 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e7c1e53b`
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
- useSession
- manage.tsx
- public.profiles
- test_admin.py
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
- services/complaints.py
- admin/queries.ts
- Notice
- app/_layout.tsx
- EateriesPage.tsx
- compilerOptions
- 011_complaints.sql
- campus.ts
- RolesPage.tsx
- push.ts
- 004_mess.sql
- routers/timings.py
- test_push.py
- 009_rebates.sql
- Campus Bites — System Architecture
- time.py
- Card
- public.custom_access_token_hook
- Campus Bites — Privacy Policy
- run_escalations
- metro.config.js
- images.ts
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
- mobile/package.json
- package.json
- Campus Bites
- vite-env.d.ts
- nativewind-env.d.ts
- campus-bites-api
- auth_rls_test.sql
- (student)/complaints.tsx
- complaint/[id].tsx
- complaints/queries.ts
- get_current_user
- database.types.ts
- TokenFactory
- ActionPanel
- useNow
- parametrize
- repo
- 3. Authentication & access control
- 017_admin_web.sql
- test_remove_admin_and_invite
- expo-document-picker
- expo-haptics
- expo-updates@~58.0.17
- @tanstack/react-query@^5.104.3

## God Nodes (most connected - your core abstractions)
1. `InMemoryAdminRepository` - 103 edges
2. `Card()` - 87 edges
3. `AppRole` - 69 edges
4. `react-native` - 64 edges
5. `Button()` - 63 edges
6. `Screen()` - 61 edges
7. `CurrentUser` - 54 edges
8. `useSession()` - 53 edges
9. `AdminService` - 49 edges
10. `ApiError` - 46 edges

## Surprising Connections (you probably didn't know these)
- `API coding constraints` --references--> `CurrentUser`  [INFERRED]
  CLAUDE.md → apps/api/app/core/auth.py
- `3.2 JWT claims (`public.custom_access_token_hook`)` --references--> `student()`  [INFERRED]
  ARCHITECTURE.md → apps/api/tests/test_rebates.py
- `6.4 Live open/closed status (`outlet_status_at`)` --references--> `OpenStatusPill()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/features/canteens/components.tsx
- `3.1 Sign-in methods` --references--> `completeWebGoogleSignIn()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/lib/auth.ts
- `5.1 Mobile (`apps/mobile/src`)` --references--> `compressForUpload()`  [INFERRED]
  ARCHITECTURE.md → apps/mobile/src/lib/images.ts

## Import Cycles
- None detected.

## Communities (124 total, 40 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.06
Nodes (53): Audience, SignIn(), StudentSignIn(), CATEGORIES, Place, PLACE_DOMAIN, BadgeTone, toneClass (+45 more)

### Community 1 - "complaints/components.tsx"
Cohesion: 0.12
Nodes (22): CATEGORY_ICON, eventTitle(), NudgeButton(), STATUS_TONE, TicketFields, CATEGORY_LABEL, Clocked, ComplaintAction (+14 more)

### Community 2 - "notifications.py"
Cohesion: 0.08
Nodes (10): get_supabase(), get_push_token_repository(), PushTokenRepository, SupabasePushTokenRepository, get_notifier(), get_push_service(), Notifier, PushReport (+2 more)

### Community 3 - "test_rebates.py"
Cohesion: 0.06
Nodes (47): get_rebate_repository(), RebateOverlapError, RebateRepository, SupabaseRebateRepository, get_rebate_service(), submit_rebate(), transition_rebate(), RebateCreate (+39 more)

### Community 4 - "canteens/components.tsx"
Cohesion: 0.15
Nodes (31): CanteenHub(), Shift, Tab, DirectoryCard(), EateriesDirectory(), outletHref(), Tab, EateryDetail() (+23 more)

### Community 5 - "test_timings.py"
Cohesion: 0.36
Nodes (18): InMemoryTimingRepository, override_body(), post(), RecordingNotifier, test_bhawan_secretary_can_notify_canteen_change(), test_canteen_override_cannot_target_a_meal(), test_closed_meal_override(), test_eatery_changes_never_broadcast() (+10 more)

### Community 6 - "services/timings.py"
Cohesion: 0.16
Nodes (6): SupabaseTimingRepository, TimingRepository, OutletInfo, TimingOverrideCreate, TimingOverrideOut, TimingService

### Community 7 - "useSession"
Cohesion: 0.08
Nodes (42): AdminHome(), SECTIONS, AuthCallback(), AuthorityHome(), Filter, FILTERS, Onboarding(), StaffComplaints() (+34 more)

### Community 8 - "manage.tsx"
Cohesion: 0.07
Nodes (73): TimingsEditor(), submit(), send(), hhmm(), MenuPhotoUploader(), pick(), ShiftChangeEditor(), submit() (+65 more)

### Community 9 - "public.profiles"
Cohesion: 0.17
Nodes (22): on_auth_user_created, outlets_bhawan_id_idx, outlets_bhawan_type_key, profiles_bhawan_id_idx, public.bhawans, public.handle_new_user(), public.outlets, public.profiles (+14 more)

### Community 10 - "test_admin.py"
Cohesion: 0.10
Nodes (40): test_add_admin_without_account_is_invited(), test_admin_cannot_remove_own_admin_role(), test_admin_cannot_remove_themselves(), test_admin_list_marks_owner(), test_assign_mess_secretary(), test_assign_unknown_user_is_404(), test_create_bhawan_derives_seed_style_slug(), test_create_eatery() (+32 more)

### Community 11 - "Settings"
Cohesion: 0.07
Nodes (17): get_settings(), Settings, create_app(), healthz(), require_internal_secret(), HealthResponse, app(), client() (+9 more)

### Community 12 - "AdminService"
Cohesion: 0.13
Nodes (6): CurrentUser, ApiError, AdminOut, AdminService, _path_phone(), 3.4 Authorisation layers

### Community 13 - "services/admin.py"
Cohesion: 0.10
Nodes (18): AdminCreate, BhawanCreate, BhawanUpdate, _check_pin(), _contact_phone(), EateryCreate, EateryUpdate, _iitr_email() (+10 more)

### Community 14 - "test_complaints.py"
Cohesion: 0.17
Nodes (30): ComplaintDomain, ComplaintStatus, act(), code(), InMemoryComplaintRepository, make_complaint(), notifier(), nudge() (+22 more)

### Community 15 - "rebates.tsx"
Cohesion: 0.11
Nodes (36): RebateReview(), RebateQueue(), NoHostelCard(), RebateForm(), attach(), RebatesScreen(), Skeleton(), ZoomableImage() (+28 more)

### Community 16 - "InMemoryAdminRepository"
Cohesion: 0.07
Nodes (9): DuplicateError, InUseError, InMemoryAdminRepository, test_eatery_pin_is_created_moved_and_cleared(), test_empty_bhawan_update_is_422(), test_passcode_needs_whitelisted_phone(), test_second_mess_secretary_for_bhawan_is_409(), test_whitelist_delete() (+1 more)

### Community 17 - "public.outlets"
Cohesion: 0.15
Nodes (14): app.can_run_outlet(), default_shift, outlet_shifts_updated_by_idx, public.fixed_rate_items, public.menu_items, public.outlet_shift_occurrences(), public.outlet_shifts, public.outlet_status_at() (+6 more)

### Community 18 - "web/package.json"
Cohesion: 0.06
Nodes (40): dependencies, lucide-react@^1.60.0, motion@^14.5.0, react@^19.3.1, react-dom@^19.3.1, react-router@^7.18.4, @supabase/supabase-js@^2.118.0, @tanstack/react-query@^5.104.5 (+32 more)

### Community 19 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, expo-dev-client@~58.0.14, expo-glass-effect@~58.0.4, expo-image@~58.0.15, expo-image-manipulator@~58.0.14, expo-image-picker@~58.0.10, expo-router@~58.0.23, expo-symbols@~58.0.4 (+24 more)

### Community 20 - "ComplaintOut"
Cohesion: 0.10
Nodes (8): ComplaintRepository, get_complaint_repository(), _rows(), SupabaseComplaintRepository, get_complaint_service(), ComplaintOut, ComplaintService, TransitionResult

### Community 21 - "SupabaseAdminRepository"
Cohesion: 0.06
Nodes (12): AdminRepository, _raise_duplicate(), _raise_in_use(), _role_assignment(), SupabaseAdminRepository, _whitelist_entry(), BhawanOut, EateryOut (+4 more)

### Community 22 - "expo"
Cohesion: 0.05
Nodes (39): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, web (+31 more)

### Community 23 - "devDependencies"
Cohesion: 0.10
Nodes (21): { defineConfig }, expoConfig, devDependencies, eslint@^9.0.0, eslint-config-expo@~58.0.4, jest@~30.5.2, jest-expo@~58.0.11, prettier-plugin-tailwindcss@^0.8.1 (+13 more)

### Community 24 - "ui.tsx"
Cohesion: 0.16
Nodes (23): BITE_PATHS, BrandSymbol(), LETTERS, LOGO_SPRING, Tone, Wordmark(), Layout(), NAV (+15 more)

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
Cohesion: 0.13
Nodes (32): Button(), ConfirmButton(), PasscodeField(), PasscodeReveal(), groupVendors(), useAssignOutlet(), useDeleteVendor(), useInvalidateVendors() (+24 more)

### Community 30 - "services/complaints.py"
Cohesion: 0.25
Nodes (6): nudge_complaint(), transition_complaint(), ComplaintTransition, describe_for_handlers(), describe_for_student(), describe_nudge()

### Community 31 - "HostelsPage.tsx"
Cohesion: 0.20
Nodes (13): Card(), AddHostelForm(), HostelCard(), OUTLET_ICON, OUTLET_ORDER, Hostel, hostelKeys, useCreateHostel() (+5 more)

### Community 32 - "lib/session.tsx"
Cohesion: 0.14
Nodes (13): AccessClaims, isAdminToken(), readClaims(), SessionContext, SessionContextValue, SessionProvider(), apply(), SessionState (+5 more)

### Community 33 - "services/complaints.py"
Cohesion: 0.10
Nodes (9): require_role(), dependency(), today_ist(), ComplaintRules, MealSlot, OutletType, hours_until(), utc_now() (+1 more)

### Community 34 - "admin/queries.ts"
Cohesion: 0.06
Nodes (42): BhawanRow(), close(), save(), Index(), AdminBhawan, AdminEatery, AssignableRole, BHAWAN_SCOPED_ROLES (+34 more)

### Community 35 - "Notice"
Cohesion: 0.46
Nodes (13): App(), EmptyState(), Loading(), Notice(), PageHeader(), AdminsPage(), EateriesPage(), useOutlets() (+5 more)

### Community 36 - "app/_layout.tsx"
Cohesion: 0.14
Nodes (14): expo-font@~58.0.8, @expo-google-fonts/nunito-sans@^0.4.2, expo-splash-screen@~58.0.10, expo-status-bar@~58.0.3, react-native-gesture-handler@~3.3.0, queryClient, RootLayout(), RootNavigator() (+6 more)

### Community 37 - "EateriesPage.tsx"
Cohesion: 0.20
Nodes (16): SelectField(), TextField(), AddEateryForm(), submit(), EateryItem(), parseContact(), GROUPS, OutletSelect() (+8 more)

### Community 38 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 39 - "011_complaints.sql"
Cohesion: 0.15
Nodes (20): complaint_events_actor_idx, complaint_events_attachment_idx, complaint_events_complaint_idx, complaint_nudges_complaint_idx, complaint_nudges_nudged_by_idx, complaints_created_by_idx, complaints_outlet_idx, complaints_queue_idx (+12 more)

### Community 40 - "campus.ts"
Cohesion: 0.17
Nodes (24): EateriesMapScreen(), SelectedEatery(), OutletStatus, useLiveStatus(), CAMPUS_CENTER, CampusMapProps, directionsUrl(), eateryPins() (+16 more)

### Community 41 - "RolesPage.tsx"
Cohesion: 0.12
Nodes (26): Pill(), AddAdminForm(), AdminItem(), adminKeys, AdminRow, useAddAdmin(), useAdmins(), useRemoveAdmin() (+18 more)

### Community 42 - "push.ts"
Cohesion: 0.13
Nodes (16): expo-constants@~58.0.12, expo-device@~58.0.5, expo-notifications@~58.1.5, expo-secure-store@~58.0.2, defaultMode(), modesFor(), SessionProvider(), ANDROID_CHANNELS (+8 more)

### Community 43 - "004_mess.sql"
Cohesion: 0.11
Nodes (20): extra_items_updated_by_idx, public.extra_items, public.meal_timings, public.menu_photos, public.menu_photos_retire_previous(), public.mess_schedule_today, public.photo_reports, public.push_tokens (+12 more)

### Community 44 - "routers/timings.py"
Cohesion: 0.18
Nodes (4): get_timing_repository(), create_timing_override(), get_timing_service(), revoke_timing_override()

### Community 45 - "test_push.py"
Cohesion: 0.15
Nodes (12): PushMessage, FakeTokens, make_service(), test_batches_of_100_and_parses_tickets(), handler(), test_channel_priority_and_auth_header_are_sent(), test_http_failure_is_reported_not_raised(), test_notifier_dedupes_and_prunes() (+4 more)

### Community 46 - "009_rebates.sql"
Cohesion: 0.27
Nodes (13): guard_transition, log_event, public.rebate_applications, public.rebate_events, public.rebate_guard_transition(), public.rebate_log_event(), rebate_applications_document_idx, rebate_applications_queue_idx (+5 more)

### Community 47 - "Campus Bites — System Architecture"
Cohesion: 0.25
Nodes (8): status(), 10. Non-goals (V1), 1. Stack at a glance, 7.1 Seed roster (`supabase/seed.sql`), 7. Data model, 8. Environments & deployment, 9. Decisions, Campus Bites — System Architecture

### Community 48 - "time.py"
Cohesion: 0.15
Nodes (6): format_dates(), format_time(), describe_override(), test_describe_override(), test_format_dates(), test_format_time()

### Community 49 - "Card"
Cohesion: 0.10
Nodes (47): BhawansScreen(), EateriesAdminScreen(), EateryRow(), close(), save(), ASSIGNABLE, RolesScreen(), WhitelistScreen() (+39 more)

### Community 50 - "public.custom_access_token_hook"
Cohesion: 0.13
Nodes (10): public.app_settings, public.complaint_escalate_due(), public.complaint_nudge(), menu_photos_outlet_kind_created_idx, public.custom_access_token_hook(), public.menu_photos_enforce_cap(), public.outlet_shift_occurrences(), public.search_food() (+2 more)

### Community 51 - "Campus Bites — Privacy Policy"
Cohesion: 0.20
Nodes (8): Campus Bites — Privacy Policy, Changes, Google user data, How we use it, Storage and sharing, What we collect, Your choices, Campus Bites — Terms of Service

### Community 52 - "run_escalations"
Cohesion: 0.33
Nodes (3): run_escalations(), EscalationReport, describe_escalation()

### Community 53 - "metro.config.js"
Cohesion: 0.22
Nodes (7): config, { getDefaultConfig }, { withNativeWind }, expo@~58.0.14, nativewind@^4.2.7, expo, nativewind

### Community 54 - "images.ts"
Cohesion: 0.08
Nodes (27): uploadDocument(), useSubmitRebate(), ATTACHMENT_COMPRESSION, CompressedImage, compressForUpload(), CompressOptions, NOTICEBOARD_BUCKET, PickedImage (+19 more)

### Community 56 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, ios, lint, start, test, typecheck, web

### Community 57 - "mobile/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, strict, extends, include, @/assets/*, expo/tsconfig.base

### Community 58 - "CLAUDE.md — Campus Bites"
Cohesion: 0.22
Nodes (9): API coding constraints, Boundary rules (summary of ARCHITECTURE.md §2.1, §3.4), CLAUDE.md — Campus Bites, Code graph (graphify), Commands, Database constraints, Repository layout, Stack (zero Docker) (+1 more)

### Community 59 - "Alexandria — High-End Editorial"
Cohesion: 0.25
Nodes (7): Alexandria — High-End Editorial, Colors, Components, Elevation, North Star: "The Digital Curator", Rules, Typography

### Community 60 - "019_master_vendors.sql"
Cohesion: 0.33
Nodes (7): app.can_manage_mess(), assign_master_vendors, public.admin_delete_vendor(), public.admin_make_master_vendor(), public.admin_vendor_accounts(), public.master_vendors, public.outlets_assign_master_vendors()

### Community 61 - "publish-github-release.mjs"
Cohesion: 0.29
Nodes (4): [apkPath], headers, shortSha, uploadUrl

### Community 62 - "rate-card.tsx"
Cohesion: 0.12
Nodes (24): RateCardEditor(), startEdit(), submit(), RateCardScreen(), FixedRateCard(), PriceChip(), canteenKeys, FixedRateItem (+16 more)

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
Cohesion: 0.40
Nodes (5): 5.1 Mobile (`apps/mobile/src`), 5.2 API (`apps/api/app`), 5.2a Admin website (`apps/web/src`), 5.3 Database (`supabase/`), 5. Code layout & conventions

### Community 70 - "expo"
Cohesion: 0.40
Nodes (4): projectId, expo, extra, eas

### Community 73 - "3. Core Functional Modules (V1 Scope)"
Cohesion: 0.40
Nodes (5): 3. Core Functional Modules (V1 Scope), Module A: Hostel Mess Management (18 Hostels), Module B: Hostel Canteens (Day & Night Canteens per Bhawan), Module C: Common Campus Eateries, Module D: Unified Complaint, Escalation & Accountability Engine

### Community 74 - "mobile/package.json"
Cohesion: 0.07
Nodes (26): expo-file-system@~58.0.9, expo-linear-gradient@~58.0.3, expo-linking@~58.0.13, expo-system-ui@~58.0.6, react@19.3.0, react-native-css-interop@^0.2.7, react-native-maps@1.29.11, react-native-safe-area-context@~5.10.1 (+18 more)

### Community 75 - "package.json"
Cohesion: 0.67
Nodes (3): dependencies, eas-cli@^25.2.0, eas-cli

### Community 76 - "Campus Bites"
Cohesion: 0.50
Nodes (4): Admin website, Campus Bites, Get the app, Repository

### Community 107 - "(student)/complaints.tsx"
Cohesion: 0.25
Nodes (13): ComplaintsHub(), DOMAINS, IssueBoard(), MyComplaints(), Stat(), Tab, CountUp(), BoardCard() (+5 more)

### Community 108 - "complaint/[id].tsx"
Cohesion: 0.32
Nodes (12): ComplaintDetail(), AttachmentThumb(), ComplaintStatusBadge(), ComplaintTimeline(), ComplaintTracker(), LongStandingBadge(), Ticket(), availableActions() (+4 more)

### Community 109 - "complaints/queries.ts"
Cohesion: 0.19
Nodes (12): BoardRow, Complaint, COMPLAINT_BUCKET, ComplaintEvent, complaintKeys, MAX_PHOTOS, sortEvents(), uploadPhoto() (+4 more)

### Community 110 - "get_current_user"
Cohesion: 0.21
Nodes (3): get_current_user(), get_token_verifier(), TokenVerifier

### Community 111 - "database.types.ts"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, TablesInsert (+2 more)

### Community 112 - "TokenFactory"
Cohesion: 0.22
Nodes (6): admin_headers(), repo(), test_students_cannot_make_master_vendors(), test_students_cannot_manage_bhawans(), test_students_cannot_set_passcodes(), test_students_cannot_use_admin_api()

### Community 113 - "ActionPanel"
Cohesion: 0.33
Nodes (5): ActionPanel(), attach(), complaintErrorMessage(), COPY, SERVER_WORDED

### Community 114 - "useNow"
Cohesion: 0.43
Nodes (6): subscribeTo(), subscriptions, Ticker, tickerFor(), tickers, useNow()

### Community 115 - "parametrize"
Cohesion: 0.40
Nodes (4): test_duplicate_admin_is_409(), test_incomplete_or_invalid_pin_is_422(), test_invalid_bhawan_name_is_422(), test_invalid_role_requests_are_422()

### Community 116 - "repo"
Cohesion: 0.50
Nodes (3): notifier(), repo(), secy()

### Community 117 - "3. Authentication & access control"
Cohesion: 0.40
Nodes (5): 3.1 Sign-in methods, 3.2 JWT claims (`public.custom_access_token_hook`), 3.3 What the app does after sign-in (`src/app/_layout.tsx`, `src/app/index.tsx`), 3.5 Keys & secrets, 3. Authentication & access control

### Community 118 - "017_admin_web.sql"
Cohesion: 0.50
Nodes (3): admin_invites_invited_by_idx, public.admin_invites, public.admin_vendor_accounts()

### Community 119 - "test_remove_admin_and_invite"
Cohesion: 0.50
Nodes (3): test_add_admin_with_account_is_active(), test_owner_admin_cannot_be_removed(), test_remove_admin_and_invite()

## Knowledge Gaps
- **2 isolated node(s):** `campus-bites-api`, `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 548 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `test_small_clock_skew_is_tolerated()` connect `bearer` to `manage.tsx`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `InMemoryAdminRepository` (e.g. with `DuplicateError` and `InUseError`) actually correct?**
  _`InMemoryAdminRepository` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `campus-bites-api`, `expo/tsconfig.base` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06052093973442288 - nodes in this community are weakly interconnected._
- **Why does `AppRole` connect `SupabaseAdminRepository` to `services/complaints.py`, `test_rebates.py`, `test_timings.py`, `services/timings.py`, `UUID`, `test_admin.py`, `AdminService`, `services/admin.py`, `test_complaints.py`, `InMemoryAdminRepository`, `ComplaintOut`, `test_remove_admin_and_invite`, `bearer`, `routers/admin.py`, `AppRole`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `AppRole` (e.g. with `CurrentUser` and `require_role()`) actually correct?**
  _`AppRole` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Should `complaints/components.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11965811965811966 - nodes in this community are weakly interconnected._