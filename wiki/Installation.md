# Installation

Sonaria depends on a few libraries and system tools to function correctly. This guide will walk you
through setting everything up.

## Requirements

- **Node.js**: `24.22.0` or higher
- **Seyfert**: `5.0.0` or higher
- **FFmpeg**: Required for audio processing and filters

Sonaria ships its own native Discord voice implementation, so you do **not** need `discord.js`,
`@discordjs/voice` or an Opus package.

## 1. Install Sonaria

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

> [!NOTE]
> Sonaria is built for [Bun](https://bun.sh/) and Node.js. Bun is recommended as the package manager
> and runtime.

## 2. Install FFmpeg

FFmpeg is used to process the audio stream and to apply filters. It must be installed and available
on your `PATH`.

- **Windows**: [Download guide](https://www.gyan.dev/ffmpeg/builds/)
- **Linux (Debian/Ubuntu)**: `sudo apt-get install ffmpeg`
- **Linux (Fedora)**: `sudo dnf install ffmpeg`
- **macOS**: `brew install ffmpeg`

> [!WARNING]
> Do not use the `ffmpeg-static` package.

If FFmpeg is not on your `PATH`, point Sonaria to it with the `ffmpeg.path` option:

```ts
const sonaria = new Sonaria(client, {
  ffmpeg: {
    path: "/usr/local/bin/ffmpeg",
  },
});
```

## 3. Install the voice plugin

Sonaria uses Seyfert's plugin system for voice. Install the native voice plugin when you create your
client:

```ts
import { Client } from "seyfert";
import { voice } from "sonaria";

const client = new Client({
  plugins: [voice()],
});
```

The plugin attaches `client.voice` and registers the `GuildVoiceStates` gateway intent for you. You
must register it before creating the `Sonaria` instance.

## Next steps

Head to the [[Sonaria Guide]] to build your first music bot.
