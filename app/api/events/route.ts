import { NextRequest, NextResponse } from "next/server";

type FeedEvent = {
  id: string;
  category: "earthquake" | "weather" | "sports" | "markets" | "breaking";
  title: string;
  place: string;
  source: string;
  severity: string;
  time: number;
  summary: string;
  url?: string;
};

type MarketCoin = {
  name: string;
  symbol: string;
  url: string;
};

const marketCoins: Record<string, MarketCoin> = {
  bitcoin: { name: "Bitcoin", symbol: "BTC", url: "https://www.coingecko.com/en/coins/bitcoin" },
  ethereum: { name: "Ethereum", symbol: "ETH", url: "https://www.coingecko.com/en/coins/ethereum" },
  solana: { name: "Solana", symbol: "SOL", url: "https://www.coingecko.com/en/coins/solana" },
  binancecoin: { name: "BNB", symbol: "BNB", url: "https://www.coingecko.com/en/coins/bnb" }
};

async function fetchJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 60 },
    headers: { "User-Agent": "Pulsewire MVP contact@example.com" }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: {
      "User-Agent": "Pulsewire News Reader/1.0",
      Accept: "application/rss+xml, application/xml, text/xml"
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.text();
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function firstTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:[^>]*)>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

async function getYahooNews(): Promise<FeedEvent[]> {
  const xml = await fetchText("https://www.yahoo.com/news/rss");
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  return items.slice(0, 8).flatMap((item, index) => {
    const title = firstTag(item, "title");
    const link = firstTag(item, "link");
    const description = firstTag(item, "description");
    const guid = firstTag(item, "guid");
    const pubDate = firstTag(item, "pubDate");
    const time = pubDate ? new Date(pubDate).getTime() : Date.now() - index * 60_000;

    if (!title) return [];

    return {
      id: guid ? `yahoo-${guid}` : `yahoo-${link || title}`,
      category: "breaking",
      title,
      place: "Global",
      source: "Yahoo News",
      severity: "Trending",
      time: Number.isFinite(time) ? time : Date.now(),
      summary: description || "Top general-news headline from Yahoo News.",
      url: link || "https://www.yahoo.com/news/"
    } satisfies FeedEvent;
  });
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function teamName(team: any) {
  return team?.team?.name ?? "Team";
}

function teamScore(team: any) {
  return typeof team?.score === "number" ? team.score : 0;
}

function scoreTitle(game: any) {
  const away = game.teams?.away;
  const home = game.teams?.home;
  const awayName = teamName(away);
  const homeName = teamName(home);
  const awayScore = teamScore(away);
  const homeScore = teamScore(home);
  const state = game.status?.abstractGameState;

  if (state === "Final") {
    const winner = awayScore > homeScore ? awayName : homeName;
    const loser = awayScore > homeScore ? homeName : awayName;
    return `${winner} beat ${loser} ${Math.max(awayScore, homeScore)}-${Math.min(awayScore, homeScore)}`;
  }

  if (state === "Live") {
    if (awayScore === homeScore) return `${awayName} and ${homeName} tied ${awayScore}-${homeScore}`;
    const leader = awayScore > homeScore ? awayName : homeName;
    const trailer = awayScore > homeScore ? homeName : awayName;
    return `${leader} lead ${trailer} ${Math.max(awayScore, homeScore)}-${Math.min(awayScore, homeScore)}`;
  }

  return `${awayName} at ${homeName}`;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeEvents(events: FeedEvent[]) {
  const byKey: Record<string, FeedEvent> = {};

  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const timeBucket = Math.floor(event.time / 60_000);
    const fallbackKey = [
      event.category,
      normalizeText(event.title),
      normalizeText(event.place),
      normalizeText(event.source),
      String(timeBucket)
    ].join("|");
    const key = event.id ? `id:${event.id}` : `content:${fallbackKey}`;
    const existing = byKey[key];

    if (!existing || event.time > existing.time) {
      byKey[key] = event;
    }
  }

  return Object.keys(byKey).map((key) => byKey[key]);
}

async function getEarthquakes(): Promise<FeedEvent[]> {
  const data = await fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson");

  return (data.features ?? []).map((feature: any) => {
    const props = feature.properties ?? {};
    const magnitude = typeof props.mag === "number" ? props.mag.toFixed(1) : props.mag ?? "unknown";

    return {
      id: feature.id,
      category: "earthquake",
      title: `Magnitude ${magnitude} earthquake`,
      place: props.place || "Location unavailable",
      source: "USGS",
      severity: props.alert ? String(props.alert).toUpperCase() : "Reviewed",
      time: props.time || Date.now(),
      summary: props.title || "A recent earthquake reported by the USGS live feed.",
      url: props.url
    } satisfies FeedEvent;
  });
}

async function getWeatherAlerts(latitude?: string, longitude?: string): Promise<FeedEvent[]> {
  const hasPoint = latitude && longitude;
  const url = hasPoint
    ? `https://api.weather.gov/alerts/active?point=${latitude},${longitude}&status=actual&message_type=alert`
    : "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
  const data = await fetchJson(url);

  return (data.features ?? []).slice(0, 25).map((feature: any) => {
    const props = feature.properties ?? {};
    const sent = props.sent ? new Date(props.sent).getTime() : Date.now();
    const area = props.areaDesc ? String(props.areaDesc).split(";")[0] : "United States";

    return {
      id: feature.id || props.id,
      category: "weather",
      title: props.event || "Weather alert",
      place: area,
      source: "National Weather Service",
      severity: props.severity || props.urgency || "Alert",
      time: sent,
      summary: props.headline || props.description || "Active weather alert from the National Weather Service.",
      url: props.uri
    } satisfies FeedEvent;
  });
}

async function getMarketEvents(): Promise<FeedEvent[]> {
  const ids = Object.keys(marketCoins).join(",");
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`
  );

  return Object.entries(marketCoins).flatMap(([id, coin]) => {
    const price = data[id]?.usd;
    const change = data[id]?.usd_24h_change;
    const lastUpdated = data[id]?.last_updated_at;

    if (typeof price !== "number" || typeof change !== "number") return [];

    const direction = change >= 0 ? "rises" : "falls";
    const time = typeof lastUpdated === "number" ? lastUpdated * 1000 : Date.now();

    return {
      id: `market-${id}`,
      category: "markets",
      title: `${coin.name} ${direction} ${formatPercent(Math.abs(change))}`,
      place: `${coin.symbol} / USD`,
      source: "CoinGecko",
      severity: Math.abs(change) >= 5 ? "Large move" : "24h move",
      time,
      summary: `${coin.name} is trading at ${formatUsd(price)}, with a ${formatPercent(change)} move over the last 24 hours.`,
      url: coin.url
    } satisfies FeedEvent;
  });
}

async function getMlbEvents(): Promise<FeedEvent[]> {
  const data = await fetchJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1");
  const games = (data.dates ?? []).flatMap((date: any) => date.games ?? []);

  return games.slice(0, 15).map((game: any) => {
    const away = game.teams?.away;
    const home = game.teams?.home;
    const awayName = teamName(away);
    const homeName = teamName(home);
    const awayScore = teamScore(away);
    const homeScore = teamScore(home);
    const state = game.status?.abstractGameState ?? "Scheduled";
    const detailedState = game.status?.detailedState ?? state;
    const isLive = state === "Live";
    const isFinal = state === "Final";

    return {
      id: `mlb-${game.gamePk}`,
      category: "sports",
      title: scoreTitle(game),
      place: game.venue?.name ?? "MLB",
      source: "MLB Stats API",
      severity: isLive ? "Live" : isFinal ? "Final" : detailedState,
      time: isLive ? Date.now() : new Date(game.gameDate).getTime(),
      summary: `${awayName} ${awayScore}, ${homeName} ${homeScore}. Status: ${detailedState}.`,
      url: `https://www.mlb.com/gameday/${game.gamePk}`
    } satisfies FeedEvent;
  });
}

export async function GET(request: NextRequest) {
  const latitude = request.nextUrl.searchParams.get("lat") ?? undefined;
  const longitude = request.nextUrl.searchParams.get("lon") ?? undefined;
  const settled = await Promise.allSettled([
    getEarthquakes(),
    getWeatherAlerts(latitude, longitude),
    getMarketEvents(),
    getMlbEvents(),
    getYahooNews()
  ]);
  const liveEvents = dedupeEvents(settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
  const sourcesDown = settled.filter((result) => result.status === "rejected").length;
  const events = dedupeEvents(liveEvents).sort((a, b) => b.time - a.time);

  return NextResponse.json({
    events,
    liveCount: liveEvents.length,
    sourcesDown,
    generatedAt: Date.now()
  });
}