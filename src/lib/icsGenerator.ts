/**
 * ICS (iCalendar) Generator
 * Generates .ics files for tasks that can be imported into any calendar app
 * (Apple Calendar, Google Calendar, Outlook, etc.)
 */

import type { Task, FamilyMember } from '../types';

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format date to ICS date format (YYYYMMDD)
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format date to ICS UTC datetime format
 */
function formatICSDateTimeUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a unique identifier for the event
 */
function generateUID(taskId: string): string {
  return `${taskId}@taskaroo.family`;
}

interface GenerateICSOptions {
  task: Task;
  assignee?: FamilyMember | null;
  createdBy?: FamilyMember | null;
  includeReminder?: boolean;
  reminderMinutesBefore?: number;
}

/**
 * Generate ICS content for a single task
 */
export function generateTaskICS({
  task,
  assignee,
  createdBy,
  includeReminder = true,
  reminderMinutesBefore = 60,
}: GenerateICSOptions): string {
  const now = new Date();
  const uid = generateUID(task.id);

  // Determine the event date/time
  let dtStart: string;
  let dtEnd: string;
  let isAllDay = false;

  if (task.due_datetime) {
    // Task has a specific time
    const dueDate = new Date(task.due_datetime);
    dtStart = formatICSDateTimeUTC(dueDate);
    // Set end time to 1 hour after start by default
    const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);
    dtEnd = formatICSDateTimeUTC(endDate);
  } else if (task.due_date) {
    // All-day event
    const dueDate = new Date(task.due_date + 'T00:00:00');
    dtStart = formatICSDate(dueDate);
    // For all-day events, end date is the next day
    const endDate = new Date(dueDate);
    endDate.setDate(endDate.getDate() + 1);
    dtEnd = formatICSDate(endDate);
    isAllDay = true;
  } else {
    // No date specified, use today
    dtStart = formatICSDate(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dtEnd = formatICSDate(tomorrow);
    isAllDay = true;
  }

  // Build description
  const descriptionParts: string[] = [];
  if (task.description) {
    descriptionParts.push(task.description);
  }
  if (assignee) {
    descriptionParts.push(`Assigned to: ${assignee.name}`);
  }
  if (createdBy) {
    descriptionParts.push(`Created by: ${createdBy.name}`);
  }
  descriptionParts.push(`Points: ${task.point_value}`);
  descriptionParts.push(`Priority: ${task.priority}`);

  const description = escapeICS(descriptionParts.join('\\n'));
  const summary = escapeICS(task.title);

  // Build the ICS event
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Taskaroo//Family Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateTimeUTC(now)}`,
  ];

  // Add date/time
  if (isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
  } else {
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
  }

  lines.push(`SUMMARY:${summary}`);

  if (description) {
    lines.push(`DESCRIPTION:${description}`);
  }

  // Add priority (ICS priority: 1-4 high, 5 medium, 6-9 low)
  const priorityMap: Record<string, number> = {
    high: 1,
    medium: 5,
    low: 9,
  };
  lines.push(`PRIORITY:${priorityMap[task.priority] || 5}`);

  // Add reminder/alarm
  if (includeReminder && !isAllDay) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Task reminder: ${summary}`);
    lines.push(`TRIGGER:-PT${reminderMinutesBefore}M`);
    lines.push('END:VALARM');
  }

  // Add categories based on associated items
  if (task.associated_items && task.associated_items.length > 0) {
    lines.push(`CATEGORIES:${task.associated_items.map(escapeICS).join(',')}`);
  }

  // Add status
  const statusMap: Record<string, string> = {
    pending: 'NEEDS-ACTION',
    pending_approval: 'IN-PROCESS',
    completed: 'COMPLETED',
    in_progress: 'IN-PROCESS',
  };
  lines.push(`STATUS:${statusMap[task.status] || 'NEEDS-ACTION'}`);

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

interface GenerateMultipleICSOptions {
  tasks: Task[];
  members?: FamilyMember[];
  includeReminder?: boolean;
  reminderMinutesBefore?: number;
}

/**
 * Generate ICS content for multiple tasks
 */
export function generateMultipleTasksICS({
  tasks,
  members = [],
  includeReminder = true,
  reminderMinutesBefore = 60,
}: GenerateMultipleICSOptions): string {
  const now = new Date();
  const memberMap = new Map(members.map(m => [m.id, m]));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Taskaroo//Family Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Family Tasks',
  ];

  for (const task of tasks) {
    const assignee = task.assigned_to ? memberMap.get(task.assigned_to) : null;
    const createdBy = task.created_by ? memberMap.get(task.created_by) : null;

    const uid = generateUID(task.id);

    // Determine the event date/time
    let dtStart: string;
    let dtEnd: string;
    let isAllDay = false;

    if (task.due_datetime) {
      const dueDate = new Date(task.due_datetime);
      dtStart = formatICSDateTimeUTC(dueDate);
      const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);
      dtEnd = formatICSDateTimeUTC(endDate);
    } else if (task.due_date) {
      const dueDate = new Date(task.due_date + 'T00:00:00');
      dtStart = formatICSDate(dueDate);
      const endDate = new Date(dueDate);
      endDate.setDate(endDate.getDate() + 1);
      dtEnd = formatICSDate(endDate);
      isAllDay = true;
    } else {
      continue; // Skip tasks without dates
    }

    // Build description
    const descriptionParts: string[] = [];
    if (task.description) {
      descriptionParts.push(task.description);
    }
    if (assignee) {
      descriptionParts.push(`Assigned to: ${assignee.name}`);
    }
    if (createdBy) {
      descriptionParts.push(`Created by: ${createdBy.name}`);
    }
    descriptionParts.push(`Points: ${task.point_value}`);
    descriptionParts.push(`Priority: ${task.priority}`);

    const description = escapeICS(descriptionParts.join('\\n'));
    const summary = escapeICS(task.title);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICSDateTimeUTC(now)}`);

    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }

    lines.push(`SUMMARY:${summary}`);

    if (description) {
      lines.push(`DESCRIPTION:${description}`);
    }

    const priorityMap: Record<string, number> = {
      high: 1,
      medium: 5,
      low: 9,
    };
    lines.push(`PRIORITY:${priorityMap[task.priority] || 5}`);

    if (includeReminder && !isAllDay) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Task reminder: ${summary}`);
      lines.push(`TRIGGER:-PT${reminderMinutesBefore}M`);
      lines.push('END:VALARM');
    }

    if (task.associated_items && task.associated_items.length > 0) {
      lines.push(`CATEGORIES:${task.associated_items.map(escapeICS).join(',')}`);
    }

    const statusMap: Record<string, string> = {
      pending: 'NEEDS-ACTION',
      pending_approval: 'IN-PROCESS',
      completed: 'COMPLETED',
      in_progress: 'IN-PROCESS',
    };
    lines.push(`STATUS:${statusMap[task.status] || 'NEEDS-ACTION'}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Download ICS content as a file
 */
export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a single task as ICS
 */
export function downloadTaskICS(task: Task, assignee?: FamilyMember | null, createdBy?: FamilyMember | null): void {
  const content = generateTaskICS({ task, assignee, createdBy });
  const sanitizedTitle = task.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  downloadICS(content, `task_${sanitizedTitle}.ics`);
}

/**
 * Download multiple tasks as a single ICS file
 */
export function downloadMultipleTasksICS(tasks: Task[], members?: FamilyMember[], filename?: string): void {
  const content = generateMultipleTasksICS({ tasks, members });
  downloadICS(content, filename || 'family_tasks.ics');
}
