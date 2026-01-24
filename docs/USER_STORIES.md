# User Stories - Taskaroo Family Task Management

This document contains comprehensive user stories for the Taskaroo iOS app implementation. The app is a gamified family task management system with separate interfaces for parents (admins) and children.

---

## Implementation Status Legend

| Icon | Meaning                      |
| ---- | ---------------------------- |
| ✅   | Fully implemented in web UI  |
| ⚠️   | Partially implemented        |
| 📱   | iOS spec - not yet in web UI |
| 🔮   | Future enhancement           |

---

## User Types

| User Type        | Description                                             | Authentication                   |
| ---------------- | ------------------------------------------------------- | -------------------------------- |
| **Parent/Admin** | Adult family members with full management capabilities  | Email/password via Supabase Auth |
| **Child**        | Younger family members with limited, gamified interface | 4-6 digit PIN code               |

---

## Epic 1: Authentication & Onboarding ✅

### 1.1 Parent Registration ✅

**As a** parent
**I want to** create an account with email and password
**So that** I can set up and manage my family's tasks

**Acceptance Criteria:**

- Email validation required
- Password minimum 6 characters
- Successful registration creates Supabase auth user
- After registration, user is directed to family setup

### 1.2 Parent Login ✅

**As a** registered parent
**I want to** log in with my email and password
**So that** I can access my family dashboard

**Acceptance Criteria:**

- Email and password fields
- "Forgot password" functionality
- Error handling for invalid credentials
- Redirect to dashboard on success

### 1.2.1 OAuth Login (Google/Apple) ✅

**As a** parent
**I want to** sign in with my Google or Apple account
**So that** I can log in without remembering another password

**Acceptance Criteria:**

- Google sign-in button with branded styling
- Apple sign-in button with branded styling (black background)
- OAuth flow redirects to provider, then returns to app
- On first login, creates new account automatically
- Links to existing account if email matches
- Shows loading spinner during OAuth process
- Error handling for OAuth failures

### 1.3 Child PIN Login ✅

**As a** child
**I want to** log in using my unique invite code and PIN
**So that** I can access my tasks without needing an email

**Acceptance Criteria:**

- Enter 8-character invite code (e.g., `ABC12345`)
- Enter 4-6 digit PIN
- PIN is validated against SHA-256 hash
- On success, load child-specific dashboard
- Show error for invalid code or PIN

### 1.4 Create New Family ✅

**As a** new parent
**I want to** create a new family group
**So that** I can start managing tasks for my household

**Acceptance Criteria:**

- Enter family name
- System generates unique invite codes:
  - `invite_code` for children/members
  - `parent_invite_code` for other parents
- Creator becomes family admin automatically
- Redirect to dashboard after creation

### 1.5 Join Existing Family (Member) ✅

**As a** new user
**I want to** join an existing family using an invite code
**So that** I can participate in the family's task system

**Acceptance Criteria:**

- Enter family invite code
- Enter display name and choose color
- Join as non-admin member by default
- If using `parent_invite_code`, join as admin

### 1.6 Sign Out ✅

**As a** logged-in user
**I want to** sign out of the app
**So that** I can protect my account on shared devices

**Acceptance Criteria:**

- Clear local session/tokens
- Return to login screen
- For PIN users, only clear PIN session (not family data)

---

## Epic 2: Family Management (Admin Only) ✅

### 2.1 Create Child Account ✅

**As a** parent/admin
**I want to** create a child account with a PIN
**So that** my child can log in without needing an email

**Acceptance Criteria:**

- Enter child's name
- Set 4-6 digit PIN
- Choose display color from family palette
- System generates unique `child_invite_code`
- Child account created with `is_pin_user: true`
- Show invite code for child to use

### 2.2 View Family Members ✅

**As a** parent/admin
**I want to** see all family members
**So that** I can manage the household

**Acceptance Criteria:**

- List all family members with:
  - Name and avatar
  - Role (parent/child)
  - Points total and level
  - Admin badge if applicable
- Sort by name or points

### 2.3 Edit Family Member ✅

**As a** parent/admin
**I want to** edit a family member's profile
**So that** I can update their information

**Acceptance Criteria:**

- Edit name
- Change display color
- Set birthdate (for birthday points feature)
- Cannot edit own admin status

### 2.4 Reset Child PIN ✅

**As a** parent/admin
**I want to** reset a child's PIN
**So that** they can regain access if they forget it

**Acceptance Criteria:**

- Select child member
- Enter new 4-6 digit PIN
- Confirm new PIN
- Old PIN immediately invalidated
- New PIN hash stored

### 2.5 Delete Family Member ✅

**As a** parent/admin
**I want to** remove a family member
**So that** I can manage who has access

**Acceptance Criteria:**

- Confirmation dialog required
- Cannot delete last admin
- Member's tasks become unassigned
- Points history preserved for audit

### 2.6 Promote/Demote Admin ✅

**As a** parent/admin
**I want to** grant or revoke admin privileges
**So that** I can share management responsibilities

**Acceptance Criteria:**

- Toggle admin status on non-PIN members
- Cannot demote the last admin
- Promoting changes role to "parent" automatically
- Confirmation required for demotion

### 2.7 View Invite Codes ✅

**As a** parent/admin
**I want to** see and share family invite codes
**So that** I can add new members

**Acceptance Criteria:**

- Display member invite code
- Display parent invite code (for adding admins)
- Copy to clipboard functionality
- Share via system share sheet

### 2.8 Set Family Default Language ✅

**As a** parent/admin
**I want to** set the family's default language
**So that** new members start with the right language

**Acceptance Criteria:**

- Select from available languages (en, nl, zh)
- Stored in `families.default_language`
- Applied to new members on join

