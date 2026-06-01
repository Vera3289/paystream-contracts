// SPDX-License-Identifier: Apache-2.0
import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination" role="navigation" aria-label="Stream list pagination">
      <button
        className="btn btn-secondary pagination-btn"
        onClick={onPrev}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span className="pagination-info" aria-current="page">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn btn-secondary pagination-btn"
        onClick={onNext}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  );
}
