# Sonaria

A powerful music library for Discord bots built on [Seyfert](https://seyfert.dev) 5. Sonaria manages
queues, playback and voice connections for you, ships a **native voice implementation**, and supports pluggable sources and integrated FFmpeg audio
filters.

## Features

- **Seyfert-first** – works directly with your existing Seyfert client.
- **Native voice** – a self-contained Discord voice stack (gateway, RTP, encryption, DAVE/E2EE) is
  vendored into the library, so there is no external voice dependency to install or configure.
- **Plugin architecture** – extract, search and stream songs from any source you implement.
- **Audio filters** – apply built-in FFmpeg filters (`bassboost`, `nightcore`, …) or define your own.
- **Fully typed** – written in TypeScript with strict types.

## Requirements

- [Node.js](https://nodejs.org/) `24.22.0` or higher (Bun is recommended)
- [Seyfert](https://www.npmjs.com/package/seyfert) `5.0.0` or higher
- [FFmpeg](https://ffmpeg.org/) installed and available on your `PATH`

## Installation

```bash
# Using bun (recommended)
bun add sonaria seyfert

# Using npm
npm install sonaria seyfert

# Using pnpm
pnpm add sonaria seyfert

# Using yarn
yarn add sonaria seyfert
```

FFmpeg must be installed separately; do **not** use the `ffmpeg-static` package.

- **Windows**: [download guide](https://www.gyan.dev/ffmpeg/builds/)
- **Debian/Ubuntu**: `sudo apt-get install ffmpeg`
- **macOS**: `brew install ffmpeg`

## Quick Start

Register the native voice plugin on your client, then create a `Sonaria` instance:

```ts
import { Client } from "seyfert";
import { Events, Sonaria, voice } from "sonaria";

const client = new Client({
  // `voice()` adds `client.voice` and the required gateway intents.
  plugins: [voice()],
});

const sonaria = new Sonaria(client, {
  // Add your source plugins here.
  plugins: [],
});

sonaria
  .on(Events.PlaySong, (queue, song) =>
    queue.textChannel?.messages.write({
      content: `Playing \`${song.name}\` - \`${song.formattedDuration}\``,
    }),
  )
  .on(Events.AddSong, (queue, song) =>
    queue.textChannel?.messages.write({ content: `Added \`${song.name}\` to the queue` }),
  )
  .on(Events.Error, (error, queue) =>
    queue.textChannel?.messages.write({ content: `An error occurred: ${error.message}` }),
  );

client.start().then(() => client.uploadCommands());
```

### Playing a song

`Sonaria#play()` accepts a URL, a search query, a `Song` or a `Playlist`:

```ts
import { ApplicationCommandOptionType, Command } from "seyfert";
import { isTextChannelInstance } from "sonaria";

export const play = new Command({
  name: "play",
  description: "Play a song or playlist",
  options: [
    {
      name: "query",
      description: "A URL or a search query",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async run(context) {
    const query = context.resolver.getString("query");
    const voiceChannel = context.member?.voice("cache")?.channel("cache");
    if (!voiceChannel) {
      return context.editOrReply({ content: "Join a voice channel first." });
    }

    const textChannel = context.channel("cache");
    await context.deferReply();
    try {
      await sonaria.play(voiceChannel, query, {
        member: context.member,
        textChannel: isTextChannelInstance(textChannel) ? textChannel : undefined,
      });
      await context.editResponse({ content: `Queued \`${query}\`` });
    } catch (error) {
      await context.editResponse({ content: `Error: ${(error as Error).message}` });
    }
  },
});
```

### Controlling playback

Every guild with an active queue has a `Queue` you can control. The shortcut methods on `Sonaria`
are deprecated — prefer the queue methods:

```ts
const queue = sonaria.getQueue(guildId);
if (queue) {
  await queue.skip();
  await queue.pause();
  await queue.resume();
  queue.setVolume(75);
  queue.filters.add("bassboost");
}
```

## Events

| Event | Arguments | Description |
| --- | --- | --- |
| `Events.AddList` | `queue`, `playlist` | A playlist was added to the queue. |
| `Events.AddSong` | `queue`, `song` | A song was added to the queue. |
| `Events.PlaySong` | `queue`, `song` | A song started playing. |
| `Events.FinishSong` | `queue`, `song` | A song finished playing. |
| `Events.Finish` | `queue` | The queue finished. |
| `Events.Error` | `error`, `queue`, `song?` | An error occurred. |
| `Events.NoRelated` | `queue`, `error` | Autoplay could not find a related song. |
| `Events.InitQueue` | `queue` | A queue was created. |
| `Events.DeleteQueue` | `queue` | A queue was deleted. |
| `Events.Disconnect` | `queue` | The bot disconnected from a voice channel. |
| `Events.Debug` | `message` | Internal debug message. |
| `Events.FfmpegDebug` | `message` | FFmpeg process output. |

## Audio filters

Sonaria ships a set of FFmpeg filters defined in `defaultFilters`. Apply them through
`queue.filters`:

```ts
queue.filters.add("bassboost");                 // add one
queue.filters.add(["nightcore", "vaporwave"]);  // add several
queue.filters.remove("bassboost");              // remove one
queue.filters.set(["3d"]);                      // replace all
queue.filters.clear();                          // remove all
```

Provide your own with the `customFilters` option:

```ts
const sonaria = new Sonaria(client, {
  customFilters: {
    custom: "bass=g=5",
  },
});
```

## Plugins

Sonaria does not bundle any source. Implement one of the plugin base classes and pass instances to
the `plugins` option:

- `ExtractorPlugin` – extract info, search, and stream.
- `InfoExtractorPlugin` – extract info only.
- `PlayableExtractorPlugin` – extract info and stream, but no search.

```ts
import { ExtractorPlugin, type ResolveOptions, type Song } from "sonaria";

class MyPlugin extends ExtractorPlugin {
  async validate(url: string) {
    return url.startsWith("https://example.com/");
  }

  async resolve<T>(url: string, options: ResolveOptions<T>) {
    return new Song(
      { source: "example", id: url, name: "Example", url, playFromSource: true, plugin: this },
      options,
    );
  }

  async searchSong<T>(query: string, options: ResolveOptions<T>) {
    return this.resolve(`https://example.com/search?q=${encodeURIComponent(query)}`, options);
  }

  async getStreamURL(): Promise<string> {
    return "https://example.com/audio.opus";
  }

  getRelatedSongs(): Song[] {
    return [];
  }
}
```

## Documentation

- **API reference**: <https://sonaria.js.org/>
- **Wiki**: <https://github.com/iFluxo/Sonaria/wiki>
- **Issues**: <https://github.com/iFluxo/Sonaria/issues>

## License

[MIT](LICENSE)
