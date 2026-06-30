// SPDX-License-Identifier: Apache-2.0

export { PayStreamClient } from "./client.js";
export type { PayStreamClientOptions, Stream, StreamParams, StreamStatus } from "./types.js";
export {
  connectFreighter,
  getFreighterPublicKey,
  freighterSignTransaction,
  isFreighterConnected,
  FreighterNotInstalledError,
} from "./freighter.js";
export { pollClaimable } from "./poll.js";
export type { PollHandle } from "./poll.js";
