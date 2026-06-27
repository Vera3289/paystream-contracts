// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useRef } from "react";
import { useAuth, type WalletType } from "./useAuth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful login with the JWT token. */
  onAuthenticated?: (token: string) => void;
}

const WALLET_OPTIONS: { type: WalletType; label: string; icon: string; description: string }[] = [
  { type: "freighter", label: "Freighter", icon: "🔐", description: "Browser extension wallet" },
  { type: "ledger", label: "Ledger", icon: "🔒", description: "Hardware wallet (coming soon)" },
  { type: "walletconnect", label: "WalletConnect", icon: "📱", description: "Mobile wallet (coming soon)" },
];

/**
 * AuthModal — full wallet-connect → sign-in flow.
 *
 * Steps:
 *   1. Pick a wallet
 *   2. Confirm / login (sign challenge nonce)
 *   3. Authenticated
 *
 * Resolves #481.
 */
export function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const { publicKey, token, isAuthenticated, loading, error, connect, login, logout, rememberMe, setRememberMe } =
    useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [isOpen]);

  useEffect(() => {
    if (isAuthenticated && token) {
      onAuthenticated?.(token);
      onClose();
    }
  }, [isAuthenticated, token]);

  const handleConnect = async (walletType: WalletType) => {
    try {
      await connect(walletType);
    } catch {
      // error surfaced via hook
    }
  };

  const handleLogin = async () => {
    try {
      await login({ remember: rememberMe });
    } catch {
      // error surfaced via hook
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="wallet-modal"
      onClick={handleBackdropClick}
      onCancel={onClose}
      aria-labelledby="auth-modal-title"
    >
      <div className="wallet-modal-content">
        {/* Header */}
        <div className="wallet-modal-header">
          <h2 id="auth-modal-title">
            {publicKey ? "Sign In to PayStream" : "Connect Wallet"}
          </h2>
          <button className="wallet-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="wallet-modal-body">
          {error && (
            <div className="wallet-modal-error" role="alert">
              <span aria-hidden="true">⚠️</span> {error}
            </div>
          )}

          {!publicKey ? (
            /* Step 1 — wallet selection */
            <div className="wallet-options">
              <p className="wallet-modal-description">
                Connect your Stellar wallet to authenticate.
              </p>
              {WALLET_OPTIONS.map(({ type, label, icon, description }) => (
                <button
                  key={type}
                  className="wallet-option"
                  onClick={() => handleConnect(type)}
                  disabled={loading || type !== "freighter"}
                  aria-busy={loading && type === "freighter"}
                >
                  <div className="wallet-option-icon">{icon}</div>
                  <div className="wallet-option-content">
                    <div className="wallet-option-name">{label}</div>
                    <div className="wallet-option-description">
                      {loading && type === "freighter" ? "Connecting…" : description}
                    </div>
                  </div>
                </button>
              ))}
              <div className="wallet-options-note">
                <p>
                  No wallet?{" "}
                  <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">
                    Install Freighter
                  </a>
                </p>
              </div>
            </div>
          ) : (
            /* Step 2 — sign challenge */
            <div className="auth-sign-step">
              <p className="wallet-modal-description">
                Connected as <code className="auth-address">{publicKey.slice(0, 8)}…{publicKey.slice(-4)}</code>
              </p>
              <p className="field-hint">
                Sign the challenge with your wallet to prove ownership and receive a session token.
              </p>

              {/* Remember me */}
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={logout} disabled={loading}>
                  Change Wallet
                </button>
                <button className="btn btn-primary" onClick={handleLogin} disabled={loading} aria-busy={loading}>
                  {loading ? "Signing…" : "Sign In"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="wallet-modal-footer">
          <button className="wallet-modal-button-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
