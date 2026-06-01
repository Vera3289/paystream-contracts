// SPDX-License-Identifier: Apache-2.0
import React from "react";
import type { Toast } from "./useToast";

const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

const ICONS: Record<string, string> = {
  pending: "⏳",
  success: "✅",
  error: "❌",
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">{ICONS[t.type]}</span>
          <span className="toast-message">
            {t.message}
            {t.txHash && (
              <>
                {" "}
                <a
                  href={`${EXPLORER_BASE}/${t.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="toast-link"
                >
                  View tx ↗
                </a>
              </>
            )}
          </span>
          <button
            className="toast-close"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
