import { describe, it, expect } from 'vitest';
import {
  generateRecurrenceDates,
  countRecurringInstances,
  getRecurrenceDescription,
  validateRecurrenceConfig,
  type RecurrenceConfig,
} from './recurrence';

describe('generateRecurrenceDates', () => {
  it('returns empty array when pattern is null', () => {
    const config: RecurrenceConfig = {
      pattern: null,
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };
    expect(generateRecurrenceDates(config)).toEqual([]);
  });

  it('returns empty array when endDate is not provided', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: undefined as unknown as Date,
    };
    expect(generateRecurrenceDates(config)).toEqual([]);
  });

  it('returns empty array when endDate is before startDate', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-01'),
    };
    expect(generateRecurrenceDates(config)).toEqual([]);
  });

  describe('daily pattern', () => {
    it('generates dates for every day', () => {
      const startDate = new Date('2024-01-01T12:00:00');
      const endDate = new Date('2024-01-05T12:00:00');
      const config: RecurrenceConfig = {
        pattern: 'daily',
        days: [],
        startDate,
        endDate,
      };
      const dates = generateRecurrenceDates(config);
      expect(dates).toHaveLength(5);
      // First date should be same day as start, last should be same day as end
      expect(dates[0].getDate()).toBe(startDate.getDate());
      expect(dates[4].getDate()).toBe(endDate.getDate());
    });

    it('handles single day range', () => {
      const config: RecurrenceConfig = {
        pattern: 'daily',
        days: [],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
      };
      const dates = generateRecurrenceDates(config);
      expect(dates).toHaveLength(1);
    });
  });

  describe('weekly pattern', () => {
    it('generates dates for same weekday only', () => {
      // January 1, 2024 is a Monday
      const config: RecurrenceConfig = {
        pattern: 'weekly',
        days: [],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      const dates = generateRecurrenceDates(config);
      // Mondays in January 2024: 1, 8, 15, 22, 29
      expect(dates).toHaveLength(5);
      dates.forEach((date) => {
        expect(date.getDay()).toBe(1); // Monday
      });
    });
  });

  describe('specific_days pattern', () => {
    it('generates dates for specified days only', () => {
      const config: RecurrenceConfig = {
        pattern: 'specific_days',
        days: [1, 3, 5], // Mon, Wed, Fri
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      };
      const dates = generateRecurrenceDates(config);
      dates.forEach((date) => {
        expect([1, 3, 5]).toContain(date.getDay());
      });
    });

    it('returns empty for specific_days with empty days array', () => {
      const config: RecurrenceConfig = {
        pattern: 'specific_days',
        days: [],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      const dates = generateRecurrenceDates(config);
      expect(dates).toHaveLength(0);
    });
  });

  it('limits to MAX_INSTANCES (365)', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-01-01'), // More than 365 days
    };
    const dates = generateRecurrenceDates(config);
    expect(dates).toHaveLength(365);
  });
});

describe('countRecurringInstances', () => {
  it('returns the count of dates generated', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-10'),
    };
    expect(countRecurringInstances(config)).toBe(10);
  });

  it('returns 0 for null pattern', () => {
    const config: RecurrenceConfig = {
      pattern: null,
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-10'),
    };
    expect(countRecurringInstances(config)).toBe(0);
  });
});

describe('getRecurrenceDescription', () => {
  it('returns "Every day" for daily pattern', () => {
    expect(getRecurrenceDescription('daily')).toBe('Every day');
  });

  it('returns "Every week" for weekly pattern', () => {
    expect(getRecurrenceDescription('weekly')).toBe('Every week');
  });

  it('returns "One time" for null pattern', () => {
    expect(getRecurrenceDescription(null)).toBe('One time');
  });

  describe('specific_days pattern', () => {
    it('returns formatted day names', () => {
      expect(getRecurrenceDescription('specific_days', [1, 3, 5])).toBe(
        'Every Mon, Wed, Fri'
      );
    });

    it('returns "No days selected" when days array is empty', () => {
      expect(getRecurrenceDescription('specific_days', [])).toBe(
        'No days selected'
      );
    });

    it('returns "No days selected" when days is undefined', () => {
      expect(getRecurrenceDescription('specific_days', undefined)).toBe(
        'No days selected'
      );
    });

    it('sorts days correctly', () => {
      expect(getRecurrenceDescription('specific_days', [5, 1, 3])).toBe(
        'Every Mon, Wed, Fri'
      );
    });

    it('handles weekend days', () => {
      expect(getRecurrenceDescription('specific_days', [0, 6])).toBe(
        'Every Sun, Sat'
      );
    });
  });
});

describe('validateRecurrenceConfig', () => {
  it('returns null for null pattern (valid - no recurrence)', () => {
    const config: RecurrenceConfig = {
      pattern: null,
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };
    expect(validateRecurrenceConfig(config)).toBeNull();
  });

  it('returns error when endDate is missing', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: undefined as unknown as Date,
    };
    expect(validateRecurrenceConfig(config)).toBe(
      'End date is required for recurring tasks'
    );
  });

  it('returns error when endDate is before or equal to startDate', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-01'),
    };
    expect(validateRecurrenceConfig(config)).toBe(
      'End date must be after start date'
    );
  });

  it('returns error when endDate is equal to startDate', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-15'),
    };
    expect(validateRecurrenceConfig(config)).toBe(
      'End date must be after start date'
    );
  });

  it('returns error when duration exceeds 1 year', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-15'),
    };
    expect(validateRecurrenceConfig(config)).toBe(
      'Recurring tasks can be created for at most 1 year'
    );
  });

  it('returns error for specific_days with empty days array', () => {
    const config: RecurrenceConfig = {
      pattern: 'specific_days',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };
    expect(validateRecurrenceConfig(config)).toBe(
      'At least one day must be selected'
    );
  });

  it('returns null for valid daily config', () => {
    const config: RecurrenceConfig = {
      pattern: 'daily',
      days: [],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-01'),
    };
    expect(validateRecurrenceConfig(config)).toBeNull();
  });

  it('returns null for valid specific_days config', () => {
    const config: RecurrenceConfig = {
      pattern: 'specific_days',
      days: [1, 3, 5],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-06-01'),
    };
    expect(validateRecurrenceConfig(config)).toBeNull();
  });
});
