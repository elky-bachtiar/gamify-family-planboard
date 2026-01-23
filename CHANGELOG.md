# Changelog

All notable changes to Gamify Family Planboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0-alpha.9] - 2026-01-23

### Added

- **Streak Grace Period & Recovery System** - Protect and recover streaks after missing a day
  - `src/lib/gamification.ts` - New streak management functions:
    - `isInStreakGracePeriod()` - Check if member is in 24-hour warning window
    - `getGracePeriodTimeRemaining()` - Get countdown until streak loss
    - `formatTimeRemaining()` - Human-readable time formatting
    - `canRecoverStreak()` - Check if recovery is possible (48hr window + 20+ point task)
    - `recoverStreak()` - Restore streak to previous value - 1
    - `consumeStreakFreeze()` - Auto-apply freeze when grace expires
    - `handleStreakOnTaskComplete()` - Enhanced streak update with recovery logic
    - `checkStreakStatus()` - Get current streak state (active/grace/frozen/lost)
    - `getStreakFreezeInfo()` - Get freeze count and purchase availability
  - `src/components/Child/Gamification/StreakDisplay.tsx` - Grace period warning with pulsing animation and countdown timer

- **Streak Freeze Shop** - Purchase streak protection with points
  - `src/components/Child/StreakFreezeShop.tsx` - New component for buying freezes
    - Costs 50 points per freeze, max 3 freezes
    - Shows current freeze count with snowflake icons
    - Displays points balance and purchase button
    - Explanation of how freezes work
  - `supabase/functions/purchase-streak-freeze/index.ts` - Edge function for freeze purchases
  - `src/components/Child/Views/ChildStatsView.tsx` - Integrated freeze shop into stats view

- **Deduction Dispute System** - Children can dispute unfair point deductions
  - **Child Penalties View**
    - `src/components/Child/Views/ChildPenaltiesView.tsx` - View all point deductions with evidence photos
    - Shows dispute status (pending/approved/rejected)
    - "Dispute" button for eligible deductions (within 7 days)
  - **Create Dispute Modal**
    - `src/components/Child/CreateDisputeModal.tsx` - Submit dispute with reason and photo evidence
    - Up to 3 photos as counter-evidence
    - Validates dispute eligibility
  - **Admin Dispute Review**
    - `src/components/Admin/DisputeReviewManager.tsx` - Review pending disputes
    - Side-by-side comparison of original deduction and child's response
    - Approve (restores points) or reject with resolution note
    - Evidence photo gallery
  - **Dispute Notifications**
    - `src/components/Child/Gamification/DisputeResolvedToast.tsx` - Toast notification for dispute resolution
  - **Edge Functions**
    - `supabase/functions/create-dispute/index.ts` - Child creates dispute
    - `supabase/functions/resolve-dispute/index.ts` - Admin resolves dispute
    - `supabase/functions/deduct-points-with-evidence/index.ts` - Deduction with photo evidence

- **Object Association for Tasks** - Link family objects to tasks for filtering
  - `src/components/ObjectPicker.tsx` - Grid selector with object thumbnails
    - Compact mode for inline use
    - Supports multiple selection with max limit
  - `src/components/TaskModal.tsx` - Added ObjectPicker for associating objects with tasks
  - `src/lib/recurrence.ts` - Added `associated_object_ids` to TaskTemplate interface

- **Database Schema Updates**
  - `supabase/migrations/20260124000000_streak_disputes_objects.sql`:
    - `family_members`: Added `streak_freezes`, `streak_lost_at`, `last_streak_value`, `streak_recovered`, `streak_grace_started_at`
    - `points_history`: Added `evidence_urls` for photo evidence
    - `tasks`: Added `associated_object_ids` for object associations
    - New `deduction_disputes` table with full RLS policies
    - New `dispute-evidence` storage bucket with upload policies

- **Type System Updates**
  - `src/lib/database.types.ts` - Added new column types and `deduction_disputes` table
  - `src/types/index.ts` - Exported `DeductionDispute`, `DeductionDisputeWithDetails`, `PointsHistoryWithMember`

### Changed

- **Admin Panel** - Added "Disputes" tab with DisputeReviewManager component
  - `src/components/AdminPanel.tsx` - New tab with AlertCircle icon and pending count badge

- **Rate Limiting** - Added limits for new edge functions
  - `supabase/functions/_shared/security.ts` - Rate limits for dispute and freeze functions

### Translations

- `src/i18n/locales/en/gamification.json` - Added keys for:
  - `streakFreeze.*` - Shop, purchase, and freeze status
  - `penalties.*` - Deduction list display
  - `disputes.*` - Dispute creation and status
- `src/i18n/locales/nl/gamification.json` - Dutch translations for new features
- `src/i18n/locales/en/admin.json` - Added `disputes.*` keys for admin review
- `src/i18n/locales/nl/admin.json` - Dutch translations for dispute management

## [1.0.0-alpha.8] - 2026-01-23

