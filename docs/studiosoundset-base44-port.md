# StudioSoundSet Base44 Port

This repository keeps the original Base44 app and ports the newer StudioSoundSet runtime into it step by step.

## Current Runtime Rules

- The Base44 app remains the deployed HTTPS app.
- Spotify OAuth redirect URI is generated from the current public origin:
  - `https://<base44-domain>/spotify-callback`
- Admin and Player should be tested in different browser profiles or separate devices.
- Same browser profile can replace the session because cookies/local sessions are shared.

## Implemented In This Port

- Dynamic Spotify Redirect URI display on Spotify Provider page.
- Player QR code now opens the public Player login URL instead of storing only raw credentials.
- Player login can prefill credentials from the QR URL.
- Player page uses the real Spotify Web Playback SDK method `getCurrentState()`.
- Player sends heartbeat/player state every 3 seconds.
- Admin Now Playing controls create `PlayerCommand` records.
- Player polls pending commands every 2 seconds.
- Commands are marked `picked_up`, then `success` or `failed` only after Player execution.
- Admin command log shows pending, success, failed and timeout states.

## Required Base44 Entities

The code expects these entities to exist in Base44:

- `Player`
- `Zone`
- `Provider`
- `Playlist`
- `PlaylistTrack`
- `PlayerCommand`

`PlayerCommand` should allow at least these fields:

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

## Required Spotify Dashboard Setup

Add the exact URI shown in the app under Spotify Provider:

```text
https://<base44-domain>/spotify-callback
```

In Spotify development mode, every Spotify user that connects must be added under User Management in the Spotify Developer Dashboard.

## Known Difference From Next.js App

The local Next.js app in `C:\Users\Chris\AlbGym GmbH\AlbGym - Dokumente\AlbGym\Erik\StudioSoundSet` is not deleted or overwritten. This Base44 app uses Base44 Entities and Functions instead of Prisma/PostgreSQL/Next API routes.
