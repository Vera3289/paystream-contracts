// SPDX-License-Identifier: Apache-2.0
// Balance calculation service for PayStream streams (#498)
// Handles pause periods, duration types, leap years, DST, and edge cases.

'use strict';

/**
 * Duration types supported for balance calculation reporting.
 */
const DURATION_TYPES = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
});

/**
 * Calculate total paused seconds from pause history entries.
 * @param {Array<{timestamp: number, is_pause: boolean}>} pauseHistory
 * @param {number} fromTime - start of calculation window (unix seconds)
 * @param {number} toTime   - end of calculation window (unix seconds)
 * @returns {number} total paused seconds within [fromTime, toTime]
 */
function calcPausedSeconds(pauseHistory, fromTime, toTime) {
  if (!pauseHistory || pauseHistory.length === 0) return 0;

  let paused = 0;
  let pauseStart = null;

  for (const event of pauseHistory) {
    const t = event.timestamp;
    if (event.is_pause) {
      // Only track pauses that started before toTime
      if (t < toTime) {
        pauseStart = Math.max(t, fromTime);
      }
    } else {
      // Resume event
      if (pauseStart !== null) {
        const resumeAt = Math.min(t, toTime);
        if (resumeAt > pauseStart) {
          paused += resumeAt - pauseStart;
        }
        pauseStart = null;
      }
    }
  }

  // Still paused at toTime
  if (pauseStart !== null) {
    paused += toTime - pauseStart;
  }

  return paused;
}

/**
 * Core balance calculation. Returns accrued amount (in token units) for a stream.
 *
 * Formula:
 *   accrued = min(active_elapsed * rate_per_second, deposit - withdrawn)
 *
 * @param {object} stream - stream state
 * @param {number} stream.deposit
 * @param {number} stream.withdrawn
 * @param {number} stream.rate_per_second
 * @param {number} stream.start_time
 * @param {number} stream.stop_time  (0 = no stop)
 * @param {number} stream.last_withdraw_time
 * @param {number} stream.cliff_time (0 = no cliff)
 * @param {string} stream.status     ('Active'|'Paused'|'Cancelled'|'Exhausted')
 * @param {Array}  stream.pause_history
 * @param {number} [nowSecs]  - override current time (unix seconds); defaults to Date.now()/1000
 * @returns {{ claimable: number, accrued_total: number, active_elapsed: number, paused_elapsed: number }}
 */
function calculateBalance(stream, nowSecs) {
  const {
    deposit,
    withdrawn,
    rate_per_second,
    stop_time,
    last_withdraw_time,
    cliff_time,
    status,
    pause_history = [],
  } = stream;

  // Ended streams have nothing more to claim
  if (status === 'Cancelled' || status === 'Exhausted') {
    return { claimable: 0, accrued_total: 0, active_elapsed: 0, paused_elapsed: 0 };
  }

  const now = nowSecs !== undefined ? nowSecs : Math.floor(Date.now() / 1000);

  // Cliff: nothing claimable before cliff_time
  if (cliff_time > 0 && now < cliff_time) {
    return { claimable: 0, accrued_total: 0, active_elapsed: 0, paused_elapsed: 0 };
  }

  // Cap effective end at stop_time if set
  const effectiveEnd = stop_time > 0 && now > stop_time ? stop_time : now;

  const windowStart = last_withdraw_time;
  const windowEnd = effectiveEnd;

  if (windowEnd <= windowStart) {
    return { claimable: 0, accrued_total: 0, active_elapsed: 0, paused_elapsed: 0 };
  }

  const totalElapsed = windowEnd - windowStart;
  const pausedSecs = calcPausedSeconds(pause_history, windowStart, windowEnd);
  const activeElapsed = Math.max(0, totalElapsed - pausedSecs);

  const accrued = activeElapsed * rate_per_second;
  const remaining = Math.max(0, deposit - withdrawn);
  const claimable = Math.min(accrued, remaining);

  return {
    claimable,
    accrued_total: accrued,
    active_elapsed: activeElapsed,
    paused_elapsed: pausedSecs,
  };
}

/**
 * Calculate balance broken down by duration type (daily/weekly/monthly/custom).
 * Useful for payroll reporting — returns per-period earnings.
 *
 * Handles leap years and DST via JS Date (UTC) arithmetic.
 *
 * @param {object} stream
 * @param {'daily'|'weekly'|'monthly'|'custom'} durationType
 * @param {number} [customPeriodSecs] - required when durationType === 'custom'
 * @param {number} [nowSecs]
 * @returns {Array<{period_start: number, period_end: number, earned: number}>}
 */
function calculateBalanceByDuration(stream, durationType, customPeriodSecs, nowSecs) {
  const now = nowSecs !== undefined ? nowSecs : Math.floor(Date.now() / 1000);
  const streamStart = stream.start_time;
  const effectiveEnd = stream.stop_time > 0 && now > stream.stop_time ? stream.stop_time : now;

  if (effectiveEnd <= streamStart) return [];

  const periods = buildPeriods(streamStart, effectiveEnd, durationType, customPeriodSecs);

  return periods.map(({ start, end }) => {
    // Synthetic stream slice for this period
    const slice = {
      ...stream,
      last_withdraw_time: start,
      stop_time: end,
    };
    const { claimable } = calculateBalance(slice, end);
    return { period_start: start, period_end: end, earned: claimable };
  });
}

/**
 * Build period boundaries for a given duration type.
 * Uses UTC calendar arithmetic so leap years / DST offsets are handled correctly.
 */
function buildPeriods(startSecs, endSecs, durationType, customPeriodSecs) {
  const periods = [];
  let cursor = startSecs;

  while (cursor < endSecs) {
    let nextCursor;

    if (durationType === DURATION_TYPES.DAILY) {
      const d = new Date(cursor * 1000);
      d.setUTCDate(d.getUTCDate() + 1);
      nextCursor = Math.floor(d.getTime() / 1000);
    } else if (durationType === DURATION_TYPES.WEEKLY) {
      nextCursor = cursor + 7 * 86400;
    } else if (durationType === DURATION_TYPES.MONTHLY) {
      const d = new Date(cursor * 1000);
      d.setUTCMonth(d.getUTCMonth() + 1);
      nextCursor = Math.floor(d.getTime() / 1000);
    } else if (durationType === DURATION_TYPES.CUSTOM) {
      if (!customPeriodSecs || customPeriodSecs <= 0) {
        throw new Error('customPeriodSecs must be a positive number for custom duration type');
      }
      nextCursor = cursor + customPeriodSecs;
    } else {
      throw new Error(`Unknown duration type: ${durationType}`);
    }

    const periodEnd = Math.min(nextCursor, endSecs);
    periods.push({ start: cursor, end: periodEnd });
    cursor = nextCursor;
  }

  return periods;
}

module.exports = {
  calculateBalance,
  calculateBalanceByDuration,
  calcPausedSeconds,
  DURATION_TYPES,
};