### Added

- **Child Leaderboard View** - Family ranking accessible in child mobile dashboard
  - `src/components/Child/Views/ChildLeaderboardView.tsx` - New mobile-optimized leaderboard component
  - New "Ranking" tab in child bottom navigation (Medal icon)
  - Rank display with crown/medal icons for top 3 positions
  - Shows avatar, name, level, total points, and current streak
  - Current child highlighted with blue accent and "(you)" label
  - Real-time updates via Supabase subscription
  - `src/components/Child/ChildTabBar.tsx` - Added leaderboard tab
  - `src/components/Child/ChildDashboard.tsx` - Integrated leaderboard view

- **Unclaim/Cancel Claimed Task** - Children can release claimed tasks back to available pool
  - `src/components/Child/TaskCompletionModal.tsx` - Added "Cancel Claim" button
  - Only available for tasks child claimed (not parent-assigned tasks)
  - Task returns to "Available to Claim" section when unclaimed

- **Overdue Assigned Tasks Section** - Children can see their missed tasks from previous days
  - `src/components/Child/TodayTaskList.tsx` - New "Overdue Tasks" section
  - Orange warning styling for overdue tasks
  - Due date displayed on overdue task cards
  - Separates overdue tasks from today's tasks

- **Beautiful Task Icons** - Colorful category-based icons for child task cards
  - `src/components/Child/ChildTaskCard.tsx` - Added dynamic icon system
  - 18 icon configurations based on task title keywords
  - Icons for: bed, cleaning, dishes, reading, laundry, pets, hygiene, music, games, exercise, writing, shopping, trash, gardening, car, helping, gifts, achievements
  - Colored rounded square icon boxes (12x12) with white icons
  - Priority-based fallback colors when no keyword match

### Changed

- **Task Filtering Improvements** - More accurate task display in child mode
  - Unassigned tasks now show ONLY for today (not previous days)
  - Assigned tasks from previous days appear in dedicated "Overdue" section
  - Weekly tasks continue to show for the full week

### Translations

- `src/i18n/locales/en/gamification.json` - Added keys: `child.tabs.leaderboard`, `child.leaderboard.you`, `child.taskList.sections.overdue`, `child.completion.unclaim`
- `src/i18n/locales/nl/gamification.json` - Added Dutch translations for new features

## [1.0.0-alpha.7] - 2026-01-23

### Added

- **Comprehensive iOS Specification** - Updated `docs/USER_STORIES.md` with full feature specifications for iOS app development
  - **Implementation Status Legend** - Added icons (✅ ⚠️ 📱 🔮) to mark each story's implementation status
  - **Task Field Reference** - Complete table documenting all 17 task fields with types and descriptions
  - **Epic 3.5: Task Objects with Pictures** (📱 iOS spec)
    - 3.10 Create Family Object - Upload reusable objects with images to `family-objects` bucket
    - 3.11 Edit/Delete Family Object - Manage object library with task association checks
    - 3.12 Associate Objects with Tasks - Object picker in task modal, thumbnails on cards, filter by object
    - Database schema for `family_objects` table with RLS policies
  - **Streak Recovery Features** (📱 iOS spec)
    - 5.4.1 Streak Grace Period - 24-hour warning window before streak resets
    - 5.4.2 Streak Recovery via Big Task - Complete 20+ point task within 48 hours to recover
    - 5.4.3 Streak Freeze - Purchase freeze protection with 50 points (max 2 stored)
  - **5.6.1 Deduction with Photo Evidence** (📱 iOS spec) - Attach up to 3 photos to point deductions
  - **Epic 13: Deduction Disputes** (📱 iOS spec)
    - 13.1 View Penalty Details - See deduction reason, evidence photos, admin name
    - 13.2 Create Dispute - Submit dispute with reason and counter-evidence photos
    - 13.3 View My Disputes - Track dispute status (pending/approved/rejected)
    - 13.4 Review Disputes (Admin) - Side-by-side evidence comparison, approve/reject with reason
    - 13.5 Dispute Notifications - In-app and push notifications for resolution
    - Database schema for `deduction_disputes` table with RLS policies
  - **Updated API Reference** - 7 new Edge Functions documented with status markers
  - **New/Modified Columns Table** - Database changes needed for new features
  - **iOS-Specific Implementation Notes** - Guidance for image handling, push notifications, streak freeze flow, dispute evidence upload, object gallery layout

## [1.0.0-alpha.6] - 2026-01-21

### Added

- **Perfect Week Achievement Implementation** - The "Perfect Week" achievement now works correctly
  - `src/lib/gamification.ts` - Added `checkPerfectWeek()` function that checks if all assigned tasks for the current week are completed
  - Requires at least 3 completed tasks in the week to qualify
  - Added `perfect_week` case to the achievement condition switch statement
  - Achievement checking now properly evaluates all 5 condition types

