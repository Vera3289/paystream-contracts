// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useMemo, useState } from "react";
import { useTransactionHistory, type TxRecord } from "./useTransactionHistory";
import { buildCsv, downloadCsv } from "./csvExport";
import { explorerTxUrl } from "./config";

const PAGE_SIZE = 50;

type SortField = "timestamp" | "amount" | "type";
type SortDir = "asc" | "desc";

const TX_TYPES = ["All", "Contract Call", "Payment", "Create Account"] as const;

interface TransactionHistoryProps {
  streamId: bigint;
  employee?: string;
  token?: string;
}

/** Parse a numeric-ish amount string for sorting ("1.0000 XLM" → 1). */
function parseAmount(a: string | null): number {
  if (!a) return 0;
  return parseFloat(a) || 0;
}

/**
 * TransactionHistory — full transaction history view for a stream.
 *
 * Features:
 *   - All transactions with timestamp and amount
 *   - Filter by transaction type
 *   - Sort by date, amount, or type
 *   - CSV export
 *   - Client-side pagination (50 items/page)
 *   - Link to Stellar explorer for on-chain verification
 *
 * Resolves #477.
 */
export function TransactionHistory({
  streamId,
  employee = "",
  token = "",
}: TransactionHistoryProps) {
  const { records, loading, error, hasMore, fetchHistory, loadMore } = useTransactionHistory();

  const [filterType, setFilterType] = useState<string>("All");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchHistory(streamId);
    setPage(1);
  }, [streamId]);

  // Filter
  const filtered = useMemo(
    () => (filterType === "All" ? records : records.filter((r) => r.type === filterType)),
    [records, filterType]
  );

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "timestamp") {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === "amount") {
        cmp = parseAmount(a.amount) - parseAmount(b.amount);
      } else {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleExport = () => {
    const csv = buildCsv(sorted, streamId, employee, token);
    downloadCsv(csv, `stream-${streamId}-history.csv`);
  };

  const SortIndicator = ({ field }: { field: SortField }) =>
    sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <section className="tx-history" aria-label="Transaction history">
      {/* Toolbar */}
      <div className="tx-history-toolbar">
        <div className="tx-history-filters">
          <label htmlFor="tx-type-filter" className="field-label">
            Type
          </label>
          <select
            id="tx-type-filter"
            className="input"
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          >
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-secondary" onClick={handleExport} disabled={sorted.length === 0}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-box" role="alert">
          {error}
          <button className="btn btn-secondary" onClick={() => fetchHistory(streamId)}>
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="tx-table-wrapper" role="region" aria-label="Transactions table" tabIndex={0}>
        <table className="tx-table">
          <thead>
            <tr>
              <th>
                <button className="tx-sort-btn" onClick={() => toggleSort("timestamp")}>
                  Date{SortIndicator({ field: "timestamp" })}
                </button>
              </th>
              <th>
                <button className="tx-sort-btn" onClick={() => toggleSort("type")}>
                  Type{SortIndicator({ field: "type" })}
                </button>
              </th>
              <th>
                <button className="tx-sort-btn" onClick={() => toggleSort("amount")}>
                  Amount{SortIndicator({ field: "amount" })}
                </button>
              </th>
              <th>Explorer</th>
            </tr>
          </thead>
          <tbody>
            {loading && paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="tx-empty">Loading…</td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="tx-empty">No transactions found.</td>
              </tr>
            ) : (
              paginated.map((r: TxRecord) => (
                <tr key={r.id}>
                  <td className="tx-date">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}
                  </td>
                  <td>
                    <span className="tx-type-badge">{r.type}</span>
                  </td>
                  <td className="tx-amount">{r.amount ?? "—"}</td>
                  <td>
                    <a
                      href={explorerTxUrl(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-explorer-link"
                      aria-label={`View transaction ${r.id} on Stellar explorer`}
                    >
                      ↗ View
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="tx-pagination">
        <button
          className="btn btn-secondary"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="tx-page-info">
          Page {page} of {totalPages}
          {" "}({sorted.length} transaction{sorted.length !== 1 ? "s" : ""})
        </span>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (page < totalPages) {
              setPage((p) => p + 1);
            } else if (hasMore) {
              loadMore(streamId);
            }
          }}
          disabled={page >= totalPages && !hasMore}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </section>
  );
}
