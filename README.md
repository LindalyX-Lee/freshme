# FreshMe

FreshMe is a tiny static morning-practice player.

Open the page, tap **Start**, and it plays a daily flow:

1. A fixed opening track: `喜洋洋`.
2. A date-seeded main practice playlist with guqin / Daoist / quiet cultivation music.

The main section targets 50-90 minutes and avoids repeating the same main playlist across the recent local history window.

## Privacy

This public build contains no private keys, no YouTube API credentials, and no account tokens. It uses public YouTube video IDs through the YouTube iframe player and static metadata generated ahead of time.

## Files

- `index.html`: app entry
- `app.js`: playlist and player logic
- `styles.css`: layout and visual design
- `data/tracks-data.js`: public YouTube metadata
- `assets/cover-default.png`: generated cover art
