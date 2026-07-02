// SPDX-License-Identifier: Apache-2.0

//! Stream state machine — enforces valid state transitions.
//!
//! Valid transitions:
//!   Active    → Paused     (pause_stream)
//!   Active    → Cancelled  (cancel_stream)
//!   Active    → Exhausted  (withdraw empties deposit)
//!   Paused    → Active     (resume_stream)
//!   Paused    → Cancelled  (cancel_stream)
//!
//! Terminal states: Cancelled, Exhausted (no further transitions allowed).

use crate::types::StreamStatus;

pub const ERR_INVALID_TRANSITION: &str = "E028: invalid state transition";
pub const ERR_TERMINAL_STATE: &str = "E029: stream is in a terminal state";

/// Validate that transitioning from `from` → `to` is permitted.
/// Panics with a clear error if the transition is invalid.
pub fn require_transition(from: &StreamStatus, to: &StreamStatus) {
    if !is_valid_transition(from, to) {
        panic!("{}: {:?} -> {:?}", ERR_INVALID_TRANSITION, from, to);
    }
}

/// Returns true if the transition from → to is permitted.
pub fn is_valid_transition(from: &StreamStatus, to: &StreamStatus) -> bool {
    matches!(
        (from, to),
        (StreamStatus::Active, StreamStatus::Paused)
            | (StreamStatus::Active, StreamStatus::Cancelled)
            | (StreamStatus::Active, StreamStatus::Exhausted)
            | (StreamStatus::Paused, StreamStatus::Active)
            | (StreamStatus::Paused, StreamStatus::Cancelled)
    )
}

/// Returns true if the status is a terminal state (no further transitions).
pub fn is_terminal(status: &StreamStatus) -> bool {
    matches!(status, StreamStatus::Cancelled | StreamStatus::Exhausted)
}

/// Validate that the current status is not terminal before attempting an operation.
pub fn require_not_terminal(status: &StreamStatus) {
    if is_terminal(status) {
        panic!("{}", ERR_TERMINAL_STATE);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_transitions() {
        assert!(is_valid_transition(&StreamStatus::Active, &StreamStatus::Paused));
        assert!(is_valid_transition(&StreamStatus::Active, &StreamStatus::Cancelled));
        assert!(is_valid_transition(&StreamStatus::Active, &StreamStatus::Exhausted));
        assert!(is_valid_transition(&StreamStatus::Paused, &StreamStatus::Active));
        assert!(is_valid_transition(&StreamStatus::Paused, &StreamStatus::Cancelled));
    }

    #[test]
    fn invalid_transitions() {
        // Exhausted is terminal
        assert!(!is_valid_transition(&StreamStatus::Exhausted, &StreamStatus::Active));
        assert!(!is_valid_transition(&StreamStatus::Cancelled, &StreamStatus::Active));
        // Paused cannot go to Exhausted directly
        assert!(!is_valid_transition(&StreamStatus::Paused, &StreamStatus::Exhausted));
        // Active cannot resume (already active)
        assert!(!is_valid_transition(&StreamStatus::Active, &StreamStatus::Active));
    }

    #[test]
    fn terminal_states() {
        assert!(is_terminal(&StreamStatus::Cancelled));
        assert!(is_terminal(&StreamStatus::Exhausted));
        assert!(!is_terminal(&StreamStatus::Active));
        assert!(!is_terminal(&StreamStatus::Paused));
    }

    #[test]
    #[should_panic(expected = "E028")]
    fn require_transition_rejects_invalid() {
        require_transition(&StreamStatus::Exhausted, &StreamStatus::Active);
    }

    #[test]
    #[should_panic(expected = "E029")]
    fn require_not_terminal_rejects_cancelled() {
        require_not_terminal(&StreamStatus::Cancelled);
    }
}