- **Achievement Notification System** - Children now see notifications when they earn achievements
  - `src/contexts/AchievementNotificationContext.tsx` - New context for managing achievement notifications
    - `showAchievements()` function to queue achievements for display
    - Queued notifications shown one at a time
  - `src/lib/gamification.ts` - `checkAndAwardAchievements()` now returns newly awarded achievements
    - `NewlyAwardedAchievement` interface exported for type safety
    - `approveTask()` and `completeTask()` return `newAchievements` array
  - `src/components/Admin/TaskApprovalManager.tsx` - Shows achievement toast when approving tasks
  - `src/components/Child/AdminApprovalBanner.tsx` - Shows achievement toast when approving tasks
  - `src/App.tsx` - Wrapped app with `AchievementNotificationProvider`
  - `src/components/Child/Gamification/AchievementToast.tsx` - Now actually used for notifications (was previously unused)

### Changed

- **Admin Panel Visual Improvements** - Improved layout and styling of the Admin Panel
  - Purple gradient header with icon
  - Tabs positioned below title with underline-style active indicator
  - Invite code sections in side-by-side cards with gradient backgrounds
  - Family members displayed in cards with avatar initials
  - Better visual hierarchy and spacing throughout

## [1.0.0-alpha.5] - 2026-01-21

### Added

- **Week Number Display** - Calendar header now shows "Week X" when viewing past/future weeks
  - `src/components/WeeklyCalendar.tsx` - Added `getISOWeekNumber()` and `isCurrentWeek()` helper functions
  - Shows "Today" / "Vandaag" when viewing current week, "Week X" otherwise
  - Translation keys added: `common.time.weekNumber`

- **Objects/Tags with Pictures** - Admin feature to manage objects with images for task filtering
  - **Database**
    - `supabase/migrations/20260121110000_add_family_objects.sql` - New `family_objects` table with RLS policies
    - `family-objects` Supabase Storage bucket for images
    - `src/lib/database.types.ts` - Added `family_objects` table type
    - `src/types/index.ts` - Added `FamilyObject` type export
  - **Admin Interface**
    - `src/components/Admin/ObjectsManager.tsx` - CRUD component for managing objects
      - Create, edit, delete objects with names and pictures
      - Image upload with preview (max 2MB)
      - Grid display of all family objects
    - `src/components/AdminPanel.tsx` - Added "Objects" tab with Package icon
  - **Filter Bar Enhancement**
    - `src/components/WeeklyCalendar.tsx` - Filter bar now shows object images next to tag names
      - Fetches family objects on load
      - Displays small thumbnail (16x16) for tags that match an object name

### Translations

- `src/i18n/locales/en/common.json` - Added `time.weekNumber` key
- `src/i18n/locales/nl/common.json` - Added `time.weekNumber` key (Dutch)
- `src/i18n/locales/en/admin.json` - Added `panel.tabs.objects` and `objects.*` keys
- `src/i18n/locales/nl/admin.json` - Added Dutch translations for objects feature

## [1.0.0-alpha.4] - 2026-01-21

### Added

- **Child Profile Picture Upload** - Children can now upload and manage their own profile pictures
  - `src/components/Child/ChildProfileModal.tsx` - New mobile-friendly profile modal for children
    - Photo upload with camera button overlay
    - Photo removal with trash button
    - Preview before saving
    - File validation (image types only, max 2MB)
    - Stats display (level, points, streak)
    - Level progress bar with points to next level
    - Sign out button
  - `src/components/Child/ChildHeader.tsx` - Avatar now clickable with camera indicator
    - Blue camera icon badge on avatar
    - Hover/focus states for accessibility
    - `onAvatarClick` prop for opening profile modal
  - `src/components/Child/ChildDashboard.tsx` - Integrated ChildProfileModal
    - Profile modal state management
    - Passed `onAvatarClick` handler to ChildHeader

### Translations

- `src/i18n/locales/en/common.json` - Added `profile.myProfile`, `profile.tapToEdit`, `profile.savePhoto`, and other profile-related keys
- `src/i18n/locales/nl/common.json` - Added Dutch translations for child profile features
- `src/i18n/locales/en/gamification.json` - Added `level.toNextLevel` key
- `src/i18n/locales/nl/gamification.json` - Added Dutch translation for level progress

## [1.0.0-alpha.3] - 2026-01-21

### Added

