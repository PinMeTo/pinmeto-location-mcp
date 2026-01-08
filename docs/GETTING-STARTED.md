# Getting Started

Welcome to PinMeTo MCP. This guide helps you get up and running after installation.

---

## Verify Your Installation

After installing, verify that everything is working:

1. **Open Claude Desktop**
2. **Start a new conversation**
3. **Ask Claude:** "Can you list my PinMeTo locations?"

If Claude responds with your location data, you're all set.

---

## Your First Conversations

Here are some simple prompts to get started:

### See Your Locations
```
Show me all my PinMeTo locations
```

### Check Your Ratings
```
What's my average Google rating?
```

### View Recent Reviews
```
Show me recent Google reviews
```

### Get Performance Insights
```
How many views did my locations get on Google last month?
```

---

## What Data Can You Access?

The PinMeTo MCP gives you access to:

| Data Type | Sources | Examples |
|-----------|---------|----------|
| **Locations** | PinMeTo | Names, addresses, hours, status |
| **Insights** | Google, Facebook, Apple | Views, clicks, impressions, calls |
| **Ratings** | Google, Facebook | Average rating, review count, distribution |
| **Reviews** | Google | Review text, ratings, responses |
| **Keywords** | Google | Search terms customers use |

---

## Understanding Your Results

### Ratings Data
- **Average Rating**: Your overall star rating (1-5)
- **Total Reviews**: Number of customer reviews
- **Distribution**: Breakdown by star rating (1-5)

### Insights Data
- **Views**: How often your listing was viewed
- **Searches**: How often you appeared in search results
- **Actions**: Direction requests, calls, website clicks

### Time Ranges
- By default, insights show the total for your requested period
- You can ask for monthly, quarterly, or daily breakdowns
- You can compare to previous periods (last month, last year)

---

## Common Tasks

### Finding a Specific Location
```
Search for my location in Stockholm
Find store ID 1234
```

### Filtering Reviews
```
Show me only negative reviews (1-2 stars)
Show me reviews that haven't been responded to
```

### Comparing Time Periods
```
Compare this month to last month
Show me year-over-year growth
```

### Getting Reports
```
Give me a quarterly performance summary
Create a report of my top 10 performing locations
```

---

## FAQ

### What data can I access?
You can access all data available in your PinMeTo account, including locations, insights from Google/Facebook/Apple, ratings, reviews, and search keywords.

### Is my data secure?
Yes. The MCP connects directly to PinMeTo using your API credentials. Your data is never stored by the MCP server - it only passes through to Claude for analysis.

### How current is the data?
Data is fetched in real-time from PinMeTo. Insights data may have a 24-48 hour delay depending on the platform (Google, Facebook, Apple).

### Can I use this with multiple PinMeTo accounts?
Each installation is configured with one set of credentials. To work with multiple accounts, you would need separate MCP configurations.

### What if I don't have a PinMeTo account?
You need an active PinMeTo account with API access. Visit [pinmeto.com](https://www.pinmeto.com/) to learn more about PinMeTo.

### Does this work with Claude.ai (web)?
This MCP is designed for Claude Desktop. Claude.ai (web version) does not currently support MCP servers.

### Can I modify my location data through Claude?
No. The PinMeTo MCP is read-only. You can view and analyze data, but any changes must be made directly in the PinMeTo platform.

---

## Troubleshooting

### "I don't see PinMeTo in Claude"

**Possible causes:**
1. Installation didn't complete successfully
2. Claude Desktop needs to be restarted

**Solutions:**
- Restart Claude Desktop completely (quit and reopen)
- Re-run the installer (.mcpb file)
- Check Claude Desktop Settings → Developer → MCP Servers

---

### "Authentication failed" or "Invalid credentials"

**Possible causes:**
1. Incorrect API credentials
2. API credentials have been revoked
3. API access is not enabled for your account

**Solutions:**
- Verify your credentials at [PinMeTo Account Settings](https://places.pinmeto.com/account-settings/pinmeto/api/v3)
- Generate new API credentials if needed
- Ensure API access is enabled for your PinMeTo account

---

### "No data returned" or empty results

**Possible causes:**
1. No data exists for the requested time period
2. The store ID doesn't exist
3. Date range is in the future

**Solutions:**
- Try a different date range
- Verify the store ID exists using "Show me all my locations"
- Check that your date range is in the past

---

### "Tool not responding" or timeout errors

**Possible causes:**
1. Network connectivity issues
2. PinMeTo API is temporarily unavailable
3. Request is too large (too many locations/long date range)

**Solutions:**
- Check your internet connection
- Try again in a few minutes
- Narrow your request (specific location, shorter date range)

---

### "Rate limited" error

**Cause:** Too many requests in a short period.

**Solution:** Wait a few minutes before making more requests. The MCP will indicate how long to wait.

---

## Getting More Help

- [Example Prompts](USE-CASES.md) - More examples organized by business need
- [Tools Reference](TOOLS-REFERENCE.md) - Complete documentation of all tools
- [Advanced Features](ADVANCED-FEATURES.md) - Time aggregation and period comparisons
- [PinMeTo Support](https://www.pinmeto.com/contact) - For account or platform issues

---

## Next Steps

Now that you're set up, explore these common workflows:

1. **Daily monitoring**: Check ratings and recent reviews
2. **Weekly analysis**: Compare performance to previous week
3. **Monthly reporting**: Generate comprehensive performance reports
4. **Issue detection**: Find locations needing attention

See [Use Cases](USE-CASES.md) for detailed examples of each workflow.
