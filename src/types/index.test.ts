import { describe, it, expect } from 'vitest';
import {
  calculateLevel,
  getPointsForNextLevel,
  getPaletteColors,
  LEVEL_THRESHOLDS,
  COLOR_PALETTES,
  COLORS,
  PRIORITY_CONFIG,
} from './index';

describe('calculateLevel', () => {
  it('returns level 1 for 0 points', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('returns level 1 for negative points', () => {
    expect(calculateLevel(-100)).toBe(1);
  });

  it('returns level 2 for 100 points (exact threshold)', () => {
    expect(calculateLevel(100)).toBe(2);
  });

  it('returns level 2 for 150 points (between thresholds)', () => {
    expect(calculateLevel(150)).toBe(2);
  });

  it('returns level 3 for 250 points', () => {
    expect(calculateLevel(250)).toBe(3);
  });

  it('returns level 4 for 500 points', () => {
    expect(calculateLevel(500)).toBe(4);
  });

  it('returns level 5 for 1000 points', () => {
    expect(calculateLevel(1000)).toBe(5);
  });

  it('returns max level for points at max threshold', () => {
    const maxLevel = LEVEL_THRESHOLDS.length;
    const maxThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    expect(calculateLevel(maxThreshold)).toBe(maxLevel);
  });

  it('returns max level for points beyond max threshold', () => {
    const maxLevel = LEVEL_THRESHOLDS.length;
    expect(calculateLevel(999999)).toBe(maxLevel);
  });

  it('calculates correctly for each threshold boundary', () => {
    // Test just below each threshold
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(249)).toBe(2);
    expect(calculateLevel(499)).toBe(3);
    expect(calculateLevel(999)).toBe(4);
  });
});

describe('getPointsForNextLevel', () => {
  it('returns correct values for level 1 user', () => {
    const result = getPointsForNextLevel(50);
    expect(result).toEqual({
      current: 50, // 50 - 0 (level 1 threshold)
      next: 100,   // level 2 threshold
      progress: 50, // 50/100 * 100 = 50%
    });
  });

  it('returns correct values for level 2 user', () => {
    const result = getPointsForNextLevel(150);
    expect(result).toEqual({
      current: 50, // 150 - 100 (level 2 threshold)
      next: 250,   // level 3 threshold
      progress: (50 / 150) * 100, // ~33.33%
    });
  });

  it('returns correct values at exact level threshold', () => {
    const result = getPointsForNextLevel(100);
    expect(result.current).toBe(0); // 100 - 100
    expect(result.next).toBe(250);
    expect(result.progress).toBe(0);
  });

  it('returns 0 progress for 0 points', () => {
    const result = getPointsForNextLevel(0);
    expect(result.current).toBe(0);
    expect(result.next).toBe(100);
    expect(result.progress).toBe(0);
  });

  it('caps progress at 100%', () => {
    // At max level, progress should be capped at 100
    const maxThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const result = getPointsForNextLevel(maxThreshold + 1000);
    expect(result.progress).toBeLessThanOrEqual(100);
  });

  it('handles max level correctly', () => {
    const maxThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const result = getPointsForNextLevel(maxThreshold);
    // At max level, next should still be the max threshold
    expect(result.next).toBe(maxThreshold);
  });
});

describe('getPaletteColors', () => {
  it('returns default palette colors for "default" key', () => {
    const colors = getPaletteColors('default');
    expect(colors).toEqual(COLOR_PALETTES.default.colors);
    expect(colors).toHaveLength(8);
  });

  it('returns soft palette colors', () => {
    const colors = getPaletteColors('soft');
    expect(colors).toEqual(COLOR_PALETTES.soft.colors);
    expect(colors[0]).toBe('#FFD1DC'); // pastel pink
  });

  it('returns neon palette colors', () => {
    const colors = getPaletteColors('neon');
    expect(colors).toEqual(COLOR_PALETTES.neon.colors);
    expect(colors[0]).toBe('#FF00C2'); // magenta
  });

  it('returns default colors for invalid palette key', () => {
    const colors = getPaletteColors('nonexistent');
    expect(colors).toEqual(COLOR_PALETTES.default.colors);
  });

  it('returns default colors for empty string', () => {
    const colors = getPaletteColors('');
    expect(colors).toEqual(COLOR_PALETTES.default.colors);
  });

  it('returns colors for all valid palette keys', () => {
    const paletteKeys = Object.keys(COLOR_PALETTES) as Array<keyof typeof COLOR_PALETTES>;
    paletteKeys.forEach((key) => {
      const colors = getPaletteColors(key);
      expect(colors).toEqual(COLOR_PALETTES[key].colors);
      expect(colors).toHaveLength(8);
    });
  });
});

describe('COLORS constant', () => {
  it('equals default palette colors', () => {
    expect(COLORS).toEqual(COLOR_PALETTES.default.colors);
  });

  it('has 8 colors', () => {
    expect(COLORS).toHaveLength(8);
  });

  it('contains valid hex color codes', () => {
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    COLORS.forEach((color) => {
      expect(color).toMatch(hexColorRegex);
    });
  });
});

describe('LEVEL_THRESHOLDS', () => {
  it('starts at 0', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
  });

  it('is sorted in ascending order', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
    }
  });

  it('has expected length', () => {
    expect(LEVEL_THRESHOLDS.length).toBe(12);
  });

  it('contains expected values', () => {
    expect(LEVEL_THRESHOLDS).toEqual([
      0, 100, 250, 500, 1000, 1500, 2000, 3000, 4500, 6000, 8000, 10000,
    ]);
  });
});

describe('PRIORITY_CONFIG', () => {
  it('has low, medium, and high priorities', () => {
    expect(PRIORITY_CONFIG.low).toBeDefined();
    expect(PRIORITY_CONFIG.medium).toBeDefined();
    expect(PRIORITY_CONFIG.high).toBeDefined();
  });

  it('has correct point values', () => {
    expect(PRIORITY_CONFIG.low.points).toBe(5);
    expect(PRIORITY_CONFIG.medium.points).toBe(10);
    expect(PRIORITY_CONFIG.high.points).toBe(20);
  });

  it('has labels for each priority', () => {
    expect(PRIORITY_CONFIG.low.label).toBe('Low');
    expect(PRIORITY_CONFIG.medium.label).toBe('Medium');
    expect(PRIORITY_CONFIG.high.label).toBe('High');
  });

  it('has color classes for each priority', () => {
    expect(PRIORITY_CONFIG.low.color).toBe('bg-gray-500');
    expect(PRIORITY_CONFIG.medium.color).toBe('bg-blue-500');
    expect(PRIORITY_CONFIG.high.color).toBe('bg-red-500');
  });
});

describe('COLOR_PALETTES', () => {
  it('has 11 palettes', () => {
    expect(Object.keys(COLOR_PALETTES)).toHaveLength(11);
  });

  it('each palette has a name and 8 colors', () => {
    Object.values(COLOR_PALETTES).forEach((palette) => {
      expect(palette.name).toBeTruthy();
      expect(palette.colors).toHaveLength(8);
      palette.colors.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });

  it('has expected palette names', () => {
    const expectedNames = [
      'default', 'soft', 'vintage', 'retro', 'neon',
      'summer', 'fall', 'winter', 'spring', 'happy', 'kids',
    ];
    expect(Object.keys(COLOR_PALETTES).sort()).toEqual(expectedNames.sort());
  });
});