- **Negative Points & Penalty System** - Parents can now deduct points from family members
  - **Manual Points Deduction** - Admins can deduct points for behavior issues
    - `src/lib/gamification.ts` - Added `awardManualPoints()` function for positive/negative point adjustments
    - `src/components/Admin/ManualPointsManager.tsx` - New component with member selection, points input, reason field, and confirmation dialog
    - Integrated into AdminPanel Members tab below PaletteSelector
    - Points history entries prefixed with "Straf:" for negative points, "Bonus:" for positive
    - Points cannot go below 0
  - **Weekly Task Penalty** - Automatic -50% penalty for missed weekly tasks
    - `src/lib/gamification.ts` - Added `getOverdueWeeklyTasks()` and `applyWeeklyTaskPenalty()` functions
    - `src/components/Admin/MissedWeeklyTasksSection.tsx` - New component showing overdue weekly tasks with penalty application
    - Displays task title, assignee, original points, and calculated penalty amount
    - "Apply Penalty" button with confirmation dialog
    - Integrated into TaskApprovalManager (Approvals tab) and AdminApprovalBanner (child mode)
    - Weekly tasks are overdue when: `due_date < current week Monday` AND status is pending/pending_approval
  - **Penalty Notification for Children** - Toast notifications when points are deducted
    - `src/components/Child/Gamification/PenaltyToast.tsx` - Red gradient toast (from-red-600 to-orange-500)
    - Shows points lost and reason
    - Auto-closes after 5 seconds with progress bar animation
    - Unseen penalties tracked via localStorage per member
    - Multiple penalties shown sequentially
    - Integrated into ChildDashboard

### Changed

- **AdminApprovalBanner Redesigned** - Now shows as "Admin Panel" for admins in child mode view
  - Purple gradient styling (from-purple-600 to-indigo-600) with Shield icon
  - Always visible for admins (not just when pending items exist)
  - Pending count badge shown in amber when there are pending items
  - Added inline "Deduct Points" section with quick deduction form
  - Includes missed weekly tasks section when applicable
  - Translations updated for new admin tools

### Translations

- `src/i18n/locales/en/admin.json` - Added `manualPoints.*` and `missedWeeklyTasks.*` keys
- `src/i18n/locales/nl/admin.json` - Added Dutch translations for penalty features
- `src/i18n/locales/en/gamification.json` - Added `child.penalty.*` keys
- `src/i18n/locales/nl/gamification.json` - Added Dutch penalty notification translations

## [1.0.0-alpha.2] - 2026-01-21

### Added

- **Expanded Multi-Language Support** - Added 14 new languages (16 total)
  - Chinese (Simplified) - 中文 (zh)
  - Hindi - हिन्दी (hi)
  - Spanish - Español (es)
  - Arabic - العربية (ar)
  - French - Français (fr)
  - Bengali - বাংলা (bn)
  - Portuguese (Brazilian) - Português (pt)
  - Russian - Русский (ru)
  - Indonesian - Indonesia (id)
  - German - Deutsch (de)
  - Japanese - 日本語 (ja)
  - Korean - 한국어 (ko)
  - Thai - ไทย (th)
  - Turkish - Türkçe (tr)
  - Translation files for all 6 namespaces per language (common, auth, tasks, gamification, admin, landing)
  - `src/i18n/locales/{lang}/` - 84 new translation files created

### Changed

- **LanguageSwitcher** - Updated to show all 16 languages with scrollable dropdown (max-height 320px)
- **English flag** - Changed from British (🇬🇧) to American (🇺🇸) flag

## [1.0.0-alpha] - 2026-01-20

### Added

- **Multi-Language Support (i18n)** - Internationalization with English (default) and Dutch
  - `src/i18n/index.ts` - i18next setup with language detection and localStorage persistence
  - `src/i18n/locales/en/` - English translations (common, auth, tasks, gamification, admin)
  - `src/i18n/locales/nl/` - Dutch translations (common, auth, tasks, gamification, admin)
  - `src/components/LanguageSwitcher.tsx` - Dropdown with flag icons for language selection
  - Language switcher in Header and all auth pages (Login, Register, Family Setup, Child PIN Login)
  - Browser language auto-detection with fallback to English
  - Language preference persisted in localStorage
  - Date formatting respects selected language (weekdays, dates)
  - Pluralization support (e.g., "1 point" vs "5 points", "1 dag" vs "5 dagen")
  - Components migrated:
    - Core: Header, TaskCard, TaskModal, TaskDetailModal, EditRecurringTaskDialog, RecurrenceSelector, ProfileModal, WeeklyCalendar
    - Auth: LoginPage, RegisterPage, FamilySetupPage, ChildPinLogin
    - Stats: StatsOverview, Leaderboard, Achievements
    - Child Dashboard: ChildDashboard, ChildHeader, ChildTabBar, TodayTaskList
    - Child Tasks: ChildTaskCard, ChildCreateTaskModal, TaskCompletionModal
    - Child Gamification: DailyGreeting, ApprovalCelebration, LevelProgress, StreakDisplay
    - Child Views: ChildBadgesView, ChildStatsView
    - Rewards: RewardsOverview, RewardSettings, RedemptionManager
    - Admin: AdminPanel, EditMemberModal, DeleteMemberConfirmModal, PaletteSelector, CreateChildModal, TaskApprovalManager
