# StudioSoundSet Base44 Architecture Plan

## Goal

Make the Base44 app the public HTTPS StudioSoundSet runtime while preserving the local Next.js/Prisma app as the reference implementation.

## Architecture

### Runtime

- Frontend: React/Vite/Base44 app.
- Hosting: Base44 public HTTPS domain.
- Auth: Base44 Auth for Admin; custom Player login via `playerAuthLogin` function and local Player session token.
- Data: Base44 Entities.
- Spotify OAuth/API: Base44 Functions `spotifyAuth`, `spotifyAccountControl`, `providerControl`.
- Playback: Spotify Web Playback SDK inside `/player-new`.
- Command transport: `PlayerCommand` entity, polled by Player.

### Core Entities

- `Provider`: Spotify Developer credentials and connected Spotify account.
- `Zone`: physical/music zone, references a Provider.
- `Player`: Player login/profile/device state, references Zone/Provider.
- `PlayerCommand`: admin-to-player command lifecycle.
- `Playlist`: imported playlist catalog metadata.
- `PlaylistTrack`: imported playlist track rows.

### Command Lifecycle

1. Admin creates `PlayerCommand` with `status=pending`.
2. Player polls pending commands every 2 seconds.
3. Player marks command `picked_up`.
4. Player executes the command with SDK/API.
5. Player writes `success` or `failed` with details.
6. Admin only displays success after Player confirmation.

No command may be marked successful on Admin creation.

### Spotify Playback

- `GET_STATE`: Player calls SDK `getCurrentState()` and updates Player state.
- `PAUSE`: SDK `pause()`, verify paused state.
- `RESUME`: SDK `resume()`, verify playing state.
- `SKIP_NEXT`: SDK `nextTrack()`, refresh state.
- `SKIP_PREVIOUS`: SDK `previousTrack()`, refresh state.
- `SET_VOLUME`: SDK `setVolume()`, verify `getVolume()`.
- `PLAY_PLAYLIST`: backend Spotify API via `spotifyAccountControl.playPlaylist`, target SDK `spotifyDeviceId`, verify SDK state after start.

## Routes

### Public / Player

- `/` public login
- `/player-new` Player login and SDK player
- `/player-login` redirect alias to `/player-new`
- `/player-pairing` pairing flow
- `/spotify-callback` Spotify OAuth callback

### Admin

- `/dashboard`
- `/now-playing`
- `/manage-players`
- `/player`
- `/spotify-accounts`
- `/playlists`
- `/calendar`
- `/commands`
- `/system-check`
- `/logs`
- `/zones`
- `/settings`
- `/settings/network`

## MVP Milestones

1. Public HTTPS + Spotify OAuth works on iPhone/iPad.
2. Admin and Player sessions work on separate devices.
3. Player heartbeat and SDK ready state visible in Admin.
4. Admin commands use `PlayerCommand` and require Player acknowledgement.
5. Playlist catalog imports metadata and track rows.
6. Player playlist browser starts catalog playlists.
7. System Check diagnoses Provider/Player/Playlist/Command issues.

## Acceptance Criteria

- Player QR/login URL uses the current Base44 HTTPS origin.
- Spotify Redirect URI shown in app exactly matches Spotify Developer Dashboard.
- Player sends heartbeat every 3 seconds.
- Player polls commands every 2 seconds.
- Admin controls create commands and do not fake success.
- Player confirms success or writes clear failed errors.
- Playlist import stores metadata and track rows.
- Player only shows playlists scoped to its Provider/Player where available.

## Risks

- Base44 entity schemas must include `PlayerCommand` fields.
- Existing Base44 functions must support current Spotify scopes and token refresh.
- Spotify Development Mode requires every Spotify user email in User Management.
- iOS browser limitations can affect Web Playback SDK and internal volume control.
- Some Spotify playlists can return 403 if account/scopes/access are insufficient.

## Open Questions

- Should each Player have a dedicated Provider, or should Zones own Provider assignment only?
- Does Base44 expose function source in GitHub for `spotifyAccountControl` so backend import/playback can be hardened?
- Should PlayerCommand retention be capped or archived after N days?
- Should staff roles be separated from owner/admin inside Base44 Auth metadata?
