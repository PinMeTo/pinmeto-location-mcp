# Tools Reference

This document provides complete documentation for all available PinMeTo MCP tools. For common use cases and example prompts, see [Use Cases](USE-CASES.md).

---

## Overview

The PinMeTo MCP provides 12 tools organized by data source:

| Category | Tools | Description |
|----------|-------|-------------|
| Location | 3 | Manage and search your locations |
| Google | 5 | Insights, ratings, reviews, and keywords from Google |
| Facebook | 3 | Insights and ratings from Facebook |
| Apple | 1 | Insights from Apple Maps |

All tools use the `pinmeto_` prefix following MCP best practices.

---

## Location Tools

### pinmeto_get_location

Get detailed information for a single location.

**When to use:** You need complete details about a specific location (address, hours, status, etc.)

**Parameters:**
- `storeId` (required) - The unique store identifier

---

### pinmeto_get_locations

Get all locations with filtering and pagination.

**When to use:** You need to see all locations, filter by criteria, or export location data.

**Parameters:**
- `limit` - Maximum results (default: 50, max: 1000)
- `offset` - Skip N results for pagination
- `city` - Filter by city name
- `country` - Filter by country name
- `permanentlyClosed` - Filter by closure status (true/false)
- `type` - Filter by type ("location" or "serviceArea")

---

### pinmeto_search_locations

Search locations by name, address, or store ID.

**When to use:** You're looking for specific locations but don't know the exact store ID.

**Parameters:**
- `query` (required) - Search term (matches name, storeId, address, city, country)
- `limit` - Maximum results (default: 50)

---

## Google Tools

### pinmeto_get_google_insights

Get performance metrics from Google Business Profile.

**When to use:** Analyze how customers find and interact with your locations on Google.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `from` (required) - Start date (YYYY-MM-DD)
- `to` (required) - End date (YYYY-MM-DD)
- `aggregation` - Time grouping: total, daily, weekly, monthly, quarterly, half-yearly, yearly
- `compare_with` - Period comparison: none, prior_period, prior_year

**Metrics returned:** Views, searches, direction requests, calls, website clicks, and more.

---

### pinmeto_get_google_ratings

Get rating statistics from Google.

**When to use:** Check your average ratings and review distribution.

**Parameters:**
- `storeId` - Single location (omit for all locations)

**Returns:** Average rating, total reviews, rating distribution (1-5 stars).

---

### pinmeto_get_google_reviews

Get individual Google reviews for analysis.

**When to use:** Read actual customer reviews, identify issues, or analyze sentiment.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `limit` - Maximum reviews (default: 50, max: 500)
- `offset` - Skip N reviews for pagination
- `minRating` - Minimum star rating (1-5)
- `maxRating` - Maximum star rating (1-5)
- `hasResponse` - Filter by response status (true = responded, false = unresponded)

---

### pinmeto_get_google_keywords

Get search keywords customers use to find your locations.

**When to use:** Understand how customers search for your business on Google.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `from` (required) - Start date (YYYY-MM-DD)
- `to` (required) - End date (YYYY-MM-DD)

---

### pinmeto_get_google_review_insights

AI-powered analysis of Google reviews.

**When to use:** Get automated summaries, identify common issues, and spot trends in reviews.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `limit` - Number of reviews to analyze (default: 50)

**Note:** Requires MCP Sampling support in your client.

---

## Facebook Tools

### pinmeto_get_facebook_insights

Get performance metrics from Facebook pages.

**When to use:** Analyze engagement and reach on Facebook.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `from` (required) - Start date (YYYY-MM-DD)
- `to` (required) - End date (YYYY-MM-DD)
- `aggregation` - Time grouping: total, daily, weekly, monthly, quarterly, half-yearly, yearly
- `compare_with` - Period comparison: none, prior_period, prior_year

---

### pinmeto_get_facebook_brandpage_insights

Get insights for your Facebook brand pages.

**When to use:** Monitor overall brand presence across Facebook.

**Parameters:**
- `from` (required) - Start date (YYYY-MM-DD)
- `to` (required) - End date (YYYY-MM-DD)
- `aggregation` - Time grouping: total, daily, weekly, monthly, quarterly, half-yearly, yearly
- `compare_with` - Period comparison: none, prior_period, prior_year

---

### pinmeto_get_facebook_ratings

Get Facebook ratings and recommendations.

**When to use:** Check your Facebook rating performance.

**Parameters:**
- `storeId` - Single location (omit for all locations)

---

## Apple Tools

### pinmeto_get_apple_insights

Get performance metrics from Apple Maps.

**When to use:** Understand how customers interact with your locations on Apple Maps.

**Parameters:**
- `storeId` - Single location (omit for all locations)
- `from` (required) - Start date (YYYY-MM-DD)
- `to` (required) - End date (YYYY-MM-DD)
- `aggregation` - Time grouping: total, daily, weekly, monthly, quarterly, half-yearly, yearly
- `compare_with` - Period comparison: none, prior_period, prior_year

---

## Advanced Features

For detailed documentation on time aggregation and period comparison features, see [Advanced Features](ADVANCED-FEATURES.md).

---

## Need Help?

- [Getting Started](GETTING-STARTED.md) - First steps and verification
- [Use Cases](USE-CASES.md) - Example prompts by business need
- [Troubleshooting](GETTING-STARTED.md#troubleshooting) - Common issues and solutions