- **Child Mobile Gamification Flow** - Duolingo-style mobile experience for children (`src/components/Child/`)
  - `ChildDashboard.tsx` - Mobile-first dashboard for PIN users
  - `ChildHeader.tsx` - Compact header with avatar, points, streak, level progress bar
  - `TodayTaskList.tsx` - Today's tasks filtered by child with real-time sync
  - `ChildTaskCard.tsx` - Large touch-friendly task cards (48px+ tap targets)
  - `TaskCompletionModal.tsx` - Full-screen task detail with "I'm Done!" button
  - `ChildTabBar.tsx` - Bottom navigation (Home/Badges/Stats)
  - `DailyGreeting.tsx` - Welcome screen with streak celebration (auto-dismiss)
- **Gamification Components** (`src/components/Child/Gamification/`)
  - `StreakDisplay.tsx` - Animated fire icon with streak count and milestone highlights
  - `LevelProgress.tsx` - Animated progress bar showing XP to next level
  - `DailyGoalRing.tsx` - Circular SVG progress indicator for daily tasks
  - `ComboIndicator.tsx` - Combo streak display (+10% per consecutive task, max +50%)
  - `PointsAnimation.tsx` - Flying "+X points" celebration overlay
  - `ApprovalCelebration.tsx` - Full-screen confetti celebration when parent approves
  - `AchievementToast.tsx` - Slide-in notification for unlocked achievements
- **Child Views** (`src/components/Child/Views/`)
  - `ChildBadgesView.tsx` - Achievement/badge gallery with earned/locked states
  - `ChildStatsView.tsx` - Points history, weekly stats, streak calendar
- **CSS Animations** for gamification effects:
  - `animate-flame` - Flame flicker for streak display
  - `animate-confetti-fall` - Confetti particles for celebrations
  - `animate-points-fly` - Points flying up animation
  - `animate-sparkle-*` - Sparkle effects (4 variants)
  - `animate-slide-up` - Mobile modal slide-up animation
  - `animate-fade-in` - Fade in animation
  - `animate-float` - Floating/bouncing animation for empty state star
  - `safe-area-bottom` - iOS safe area padding for bottom nav
- **Real-time Task Approval Detection** - Children see instant celebration when parent approves their task
- **Unassigned Task Visibility** - Children can see unassigned tasks in "Available to Claim" section
  - `TodayTaskList.tsx` - Fetches both assigned and unassigned tasks for today
  - "Available to Claim" section with distinct blue styling and dashed border
  - Hand icon and "Tap to claim!" badge on claimable task cards
- **Task Claiming** - Children can claim unassigned tasks to add to their list
  - `TaskCompletionModal.tsx` - "Claim This Task!" button for unassigned tasks
  - Task is assigned to child after claiming, then they can complete it for points
- **Child Task Creation** - Children can create their own tasks
  - `ChildCreateTaskModal.tsx` - Mobile-first task creation modal
  - Tasks auto-assigned to child with default 10 points
  - Points can be adjusted by parents when approving the completed task
  - Floating action button (FAB) on task list for quick task creation
- **Fun Empty State** - Engaging empty state when no tasks exist for the day
  - Animated floating star icon with CSS `animate-float` animation
  - "Ready for an adventure?" playful heading
  - Quick task suggestion chips (Read, Clean, Exercise, Create, Learn, Pet care)
  - Clicking a suggestion pre-fills the task creation modal
  - Gradient "Create My Own Task" button with sparkle icon
- **Admin Panel** - New admin management interface (`src/components/Admin/`)
- **Admin Member Management** - Full CRUD for family members in Admin Panel
  - Edit member name and color (`src/components/Admin/EditMemberModal.tsx`)
  - Delete member with confirmation (`src/components/Admin/DeleteMemberConfirmModal.tsx`)
  - Edit/delete buttons on each member row
- **Task Editing** - Admins can edit tasks from Task Detail modal
  - Edit button (pencil icon) in header for non-completed tasks
  - Full form: title, description, assignee, due date/time, priority
  - Points auto-update based on priority change
- **Color Palettes** - 11 themed color palettes for profile customization
  - Palettes: Default, Soft Pastels, Vintage, Retro, Neon, Summer, Fall, Winter, Spring, Happy, Kids
  - Family-level palette selection in Admin Panel
  - `PaletteSelector` component (`src/components/Admin/PaletteSelector.tsx`)
  - `useColorPalette` hook (`src/hooks/useColorPalette.ts`)
  - Migration: `20260119190000_add_color_palette_to_families.sql`
- **Rewards System** - Points-based rewards with redemption workflow (`src/components/Rewards/`)
- **Child PIN Login** - Children can log in with a simple PIN code (`src/components/Auth/ChildPinLogin.tsx`)
- **Profile Modal** - User profile viewing and editing (`src/components/ProfileModal.tsx`)
- **Task Detail Modal** - Detailed task view with edit capability (`src/components/TaskDetailModal.tsx`)
- **Edge Functions** for secure operations:
  - `create-child` - Create child accounts with PIN authentication
  - `pin-login` - Authenticate children via PIN
