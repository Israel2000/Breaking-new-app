"use client";

import { useEffect, useMemo, useState } from "react";

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

type EventsResponse = {
  events: FeedEvent[];
  liveCount: number;
  sourcesDown: number;
  sources?: Record<string, { ok: boolean; count: number; lastSuccessAt?: number; error?: string }>;
  generatedAt: number;
};

type SavedLocation = {
  id: string;
  label: string;
  description: string;
  lat?: number;
  lon?: number;
};

const savedLocations: SavedLocation[] = [
  { id: "denver", label: "Denver", description: "Denver weather alerts", lat: 39.7392, lon: -104.9903 },
  { id: "new-york", label: "New York", description: "NYC weather alerts", lat: 40.7128, lon: -74.006 },
  { id: "los-angeles", label: "Los Angeles", description: "LA weather alerts", lat: 34.0522, lon: -118.2437 },
  { id: "national", label: "National", description: "All U.S. weather alerts" }
];

const categoryLabels: Record<FeedEvent["category"], string> = {
  earthquake: "Earthquake",
  weather: "Weather",
  sports: "Sports",
  markets: "Markets",
  breaking: "Breaking"
};

const categories = ["all", "earthquake", "weather", "sports", "markets", "breaking"] as const;

type CategoryFilter = (typeof categories)[number];

function categoryText(category: CategoryFilter) {
  if (category === "all") return "All";
  if (category === "weather") return "Weather Alerts";
  if (category === "earthquake") return "Earthquakes";
  return categoryLabels[category];
}

function CategoryLogo({ category }: { category: CategoryFilter | FeedEvent["category"] }) {
  if (category === "all") {
    return (
      <span className="category-logo all" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16" /></svg>
      </span>
    );
  }

  if (category === "earthquake") {
    return (
      <span className="category-logo earthquake" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m4 15 4-6 3 4 3-7 6 9" /><path d="M3 19h18" /></svg>
      </span>
    );
  }

  if (category === "weather") {
    return (
      <span className="category-logo weather" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 17h9a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.2 4.5 4.5 0 0 0 8 17Z" /><path d="M8 21v-1M13 21v-1M18 21v-1" /></svg>
      </span>
    );
  }

  if (category === "sports") {
    return (
      <span className="category-logo sports" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M5.7 7.3c4 1.8 8.6 1.8 12.6 0" /><path d="M5.7 16.7c4-1.8 8.6-1.8 12.6 0" /></svg>
      </span>
    );
  }

  if (category === "markets") {
    return (
      <span className="category-logo markets" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 17 9 12l4 4 7-9" /><path d="M15 7h5v5" /></svg>
      </span>
    );
  }

  return (
    <span className="category-logo breaking" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M12 3 3 20h18L12 3Z" /><path d="M12 9v5" /><path d="M12 17h.01" /></svg>
    </span>
  );
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function eventApiUrl(location: SavedLocation) {
  if (location.lat == null || location.lon == null) return "/api/events";
  const params = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) });
  return `/api/events?${params.toString()}`;
}

