---
"@pinmeto/pinmeto-location-mcp": minor
---

Add period comparison support (MoM, QoQ, YoY) to all insights tools

**New Features:**

- **Period Comparisons**: All insights tools (Google, Facebook, Apple) now support a `compare_with` parameter:
  - `compare_with="prior_period"` - Compare with same-duration period immediately before (MoM for monthly, QoQ for quarterly)
  - `compare_with="prior_year"` - Compare with same dates in previous year (YoY)
  - Returns `comparisonData` with `current`, `prior`, `delta`, and `deltaPercent` for each metric

- **Human-Readable Period Labels**: Aggregated metrics now include a `label` field with human-readable period names:
  - "2024-01" → "January 2024"
  - "2024-Q1" → "Q1 2024"
  - "2024-H1" → "H1 2024"

- **Google Data Lag Warnings**: Google tools now validate the `to` date and return a warning if data may be incomplete due to Google's ~10 day reporting lag:
  - `warning` and `warningCode: "INCOMPLETE_DATA"` in structuredContent
  - Includes recommended date for complete data

**Enhanced Markdown Output:**
- Comparison tables with Period | Current | Prior | Change | % Change columns
- Uses human-readable period labels in tables

**Backward Compatibility:**
- All new parameters are optional with safe defaults (`compare_with: "none"`)
- Existing tool calls work identically
- New output fields are additive and optional
