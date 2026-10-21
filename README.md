# Campus Bites

The official IIT Roorkee dining platform: live mess menus and timings, hostel canteens, campus eateries, mess rebates and an accountable complaint system.

[![Latest Android build](https://img.shields.io/github/v/release/MeetCoding/campus-bites?label=Android%20APK&logo=android&sort=date)](https://github.com/MeetCoding/campus-bites/releases/latest/download/campus-bites.apk)
[![Admin website](https://img.shields.io/badge/Admin-website-094cb2)](https://campus-bites-1-5kch.onrender.com)

## Get the app

- **Android:** [download the latest APK](https://github.com/MeetCoding/campus-bites/releases/latest/download/campus-bites.apk). Open it on your phone and allow installing from this source. A new build is published automatically for every change to the app ([all builds](https://github.com/MeetCoding/campus-bites/releases)).
- **iOS:** not available yet.
- Sign in with your IITR Google account. Vendors sign in with their registered phone number and the passcode from the Campus Bites admin.

## Admin website

[campus-bites-1-5kch.onrender.com](https://campus-bites-1-5kch.onrender.com): manage admins, vendors (phone numbers, passcodes, master vendors), hostels and campus eateries. Only admin IITR Google accounts can sign in.

## Repository

| Folder | What it is |
| --- | --- |
| `apps/mobile` | Expo / React Native app (Android, iOS, web) |
| `apps/web` | Admin website (Vite + React) |
| `apps/api` | FastAPI backend |
| `supabase` | Database migrations and SQL tests |

Product scope: [`PRD.md`](./PRD.md) · Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md) · Build status: [`TASKS.md`](./TASKS.md)
