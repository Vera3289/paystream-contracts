// SPDX-License-Identifier: Apache-2.0

/**
 * Freighter wallet integration for PayStream SDK.
 *
 * Freighter is a browser extension wallet for Stellar. This module provides
 * helpers to connect, get the public key, and sign transactions.
 *
 * Usage:
 *   import { connectFreighter, getFreighterPublicKey, freighterSignTransaction } from "@paystream/sdk";
 *   const pubkey = await connectFreighter();
 *   const signed = await freighterSignTransaction(xdrString, networkPassphrase);
 */

/** Thrown when Freighter extension is not installed. */
export class FreighterNotInstalledError extends Error {
  constructor() {
    super(
      "Freighter wallet extension is not installed. " +
        "Install it from https://freighter.app and reload the page."
    );
    this.name = "FreighterNotInstalledError";
  }
}

function getFreighterApi(): typeof import("@freighter-api/freighter-api") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = globalThis as any;
  if (!w.freighterApi) {
    throw new FreighterNotInstalledError();
  }
  return w.freighterApi;
}

/**
 * Check whether Freighter is installed and connected.
 * Returns true if the extension is present and the user has granted access.
 */
export async function isFreighterConnected(): Promise<boolean> {
  try {
    const api = getFreighterApi();
    return await api.isConnected();
  } catch {
    return false;
  }
}

/**
 * Request access to Freighter and return the user's public key.
 * Throws FreighterNotInstalledError if the extension is absent.
 */
export async function connectFreighter(): Promise<string> {
  const api = getFreighterApi();
  const { error } = await api.requestAccess();
  if (error) throw new Error(`Freighter access denied: ${error}`);
  const { publicKey, error: pkError } = await api.getPublicKey();
  if (pkError) throw new Error(`Freighter getPublicKey failed: ${pkError}`);
  return publicKey;
}

/**
 * Get the currently selected Freighter public key without prompting.
 * Throws if Freighter is not installed or not connected.
 */
export async function getFreighterPublicKey(): Promise<string> {
  const api = getFreighterApi();
  const { publicKey, error } = await api.getPublicKey();
  if (error) throw new Error(`Freighter getPublicKey failed: ${error}`);
  return publicKey;
}

/**
 * Sign a Stellar transaction XDR string with Freighter.
 *
 * @param xdr - Base64-encoded transaction XDR
 * @param networkPassphrase - Network passphrase (e.g. Networks.TESTNET)
 * @returns Signed transaction XDR string
 */
export async function freighterSignTransaction(
  xdr: string,
  networkPassphrase: string
): Promise<string> {
  const api = getFreighterApi();
  const { signedTxXdr, error } = await api.signTransaction(xdr, {
    networkPassphrase,
  });
  if (error) throw new Error(`Freighter signing failed: ${error}`);
  return signedTxXdr;
}
