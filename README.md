# iri-mcp

An MCP (Model Context Protocol) server that provides weather, directions, and Google Places tools to Claude Desktop and other MCP-compatible clients.

## Overview

This server exposes 5 tools via the MCP protocol:

| Tool | API | Description |
|------|-----|-------------|
| `get_weather_by_location` | OpenWeatherMap | Current weather forecast for any city |
| `get_directions` | Google Directions API | Turn-by-turn directions between locations |
| `google_search` | Google Places (New) API | Search for places by name or category |
| `get_place_id` | Google Places (New) API | Look up a Google Place ID by name |
| `location_search` | Google Places (New) API | Get full details for a place by ID |

## Prerequisites

- **Node.js** 18 or later
- **OpenWeatherMap API key** — free tier available at [openweathermap.org](https://openweathermap.org/api)
- **Google Maps API key** — enable the following APIs in [Google Cloud Console](https://console.cloud.google.com):
  - Directions API
  - Places API (New)

## Installation

```bash
git clone https://github.com/your-username/iri-mcp.git
cd iri-mcp
npm install
cp .env.example .env
# Edit .env and add your API keys
npm run build
```

## Claude Desktop Configuration

Add the following to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "iri-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/iri-mcp/dist/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "your_openweathermap_api_key_here",
        "GOOGLE_MAPS_API_KEY": "your_google_maps_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after updating the config.

## Tools Reference

### `get_weather_by_location`

Get a weather forecast for a city.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `city_name` | string | Yes | City name (e.g. `"London"`, `"New York"`) |

### `get_directions`

Get turn-by-turn directions between two locations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `origin` | string | Yes | Starting location (address or place name) |
| `destination` | string | Yes | Destination location |
| `travel_mode` | string | No | `driving`, `walking`, `bicycling`, or `transit` (default: `driving`) |

### `google_search`

Search for places using the Google Places API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (e.g. `"sushi restaurants in Tokyo"`) |
| `isOpenNow` | boolean | No | Filter to only show currently open places |
| `minRating` | number | No | Minimum rating filter (0.0–5.0) |

### `get_place_id`

Look up a Google Place ID by name — useful to get an ID for `location_search`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search_query` | string | Yes | Place name (e.g. `"Eiffel Tower Paris"`) |

### `location_search`

Get detailed information about a place using its Google Place ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `place_id` | string | Yes | Google Place ID (e.g. `ChIJD7fiBh9u5kcRYJSMaMOCCwQ`) |

## Development

```bash
# Run without building (uses ts-node)
npm run dev

# Build TypeScript to dist/
npm run build

# Run built server
npm start
```

## Example Prompts for Claude

- "What's the weather like in Berlin right now?"
- "Give me directions from New York to Boston by transit."
- "Find highly-rated sushi restaurants in Tokyo that are open now."
- "What's the Google Place ID for the Louvre museum?"
- "Give me detailed info about this place: ChIJD7fiBh9u5kcRYJSMaMOCCwQ"
