// SPDX-License-Identifier: Apache-2.0
import { useState, useCallback, useEffect } from "react";

const PAGE_SIZE = 20;

function getPageFromUrl(): number {
  const params = new URLSearchParams(window.location.search);
  const p = parseInt(params.get("page") ?? "1", 10);
  return isNaN(p) || p < 1 ? 1 : p;
}

function setPageInUrl(page: number) {
  const params = new URLSearchParams(window.location.search);
  if (page === 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }
  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

export function usePagination<T>(items: T[]) {
  const [page, setPageState] = useState<number>(getPageFromUrl);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  // Clamp page when items change
  useEffect(() => {
    if (page > totalPages) {
      setPageState(1);
      setPageInUrl(1);
    }
  }, [totalPages, page]);

  const setPage = useCallback((p: number) => {
    setPageState(p);
    setPageInUrl(p);
  }, []);

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return { page, totalPages, pageItems, setPage, pageSize: PAGE_SIZE };
}
