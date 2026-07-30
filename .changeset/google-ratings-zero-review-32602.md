---
"@pinmeto/pinmeto-location-mcp": patch
---

Fix `-32602` output-validation crash in `pinmeto_get_google_ratings`. A single-store query for a period with no reviews returned `averageRating: 0`, which the ratings output schema rejected (`averageRating` had a `min(1)` floor), killing the call. The floor is relaxed to `min(0)` so a zero-review store returns a clean summary (`averageRating: 0, totalReviews: 0`) instead of failing. The all-locations path was unaffected because it omits stores with no reviews.
