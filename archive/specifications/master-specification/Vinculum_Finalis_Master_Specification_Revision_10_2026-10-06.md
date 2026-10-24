# Vinculum Finalis Master Specification — Revision 10

**Date:** 6 October 2026  
**Status:** Clarification addendum to Revision 9. Does not replace Revision 9.

## Duration display rule

The sixteen durations are stored in seconds in `COMMITMENT_DURATIONS` in `src/lib/vfRevision6Authority.js`. The contract values are unchanged.

The Base44 user interface displays them as:

- 1 hour
- 7 days
- 30 days
- 60 days
- 90 days
- 180 days
- 1 year
- 2 years
- 3 years
- 4 years
- 5 years
- 6 years
- 7 years
- 8 years
- 9 years
- 10 years

Anything under a year is shown in days. A year and above is shown in years. Never show those ten as day counts.
