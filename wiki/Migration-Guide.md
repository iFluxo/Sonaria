# Migration Guide

This page covers migrating an existing bot to Sonaria.

## From DisTube v5

Sonaria keeps DisTube v5's queue and playback API, but swaps the framework from `discord.js` to
[Seyfert](https://seyfert.dev) and replaces `@discordjs/voice` with a native voice implementation
vendored into the library.

### 1. Replace discord.js with Seyfert

Create your bot with a Seyfert `Client` instead of a discord.js `Client`:

```ts
import { Client } from "seyfert";

const client = new Client({
  plugins: [voice()],
});
```

### 2. Install the native voice plugin

Sonaria's voice implementation is registered as a Seyfert plugin. Pass `voice()` to the client's
`plugins` array **before** creating the `Sonaria` instance, and remove `@discordjs/voice` and
`@discordjs/opus` from your dependencies.

```ts
import { Sonaria, voice } from "sonaria";

const client = new Client({ plugins: [voice()] });
const sonaria = new Sonaria(client, { plugins: [] });
```

### 3. Rename the import

```diff
-import { DisTube } from "distube";
+import { Sonaria } from "sonaria";

-const distube = new DisTube(client, { plugins: [] });
+const sonaria = new Sonaria(client, { plugins: [] });
```

The public class names follow the same convention (`DisTubeError` → `SonariaError`,
`DisTubeOptions` → `SonariaOptions`, and so on).

### 4. Options

Sonaria supports the same options as DisTube v5, with one addition: the FFmpeg configuration now
lives in the `ffmpeg` option (`{ path, args }`) instead of a top-level option.

### 5. Events

The `Events` enum is unchanged, except that `Events.EMPTY` was removed because Sonaria no longer
tracks voice channel emptiness itself. Listen to `voiceStateUpdate` and use the exported
`isVoiceChannelEmpty` helper instead - see [[Handling Seyfert Events]].

### 6. Queue control

The `Queue` API is unchanged. The shortcut methods on the instance (`sonaria.pause(guild)`,
`sonaria.skip(guild)`, `sonaria.setVolume(guild, volume)`, …) are deprecated; use the queue returned
by `sonaria.getQueue(guild)` instead:

```ts
const queue = sonaria.getQueue(guild);
await queue.pause();
```

## From DisTube v4 or older

Unlike DisTube v4, Sonaria (like DisTube v5) does not bundle any music source. You must add at least
one plugin to play music; see the [[Plugin System]] and [[Projects Hub]]. Options that used to
configure a built-in source (`streamType`, `youtubeCookie`, `ytdlOptions`, `searchSongs`, …) have
been removed and are now the responsibility of your plugins.

`Sonaria#search` was also removed. Search through your extractor plugin's `searchSong` method
instead.
