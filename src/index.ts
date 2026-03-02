import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Environment variables
// ---------------------------------------------------------------------------

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

// ---------------------------------------------------------------------------
// TypeScript interfaces for API responses
// ---------------------------------------------------------------------------

interface WeatherForecastItem {
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{ description: string }>;
  wind: { speed: number };
}

interface WeatherResponse {
  city: { name: string; country: string };
  list: WeatherForecastItem[];
}

interface DirectionsStep {
  html_instructions: string;
  distance: { text: string };
  duration: { text: string };
  travel_mode: string;
}

interface DirectionsLeg {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_address: string;
  end_address: string;
  steps: DirectionsStep[];
}

interface DirectionsResponse {
  status: string;
  routes: Array<{
    summary: string;
    legs: DirectionsLeg[];
    warnings: string[];
  }>;
}

interface PlacesPlace {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow: boolean };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
}

interface PlacesSearchResponse {
  places?: PlacesPlace[];
}

// ---------------------------------------------------------------------------
// Helper: format error for MCP tool response
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? "unknown";
    const data = err.response?.data as Record<string, unknown> | undefined;
    const message =
      (data?.error as Record<string, unknown> | undefined)?.message ??
      (data?.message as string | undefined) ??
      err.message;
    return `API error (HTTP ${status}): ${message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

// ---------------------------------------------------------------------------
// API handler functions
// ---------------------------------------------------------------------------

async function getWeatherByLocation(cityName: string): Promise<WeatherResponse> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is not configured");
  }
  const response = await axios.get<WeatherResponse>(
    "https://api.openweathermap.org/data/2.5/forecast",
    {
      params: {
        q: cityName,
        appid: OPENWEATHER_API_KEY,
        units: "metric",
        cnt: 16,
      },
    }
  );
  return response.data;
}

async function getDirections(
  origin: string,
  destination: string,
  travelMode: string
): Promise<DirectionsResponse> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }
  const response = await axios.get<DirectionsResponse>(
    "https://maps.googleapis.com/maps/api/directions/json",
    {
      params: {
        origin,
        destination,
        mode: travelMode,
        key: GOOGLE_MAPS_API_KEY,
      },
    }
  );
  return response.data;
}

async function googleSearch(
  query: string,
  isOpenNow?: boolean,
  minRating?: number
): Promise<PlacesSearchResponse> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }
  const body: Record<string, unknown> = { textQuery: query };
  if (isOpenNow !== undefined) body.openNow = isOpenNow;
  if (minRating !== undefined) body.minRating = minRating;

  const response = await axios.post<PlacesSearchResponse>(
    "https://places.googleapis.com/v1/places:searchText",
    body,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.currentOpeningHours",
          "places.websiteUri",
          "places.internationalPhoneNumber",
          "places.types",
          "places.location",
        ].join(","),
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

async function getPlaceId(
  searchQuery: string
): Promise<{ id: string; displayName: string }> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }
  const response = await axios.post<PlacesSearchResponse>(
    "https://places.googleapis.com/v1/places:searchText",
    { textQuery: searchQuery },
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName",
        "Content-Type": "application/json",
      },
    }
  );
  const places = response.data.places;
  if (!places || places.length === 0) {
    throw new Error(`No places found for query: "${searchQuery}"`);
  }
  const first = places[0];
  return {
    id: first.id,
    displayName: first.displayName?.text ?? first.id,
  };
}

async function locationSearch(placeId: string): Promise<PlacesPlace> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }
  const response = await axios.get<PlacesPlace>(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": [
          "id",
          "displayName",
          "formattedAddress",
          "rating",
          "userRatingCount",
          "priceLevel",
          "currentOpeningHours",
          "regularOpeningHours",
          "websiteUri",
          "internationalPhoneNumber",
          "types",
          "location",
          "editorialSummary",
        ].join(","),
      },
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Input schemas
// Note: cast to `any` to work around TypeScript's excessively-deep-type error
// when mixing zod/v3 type identities with the MCP SDK's internal ZodRawShapeCompat.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shape = Record<string, any>;

const weatherInputSchema: Shape = {
  city_name: z.string().min(1),
};

const directionsInputSchema: Shape = {
  origin: z.string().min(1),
  destination: z.string().min(1),
  travel_mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional(),
};

const googleSearchInputSchema: Shape = {
  query: z.string().min(1),
  isOpenNow: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(),
};

const getPlaceIdInputSchema: Shape = {
  search_query: z.string().min(1),
};

const locationSearchInputSchema: Shape = {
  place_id: z.string().min(1),
};

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "iri-mcp", version: "1.0.0" });

server.registerTool(
  "get_weather_by_location",
  {
    description:
      "Get the current weather forecast for a city. Returns temperature (Celsius), humidity, wind speed, and weather description for the next ~2 days.",
    inputSchema: weatherInputSchema,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (args: any) => {
    const { city_name } = args as { city_name: string };
    try {
      const data = await getWeatherByLocation(city_name);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: formatError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_directions",
  {
    description:
      "Get turn-by-turn directions between two locations using Google Maps. Returns route summary, distance, duration, and step-by-step instructions.",
    inputSchema: directionsInputSchema,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (args: any) => {
    const { origin, destination, travel_mode } = args as { origin: string; destination: string; travel_mode?: string };
    try {
      const data = await getDirections(origin, destination, travel_mode ?? "driving");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: formatError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "google_search",
  {
    description:
      "Search for places using Google Places API. Returns a list of matching locations with address, rating, opening hours, and contact info.",
    inputSchema: googleSearchInputSchema,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (args: any) => {
    const { query, isOpenNow, minRating } = args as { query: string; isOpenNow?: boolean; minRating?: number };
    try {
      const data = await googleSearch(query, isOpenNow, minRating);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: formatError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_place_id",
  {
    description:
      "Look up the Google Place ID for a location by name or description. Useful for getting the ID needed for the location_search tool.",
    inputSchema: getPlaceIdInputSchema,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (args: any) => {
    const { search_query } = args as { search_query: string };
    try {
      const data = await getPlaceId(search_query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: formatError(err) }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "location_search",
  {
    description:
      "Get detailed information about a specific place using its Google Place ID. Returns full details including address, hours, rating, website, and phone number.",
    inputSchema: locationSearchInputSchema,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (args: any) => {
    const { place_id } = args as { place_id: string };
    try {
      const data = await locationSearch(place_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: formatError(err) }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("iri-mcp server running on stdio");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
