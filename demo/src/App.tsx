import React, { useState } from "react";
import { usePayStream } from "./usePayStream";

const STROOP = 10_000_000n; // 1 XLM in stroops

export default function App() {
  const { publicKey, streams, claimableAmounts, error, loading, connect, loadStream, createStream, withdraw } =
    usePayStream();

  // Create stream form state
  const [employee, setEmployee] = useState("");
  const [token, setToken] = useState("");
  const [deposit, setDeposit] = useState("10");
  const [rate, setRate] = useState("1");
  const [stopTime, setStopTime] = useState("0");

  // Load stream form state
  const [lookupId, setLookupId] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStream(
      employee,
      token,
      BigInt(Math.round(parseFloat(deposit) * Number(STROOP))),
      BigInt(rate),
      BigInt(stopTime)
    );
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadStream(BigInt(lookupId));
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>💸 PayStream Demo</h1>
      <p style={{ color: "#666" }}>Testnet — real-time salary streaming on Stellar</p>

      {/* Wallet */}
      <section style={card}>
        <h2>Wallet</h2>
        {publicKey ? (
          <p>
            ✅ Connected: <code style={{ wordBreak: "break-all" }}>{publicKey}</code>
          </p>
        ) : (
          <button onClick={connect} disabled={loading} style={btn}>
            Connect Freighter
          </button>
        )}
      </section>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #f88", padding: 12, borderRadius: 6, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Create Stream */}
      <section style={card}>
        <h2>Create Stream</h2>
        <form onSubmit={handleCreate}>
          <Field label="Employee address" value={employee} onChange={setEmployee} placeholder="G..." />
          <Field label="Token contract ID" value={token} onChange={setToken} placeholder="C..." />
          <Field label="Deposit (XLM)" value={deposit} onChange={setDeposit} type="number" />
          <Field label="Rate (stroops/sec)" value={rate} onChange={setRate} type="number" />
          <Field label="Stop time (unix ts, 0=indefinite)" value={stopTime} onChange={setStopTime} type="number" />
          <button type="submit" disabled={loading || !publicKey} style={btn}>
            {loading ? "…" : "Create Stream"}
          </button>
        </form>
      </section>

      {/* Load Stream */}
      <section style={card}>
        <h2>Load Stream by ID</h2>
        <form onSubmit={handleLookup} style={{ display: "flex", gap: 8 }}>
          <input
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Stream ID"
            style={input}
          />
          <button type="submit" disabled={loading} style={btn}>
            Load
          </button>
        </form>
      </section>

      {/* Stream List */}
      {streams.length > 0 && (
        <section style={card}>
          <h2>Streams</h2>
          {streams.map((s) => {
            const key = s.id.toString();
            const claimable = claimableAmounts[key] ?? 0n;
            return (
              <div key={key} style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
                <p>
                  <strong>Stream #{key}</strong> — <StatusBadge status={s.status} />
                </p>
                <p>Employee: <code>{s.employee}</code></p>
                <p>Rate: {s.ratePerSecond.toString()} stroops/sec</p>
                <p>Deposit: {formatXlm(s.deposit)} XLM | Withdrawn: {formatXlm(s.withdrawn)} XLM</p>
                <p>
                  🔴 Claimable now:{" "}
                  <strong>{formatXlm(claimable)} XLM</strong>{" "}
                  <span style={{ color: "#999", fontSize: 12 }}>(live)</span>
                </p>
                {s.status === "Active" && publicKey === s.employee && (
                  <button onClick={() => withdraw(s.id)} disabled={loading} style={btn}>
                    Withdraw
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 13, marginBottom: 2 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...input, width: "100%" }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: "#2a9d2a",
    Paused: "#e6a817",
    Cancelled: "#cc3333",
    Exhausted: "#888",
  };
  return (
    <span style={{ color: colors[status] ?? "#333", fontWeight: 600 }}>{status}</span>
  );
}

function formatXlm(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(4);
}

const card: React.CSSProperties = {
  background: "#f9f9f9",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
};

const btn: React.CSSProperties = {
  background: "#1a73e8",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 18px",
  cursor: "pointer",
  fontSize: 14,
};

const input: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 4,
  padding: "6px 10px",
  fontSize: 14,
  boxSizing: "border-box",
};
