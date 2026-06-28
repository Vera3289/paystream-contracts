// SPDX-License-Identifier: Apache-2.0
import { useState, useCallback } from "react";
import { CONFIG } from "./config";

export interface TxRecord {
  id: string;
  timestamp: string;
  type: string;
  amount: string | null;
}

const HORIZON_BASE = "https://horizon-testnet.stellar.org";
const PAGE_SIZE = 10;

/** Derive a human-readable event type from a Horizon operation type. */
function opType(op: { type: string; type_i?: number }): string {
  switch (op.type) {
    case "invoke_host_function": return "Contract Call";
    case "payment": return "Payment";
    case "create_account": return "Create Account";
    default: return op.type.replace(/_/g, " ");
  }
}

/** Extract an amount string from a Horizon operation if present. */
function opAmount(op: Record<string, unknown>): string | null {
  if (typeof op.amount === "string") return `${op.amount} XLM`;
  return null;
}

export function useTransactionHistory() {
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchHistory = useCallback(async (streamId: bigint, nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Query operations on the contract account filtered by the stream contract
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        order: "desc",
      });
      if (nextCursor) params.set("cursor", nextCursor);

      const url = `${HORIZON_BASE}/accounts/${CONFIG.contractId}/operations?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Horizon error: ${res.status}`);
      const data = await res.json() as {
        _embedded: { records: Array<Record<string, unknown>> };
        _links: { next?: { href: string } };
      };

      const ops = data._embedded.records;
      const newRecords: TxRecord[] = ops.map((op) => ({
        id: String(op.id),
        timestamp: String(op.created_at ?? ""),
        type: opType(op as { type: string }),
        amount: opAmount(op),
      }));

      setRecords((prev) => nextCursor ? [...prev, ...newRecords] : newRecords);

      // Extract next cursor from paging token of last record
      const lastPagingToken = ops.length > 0 ? String(ops[ops.length - 1].paging_token ?? "") : null;
      setCursor(lastPagingToken);
      setHasMore(ops.length === PAGE_SIZE);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback((streamId: bigint) => {
    if (cursor) fetchHistory(streamId, cursor);
  }, [cursor, fetchHistory]);

  const reset = useCallback(() => {
    setRecords([]);
    setCursor(null);
    setHasMore(false);
    setError(null);
  }, []);

  return { records, loading, error, hasMore, fetchHistory, loadMore, reset };
}
