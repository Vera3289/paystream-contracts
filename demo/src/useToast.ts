// SPDX-License-Identifier: Apache-2.0
import { useState, useCallback, useRef } from "react";

export type ToastType = "pending" | "success" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  txHash?: string;
}

let counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, txHash?: string): string => {
      const id = String(++counter);
      setToasts((prev) => [...prev, { id, type, message, txHash }]);
      if (type !== "pending") {
        timers.current[id] = setTimeout(() => dismiss(id), 5000);
      }
      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (id: string, type: ToastType, message: string, txHash?: string) => {
      clearTimeout(timers.current[id]);
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, type, message, txHash } : t))
      );
      timers.current[id] = setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return { toasts, add, update, dismiss };
}