### 2.9 Select Color Palette ✅

**As a** parent/admin
**I want to** choose a color palette for the family
**So that** the app has a cohesive look

**Acceptance Criteria:**

- Choose from palettes: default, soft-pastels, vintage, retro, neon, high-contrast, monochrome
- Preview colors before selecting
- Applied to all member color pickers

---

## Epic 3: Task Management

### Task Field Reference ✅

All task fields with their types and descriptions:

| Field                     | Type        | Required | Description                                      |
| ------------------------- | ----------- | -------- | ------------------------------------------------ |
| `title`                   | string      | Yes      | Task name (max 100 chars)                        |
| `description`             | text        | No       | Optional detailed description                    |
| `point_value`             | int         | Yes      | Points awarded on completion (1-100)             |
| `priority`                | enum        | Yes      | low (5pts default), medium (10pts), high (20pts) |
| `due_datetime`            | timestamptz | No       | When task is due                                 |
| `start_datetime`          | timestamptz | No       | When task becomes visible to children            |
| `assigned_to`             | uuid        | No       | Family member ID or null (claimable)             |
| `is_weekly_task`          | boolean     | No       | Can complete any day of the week                 |
| `recurrence_pattern`      | enum        | No       | one_time, daily, weekly, specific_days           |
| `recurrence_days`         | int[]       | No       | Days of week (0=Sun, 6=Sat) for specific_days    |
| `recurrence_end_date`     | date        | No       | When recurrence stops                            |
| `recurring_task_group_id` | uuid        | No       | Links recurring task instances together          |
| `associated_items`        | uuid[]      | No       | Family object references (see Epic 3.5)          |
| `sort_order`              | float       | No       | Fractional index for drag-drop ordering          |
| `status`                  | enum        | Yes      | pending, pending_approval, completed             |
| `completed_by`            | uuid        | No       | Who marked the task done                         |
| `approved_by`             | uuid        | No       | Admin who approved completion                    |
| `approved_at`             | timestamptz | No       | When approval happened                           |
| `rejection_reason`        | text        | No       | Why task was rejected                            |
| `rejected_by`             | uuid        | No       | Admin who rejected                               |
| `rejected_at`             | timestamptz | No       | When rejection happened                          |

### 3.1 Create Task (Admin) ✅

**As a** parent/admin
**I want to** create tasks for family members
**So that** chores and activities are tracked

**Acceptance Criteria:**

- Required fields:
  - Title
  - Point value (1-100, default varies by priority)
  - Priority (low/medium/high)
- Optional fields:
  - Description (rich text, markdown supported)
  - Due date and time (creates `due_datetime`)
  - Assigned member (or leave unassigned for anyone to claim)
  - Associated objects (select from family objects gallery)
  - Recurrence pattern
  - Start datetime (when task becomes visible)
  - Is weekly task (can complete any day that week)
- Tasks created by admin are immediately `pending`

### 3.2 Create Task (Child) ✅

**As a** child
**I want to** suggest new tasks
**So that** I can propose helpful activities

**Acceptance Criteria:**

- Title required
- Point value fixed at 5 points (enforced server-side)
- Priority defaults to medium
- Task created with `status: pending_approval`
- Task assigned to creating child
- Parent must approve before it becomes active

### 3.3 View Tasks ✅

**As a** family member
**I want to** see tasks relevant to me
**So that** I know what needs to be done

**Acceptance Criteria:**

- **Admin view:** All family tasks with filters
- **Child view:** Only tasks where:
  - `assigned_to` = my ID, OR
  - `assigned_to` is NULL (claimable)
- Filter by status, date, assignee, priority
- Sort by due date, priority, or creation date

### 3.4 Edit Task (Admin) ✅

**As a** parent/admin
**I want to** modify existing tasks
**So that** I can update requirements

**Acceptance Criteria:**

- Edit all task fields
- Cannot edit completed tasks (archive instead)
- Changes reflected immediately

### 3.5 Delete Task (Admin) ✅

**As a** parent/admin
**I want to** remove tasks
**So that** outdated items don't clutter the list

**Acceptance Criteria:**

- Confirmation required
- Completed tasks are archived to `task_history` instead
- Recurring tasks: option to delete single instance or entire series

### 3.6 Claim Unassigned Task (Child) ✅

**As a** child
**I want to** claim an unassigned task
**So that** I can earn points for extra work

**Acceptance Criteria:**

- Tasks with `assigned_to: null` show "Claim" button
- Claiming sets `assigned_to` to child's ID
- Task immediately assigned, no approval needed for claiming
- First-come-first-served

### 3.6.1 Unclaim/Cancel Claimed Task (Child) ✅

**As a** child
**I want to** cancel a task I previously claimed
**So that** I can release it back to the available pool if I can't complete it

**Acceptance Criteria:**

- "Cancel Claim" button shown in task detail modal for claimed tasks
- Only available for tasks the child claimed (not tasks assigned by parent)
- Task `assigned_to` set back to null
- Task returns to "Available to Claim" section
- Cannot unclaim tasks that are pending_approval or completed

### 3.6.2 View Overdue Assigned Tasks (Child) ✅

**As a** child
**I want to** see my overdue tasks from previous days
**So that** I can complete tasks I missed

**Acceptance Criteria:**

- Separate "Overdue Tasks" section in task list
- Shows tasks assigned to me with `due_date < today`
- Orange/warning styling to indicate overdue status
- Due date displayed on overdue task cards
- Overdue section appears above today's tasks

### 3.7 Recurring Tasks ✅

**As a** parent/admin
**I want to** create recurring tasks
**So that** regular chores don't need manual recreation

