## 1. Document Overview

- **Product Name:** Campus Bites
- **Target Audience:** IIT Roorkee Students, Mess & Bhawan Secretaries, Institute Authorities (Mess Administration & ADoSW), and External Eatery/Canteen Vendors.
- **Tech Stack Target:** React Native (Expo Router + NativeWind), FastAPI, Supabase (PostgreSQL, GoTrue Auth, Storage, Realtime).

## 2. User Roles & Authentication Matrix (RBAC)

| <br />                                                         | <br />                              | <br />                                                                                            | <br />                                                                                                                                                                                                      |
| :------------------------------------------------------------- | :---------------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role**                                                       | **Auth Method**                     | **Provisioning**                                                                                  | **Core Permissions**                                                                                                                                                                                        |
| **Student**                                                    | Google OAuth (`@<dept>.iitr.ac.in`) | Auto-provisioned on first login; selects assigned Bhawan (1 of 18 hostels)                        | View all mess/canteen/eatery menus & live timings; apply for mess rebates; raise complaints; nudge secretaries; confirm/reject complaint resolution.                                                        |
| **Mess Secretary** (1 per Bhawan)                              | Google OAuth (`@<dept>.iitr.ac.in`) | Assigned role by Admin                                                                            | Upload weekly mess menu (structured text + noticeboard photo); update Extra Items price list; override daily/seasonal mess timings (triggers push notification); reply to & update mess complaint statuses. |
| **Bhawan & Maintenance Secretary**                             | Google OAuth (`@<dept>.iitr.ac.in`) | Assigned role by Admin                                                                            | Manage hostel canteen shift timings; upload/update the Institute Fixed-Cost Menu; respond to and resolve hostel canteen complaints (hygiene, seating, lighting, food).                                      |
| **Mess Authority / Bhawan Warden Office**                      | Google OAuth (`@<dept>.iitr.ac.in`) | Assigned role by Admin                                                                            | View, verify (against biometric attendance records), approve, or reject online student mess rebate applications.                                                                                            |
| **ADoSW (Asst. Dean of Student Welfare)**                      | Google OAuth (`@<dept>.iitr.ac.in`) | Assigned role by Admin                                                                            | View, respond to, and resolve complaints raised against common campus eateries (CCD, Amul, CBRI Canteen, Yippee Kiosk, etc.); view cross-bhawan long-standing unresolved issues.                            |
| **Vendor / Staff** (Mess Manager, Canteen Owner, Eatery Staff) | **Phone Number + SMS OTP**          | **Pre-whitelisted only:** Admin must register phone number & link it to a specific canteen/eatery | Update custom menu items, prices, and stock availability ("In Stock / Sold Out"); toggle live Open/Closed status and shift timings.                                                                         |
| **System Admin**                                               | Google OAuth (`@<dept>.iitr.ac.in`) | Superuser                                                                                         | Whitelist vendor phone numbers; assign Secretary/Authority roles across the 18 Bhawans; manage master list of hostels and campus eateries.                                                                  |

<br />

## 3. Core Functional Modules (V1 Scope)

### Module A: Hostel Mess Management (18 Hostels)

1. **Dynamic Mess Timings & Alerts:**

   - **Default Schedule:** Breakfast (7:30 AM – 9:30 AM weekdays; 8:00 AM – 10:00 AM weekends/holidays), Lunch (12:30 PM – 2:30 PM), Dinner (7:30 PM – 9:30 PM).
   - **Seasonal/Daily Overrides:** Mess Secretary can publish temporary or seasonal timing changes with a reason note. Saving an override triggers an Expo Push Notification to all residents of that Bhawan.

2. **Weekly Mess Menu & Noticeboard Snapshot:**

   - Updated every Monday. Supports structured day-by-day meal cards (Mon–Sun \$\times\$ Breakfast/Lunch/Dinner) **plus** a zoomable high-res photo attachment of the physical signed mess noticeboard chart.

3. **Extra Items ("Pay-to-Get") Rate Card (V1 Read-Only):**

   - Displays available add-on items (Paneer, Egg, Curd, Butter, Night Milk, etc.) along with their unit prices and current availability, managed by the Mess Secretary. *(In-app payment is excluded from V1).*

4. **Online Mess Rebate Application:**

   - Students submit a rebate request with `start_date`, `end_date` (minimum consecutive days validation), `reason`, and optional supporting document.
   - Status workflow: `Pending Verification` \$\rightarrow\$ `Biometric Cross-Checked` \$\rightarrow\$ `Approved` / `Rejected` (with authority remarks).

### Module B: Hostel Canteens (Day & Night Canteens per Bhawan)

1. **Dynamic Shift Timings:**

   - Every hostel features two canteens (Day Canteen: default 10:30 AM – 10:30 PM; Night Canteen: default 10:30 PM – 10:30 AM).
   - Because shift cycles frequently change (e.g., shifting to 2:00 AM – 2:00 PM), Canteen Owners or Bhawan Secretaries can update operating hours dynamically, displayed as a high-visibility **"OPEN NOW • Closes at \[Time]"** pill.

2. **Split Menu Architecture (Custom vs. Institute Fixed-Cost):**

   - **Tab 1 — Full Canteen Menu:** All items and prices uploaded by the Canteen Owner.
   - **Tab 2 — Institute Fixed-Rate Card:** An official, tamper-proof list of institute-subsidized items with fixed ceiling prices so students can immediately verify fair pricing.

### Module C: Common Campus Eateries

1. **Directory & Menus:** Dedicated directory for non-hostel outlets (Cafe Coffee Day, Amul Canteen, CBRI Canteen, Yippee Kiosk, etc.) with searchable menus, prices, location tags, and live Open/Closed status managed by outlet staff.

### Module D: Unified Complaint, Escalation & Accountability Engine

1. **Routing Logic:**

   - **Mess Complaints** \$\rightarrow\$ Routed to the respective **Mess Secretary**.
   - **Hostel Canteen Complaints** (Categories: *Hygiene, Seating, Lighting, Food Quality, Overcharging, Other*) \$\rightarrow\$ Routed to the **Bhawan & Maintenance Secretary**.
   - **Campus Eatery Complaints** \$\rightarrow\$ Routed directly to **ADoSW**.

2. **State Machine & Student Confirmation Gate:**

   - `Open` \$\rightarrow\$ `In Progress` (Secretary/Authority replies with action plan) \$\rightarrow\$ `Awaiting Student Confirmation` (Secretary marks resolved) \$\rightarrow\$ `Resolved` (ONLY after the student who raised it taps **"Confirm Resolved"**, or `Reopened` if the student rejects the fix).

3. **Long-Standing Highlight & "Nudge" Mechanism:**

   - Any complaint remaining unaddressed or unresolved past **48 hours** is automatically tagged with an amber/red **`LONG-STANDING ISSUE`** badge and pinned to the top of the Bhawan's public issue board.
   - The complainer gets a **`Nudge Secretary`** button (cooldown: once every 24 hours) that sends a high-priority push notification and increments a visible *"Nudged \$N\$ times"* counter on the ticket.

