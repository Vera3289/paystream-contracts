// SPDX-License-Identifier: Apache-2.0

//! Stream Search and Filter Service (#486).
//!
//! In-process filtering of stream records by recipient, token, status,
//! amount range, date range, with pagination and sorting.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Domain types (mirror on-chain Stream for off-chain use)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum StreamStatus {
    Active,
    Paused,
    Cancelled,
    Exhausted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamRecord {
    pub id: u64,
    pub employer: String,
    pub employee: String,
    pub token: String,
    pub deposit: i128,
    pub withdrawn: i128,
    pub rate_per_second: i128,
    pub start_time: u64,
    pub stop_time: u64,
    pub status: StreamStatus,
}

// ---------------------------------------------------------------------------
// Filter / query types
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct StreamFilter {
    /// Substring match on employee address (case-insensitive).
    pub recipient: Option<String>,
    /// Exact token address match.
    pub token: Option<String>,
    /// Status filter.
    pub status: Option<StreamStatus>,
    /// Minimum deposit (inclusive).
    pub min_deposit: Option<i128>,
    /// Maximum deposit (inclusive).
    pub max_deposit: Option<i128>,
    /// Streams started at or after this timestamp.
    pub start_after: Option<u64>,
    /// Streams started at or before this timestamp.
    pub start_before: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SortField {
    Id,
    Deposit,
    StartTime,
    RatePerSecond,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Clone)]
pub struct QueryOptions {
    pub sort_by: SortField,
    pub order: SortOrder,
    /// 0-based page number.
    pub page: usize,
    pub page_size: usize,
}

impl Default for QueryOptions {
    fn default() -> Self {
        Self {
            sort_by: SortField::Id,
            order: SortOrder::Asc,
            page: 0,
            page_size: 20,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct PagedResult {
    pub items: Vec<StreamRecord>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}

// ---------------------------------------------------------------------------
// Search logic
// ---------------------------------------------------------------------------

/// Filter, sort, and paginate a slice of `StreamRecord`s.
///
/// Clones only matched records to keep memory usage proportional to results.
pub fn search(
    streams: &[StreamRecord],
    filter: &StreamFilter,
    opts: &QueryOptions,
) -> PagedResult {
    let mut matched: Vec<&StreamRecord> = streams.iter().filter(|s| matches_filter(s, filter)).collect();

    matched.sort_by(|a, b| {
        let cmp = match opts.sort_by {
            SortField::Id => a.id.cmp(&b.id),
            SortField::Deposit => a.deposit.cmp(&b.deposit),
            SortField::StartTime => a.start_time.cmp(&b.start_time),
            SortField::RatePerSecond => a.rate_per_second.cmp(&b.rate_per_second),
        };
        if opts.order == SortOrder::Desc { cmp.reverse() } else { cmp }
    });

    let total = matched.len();
    let page_size = opts.page_size.max(1);
    let total_pages = total.div_ceil(page_size);
    let start = (opts.page * page_size).min(total);
    let items = matched[start..].iter().take(page_size).map(|s| (*s).clone()).collect();

    PagedResult { items, total, page: opts.page, page_size, total_pages }
}

fn matches_filter(s: &StreamRecord, f: &StreamFilter) -> bool {
    if let Some(ref q) = f.recipient {
        if !s.employee.to_lowercase().contains(&q.to_lowercase()) {
            return false;
        }
    }
    if let Some(ref token) = f.token {
        if s.token != *token {
            return false;
        }
    }
    if let Some(ref status) = f.status {
        if s.status != *status {
            return false;
        }
    }
    if let Some(min) = f.min_deposit {
        if s.deposit < min {
            return false;
        }
    }
    if let Some(max) = f.max_deposit {
        if s.deposit > max {
            return false;
        }
    }
    if let Some(after) = f.start_after {
        if s.start_time < after {
            return false;
        }
    }
    if let Some(before) = f.start_before {
        if s.start_time > before {
            return false;
        }
    }
    true
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_streams() -> Vec<StreamRecord> {
        vec![
            StreamRecord {
                id: 1, employer: "EMP1".into(), employee: "Alice".into(),
                token: "USDC".into(), deposit: 1000, withdrawn: 0,
                rate_per_second: 1, start_time: 100, stop_time: 0,
                status: StreamStatus::Active,
            },
            StreamRecord {
                id: 2, employer: "EMP1".into(), employee: "Bob".into(),
                token: "USDC".into(), deposit: 500, withdrawn: 0,
                rate_per_second: 2, start_time: 200, stop_time: 0,
                status: StreamStatus::Paused,
            },
            StreamRecord {
                id: 3, employer: "EMP2".into(), employee: "alice_smith".into(),
                token: "XLM".into(), deposit: 2000, withdrawn: 100,
                rate_per_second: 5, start_time: 50, stop_time: 0,
                status: StreamStatus::Active,
            },
        ]
    }

    #[test]
    fn filter_by_recipient_case_insensitive() {
        let streams = sample_streams();
        let f = StreamFilter { recipient: Some("alice".into()), ..Default::default() };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 2); // "Alice" and "alice_smith"
    }

    #[test]
    fn filter_by_token() {
        let streams = sample_streams();
        let f = StreamFilter { token: Some("XLM".into()), ..Default::default() };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, 3);
    }

    #[test]
    fn filter_by_status() {
        let streams = sample_streams();
        let f = StreamFilter { status: Some(StreamStatus::Paused), ..Default::default() };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, 2);
    }

    #[test]
    fn filter_by_amount_range() {
        let streams = sample_streams();
        let f = StreamFilter { min_deposit: Some(600), max_deposit: Some(1500), ..Default::default() };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, 1);
    }

    #[test]
    fn filter_by_date_range() {
        let streams = sample_streams();
        let f = StreamFilter { start_after: Some(80), start_before: Some(150), ..Default::default() };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, 1);
    }

    #[test]
    fn sort_by_deposit_desc() {
        let streams = sample_streams();
        let opts = QueryOptions { sort_by: SortField::Deposit, order: SortOrder::Desc, ..Default::default() };
        let r = search(&streams, &StreamFilter::default(), &opts);
        assert_eq!(r.items[0].id, 3); // deposit=2000
    }

    #[test]
    fn pagination() {
        let streams = sample_streams();
        let opts = QueryOptions { page: 0, page_size: 2, ..Default::default() };
        let r = search(&streams, &StreamFilter::default(), &opts);
        assert_eq!(r.items.len(), 2);
        assert_eq!(r.total, 3);
        assert_eq!(r.total_pages, 2);

        let opts2 = QueryOptions { page: 1, page_size: 2, ..Default::default() };
        let r2 = search(&streams, &StreamFilter::default(), &opts2);
        assert_eq!(r2.items.len(), 1);
    }

    #[test]
    fn combined_filters() {
        let streams = sample_streams();
        let f = StreamFilter {
            token: Some("USDC".into()),
            status: Some(StreamStatus::Active),
            ..Default::default()
        };
        let r = search(&streams, &f, &QueryOptions::default());
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, 1);
    }
}
