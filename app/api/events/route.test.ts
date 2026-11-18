import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

function mockJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
    async text() {
      return typeof payload === "string" ? payload : JSON.stringify(payload);
    }
  };
}

function installFetchMock(options?: { failWeather?: boolean; duplicateWeather?: boolean }) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);

    if (url.includes("earthquake.usgs.gov")) {
      return mockJsonResponse({
        features: [
          {
            id: "eq-1",
            properties: {
              mag: 5.2,
              place: "Near Test City",
              alert: "red",
              time: 1_700_000_000_000,
              title: "Magnitude 5.2 - Near Test City",
              url: "https://example.com/eq-1"
            }
          }
        ]
      });
    }

    if (url.includes("api.weather.gov")) {
      if (options?.failWeather) {
        return mockJsonResponse({ error: "weather down" }, 500);
      }

      return mockJsonResponse({
        features: [
          ...(options?.duplicateWeather
            ? [
                {
                  id: "wx-dup",
                  properties: {
                    sent: "2026-07-06T10:00:00.000Z",
                    areaDesc: "Denver;Aurora",
                    event: "Severe Thunderstorm Warning",
                    severity: "Severe",
                    headline: "Severe storms expected",
                    uri: "https://example.com/wx-dup"
                  }
                },
                {
                  id: "wx-dup",
                  properties: {
                    sent: "2026-07-06T10:00:10.000Z",
                    areaDesc: "Denver;Aurora",
                    event: "Severe Thunderstorm Warning",
                    severity: "Severe",
                    headline: "Severe storms expected",
                    uri: "https://example.com/wx-dup"
                  }
                }
              ]
            : [
                {
                  id: "wx-1",
                  properties: {
                    sent: "2026-07-06T10:00:00.000Z",
                    areaDesc: "Denver;Aurora",
                    event: "Severe Thunderstorm Warning",
                    severity: "Severe",
                    headline: "Severe storms expected",
                    uri: "https://example.com/wx-1"
                  }
                }
              ])
        ]
      });
    }

    if (url.includes("api.coingecko.com")) {
      return mockJsonResponse({
        bitcoin: { usd: 100000, usd_24h_change: 3.12, last_updated_at: 1_700_000_100 },
        ethereum: { usd: 5000, usd_24h_change: -1.45, last_updated_at: 1_700_000_110 },
        solana: { usd: 200, usd_24h_change: 0.42, last_updated_at: 1_700_000_120 },
        binancecoin: { usd: 700, usd_24h_change: -0.75, last_updated_at: 1_700_000_130 }
      });
    }

    if (url.includes("statsapi.mlb.com")) {
      return mockJsonResponse({
        dates: [
          {
            games: [
              {
                gamePk: 123,
                teams: {
                  away: { team: { name: "Sharks" }, score: 4 },
                  home: { team: { name: "Kings" }, score: 2 }
                },
                status: {
                  abstractGameState: "Final",
                  detailedState: "Final"
                },
                venue: { name: "Test Field" },
                gameDate: "2026-07-06T09:00:00.000Z"
              }
            ]
          }
        ]
      });
    }

    if (url.includes("yahoo.com/news")) {
      return mockJsonResponse(`<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>Major global headline</title>
            <link>https://www.yahoo.com/news/major-global-headline</link>
            <guid>yahoo-major-1</guid>
            <pubDate>Mon, 06 Jul 2026 11:00:00 GMT</pubDate>
            <description><![CDATA[Top general-news headline from Yahoo News.]]></description>
          </item>
        </rss>`);
    }

    throw new Error(`Unexpected URL in test: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/events", () => {
  it("returns expected payload shape and descending time sort", async () => {
    installFetchMock();

    const response = await GET(new NextRequest("http://localhost:3000/api/events"));
    const data = (await response.json()) as {
      events: Array<{ time: number }>;
      liveCount: number;
      sourcesDown: number;
      generatedAt: number;
    };

    expect(Array.isArray(data.events)).toBe(true);
    expect(data.liveCount).toBe(8);
    expect(data.sourcesDown).toBe(0);
    expect(typeof data.generatedAt).toBe("number");

    for (let index = 1; index < data.events.length; index++) {
      expect(data.events[index - 1].time).toBeGreaterThanOrEqual(data.events[index].time);
    }
  });

  it("passes lat/lon query to weather source URL", async () => {
    const fetchMock = installFetchMock();

    await GET(new NextRequest("http://localhost:3000/api/events?lat=39.7392&lon=-104.9903"));

    const weatherCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("api.weather.gov"));
    expect(weatherCall).toBeTruthy();
    expect(String(weatherCall?.[0])).toContain("point=39.7392,-104.9903");
  });

  it("keeps returning events when one source fails", async () => {
    installFetchMock({ failWeather: true });

    const response = await GET(new NextRequest("http://localhost:3000/api/events"));
    const data = (await response.json()) as {
      events: unknown[];
      liveCount: number;
      sourcesDown: number;
    };

    expect(data.sourcesDown).toBe(1);
    expect(data.liveCount).toBeGreaterThan(0);
    expect(data.events.length).toBeGreaterThan(0);
  });

  it("dedupes duplicate source records by event id", async () => {
    installFetchMock({ duplicateWeather: true });

    const response = await GET(new NextRequest("http://localhost:3000/api/events"));
    const data = (await response.json()) as {
      events: Array<{ id: string }>;
      liveCount: number;
    };

    const duplicateWeatherEvents = data.events.filter((event) => event.id === "wx-dup");

    expect(duplicateWeatherEvents.length).toBe(1);
    expect(data.liveCount).toBe(8);
  });
});
