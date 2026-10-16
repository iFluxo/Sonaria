# Sonaria Guide

> [!NOTE]
> This guide assumes a basic understanding of JavaScript/TypeScript and
> [Seyfert](https://seyfert.dev). If you are new to Seyfert, read its documentation first.

## Introduction

Welcome to the Sonaria guide! This tutorial will walk you through creating a Discord bot with music
commands using Sonaria.

Sonaria manages queues, playback and voice connections for you, and gets its music from plugins. It
ships a native Discord voice implementation, so there is nothing extra to configure for audio.

## Prerequisites

- Solid understanding of JavaScript/TypeScript
- A basic Discord bot set up with Seyfert
- Node.js `24.22.0` or higher

Please follow the [[Installation]] guide to set up Sonaria, Seyfert and FFmpeg before proceeding.

## Getting Started

### 1. Create the client and install the voice plugin

The native voice plugin must be registered on your Seyfert client:

```ts
import { Client } from "seyfert";
import { voice } from "sonaria";

export const client = new Client({
  plugins: [voice()],
});
```

`voice()` attaches `client.voice`, manages the voice gateway, and registers the `GuildVoiceStates`
intent automatically.

### 2. Create the Sonaria instance

```ts
import { Sonaria } from "sonaria";
import { client } from "./client.js";

export const sonaria = new Sonaria(client, {
  // Sonaria ships no music source of its own. Add at least one plugin so it
  // can search for and stream songs. See the [[Projects Hub]].
  plugins: [],
});
```

### 3. Listen for events

Sonaria emits events through your instance. A common setup:

```ts
import { Events } from "sonaria";
import { sonaria } from "./sonaria.js";

sonaria
  .on(Events.PlaySong, (queue, song) =>
    queue.textChannel?.messages.write({
      content: `Playing \`${song.name}\` - \`${song.formattedDuration}\`\nRequested by: ${song.user}`,
    }),
  )
  .on(Events.AddSong, (queue, song) =>
    queue.textChannel?.messages.write({
      content: `Added \`${song.name}\` - \`${song.formattedDuration}\` to the queue`,
    }),
  )
  .on(Events.Error, (error, queue) =>
    queue.textChannel?.messages.write({ content: `An error occurred: ${error.message}` }),
  )
  .on(Events.Finish, queue =>
    queue.textChannel?.messages.write({ content: "Queue finished!" }),
  );
```

### 4. Create a play command

`Sonaria#play()` accepts a URL, a search query, a `Song` or a `Playlist`:

```ts
import { ApplicationCommandOptionType, Command } from "seyfert";
import { isTextChannelInstance } from "sonaria";
import { sonaria } from "../sonaria.js";

export default new Command({
  name: "play",
  description: "Play a song from a URL or a search query",
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

> [!TIP]
> `Sonaria#play()` derives the default member (your bot) and text channel from the options you pass.
> For a user-initiated command, always pass `member` and `textChannel` so the queue can post updates.

### 5. Basic controls

Every method is available on the `Queue` returned by `sonaria.getQueue(guildId)`:

```ts
const queue = sonaria.getQueue(guildId);
if (!queue) return context.editOrReply({ content: "Nothing is playing!" });

await queue.stop(); // Stop and clear the queue
await queue.skip(); // Skip the current song
await queue.pause(); // Pause playback
await queue.resume(); // Resume playback
await queue.shuffle(); // Shuffle the upcoming songs
queue.setVolume(75); // Set the volume (0-100)
queue.setRepeatMode(); // Cycle the repeat mode: Off -> Song -> Queue
queue.toggleAutoplay(); // Toggle autoplay
```

## Best Practices

### 1. Always check for queue existence

```ts
const queue = sonaria.getQueue(guildId);
if (!queue) {
  return context.editOrReply({ content: "Nothing is playing!" });
}
```

### 2. Handle errors properly

Wrap `sonaria.play()` in a try/catch and listen to the `error` event:

```ts
try {
  await sonaria.play(voiceChannel, query, options);
} catch (error) {
  await context.editOrReply({ content: `Error: ${(error as Error).message}` });
}

sonaria.on(Events.Error, (error, queue, song) => {
  queue.textChannel?.messages.write({ content: `Error playing ${song?.name}: ${error.message}` });
});
```

### 3. Use TypeScript

Sonaria is written in TypeScript and provides full type definitions:

```ts
import { Events, type Queue, type Song } from "sonaria";

sonaria.on(Events.PlaySong, (queue: Queue, song: Song) => {
  // Full type support
});
```

### 4. Clean up resources

Leave voice channels when appropriate to free up resources:

```ts
// Leave when the queue finishes
sonaria.on(Events.Finish, queue => {
  queue.voice.leave();
});

// Leave when the voice channel becomes empty
import { createEvent } from "seyfert";
import { isVoiceChannelEmpty } from "sonaria";
import { sonaria } from "./sonaria.js";

export default createEvent({
  data: { name: "voiceStateUpdate" },
  run([state]) {
    const voice = sonaria.voices.get(state);
    if (voice && isVoiceChannelEmpty(state)) {
      voice.leave();
    }
  },
});
```

### 5. Configure queue defaults

Set default queue properties using the `initQueue` event:

```ts
sonaria.on(Events.InitQueue, queue => {
  queue.autoplay = false; // Disable autoplay
  queue.setVolume(50); // Set the default volume
  queue.setRepeatMode(0); // Disable repeat
});
```

## Next Steps

- Explore the [API Documentation](https://sonaria.js.org/) for all available methods.
- Check out [[Audio Effects & Filters]] to enhance the listening experience.
- Learn about the [[Plugin System]] to support more music sources.
- See [[Handling Seyfert Events]] for advanced voice state handling.
- Read the [[Frequently Asked Questions]] for common issues and solutions.
