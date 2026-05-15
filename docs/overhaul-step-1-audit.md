# StudioSoundSet Overhaul Step 1 Audit

Date: 2026-05-15
Scope: Identify and remove legacy/runtime-dangerous paths before the larger player-centered overhaul.

## Step 1 Goal

Find every active code path that can make the app lie about state, require the wrong auth context, call missing Base44 schemas, or infer player/provider state from legacy objects.

This step does not remove the visible Zones section yet. Removing legacy UI/routes is Step 2. Step 1 only removes or flags dangerous runtime dependencies.

## Findings

### 1. PlayerCommand entity dependency

Status: fixed in source.

Problem:
The app used `base44.entities.PlayerCommand` from Admin pages and public Player runtime. The Base44 app does not have that entity schema, causing:

- `Entity schema PlayerCommand not found in app`
- Now Playing command buttons failing
- Command log not loading

Fix:
Commands now route through backend functions:

- Admin: `playerCommandControl`
- Player: `publicPlayerRuntime`

The public Player no longer writes command state through a public Base44 entity.

Remaining risk:
Base44 deployment may briefly serve an old bundle after GitHub sync. Hard reload after deploy.

### 2. Public Player auth leakage

Status: fixed in source.

Problem:
The public Player route could still trigger the Base44 admin/app auth state check, producing 403 errors like:

`You must be logged in to access this app`

This could happen while Spotify playback still worked, creating contradictory UI.

Fix:
Public route detection was hardened in:

- `src/lib/AuthContext.jsx`
- `src/App.jsx`

Public Player routes are authless and must not run admin auth checks:

- `/player-new`
- `/player-login`
- `/player-pairing`
- `/spotify-callback`

### 3. Runtime provider context split

Status: fixed in source.

Problem:
Player could validate its runtime session but still lose API/provider context because the runtime read provider data only from `Player.providerId`.

Fix:
`publicPlayerRuntime` now resolves provider/zone context from:

1. Player fields
2. Runtime AppSetting session

This keeps Player API access tied to the server-side runtime session.

### 4. SDK/heartbeat status corruption

Status: fixed in source.

Problem:
A later heartbeat with partial/empty payload could overwrite a valid SDK/device state, causing Admin to show:

- track is playing
- but `SDK Ready: no`
- and `Device: missing`

Fix:
Heartbeat sanitization now preserves current valid state when a heartbeat omits optional fields. `durationMs` is also mirrored into `currentTrackDuration` for Now Playing progress.

### 5. Playlist provider inferred through Zones

Status: fixed in source.

Problem:
Playlist UI fetched Zones and inferred provider through `zone.providerId`. The app direction is player-centered, so this could select the wrong provider/API account and cause playlist import failures.

Fix:
`src/pages/Playlists.jsx` no longer calls `base44.entities.Zone.list()` and no longer uses `zone.providerId` as a Spotify/API fallback.

Playlist provider resolution now uses only Player/Playlist provider fields:

- `player.providerId`
- `player.apiCredentialSetId`
- `player.spotifyAccountId`
- `playlist.providerId`
- `playlist.spotifyAccountId`
- `playlist.apiCredentialSetId`

Zones must not decide Spotify/API provider.

### 6. Playlist track import Forbidden

Status: diagnosed, fix belongs to Phase 3/4 unless caused by provider resolution.

Potential causes:

- missing Spotify scopes
- provider token created before playlist scopes were added
- Spotify dev mode user not allowed
- `spotifyAccountControl` admin auth mismatch

Required later fix:
Introduce `playlistCatalogControl` as the only playlist import backend and store detailed Spotify error diagnostics.

### 7. Direct public Player entity writes

Status: fixed in main runtime path.

The public Player should call only:

`publicPlayerRuntime`

Known public Player path `src/pages/PlayerRuntime.jsx` uses public runtime for heartbeat, commands, playlist playback, access token, and playlist list.

### 8. Legacy UI/routes

Status: intentionally deferred to Step 2.

Still present:

- `/zones` route/page
- Sidebar footer text mentioning zones
- Some admin pages still read `Zone`

These are not all runtime-breaking, but they conflict with the final product model. They will be removed in Step 2.

### 9. Published Base44 function registration

Status: blocking live acceptance.

Problem:
The published app at `https://fit-sound-flow.base44.app` returns HTTP 404 when the Player calls:

`base44.functions.invoke("publicPlayerRuntime", ...)`

Observed live result on `/player-new`:

- Player frontend bundle loads.
- The old public auth 403 is no longer the newest visible blocker.
- The Player runtime shows missing runtime/provider state because `publicPlayerRuntime` is not reachable.
- The visible error is currently `Request failed with status code 404` until the latest diagnostic bundle is published.

Interpretation:
The source file exists in GitHub at:

`base44/functions/publicPlayerRuntime/entry.ts`

but the Base44 published app has not registered/deployed that function, or Base44's GitHub sync is not deploying functions from this path.

Important:
There must be no direct public fallback to `base44.entities.Player.update`. That would violate the runtime security rule and would create another fragile, misleading state path. The correct fix is to deploy/register `publicPlayerRuntime` as the one public Player backend endpoint.

## Step 1 Acceptance Criteria

- No active Admin page should call missing `base44.entities.PlayerCommand`.
- Public Player must not trigger Base44 admin login checks.
- Public Player must not directly write Base44 Player state.
- Runtime provider must resolve from server-side runtime session if Player fields are missing.
- Now Playing must not show impossible SDK/device state when playback state exists.
- Playlist provider inference through Zone must be patched.
- Published app must expose `publicPlayerRuntime`; otherwise Step 1 is not live-successful.

## Live Verification Status

Current status: not successful yet.

The source architecture for Step 1 is corrected, but the published app is still blocked because `publicPlayerRuntime` returns 404. Until that function is deployed in Base44, the Player cannot reliably bootstrap, heartbeat, poll commands, or confirm commands through the required central runtime endpoint.

## Next Required Work Before Step 2

1. Deploy/register the Base44 Function `publicPlayerRuntime` so `base44.functions.invoke("publicPlayerRuntime", ...)` returns application JSON instead of HTTP 404.
2. Hard reload `/player-new` and verify the diagnostic disappears.
3. Verify `/player-new` console has no new `You must be logged in to access this app` error.
4. Verify `/now-playing` has no `PlayerCommand entity not found` toast.
5. Verify command buttons create command log entries through `playerCommandControl`.
6. Verify Player picks up and confirms at least one command.
7. Verify Admin Now Playing no longer shows `SDK Ready: no` while current track data is present after Player heartbeat refresh.