- **Task Approval Workflow** - Non-admin task completions now require parent approval
  - Tasks enter `pending_approval` status when children complete them
  - Parents approve or reject from Admin Panel
  - Points only awarded after approval
  - New database columns: `completed_by`, `approved_by`, `approved_at`
  - Migration: `20260119180000_add_task_approval_workflow.sql`
- **Task Approval Manager** - New admin component for reviewing pending tasks (`src/components/Admin/TaskApprovalManager.tsx`)
  - Approve/reject buttons with real-time updates
  - Shows who completed each task
  - "Recently Approved" section showing last 5 approved tasks
- **Copy PIN Link** - Button to copy login URL for existing PIN users in Admin Panel member list
- **Recurring Tasks** - Admins can create recurring tasks with multiple patterns
  - `RecurrenceSelector.tsx` - UI component for selecting recurrence patterns
  - Pattern options: One time, Daily, Weekly, Specific days (choose weekdays)
  - End date picker with preview count ("This will create X tasks")
  - Tasks are generated upfront as individual instances linked by `recurring_task_group_id`
  - Purple repeat icon indicator on recurring task cards
  - `src/lib/recurrence.ts` - Utility functions for generating recurring task instances
  - Migration: `20260119200000_add_recurring_tasks.sql`
- **Task Tags/Objects** - Free-form tags for categorizing and filtering tasks
  - `TagInput.tsx` - Reusable tag input component with keyboard support (Enter/comma to add)
  - Tags displayed on TaskCard (max 2 visible + overflow indicator)
  - Tags viewable and editable in TaskDetailModal
  - Tags included when creating tasks (single or recurring)
  - Tag-based filtering in WeeklyCalendar header
  - Migration: `20260119210000_add_associated_items_to_tasks.sql`
- **Edit Recurring Tasks as Group** - Bulk edit all future recurring task instances
  - `EditRecurringTaskDialog.tsx` - Dialog to choose "Edit this task only" or "Edit all future tasks"
  - Shows count of affected future tasks
  - Bulk updates: title, description, assigned_to, priority, point_value, associated_items
  - Per-instance fields preserved: due_date, due_datetime
  - `countFutureRecurringTasks()` utility function in recurrence.ts
- **Parent/Admin Management** - Promote members to admin and invite new parents
  - **Toggle Admin Status** - Crown icon button on each member to promote/demote admin rights
    - `src/components/Admin/ToggleAdminModal.tsx` - Confirmation modal with warnings
    - `supabase/functions/toggle-admin/index.ts` - Edge function with "last admin" protection
    - Cannot remove the last admin from a family
    - When promoting, role is automatically set to 'parent'
  - **Parent Invite Code** - Separate invite code for inviting new parents with admin rights
    - `parent_invite_code` column added to families table
    - Shown in AdminPanel below regular invite code with yellow/gold styling
    - `supabase/functions/join-family-as-parent/index.ts` - Edge function for parent joins
  - **Join as Parent Flow** - Distinct UI when joining via parent invite link
    - `/join-parent/{code}` URL pattern recognized by FamilySetupPage
    - Yellow-themed UI with crown icon indicating admin rights
    - "You will join with admin rights" notice displayed
  - Migration: `20260120100000_add_parent_invite_code.sql`
  - Translations added for EN and NL
- **Tag Suggestions When Creating Tasks** - Previously used tags now suggested when creating new tasks
  - `src/components/TagInput.tsx` - Enhanced with suggestions dropdown and quick-add chips
  - Suggestions appear when typing, filtered by input text
  - Recent/frequently used tags shown as quick-add chips above input
  - Arrow key navigation in suggestions dropdown
  - Tags fetched from family's existing tasks, sorted by usage frequency
- **Copy Task Functionality** - Duplicate existing tasks with pre-filled values
  - Copy button (green icon) in TaskDetailModal header for admins
  - Opens TaskModal pre-filled with copied task's title, description, assignee, priority, time, and tags
  - `TaskInitialValues` interface exported from TaskModal
  - `onCopyTask` callback prop added to TaskDetailModal
- **Familiebord Filters** - Filter tasks by status and assignee in Family Planboard
  - `src/components/FamilyPlanboard.tsx` - Added filter controls
  - Status filter: All / Pending / Pending Approval / Completed
  - Assignee filter: All / Unassigned / [Family member names]
  - Toggle filter panel with filter icon (shows count of active filters)
  - Clear filters button when filters are active
  - Translations added for EN and NL (`tasks.filters.*`, `tasks.planboard.*`)
- **Tags Display in Child Task Cards** - Children can now see task tags
  - `src/components/Child/ChildTaskCard.tsx` - Added tags display (max 2 + overflow)
  - Due date displayed for overdue tasks (orange styling with calendar icon)
  - `isOverdue` prop to indicate tasks from previous days
- **Overdue Unassigned Tasks Visibility** - Children can see and claim unassigned tasks from previous days
  - `src/components/Child/TodayTaskList.tsx` - Modified query to fetch overdue unassigned pending tasks
  - Overdue tasks shown in "Available to Claim" section with date indicator