**Acceptance Criteria:**

- Recurrence patterns:
  - `one_time` - Single occurrence (default)
  - `daily` - Every day
  - `weekly` - Same day each week
  - `specific_days` - Select which days (Mon, Wed, Fri, etc.)
- System generates instances based on pattern
- Each instance is independent (completing one doesn't affect others)
- Instances linked via `recurring_task_group_id`

### 3.8 Reorder Tasks ✅

**As a** family member
**I want to** reorder my tasks via drag-and-drop
**So that** I can prioritize what I work on

**Acceptance Criteria:**

- Drag handle on task cards
- Reorder updates `sort_order` field
- Uses fractional indexing for efficiency
- Order persists across sessions

### 3.9 Task Calendar View ✅

**As a** family member
**I want to** see tasks on a calendar
**So that** I can plan my week

**Acceptance Criteria:**

- Monthly calendar view
- Tasks shown on their due dates
- Color-coded by assignee
- Tap date to see day's tasks
- Navigate between months

---

## Epic 3.5: Task Objects with Pictures 📱

Family objects are reusable items (toys, rooms, belongings) that can be associated with tasks. This provides visual context and enables filtering tasks by object.

### 3.10 Create Family Object (Admin) 📱

**As a** parent/admin
**I want to** create reusable objects with pictures
**So that** I can associate them with tasks

**Acceptance Criteria:**

- Enter object name (required, max 50 chars)
- Upload object picture (required):
  - Accept image/\* formats (jpg, png, gif, webp)
  - Max file size: 2MB
  - Auto-resize to 400x400 max dimensions
  - Upload to Supabase Storage `family-objects` bucket
  - Path: `{family_id}/{object_id}.{ext}`
- Preview image before saving
- Gallery view shows all family objects
- Admin only (not visible to children in creation mode)

**Database Schema:**

```sql
CREATE TABLE family_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES family_members(id)
);

CREATE INDEX idx_family_objects_family ON family_objects(family_id);
```

### 3.11 Edit/Delete Family Object (Admin) 📱

**As a** parent/admin
**I want to** manage existing family objects
**So that** I can keep the object library current

**Acceptance Criteria:**

- **Edit:**
  - Change object name
  - Replace picture (old image deleted from storage)
  - Updates `updated_at` timestamp
- **Delete:**
  - Confirmation dialog required
  - Check for task associations before delete
  - If associated with tasks:
    - Show warning: "This object is used in X tasks"
    - Option: "Delete anyway" or "Cancel"
    - On delete: Remove object reference from associated tasks
  - Delete image from Supabase Storage
  - Remove record from database

### 3.12 Associate Objects with Tasks 📱

**As a** parent/admin
**I want to** link objects to tasks
**So that** children see visual context for what the task involves

**Acceptance Criteria:**

- Object picker in task creation/edit modal:
  - Grid of object thumbnails with names
  - Multi-select (up to 5 objects per task)
  - Selected objects highlighted with checkmark
  - Search/filter objects by name
- Task card displays associated object thumbnails (max 3 shown, "+N" for more)
- Task detail modal shows all associated objects with names
- Filter tasks by object:
  - Object filter dropdown in task list
  - Shows tasks that include selected object

**Database Change:**

- Migrate `tasks.associated_items` from `text[]` to `uuid[]` referencing `family_objects.id`

**Migration Strategy:**

```sql
-- Add new column
ALTER TABLE tasks ADD COLUMN associated_object_ids uuid[];

-- Create foreign key constraint (array elements)
-- Note: PostgreSQL doesn't support FK on array elements, enforce in application

-- Mark old column for deprecation
COMMENT ON COLUMN tasks.associated_items IS 'DEPRECATED: Use associated_object_ids instead';
```

---

## Epic 4: Task Completion & Approval ✅

### 4.1 Complete Task (Child) ✅

**As a** child
**I want to** mark a task as done
**So that** I can earn points

**Acceptance Criteria:**

- "I'm Done!" button on task card/modal
- Task status changes to `pending_approval`
- `completed_by` set to child's ID
- Task shows "Waiting for Approval" state
- Points NOT awarded yet

### 4.2 Complete Task (Admin) ✅

**As a** parent/admin
**I want to** complete tasks immediately
**So that** I don't need to approve my own work

**Acceptance Criteria:**

- Admin completion bypasses approval
- Status goes directly to `completed`
- Points awarded immediately
- Combo bonus applied if applicable

### 4.3 Approve Task (Admin) ✅

**As a** parent/admin
**I want to** approve a child's completed task
**So that** they receive their points

**Acceptance Criteria:**

- View list of tasks with `pending_approval` status
- "Approve" button on each task
- On approval:
  - Status → `completed`
  - Points added to child's total
  - `approved_by` and `approved_at` set
  - Combo bonus applied
  - Streak updated
  - Achievement check triggered
- Show celebration animation to child

### 4.4 Reject Task (Admin) ✅

**As a** parent/admin
**I want to** reject an incomplete task
**So that** the child can redo it properly

**Acceptance Criteria:**

- "Reject" button with required reason field
- On rejection:
  - Status → `pending`
  - `completed_by` cleared
  - `rejection_reason` stored
  - `rejected_at` and `rejected_by` set
  - No points awarded
- Child sees rejection reason when viewing task

### 4.5 View Pending Approvals (Admin) ✅

**As a** parent/admin
**I want to** see all tasks awaiting approval
**So that** I can review them efficiently

**Acceptance Criteria:**

- Badge count on admin panel/header
- List tasks with `pending_approval` status
- Show who completed it and when
- Quick approve/reject actions

### 4.6 View Rejection Reason (Child) ✅

**As a** child
**I want to** see why my task was rejected
**So that** I can do it correctly

**Acceptance Criteria:**

- Rejected tasks show warning indicator
- Tap to see rejection reason
- Clear explanation of what needs improvement
- Task is back to `pending` status for retry

---

## Epic 5: Gamification & Points

### 5.1 Earn Points ✅

**As a** family member
**I want to** earn points for completing tasks
**So that** I feel rewarded for my efforts

**Acceptance Criteria:**

- Points based on task `point_value`
- Priority affects default points:
  - Low: 5 points
  - Medium: 10 points
  - High: 20 points
- Points added after approval (child) or completion (admin)
- Running total shown in header/profile

### 5.2 Combo Bonus ✅

**As a** family member
**I want to** earn bonus points for consecutive completions
**So that** I'm motivated to do more tasks

**Acceptance Criteria:**

- Each task in a combo adds +10% bonus (capped at +50%)
- Combo resets at midnight
- Visual indicator shows current combo multiplier
- Bonus calculated: `points * (1 + 0.1 * comboCount)`

### 5.3 Level Up ✅

**As a** family member
**I want to** level up as I earn points
**So that** I feel a sense of progression

**Acceptance Criteria:**

- Levels 1-50 with increasing thresholds:
  - Level 1: 0 points
  - Level 2: 100 points
  - Level 5: 500 points
  - Level 10: 2,000 points
  - Level 20: 10,000 points
  - Level 50: 100,000 points
- Level-up animation/celebration
- Level badge displayed on profile

### 5.4 Maintain Streak ✅

**As a** family member
**I want to** build a streak of daily task completions
**So that** I stay motivated over time

**Acceptance Criteria:**

- Streak increments when completing a task on a new day
- Streak resets if no task completed for 24+ hours
- Visual fire icon with streak count
- Color progression based on streak length:
  - 1-6 days: Orange flame
  - 7-13 days: Red flame
  - 14-29 days: Blue flame
  - 30+ days: Purple flame with sparkles
- Streak milestones unlock achievements (7, 14, 30, 50, 100, 365 days)

### 5.4.1 Streak Grace Period 📱

**As a** family member
**I want to** have a grace period before losing my streak
**So that** I have a chance to recover from a missed day

**Acceptance Criteria:**

- 24-hour grace window before streak resets
- Grace period starts at midnight after last completion
- Visual warning when in grace period:
  - Pulsing amber fire icon
  - Warning text: "Complete a task to save your streak!"
  - Countdown showing time remaining
- Complete any task during grace period to save streak
- If grace period expires without task completion, streak resets to 0

**Database Changes:**

- Add `streak_grace_started_at timestamptz` to `family_members`

### 5.4.2 Streak Recovery via Big Task 📱

**As a** family member
**I want to** recover a recently lost streak by completing a big task
**So that** I don't lose all my progress from one bad day

**Acceptance Criteria:**

- Recovery available only if streak lost within last 48 hours
- "Big Task" criteria:
  - Point value >= 20
  - Must be approved (not pending_approval)
  - Must be completed within 48 hours of streak loss
- On recovery:
  - Streak restored to previous value minus 1 (e.g., 10-day streak → 9 days)
  - Only works once per lost streak
  - Visual celebration: "Streak Recovered!" animation
- Visual prompt when eligible:
  - Banner: "Complete a big task (20+ pts) to save your streak!"
  - Highlight eligible tasks with "Streak Saver" badge

**Database Changes:**

- Add `streak_lost_at timestamptz` to track recovery window
- Add `last_streak_value int` to enable recovery calculation
- Add `streak_recovered boolean DEFAULT false` to prevent multiple recoveries

### 5.4.3 Streak Freeze 📱

**As a** family member
**I want to** use streak freezes to protect my streak
**So that** planned days off don't break my progress

**Acceptance Criteria:**

- Purchase freeze with points (cost: 50 points)
- Max 2 freezes stored at a time
- Auto-activates when needed:
  - At end of grace period, if freeze available
  - Freeze consumed, streak preserved
  - No action required from user
- Visual indicator shows freeze count (ice crystal icon)
- Freeze history in points log (purchase and usage)
- Cannot purchase freeze during grace period

**Database Changes:**

- Add `streak_freezes int DEFAULT 0` to `family_members`
- Add points_history entries for freeze purchases (type: 'streak_freeze_purchase')
- Add points_history entries for freeze usage (type: 'streak_freeze_used', amount: 0)

### 5.5 View Points History ✅

**As a** family member
**I want to** see my points history
**So that** I can track my progress

**Acceptance Criteria:**

- List of all point transactions
- Each entry shows:
  - Amount (+/-)
  - Reason (task completion, achievement, manual award, birthday bonus, streak freeze)
  - Date/time
  - Related task title if applicable
  - Evidence photos if applicable (see 5.6)
- Filter by type, date range
- Running total after each transaction

### 5.6 Manual Points Award/Deduction (Admin) ✅

**As a** parent/admin
**I want to** manually award or deduct points
**So that** I can reward good behavior or address issues

**Acceptance Criteria:**

- Select family member
- Enter point amount (positive or negative)
- Enter reason (required, min 5 characters)
- For deductions:
  - Use `deduct-points` Edge Function
  - Prevent negative total (cap at 0)
  - Show previous and new totals
- Transaction logged in `points_history`

### 5.6.1 Deduction with Photo Evidence 📱

**As a** parent/admin
**I want to** attach photo evidence to point deductions
**So that** children understand why points were deducted

**Acceptance Criteria:**

- When creating a deduction (negative points):
  - Optional: Attach up to 3 photos as evidence
  - Accept image/\* formats (jpg, png, gif)
  - Max 2MB per photo
  - Upload to Supabase Storage `deduction-evidence` bucket
  - Path: `{family_id}/{entry_id}/{index}.{ext}`
- Child sees penalty in history with:
  - Amount deducted
  - Reason text
  - Evidence photos (tap to view full size)
  - Date and admin name
- Photos viewable but not downloadable by child

**Database Changes:**

- Add `evidence_urls text[]` to `points_history` table

**Storage Bucket:**

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('deduction-evidence', 'deduction-evidence', false);

-- RLS policy: Family members can view their family's evidence
CREATE POLICY "Family members can view evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deduction-evidence'
  AND (storage.foldername(name))[1] IN (
    SELECT family_id::text FROM family_members
    WHERE user_id = auth.uid() OR id = auth.uid()
  )
);
```

### 5.7 Birthday Points ✅

**As a** a family member with a birthday
**I want to** receive bonus points on my birthday
**So that** I feel celebrated

**Acceptance Criteria:**

- Admin sets birthdate in member profile
- On birthday, admin can trigger bonus points
- Uses `award-birthday-points` Edge Function
- Configurable bonus amount (default: 100 points)
- Special birthday badge/animation

---

## Epic 6: Achievements & Badges ✅

### 6.1 Unlock Achievements ✅

**As a** family member
**I want to** unlock achievements for milestones
**So that** I have goals to work toward

**Acceptance Criteria:**

- Achievement types:
  - `first_task` - Complete your first task
  - `tasks_count` - Complete X total tasks (10, 50, 100, etc.)
  - `points_total` - Earn X total points
  - `streak_days` - Maintain X day streak (7, 30, etc.)
  - `perfect_week` - Complete all tasks in a week
- Toast notification when achievement unlocked
- Points bonus awarded with achievement

### 6.2 View Achievements ✅

**As a** family member
**I want to** see all available achievements
**So that** I know what I can earn

**Acceptance Criteria:**

- Gallery view of all achievements
- Shows earned vs locked status
- Earned: Full color with unlock date
- Locked: Grayed out with requirements
- Progress indicator for incremental achievements
- Icon and title for each achievement

### 6.3 Achievement Notifications ✅

**As a** family member
**I want to** be notified when I unlock an achievement
**So that** I can celebrate my accomplishment

**Acceptance Criteria:**

- Toast notification slides in
- Shows achievement icon, name, points earned
- Sound effect (optional, respects device settings)
- Tap to view achievement details
- Auto-dismiss after 5 seconds

---

## Epic 7: Rewards & Redemptions ✅

### 7.1 Request Reward Redemption (Child) ✅

**As a** child
**I want to** redeem my points for rewards
**So that** I can get something tangible for my efforts

**Acceptance Criteria:**

- View available point balance (total - pending redemptions)
- Enter redemption amount with quick-select buttons
- Conversion rate: configurable (e.g., 100 points = €1)
- Submit redemption request
- Status shows as `pending`
- Cannot request more points than **available** (not total)
- Visual display of pending vs available when requests exist

**Child Mobile Interface (ChildRewardsView):**

- Mobile-friendly rewards view accessible via bottom tab bar
- Rewards tab only visible when `point_to_money_rate > 0`
- Points & Value card with gradient styling
- Weekly goal progress bar (when configured)
- Pending requests list with color-coded status

### 7.1.1 Server-Side Redemption Protection ✅

**As a** child
**I want to** see my true available balance and have server-validated requests
**So that** I can't accidentally or maliciously request more points than I have

**Acceptance Criteria:**

- **Available Points Calculation**: `total_points - (pending + approved redemptions) = available`
- Display shows:
  - Total Points: Full balance
  - Pending: Sum of pending/approved redemption requests
  - Available: What can still be requested
- Input max capped at available (not total)
- Quick-select buttons use available amount
- **Server-Side Validation**: All requests go through `request-redemption` Edge Function
- **Atomic Validation**: Database query ensures consistent available balance calculation
- **Race Condition Prevention**: Parallel requests cannot cause over-redemption
- **Rate Limiting**: 10 requests per hour prevents spam/abuse
- Same protection applied to both child and adult interfaces
- Direct API calls to database blocked by RLS (INSERT policy removed)

### 7.2 Approve Redemption (Admin) ✅

**As a** parent/admin
**I want to** approve or reject redemption requests
**So that** I control when rewards are given

**Acceptance Criteria:**

- View pending redemption requests
- See who requested, amount, equivalent value
- Approve: Deduct points, mark as `approved`
- Reject: No point change, mark as `rejected`, enter reason
- Notification to child of decision

### 7.3 View Redemption History ✅

**As a** family member
**I want to** see my redemption history
**So that** I can track my rewards

**Acceptance Criteria:**

- List all redemptions with status
- Shows: date, points, value, status
- Filter by status (pending/approved/rejected)

### 7.4 Configure Reward Settings (Admin) ✅

**As a** parent/admin
**I want to** configure reward settings
**So that** I control the reward system

**Acceptance Criteria:**

- Enable/disable reward redemptions
- Set conversion rate (points to currency)
- Set minimum redemption amount
- Settings stored in `families` table

---

## Epic 8: Messaging ✅

### 8.1 Send Message ✅

**As a** family member
**I want to** send messages to other family members
**So that** we can communicate within the app

**Acceptance Criteria:**

- Select recipient (single member or "Everyone")
- Enter message content
- Optional: Attach to specific task
- Send creates record in `messages` table
- Recipient notification (in-app)

### 8.2 View Inbox ✅

**As a** family member
**I want to** see messages sent to me
**So that** I can stay informed

**Acceptance Criteria:**

- List messages where `recipient_id` = me OR `recipient_id` is null (broadcast)
- Show sender, preview, timestamp
- Unread indicator for new messages
- Sort by date, newest first

### 8.3 Read Message ✅

**As a** family member
**I want to** read a message
**So that** I can see the full content

**Acceptance Criteria:**

- Tap message to view full content
- Marks as read (`read_at` timestamp)
- Shows related task if applicable
- Option to reply

### 8.4 Unread Badge ✅

**As a** family member
**I want to** see how many unread messages I have
**So that** I don't miss important communications

**Acceptance Criteria:**

- Badge count on Messages tab
- Badge in header/tab bar
- Updates in real-time via Supabase subscription
- Count = messages where `read_at` is null

---

## Epic 9: Calendar & Export ✅

### 9.1 Calendar View ✅

**As a** family member
**I want to** see tasks on a calendar
**So that** I can visualize my schedule

**Acceptance Criteria:**

- Month view with task indicators
- Week view with time slots
- Day view with task list
- Color-coded by assignee or priority
- Navigate between periods

### 9.2 Export to Calendar (ICS) ✅

**As a** family member
**I want to** export tasks to my calendar app
**So that** I can see them alongside other events

**Acceptance Criteria:**

- "Export to Calendar" button on task
- Generates .ics file with:
  - Event title = task title
  - Description includes: description, assignee, points
  - Due date/time
  - Reminder (default: 1 hour before)
- Bulk export: "Export all my tasks"
- Compatible with Apple Calendar, Google Calendar, Outlook

### 9.3 Today View ✅

**As a** family member
**I want to** see today's tasks prominently
**So that** I know what to focus on

**Acceptance Criteria:**

- Dedicated "Today" section
- Shows tasks due today or overdue
- Shows unassigned tasks available to claim
- Quick complete action
- Progress indicator (X of Y done)

### 9.4 Week View ✅

**As a** family member
**I want to** see this week's tasks
**So that** I can plan ahead

**Acceptance Criteria:**

- Week number displayed
- Tasks grouped by day
- Weekly tasks shown separately (can do any day)
- Weekly goal progress indicator

---

## Epic 10: Profile & Settings ✅

### 10.1 View Profile ✅

**As a** family member
**I want to** see my profile
**So that** I can check my progress

**Acceptance Criteria:**

- Display: name, avatar, color
- Points total and level
- Current streak
- Achievement count
- Weekly goal progress

### 10.2 Edit Profile (Child) ✅

**As a** child
**I want to** update my profile
**So that** I can personalize my account

**Acceptance Criteria:**

- Change display name
- Upload/change avatar photo
- Avatar stored in Supabase Storage (`avatars` bucket)
- Cannot change PIN (admin only)

### 10.3 Change Language ✅

**As a** family member
**I want to** change the app language
**So that** I can use it in my preferred language

**Acceptance Criteria:**

- Language selector in settings
- Available: English, Dutch, Chinese
- Persists across sessions
- Immediate UI update

### 10.4 Weekly Goal ✅

**As a** family member
**I want to** set a weekly task goal
**So that** I have a target to work toward

**Acceptance Criteria:**

- Set target number of tasks per week
- Progress bar shows completion
- Resets each week (Monday)
- Completing goal can trigger achievement

---

## Epic 11: Leaderboard & Stats ✅

### 11.1 Family Leaderboard ✅

**As a** family member
**I want to** see how I rank against others
**So that** I'm motivated by friendly competition

**Acceptance Criteria:**

- Rank members by points (weekly or all-time)
- Show: rank, name, avatar, points
- Highlight current user's position
- Crown icon for #1

### 11.1.1 Child Leaderboard View ✅

**As a** child
**I want to** see the family leaderboard in my mobile dashboard
**So that** I can see how I rank against my family members

**Acceptance Criteria:**

- Dedicated "Ranking" tab in child bottom navigation
- Mobile-optimized card layout for each family member
- Shows for each member:
  - Rank position with visual badges (crown for #1, medals for #2/#3)
  - Avatar and name
  - Level indicator
  - Total points
  - Current streak (if > 0)
- Current child's position highlighted with blue accent
- "(you)" label next to current child's name
- Real-time updates when points change

### 11.2 Personal Statistics ✅

**As a** family member
**I want to** see my statistics
**So that** I can track my improvement

**Acceptance Criteria:**

- Tasks completed (today/week/all-time)
- Points earned (today/week/all-time)
- Current streak vs best streak
- Tasks by priority breakdown
- Completion rate (completed vs assigned)

### 11.3 Family Statistics (Admin) ✅

**As a** parent/admin
**I want to** see family-wide statistics
**So that** I can monitor overall progress

**Acceptance Criteria:**

- Total tasks created/completed
- Points awarded
- Active members
- Most completed tasks (by member)
- Task completion trends (chart)

---

## Epic 12: Data & Privacy (Admin) ✅

### 12.1 Export Family Data (GDPR) ✅

**As a** parent/admin
**I want to** export all family data
**So that** I comply with data portability requirements

**Acceptance Criteria:**

- "Export Data" button in settings
- Calls `export-family-data` Edge Function
- Downloads JSON file containing:
  - Family info
  - All members
  - All tasks and history
  - Points history
  - Achievements
  - Messages
  - Redemptions
- Include metadata (export date, version)

### 12.2 Activity Log (Admin) ✅

**As a** parent/admin
**I want to** see an activity log
**So that** I can monitor family activity

**Acceptance Criteria:**

- Log entries for:
  - Task created/edited/deleted
  - Task completed/approved/rejected
  - Member added/removed
  - Points awarded/deducted
  - Settings changed
- Shows: who, what, when
- Filter by member, action type, date

### 12.3 Disable Member Account (Admin) ✅

**As a** parent/admin
**I want to** temporarily disable a member
**So that** I can restrict access without deleting

**Acceptance Criteria:**

- "Disable" option on member
- Sets `is_disabled: true`
- Disabled member cannot log in
- Tasks remain assigned
- Points preserved
- Can re-enable later

---

## Epic 13: Deduction Disputes 📱

Children can dispute point deductions they believe are unfair. This creates a transparent process for resolving disagreements.

### 13.1 View Penalty Details (Child) 📱

**As a** child
**I want to** view details of a point deduction
**So that** I can understand why I was penalized

**Acceptance Criteria:**

- Tap penalty entry in points history
- Detail view shows:
  - Amount deducted
  - Reason text from admin
  - Date and time
  - Admin who issued penalty
  - Evidence photos (if any) - tap to view full size
- "Dispute This" button visible if:
  - Penalty is within 7-day dispute window
  - Not already disputed
  - Dispute not already resolved

### 13.2 Create Dispute (Child) 📱

**As a** child
**I want to** dispute an unfair point deduction
**So that** I can explain my side of the story

**Acceptance Criteria:**

- "Dispute This" button opens dispute form
- Required: Dispute reason (min 10 characters, max 500)
- Optional: Attach counter-evidence photos (up to 3)
  - Same upload specs as deduction evidence
  - Upload to `dispute-evidence` bucket
  - Path: `{family_id}/{dispute_id}/{index}.{ext}`
- Submit creates pending dispute
- Cannot dispute the same penalty twice
- 7-day dispute window from penalty date
- Confirmation: "Your dispute has been submitted for review"

**Validation Rules:**

- Reason must explain why the deduction is unfair
- Photos must be relevant to dispute
- Cannot edit dispute after submission

### 13.3 View My Disputes (Child) 📱

**As a** child
**I want to** see all my disputes and their outcomes
**So that** I can track their resolution

**Acceptance Criteria:**

- List all disputes with status:
  - Pending: Yellow badge, "Under Review"
  - Approved: Green badge, "Points Restored"
  - Rejected: Red badge, "Dispute Denied"
- Each entry shows:
  - Original penalty amount
  - Dispute reason (truncated)
  - Status and date
- Tap to view full dispute details
- If rejected: Shows rejection reason from admin

### 13.4 Review Disputes (Admin) 📱

**As a** parent/admin
**I want to** review and resolve disputes
**So that** I can fairly address disagreements

**Acceptance Criteria:**

- Badge count of pending disputes in admin panel
- Dispute review view shows:
  - Child name and avatar
  - Original penalty details (amount, reason, date)
  - Penalty evidence photos (if any)
  - Child's dispute reason
  - Child's counter-evidence photos (if any)
- Side-by-side comparison view on larger screens
- Actions:
  - **Approve Dispute:**
    - Restore deducted points to child
    - Create positive points_history entry (type: 'dispute_approved')
    - Set dispute status to 'approved'
    - Original penalty remains in history (audit trail)
  - **Reject Dispute:**
    - Require rejection reason (min 10 characters)
    - Set dispute status to 'rejected'
    - Store rejection reason
    - No point changes

### 13.5 Dispute Notifications 📱

**As a** child
**I want to** be notified when my dispute is resolved
**So that** I know the outcome

**Acceptance Criteria:**

- In-app notification when dispute resolved:
  - Approved: "Great news! Your dispute was approved and X points have been restored."
  - Rejected: "Your dispute was reviewed and denied. Tap to see why."
- Push notification (if enabled):
  - Approved: "Dispute Approved - X points restored!"
  - Rejected: "Dispute Reviewed - tap for details"
- Notification links to dispute detail view

**Database Schema:**

```sql
CREATE TABLE deduction_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  points_history_id uuid REFERENCES points_history(id) ON DELETE CASCADE,
  child_id uuid REFERENCES family_members(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) >= 10),
  evidence_urls text[],
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolution_reason text,
  resolved_by uuid REFERENCES family_members(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT unique_dispute_per_penalty UNIQUE (points_history_id)
);

