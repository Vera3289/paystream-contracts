// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useState } from "react";
import type { Stream } from "@paystream/sdk";
import { StreamStatusBadge, StreamStatus } from "./StreamStatusBadge";
import { useTransactionHistory } from "./useTransactionHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXlm(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(4);
}

function formatTs(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

function addr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", gap: 8 }}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.875rem", flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StreamDetailPageProps {
  stream: Stream;
  claimable?: bigint;
  publicKey: string | null;
  onBack: () => void;
  onWithdraw?: (streamId: bigint) => Promise<void>;
  onPause?: (streamId: bigint) => Promise<void>;
  onResume?: (streamId: bigint) => Promise<void>;
  onCancel?: (streamId: bigint) => Promise<void>;
  onTopUp?: (streamId: bigint, amount: bigint) => Promise<void>;
  loading?: boolean;
  actionLoading?: string | null;
}

// ─── StreamDetailPage ────────────────────────────────────────────────────────

export function StreamDetailPage({
  stream,
  claimable = 0n,
  publicKey,
  onBack,
  onWithdraw,
  onPause,
  onResume,
  onCancel,
  onTopUp,
  loading = false,
  actionLoading = null,
}: StreamDetailPageProps) {
  const { records, loading: histLoading, error: histError, hasMore, fetchHistory, loadMore, reset } =
    useTransactionHistory();

  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpError, setTopUpError] = useState("");

  useEffect(() => {
    reset();
    fetchHistory(stream.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.id]);

  const key = stream.id.toString();
  const isEmployee = publicKey === stream.employee;
  const isEmployer = publicKey === stream.employer;
  const anyBusy = loading || !!actionLoading;

  // Stub message when no wallet / wrong role
  const noWalletMsg = "Connect wallet and use Employer Dashboard";

  const handlePause = () => {
    if (onPause) onPause(stream.id);
    else alert(noWalletMsg);
  };
  const handleResume = () => {
    if (onResume) onResume(stream.id);
    else alert(noWalletMsg);
  };
  const handleCancel = () => {
    if (onCancel) onCancel(stream.id);
    else alert(noWalletMsg);
  };
  const handleTopUp = () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) { setTopUpError("Enter a positive amount"); return; }
    setTopUpError("");
    if (onTopUp) onTopUp(stream.id, BigInt(Math.round(amt * 10_000_000)));
    else alert(noWalletMsg);
  };

  const locked = stream.deposit > stream.withdrawn ? (stream.deposit as bigint) - (stream.withdrawn as bigint) : 0n;
  const progress = stream.deposit > 0n ? Math.min(100, Number((stream.withdrawn * 100n) / stream.deposit)) : 0;

  return (
    <main className="sdp-root" aria-label={`Stream ${key} detail`}>
      {/* ── Back ── */}
      <button
        className="btn btn-secondary sdp-back"
        onClick={onBack}
        aria-label="Back to streams"
      >
        ← Back
      </button>

      <h2 className="sdp-title">
        Stream #{key} <StreamStatusBadge status={stream.status as StreamStatus} />
      </h2>

      {/* ── Fields ── */}
      <section className="card sdp-section" aria-labelledby="sdp-fields-heading">
        <h3 id="sdp-fields-heading" className="sdp-section-title">Stream Details</h3>
        <FieldRow label="Stream ID" value={key} />
        <FieldRow
          label="Employer"
          value={
            <a
              href={`https://stellar.expert/explorer/testnet/account/${stream.employer}`}
              target="_blank"
              rel="noopener noreferrer"
              title={stream.employer}
            >
              {addr(stream.employer)}
            </a>
          }
        />
        <FieldRow
          label="Employee"
          value={
            <a
              href={`https://stellar.expert/explorer/testnet/account/${stream.employee}`}
              target="_blank"
              rel="noopener noreferrer"
              title={stream.employee}
            >
              {addr(stream.employee)}
            </a>
          }
        />
        <FieldRow label="Token" value={<span title={stream.token}>{addr(stream.token)}</span>} />
        <FieldRow label="Deposit" value={`${formatXlm(stream.deposit)} XLM`} />
        <FieldRow label="Withdrawn" value={`${formatXlm(stream.withdrawn)} XLM`} />
        <FieldRow label="Locked" value={`${formatXlm(locked)} XLM`} />
        <FieldRow label="Claimable Now" value={`${formatXlm(claimable)} XLM`} />
        <FieldRow label="Rate" value={`${stream.ratePerSecond.toString()} stroops/s`} />
        <FieldRow label="Start Time" value={formatTs(stream.startTime)} />
        <FieldRow label="Stop Time" value={stream.stopTime === 0n ? "Indefinite" : formatTs(stream.stopTime)} />
        <FieldRow label="Last Withdraw" value={formatTs(stream.lastWithdrawTime)} />
        <FieldRow label="Cooldown Period" value={`${stream.cooldownPeriod.toString()}s`} />
        <FieldRow label="Cliff Time" value={stream.cliffTime === 0n ? "—" : formatTs(stream.cliffTime)} />
        <FieldRow label="Paused At" value={stream.pausedAt === 0n ? "—" : formatTs(stream.pausedAt)} />
        <FieldRow label="Locked Flag" value={stream.locked ? "Yes" : "No"} />

        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress.toFixed(1)}% of deposit paid out`}
            style={{ background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden" }}
          >
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--btn-bg)", transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>{progress.toFixed(1)}% paid out</p>
        </div>
      </section>

      {/* ── Actions ── */}
      <section className="card sdp-section" aria-labelledby="sdp-actions-heading">
        <h3 id="sdp-actions-heading" className="sdp-section-title">Actions</h3>
        <div className="sdp-actions" role="group" aria-label={`Actions for stream ${key}`}>
          {/* Withdraw — employee only, active stream */}
          {(isEmployee || !publicKey) && stream.status === "Active" && (
            <button
              className="btn"
              onClick={() => onWithdraw ? onWithdraw(stream.id) : alert("Connect wallet to withdraw")}
              disabled={anyBusy || !onWithdraw}
              aria-busy={actionLoading === "withdraw"}
            >
              {actionLoading === "withdraw" ? "Withdrawing…" : "💸 Withdraw"}
            </button>
          )}

          {/* Pause — employer, active */}
          {(isEmployer || !publicKey) && stream.status === "Active" && (
            <button
              className="btn btn-warning btn-sm"
              onClick={handlePause}
              disabled={anyBusy}
              aria-busy={actionLoading === `pause-${key}`}
            >
              {actionLoading === `pause-${key}` ? "Pausing…" : "⏸ Pause"}
            </button>
          )}

          {/* Resume — employer, paused */}
          {(isEmployer || !publicKey) && stream.status === "Paused" && (
            <button
              className="btn btn-success btn-sm"
              onClick={handleResume}
              disabled={anyBusy}
              aria-busy={actionLoading === `resume-${key}`}
            >
              {actionLoading === `resume-${key}` ? "Resuming…" : "▶ Resume"}
            </button>
          )}

          {/* Cancel — employer, active or paused */}
          {(isEmployer || !publicKey) && (stream.status === "Active" || stream.status === "Paused") && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleCancel}
              disabled={anyBusy}
              aria-busy={actionLoading === `cancel-${key}`}
            >
              {actionLoading === `cancel-${key}` ? "Cancelling…" : "✕ Cancel"}
            </button>
          )}

          {/* Top Up — employer, active or paused */}
          {(isEmployer || !publicKey) && (stream.status === "Active" || stream.status === "Paused") && (
            <div className="sdp-topup-row">
              <label htmlFor={`topup-${key}`} className="sr-only">Top-up amount (XLM)</label>
              <input
                id={`topup-${key}`}
                type="number"
                min="0.0000001"
                step="0.1"
                placeholder="Amount (XLM)"
                value={topUpAmount}
                onChange={(e) => { setTopUpAmount(e.target.value); setTopUpError(""); }}
                className={`input${topUpError ? " input-error" : ""}`}
                style={{ width: 140 }}
                aria-invalid={!!topUpError}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTopUp}
                disabled={anyBusy}
                aria-busy={actionLoading === `topup-${key}`}
              >
                {actionLoading === `topup-${key}` ? "Topping up…" : "➕ Top Up"}
              </button>
              {topUpError && <span role="alert" className="field-error">{topUpError}</span>}
            </div>
          )}
        </div>

        {!publicKey && (
          <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Connect your wallet to perform actions.
          </p>
        )}
      </section>

      {/* ── Withdrawal History ── */}
      <section className="card sdp-section" aria-labelledby="sdp-history-heading">
        <h3 id="sdp-history-heading" className="sdp-section-title">Transaction History</h3>
        {histError && <p role="alert" className="error-banner">{histError}</p>}
        {!histLoading && !histError && records.length === 0 && (
          <p className="muted">No transactions found.</p>
        )}
        {records.length > 0 && (
          <table className="history-table" aria-label="Transaction history">
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}</td>
                  <td>{r.type}</td>
                  <td>{r.amount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {histLoading && <p aria-live="polite" aria-busy="true">Loading…</p>}
        {hasMore && !histLoading && (
          <button
            className="btn btn-secondary"
            onClick={() => loadMore(stream.id)}
            style={{ marginTop: 8 }}
          >
            Load more
          </button>
        )}
      </section>
    </main>
  );
}