- **End Time Filtering for Unassigned Tasks** - Unassigned tasks hidden 1 hour after their due time
  - `src/components/Child/TodayTaskList.tsx` - Client-side filtering for expired tasks
  - Tasks with `due_datetime + 1 hour < now` are filtered from available tasks
- **Drag-and-Drop Task Prioritization** - Reorder tasks within each day via drag-and-drop (admin only)
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` - Accessible drag-and-drop library
  - `src/components/SortableTaskCard.tsx` - Draggable task card wrapper with grip handle
  - `src/components/ReorderRecurringTaskDialog.tsx` - Dialog for recurring task reorder options
  - `src/lib/taskOrdering.ts` - Utility functions for sort order calculations (fractional indexing)
  - `sort_order` column added to tasks table with index for efficient sorting
  - Drag handles appear on hover to the left of task cards
  - Recurring tasks show dialog: "This task only" or "All future tasks"
  - Keyboard accessible (Space to grab, arrow keys to move)
  - Sort order persists across page refreshes
  - Migration: `20260120110000_add_task_sort_order.sql`
  - Translations added for EN and NL (`tasks.recurringReorder.*`)
- **Task Start Time & Time-Range Visibility** - Parents can set when tasks become visible to children
  - `start_datetime` column added to tasks table for defining task visibility window
  - Admin-only "Start Time" input in TaskModal and TaskDetailModal
  - Unassigned tasks only appear to children when current time is between start_datetime and due_datetime + 1 hour
  - Time range display (e.g., "9:00 AM - 11:00 AM") in ChildTaskCard when start time is set
  - Recurring tasks support: start time is applied to all instances in the series
  - `src/lib/recurrence.ts` - TaskTemplate interface extended with `start_datetime`
  - Migration: `20260120120000_add_task_start_datetime.sql`
  - Translations added for EN and NL (`tasks.modal.startTimeLabel`, `tasks.modal.startTimeHint`, `tasks.detail.startTime`)
- **Admin Approval Banner in Child Mode** - Parents/admins can now see and manage pending approvals directly in the child dashboard
  - `src/components/Child/AdminApprovalBanner.tsx` - Collapsible banner shown only for admin users
  - Displays count of pending items with expandable detail view
  - **New Task Requests** section - Child-created tasks awaiting approval with editable point values
  - **Pending Completion Approvals** section - Tasks completed by children awaiting verification
  - Approve/reject actions directly from the child view
  - Real-time updates via Supabase subscription
  - Integrated into `ChildDashboard.tsx` between header and task list

### Changed

- **Task Claiming UI** - Immediate UI refresh when a child claims a task
  - Added `onClaimSuccess` callback to `TaskCompletionModal.tsx`
  - Task list now refreshes instantly without waiting for realtime subscription
- **App.tsx** - PIN users (children) are now automatically routed to the mobile-first ChildDashboard instead of the standard Dashboard
- **Dashboard Layout Redesign** - StatsOverview now spans full width at top, with Leaderboard and AdminPanel side-by-side below
- **ProfileModal** now uses family's selected color palette for color picker
- **CreateChildModal** now uses family's selected color palette for color picker
- **AdminPanel** member list now shows edit/delete buttons with immediate UI refresh after changes
- Consolidated database migrations into cleaner structure:
  - `20260119140000_initial_schema.sql` - Core schema
  - `20260119150000_fix_family_members_infinite_recursion.sql` - RLS policy fixes
  - `20260119160000_add_rewards_and_pin_features.sql` - Rewards and PIN support
  - `20260119170000_add_pin_user_rls_support.sql` - PIN user RLS policies
- Updated `AuthContext` with support for PIN-based child authentication
- Updated `FamilyContext` with improved member management
- Enhanced `Header` component with profile and admin navigation
- Improved `AdminPanel` with child management, reward approval, and new "Approvals" tab
- Updated `Achievements`, `Leaderboard`, and `StatsOverview` components
- Enhanced `TaskCard` with pending approval state (yellow styling, clock icon, "Awaiting Approval" badge)
- Updated `WeeklyCalendar` component
- Improved gamification logic in `src/lib/gamification.ts` with `approveTask()` and `rejectTask()` functions
- Updated database types in `src/lib/database.types.ts` with `pending_approval` status
- Enhanced Supabase client configuration

### Fixed

- Family members RLS infinite recursion issue
- **Welcome Message Translation Placeholders** - Fixed duplicate `dailyGreeting` keys in gamification translations
  - Merged two `dailyGreeting` objects in `en/gamification.json` and `nl/gamification.json`
  - `motivation.*` translation keys now accessible (were being overwritten by duplicate key)

### Removed

- Deprecated individual migration files (consolidated into new structure)

## [0.3.0] - 2026-01-19

### Added

- **Secure Invite Code System** via edge function
  - `join-family` edge function for secure family joining
  - Server-side invite code validation
  - Prevents unauthorized family data access
- Debug logging to join-family edge function

### Fixed

- Security vulnerability: Removed insecure RLS policy that would have exposed all families
- Database remains locked down with strict RLS policies

### Security

- All invite code lookups now happen server-side with proper authentication
- Edge function validates all inputs and checks authorization
- Follows principle of least privilege

## [0.2.0] - 2026-01-19

### Added

- **Authentication System**
  - Supabase Auth integration with email/password
  - Login and Register pages with validation
  - Persistent sessions
  - AuthRouter for routing authenticated vs unauthenticated users

- **Family Management**
  - Families table with unique invite codes
  - FamilySetupPage for creating or joining families
  - `generate_invite_code()` database function
  - Role selection (parent/child) during setup
  - Auto-assigns unique colors to members

- **Enhanced Task Management**
  - Date AND time picker for precise scheduling
  - Task assignment to any family member
  - Optional assignment (unassigned tasks allowed)
  - Family-scoped task creation
  - Tasks exclude archived items

- **Parent Permissions Infrastructure**
  - `is_admin` flag for parent permissions
  - `manual_points_awards` table for parent-awarded points
  - Database ready for manual point awards UI

- **Reward System Infrastructure**
  - `reward_redemptions` table for points-to-money conversion
  - Configurable conversion rate per family
  - Parent approval workflow (database ready)

- **Task History Infrastructure**
  - `task_history` table for archived tasks
  - `is_archived` flag for task lifecycle
  - Weekly reset capability (database ready)

- **Custom Achievements Infrastructure**
  - `is_custom` flag for user-created achievements
  - Family-specific achievements support

### Changed

- All components now family-scoped
- Leaderboard shows only family members
- StatsOverview calculates family-specific statistics
- Achievements display global + custom family achievements
- FamilyContext works with AuthContext for family data
- Real-time subscriptions scoped to family

### Security

- Row Level Security policies ensure family data isolation
- Users can only view their family's data
- Parents can create achievements and award points
- Complete data isolation between families

## [0.1.1] - 2026-01-19

### Fixed

- Families SELECT policy for family creators
  - Creators can now see their family immediately after creation
  - Fixed RLS policy that blocked SELECT after INSERT
- Families INSERT policy for authenticated users

## [0.1.0] - 2026-01-19

### Added

- **Initial Project Setup**
  - React 18 + TypeScript + Vite
  - Tailwind CSS styling
  - Supabase integration (PostgreSQL, Auth, Realtime)
  - Lucide React icons

- **Database Schema**
  - `family_members` - Profiles with points, levels, streaks, roles
  - `tasks` - Tasks with assignments, due dates, priorities, point values
  - `achievements` - Badge definitions with unlock conditions
  - `user_achievements` - Earned achievements tracking
  - `points_history` - Point transaction audit log
  - `weekly_goals` - Weekly objectives tracking
  - Row Level Security policies for all tables
  - Performance indexes on frequently queried columns

- **Family Member Management**
  - Welcome screen for creating members with custom colors
  - Member switcher for viewing different members' tasks
  - Profile persistence using localStorage

- **Weekly Calendar View**
  - Seven-day week view with task organization
  - Week navigation with today button
  - Task completion tracking per day
  - Quick-add button for each day

- **Task Management**
  - Create tasks with title, description, due date, priority
  - Three priority levels: low (5pts), medium (10pts), high (20pts)
  - Visual task cards with status indicators
  - Task completion with celebration animations
  - Task deletion

- **Gamification System**
  - Points awarded based on task priority
  - 12-level progression system with point thresholds
  - Progress bars showing advancement
  - 9 default achievements:
    - First task completion
    - Task count milestones
    - Points total milestones
    - Streak achievements
    - Perfect week
  - Automatic achievement unlocking
  - Streak tracking for consecutive days

- **Leaderboard**
  - Family ranking by total points
  - Special styling for top 3 (crown, medals)
  - Current levels and streaks display
  - Real-time updates

- **Statistics Dashboard**
  - Total/completed/pending task counters
  - Weekly points earned tracking
  - Completion rate with progress bar
  - Color-coded stat cards

- **Achievements Gallery**
  - Grid display of all achievements
  - Locked/unlocked visual states
  - Earned date display
  - Progress tracking (X of Y unlocked)

- **Real-Time Features**
  - Live task updates (create, complete, delete)
  - Instant leaderboard refresh
  - Achievement notifications
  - Family member sync

- **User Experience**
  - Clean, modern interface
  - Color-coded family members
  - Gradient backgrounds and shadows
  - Responsive grid layouts
  - Celebration animations
  - Smooth transitions
  - Loading spinners
  - Hover effects

### Technical

- Modular component architecture
- Context API for global state
- Custom hooks for data management
- Type-safe TypeScript throughout
- Efficient real-time subscription management
- Subscription cleanup on unmount