export default function Home() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [sourcesDown, setSourcesDown] = useState(0);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("all");
  const [activeLocationId, setActiveLocationId] = useState(savedLocations[0].id);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading live feed...");
  const [clock, setClock] = useState("--:--:--");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeLocation = savedLocations.find((location) => location.id === activeLocationId) ?? savedLocations[0];

  async function refreshFeed(location = activeLocation) {
    setIsRefreshing(true);
    setStatus(`Refreshing ${location.label} sources...`);

    try {
      const response = await fetch(eventApiUrl(location), { cache: "no-store" });
      if (!response.ok) throw new Error("Feed unavailable");
      const data = (await response.json()) as EventsResponse;
      setEvents(data.events);
      setLiveCount(data.liveCount);
      setSourcesDown(data.sourcesDown);
      setSelectedId(data.events[0]?.id ?? null);
      const sourceSummary = Object.entries(data.sources ?? {})
        .map(([name, source]) => `${name}: ${source.ok ? "ok" : "down"} (${source.count})`)
        .join(" | ");
      const sourceText = sourceSummary ? ` ${sourceSummary}` : "";

      setStatus(
        data.sourcesDown
          ? `Some live sources are unavailable. Showing Yahoo News and every source that loaded.${sourceText}`
          : `${location.description}, Yahoo News, USGS earthquakes, crypto markets, and sports items loaded.${sourceText}`
      );
    } catch {
      setStatus("Live feed could not be reached. Try refresh again in a moment.");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    refreshFeed(activeLocation);
    const feedTimer = window.setInterval(() => refreshFeed(activeLocation), 1000 * 60 * 2);
    return () => window.clearInterval(feedTimer);
  }, [activeLocationId]);

  useEffect(() => {
    setClock(formatTime(Date.now()));
    const clockTimer = window.setInterval(() => setClock(formatTime(Date.now())), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events
      .filter((event) => activeCategory === "all" || event.category === activeCategory)
      .filter((event) => {
        if (!normalizedQuery) return true;
        return [event.title, event.place, event.source, event.severity]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [activeCategory, events, query]);

  const selectedEvent = events.find((event) => event.id === selectedId) ?? filteredEvents[0];

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pulsewire home">
          <span className="brand-mark" />
          <span>Pulsewire</span>
        </a>
        <div className="search-wrap">
          <span className="search-engine-logo" aria-hidden="true">
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
            <span className="dot blue" />
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search events, places, teams, markets" />
        </div>
        <button className="icon-button" onClick={() => refreshFeed()} disabled={isRefreshing} type="button" title="Refresh feed" aria-label="Refresh feed">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.1 6.6M3 12A9 9 0 0 1 18.1 5.4M21 5v7h-7M3 19v-7h7" /></svg>
        </button>
      </header>

      <main className="layout">
        <section className="feed-panel" aria-labelledby="feedTitle">
          <div className="feed-heading">
            <div>
              <p className="eyebrow"><span className="live-dot" />Live</p>
              <h1 id="feedTitle">What just happened?</h1>
            </div>
            <div className="timestamp"><span>{clock}</span><small>local time</small></div>
          </div>

          <div className="location-strip" aria-label="Saved locations">
            <span>Weather focus</span>
            <div className="location-buttons">
              {savedLocations.map((location) => (
                <button
                  key={location.id}
                  className={`location-chip ${activeLocationId === location.id ? "is-active" : ""}`}
                  type="button"
                  aria-pressed={activeLocationId === location.id}
                  onClick={() => setActiveLocationId(location.id)}
                >
                  {location.label}
                </button>
              ))}
            </div>
          </div>

          <div className="category-bar" role="tablist" aria-label="Event categories">
            {categories.map((category) => (
              <button
                className={`category ${activeCategory === category ? "is-active" : ""}`}
                type="button"
                key={category}
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                <CategoryLogo category={category} />
                <span>{categoryText(category)}</span>
              </button>
            ))}
          </div>

          <div className="status-row"><span>{status}</span><span>{filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}</span></div>

          <ol className="event-list" aria-live="polite">
            {filteredEvents.length ? filteredEvents.map((event) => (
              <li
                key={event.id}
                className={`event ${event.id === selectedEvent?.id ? "is-selected" : ""}`}
                role="button"
                aria-pressed={event.id === selectedEvent?.id}
                tabIndex={0}
                onClick={() => setSelectedId(event.id)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                    keyEvent.preventDefault();
                    setSelectedId(event.id);
                  }
                }}
              >
                <time className="event-time" dateTime={new Date(event.time).toISOString()}>{formatTime(event.time)}</time>
                <div className="event-body">
                  <p className="event-title">{event.title}</p>
                  <div className="event-meta"><span>{event.place}</span><span>{event.source}</span><span>{event.severity}</span></div>
                </div>
                <span className={`badge ${event.category}`}><CategoryLogo category={event.category} /><span>{categoryLabels[event.category]}</span></span>
              </li>
            )) : <li className="empty">No events match this view yet.</li>}
          </ol>
        </section>

        <aside className="detail-panel" aria-labelledby="detailTitle">
          <div className="detail-hero">
            <p className="eyebrow">Selected event</p>
            <h2 id="detailTitle">{selectedEvent?.title ?? "Tap an event for details"}</h2>
            <p>{selectedEvent ? `${selectedEvent.place} - ${selectedEvent.source} - ${selectedEvent.severity}. ${selectedEvent.summary}` : "Events are sorted by time across every category so the newest verified signal rises to the top."}</p>
          </div>

          <div className="metric-grid">
            <div><span>{liveCount}</span><small>live items</small></div>
            <div><span>{sourcesDown}</span><small>sources down</small></div>
          </div>

          <div className="source-card">
            <h3>Starter sources</h3>
            <ul>
              <li><span>USGS</span><small>earthquakes</small></li>
              <li><span>NWS</span><small>{activeLocation.label}</small></li>
              <li><span>Markets</span><small>live crypto moves</small></li>
              <li><span>Sports</span><small>live MLB games</small></li>
              <li><span>Yahoo News</span><small>top trending headlines</small></li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}