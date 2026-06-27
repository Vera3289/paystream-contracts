// SPDX-License-Identifier: Apache-2.0
import React from "react";

export type StreamStatus = "Active" | "Paused" | "Cancelled" | "Exhausted";

interface StreamStatusBadgeProps {
  status: StreamStatus;
}

const STATUS_META: Record<
  StreamStatus,
  { icon: string; label: string; description: string }
> = {
  Active: {
    icon: "▶",
    label: "Active",
    description: "The stream is running and tokens are being distributed.",
  },
  Paused: {
    icon: "⏸",
    label: "Paused",
    description: "The stream has been temporarily stopped by the employer.",
  },
  Cancelled: {
    icon: "✕",
    label: "Cancelled",
    description: "The stream has been permanently terminated.",
  },
  Exhausted: {
    icon: "■",
    label: "Exhausted",
    description: "The deposit has been fully streamed.",
  },
};

/**
 * Reusable badge component for stream statuses.
 * Color-coded, icon-annotated, with tooltip and screen-reader support.
 */
export function StreamStatusBadge({ status }: StreamStatusBadgeProps) {
  const { icon, label, description } = STATUS_META[status];
  const tooltipId = `status-tooltip-${status}`;

  return (
    <span className="status-badge-container">
      <span
        className={`status-badge status-${status.toLowerCase()}`}
        role="status"
        aria-label={`Status: ${label}`}
        aria-describedby={tooltipId}
      >
        <span className="status-badge-icon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <span
        id={tooltipId}
        className="status-tooltip"
        role="tooltip"
        aria-hidden="true"
      >
        {description}
      </span>
    </span>
  );
}
