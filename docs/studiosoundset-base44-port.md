# StudioSoundSet Base44 Port

This repository keeps the original Base44 app and ports the newer StudioSoundSet runtime into it step by step.

## Current Runtime Rules

- The Base44 app is the public HTTPS runtime.
- The local Next.js/Prisma app remains preserved and is not overwritten.
- Spotify OAuth redirect URI is generated from the current public origin:
  - `https://<base44-domain>/spotify-callback`
- Admin and Player should be tested in different browser profiles or separate devices.
- Same browser profile can replace the session because cookies/local sessions are shared.

## Cleanup Decisions

The previous Base44 code mixed several incompatible concepts (`SpotifyAccount`, `Provider`, `PlayerDevice`, `Player`, `Command`) and contained dummy success paths. The app is now normalized around these concepts:

- `Provider` is the Spotify account/credential record.
- `Player` is the StudioSoundSet playback device/login/state record.
- `Zone` groups Players and references a Provider.
- `Playlist` and `PlaylistTrack` are the catalog.
- `PlayerCommand` is the only safe Admin-to-Player control channel.

Removed/disabled behavior:

- Fake system test success in Player management.
- Legacy `/player` implementation based on old `SpotifyAccount`; it now redirects to `/player-new`.
- Scheduler save UI that implied automation existed. Calendar now clearly says scheduler is not active until a real worker exists.
- Old `Command` logs. Logs now read `PlayerCommand`.

## Implemented In This Port

- Direct Provider create/update/delete using Base44 `Provider` entity.
- Provider connect uses `spotifyAuth` and persists connected/error status after callback.
- Dynamic Spotify Redirect URI display on Spotify Provider page.
- Player QR code opens the public Player login URL instead of storing only raw credentials.
- Player login can prefill credentials from the QR URL.
- Player page uses the real Spotify Web Playback SDK method `getCurrentState()`.
- Player sends heartbeat/player state every 3 seconds.
- Admin Now Playing controls create `PlayerCommand` records.
- Player polls pending commands every 2 seconds.
- Commands are marked `picked_up`, then `success` or `failed` only after Player execution.
- Admin command log shows pending, success, failed and timeout states.

## Required Base44 Entities

The code expects these entities to exist in Base44:

- `Provider`
- `Player`
- `Zone`
- `Playlist`
- `PlaylistTrack`
- `SpotifyDevice` optional for Spotify Connect diagnostics
- `PlayerCommand`

`PlayerCommand` must allow at least these fields:

- `playerId`
- `providerId`
- `zoneId`
- `type`
- `command`
- `payload`
- `status`
- `createdAt`
- `pickedUpAt`
- `completedAt`
- `result`
- `errorCode`
- `humanMessage`
- `technicalMessage`
- `suggestedFix`

`Provider` should allow:

- `name`
- `displayName`
- `clientId`
- `clientSecret`
- `status`
- `authStatus`
- `tokenStatus`
- `spotifyUserEmail`
- `spotifyUserId`
- `lastError`
- `redirectUri`
- `connectedAt`

## Required Base44 Functions

The frontend still depends on existing Base44 functions:

- `spotifyAuth`
  - `getAuthUrl`
  - `exchange`
- `spotifyAccountControl`
  - `getAccessToken`
  - `transferPlayback`
  - `playPlaylist`
  - `getDevices`
  - `getUserPlaylists`
  - `importPlaylistTracks`
- `createPlayerUserNew`
- `playerAuthLogin`

If any of these functions returns a failure, the UI now shows the real error instead of pretending success.

## Required Spotify Dashboard Setup

Add the exact URI shown in the app under Spotify Provider:

```text
https://<base44-domain>/spotify-callback
```

In Spotify development mode, every Spotify user that connects must be added under User Management in the Spotify Developer Dashboard.

## Known Difference From Next.js App

The local Next.js app in `C:\Users\Chris\AlbGym GmbH\AlbGym - Dokumente\AlbGym\Erik\StudioSoundSet` is not deleted or overwritten. This Base44 app uses Base44 Entities and Functions instead of Prisma/PostgreSQL/Next API routes.
