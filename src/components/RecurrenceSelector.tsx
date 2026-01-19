import { useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Repeat, Calendar, Info } from 'lucide-react';
import type { RecurrencePattern } from '../lib/recurrence';
import { countRecurringInstances, getRecurrenceDescription } from '../lib/recurrence';

interface RecurrenceSelectorProps {
  pattern: RecurrencePattern;
  onPatternChange: (pattern: RecurrencePattern) => void;
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  startDate: Date;
}

const PATTERN_KEYS: { value: RecurrencePattern; key: string }[] = [
  { value: null, key: 'oneTime' },
  { value: 'daily', key: 'daily' },
  { value: 'weekly', key: 'weekly' },
  { value: 'specific_days', key: 'specificDays' },
];

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function RecurrenceSelector({
  pattern,
  onPatternChange,
  selectedDays,
  onDaysChange,
  endDate,
  onEndDateChange,
  startDate,
}: RecurrenceSelectorProps) {
  const { t } = useTranslation('tasks');

  const instanceCount = useMemo(() => {
    if (!pattern || !endDate) return 0;
    return countRecurringInstances({
      pattern,
      days: selectedDays,
      endDate: new Date(endDate),
      startDate,
    });
  }, [pattern, selectedDays, endDate, startDate]);

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter(d => d !== day));
    } else {
      onDaysChange([...selectedDays, day]);
    }
  };

  // Get minimum end date (tomorrow)
  const minEndDate = useMemo(() => {
    const tomorrow = new Date(startDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, [startDate]);

  // Get maximum end date (1 year from start)
  const maxEndDate = useMemo(() => {
    const oneYear = new Date(startDate);
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    return oneYear.toISOString().split('T')[0];
  }, [startDate]);

  return (
    <div className="space-y-4">
      {/* Pattern selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Repeat className="w-4 h-4 inline mr-1" />
          {t('recurrence.repeat')}
        </label>
        <div className="flex flex-wrap gap-2">
          {PATTERN_KEYS.map(({ value, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => onPatternChange(value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${pattern === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {t(`recurrence.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Day selection (for specific_days pattern) */}
      {pattern === 'specific_days' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('recurrence.selectDays')}
          </label>
          <div className="flex gap-1">
            {WEEKDAY_KEYS.map((key, index) => (
              <button
                key={index}
                type="button"
                onClick={() => toggleDay(index)}
                className={`w-10 h-10 rounded-full text-sm font-medium transition-colors
                  ${selectedDays.includes(index)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {t(`recurrence.weekdays.${key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* End date picker (required when recurrence is enabled) */}
      {pattern && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            {t('recurrence.endDate')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            min={minEndDate}
            max={maxEndDate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>
      )}

      {/* Preview count */}
      {pattern && endDate && instanceCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg text-sm">
          <Info className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span className="text-purple-800">
            <Trans
              i18nKey="tasks:recurrence.willCreate"
              count={instanceCount}
              components={{ strong: <strong /> }}
            />{' '}
            ({getRecurrenceDescription(pattern, selectedDays)})
          </span>
        </div>
      )}

      {/* Warning if no instances */}
      {pattern && endDate && instanceCount === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-sm">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">
            {t('recurrence.noTasksCreated')}
          </span>
        </div>
      )}
    </div>
  );
}