CREATE INDEX idx_disputes_family ON deduction_disputes(family_id);
CREATE INDEX idx_disputes_child ON deduction_disputes(child_id);
CREATE INDEX idx_disputes_status ON deduction_disputes(status);

-- RLS Policies
ALTER TABLE deduction_disputes ENABLE ROW LEVEL SECURITY;

-- Children can view and create disputes for their own penalties
CREATE POLICY "Children can view own disputes"
ON deduction_disputes FOR SELECT
USING (child_id = auth.uid() OR family_id IN (
  SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
));

CREATE POLICY "Children can create disputes"
ON deduction_disputes FOR INSERT
WITH CHECK (child_id = auth.uid());

-- Admins can update disputes (resolve)
CREATE POLICY "Admins can resolve disputes"
ON deduction_disputes FOR UPDATE
USING (family_id IN (
  SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
));
```

---

## API Reference

### Edge Functions

| Function                      | Method | Auth   | Description                                 | Status |
| ----------------------------- | ------ | ------ | ------------------------------------------- | ------ |
| `create-child`                | POST   | Admin  | Create child with PIN                       | ✅     |
| `pin-login`                   | POST   | Public | Authenticate with PIN                       | ✅     |
| `join-family`                 | POST   | User   | Join family via invite code                 | ✅     |
| `join-family-as-parent`       | POST   | User   | Join family as admin                        | ✅     |
| `toggle-admin`                | POST   | Admin  | Promote/demote admin                        | ✅     |
| `deduct-points`               | POST   | Admin  | Deduct points from member                   | ✅     |
| `deduct-points-with-evidence` | POST   | Admin  | Deduct points with photo evidence           | 📱     |
| `award-birthday-points`       | POST   | Admin  | Award birthday bonus                        | ✅     |
| `reset-child-pin`             | POST   | Admin  | Reset child's PIN                           | ✅     |
| `disable-member`              | POST   | Admin  | Enable/disable member                       | ✅     |
| `export-family-data`          | GET    | Admin  | Export all family data                      | ✅     |
| `regenerate-invite-code`      | POST   | Admin  | Generate new invite codes                   | ✅     |
| `create-family-object`        | POST   | Admin  | Create family object with image             | 📱     |
| `update-family-object`        | PUT    | Admin  | Update family object                        | 📱     |
| `delete-family-object`        | DELETE | Admin  | Delete family object                        | 📱     |
| `create-dispute`              | POST   | Child  | Create deduction dispute                    | 📱     |
| `resolve-dispute`             | POST   | Admin  | Approve/reject dispute                      | 📱     |
| `purchase-streak-freeze`      | POST   | User   | Buy streak freeze with points               | 📱     |
| `request-redemption`          | POST   | User   | Request point redemption (server-validated) | ✅     |

### Supabase Tables

| Table                | Description                         | Status |
| -------------------- | ----------------------------------- | ------ |
| `families`           | Family groups with settings         | ✅     |
| `family_members`     | Users and children                  | ✅     |
| `tasks`              | All tasks with status               | ✅     |
| `task_history`       | Archived completed tasks            | ✅     |
| `achievements`       | Achievement definitions             | ✅     |
| `user_achievements`  | Earned achievements                 | ✅     |
| `points_history`     | Point transaction log               | ✅     |
| `weekly_goals`       | Weekly targets                      | ✅     |
| `reward_redemptions` | Reward requests                     | ✅     |
| `messages`           | In-app messages                     | ✅     |
| `audit_logs`         | Activity log                        | ✅     |
| `family_objects`     | Reusable task objects with pictures | 📱     |
| `deduction_disputes` | Point deduction disputes            | 📱     |

### New/Modified Columns

| Table            | Column                    | Type        | Description                         | Status |
| ---------------- | ------------------------- | ----------- | ----------------------------------- | ------ |
| `family_members` | `streak_freezes`          | int         | Number of freeze items (max 2)      | 📱     |
| `family_members` | `streak_lost_at`          | timestamptz | When streak was lost (for recovery) | 📱     |
| `family_members` | `last_streak_value`       | int         | Streak value before loss            | 📱     |
| `family_members` | `streak_recovered`        | boolean     | Whether recovery was used           | 📱     |
| `family_members` | `streak_grace_started_at` | timestamptz | Grace period start                  | 📱     |
| `points_history` | `evidence_urls`           | text[]      | Photo evidence for deductions       | 📱     |
| `tasks`          | `associated_object_ids`   | uuid[]      | References to family_objects        | 📱     |

---

## Technical Notes for iOS Implementation

### Authentication Flow

1. Check for stored session/tokens
2. If parent: Use Supabase Auth SDK
3. If child: Call `pin-login` Edge Function, store returned member data

### Real-time Updates

- Subscribe to Supabase realtime channels for:
  - `tasks` table (family_id filter)
  - `messages` table (recipient filter)
  - `family_members` table (family_id filter)
  - `deduction_disputes` table (child_id filter) 📱

### Offline Considerations

- Cache current user's tasks locally
- Queue task completions when offline
- Sync when connection restored
- Show clear offline indicator

### Security

- All RLS policies enforce family isolation
- Children cannot see other children's assigned tasks
- Only admins can access admin functions
- PINs are SHA-256 hashed, never stored plain

### Color Palette

Use family's selected palette for UI theming:

- `default`: Standard blue/green/red
- `soft-pastels`: Muted pastel colors
- `vintage`: Warm earth tones
- `neon`: Bright vibrant colors

### Localization

- Support ar, bn, de, en, es, fr, hi, id, nl, pt, ru, th, , tr, zh locales
- Use i18n framework (NSLocalizedString or similar)
- Date/number formatting per locale
- Translation keys match web app namespaces

### iOS-Specific Implementation Notes 📱

#### Image Handling

- Use `PHPicker` for image selection (iOS 14+)
- Compress images before upload (max 1MB after compression)
- Use `URLSession` background tasks for uploads
- Cache thumbnails locally using `NSCache`
- Display loading placeholders during image fetch

#### Push Notifications

- Register for APNs on app launch
- Store device token in `family_members.device_tokens` array
- Notification categories:
  - `TASK_APPROVED` - Task completion approved
  - `TASK_REJECTED` - Task completion rejected
  - `DISPUTE_RESOLVED` - Dispute outcome
  - `MESSAGE_RECEIVED` - New message
  - `ACHIEVEMENT_UNLOCKED` - New achievement

#### Streak Freeze Purchase Flow

1. Confirm purchase (50 points)
2. Call `purchase-streak-freeze` Edge Function
3. On success: Update local `streak_freezes` count
4. On failure: Show error, points not deducted
5. Animate ice crystal appearing in UI

#### Dispute Evidence Upload

1. Select photos from library or camera
2. Compress to max 2MB each
3. Upload to `dispute-evidence` bucket
4. Store returned URLs in dispute record
5. Show upload progress for each photo

#### Object Gallery Layout

- Grid layout: 3 columns on iPhone, 4 on iPad
- Thumbnail size: 100x100 points
- Lazy loading with placeholder
- Pull-to-refresh for updates
- Long-press for quick actions (edit/delete)
