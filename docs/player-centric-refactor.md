# StudioSoundSet Player-Centric Refactor

## Final rule

StudioSoundSet is player-based.

- Provider/API belongs to the Player.
- Spotify account belongs to the Player.
- Playlists belong to the Player / Provider pair.
- Commands belong to the Player.
- Zone is only a room label with visual/default settings.

## What must not happen anymore

The public Player route must not directly read protected Admin entities.

Bad:

- public Player page calls Provider.get
- public Player page calls Zone.get
- public Player page decides provider via zone.providerId
- Player link contains permanent email/password credentials

Good:

- public Player route receives only a player setup/session reference
- Player runtime config is resolved through a controlled runtime layer
- Player uses its own providerId stored on the Player
- Zone is optional and decorative

## Current transitional patch

Because the current Base44 deployment blocks public entity reads, the public Player route now reads providerId and zoneId from the Player setup URL first and stores them in the local Player session. This prevents the Player UI from failing before it can start.

This is a transition step, not the final security model.

## Required final backend function

Create a public Player runtime function in Base44 with controlled actions:

- bootstrap
- heartbeat
- pollCommands
- commandResult
- getSdkCredential

The function must validate the Player session before returning any Player-specific runtime data.

It should never expose provider secrets or refresh credentials to the browser.

## Target admin navigation

Core:

- Dashboard
- Players
- Now Playing
- Playlists
- Calendar

Setup:

- Provider / API Center
- Settings

Diagnostics:

- System Check
- Commands
- Logs

Settings:

- Zones
- Users
- Network

## Player management target

The Players page should be the central setup and operations screen.

Each Player card/detail should show:

- Player name
- Player login/setup link
- Provider/API assignment
- Spotify connection status
- Zone assignment
- SDK status
- Heartbeat status
- Current playback state
- Command/test status
- Imported playlists

## Migration rule

If old data has provider assignment on Zone, show it as legacy only and offer a repair action to copy it to the Player.

No new flow should use Zone as provider owner.
