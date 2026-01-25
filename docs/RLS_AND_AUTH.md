Wri# Row Level Security (RLS) and Authentication

This document describes the database schema, authentication flows, and Row Level Security policies for the Family Planboard application.

## Table of Contents

- [Authentication Methods](#authentication-methods)
- [Database Tables](#database-tables)
- [Helper Functions](#helper-functions)
- [RLS Policies by Table](#rls-policies-by-table)
- [Security Triggers](#security-triggers)
- [Storage Buckets](#storage-buckets)
- [Security Considerations](#security-considerations)
- [Changelog](#changelog)

---

## Authentication Methods

The application supports two authentication methods:

### 1. Standard Supabase Auth (Parents)

- Email/password authentication via Supabase Auth
- `auth.uid()` returns the Supabase user ID
- User ID is stored in `family_members.user_id`
- Has full access to admin features when `is_admin = true`

### 2. PIN-based Authentication (Children)

- Custom JWT authentication for children without email accounts
- `auth.uid()` returns the **member_id** (not a Supabase user ID)
- Identified by `family_members.is_pin_user = true`
- PIN hash stored in `family_members.pin_hash`
- Unique invite code stored in `family_members.child_invite_code`
- Limited access (no admin features)

---

## Database Tables

### Core Tables

| Table                    | Description                         | RLS Enabled |
| ------------------------ | ----------------------------------- | ----------- |
| `families`               | Family groups with settings         | Yes         |
| `family_members`         | Users linked to families            | Yes         |
| `tasks`                  | Task assignments and tracking       | Yes         |
| `achievements`           | Badge definitions                   | Yes         |
| `user_achievements`      | Earned achievements (join table)    | Yes         |
| `points_history`         | Audit log of point transactions     | Yes         |
| `weekly_goals`           | Weekly targets per member           | Yes         |
| `weekly_earnings`        | Weekly points and bonus tracking    | Yes         |
| `manual_points_awards`   | Admin-awarded bonus points          | Yes         |
| `reward_redemptions`     | Points-to-money requests            | Yes         |
| `task_history`           | Archived completed tasks            | Yes         |
| `family_objects`         | Custom objects/tags with images     | Yes         |
| `messages`               | Family messaging system (encrypted) | Yes         |
| `family_encryption_keys` | Per-family AES keys (service only)  | Yes         |

### Table: `families`

| Column                 | Type        | Description                                    |
| ---------------------- | ----------- | ---------------------------------------------- |
| `id`                   | uuid        | Primary key                                    |
| `name`                 | text        | Family name                                    |
| `invite_code`          | text        | Unique code for joining (members)              |
| `parent_invite_code`   | text        | Unique code for joining (parents with admin)   |
| `point_to_money_rate`  | numeric     | Points to currency conversion rate             |
| `minimum_redemption`   | integer     | Minimum points for redemption                  |
| `weekly_target_points` | integer     | Weekly point goal                              |
| `weekly_target_bonus`  | numeric     | Bonus for meeting weekly target                |
| `color_palette`        | text        | Theme palette name                             |
| `default_language`     | text        | Default language for family (e.g., 'en', 'nl') |
| `created_at`           | timestamptz | Creation timestamp                             |
| `created_by`           | uuid        | Creator's Supabase user ID                     |

### Table: `family_members`

| Column              | Type        | Description                                         |
| ------------------- | ----------- | --------------------------------------------------- |
| `id`                | uuid        | Primary key (also used as auth.uid() for PIN users) |
| `name`              | text        | Display name                                        |
| `email`             | text        | Email (nullable for PIN users)                      |
| `avatar_url`        | text        | Profile picture URL                                 |
| `color`             | text        | Member's assigned color                             |
| `total_points`      | integer     | Accumulated points                                  |
| `current_level`     | integer     | Current level                                       |
| `current_streak`    | integer     | Consecutive day streak                              |
| `role`              | text        | 'parent' or 'child'                                 |
| `family_id`         | uuid        | FK to families                                      |
| `user_id`           | uuid        | Supabase user ID (null for PIN users)               |
| `is_admin`          | boolean     | Admin privileges                                    |
| `pin_hash`          | text        | SHA-256 hashed PIN (PIN users only)                 |
| `child_invite_code` | text        | Unique login code (PIN users only)                  |
| `is_pin_user`       | boolean     | True for PIN-authenticated users                    |
| `birthdate`         | date        | Member's birthdate (for birthday bonus)             |
| `created_at`        | timestamptz | Creation timestamp                                  |

### Table: `tasks`

| Column                    | Type        | Description                                               |
| ------------------------- | ----------- | --------------------------------------------------------- |
| `id`                      | uuid        | Primary key                                               |
| `title`                   | text        | Task title                                                |
| `description`             | text        | Task description                                          |
| `assigned_to`             | uuid        | FK to family_members                                      |
| `due_date`                | date        | Due date                                                  |
| `due_datetime`            | timestamptz | Optional specific due time                                |
| `start_datetime`          | timestamptz | When task becomes visible                                 |
| `priority`                | text        | 'low', 'medium', 'high'                                   |
| `status`                  | text        | 'pending', 'in_progress', 'pending_approval', 'completed' |
| `point_value`             | integer     | Points awarded on completion                              |
| `completed_at`            | timestamptz | Completion timestamp                                      |
| `created_at`              | timestamptz | Creation timestamp                                        |
| `created_by`              | uuid        | FK to family_members                                      |
| `family_id`               | uuid        | FK to families                                            |
| `is_archived`             | boolean     | Archive flag                                              |
| `completed_by`            | uuid        | Who marked it complete                                    |
| `approved_by`             | uuid        | Who approved completion                                   |
| `approved_at`             | timestamptz | Approval timestamp                                        |
| `recurrence_pattern`      | text        | 'daily', 'weekly', 'specific_days', null                  |
| `recurrence_days`         | integer[]   | Days of week for specific_days pattern                    |
| `recurrence_end_date`     | date        | End date for recurring tasks                              |
| `recurring_task_group_id` | uuid        | Links recurring task instances                            |
| `associated_items`        | text[]      | Tags/objects associated with task                         |
| `creation_approved`       | boolean     | Whether task creation was approved                        |
| `creation_approved_by`    | uuid        | Who approved task creation                                |
| `creation_approved_at`    | timestamptz | Task creation approval timestamp                          |
| `sort_order`              | numeric     | Fractional index for ordering                             |
| `is_weekly_task`          | boolean     | Can be completed any day of week                          |

### Table: `achievements`

| Column                 | Type        | Description                                                                |
| ---------------------- | ----------- | -------------------------------------------------------------------------- |
| `id`                   | uuid        | Primary key                                                                |
| `name`                 | text        | Achievement name                                                           |
| `description`          | text        | Achievement description                                                    |
| `icon`                 | text        | Emoji icon                                                                 |
| `condition_type`       | text        | 'first_task', 'tasks_count', 'points_total', 'streak_days', 'perfect_week' |
| `condition_value`      | integer     | Target value for condition                                                 |
| `family_id`            | uuid        | FK to families (null = global)                                             |
| `is_custom`            | boolean     | Custom family achievement                                                  |
| `created_by_member_id` | uuid        | FK to family_members                                                       |
| `created_at`           | timestamptz | Creation timestamp                                                         |

### Table: `user_achievements`

| Column           | Type        | Description                 |
| ---------------- | ----------- | --------------------------- |
| `id`             | uuid        | Primary key                 |
| `member_id`      | uuid        | FK to family_members        |
| `achievement_id` | uuid        | FK to achievements          |
| `earned_at`      | timestamptz | When achievement was earned |

### Table: `points_history`

| Column       | Type        | Description                                     |
| ------------ | ----------- | ----------------------------------------------- |
| `id`         | uuid        | Primary key                                     |
| `member_id`  | uuid        | FK to family_members                            |
| `points`     | integer     | Points awarded (can be negative for deductions) |
| `reason`     | text        | Description of transaction                      |
| `task_id`    | uuid        | FK to tasks (optional)                          |
| `family_id`  | uuid        | FK to families                                  |
| `created_at` | timestamptz | Transaction timestamp                           |

### Table: `weekly_goals`

| Column          | Type        | Description                          |
| --------------- | ----------- | ------------------------------------ |
| `id`            | uuid        | Primary key                          |
| `member_id`     | uuid        | FK to family_members                 |
| `week_start`    | date        | Start of week                        |
| `goal_type`     | text        | 'tasks_completed' or 'points_earned' |
| `target_value`  | integer     | Goal target                          |
| `current_value` | integer     | Current progress                     |
| `completed`     | boolean     | Goal achieved                        |
| `family_id`     | uuid        | FK to families                       |
| `created_at`    | timestamptz | Creation timestamp                   |

### Table: `weekly_earnings`

| Column          | Type        | Description            |
| --------------- | ----------- | ---------------------- |
| `id`            | uuid        | Primary key            |
| `family_id`     | uuid        | FK to families         |
| `member_id`     | uuid        | FK to family_members   |
| `week_start`    | date        | Start of week          |
| `points_earned` | integer     | Points earned in week  |
| `bonus_earned`  | numeric     | Bonus amount earned    |
| `bonus_paid`    | boolean     | Whether bonus was paid |
| `created_at`    | timestamptz | Creation timestamp     |
| `updated_at`    | timestamptz | Last update timestamp  |

### Table: `manual_points_awards`

| Column       | Type        | Description                      |
| ------------ | ----------- | -------------------------------- |
| `id`         | uuid        | Primary key                      |
| `family_id`  | uuid        | FK to families                   |
| `member_id`  | uuid        | FK to family_members (recipient) |
| `awarded_by` | uuid        | FK to family_members (admin)     |
| `points`     | integer     | Points awarded                   |
| `reason`     | text        | Reason for award                 |
| `created_at` | timestamptz | Award timestamp                  |

### Table: `reward_redemptions`

| Column            | Type        | Description                               |
| ----------------- | ----------- | ----------------------------------------- |
| `id`              | uuid        | Primary key                               |
| `family_id`       | uuid        | FK to families                            |
| `member_id`       | uuid        | FK to family_members                      |
| `points_redeemed` | integer     | Points being redeemed                     |
| `money_amount`    | numeric     | Cash value                                |
| `status`          | text        | 'pending', 'approved', 'paid', 'rejected' |
| `approved_by`     | uuid        | FK to family_members                      |
| `created_at`      | timestamptz | Request timestamp                         |
| `approved_at`     | timestamptz | Approval timestamp                        |

### Table: `task_history`

| Column             | Type        | Description          |
| ------------------ | ----------- | -------------------- |
| `id`               | uuid        | Primary key          |
| `original_task_id` | uuid        | Original task ID     |
| `family_id`        | uuid        | FK to families       |
| `title`            | text        | Task title           |
| `description`      | text        | Task description     |
| `assigned_to`      | uuid        | FK to family_members |
| `due_datetime`     | timestamptz | Due datetime         |
| `priority`         | text        | Priority level       |
| `point_value`      | integer     | Points awarded       |
| `completed_at`     | timestamptz | Completion timestamp |
| `archived_at`      | timestamptz | Archive timestamp    |

### Table: `family_objects`

| Column       | Type        | Description           |
| ------------ | ----------- | --------------------- |
| `id`         | uuid        | Primary key           |
| `family_id`  | uuid        | FK to families        |
| `name`       | text        | Object name           |
| `image_url`  | text        | Image URL             |
| `created_at` | timestamptz | Creation timestamp    |
| `updated_at` | timestamptz | Last update timestamp |

### Table: `messages`

| Column              | Type        | Description                             |
| ------------------- | ----------- | --------------------------------------- |
| `id`                | uuid        | Primary key                             |
| `family_id`         | uuid        | FK to families                          |
| `sender_id`         | uuid        | FK to family_members (sender)           |
| `recipient_id`      | uuid        | FK to family_members (null = broadcast) |
| `content`           | text        | Plaintext (legacy) or '[encrypted]'     |
| `content_encrypted` | bytea       | AES-256-CBC encrypted message content   |
| `encryption_iv`     | bytea       | Initialization vector for decryption    |
| `is_encrypted`      | boolean     | Whether message uses encryption         |
| `read_at`           | timestamptz | When message was read                   |
| `created_at`        | timestamptz | Message timestamp                       |

**Note:** New messages are encrypted via the `send-message` edge function. The `messages_decrypted` view transparently decrypts content for reading.

### Table: `family_encryption_keys`

| Column           | Type        | Description                     |
| ---------------- | ----------- | ------------------------------- |
| `id`             | uuid        | Primary key                     |
| `family_id`      | uuid        | FK to families (unique)         |
| `encryption_key` | bytea       | 256-bit AES key (never exposed) |
| `created_at`     | timestamptz | Creation timestamp              |

**Security:** This table has RLS with service_role only access. Keys are never exposed to authenticated users or the frontend.

### View: `messages_decrypted`

A read-only view that transparently decrypts message content:

```sql
SELECT
  id, family_id, sender_id, recipient_id,
  CASE
    WHEN is_encrypted THEN decrypt_message_content(content_encrypted, encryption_iv, family_id)
    ELSE content
  END AS content,
  read_at, created_at, is_encrypted
FROM messages;
```

Frontend components query this view instead of the `messages` table directly.

---

## Helper Functions

These `SECURITY DEFINER` functions bypass RLS to safely retrieve user context.

**Note:** All helper functions have `GRANT EXECUTE ON FUNCTION ... TO authenticated;` to allow authenticated users to call them.

### `get_user_family_id()`

Returns the current user's family ID. Supports both regular and PIN users.

```sql
CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS uuid AS $$
  SELECT family_id FROM family_members
  WHERE user_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `is_family_admin()`

Returns whether the current user is an admin in their family.

```sql
CREATE OR REPLACE FUNCTION is_family_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM family_members
     WHERE user_id = auth.uid() OR id = auth.uid()
     LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `get_current_member_id()`

Returns the current user's member ID. Supports both regular and PIN users.

```sql
CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS uuid AS $$
  SELECT id FROM family_members
  WHERE user_id = auth.uid() OR id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `generate_invite_code()`

Generates unique 8-character invite codes.

```sql
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text AS $$
  -- Generates code from: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
  -- Excludes ambiguous characters: 0, O, 1, I
$$ LANGUAGE plpgsql;
```

### `generate_child_invite_code()`

Generates unique child invite codes with collision checking.

---

## RLS Policies by Table

### `families`

| Operation | Policy Name                              | Rule                                                   |
| --------- | ---------------------------------------- | ------------------------------------------------------ |
| SELECT    | Users can view their own family          | `created_by = auth.uid() OR id = get_user_family_id()` |
| INSERT    | Authenticated users can create a family  | `true` (any authenticated user)                        |
| UPDATE    | Family admins can update family settings | `id = get_user_family_id() AND is_family_admin()`      |

### `family_members`

| Operation          | Policy Name                                     | Rule                                                                    |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| SELECT             | Family members can view members in their family | `family_id = get_user_family_id()`                                      |
| INSERT             | Users can insert members to own family          | `family_id IS NULL OR family_id = get_user_family_id() OR first member` |
| UPDATE (non-admin) | Members can update own profile                  | `(user_id = auth.uid() OR id = auth.uid()) AND NOT is_family_admin()`   |
| UPDATE (admin)     | Admins can update family members                | `family_id = get_user_family_id() AND is_family_admin()`                |
| DELETE             | Admins can delete family members                | `family_id = get_user_family_id() AND is_family_admin()`                |

**Note:** Non-admin updates are further restricted by the `protect_family_member_fields` trigger - see [Security Triggers](#security-triggers).

### `tasks`

**Role-Based UPDATE Policies:**

| Operation          | Policy Name                                | Rule                                                                                                                              |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| SELECT             | Family members can view tasks              | `family_id = get_user_family_id() AND (is_family_admin() OR assigned_to = self OR assigned_to IS NULL OR created_by = self)`      |
| INSERT             | Family members can create tasks            | `family_id = get_user_family_id()`                                                                                                |
| UPDATE (non-admin) | Members can update own or unassigned tasks | `family_id = get_user_family_id() AND NOT is_family_admin() AND (assigned_to = self OR assigned_to IS NULL OR created_by = self)` |
| UPDATE (admin)     | Admins can update any family task          | `family_id = get_user_family_id() AND is_family_admin()`                                                                          |
| DELETE             | Admins can delete tasks                    | `family_id = get_user_family_id() AND is_family_admin()`                                                                          |

**Child Visibility Restrictions:**

Children can only see:

- Tasks assigned to them
- Unassigned tasks (claimable)
- Tasks they created

Admins see all family tasks.

**Note:** Non-admin updates are further restricted by the `protect_task_fields` trigger - see [Security Triggers](#security-triggers).

### `achievements`

| Operation | Policy Name                           | Rule                                                                            |
| --------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| SELECT    | Users can view achievements           | `family_id IS NULL OR family_id = get_user_family_id()`                         |
| INSERT    | Admins can create custom achievements | `family_id IS NULL OR (family_id = get_user_family_id() AND is_family_admin())` |

**Note:** Global achievements have `family_id = NULL` and are visible to all authenticated users.

### `user_achievements`

| Operation | Policy Name                                      | Rule                                                                                  |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| SELECT    | Family members can view user achievements        | `member_id IN (SELECT id FROM family_members WHERE family_id = get_user_family_id())` |
| INSERT    | Users can create achievements for family members | `member_id IN (SELECT id FROM family_members WHERE family_id = get_user_family_id())` |

### `points_history`

| Operation | Policy Name                            | Rule                               |
| --------- | -------------------------------------- | ---------------------------------- |
| SELECT    | Family members can view points history | `family_id = get_user_family_id()` |
| INSERT    | System can create points history       | `family_id = get_user_family_id()` |

### `weekly_goals`

| Operation | Policy Name                            | Rule                               |
| --------- | -------------------------------------- | ---------------------------------- |
| SELECT    | Family members can view weekly goals   | `family_id = get_user_family_id()` |
| INSERT    | Family members can create weekly goals | `family_id = get_user_family_id()` |
| UPDATE    | Family members can update weekly goals | `family_id = get_user_family_id()` |

### `weekly_earnings`

| Operation | Policy Name                               | Rule                               |
| --------- | ----------------------------------------- | ---------------------------------- |
| SELECT    | Users can view own family weekly earnings | `family_id = get_user_family_id()` |
| INSERT    | Admins can insert weekly earnings         | Admin check via subquery           |
| UPDATE    | Admins can update weekly earnings         | Admin check via subquery           |

### `manual_points_awards`

| Operation | Policy Name                           | Rule                                                     |
| --------- | ------------------------------------- | -------------------------------------------------------- |
| SELECT    | Family members can view points awards | `family_id = get_user_family_id()`                       |
| INSERT    | Family admins can award points        | `family_id = get_user_family_id() AND is_family_admin()` |

### `reward_redemptions`

| Operation | Policy Name                          | Rule                                                     |
| --------- | ------------------------------------ | -------------------------------------------------------- |
| SELECT    | Family members can view redemptions  | `family_id = get_user_family_id()`                       |
| INSERT    | **(Blocked)** Direct INSERT disabled | Requires `request-redemption` Edge Function              |
| UPDATE    | Family admins can update redemptions | `family_id = get_user_family_id() AND is_family_admin()` |

**Important Notes:**

- **Server-Side Validation**: All redemption requests must go through the `request-redemption` Edge Function. This provides atomic validation of available points and prevents:
  - Direct API abuse (bypassing UI)
  - Race conditions (parallel requests)
  - Over-redemption (requesting more points than available)
- **Points Deduction**: Points are deducted **on approval** (not on request) in `RedemptionManager.tsx`. This allows children to make requests before commitment but requires admin review.
- Children can view their own pending/approved redemptions to see reserved points.
- Rate limited to 10 requests per hour per client IP.

### `task_history`

| Operation | Policy Name                           | Rule                                                     |
| --------- | ------------------------------------- | -------------------------------------------------------- |
| SELECT    | Family members can view task history  | `family_id = get_user_family_id()`                       |
| INSERT    | Family admins can insert task history | `family_id = get_user_family_id() AND is_family_admin()` |

### `family_objects`

| Operation | Policy Name                      | Rule                               |
| --------- | -------------------------------- | ---------------------------------- |
| SELECT    | Users can view family objects    | `family_id = get_user_family_id()` |
| INSERT    | Admins can create family objects | Admin check via subquery           |
| UPDATE    | Admins can update family objects | Admin check via subquery           |
| DELETE    | Admins can delete family objects | Admin check via subquery           |

### `messages`

| Operation | Policy Name                          | Rule                                                                                                                          |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| SELECT    | Family members can view messages     | `family_id = get_user_family_id() AND (recipient_id IS NULL OR sender_id = self OR recipient_id = self OR is_family_admin())` |
| INSERT    | **(Blocked)** Direct INSERT disabled | Requires `send-message` Edge Function for encryption                                                                          |
| UPDATE    | Recipients can update messages       | `recipient_id = self OR (recipient_id IS NULL AND in family)`                                                                 |
| DELETE    | Admins or sender can delete messages | `(family_id = get_user_family_id() AND is_family_admin()) OR sender_id = self`                                                |

**Important:** All message creation must go through the `send-message` Edge Function to ensure proper encryption. Direct INSERT is not available to clients.

### `family_encryption_keys`

| Operation | Policy Name       | Rule                                |
| --------- | ----------------- | ----------------------------------- |
| ALL       | Service role only | Only `service_role` can access keys |

**Critical Security:** This table is completely locked down. Encryption keys are never exposed to authenticated users or the frontend. All encryption/decryption happens via `SECURITY DEFINER` functions that bypass RLS.

---

## Security Triggers

### `enforce_child_task_defaults_trigger`

**Table:** `tasks` (BEFORE INSERT)

Ensures child-created tasks have enforced defaults:

- `point_value` = 5 (not client-provided value)
- `priority` = 'medium'
- `creation_approved` = false

```sql
CREATE OR REPLACE FUNCTION enforce_child_task_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_family_admin() THEN
      NEW.point_value := 5;
      NEW.priority := 'medium';
      NEW.creation_approved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `protect_family_member_fields_trigger`

**Table:** `family_members` (BEFORE UPDATE)

Prevents non-admins from modifying sensitive fields:

| Protected Field | Reason                                     |
| --------------- | ------------------------------------------ |
| `is_admin`      | Prevent privilege escalation               |
| `role`          | Prevent role change                        |
| `user_id`       | Prevent account hijacking                  |
| `pin_hash`      | Prevent PIN change without proper flow     |
| `total_points`  | Points must be awarded through proper flow |
| `current_level` | Level is calculated from points            |
| `family_id`     | Prevent family switching                   |

### `protect_task_fields_trigger`

**Table:** `tasks` (BEFORE UPDATE)

Prevents non-admins from modifying sensitive task fields:

| Protected Field     | Reason                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `creation_approved` | Only admins can approve task creation                                                          |
| `approved_by`       | Only admins can approve completion                                                             |
| `point_value`       | Only admins can change point values                                                            |
| `priority`          | Only admins can change priority                                                                |
| `assigned_to`       | Non-admins can only: (1) claim unassigned tasks for themselves, or (2) unclaim their own tasks |

**Assignment Rules for Non-Admins:**

| Scenario             | Old Value | New Value | Allowed?                      |
| -------------------- | --------- | --------- | ----------------------------- |
| Claim unassigned     | NULL      | self      | ✅ Yes                        |
| Unclaim own task     | self      | NULL      | ✅ Yes                        |
| Reassign to other    | self      | other     | ❌ No                         |
| Assign for other     | NULL      | other     | ❌ No                         |
| Unclaim other's task | other     | NULL      | ❌ No (RLS blocks visibility) |

---

## Storage Buckets

### `avatars-public`

Public bucket for profile pictures.

| Setting            | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Public             | Yes                                                     |
| Max File Size      | 2MB (2097152 bytes)                                     |
| Allowed MIME Types | image/jpeg, image/jpg, image/png, image/webp, image/gif |

**Storage Structure:** `{user_id or member_id}/avatar.{ext}`

| Operation | Policy Name                 | Rule                                                                                |
| --------- | --------------------------- | ----------------------------------------------------------------------------------- |
| SELECT    | Public read access          | `bucket_id = 'avatars-public'`                                                      |
| INSERT    | Users can upload own avatar | `bucket_id = 'avatars-public' AND (storage.foldername(name))[1] = auth.uid()::text` |
| UPDATE    | Users can update own avatar | `bucket_id = 'avatars-public' AND (storage.foldername(name))[1] = auth.uid()::text` |
| DELETE    | Users can delete own avatar | `bucket_id = 'avatars-public' AND (storage.foldername(name))[1] = auth.uid()::text` |

### `family-objects`

Public bucket for family object images.

**Storage Structure:** `{family_id}/{object_id}.{ext}`

| Operation | Policy Name        | Rule                                |
| --------- | ------------------ | ----------------------------------- |
| SELECT    | Public read access | `bucket_id = 'family-objects'`      |
| INSERT    | Admins can upload  | Folder must match admin's family_id |
| UPDATE    | Admins can update  | Folder must match admin's family_id |
| DELETE    | Admins can delete  | Folder must match admin's family_id |

---

## Security Considerations

### PIN User Authentication

1. PIN users authenticate via Edge Function `pin-login`
2. Custom JWT is issued with `sub` claim set to `member_id`
3. RLS policies check both `user_id = auth.uid()` AND `id = auth.uid()` to support both auth types

### Preventing Infinite Recursion

The `family_members` table's RLS policies could cause infinite recursion when the SELECT policy queries the same table. This is solved by:

1. Using `SECURITY DEFINER` functions (`get_user_family_id()`, `is_family_admin()`, `get_current_member_id()`)
2. These functions bypass RLS to safely lookup the current user's family

### Role-Based Access Control

| Role                              | Capabilities                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** (is_admin = true)       | Full CRUD on tasks, manage members, approve completions, award/deduct points, manage redemptions, see all family tasks                               |
| **Member** (is_admin = false)     | View own/unassigned tasks, create tasks (pending approval), complete tasks (pending approval), update own profile (avatar only), request redemptions |
| **PIN User** (is_pin_user = true) | Same as Member, but authenticated via PIN instead of email                                                                                           |

### Field-Level Protection

Beyond RLS policies, database triggers provide field-level protection:

1. **Non-admins cannot modify:**
   - Their own `is_admin`, `role`, `user_id`, `pin_hash`, `total_points`, `current_level`, `family_id`
   - Task `creation_approved`, `approved_by`, `point_value`, `priority`
   - Task `assigned_to` (except claiming unassigned tasks for themselves)

2. **Child-created tasks are enforced:**
   - Default 5 points (server-enforced, not client value)
   - Default medium priority
   - Always require approval (`creation_approved = false`)

### Child Visibility Restrictions

Children cannot see tasks assigned to other family members (e.g., siblings). They can only see:

- Tasks assigned to themselves
- Unassigned/claimable tasks
- Tasks they created

This prevents children from seeing each other's workload and provides privacy within the family.

### Data Isolation

All RLS policies ensure:

- Users can only access data for their own family
- Family membership is verified via `get_user_family_id()`
- Admin actions require `is_family_admin()` check
- Cross-family access is completely blocked

### Edge Functions

Sensitive operations are handled by Edge Functions with `SUPABASE_SERVICE_ROLE_KEY`:

| Function                | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `create-child`          | Creates PIN user accounts (hashes PIN, generates invite code) |
| `pin-login`             | Authenticates PIN users and issues JWTs                       |
| `join-family`           | Validates invite codes and creates member records             |
| `join-family-as-parent` | Joins as admin using parent invite code                       |
| `toggle-admin`          | Promotes/demotes admin status with protection                 |
| `award-birthday-points` | Awards birthday bonus points (can be cron or admin-triggered) |
| `deduct-points`         | Admin-only point deduction with audit trail                   |
| `request-redemption`    | Creates redemption requests with server-side validation       |
| `send-message`          | Encrypts and stores messages (supports regular + PIN users)   |

---

## Indexes

The following indexes optimize RLS policy performance:

```sql
-- family_members
CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_user_id ON family_members(user_id);
CREATE INDEX idx_family_members_child_invite_code ON family_members(child_invite_code);
CREATE INDEX idx_family_members_birthdate ON family_members(EXTRACT(MONTH FROM birthdate), EXTRACT(DAY FROM birthdate));

-- tasks
CREATE INDEX idx_tasks_family_id ON tasks(family_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);

-- messages
CREATE INDEX idx_messages_family ON messages(family_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(recipient_id, read_at) WHERE read_at IS NULL;

-- Other tables
CREATE INDEX idx_achievements_family ON achievements(family_id);
CREATE INDEX idx_user_achievements_member ON user_achievements(member_id);
CREATE INDEX idx_points_history_member ON points_history(member_id);
CREATE INDEX idx_weekly_goals_member ON weekly_goals(member_id);
CREATE INDEX idx_manual_points_family ON manual_points_awards(family_id);
CREATE INDEX idx_redemptions_family ON reward_redemptions(family_id);
CREATE INDEX idx_task_history_family ON task_history(family_id);
```

---

## Changelog

### 2026-01-25: Per-Family Message Encryption

**Message Encryption at Rest (20260125000000_add_message_encryption.sql):**

| Change                         | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `family_encryption_keys` table | Stores per-family 256-bit AES keys (service role only RLS) |
| `messages` encryption columns  | Added `content_encrypted`, `encryption_iv`, `is_encrypted` |
| `messages_decrypted` view      | Transparently decrypts content for authorized users        |
| `send-message` Edge Function   | Encrypts messages server-side before storage               |
| Auto-key generation trigger    | Creates encryption key when new family is created          |
| Existing message migration     | Automatically encrypts pre-existing plaintext messages     |

**Security Functions (SECURITY DEFINER):**

| Function                       | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `create_family_encryption_key` | Generates 256-bit AES key for family         |
| `encrypt_message_content`      | Encrypts content with AES-256-CBC            |
| `decrypt_message_content`      | Decrypts content (callable by authenticated) |
| `insert_encrypted_message`     | Atomic encrypt + insert (service role only)  |

**Security Properties:**

- Keys never exposed to frontend or authenticated users
- AES-256-CBC encryption with random IV per message
- Database breach only exposes ciphertext
- RLS still enforces family isolation on encrypted data

### 2026-01-24: Server-Side Redemption Protection

**Secure Redemption via Edge Function (20260124120000_secure_redemption_via_edge.sql):**

| Change                             | Description                                                              |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `request-redemption` Edge Function | New function handles all redemption requests with server-side validation |
| INSERT policy removed              | Direct client INSERT to `reward_redemptions` blocked                     |
| Server-side validation             | Atomic check of available points (`total_points - pending - approved`)   |
| Race condition prevention          | Database-level protection against parallel requests                      |
| Rate limiting                      | 10 requests per hour per client IP                                       |

**Security Improvements:**

- Prevents over-redemption through direct API calls
- Validates minimum redemption amount
- Checks if rewards are enabled for family
- Verifies account is not disabled
- Supports both regular and PIN user authentication

### 2026-01-24: Child Rewards Redemption & Task Unclaim

**Child Rewards Access:**

| Addition                     | Description                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| Child Rewards View           | Mobile-friendly interface for children to request point redemptions |
| Available Points Calculation | UI calculates `total - pending` to prevent over-redemption          |
| Conditional Tab Visibility   | Rewards tab shown only when `family.point_to_money_rate > 0`        |

**Security Considerations:**

- No database-level constraint prevents duplicate requests (application-enforced)
- Points deducted on approval, not on request creation
- Children can see pending/approved status of their own requests

**Task Unclaim Feature (20260124110000_allow_unclaim_own_task.sql):**

| Change                                | Description                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `protect_task_fields` trigger updated | Non-admins can now unclaim their own tasks by setting `assigned_to` to NULL |
| Unclaim own task                      | Allowed when `OLD.assigned_to = self` AND `NEW.assigned_to IS NULL`         |
| Security preserved                    | Cannot unclaim tasks assigned to others (RLS blocks visibility anyway)      |

### 2026-01-22: Security Tightening & Schema Additions

**RLS Security Fixes (20260122082024_fix_rls_security_issues.sql):**

| Issue                                                                                         | Fix                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `user_achievements` INSERT allowed any authenticated user to award achievements to ANY member | Restricted to same-family members via `get_user_family_id()`     |
| `avatars-public` storage allowed any user to upload/update/delete ANY avatar                  | Restricted to own folder using `auth.uid()` path matching        |
| `family_objects` SELECT used raw JWT parsing                                                  | Replaced with `get_user_family_id()` helper for consistency      |
| `weekly_earnings` SELECT used direct subquery                                                 | Replaced with `get_user_family_id()` helper for PIN user support |

**RLS Security Tightening (20260122090000_rls_security_tightening.sql):**

| Change                                 | Description                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Task UPDATE policies split by role     | Non-admins limited to own/unassigned/created tasks; admins have full access             |
| Task SELECT child visibility           | Children can only see their own, unassigned, or self-created tasks                      |
| Family members UPDATE split            | Non-admins restricted to own profile; admins can update any family member               |
| Family members INSERT validated        | Users can only insert to their own family or create first member                        |
| `enforce_child_task_defaults` trigger  | Forces 5 points, medium priority, `creation_approved=false` for child tasks             |
| `protect_family_member_fields` trigger | Prevents non-admins from modifying sensitive fields (admin status, points, level, etc.) |
| `protect_task_fields` trigger          | Prevents non-admins from approving tasks, changing points/priority, or reassigning      |
| `get_current_member_id()` helper       | New function to retrieve current member ID for both auth types                          |

**Schema Additions (20260122091000_schema_additions.sql):**

| Addition                    | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `family_members.birthdate`  | Date column for birthday bonus feature                             |
| `families.default_language` | Default language setting for family (e.g., 'en', 'nl')             |
| `messages` table            | Family messaging system with sender/recipient, broadcast support   |
| Messages RLS policies       | Family-scoped with visibility rules for private/broadcast messages |
| Birthday index              | Optimized month-day lookups for birthday queries                   |

### 2026-01-21: Family Objects Feature

**Family Objects (20260121110000_add_family_objects.sql):**

| Addition                        | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `family_objects` table          | Custom objects/tags with images for task association         |
| `family-objects` storage bucket | Public bucket for family object images                       |
| RLS policies                    | Admins can CRUD; all family members can view                 |
| Storage policies                | Admins can upload to their family folder; public read access |
