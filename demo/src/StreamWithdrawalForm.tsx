// SPDX-License-Identifier: Apache-2.0
import React, { useState, useId } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamWithdrawalFormProps {
  streamId: string;
  /** Claimable (withdrawable) balance in stroops. */
  claimableStroops: bigint;
  /** Estimated transaction fee in stroops. Default: 100 (0.00001 XLM). */
  feeStroops?: bigint;
  /** Called with the withdrawal amount in stroops on confirmed submit. */
  onWithdraw: (amountStroops: bigint) => Promise<void>;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000;

function toXlm(stroops: bigint): string {
  return (Number(stroops) / STROOPS_PER_XLM).toFixed(7);
}

function toStroops(xlm: string): bigint {
  const n = parseFloat(xlm);
  if (isNaN(n) || n <= 0) return 0n;
  return BigInt(Math.floor(n * STROOPS_PER_XLM));
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StreamWithdrawalForm — modal form for withdrawing from an active stream.
 * Shows claimable balance, validates input, displays fee estimate,
 * and requires confirmation before submitting.
 */
export function StreamWithdrawalForm({
  streamId,
  claimableStroops,
  feeStroops = 100n,
  onWithdraw,
  onClose,
}: StreamWithdrawalFormProps) {
  const amountId = useId();
  const [amountXlm, setAmountXlm] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimableXlm = toXlm(claimableStroops);
  const enteredStroops = toStroops(amountXlm);
  const exceedsBalance = enteredStroops > claimableStroops;
  const isEmpty = enteredStroops === 0n;
  const isInvalid = exceedsBalance || isEmpty;

  function handleMaxClick() {
    setAmountXlm(claimableXlm);
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (isInvalid) return;
    setStep("confirm");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onWithdraw(enteredStroops);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-title"
      onKeyDown={handleKeyDown}
    >
      <div className="modal-box">
        <h2 id="withdraw-title" className="modal-title">
          Withdraw from Stream #{streamId}
        </h2>

        {step === "form" ? (
          <form onSubmit={handleSubmitForm} noValidate>
            {/* Claimable balance */}
            <div className="withdraw-balance">
              <span className="withdraw-balance-label">Claimable balance</span>
              <span className="withdraw-balance-value">
                {claimableXlm} XLM
              </span>
            </div>

            {/* Amount input */}
            <div className="field">
              <label htmlFor={amountId} className="field-label">
                Amount (XLM)
              </label>
              <div className="input-with-action">
                <input
                  id={amountId}
                  type="number"
                  className={`input${exceedsBalance ? " input-error" : ""}`}
                  value={amountXlm}
                  onChange={(e) => {
                    setAmountXlm(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.0000000"
                  min="0"
                  step="0.0000001"
                  aria-describedby="amount-hint"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleMaxClick}
                >
                  Max
                </button>
              </div>
              {exceedsBalance && (
                <span id="amount-hint" className="field-error" role="alert">
                  Amount exceeds claimable balance
                </span>
              )}
              {!exceedsBalance && (
                <span id="amount-hint" className="field-hint">
                  Max: {claimableXlm} XLM
                </span>
              )}
            </div>

            {/* Fee estimate */}
            <div className="withdraw-fee">
              <span>Estimated fee</span>
              <span>{toXlm(feeStroops)} XLM</span>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isInvalid}
                aria-disabled={isInvalid}
              >
                Review
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation step */
          <div>
            <p className="modal-warning">
              Please review your withdrawal details.
            </p>
            <dl className="modal-summary">
              <div className="modal-summary-row">
                <dt>Amount</dt>
                <dd className="modal-earned">{amountXlm} XLM</dd>
              </div>
              <div className="modal-summary-row">
                <dt>Estimated fee</dt>
                <dd>{toXlm(feeStroops)} XLM</dd>
              </div>
              <div className="modal-summary-row">
                <dt>Stream</dt>
                <dd>#{streamId}</dd>
              </div>
            </dl>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep("form")}
                disabled={submitting}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Submitting…" : "Confirm Withdrawal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
