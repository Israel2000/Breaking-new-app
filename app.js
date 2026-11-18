const fallbackEvents = [
  {
    id: "demo-weather-denver",
    category: "weather",
    title: "Severe Thunderstorm Warning - Denver",
    place: "Denver, Colorado",
    source: "National Weather Service",
    severity: "Warning",
    time: Date.now() - 1000 * 60 * 3,
    summary: "A live weather alert placeholder for the MVP. Connect a local zone or GPS-based search next."
  },
  {
    id: "demo-breaking-airport",
    category: "breaking",
    title: "Airport temporarily closes runway",
    place: "Chicago, Illinois",
    source: "Editorial queue",
    severity: "Developing",
    time: Date.now() - 1000 * 60 * 8,
    summary: "Breaking news items should come from licensed feeds or a verified editorial workflow."
  },
  {
    id: "demo-sports-nba",
    category: "sports",
    title: "Lakers trade announced",
    place: "NBA",
    source: "Sports feed",
    severity: "Confirmed",
    time: Date.now() - 1000 * 60 * 13,
    summary: "Sports events can later come from a league data provider with scores, injuries, and transactions."
  },
  {
    id: "demo-market-btc",
    category: "markets",
    title: "Bitcoin rises 4.8%",
    place: "Crypto markets",
    source: "Market feed",
    severity: "Market move",
    time: Date.now() - 1000 * 60 * 17,
    summary: "Market alerts should be based on watchlists and threshold rules so the feed stays useful."
  }
];

const categoryLabels = {
  earthquake: "Earthquake",
  weather: "Weather",
  sports: "Sports",
  markets: "Markets",
  breaking: "Breaking"
};

const eventList = document.querySelector("#eventList");
const feedStatus = document.querySelector("#feedStatus");
const eventCount = document.querySelector("#eventCount");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const clock = document.querySelector("#clock");
const metricLive = document.querySelector("#metricLive");
const detailTitle = document.querySelector("#detailTitle");
const detailSummary = document.querySelector("#detailSummary");

let events = [];
let activeCategory = "all";
let selectedId = null;

function formatTime(value) {
  return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function updateClock() {
  clock.textContent = formatTime(Date.now());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character]);
}

function normalizeEarthquake(feature) {
  const props = feature.properties;
  return {
    id: feature.id,
    category: "earthquake",
    title: `Magnitude ${props.mag?.toFixed?.(1) ?? props.mag} earthquake`,
    place: props.place || "Location unavailable",
    source: "USGS",
    severity: props.alert ? props.alert.toUpperCase() : "Reviewed",
    time: props.time,
    summary: props.title || "A recent earthquake reported by the USGS live feed.",
    url: props.url
  };
}

async function loadEarthquakes() {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson";
  const response = await fetch(url);
  if (!response.ok) throw new Error("USGS feed unavailable");
  const data = await response.json();
  return data.features.map(normalizeEarthquake);
}

function getFilteredEvents() {
  const query = searchInput.value.trim().toLowerCase();
  return events
    .filter((event) => activeCategory === "all" || event.category === activeCategory)
    .filter((event) => {
      if (!query) return true;
      return [event.title, event.place, event.source, event.severity].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => b.time - a.time);
}

function renderDetail(event) {
  if (!event) return;
  selectedId = event.id;
  detailTitle.textContent = event.title;
  detailSummary.textContent = `${event.place} - ${event.source} - ${event.severity}. ${event.summary}`;
}

function renderEvents() {
  const filtered = getFilteredEvents();
  eventList.innerHTML = "";
  eventCount.textContent = `${filtered.length} ${filtered.length === 1 ? "event" : "events"}`;
  metricLive.textContent = events.length;

  if (!filtered.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No events match this view yet.";
    eventList.append(empty);
    return;
  }

  filtered.forEach((event, index) => {
    const item = document.createElement("li");
    item.className = `event ${event.id === selectedId ? "is-selected" : ""}`;
    item.tabIndex = 0;
    item.innerHTML = `
      <time class="event-time" datetime="${new Date(event.time).toISOString()}">${formatTime(event.time)}</time>
      <div class="event-body">
        <p class="event-title">${escapeHtml(event.title)}</p>
        <div class="event-meta">
          <span>${escapeHtml(event.place)}</span>
          <span>${escapeHtml(event.source)}</span>
          <span>${escapeHtml(event.severity)}</span>
        </div>
      </div>
      <span class="badge ${event.category}">${categoryLabels[event.category]}</span>
    `;

    item.addEventListener("click", () => {
      renderDetail(event);
      renderEvents();
    });
    item.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        renderDetail(event);
        renderEvents();
      }
    });

    eventList.append(item);
    if (index === 0 && !selectedId) renderDetail(event);
  });
}

async function refreshFeed() {
  feedStatus.textContent = "Refreshing live sources...";
  refreshButton.disabled = true;

  try {
    const earthquakes = await loadEarthquakes();
    events = [...earthquakes, ...fallbackEvents];
    feedStatus.textContent = earthquakes.length
      ? "Live USGS earthquakes loaded. Demo items fill the other MVP categories."
      : "No significant earthquakes today. Demo items fill the feed.";
  } catch (error) {
    events = [...fallbackEvents];
    feedStatus.textContent = "Offline demo mode. USGS live feed could not be reached from this browser.";
  } finally {
    refreshButton.disabled = false;
    selectedId = events[0]?.id ?? null;
    renderEvents();
  }
}

document.querySelectorAll(".category").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".category.is-active").classList.remove("is-active");
    button.classList.add("is-active");
    activeCategory = button.dataset.category;
    renderEvents();
  });
});

searchInput.addEventListener("input", renderEvents);
refreshButton.addEventListener("click", refreshFeed);

updateClock();
setInterval(updateClock, 1000);
refreshFeed();
