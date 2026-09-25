# ESPN images (captured)

`files/` holds every a.espncdn.com image the e2e pages request (team logos at both sizes,
and the small combiner-sized headshots used by the box score, team roster, players, stats
and player pages), byte for
byte with the HTTP status a.espncdn.com returned. `manifest.json` maps each request to its
file, status, source URL and capture time (ET). One combiner headshot
(`.../full/4697270.png&w=48&h=48`) was a 404 upstream and is served as a 404.

`urls.txt` is the request list, taken from the spec's own unmocked-request report.
Re-capture with `node e2e/fixtures/capture-images.mjs`.

The app never requests a full-size headshot (`/i/headshots/nba/players/full/<id>.png`,
~250 KB each): `getHeadshotUrl` asks ESPN's combiner for a square at 2x the avatar's size
(88 px on Players, 96 px on Stats and the box score, 160 px on the player page). Those
small headshots were added on Sep 25, 2026 (ET) with
`node e2e/fixtures/capture-images.mjs --missing`, which fetches only the URLs that are not
yet in the manifest and leaves every earlier capture untouched. Each has its source URL and
ET capture time in `manifest.json`. A full-size headshot request is unmocked and fails the
test.
