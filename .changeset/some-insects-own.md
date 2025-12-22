---
"@pinmeto/pinmeto-location-mcp": minor
---

Split Google ratings into separate ratings and reviews tools

- **New tool**: `pinmeto_get_google_reviews` - Fetch individual reviews with pagination (`limit`, `offset`) and filtering (`minRating`, `maxRating`, `hasResponse`) for sentiment analysis
- **Changed**: `pinmeto_get_google_ratings` now returns aggregate statistics only (averageRating, totalReviews, distribution) - no longer includes individual review text
- **Added**: Shared 5-minute cache between ratings and reviews tools for efficiency
- **Added**: Date validation to all tools (Google, Facebook, Apple) - invalid dates like June 31st now return clear error messages

**Breaking change**: Callers expecting review text from `pinmeto_get_google_ratings` must switch to `pinmeto_get_google_reviews`.
