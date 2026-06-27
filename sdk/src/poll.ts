// SPDX-License-Identifier: Apache-2.0

import type { PayStreamClient } from "./client.js";

export interface PollHandle {
  /** Stop polling and release resources. */
  unsubscribe(): void;
}

/**
 * Poll `claimable(streamId)` at a fixed interval and invoke `callback` with
 * each result.
 *
 * @param client      - Initialised PayStreamClient
 * @param streamId    - Stream to watch
 * @param intervalMs  - Polling interval in milliseconds (minimum 1000)
 * @param callback    - Called with the claimable amount on each tick
 * @param onError     - Optional error handler; defaults to console.error
 * @returns A handle with an `unsubscribe()` method to stop polling
 */
export function pollClaimable(
  client: PayStreamClient,
  streamId: bigint,
  intervalMs: number,
  callback: (claimable: bigint) => void,
  onError?: (err: unknown) => void
): PollHandle {
  const safeInterval = Math.max(intervalMs, 1000);
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const amount = await client.claimable(streamId);
      if (active) callback(amount);
    } catch (err) {
      if (active) {
        if (onError) {
          onError(err);
        } else {
          console.error("[pollClaimable] error:", err);
        }
      }
    }
    if (active) {
      setTimeout(tick, safeInterval);
    }
  };

  // Kick off immediately, then repeat
  void tick();

  return {
    unsubscribe() {
      active = false;
    },
  };
}
