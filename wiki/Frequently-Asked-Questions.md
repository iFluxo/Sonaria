# Frequently Asked Questions

## Sonaria

### 1. `FFMPEG_NOT_INSTALLED`

#### Reason

- FFmpeg is not installed, or it is not on your `PATH`.

#### Solution

- Install FFmpeg: [Windows](https://www.gyan.dev/ffmpeg/builds/) - Linux (`sudo apt-get install ffmpeg`,
  `sudo dnf install ffmpeg`) - macOS (`brew install ffmpeg`).
- If FFmpeg is installed elsewhere, point Sonaria to it with the `ffmpeg.path` option:

  ```ts
  const sonaria = new Sonaria(client, {
    ffmpeg: { path: "/usr/local/bin/ffmpeg" },
  });
  ```

### 2. The song ends instantly without any errors / `Error: write EPIPE`

#### Reason

- This is due to an FFmpeg error.

#### Solution

- Check the FFmpeg output with the `ffmpegDebug` event:

  ```ts
  import { Events } from "sonaria";

  sonaria.on(Events.FFMPEG_DEBUG, console.log);
  ```

### 3. `VOICE_CONNECT_FAILED`

#### Reason

- The bot could not connect to the voice gateway in time, usually because of a network issue on your
  host.

#### Solution

1. Try to join the voice channel with `sonaria.voices.join(voiceChannel)` before calling
   `sonaria.play()`. You can retry if this throws the error.
2. Use a host with a stable, low-latency network connection.

### 4. My bot plays a random song after the queue finishes / How do I turn off autoplay?

#### Reason

- Autoplay is on by default.

#### Solution

- Toggle it per queue with `queue.toggleAutoplay()`.
- Change the default for every new queue with the `initQueue` event:

  ```ts
  import { Events } from "sonaria";

  sonaria.on(Events.INIT_QUEUE, queue => {
    queue.autoplay = false;
    queue.setVolume(50);
  });
  ```

## Common Issues

### How do I use slash commands with Sonaria?

Use a Seyfert `Command` and resolve the voice channel from the member's voice state:

```ts
import { ApplicationCommandOptionType, Command } from "seyfert";
import { isTextChannelInstance } from "sonaria";
import { sonaria } from "../sonaria.js";

export default new Command({
  name: "play",
  description: "Play a song",
  options: [
    {
      name: "query",
      description: "A URL or a search query",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async run(context) {
    const query = context.resolver.getString("query", true);
    const voiceChannel = context.member?.voice("cache")?.channel("cache");
    if (!voiceChannel) {
      return context.editOrReply({ content: "You must be in a voice channel!" });
    }

    const textChannel = context.channel("cache");
    await context.deferReply();

    try {
      await sonaria.play(voiceChannel, query, {
        member: context.member,
        textChannel: isTextChannelInstance(textChannel) ? textChannel : undefined,
      });
      await context.editResponse({ content: `Searching for: \`${query}\`` });
    } catch (error) {
      await context.editResponse({ content: `Error: ${(error as Error).message}` });
    }
  },
});
```

### Why are the shortcut methods deprecated?

In Sonaria (as in DisTube v5.2), shortcut methods like `sonaria.pause(guild)` and
`sonaria.skip(guild)` are deprecated. Use the queue methods directly:

```ts
// ❌ Deprecated (will be removed in v6.0)
sonaria.pause(guildId);
sonaria.skip(guildId);

// ✅ Recommended
const queue = sonaria.getQueue(guildId);
queue.pause();
queue.skip();
```

This provides better type safety, more explicit code, and easier error handling.

### Why is `queue.playing` true when paused?

The `queue.playing` property indicates the queue is **active** (has started playing), not that audio
is currently being output. It remains `true` while paused and only becomes `false` when stopped.

```js
// ❌ Deprecated - don't use queue.playing (will be removed in v6.0)
if (queue.playing) { ... }

// ✅ Check if audio is currently playing
if (!queue.paused) { ... }

// ✅ Check if paused
if (queue.paused) { ... }

// ✅ Check if stopped
if (queue.stopped) { ... }
```
