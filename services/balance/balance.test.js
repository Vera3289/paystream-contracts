// SPDX-License-Identifier: Apache-2.0
'use strict';

const { calculateBalance, calculateBalanceByDuration, calcPausedSeconds, DURATION_TYPES } =
  require('./balance');

const BASE_STREAM = {
  deposit: 3600,
  withdrawn: 0,
  rate_per_second: 1,
  start_time: 1000,
  stop_time: 0,
  last_withdraw_time: 1000,
  cliff_time: 0,
  status: 'Active',
  pause_history: [],
};

describe('calculateBalance', () => {
  test('accrues correctly after elapsed time', () => {
    const result = calculateBalance(BASE_STREAM, 1100);
    expect(result.claimable).toBe(100);
    expect(result.active_elapsed).toBe(100);
  });

  test('returns 0 for cancelled stream', () => {
    const result = calculateBalance({ ...BASE_STREAM, status: 'Cancelled' }, 2000);
    expect(result.claimable).toBe(0);
  });

  test('returns 0 for exhausted stream', () => {
    const result = calculateBalance({ ...BASE_STREAM, status: 'Exhausted' }, 2000);
    expect(result.claimable).toBe(0);
  });

  test('caps at deposit - withdrawn (partial day)', () => {
    const stream = { ...BASE_STREAM, deposit: 50, rate_per_second: 1 };
    const result = calculateBalance(stream, 2000);
    expect(result.claimable).toBe(50);
  });

  test('respects stop_time', () => {
    const stream = { ...BASE_STREAM, stop_time: 1200 };
    const result = calculateBalance(stream, 9999);
    expect(result.claimable).toBe(200);
  });

  test('returns 0 before cliff_time', () => {
    const stream = { ...BASE_STREAM, cliff_time: 2000 };
    const result = calculateBalance(stream, 1500);
    expect(result.claimable).toBe(0);
  });

  test('accounts for pause period', () => {
    const stream = {
      ...BASE_STREAM,
      pause_history: [
        { timestamp: 1050, is_pause: true },
        { timestamp: 1080, is_pause: false },
      ],
    };
    // 100 total elapsed, 30 paused => 70 active
    const result = calculateBalance(stream, 1100);
    expect(result.claimable).toBe(70);
    expect(result.paused_elapsed).toBe(30);
  });

  test('handles still-paused stream (no resume event)', () => {
    const stream = {
      ...BASE_STREAM,
      status: 'Paused',
      pause_history: [{ timestamp: 1050, is_pause: true }],
    };
    const result = calculateBalance(stream, 1100);
    expect(result.paused_elapsed).toBe(50);
    expect(result.claimable).toBe(50);
  });

  test('returns 0 when now equals last_withdraw_time', () => {
    const result = calculateBalance(BASE_STREAM, 1000);
    expect(result.claimable).toBe(0);
  });
});

describe('calcPausedSeconds', () => {
  test('no history returns 0', () => {
    expect(calcPausedSeconds([], 1000, 2000)).toBe(0);
  });

  test('complete pause/resume within window', () => {
    const history = [
      { timestamp: 1100, is_pause: true },
      { timestamp: 1200, is_pause: false },
    ];
    expect(calcPausedSeconds(history, 1000, 2000)).toBe(100);
  });

  test('pause starts before window start', () => {
    const history = [
      { timestamp: 900, is_pause: true },
      { timestamp: 1100, is_pause: false },
    ];
    // only 1000-1100 = 100 secs fall inside the window
    expect(calcPausedSeconds(history, 1000, 2000)).toBe(100);
  });
});

describe('calculateBalanceByDuration', () => {
  test('daily splits into correct periods', () => {
    const dayStart = Math.floor(new Date('2024-03-01T00:00:00Z').getTime() / 1000);
    // 2024 is a leap year; Mar 1 follows Feb 29
    const stream = {
      ...BASE_STREAM,
      deposit: 86400 * 10, // large enough to not cap
      start_time: dayStart,
      last_withdraw_time: dayStart,
    };
    const periods = calculateBalanceByDuration(stream, DURATION_TYPES.DAILY, undefined, dayStart + 86400 * 3);
    expect(periods.length).toBe(3);
    periods.forEach((p) => {
      expect(p.earned).toBe(86400); // 1 token/sec * 86400 secs
    });
  });

  test('monthly handles varying month lengths', () => {
    // Jan 1 to Mar 1 = 2 monthly periods (31 days, 28 days in non-leap or 29 in leap)
    const jan1 = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000);
    const mar1 = Math.floor(new Date('2024-03-01T00:00:00Z').getTime() / 1000);
    const stream = { ...BASE_STREAM, start_time: jan1, last_withdraw_time: jan1, deposit: 999999999 };
    const periods = calculateBalanceByDuration(stream, DURATION_TYPES.MONTHLY, undefined, mar1);
    expect(periods.length).toBe(2);
    // Jan = 31 days, Feb 2024 = 29 days (leap)
    expect(periods[0].earned).toBe(31 * 86400);
    expect(periods[1].earned).toBe(29 * 86400);
  });

  test('custom period works', () => {
    const stream = { ...BASE_STREAM, deposit: 999999 };
    const periods = calculateBalanceByDuration(stream, DURATION_TYPES.CUSTOM, 300, 1600);
    expect(periods.length).toBe(2);
    expect(periods[0].earned).toBe(300);
  });

  test('throws for unknown duration type', () => {
    expect(() =>
      calculateBalanceByDuration(BASE_STREAM, 'quarterly', undefined, 9999)
    ).toThrow('Unknown duration type');
  });
});
