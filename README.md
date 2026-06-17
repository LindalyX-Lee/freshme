# FreshMe

FreshMe is a tiny static morning-practice player.

Open the page, tap **Start**, and it plays a daily flow:

1. A fixed opening track: `喜洋洋`.
2. A date-seeded main practice playlist with guqin / Daoist / quiet cultivation music.

The main section targets 50-90 minutes and avoids repeating the same main playlist across the recent local history window.

v0.3 adds a 15-image avatar cover pool. FreshMe chooses a daily cover from the current music theme when possible, keeps the same cover for the same day, and avoids repeating a cover within the recent 7-day window.

v0.5 adds repeatable main tracks. `普庵咒` is stored as one 7:15 main candidate and expands to 10 consecutive plays when selected.

v0.6 makes iPad playback more stable by starting the whole flow with YouTube's native playlist queue instead of loading each video one by one from app JavaScript. It also retries early unexpected pauses during the first 30 seconds after Start.

v0.7 fixes iPad YouTube player errors on repeated queues. FreshMe now avoids native playlist mode when the queue contains repeated video IDs or fallback sources, replays same-video repeats with `seekTo(0) + playVideo()`, and automatically tries backup `喜洋洋` sources if YouTube errors on the opening track.

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
