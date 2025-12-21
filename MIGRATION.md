# Migration Guide: v1.x to v2.0.0

This guide helps you migrate from PinMeTo Location MCP v1.x to v2.0.0.

## Breaking Change: Tool Naming

All 16 tools and 2 prompts have been renamed with a `pinmeto_` prefix to follow MCP best practices for namespacing.

### Why This Change?

1. **Collision Prevention**: The `pinmeto_` prefix prevents naming conflicts when users have multiple MCP servers installed
2. **Discoverability**: Tools are now grouped together alphabetically in tool lists
3. **MCP Best Practice**: Follows the recommended `{service}_{action}_{resource}` naming pattern

## Complete Tool Mapping

### Location Tools

| v1.x Name | v2.0.0 Name |
|-----------|-------------|
| `get_location` | `pinmeto_get_location` |
| `get_locations` | `pinmeto_get_locations` |
| `search_locations` | `pinmeto_search_locations` |

### Google Tools

| v1.x Name | v2.0.0 Name |
|-----------|-------------|
| `get_google_location_insights` | `pinmeto_get_google_insights_location` |
| `get_all_google_insights` | `pinmeto_get_google_insights` |
| `get_all_google_ratings` | `pinmeto_get_google_ratings` |
| `get_google_location_ratings` | `pinmeto_get_google_ratings_location` |
| `get_google_keywords` | `pinmeto_get_google_keywords` |
| `get_google_keywords_for_location` | `pinmeto_get_google_keywords_location` |

### Facebook Tools

| v1.x Name | v2.0.0 Name |
|-----------|-------------|
| `get_facebook_location_insights` | `pinmeto_get_facebook_insights_location` |
| `get_all_facebook_insights` | `pinmeto_get_facebook_insights` |
| `get_all_facebook_brandpage_insights` | `pinmeto_get_facebook_brandpage_insights` |
| `get_all_facebook_ratings` | `pinmeto_get_facebook_ratings` |
| `get_facebook_location_ratings` | `pinmeto_get_facebook_ratings_location` |

### Apple Tools

| v1.x Name | v2.0.0 Name |
|-----------|-------------|
| `get_apple_location_insights` | `pinmeto_get_apple_insights_location` |
| `get_all_apple_insights` | `pinmeto_get_apple_insights` |

### Prompts

| v1.x Name | v2.0.0 Name |
|-----------|-------------|
| `analyze location` | `pinmeto_analyze_location` |
| `summarize all insights` | `pinmeto_summarize_insights` |

## Naming Pattern

The new naming follows a consistent pattern:

```
pinmeto_{action}_{network}_{resource}[_location]
```

- **Bulk tools** (ALL locations): `pinmeto_get_{network}_{resource}`
- **Single-location tools**: `pinmeto_get_{network}_{resource}_location`

Examples:
- `pinmeto_get_google_insights` → ALL locations
- `pinmeto_get_google_insights_location` → SINGLE location (requires `storeId`)

## Migration Steps

1. **Update tool calls** in any scripts or integrations that call PinMeTo tools directly
2. **Reinstall the MCP server** to get the updated tool definitions
3. **No configuration changes needed** - environment variables remain the same

## No Functionality Changes

The tools work exactly the same as before - only the names have changed. Input parameters, output formats, and all features (pagination, filtering, aggregation, response_format) remain identical.
