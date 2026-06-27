// SPDX-License-Identifier: Apache-2.0
import React, { useState } from "react";

interface SettingsPageProps {
  publicKey: string | null;
  dark: boolean;
  onToggleDark: () => void;
  onDisconnect: () => void;
}

export function SettingsPage({ publicKey, dark, onToggleDark, onDisconnect }: SettingsPageProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  // Notification preferences
  const [notifyWithdraw, setNotifyWithdraw] = useState(true);
  const [notifyStream, setNotifyStream] = useState(true);
  const [notifyPayday, setNotifyPayday] = useState(false);

  // Privacy settings
  const [publicProfile, setPublicProfile] = useState(false);
  const [shareActivity, setShareActivity] = useState(false);

  // Wallet address verification
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const truncate = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-8)}`;

  function handleVerify() {
    setVerifying(true);
    // Simulate a signing challenge (real impl would call wallet.signMessage)
    setTimeout(() => { setVerified(true); setVerifying(false); }, 800);
  }

  return (
    <div className="settings-page" style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Settings</h2>

      {/* ── Profile ─────────────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Profile</h3>
        <label className="form-label">
          Display name
          <input
            className="form-input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="form-label" style={{ marginTop: "0.75rem" }}>
          Email
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
      </section>

      {/* ── Connected Wallet ─────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Connected Wallet</h3>
        {publicKey ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="wallet-button-indicator" aria-hidden="true">●</span>
              <code title={publicKey}>{truncate(publicKey)}</code>
              {verified ? (
                <span style={{ color: "var(--color-success, green)", fontSize: "0.85rem" }}>✓ Verified</span>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={handleVerify}
                  disabled={verifying}
                  style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}
                >
                  {verifying ? "Verifying…" : "Verify ownership"}
                </button>
              )}
            </div>
            <button
              className="btn btn-danger"
              onClick={onDisconnect}
              style={{ alignSelf: "flex-start" }}
            >
              Disconnect wallet
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--color-muted, gray)" }}>No wallet connected.</p>
        )}
      </section>

      {/* ── Notifications ────────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Notification Preferences</h3>
        {[
          { label: "Withdrawal completed", value: notifyWithdraw, set: setNotifyWithdraw },
          { label: "Stream created / cancelled", value: notifyStream, set: setNotifyStream },
          { label: "Payday reminders", value: notifyPayday, set: setNotifyPayday },
        ].map(({ label, value, set }) => (
          <label key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
            {label}
          </label>
        ))}
      </section>

      {/* ── Theme ────────────────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Theme</h3>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {(["light", "dark"] as const).map((t) => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="theme"
                value={t}
                checked={dark === (t === "dark")}
                onChange={() => { if (dark !== (t === "dark")) onToggleDark(); }}
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </label>
          ))}
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>Privacy</h3>
        {[
          { label: "Public profile (visible to other users)", value: publicProfile, set: setPublicProfile },
          { label: "Share stream activity on-chain explorer link", value: shareActivity, set: setShareActivity },
        ].map(({ label, value, set }) => (
          <label key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
            {label}
          </label>
        ))}
      </section>
    </div>
  );
}
