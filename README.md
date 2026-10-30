# Fishy Friends

A free Sydney fishing planner for rookies and kids. It finds the best bite times from live tides, sun, moon, wind and water temperature, with spot maps, cast points and comments shared between friends.

**Live site:** https://j-fishy-friends.github.io/

## How it works
- **Tides** are calculated in the browser from tide-gauge constants (TICON-4, CC BY 4.0, via [Neaps](https://neaps.js.org/)). Fort Denison times match the Bureau of Meteorology tables. Not for navigation.
- **Weather, water temperature and place search** come live from [Open-Meteo](https://open-meteo.com/) (no key needed).
- **Maps** use [OpenStreetMap](https://www.openstreetmap.org/copyright) via Leaflet.
- **Shared pins and comments** use Supabase (free plan). Settings in `js/config.js`; database setup in `supabase/setup.sql`.
- **Catch cards** (version 3): log a catch with a photo, get a collectible card with rarity, NSW size and bag limits, cheers and comments. Database setup in `supabase/setup-v3-catches.sql`.
- **Rig and bait guides** (version 4): 8 picture guides in the app and as printable PDFs in `guides/`, with video links. Edit `tools/build_guides.py` and run it to rebuild both.
- **Characters** (free time, favourite fish, Calm or Fishy mode) are saved on each phone.

## Files
- `index.html`, `css/style.css`: page and styles
- `js/app.js`: the app
- `js/data.js`: fish rules and spots
- `js/stations.js`: tide gauge data for NSW
- `js/vendor/`: SunCalc (BSD) and Neaps tide predictor (MIT)
