# Fishy Friends

A free Sydney fishing planner for rookies and kids. It finds the best bite times from live tides, sun, moon, wind and water temperature, with spot maps, cast points and comments shared between friends.

**Live site:** https://junji-madeofmany.github.io/fishy-friends/

## How it works
- **Tides** are calculated in the browser from tide-gauge constants (TICON-4, CC BY 4.0, via [Neaps](https://neaps.js.org/)). Fort Denison times match the Bureau of Meteorology tables. Not for navigation.
- **Weather, water temperature and place search** come live from [Open-Meteo](https://open-meteo.com/) (no key needed).
- **Maps** use [OpenStreetMap](https://www.openstreetmap.org/copyright) via Leaflet.
- **Shared pins and comments** use Supabase (free plan). Settings in `js/config.js`; database setup in `supabase/setup.sql`.
- **Characters** (free time, favourite fish, Calm or Fishy mode) are saved on each phone.

## Files
- `index.html`, `css/style.css`: page and styles
- `js/app.js`: the app
- `js/data.js`: fish rules and spots
- `js/stations.js`: tide gauge data for NSW
- `js/vendor/`: SunCalc (BSD) and Neaps tide predictor (MIT)
