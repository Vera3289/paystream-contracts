// SPDX-License-Identifier: Apache-2.0
import { useState, useCallback, useEffect } from "react";
import {
  connectFreighter,
  isFreighterConnected,
  freighterSignTransaction,
} from "@paystream/sdk";
import { CONFIG } from "./config";

export type WalletType = "freighter" | "walletconnect" | "ledger";

export interface AuthState {
  publicKey: string | null;
  token: string | null;
  tokenExpiry: number | null;
  rememberMe: boolean;
}

const TOKEN_KEY = "paystream_auth_token";
const EXPIRY_KEY = "paystream_auth_expiry";
const REMEMBER_KEY = "paystream_remember_me";

const API_BASE = CONFIG.apiBase ?? "";

function readPersistedSession(): Pick<AuthState, "token" | "tokenExpiry" | "rememberMe"> {
  const rememberMe = localStorage.getItem(REMEMBER_KEY) === "true";
  const store = rememberMe ? localStorage : sessionStorage;
  const token = store.getItem(TOKEN_KEY);
  const expiry = store.getItem(EXPIRY_KEY);
  const tokenExpiry = expiry ? Number(expiry) : null;
  // Treat expired tokens as absent
  if (token && tokenExpiry && Date.now() < tokenExpiry) {
    return { token, tokenExpiry, rememberMe };
  }
  return { token: null, tokenExpiry: null, rememberMe };
}

function persistSession(token: string, expiryMs: number, rememberMe: boolean) {
  localStorage.setItem(REMEMBER_KEY, String(rememberMe));
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(EXPIRY_KEY, String(expiryMs));
}

function clearSession() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(EXPIRY_KEY);
  });
}

/**
 * useAuth — wallet-based authentication hook for PayStream.
 *
 * Flow:
 *   1. connect() — connects the selected wallet, obtains publicKey
 *   2. login()   — requests a challenge nonce, signs it, exchanges for JWT
 *   3. logout()  — clears session
 *
 * Resolves #481.
 */
export function useAuth() {
  const persisted = readPersistedSession();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(persisted.token);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(persisted.tokenExpiry);
  const [rememberMe, setRememberMe] = useState(persisted.rememberMe);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!token && !!tokenExpiry && Date.now() < tokenExpiry;

  /** Refresh the JWT silently when it is within 5 minutes of expiry. */
  useEffect(() => {
    if (!token || !tokenExpiry) return;
    const msUntilRefresh = tokenExpiry - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) return;
    const id = setTimeout(async () => {
      if (!publicKey) return;
      try {
        await _doLogin(publicKey, rememberMe);
      } catch {
        // Silent refresh failure — user will need to re-login
      }
    }, msUntilRefresh);
    return () => clearTimeout(id);
  }, [token, tokenExpiry, publicKey, rememberMe]);

  /** Connect wallet and obtain publicKey (does not issue a JWT yet). */
  const connect = useCallback(async (walletType: WalletType = "freighter") => {
    setLoading(true);
    setError(null);
    try {
      if (walletType === "freighter") {
        const connected = await isFreighterConnected();
        if (!connected) throw new Error("Freighter not installed. Visit https://freighter.app");
        const pk = await connectFreighter();
        setPublicKey(pk);
        return pk;
      }
      // Ledger / WalletConnect — extensibility point
      throw new Error(`${walletType} support coming soon`);
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  async function _doLogin(pk: string, remember: boolean) {
    // 1. Request challenge nonce
    const challengeRes = await fetch(`${API_BASE}/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: pk }),
    });
    if (!challengeRes.ok) throw new Error("Failed to fetch challenge");
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Sign nonce with wallet
    const signature = await freighterSignTransaction(nonce, CONFIG.networkPassphrase);

    // 3. Exchange signature for JWT
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: pk, signature }),
    });
    if (!verifyRes.ok) {
      const body = (await verifyRes.json()) as { error?: string };
      throw new Error(body.error ?? "Verification failed");
    }
    const { token: jwt, expiresIn } = (await verifyRes.json()) as {
      token: string;
      expiresIn: string;
    };

    // Parse "24h" → ms
    const hours = parseInt(expiresIn, 10) || 24;
    const expiry = Date.now() + hours * 60 * 60 * 1000;

    setToken(jwt);
    setTokenExpiry(expiry);
    persistSession(jwt, expiry, remember);
  }

  /** Sign the challenge nonce and receive a JWT. */
  const login = useCallback(
    async (opts: { remember?: boolean } = {}) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      setLoading(true);
      setError(null);
      try {
        const remember = opts.remember ?? rememberMe;
        setRememberMe(remember);
        await _doLogin(publicKey, remember);
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, rememberMe]
  );

  const logout = useCallback(() => {
    setPublicKey(null);
    setToken(null);
    setTokenExpiry(null);
    clearSession();
  }, []);

  return {
    publicKey,
    token,
    tokenExpiry,
    rememberMe,
    isAuthenticated,
    loading,
    error,
    connect,
    login,
    logout,
    setRememberMe,
  };
}
