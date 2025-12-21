---
"@pinmeto/pinmeto-location-mcp": minor
---

Replace z.unknown() with concrete Zod output schemas for better type safety and AI client understanding

- Add `AddressSchema`, `ContactSchema`, `OpenHoursSchema` for location data with proper validation
- Add `KeywordDataSchema` for Google keywords API with `.nonnegative()` constraints
- Add `RatingsSummarySchema`, `ReviewSchema`, `LocationRatingsSummarySchema` for ratings data
- Add rating value constraints `.min(1).max(5)` and review count `.nonnegative()` validation
- Add email/URL validation to `ContactSchema` using `.email()` and `.url()`
- Add discrimination guidance to `RatingsDataSchema` JSDoc for union type consumers
- All schemas use `.passthrough()` for forward API compatibility
