# Taskaroo Platform Architecture

**Multi-Platform Architecture Documentation**

_Version 1.0 | January 2026_

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Web Application](#web-application)
3. [Mobile Applications (iOS & Android)](#mobile-applications-ios--android)
4. [Router Application (Chrome Extension & Desktop Bridge)](#router-application-chrome-extension--desktop-bridge)
5. [Phase 2: Hardware Hub (Taskaroo Hub)](#phase-2-hardware-hub-taskaroo-hub)
6. [Supported Routers & DNS Fallback](#supported-routers--dns-fallback)
7. [Backend Services](#backend-services)
8. [Data Flow & Synchronization](#data-flow--synchronization)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Router Integration Implementation Timeline](#router-integration-implementation-timeline)

---

## Architecture Overview

### System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TASKAROO ECOSYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Web App    │  │  iOS App     │  │ Android App  │  │   Router Control     │ │
│  │   (React)    │  │ (React Native│  │(React Native)│  │ (Chrome Ext/Bridge)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                 │                 │                      │            │
│         │                 │                 │                      │            │
│         └─────────────────┴────────┬────────┴──────────────────────┘            │
│                                    │                                             │
│                           ┌────────▼────────┐                                    │
│                           │    Supabase     │                                    │
│                           │  Backend (BaaS) │                                    │
│                           └────────┬────────┘                                    │
│                                    │                                             │
│         ┌──────────────────────────┼──────────────────────────┐                 │
│         │                          │                          │                 │
│  ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐        │
│  │  PostgreSQL │           │ Edge Functions │          │   Realtime    │        │
│  │  Database   │           │    (Deno)      │          │   Channels    │        │
│  └─────────────┘           └────────────────┘          └───────────────┘        │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                     WiFi Control Integration                              │   │
│  │                                                                           │   │
│  │  Phase 1: Desktop Bridge          Phase 2: Taskaroo Hub                  │   │
│  │  ┌─────────────────────┐          ┌─────────────────────┐                │   │
│  │  │  Electron App       │          │  Raspberry Pi Zero  │                │   │
│  │  │  (Windows/Mac)      │          │  (Plug & Play)      │                │   │
│  │  └──────────┬──────────┘          └──────────┬──────────┘                │   │
│  │             │                                │                            │   │
│  │             └────────────┬───────────────────┘                            │   │
│  │                          ▼                                                │   │
│  │                 ┌─────────────────┐                                       │   │
│  │                 │  Linksys Velop  │◄──── JNAP API                        │   │
│  │                 │  (Home Router)  │      Block/Unblock Devices           │   │
│  │                 └─────────────────┘                                       │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Platform Matrix

| Platform         | Technology            | Primary Users     | Key Features                            |
| ---------------- | --------------------- | ----------------- | --------------------------------------- |
| Web App          | React + TypeScript    | Parents, Admins   | Full administration, analytics          |
| iOS App          | React Native + Expo   | Children, Parents | Task completion, gamification           |
| Android App      | React Native + Expo   | Children, Parents | Task completion, gamification           |
| Chrome Extension | Chrome Extension APIs | Parents           | Router control, device blocking, status |
| Desktop Bridge   | Electron + TypeScript | Parents           | Linksys Velop control, command queue    |
| Taskaroo Hub     | Raspberry Pi Zero 2 W | Network           | 24/7 plug-and-play WiFi control         |

---

## Web Application

### Technology Stack

| Layer       | Technology            | Purpose                           |
| ----------- | --------------------- | --------------------------------- |
| Framework   | React 18              | UI components, state management   |
| Language    | TypeScript 5.x        | Type safety, developer experience |
| Build Tool  | Vite 5.x              | Fast HMR, optimized builds        |
| Styling     | Tailwind CSS 3.x      | Utility-first CSS                 |
| State       | React Context + Hooks | Global state management           |
| Routing     | React Router 6        | Client-side navigation            |
| i18n        | i18next               | Internationalization              |
| Drag & Drop | @dnd-kit              | Task reordering                   |

### Component Architecture

```
src/
├── components/
│   ├── Admin/                    # Admin-only components
│   │   ├── AdminPanel.tsx        # Main admin dashboard
│   │   ├── TaskApprovalManager.tsx
│   │   ├── CreateChildModal.tsx
│   │   ├── EditMemberModal.tsx
│   │   └── PaletteSelector.tsx
│   │
│   ├── Child/                    # Child dashboard components
│   │   ├── ChildDashboard.tsx    # Main child interface
│   │   ├── ChildHeader.tsx       # Points, streak, level
│   │   ├── TodayTaskList.tsx     # Today's tasks
│   │   ├── ChildTaskCard.tsx     # Touch-friendly cards
│   │   ├── TaskCompletionModal.tsx
│   │   ├── ChildTabBar.tsx       # Bottom navigation
│   │   ├── Gamification/         # Gamification UI
│   │   │   ├── StreakDisplay.tsx
│   │   │   ├── LevelProgress.tsx
│   │   │   ├── ComboIndicator.tsx
│   │   │   └── PointsAnimation.tsx
│   │   └── Views/                # Tab views
│   │       ├── ChildBadgesView.tsx
│   │       ├── ChildStatsView.tsx
│   │       └── ChildRewardsView.tsx
│   │
│   ├── Auth/                     # Authentication
│   │   ├── AuthRouter.tsx        # Route protection
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── ChildPinLogin.tsx
│   │
│   ├── Tasks/                    # Task management
│   │   ├── TaskBoard.tsx         # Kanban/list view
│   │   ├── TaskCard.tsx          # Individual task
│   │   ├── TaskModal.tsx         # Create/edit modal
│   │   └── TaskFilters.tsx
│   │
│   └── Common/                   # Shared components
│       ├── Header.tsx
│       ├── LanguageSwitcher.tsx
│       └── LoadingSpinner.tsx
│
├── contexts/
│   ├── AuthContext.tsx           # Authentication state
│   └── FamilyContext.tsx         # Family member data
│
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── database.types.ts         # TypeScript types
│   ├── gamification.ts           # Points, levels, achievements
│   ├── recurrence.ts             # Recurring task logic
│   └── taskOrdering.ts           # Fractional indexing
│
├── i18n/
│   ├── index.ts                  # i18next configuration
│   └── locales/
│       ├── en/                   # English translations
│       └── nl/                   # Dutch translations
│
└── types/
    └── index.ts                  # Shared type definitions
```

### State Management

```
┌─────────────────────────────────────────────────────────────┐
│                     React Context Tree                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  <AuthProvider>                                              │
│    │  • user (Supabase User)                                │
│    │  • familyMember                                        │
│    │  • family                                              │
│    │  • isAdmin, isPinUser                                  │
│    │  • signIn, signUp, signOut                             │
│    │                                                        │
│    └─ <FamilyProvider>                                      │
│         │  • currentMember                                  │
│         │  • familyMembers[]                                │
│         │  • Realtime subscription                          │
│         │                                                   │
│         └─ <App />                                          │
│              │                                              │
│              ├─ Dashboard (Admin)                           │
│              │    └─ useAuth(), useFamily()                 │
│              │                                              │
│              └─ ChildDashboard (Child)                      │
│                   └─ useAuth(), useFamily()                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Build & Deployment

```yaml
# Build Pipeline
build:
  - npm run typecheck     # TypeScript validation
  - npm run lint          # ESLint
  - npm run build         # Vite production build

# Output
dist/
├── index.html            # Entry point
├── assets/
│   ├── index-[hash].js   # Main bundle (~150KB gzipped)
│   ├── index-[hash].css  # Styles (~20KB gzipped)
│   └── vendor-[hash].js  # Dependencies (~100KB gzipped)
└── _redirects            # SPA routing (Netlify/Vercel)
```

---

## Mobile Applications (iOS & Android)

### Technology Stack

| Layer      | Technology          | Purpose                      |
| ---------- | ------------------- | ---------------------------- |
| Framework  | React Native 0.73+  | Cross-platform UI            |
| Toolchain  | Expo SDK 50+        | Build, deploy, OTA updates   |
| Language   | TypeScript 5.x      | Type safety                  |
| Navigation | React Navigation 6  | Screen navigation            |
| State      | Zustand             | Lightweight state management |
| Storage    | AsyncStorage + MMKV | Local persistence            |
| Push       | Expo Notifications  | APNs + FCM                   |

### Project Structure

```
mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/                   # Auth group
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── pin-login.tsx
│   │
│   ├── (parent)/                 # Parent tabs
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── dashboard.tsx
│   │   ├── tasks.tsx
│   │   ├── family.tsx
│   │   └── settings.tsx
│   │
│   ├── (child)/                  # Child tabs
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── home.tsx              # Today's tasks
│   │   ├── badges.tsx            # Achievements
│   │   ├── stats.tsx             # Progress
│   │   └── rewards.tsx           # Redemptions
│   │
│   ├── _layout.tsx               # Root layout
│   └── index.tsx                 # Entry redirect
│
├── components/
│   ├── common/                   # Shared components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   └── LoadingOverlay.tsx
│   │
│   ├── tasks/                    # Task components
│   │   ├── TaskCard.tsx
│   │   ├── TaskList.tsx
│   │   └── TaskCompletionSheet.tsx
│   │
│   └── gamification/             # Gamification UI
│       ├── StreakFlame.tsx
│       ├── LevelRing.tsx
│       ├── PointsPopup.tsx
│       └── ConfettiCelebration.tsx
│
├── hooks/
│   ├── useAuth.ts                # Authentication hook
│   ├── useFamily.ts              # Family data hook
│   ├── useTasks.ts               # Task operations
│   ├── useNotifications.ts       # Push notifications
│   └── useOffline.ts             # Offline queue
│
├── services/
│   ├── supabase.ts               # Supabase client
│   ├── notifications.ts          # Push setup
│   ├── storage.ts                # Local storage
│   └── sync.ts                   # Offline sync
│
├── stores/
│   ├── authStore.ts              # Auth state (Zustand)
│   ├── taskStore.ts              # Task cache
│   └── offlineStore.ts           # Offline queue
│
└── utils/
    ├── haptics.ts                # Haptic feedback
    ├── animations.ts             # Reanimated helpers
    └── biometrics.ts             # Face ID / Touch ID
```

### Native Module Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Bridge                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  JavaScript Thread                  Native Thread            │
│  ┌─────────────────┐               ┌─────────────────┐      │
│  │ React Native    │    Bridge     │ iOS (Swift)     │      │
│  │ Components      │◄─────────────►│ Android (Kotlin)│      │
│  └─────────────────┘               └─────────────────┘      │
│                                                              │
│  Native Modules Used:                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ expo-notifications    Push notifications (APNs/FCM) │    │
│  │ expo-local-auth       Biometrics (Face ID/Touch ID) │    │
│  │ expo-camera           Photo proof of completion     │    │
│  │ expo-haptics          Tactile feedback              │    │
│  │ @react-native-async-storage  Offline data          │    │
│  │ react-native-mmkv     Fast key-value storage       │    │
│  │ react-native-reanimated  60fps animations          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Offline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Offline-First Design                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐                                            │
│  │   Network   │                                            │
│  │   Check     │                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│    ┌────▼────┐                                              │
│    │ Online? │                                              │
│    └────┬────┘                                              │
│         │                                                    │
│    Yes  │  No                                               │
│    ┌────┴────┐                                              │
│    │         │                                              │
│    ▼         ▼                                              │
│ ┌──────┐  ┌──────────┐                                      │
│ │Fetch │  │ Read     │                                      │
│ │ API  │  │ Cache    │                                      │
│ └──┬───┘  └────┬─────┘                                      │
│    │           │                                            │
│    │    ┌──────▼──────┐                                     │
│    │    │ Queue Write │                                     │
│    │    │ Operations  │                                     │
│    │    └──────┬──────┘                                     │
│    │           │                                            │
│    ▼           ▼                                            │
│ ┌─────────────────────┐                                     │
│ │    Update Cache     │                                     │
│ │    (MMKV + SQLite)  │                                     │
│ └──────────┬──────────┘                                     │
│            │                                                 │
│            ▼                                                 │
│ ┌─────────────────────┐                                     │
│ │   Sync When Online  │◄────── Background sync              │
│ │   (Conflict: Server │        (NetInfo listener)           │
│ │    timestamp wins)  │                                     │
│ └─────────────────────┘                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Push Notification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Push Notification Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Device Registration                                      │
│  ┌──────────┐     ┌──────────┐     ┌──────────────┐         │
│  │   App    │────►│  Expo    │────►│   Supabase   │         │
│  │  Launch  │     │  Push    │     │ family_members│         │
│  └──────────┘     │  Token   │     │ .push_token  │         │
│                   └──────────┘     └──────────────┘         │
│                                                              │
│  2. Notification Trigger                                     │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │ Edge Function│────►│ Expo Push API│                      │
│  │ (e.g., task  │     │ or direct    │                      │
│  │  approved)   │     │ APNs/FCM     │                      │
│  └──────────────┘     └──────┬───────┘                      │
│                              │                               │
│  3. Delivery                 ▼                               │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │    iOS       │     │   Android    │                      │
│  │    APNs      │     │    FCM       │                      │
│  └──────┬───────┘     └──────┬───────┘                      │
│         │                    │                               │
│         └────────┬───────────┘                               │
│                  ▼                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Device                            │    │
│  │  • Foreground: In-app toast                         │    │
│  │  • Background: System notification                  │    │
│  │  • Killed: System notification + badge              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Build & Distribution

```yaml
# iOS Build (EAS Build)
eas build --platform ios --profile production

# Android Build (EAS Build)
eas build --platform android --profile production

# OTA Update (No Store Review)
eas update --branch production --message "Bug fix"

# Build Profiles (eas.json)
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "ios": { "resourceClass": "m1-medium" },
      "android": { "buildType": "apk" }
    }
  }
}
```

---

## Router Application (Chrome Extension & Desktop Bridge)

### Overview

The router application enables **real internet access control based on chore completion** - unlike competing chore apps that only offer virtual rewards, Taskaroo delivers real consequences: complete your chores to unlock WiFi access.

The implementation follows a two-phase approach:

| Aspect           | Phase 1: Desktop Bridge             | Phase 2: Hardware Hub       |
| ---------------- | ----------------------------------- | --------------------------- |
| Timeline         | MVP Launch (Months 1-6)             | Scale Launch (Months 12-18) |
| Target Users     | Early adopters, tech-savvy families | Mass market, any family     |
| Setup Complexity | Medium (download & install)         | Low (plug & play)           |
| Dev Cost         | $15,000 - $25,000                   | $40,000 - $60,000           |
| Unit Cost        | $0 (software only)                  | $25-35 per hub              |

### System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Taskaroo App  │◄───►│  Supabase Cloud  │◄───►│  Taskaroo       │
│   (Phone/Web)   │ REST│  (Commands DB)   │ WS  │  Bridge Agent   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │ Local
                                                          ▼ API
                                                 ┌─────────────────┐
                                                 │  Linksys Velop  │
                                                 │  (192.168.1.1)  │
                                                 └─────────────────┘
```

### Chrome Extension Architecture

The Chrome Extension provides a lightweight interface for router control directly in the browser, enabling quick device blocking/unblocking and status monitoring without the full desktop app.

```
chrome-extension/
├── manifest.json                 # Extension manifest (MV3)
├── src/
│   ├── background/
│   │   ├── service-worker.ts     # Background service worker
│   │   ├── notifications.ts      # Push notification handler
│   │   └── api.ts                # Supabase API calls
│   │
│   ├── popup/
│   │   ├── Popup.tsx             # Main popup UI
│   │   ├── DeviceStatus.tsx      # Connected devices status
│   │   ├── NetworkControls.tsx   # Block/unblock controls
│   │   └── TaskRewards.tsx       # Chore-to-WiFi status
│   │
│   ├── options/
│   │   ├── Options.tsx           # Settings page
│   │   └── BridgeConfig.tsx      # Desktop bridge connection
│   │
│   └── content/
│       └── blocker.ts            # Content script for blocking
│
├── public/
│   ├── icons/                    # Extension icons
│   └── popup.html
│
└── vite.config.ts                # Build configuration
```

#### Manifest (MV3)

```json
{
  "manifest_version": 3,
  "name": "Taskaroo Router Control",
  "version": "1.0.0",
  "description": "Control children's WiFi access based on chore completion",

  "permissions": ["storage", "notifications", "alarms", "identity"],

  "host_permissions": ["https://*.supabase.co/*", "http://192.168.*.*/*"],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### Extension Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                Chrome Extension Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐                                       │
│  │  Service Worker  │◄───── Persistent background           │
│  │   (background)   │       - Supabase realtime subscription│
│  └────────┬─────────┘       - Device status monitoring      │
│           │                 - WiFi reward notifications     │
│           │                                                  │
│  ┌────────▼─────────┐                                       │
│  │   chrome.storage │◄───── Synced across devices           │
│  │   (sync + local) │       - Auth tokens                   │
│  └────────┬─────────┘       - Router connection info        │
│           │                 - Device mappings               │
│           │                                                  │
│  ┌────────▼─────────┐                                       │
│  │     Popup UI     │◄───── React-based popup               │
│  │    (popup.tsx)   │       - Device status list            │
│  └────────┬─────────┘       - Block/unblock controls        │
│           │                 - Chore completion status       │
│           │                                                  │
│  ┌────────▼─────────┐                                       │
│  │   Options Page   │◄───── Full settings                   │
│  │  (options.tsx)   │       - Bridge agent configuration    │
│  └──────────────────┘       - Device-to-member mapping      │
│                                                              │
│  Communication:                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Popup ◄──────► Service Worker ◄──────► Supabase    │    │
│  │         chrome.runtime.sendMessage()    Realtime   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Desktop Bridge Agent (Electron)

The Taskaroo Bridge is a lightweight desktop application that runs on a parent's Windows or Mac computer. It maintains a persistent connection to Taskaroo's cloud backend and executes router commands on the local network.

#### Technical Stack

| Component            | Technology                                              |
| -------------------- | ------------------------------------------------------- |
| Desktop Framework    | Electron 28+ (Chromium + Node.js)                       |
| Language             | TypeScript (shared types with web app)                  |
| Router Communication | pyvelop via Python subprocess or node-fetch to JNAP API |
| Cloud Connection     | Supabase Realtime (WebSocket)                           |
| Local Storage        | electron-store (encrypted credentials)                  |
| Auto-Update          | electron-updater (GitHub Releases)                      |
| Installer            | electron-builder (Windows NSIS, Mac DMG)                |

#### Core Features

- **System Tray Application**: Runs silently in background, minimal resource usage (~50MB RAM)
- **Auto-Start on Boot**: Configurable to launch at system startup
- **Router Auto-Discovery**: Scans local network to find compatible Linksys Velop systems
- **Device Mapping**: Associates network devices with Taskaroo family members
- **Command Queue**: Processes internet block/unblock commands from cloud
- **Offline Resilience**: Queues commands if cloud connection lost, executes on reconnect

#### Directory Structure

```
electron-bridge/
├── src/
│   ├── main/                     # Main process (Node.js)
│   │   ├── main.ts               # App entry point
│   │   ├── tray.ts               # System tray (minimal UI)
│   │   ├── autoUpdater.ts        # Auto-update from GitHub
│   │   └── router/
│   │       ├── discovery.ts      # Find Linksys Velop on network
│   │       ├── jnap.ts           # Linksys JNAP API client
│   │       ├── commands.ts       # Block/unblock execution
│   │       └── deviceMap.ts      # MAC-to-member mapping
│   │
│   ├── renderer/                 # Renderer process (React)
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Setup.tsx         # Initial configuration wizard
│   │   │   ├── Devices.tsx       # Device management
│   │   │   └── Settings.tsx      # Connection settings
│   │   │
│   │   └── components/
│   │       ├── DeviceCard.tsx
│   │       ├── RouterStatus.tsx
│   │       └── ConnectionStatus.tsx
│   │
│   └── preload/
│       └── preload.ts            # Context bridge
│
├── electron-builder.yml          # Build configuration
└── forge.config.ts               # Electron Forge config
```

#### Linksys JNAP API Integration

The Linksys Velop exposes an internal JNAP (JSON Network Access Protocol) API that enables programmatic control of parental features:

```typescript
// Block internet access for a device
// POST http://192.168.1.1/JNAP/
// X-JNAP-Action: http://linksys.com/jnap/parentalcontrol/SetDeviceAccess
// X-JNAP-Authorization: Basic <base64(admin:password)>

interface JNAPBlockRequest {
  deviceID: string; // Device UUID from router
  isBlocked: boolean;
  blockedSchedule: null; // null for immediate, or schedule object
}

async function blockDevice(deviceId: string, block: boolean): Promise<void> {
  const response = await fetch('http://192.168.1.1/JNAP/', {
    method: 'POST',
    headers: {
      'X-JNAP-Action': 'http://linksys.com/jnap/parentalcontrol/SetDeviceAccess',
      'X-JNAP-Authorization': `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceID: deviceId,
      isBlocked: block,
      blockedSchedule: null,
    }),
  });
}
```

#### Electron IPC Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Electron IPC Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Main Process                       │    │
│  │                    (Node.js)                         │    │
│  │                                                      │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │    │
│  │  │   Tray     │  │  Supabase  │  │   Router   │    │    │
│  │  │  Manager   │  │  Realtime  │  │   JNAP     │    │    │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │    │
│  │        │               │               │            │    │
│  │        └───────────────┼───────────────┘            │    │
│  │                        │                            │    │
│  │                  ┌─────▼─────┐                      │    │
│  │                  │  Command  │                      │    │
│  │                  │   Queue   │                      │    │
│  │                  └─────┬─────┘                      │    │
│  └────────────────────────┼────────────────────────────┘    │
│                           │                                  │
│                    ┌──────▼──────┐                           │
│                    │  Preload    │                           │
│                    │  (Bridge)   │                           │
│                    └──────┬──────┘                           │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │                 Renderer Process                     │    │
│  │                    (React)                           │    │
│  │                                                      │    │
│  │  window.electronAPI = {                             │    │
│  │    router: {                                        │    │
│  │      discover: () => ipcRenderer.invoke('...'),    │    │
│  │      connect: (ip, pw) => ipcRenderer.invoke('...'),│   │
│  │      getDevices: () => ipcRenderer.invoke('...'),  │    │
│  │      blockDevice: (id) => ipcRenderer.invoke('...'),│   │
│  │    },                                               │    │
│  │    cloud: {                                         │    │
│  │      getStatus: () => ipcRenderer.invoke('...'),   │    │
│  │    }                                                │    │
│  │  }                                                  │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Build & Distribution

```yaml
# Electron Forge Configuration
{
  'packagerConfig':
    {
      'name': 'Taskaroo Bridge',
      'icon': './assets/icon',
      'osxSign': {},
      'osxNotarize':
        { 'tool': 'notarytool', 'appleId': '...', 'appleIdPassword': '...', 'teamId': '...' },
    },
  'makers': [{ 'name': '@electron-forge/maker-squirrel', ? // Windows
          "config"
        : { 'name': 'TaskarooBridge' } }, { 'name': '@electron-forge/maker-dmg', ? // macOS
          "config"
        : { 'format': 'ULFO' } }],
  'publishers':
    [
      {
        'name': '@electron-forge/publisher-github',
        'config': { 'repository': { 'owner': 'taskaroo', 'name': 'bridge' } },
      },
    ],
}
```

---

## Phase 2: Hardware Hub (Taskaroo Hub)

### Overview

The Taskaroo Hub is a dedicated plug-and-play device that eliminates the need for a parent's computer to be running. It provides 24/7 reliability and simplifies setup for non-technical families.

### Hardware Options Comparison

| Option                    | Unit Cost             | Pros                           | Cons                   |
| ------------------------- | --------------------- | ------------------------------ | ---------------------- |
| **Raspberry Pi Zero 2 W** | $15 + $5 case         | Tiny, WiFi built-in, low power | Limited availability   |
| Raspberry Pi 4 (2GB)      | $35 + $10 case        | Powerful, well-supported       | Overkill, higher power |
| Orange Pi Zero 3          | $20 + $5 case         | Good balance, available        | Less community support |
| Custom PCB (at scale)     | $12-18 at 1000+ units | Branded, optimized             | High upfront NRE cost  |

**Recommended: Raspberry Pi Zero 2 W**

- Quad-core 64-bit ARM Cortex-A53 @ 1GHz
- 512MB RAM (sufficient for bridge agent)
- Built-in 2.4GHz WiFi and Bluetooth
- Micro USB power (phone charger compatible)
- Tiny form factor: 65mm x 30mm
- Power consumption: ~0.4W idle, ~1.2W active

### Hub Software Stack

| Component           | Technology                                |
| ------------------- | ----------------------------------------- |
| Operating System    | Raspberry Pi OS Lite (64-bit, headless)   |
| Bridge Agent        | Python 3.11 + pyvelop + asyncio           |
| Cloud Connection    | Supabase Realtime (WebSocket)             |
| Device Provisioning | WiFi captive portal (hostapd + dnsmasq)   |
| Status LED          | GPIO control (green=connected, red=error) |
| OTA Updates         | Mender.io or custom apt repository        |

### User Setup Flow (5 minutes)

```
┌─────────────────────────────────────────────────────────────┐
│                    Hub Setup Flow                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. PLUG IN                                                  │
│     └─► Connect Taskaroo Hub to power using any USB charger │
│                                                              │
│  2. CONNECT                                                  │
│     └─► Hub broadcasts "Taskaroo-Setup" WiFi network        │
│     └─► Parent connects phone to it                          │
│                                                              │
│  3. CONFIGURE                                                │
│     └─► Captive portal opens automatically                   │
│     └─► Parent selects home WiFi and enters password         │
│                                                              │
│  4. LINK ACCOUNT                                             │
│     └─► Parent scans QR code or enters pairing code          │
│     └─► Code shown in Taskaroo app                           │
│                                                              │
│  5. DISCOVER ROUTER                                          │
│     └─► Hub auto-discovers Linksys Velop                     │
│     └─► Parent enters router admin password                  │
│                                                              │
│  6. MAP DEVICES                                              │
│     └─► Parent assigns network devices to family members     │
│     └─► Done! WiFi control is active                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Business Model for Hardware

| Model                   | Price                              | Considerations                      |
| ----------------------- | ---------------------------------- | ----------------------------------- |
| Hardware Sale           | $49.99 one-time                    | Simple, but upfront cost barrier    |
| **Subscription Bundle** | Free hub with Family Pro annual    | Reduces churn, increases LTV        |
| Deposit Model           | $25 deposit, returned after 1 year | Low barrier, ensures commitment     |
| Premium Tier            | $14.99/mo includes hub + features  | Higher ARPU, built-in hardware cost |

**Recommended: Subscription Bundle**
Offer the Taskaroo Hub free with annual Family Pro subscription ($99.99/year). This approach:

- Reduces customer acquisition friction
- Increases annual commitment and reduces churn
- Amortizes hardware cost over subscription lifetime
- Creates strong differentiation from competitors

### Unit Economics (at 1,000 units)

| Cost Component                  | Amount     |
| ------------------------------- | ---------- |
| Raspberry Pi Zero 2 W           | $15.00     |
| Custom case with logo           | $4.00      |
| MicroSD card (8GB, pre-flashed) | $3.00      |
| USB power cable                 | $1.50      |
| Packaging and insert            | $2.00      |
| Assembly and QA                 | $3.00      |
| Shipping (bulk to fulfillment)  | $1.50      |
| **Total COGS per unit**         | **$30.00** |

---

## Supported Routers & DNS Fallback

### Launch Support

| Router                         | Integration Path                 |
| ------------------------------ | -------------------------------- |
| **Linksys Velop (all models)** | Full support via pyvelop library |
| **Linksys Smart WiFi routers** | JNAP API compatible models       |

### Future Expansion (Year 2)

| Router Brand         | Integration Path                | Effort                   |
| -------------------- | ------------------------------- | ------------------------ |
| Ubiquiti UniFi       | Official REST API               | Medium (2-3 weeks)       |
| ASUS (select models) | Community library (asusrouter)  | Medium (3-4 weeks)       |
| TP-Link Deco         | Reverse-engineer or partnership | High (6-8 weeks)         |
| Eero                 | Partnership required            | Very High (business dev) |
| Google Nest WiFi     | No known path                   | Not feasible             |

### DNS Fallback for Unsupported Routers

For families with unsupported routers, offer **NextDNS integration** as a fallback. This provides service-level blocking (TikTok, YouTube, games) rather than full internet control, but still delivers meaningful value.

### Risk Mitigation

| Risk                                 | Impact                   | Mitigation                                                         |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| Linksys changes API                  | Bridge stops working     | Pin pyvelop version, monitor updates, maintain abstraction layer   |
| Router firmware update breaks compat | Subset of users affected | Version detection, user notification, rapid patch cycle            |
| Child bypasses via mobile data       | Reduced effectiveness    | Educate parents, position as home WiFi control (not total control) |
| Hardware supply chain issues         | Delayed fulfillment      | Multiple supplier relationships, 3-month inventory buffer          |
| Support burden from hardware         | Increased costs          | Extensive documentation, video tutorials, community forum          |

### Taskaroo Agent

#### Configuration

```json
// /opt/taskaroo/config/taskaroo.json
{
  "supabase": {
    "url": "https://xxx.supabase.co",
    "anonKey": "eyJ...",
    "familyId": "uuid-of-family"
  },
  "network": {
    "mode": "dhcp_dns", // dns_only | dhcp_dns | gateway
    "interface": "eth0", // LAN interface
    "wanInterface": "eth1", // WAN interface (gateway mode only)
    "subnet": "192.168.1.0/24",
    "routerIp": "192.168.1.1"
  },
  "adguard": {
    "apiUrl": "http://127.0.0.1:3000",
    "username": "admin",
    "password": "..."
  },
  "api": {
    "port": 8080,
    "token": "local-api-bearer-token"
  },
  "sync": {
    "intervalSeconds": 30
  }
}
```

#### Device Mapping

```json
// /opt/taskaroo/config/devices.json
{
  "devices": [
    {
      "mac": "AA:BB:CC:DD:EE:FF",
      "hostname": "kids-ipad",
      "familyMemberId": "uuid-of-child",
      "staticIp": "192.168.1.100",
      "scheduleEnabled": true
    },
    {
      "mac": "11:22:33:44:55:66",
      "hostname": "gaming-pc",
      "familyMemberId": "uuid-of-child-2",
      "staticIp": "192.168.1.101",
      "scheduleEnabled": true
    }
  ]
}
```

#### Agent Implementation

```typescript
// /opt/taskaroo/agent/src/index.ts
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import { applyScheduleRules } from './schedules';
import { syncDevices } from './devices';
import { configureAdGuard } from './adguard';

const config = require('../config/taskaroo.json');

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Express API server for Electron app
const app = express();
app.use(express.json());

// Auth middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== config.api.token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mode: config.network.mode,
    devices: getConnectedDevices(),
    lastSync: lastSyncTime,
  });
});

app.get('/api/devices', (req, res) => {
  res.json(getDeviceList());
});

app.post('/api/devices/:mac/assign', async (req, res) => {
  const { mac } = req.params;
  const { familyMemberId } = req.body;
  await assignDeviceToMember(mac, familyMemberId);
  res.json({ success: true });
});

app.post('/api/devices/:mac/block', async (req, res) => {
  const { mac } = req.params;
  const { duration } = req.body; // minutes, 0 = indefinite
  await blockDevice(mac, duration);
  res.json({ success: true });
});

app.post('/api/devices/:mac/unblock', async (req, res) => {
  const { mac } = req.params;
  await unblockDevice(mac);
  res.json({ success: true });
});

// Subscribe to Supabase realtime for family changes
const familyChannel = supabase
  .channel('family-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'family_members',
      filter: `family_id=eq.${config.supabase.familyId}`,
    },
    async (payload) => {
      console.log('Family member changed:', payload);
      await syncRules();
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `family_id=eq.${config.supabase.familyId}`,
    },
    async (payload) => {
      // Task completed = potentially unlock internet
      if (payload.new?.status === 'completed') {
        await checkTaskRewards(payload.new);
      }
    }
  )
  .subscribe();

// Periodic sync
setInterval(async () => {
  await syncRules();
}, config.sync.intervalSeconds * 1000);

// Start server
app.listen(config.api.port, '0.0.0.0', () => {
  console.log(`Taskaroo Agent running on port ${config.api.port}`);
});
```

### Time-Based Access Control

```typescript
// /opt/taskaroo/agent/src/schedules.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Schedule {
  memberId: string;
  deviceMac: string;
  deviceIp: string;
  weekdays: {
    [day: string]: {
      allowedStart: string; // "07:00"
      allowedEnd: string; // "21:00"
      requireTaskCompletion: boolean;
    };
  };
}

export async function applyScheduleRules(schedules: Schedule[]): Promise<void> {
  // Clear existing Taskaroo rules
  await execAsync('nft flush chain inet taskaroo schedule_rules');

  for (const schedule of schedules) {
    const { deviceIp, weekdays } = schedule;

    for (const [day, times] of Object.entries(weekdays)) {
      const dayNum = getDayNumber(day); // 0=Sunday, 6=Saturday
      const { allowedStart, allowedEnd } = times;

      // Allow traffic during allowed hours
      const allowRule = `
        nft add rule inet taskaroo schedule_rules \\
          ip saddr ${deviceIp} \\
          meta day ${dayNum} \\
          meta hour >= ${parseTime(allowedStart)} \\
          meta hour < ${parseTime(allowedEnd)} \\
          accept
      `;

      // Drop traffic outside allowed hours
      const dropRule = `
        nft add rule inet taskaroo schedule_rules \\
          ip saddr ${deviceIp} \\
          drop
      `;

      await execAsync(allowRule);
      await execAsync(dropRule);
    }
  }

  console.log(`Applied schedule rules for ${schedules.length} devices`);
}

// nftables base configuration
export async function initializeNftables(): Promise<void> {
  const baseConfig = `
    table inet taskaroo {
      chain schedule_rules {
        type filter hook forward priority 0; policy accept;
      }

      chain task_rewards {
        type filter hook forward priority 0; policy accept;
      }
    }
  `;

  await execAsync(`echo '${baseConfig}' | nft -f -`);
}
```

### AdGuard Home Integration

```typescript
// /opt/taskaroo/agent/src/adguard.ts
import axios from 'axios';

const config = require('../config/taskaroo.json');

const adguard = axios.create({
  baseURL: config.adguard.apiUrl,
  auth: {
    username: config.adguard.username,
    password: config.adguard.password,
  },
});

interface ClientConfig {
  name: string;
  ids: string[]; // MAC addresses
  blocked_services: string[];
  filtering_enabled: boolean;
  safesearch_enabled: boolean;
  safebrowsing_enabled: boolean;
  parental_enabled: boolean;
}

export async function setClientConfig(
  memberId: string,
  mac: string,
  config: Partial<ClientConfig>
): Promise<void> {
  const clientName = `taskaroo_${memberId}`;

  await adguard.post('/control/clients/update', {
    name: clientName,
    data: {
      name: clientName,
      ids: [mac],
      ...config,
    },
  });
}

export async function blockServices(memberId: string, services: string[]): Promise<void> {
  // AdGuard Home supported services:
  // youtube, tiktok, instagram, snapchat, twitter, facebook,
  // twitch, discord, steam, epic_games, gaming, etc.

  await setClientConfig(memberId, getMacForMember(memberId), {
    blocked_services: services,
  });
}

export async function enableSafeSearch(memberId: string): Promise<void> {
  await setClientConfig(memberId, getMacForMember(memberId), {
    safesearch_enabled: true,
  });
}

export async function getQueryLog(clientIp: string, limit: number = 100) {
  const response = await adguard.get('/control/querylog', {
    params: {
      search: clientIp,
      limit,
    },
  });
  return response.data;
}
```

### Task-Based Internet Rewards

```typescript
// /opt/taskaroo/agent/src/rewards.ts
import { supabase } from './supabase';
import { unblockDevice, blockDevice } from './devices';

interface TaskRewardConfig {
  memberId: string;
  dailyTasksRequired: number;
  rewardDurationMinutes: number; // 0 = until bedtime
}

export async function checkTaskRewards(task: any): Promise<void> {
  const { completed_by, family_id } = task;

  // Get reward config for this member
  const { data: config } = await supabase
    .from('router_reward_configs')
    .select('*')
    .eq('family_member_id', completed_by)
    .single();

  if (!config || !config.enabled) return;

  // Count today's completed tasks
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('completed_by', completed_by)
    .eq('status', 'completed')
    .gte('approved_at', `${today}T00:00:00`)
    .lt('approved_at', `${today}T23:59:59`);

  if (count >= config.daily_tasks_required) {
    // Unlock internet for this member's devices
    const devices = getDevicesForMember(completed_by);
    for (const device of devices) {
      await unblockDevice(device.mac, config.reward_duration_minutes);
    }

    console.log(`Unlocked internet for member ${completed_by} (${count} tasks completed)`);
  }
}
```

### Installation Script

```bash
#!/bin/bash
# /opt/taskaroo/scripts/install.sh

set -e

echo "=== Taskaroo Pi Router Installation ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

# Detect OS
if [ -f /etc/openwrt_release ]; then
  OS="openwrt"
elif [ -f /etc/debian_version ]; then
  OS="debian"
else
  echo "Unsupported OS"
  exit 1
fi

echo "Detected OS: $OS"

# Install dependencies
if [ "$OS" = "debian" ]; then
  apt-get update
  apt-get install -y nodejs npm nftables dnsmasq curl

  # Install AdGuard Home
  curl -s -S -L https://raw.githubusercontent.com/AdguardTeam/AdGuardHome/master/scripts/install.sh | sh -s -- -v
fi

if [ "$OS" = "openwrt" ]; then
  opkg update
  opkg install node node-npm nftables curl

  # AdGuard Home for OpenWrt
  opkg install adguardhome
fi

# Create directory structure
mkdir -p /opt/taskaroo/{agent,config,scripts,logs}

# Install Node.js agent
cd /opt/taskaroo/agent
npm install

# Create systemd service
cat > /etc/systemd/system/taskaroo-agent.service << EOF
[Unit]
Description=Taskaroo Router Agent
After=network.target adguardhome.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/taskaroo/agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable taskaroo-agent
systemctl start taskaroo-agent

echo "=== Installation Complete ==="
echo "Configure /opt/taskaroo/config/taskaroo.json with your Supabase credentials"
echo "Then restart: systemctl restart taskaroo-agent"
```

---

## Backend Services

### Supabase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   API Gateway                        │    │
│  │               (PostgREST + GoTrue)                   │    │
│  │  • Auto-generated REST API from schema              │    │
│  │  • JWT authentication                               │    │
│  │  • Row Level Security enforcement                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐       │
│  │   Auth      │   │   Realtime  │   │    Edge     │       │
│  │  (GoTrue)   │   │  (Phoenix)  │   │  Functions  │       │
│  │             │   │             │   │   (Deno)    │       │
│  │ • Email/PW  │   │ • Postgres  │   │             │       │
│  │ • OAuth     │   │   Changes   │   │ • create-   │       │
│  │ • Magic Link│   │ • Presence  │   │   child     │       │
│  │ • PIN (Edge)│   │ • Broadcast │   │ • pin-login │       │
│  └─────────────┘   └─────────────┘   │ • join-     │       │
│                                       │   family    │       │
│                                       │ • deduct-   │       │
│                                       │   points    │       │
│                                       │ • etc.      │       │
│                                       └─────────────┘       │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  PostgreSQL │                          │
│                    │  Database   │                          │
│                    └──────┬──────┘                          │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐       │
│  │   Storage   │   │    Logs     │   │   Backups   │       │
│  │  (S3-like)  │   │ (Logflare)  │   │  (Auto)     │       │
│  │             │   │             │   │             │       │
│  │ • Avatars   │   │ • Query     │   │ • Daily     │       │
│  │ • Evidence  │   │   logs      │   │ • Point-in- │       │
│  │ • Exports   │   │ • Edge      │   │   time      │       │
│  └─────────────┘   │   logs      │   └─────────────┘       │
│                    └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Overview

```sql
-- Core Tables (simplified)

-- Families
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  parent_invite_code TEXT UNIQUE NOT NULL,
  point_to_money_rate DECIMAL(10,2) DEFAULT 0,
  color_palette TEXT DEFAULT 'default',
  default_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Members
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role TEXT DEFAULT 'child',
  is_admin BOOLEAN DEFAULT FALSE,
  is_pin_user BOOLEAN DEFAULT FALSE,
  pin_hash TEXT,
  child_invite_code TEXT UNIQUE,
  points INT DEFAULT 0,
  level INT DEFAULT 1,
  streak INT DEFAULT 0,
  last_activity_date DATE,
  color TEXT,
  avatar_url TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  point_value INT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES family_members(id),
  created_by UUID REFERENCES family_members(id),
  due_datetime TIMESTAMPTZ,
  completed_by UUID REFERENCES family_members(id),
  approved_by UUID REFERENCES family_members(id),
  approved_at TIMESTAMPTZ,
  recurrence_pattern TEXT DEFAULT 'one_time',
  sort_order FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Router Bridge instances (Phase 1: Desktop, Phase 2: Hub)
CREATE TABLE router_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  bridge_type TEXT CHECK (bridge_type IN ('desktop', 'hub')),
  router_type TEXT DEFAULT 'linksys_velop',
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device-to-member mappings for WiFi control
CREATE TABLE router_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  mac_address TEXT NOT NULL,
  hostname TEXT,
  static_ip INET,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, mac_address)
);

-- Time-based internet schedules
CREATE TABLE router_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  day_of_week INT NOT NULL, -- 0=Sunday, 6=Saturday
  allowed_start TIME NOT NULL,
  allowed_end TIME NOT NULL,
  require_task_completion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task-based WiFi reward configuration
CREATE TABLE router_reward_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  enabled BOOLEAN DEFAULT FALSE,
  daily_tasks_required INT DEFAULT 3,
  reward_duration_minutes INT DEFAULT 0, -- 0 = until bedtime
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Edge Functions

```
supabase/functions/
├── _shared/
│   ├── cors.ts                   # CORS headers
│   ├── security.ts               # Rate limiting, validation
│   └── supabase.ts               # Supabase admin client
│
├── create-child/                 # Create child with PIN
├── pin-login/                    # Child PIN authentication
├── join-family/                  # Join via invite code
├── join-family-as-parent/        # Join as admin
├── toggle-admin/                 # Promote/demote admin
├── deduct-points/                # Manual point deduction
├── award-birthday-points/        # Birthday bonus
├── reset-child-pin/              # Reset PIN
├── disable-member/               # Disable account
├── export-family-data/           # GDPR export
├── regenerate-invite-code/       # New invite code
├── request-redemption/           # Reward request
├── create-dispute/               # Dispute deduction
├── resolve-dispute/              # Admin resolves dispute
├── purchase-streak-freeze/       # Buy streak freeze
├── send-message/                 # In-app messaging
│
└── router/                       # Router-specific functions
    ├── sync-devices/             # Sync device list to cloud
    ├── get-schedules/            # Get schedules for family
    └── report-usage/             # Report device usage stats
```

---

## Data Flow & Synchronization

### Real-time Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Real-time Synchronization                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Supabase Realtime Server               │    │
│  │              (Phoenix Channels)                      │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│         ┌───────────────┼───────────────┐                   │
│         │               │               │                   │
│    ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐            │
│    │  Web    │    │  Mobile   │   │  Router   │            │
│    │  App    │    │   Apps    │   │  Agent    │            │
│    └────┬────┘    └─────┬─────┘   └─────┬─────┘            │
│         │               │               │                   │
│         └───────────────┴───────────────┘                   │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Subscription Channels                   │    │
│  │                                                      │    │
│  │  family:{familyId}                                  │    │
│  │    └─ postgres_changes: family_members, tasks       │    │
│  │                                                      │    │
│  │  member:{memberId}                                  │    │
│  │    └─ postgres_changes: messages, notifications     │    │
│  │                                                      │    │
│  │  router:{familyId}                                  │    │
│  │    └─ postgres_changes: router_devices, schedules   │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Conflict Resolution: Server timestamp wins (last-write)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Offline Queue (Mobile)

```
┌─────────────────────────────────────────────────────────────┐
│                   Offline Queue System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Action (offline)                                   │
│     └─► Store in AsyncStorage queue                         │
│                                                              │
│  2. Queue Entry Format                                      │
│     {                                                        │
│       id: "uuid",                                           │
│       action: "complete_task",                              │
│       payload: { taskId: "...", timestamp: "..." },         │
│       retries: 0,                                           │
│       maxRetries: 3,                                        │
│       createdAt: "2026-01-25T12:00:00Z"                    │
│     }                                                        │
│                                                              │
│  3. Sync Process (on reconnect)                             │
│     for each queued action:                                 │
│       try:                                                   │
│         execute API call                                    │
│         remove from queue                                   │
│       catch:                                                 │
│         if retries < maxRetries:                            │
│           increment retries                                 │
│           exponential backoff                               │
│         else:                                                │
│           move to dead letter queue                         │
│           notify user                                        │
│                                                              │
│  4. Conflict Resolution                                     │
│     - Server state always wins                              │
│     - Stale actions are discarded                           │
│     - User notified of conflicts                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication Flows

```
┌─────────────────────────────────────────────────────────────┐
│                   Authentication Flows                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Parent Email/Password                                   │
│     ┌──────┐      ┌──────────┐      ┌──────────┐           │
│     │Client│─────►│ Supabase │─────►│ GoTrue   │           │
│     │      │◄─────│   Auth   │◄─────│ (JWT)    │           │
│     └──────┘      └──────────┘      └──────────┘           │
│                                                              │
│  2. Parent OAuth (Google/Apple)                             │
│     ┌──────┐      ┌──────────┐      ┌──────────┐           │
│     │Client│─────►│ Provider │─────►│ Supabase │           │
│     │      │◄─────│ (Google) │◄─────│ Callback │           │
│     └──────┘      └──────────┘      └──────────┘           │
│                                                              │
│  3. Child PIN Login                                         │
│     ┌──────┐      ┌──────────┐      ┌──────────┐           │
│     │Client│─────►│ pin-login│─────►│ Verify   │           │
│     │      │      │ Edge Fn  │      │ SHA-256  │           │
│     │      │◄─────│          │◄─────│ hash     │           │
│     └──────┘      └──────────┘      └──────────┘           │
│                   Returns: familyMember + family data       │
│                   (No Supabase auth session created)        │
│                                                              │
│  4. Router Agent                                            │
│     ┌──────┐      ┌──────────┐      ┌──────────┐           │
│     │Agent │─────►│ Supabase │─────►│ Anon Key │           │
│     │      │      │ Client   │      │ + RLS    │           │
│     └──────┘      └──────────┘      └──────────┘           │
│     Uses service_role for write operations                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Row Level Security (RLS)

```sql
-- Example RLS policies

-- Family members can only see their own family
CREATE POLICY "Users can view own family members"
ON family_members FOR SELECT
USING (
  family_id IN (
    SELECT family_id FROM family_members
    WHERE user_id = auth.uid()
  )
);

-- Tasks are family-scoped
CREATE POLICY "Users can view family tasks"
ON tasks FOR SELECT
USING (
  family_id IN (
    SELECT family_id FROM family_members
    WHERE user_id = auth.uid()
  )
);

-- Only admins can create/edit tasks
CREATE POLICY "Admins can insert tasks"
ON tasks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE user_id = auth.uid()
    AND is_admin = true
    AND family_id = tasks.family_id
  )
);

-- Router devices are family-scoped
CREATE POLICY "Admins can manage router devices"
ON router_devices FOR ALL
USING (
  family_id IN (
    SELECT family_id FROM family_members
    WHERE user_id = auth.uid() AND is_admin = true
  )
);
```

### API Security

```
┌─────────────────────────────────────────────────────────────┐
│                    API Security Layers                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: TLS                                               │
│  └─ All traffic encrypted (TLS 1.3)                        │
│                                                              │
│  Layer 2: Authentication                                    │
│  └─ JWT validation (Supabase Auth)                         │
│  └─ Bearer token for router API                            │
│                                                              │
│  Layer 3: Authorization                                     │
│  └─ Row Level Security (PostgreSQL)                        │
│  └─ Edge Function permission checks                        │
│                                                              │
│  Layer 4: Rate Limiting                                     │
│  └─ 100 requests/minute per IP (Edge Functions)            │
│  └─ 10 PIN attempts/hour per invite code                   │
│                                                              │
│  Layer 5: Input Validation                                  │
│  └─ Schema validation (Zod)                                │
│  └─ SQL injection prevention (parameterized queries)       │
│  └─ XSS prevention (output encoding)                       │
│                                                              │
│  Layer 6: Audit Logging                                     │
│  └─ All admin actions logged                               │
│  └─ Points history for accountability                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Production Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                  Production Deployment                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     CDN Layer                        │    │
│  │              (Cloudflare / Vercel Edge)              │    │
│  │                                                      │    │
│  │  • Static asset caching                             │    │
│  │  • DDoS protection                                  │    │
│  │  • Edge SSL termination                             │    │
│  │  • Geographic distribution                          │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│         ┌───────────────┼───────────────┐                   │
│         │               │               │                   │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐           │
│  │   Web App   │ │Chrome Ext   │ │Electron App │           │
│  │  (Vercel)   │ │(Chrome Store│ │(GitHub Rel.)│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Supabase Cloud                      │    │
│  │                                                      │    │
│  │  Region: eu-west-1 (Ireland) / us-east-1            │    │
│  │  Plan: Pro ($25/month) → Team (scaling)             │    │
│  │                                                      │    │
│  │  • PostgreSQL (dedicated)                           │    │
│  │  • Edge Functions (Deno Deploy)                     │    │
│  │  • Realtime (Phoenix)                               │    │
│  │  • Storage (S3-compatible)                          │    │
│  │  • Auto-backups (daily + PITR)                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Mobile Apps                        │    │
│  │                                                      │    │
│  │  iOS: App Store Connect                             │    │
│  │  Android: Google Play Console                       │    │
│  │  OTA Updates: Expo EAS Update                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                Pi Router (Customer)                  │    │
│  │                                                      │    │
│  │  • Self-hosted on customer hardware                 │    │
│  │  • Auto-update from GitHub releases                 │    │
│  │  • Connects to Supabase for sync                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Web App
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  # Mobile Apps
  mobile:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform all --non-interactive
        if: github.ref == 'refs/heads/main'

  # Edge Functions
  supabase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  # Router Agent
  router:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./router-agent
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: dist/*
```

---

## Router Integration Implementation Timeline

### Phase 1: Desktop Bridge Agent (Months 1-4)

| Month | Deliverables                                                    | Resources        |
| ----- | --------------------------------------------------------------- | ---------------- |
| 1     | Electron app skeleton, Supabase realtime integration, basic UI  | 1 full-stack dev |
| 2     | Linksys JNAP integration, device discovery, credential storage  | 1 full-stack dev |
| 3     | Command queue system, offline resilience, auto-update mechanism | 1 full-stack dev |
| 4     | Beta testing with 20 families, bug fixes, installer polish      | 1 dev + QA       |

### Phase 2: Hardware Hub (Months 10-16)

| Month | Deliverables                                                 | Resources      |
| ----- | ------------------------------------------------------------ | -------------- |
| 10-11 | Port bridge agent to Python/Linux, captive portal setup flow | 1 embedded dev |
| 12    | Custom Raspberry Pi OS image, OTA update system              | 1 embedded dev |
| 13    | Hardware sourcing, case design, manufacturer selection       | Ops + design   |
| 14-15 | First 100 unit production run, internal testing              | Ops + QA       |
| 16    | Beta with 50 families, fulfillment process validation        | Full team      |

### Success Metrics

| Metric                           | Target                             |
| -------------------------------- | ---------------------------------- |
| Desktop agent installs (Month 6) | 500 active installations           |
| Bridge uptime                    | > 99% online when computer running |
| Command latency                  | < 5 seconds from app to router     |
| Family Pro conversion lift       | +15% from WiFi control feature     |
| Hub pre-orders (Month 12)        | 1,000 units committed              |

---

## Appendix: Technology Decisions

### Why React Native over Flutter?

| Factor                | React Native             | Flutter      |
| --------------------- | ------------------------ | ------------ |
| Code sharing with web | High (React ecosystem)   | Low (Dart)   |
| Team expertise        | Existing React/TS skills | New language |
| Native modules        | Mature ecosystem         | Growing      |
| Bundle size           | ~7MB                     | ~15MB        |
| Hot reload            | Good                     | Excellent    |
| Decision              | **Selected**             | Not selected |

### Why Electron over Tauri?

| Factor               | Electron                   | Tauri                  |
| -------------------- | -------------------------- | ---------------------- |
| Bundle size          | ~150MB                     | ~10MB                  |
| Memory usage         | Higher                     | Lower                  |
| Web tech familiarity | Full                       | Partial (Rust backend) |
| Auto-update          | Built-in                   | Manual                 |
| SSH support          | Node.js native             | Requires plugins       |
| Decision             | **Selected** (familiarity) | Future consideration   |

### Why Pi Router over commercial hardware?

| Factor           | Custom Pi                        | Commercial (Firewalla) |
| ---------------- | -------------------------------- | ---------------------- |
| Cost             | $60-100                          | $200-900               |
| Customization    | Full                             | Limited                |
| Integration      | Native Taskaroo                  | API dependent          |
| Margin potential | Yes                              | No                     |
| Support burden   | Higher                           | Lower                  |
| Decision         | **Selected** for differentiation | Potential partnership  |

---

**Document Version**: 1.1
**Last Updated**: January 2026
**Authors**: Taskaroo Engineering Team

_Includes Router Integration Spec v1.0_
