# Breaking New App

A Next.js MVP for a real-time event feed: one homepage that sorts verified events by time across earthquakes, weather, sports, markets, and breaking news.

## Run it

From this folder in VS Code:

```powershell
.\start-app.ps1
```

Then open http://127.0.0.1:3000.

## What works now

- React/Next.js app structure
- Live-style chronological feed
- Category filters
- Search
- Event detail panel
- Server route at `/api/events`
- Live USGS significant earthquakes
- Live National Weather Service alerts
- Live CoinGecko crypto market moves
- Live MLB games and scores
- Top general-news headlines from Yahoo News RSS

## Good next steps

1. Pick the product name.
2. Add saved locations for weather alerts.
3. Add a real market data provider and alert thresholds.
4. Choose a sports data source.
5. Decide how verified breaking news enters the feed.