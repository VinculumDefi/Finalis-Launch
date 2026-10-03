"""Confirmation depth.

Bitcoin's count is six and Zcash's count is ten: those are the protocol
constants already used by this lock (VF-XCH-027, VF-XCH-031).

Litecoin, Bitcoin Cash, DigiByte, and Dogecoin have no protocol constant.
Their counts are the single exchange figures recorded in CONFIRMATION_COUNTS.md.
They are not Bitcoin's six.

Coinbase-maturity constants are a different rule and are not used.
"""

from __future__ import annotations

# Bitcoin and Zcash are protocol constants. The other four are the sourced
# exchange counts in CONFIRMATION_COUNTS.md, not copies of Bitcoin's six.
PROTOCOL_CONFIRMATIONS = {
    "bitcoin": 6,
    "zcash": 10,
    "litecoin": 24,
    "bitcoin-cash": 15,
    "digibyte": 10,
    "dogecoin": 60,
}


class FinalityError(Exception):
    pass


class ConfirmationTooShallow(FinalityError):
    pass


def enforce_confirmation_depth(chain: str, depth: int) -> None:
    """Accept depth only when it meets the count recorded for this chain.

    Depth below the count throws. Depth at or above the count is accepted.
    """
    if isinstance(depth, bool) or not isinstance(depth, int):
        raise FinalityError("confirmation depth must be an integer")
    if chain not in PROTOCOL_CONFIRMATIONS:
        raise FinalityError(f"no finality rule implemented for {chain}")
    required = PROTOCOL_CONFIRMATIONS[chain]
    if depth < required:
        raise ConfirmationTooShallow(
            f"{chain} depth {depth} is below the required count {required}"
        )
