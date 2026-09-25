# ESPN images (captured)

`files/` holds every a.espncdn.com image the e2e pages request (team logos at both sizes,
and the small combiner-sized headshots used by the box score and team roster), byte for
byte with the HTTP status a.espncdn.com returned. `manifest.json` maps each request to its
file, status, source URL and capture time (ET). One combiner headshot
(`.../full/4697270.png&w=48&h=48`) was a 404 upstream and is served as a 404.

`urls.txt` is the request list, taken from the spec's own unmocked-request report.
Re-capture with `node e2e/fixtures/capture-images.mjs`.

Not captured: full-size headshots (`/i/headshots/nba/players/full/<id>.png`, 293 files,
~76 MB), requested by the players, stats and player pages. mockApi.js answers them 404, so
those pages show their no-image state in the baselines.
