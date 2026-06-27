// SPDX-License-Identifier: Apache-2.0
import React from "react";

/**
 * Base shimmer block — reusable building block for all skeleton variants.
 * Resolves #478.
 */
function SkeletonBlock({
  width = "100%",
  height = "1rem",
  borderRadius = "4px",
  className = "",
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-block${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

// ── Stream List Skeleton ────────────────────────────────────────────────────

/**
 * Placeholder for a single stream card row in a list.
 */
export function StreamListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading streams…">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-list-item">
          <div className="skeleton-list-header">
            <SkeletonBlock width="120px" height="1rem" />
            <SkeletonBlock width="64px" height="1.25rem" borderRadius="12px" />
          </div>
          <div className="skeleton-list-metrics">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="skeleton-metric">
                <SkeletonBlock width="60px" height="0.75rem" />
                <SkeletonBlock width="90px" height="1.1rem" />
              </div>
            ))}
          </div>
          <SkeletonBlock height="8px" borderRadius="4px" className="skeleton-progress" />
        </div>
      ))}
    </div>
  );
}

// ── Chart Skeleton ──────────────────────────────────────────────────────────

/**
 * Placeholder for a chart / graph area.
 */
export function ChartSkeleton({ height = "200px" }: { height?: string }) {
  return (
    <div className="skeleton-chart" aria-busy="true" aria-label="Loading chart…">
      <SkeletonBlock width="140px" height="1rem" className="skeleton-chart-title" />
      <SkeletonBlock height={height} borderRadius="8px" className="skeleton-chart-body" />
      <div className="skeleton-chart-legend">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-legend-item">
            <SkeletonBlock width="12px" height="12px" borderRadius="50%" />
            <SkeletonBlock width="60px" height="0.75rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail Page Skeleton ────────────────────────────────────────────────────

/**
 * Placeholder for a stream detail / profile page.
 */
export function DetailPageSkeleton() {
  return (
    <div className="skeleton-detail" aria-busy="true" aria-label="Loading details…">
      {/* Header */}
      <div className="skeleton-detail-header">
        <SkeletonBlock width="180px" height="1.5rem" />
        <SkeletonBlock width="80px" height="1.5rem" borderRadius="12px" />
      </div>

      {/* Stats grid */}
      <div className="skeleton-detail-stats">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-stat-card">
            <SkeletonBlock width="70px" height="0.75rem" />
            <SkeletonBlock width="110px" height="1.25rem" />
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <SkeletonBlock height="12px" borderRadius="6px" className="skeleton-progress" />

      {/* Action row */}
      <div className="skeleton-detail-actions">
        <SkeletonBlock width="100px" height="2.25rem" borderRadius="6px" />
        <SkeletonBlock width="100px" height="2.25rem" borderRadius="6px" />
      </div>

      {/* Activity feed rows */}
      <div className="skeleton-detail-feed">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-feed-row">
            <SkeletonBlock width="80px" height="0.75rem" />
            <SkeletonBlock width="160px" height="0.75rem" />
            <SkeletonBlock width="60px" height="0.75rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Table Row Skeleton ──────────────────────────────────────────────────────

/**
 * Generic skeleton for a data table — used in transaction history and other
 * data-loading scenarios.
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Loading data…">
      {/* Header */}
      <div className="skeleton-table-row skeleton-table-head">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBlock key={i} width="80px" height="0.75rem" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-table-row">
          {Array.from({ length: cols }, (_, j) => (
            <SkeletonBlock key={j} height="0.875rem" />
          ))}
        </div>
      ))}
    </div>
  );
}
