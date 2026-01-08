# Advanced Features

This guide covers advanced features for power users who want more control over data retrieval and analysis.

---

## Time Aggregation

All insights tools support time aggregation to group metrics by different time periods. This is useful for trend analysis and can significantly reduce the amount of data returned.

### Available Aggregation Levels

| Level | Description | Example Output |
|-------|-------------|----------------|
| `total` (default) | Single aggregated value for entire period | 1 data point |
| `daily` | One value per day | 365 data points/year |
| `weekly` | One value per week | 52 data points/year |
| `monthly` | One value per month | 12 data points/year |
| `quarterly` | One value per quarter | 4 data points/year |
| `half-yearly` | One value per 6 months | 2 data points/year |
| `yearly` | One value per year | 1 data point/year |

### Usage Examples

**Total metrics for the year (default):**
```
"Show me total Google views for 2024"
```

**Monthly trend analysis:**
```
"Show me Google views by month for 2024"
```

**Quarterly business review:**
```
"Give me quarterly Facebook engagement for 2024"
```

### Supported Tools

- `pinmeto_get_google_insights`
- `pinmeto_get_facebook_insights`
- `pinmeto_get_facebook_brandpage_insights`
- `pinmeto_get_apple_insights`

---

## Period Comparison

Compare current metrics against previous periods to identify trends and measure growth.

### Comparison Options

| Option | Description | Use Case |
|--------|-------------|----------|
| `none` (default) | No comparison | Standard metrics retrieval |
| `prior_period` | Compare with immediately preceding period | Month-over-Month, Quarter-over-Quarter |
| `prior_year` | Compare with same period last year | Year-over-Year analysis |

### How It Works

When comparison is enabled, each metric includes:

- **priorValue** - The value from the comparison period
- **delta** - Absolute change (current - prior)
- **deltaPercent** - Percentage change

### Usage Examples

**Year-over-Year comparison:**
```
"Compare this January's Google views to last January"
```

**Month-over-Month trend:**
```
"Show me how Facebook engagement changed from last month"
```

**Quarterly performance review:**
```
"Compare Q4 2024 to Q4 2023 across all metrics"
```

### Example Response

```json
{
  "insights": [
    {
      "metric": "views",
      "value": 1500,
      "priorValue": 1200,
      "delta": 300,
      "deltaPercent": 25
    }
  ],
  "periodRange": { "from": "2024-01-01", "to": "2024-01-31" },
  "priorPeriodRange": { "from": "2023-01-01", "to": "2023-01-31" }
}
```

### Supported Tools

- `pinmeto_get_google_insights`
- `pinmeto_get_facebook_insights`
- `pinmeto_get_facebook_brandpage_insights`
- `pinmeto_get_apple_insights`

---

## Response Formats

All tools support different output formats for flexibility.

### Available Formats

| Format | Description | Best For |
|--------|-------------|----------|
| `json` (default) | Compact JSON structure | Programmatic processing |
| `markdown` | Human-readable tables | Reports and review |

### Usage

Simply ask for the format you prefer:
```
"Show me Google ratings in a table format"
"Give me location data as a formatted report"
```

---

## Combining Features

You can combine aggregation and comparison for powerful analysis:

**Monthly YoY comparison:**
```
"Show me monthly Google views for 2024 compared to 2023"
```

**Quarterly growth analysis:**
```
"Compare quarterly Facebook engagement for 2024 vs 2023"
```

---

## Performance Tips

1. **Use total aggregation** (default) when you only need summary metrics
2. **Filter by storeId** when analyzing specific locations
3. **Use date ranges** appropriate to your analysis needs
4. **Combine with search** to find locations before deep analysis

---

## Related Documentation

- [Tools Reference](TOOLS-REFERENCE.md) - Complete tool documentation
- [Use Cases](USE-CASES.md) - Example prompts by business need
- [Getting Started](GETTING-STARTED.md) - First steps after installation
