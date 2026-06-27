// SPDX-License-Identifier: Apache-2.0
import React, { useState } from "react";

interface PauseResumeControlsProps {
  streamId: string;
  status: "Active" | "Paused";
  onPause: (streamId: string) => Promise<void>;
  onResume: (streamId: string) => Promise<void>;
}

type ModalAction = "pause" | "resume" | null;

/**
 * PauseResumeControls — shows a Pause button for active streams and a Resume
 * button for paused streams. Requires confirmation via a modal before
 * submitting the on-chain transaction.
 *
 * Resolves #479.
 */
export function PauseResumeControls({
  streamId,
  status,
  onPause,
  onResume,
}: PauseResumeControlsProps) {
  const [pending, setPending] = useState<ModalAction>(null);
  const [busy, setBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openModal = (action: ModalAction) => {
    setTxError(null);
    setSuccess(null);
    setPending(action);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    setTxError(null);
    try {
      if (pending === "pause") {
        await onPause(streamId);
        setSuccess("Stream paused successfully.");
      } else {
        await onResume(streamId);
        setSuccess("Stream resumed successfully.");
      }
      setPending(null);
    } catch (e) {
      setTxError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setPending(null);
  };

  return (
    <>
      {/* Action buttons */}
      <div className="pause-resume-controls">
        {status === "Active" && (
          <button
            className="btn btn-warning"
            onClick={() => openModal("pause")}
            disabled={busy}
            aria-label={`Pause stream ${streamId}`}
          >
            ⏸ Pause
          </button>
        )}
        {status === "Paused" && (
          <button
            className="btn btn-success"
            onClick={() => openModal("resume")}
            disabled={busy}
            aria-label={`Resume stream ${streamId}`}
          >
            ▶ Resume
          </button>
        )}
        {success && <span className="field-hint" style={{ color: "var(--status-active)" }}>{success}</span>}
      </div>

      {/* Confirmation modal */}
      {pending && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pr-modal-title"
          onKeyDown={handleKeyDown}
        >
          <div className="modal-box">
            <h2 id="pr-modal-title" className="modal-title">
              {pending === "pause" ? "Pause" : "Resume"} Stream #{streamId}?
            </h2>
            <p className="modal-warning">
              {pending === "pause"
                ? "⏸ Earnings will stop accruing until the stream is resumed."
                : "▶ Earnings will resume accruing from this moment."}
            </p>

            {txError && (
              <div className="error-box" role="alert">
                <span>{txError}</span>
                <button className="btn btn-secondary" onClick={handleConfirm} disabled={busy}>
                  Retry
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className={`btn ${pending === "pause" ? "btn-warning" : "btn-success"}`}
                onClick={handleConfirm}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Submitting…" : pending === "pause" ? "Confirm Pause" : "Confirm Resume"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
