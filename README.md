# FreshMe

FreshMe is a tiny static morning-practice player.

Open the page, tap **Start**, and it plays a daily flow:

1. A fixed opening track: `喜洋洋`.
2. A date-seeded main practice playlist with guqin / Daoist / quiet cultivation music.

The main section targets 50-90 minutes and avoids repeating the same main playlist across the recent local history window.

v0.3 adds a 15-image avatar cover pool. FreshMe chooses a daily cover from the current music theme when possible, keeps the same cover for the same day, and avoids repeating a cover within the recent 7-day window.

## Boundaries

YouTube ads are controlled by YouTube. FreshMe does not include ad-blocking code or any private YouTube credentials.

## Privacy

This public build contains no private keys, no YouTube API credentials, and no account tokens. It uses public YouTube video IDs through the YouTube iframe player and static metadata generated ahead of time.

## Files

- `index.html`: app entry
- `app.js`: playlist and player logic
- `styles.css`: layout and visual design
- `data/tracks-data.js`: public YouTube metadata
- `data/covers-data.js`: public cover metadata
- `assets/covers/`: generated FreshMe avatar covers
- `assets/cover-default.png`: fallback generated cover art
