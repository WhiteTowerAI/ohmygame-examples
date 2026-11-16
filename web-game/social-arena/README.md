# Social Arena

A small competitive pulse game that demonstrates the browser SDK's service
features in one place:

- Sign in to publish a player identity.
- Save a display name and completed-round progress with `game.storage`.
- Publish a signed-in practice score and read the public top-five leaderboard.
- Create, share and join realtime multiplayer rooms; room snapshots keep every
  player's score in sync.

## Run locally

```sh
npm ci
npm run dev
```

The repository ships an empty `manifest.json`, so local browser saves work but
sign-in, cloud synchronization, leaderboards and rooms do not yet have a
service. In OhMyGame, run `game_sdk_setup`, then `multiplayer_setup` with a
host realtime room at a 200 ms tick. Those tools write the correct local
configuration. Publishing replaces it with hosted configuration.

Do not hand-edit production service settings in `manifest.json`.

## Play

Create a room, share its invite code and start when at least two people have
joined. Press **Pulse** as quickly as possible: the first 30 accepted actions
end the round, and the highest score wins. The winner's profile updates after
the authoritative room snapshot reports the result.

The leaderboard is intentionally separate: sign in, use **Practice +1**, then
choose **Publish practice score** and **Refresh top 5**. Host-mode room rules
run in a player's browser, so their outcomes must not be submitted to a public
leaderboard.
