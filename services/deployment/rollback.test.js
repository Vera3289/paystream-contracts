// SPDX-License-Identifier: Apache-2.0
// Unit tests for deployment rollback logic (#513)
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Minimal JS mirror of the rollback script's core logic for unit testing.
 */
function rollbackSlot(activeSlot) {
  if (activeSlot !== 'blue' && activeSlot !== 'green') {
    throw new Error(`Invalid active slot: ${activeSlot}`);
  }
  return activeSlot === 'blue' ? 'green' : 'blue';
}

function recordDeployment(historyPath, entry) {
  let history = [];
  if (fs.existsSync(historyPath)) {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  history.push(entry);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function readDeploymentHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return [];
  return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
}

async function runHealthCheck(url, retries, intervalMs, fetcher) {
  for (let i = 1; i <= retries; i++) {
    const status = await fetcher(url);
    if (status === 200) return true;
    if (i < retries) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

describe('Deployment Rollback Logic (#513)', () => {
  test('rollback slot: blue → green', () => {
    expect(rollbackSlot('blue')).toBe('green');
  });

  test('rollback slot: green → blue', () => {
    expect(rollbackSlot('green')).toBe('blue');
  });

  test('invalid slot throws', () => {
    expect(() => rollbackSlot('purple')).toThrow('Invalid active slot');
  });

  describe('deployment history', () => {
    let historyPath;
    beforeEach(() => {
      historyPath = path.join(os.tmpdir(), `deploy-history-${Date.now()}.json`);
    });
    afterEach(() => {
      if (fs.existsSync(historyPath)) fs.unlinkSync(historyPath);
    });

    test('records rollback entry', () => {
      recordDeployment(historyPath, {
        action: 'rollback',
        from_slot: 'blue',
        to_slot: 'green',
        image: 'v1.2.3',
        timestamp: '2024-01-01T00:00:00Z',
      });
      const history = readDeploymentHistory(historyPath);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('rollback');
      expect(history[0].image).toBe('v1.2.3');
    });

    test('appends to existing history', () => {
      recordDeployment(historyPath, { action: 'deploy', image: 'v1.0.0' });
      recordDeployment(historyPath, { action: 'rollback', image: 'v0.9.0' });
      const history = readDeploymentHistory(historyPath);
      expect(history).toHaveLength(2);
      expect(history[1].action).toBe('rollback');
    });

    test('reads empty array when no history file', () => {
      expect(readDeploymentHistory('/tmp/nonexistent-xyz.json')).toEqual([]);
    });
  });

  describe('health check', () => {
    test('passes when fetcher returns 200 on first try', async () => {
      const fetcher = jest.fn().mockResolvedValue(200);
      const ok = await runHealthCheck('http://example.com/health', 3, 0, fetcher);
      expect(ok).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('retries and passes on second attempt', async () => {
      const fetcher = jest.fn().mockResolvedValueOnce(503).mockResolvedValueOnce(200);
      const ok = await runHealthCheck('http://example.com/health', 3, 0, fetcher);
      expect(ok).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    test('returns false after all retries fail', async () => {
      const fetcher = jest.fn().mockResolvedValue(503);
      const ok = await runHealthCheck('http://example.com/health', 3, 0, fetcher);
      expect(ok).toBe(false);
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    test('triggers rollback on health check failure', async () => {
      const fetcher = jest.fn().mockResolvedValue(503);
      const ok = await runHealthCheck('http://slot.internal/health', 2, 0, fetcher);
      expect(ok).toBe(false);
      // Caller would then switch traffic to previous slot
      const rollbackTarget = rollbackSlot('green');
      expect(rollbackTarget).toBe('blue');
    });
  });
});
