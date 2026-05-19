# StudioSoundSet Architecture Audit

Date: 2026-05-19

## Target Architecture

StudioSoundSet is player-based.

- Admin creates Providers.
- Admin creates Players.
- Provider/API credentials are assigned directly to a Player.
- Zones are optional labels/defaults only.
- Player devices open `/player-new` or `/player` with a playerId and sessionToken from the Admin QR/link.
- Public Player devices communicate only through `publicPlayerRuntime`.
- Admin commands communicate through `playerCommandControl`.
- No public Player page may write `Player.update` directly.
- No browser-local fallback may create fake commands, fake sessions, or fake Spotify success.

## Runtime Data Flow

1. Admin saves Player assignment.
2. `playerAdminControl.ensureAssignment` creates/confirms runtime session.
3. Admin writes confirmed assignment fields to the Player entity:
   - `providerId`
   - `apiCredentialSetId`
   - `spotifyAccountId`
   - `spotifyClientId`
   - `zoneId`
   - `sessionToken`
   - `setupToken`
4. Player opens QR/link and bootstraps from URL.
5. Player calls `publicPlayerRuntime`:
   - `bootstrap`
   - `heartbeat`
   - `pollCommands`
   - `commandResult`
   - `listPlaylists`
   - `playPlaylist`
6. Player heartbeat writes live state through backend.
7. Admin reads Player entity through a single live-state adapter.

## Canonical Live State Fields

The Player heartbeat sends canonical fields and compatibility aliases so Admin and backend do not drift.

Canonical fields:

- `lastSeen`
- `lastHeartbeatAt`
- `lastStatusUpdate`
- `isOnline`
- `sdkLoaded`
- `sdkReady`
- `sdkConnected`
- `spotifyDeviceId`
- `currentTrackName`
- `currentTrackArtist`
- `currentTrackAlbum`
- `currentTrackCoverUrl`
- `currentTrackUri`
- `currentPlaylistUri`
- `progressMs`
- `positionMs`
- `durationMs`
- `isPlaying`
- `volume`
- `currentVolume`
- `lastError`

Admin reads through `src/lib/playerLiveState.js` instead of raw scattered fields.

## Removed Legacy / Duplicate Paths

Removed or bypassed:

- `src/pages/PlayerNew.jsx`
- `src/pages/Player.jsx`
- `src/pages/AddPlayerDevice.jsx`
- `src/pages/PlayerPairing.jsx`
- `src/lib/playerConfigStore.js`
- Browser-side command/session/Spotify fallbacks in `src/api/base44Client.js`

Active Player entrypoints:

- `/player`
- `/player-new`
- `/player-login` redirects to `/player-new`

All use `PlayerNewBootstrap -> PlayerRuntime`.

## Admin Pages

Active core flow:

- Dashboard: overview of providers, players, now playing, playlists and commands.
- Players: create/assign Player, generate QR/link, delete Player.
- Now Playing: reads Player live state through adapter and sends backend commands.
- Playlists: imports playlists/tracks through backend functions.
- Calendar: placeholder only until runtime and playlist checks pass.
- Commands: command lifecycle diagnostics.
- System Check: high-level diagnostics.

## Scheduler Readiness Requirements

Do not implement scheduler automation until these pass in the published app:

1. A Player shows `Runtime Session OK` in Admin.
2. The Player page shows SDK Ready and Spotify Device ID.
3. Admin Now Playing shows the same Player online.
4. Admin Now Playing shows current track, artist, cover and volume while the Player is playing.
5. Admin can send `PAUSE`, `RESUME`, `SKIP_NEXT`, `SET_VOLUME` and receive confirmed command success.
6. Playlist import creates `PlaylistTrack` rows; no playlist is considered synced with zero tracks.
7. No `BACKEND_FUNCTION_NOT_DEPLOYED`, 403, or 429 errors appear during normal single Admin + single Player testing.

## Known External Constraint

Base44 backend functions are not present in this GitHub repository as normal source files. The frontend now fails visibly if required functions are not deployed instead of simulating success in the browser.

Required backend functions:

- `playerAdminControl`
- `publicPlayerRuntime`
- `playerCommandControl`
- `spotifyAccountControl`
- `createPlayerUserNew`

If Admin/Player state still does not sync after publishing, inspect `publicPlayerRuntime` in Base44 and verify its heartbeat action persists the canonical live state fields listed above to exactly the requested Player entity.
