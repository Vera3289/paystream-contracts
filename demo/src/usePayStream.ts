import { useState, useCallback, useRef } from "react";
import {
  PayStreamClient,
  connectFreighter,
  freighterSignTransaction,
  isFreighterConnected,
  pollClaimable,
  type Stream,
  type PollHandle,
} from "@paystream/sdk";
import { CONFIG } from "./config";

const client = new PayStreamClient(CONFIG);

export function usePayStream() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [claimableAmounts, setClaimableAmounts] = useState<Record<string, bigint>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollHandles = useRef<Record<string, PollHandle>>({});

  const clearError = () => setError(null);

  const connect = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const connected = await isFreighterConnected();
      if (!connected) {
        setError("Freighter is not installed. Install it from https://freighter.app");
        return;
      }
      const pk = await connectFreighter();
      setPublicKey(pk);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStream = useCallback(async (streamId: bigint) => {
    setLoading(true);
    clearError();
    try {
      const stream = await client.getStream(streamId);
      setStreams((prev) => {
        const idx = prev.findIndex((s) => s.id === streamId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = stream;
          return next;
        }
        return [...prev, stream];
      });

      // Start polling claimable for this stream
      const key = streamId.toString();
      if (!pollHandles.current[key]) {
        pollHandles.current[key] = pollClaimable(
          client,
          streamId,
          5000,
          (amount) => setClaimableAmounts((prev) => ({ ...prev, [key]: amount })),
          (err) => console.error("pollClaimable error:", err)
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const createStream = useCallback(
    async (
      employee: string,
      tokenAddress: string,
      deposit: bigint,
      ratePerSecond: bigint,
      stopTime: bigint
    ) => {
      if (!publicKey) { setError("Connect wallet first"); return; }
      setLoading(true);
      clearError();
      try {
        const xdr = await client.createStream(
          publicKey, employee, tokenAddress, deposit, ratePerSecond, stopTime, 0n
        );
        const signed = await freighterSignTransaction(xdr, CONFIG.networkPassphrase);
        const hash = await client.submitTransaction(signed);
        // Reload stream count and fetch the new stream
        const count = await client.streamCount();
        if (count > 0n) await loadStream(count - 1n);
        return hash;
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [publicKey, loadStream]
  );

  const withdraw = useCallback(
    async (streamId: bigint) => {
      if (!publicKey) { setError("Connect wallet first"); return; }
      setLoading(true);
      clearError();
      try {
        const xdr = await client.withdraw(publicKey, streamId);
        const signed = await freighterSignTransaction(xdr, CONFIG.networkPassphrase);
        const hash = await client.submitTransaction(signed);
        await loadStream(streamId);
        return hash;
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [publicKey, loadStream]
  );

  return {
    publicKey,
    streams,
    claimableAmounts,
    error,
    loading,
    connect,
    loadStream,
    createStream,
    withdraw,
  };
}
