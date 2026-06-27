// SPDX-License-Identifier: Apache-2.0
//! Response schema validators for the stream contract API.

#[cfg(test)]
use crate::types::{Stream, StreamStatus};

/// Validate that a Stream struct has all required fields populated correctly.
#[cfg(test)]
pub fn validate_stream_schema(stream: &Stream) {
    // id must be non-zero (streams start at 1)
    assert!(stream.id > 0, "stream.id must be > 0");
    // deposit and rate must be positive
    assert!(stream.deposit > 0, "stream.deposit must be > 0");
    assert!(stream.rate_per_second > 0, "stream.rate_per_second must be > 0");
    // withdrawn must not exceed deposit
    assert!(
        stream.withdrawn <= stream.deposit,
        "stream.withdrawn must not exceed deposit"
    );
    // status must be a valid variant
    let _ = match stream.status {
        StreamStatus::Active
        | StreamStatus::Paused
        | StreamStatus::Cancelled
        | StreamStatus::Exhausted => true,
    };
    // locked flag must be false when not mid-transaction
    assert!(!stream.locked, "stream.locked must be false outside a transaction");
    // start_time must be set
    assert!(stream.start_time > 0, "stream.start_time must be > 0");
}

/// Validate that a claimable() result is a valid i128 (non-negative).
#[cfg(test)]
pub fn validate_claimable_response(amount: i128) {
    assert!(amount >= 0, "claimable amount must be non-negative, got {amount}");
}

/// Validate that stream_count() result is a non-negative u64.
#[cfg(test)]
pub fn validate_stream_count_response(count: u64) {
    // u64 is always >= 0, just verify it's the right type by using it
    let _ = count;
}
