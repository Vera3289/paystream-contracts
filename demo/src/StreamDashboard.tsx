// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useRef } from "react";
import { useEmployerDashboard } from "./useEmployerDashboard";
import { StreamStatusBadge } from "./StreamStatusBadge";
import { StreamCardSkeleton } from "./StreamCardSkeleton";
import type { Stream } from "@paystream/sdk";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtXlm(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(4);
}

function fmtRate(stroopsPerSec: bigint): string {
  const xlmPerSec = Number(stroopsPerSec) / 10_000_000;
  if (xlmPerSec >= 0.01) return `${xlmPerSec.toFixed(4)} XLM/s`;
  return `${(xlmPerSec * 60).toFixed(4)} XLM/min`;
}

function monthlyBurnXlm(stroopsPerSec: bigint): number {
  return (Number(stroopsPerSec) / 10_000_000) * 60 * 60 * 24 * 30;
}

function truncate(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div
      className="db-stat-card"
      style={{ "--db-accent": accent } as React.CSSProperties}
    >
      <span className="db-stat-value">{value}</span>
      <span className="db-stat-label">{label}</span>
    </div>
  );
}

// ─── StreamRow ────────────────────────────────────────────────────────────────

interface StreamRowProps {
  stream: Stream;
  actionLoading: string | null;
  onAction: (action: "pause" | "resume", id: bigint) => void;
  onWithdraw: (id: bigint) => void;
}

function StreamRow({ stream, actionLoading, onAction, onWithdraw }: StreamRowProps) {
  const id = stream.id;
  const isPauseLoading = actionLoading === `pause-${id}`;
  const isResumeLoading = actionLoading === `resume-${id}`;
  const isActive = stream.status === "Active";
  const isPaused = stream.status === "Paused";

  return (
    <div className="stream-dashboard-row" role="listitem">
      <div className="stream-dashboard-row-header">
        <span className="stream-dashboard-id">#{id.toString()}</span>
        <StreamStatusBadge status={stream.status as any} />
      </div>

      <dl className="stream-dashboard-meta">
        <div>
          <dt>Employee</dt>
          <dd title={stream.employee}>{truncate(stream.employee)}</dd>
        </div>
        <div>
          <dt>Locked</dt>
          <dd>{fmtXlm(stream.deposit - stream.withdrawn)} XLM</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{fmtRate(stream.rate_per_second)}</dd>
        </div>
        <div>
          <dt>Withdrawn</dt>
          <dd>{fmtXlm(stream.withdrawn)} XLM</dd>
        </div>
      </dl>

      <div className="stream-dashboard-actions">
        {isActive && (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => onAction("pause", id)}
            disabled={!!actionLoading}
            aria-busy={isPauseLoading}
          >
            {isPauseLoading ? "Pausing…" : "Pause"}
          </button>
        )}
        {isPaused && (
          <button
            className="btn btn-success btn-sm"
            onClick={() => onAction("resume", id)}
            disabled={!!actionLoading}
            aria-busy={isResumeLoading}
          >
            {isResumeLoading ? "Resuming…" : "Resume"}
          </button>
        )}
        {(isActive || isPaused) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onWithdraw(id)}
            disabled={!!actionLoading}
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}

// ─── StreamDashboard ──────────────────────────────────────────────────────────

interface StreamDashboardProps {
  /** Optional pre-connected wallet public key. */
  walletPublicKey?: string | null;
  /** Called when user clicks Withdraw on a stream. */
  onWithdrawRequest?: (streamId: bigint) => void;
  /** Polling interval for real-time balance updates (ms). 0 = disabled. */
  pollIntervalMs?: number;
}

/**
 * StreamDashboard — overview of all streams for the connected employer.
 * Shows total locked balance, monthly burn rate, stream grid with quick actions.
 * Streams sorted newest-first (highest id first).
 * Supports periodic polling for real-time balance updates.
 */
export function StreamDashboard({
  walletPublicKey,
  onWithdrawRequest,
  pollIntervalMs = 15_000,
}: StreamDashboardProps) {
  const {
    publicKey,
    streams,
    stats,
    loading,
    actionLoading,
    error,
    scanned,
    chainTotal,
    connect,
    refresh,
    handleAction,
  } = useEmployerDashboard(walletPublicKey);

  // ── Polling for real-time updates ─────────────────────────────────────────
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!publicKey || pollIntervalMs <= 0) return;
    const id = setInterval(() => refreshRef.current(), pollIntervalMs);
    return () => clearInterval(id);
  }, [publicKey, pollIntervalMs]);

  // ── Sorted streams (newest first) ─────────────────────────────────────────
  const sortedStreams = [...streams].sort((a, b) =>
    a.id > b.id ? -1 : a.id < b.id ? 1 : 0
  );

  // ── Aggregate metrics ─────────────────────────────────────────────────────
  const totalBurnRate = streams
    .filter((s) => s.status === "Active")
    .reduce((sum, s) => sum + monthlyBurnXlm(s.rate_per_second), 0);

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!publicKey) {
    return (
      <div className="stream-dashboard-empty">
        <p>Connect your wallet to view your stream dashboard.</p>
        <button className="btn btn-primary" onClick={connect} disabled={loading}>
          {loading ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  return (
    <section className="stream-dashboard" aria-label="Stream Dashboard">
      {/* ── Summary Stats ── */}
      <div className="db-stat-grid" role="list" aria-label="Dashboard statistics">
        <StatCard
          label="Total Locked"
          value={`${stats.totalLockedXlm.toFixed(4)} XLM`}
          accent="var(--stat-blue, var(--btn-bg))"
        />
        <StatCard
          label="Monthly Burn Rate"
          value={`${totalBurnRate.toFixed(2)} XLM`}
          accent="var(--stat-amber, var(--status-paused))"
        />
        <StatCard
          label="Active Streams"
          value={stats.active}
          accent="var(--stat-green, var(--status-active))"
        />
        <StatCard
          label="Total Streams"
          value={stats.total}
          accent="var(--stat-purple, var(--text-muted))"
        />
      </div>

      {/* ── Header + actions ── */}
      <div className="stream-dashboard-header">
        <h2 className="stream-dashboard-title">
          Streams
          {loading && scanned > 0 && (
            <span className="stream-dashboard-scanning" aria-live="polite">
              {" "}(scanning {scanned}/{chainTotal})
            </span>
          )}
        </h2>
        <button
          className="btn btn-secondary btn-sm"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh streams"
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {/* ── Loading skeletons ── */}
      {loading && streams.length === 0 && (
        <div
          className="stream-dashboard-grid"
          role="list"
          aria-label="Loading streams"
          aria-busy="true"
        >
          {[1, 2, 3].map((i) => (
            <StreamCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && streams.length === 0 && (
        <p className="stream-dashboard-none">No streams found for your address.</p>
      )}

      {/* ── Stream grid ── */}
      {sortedStreams.length > 0 && (
        <div
          className="stream-dashboard-grid"
          role="list"
          aria-label="Stream list"
        >
          {sortedStreams.map((stream) => (
            <StreamRow
              key={stream.id.toString()}
              stream={stream}
              actionLoading={actionLoading}
              onAction={(action, id) => handleAction(action, id)}
              onWithdraw={(id) => onWithdrawRequest?.(id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
