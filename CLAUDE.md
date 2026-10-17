# CLAUDE.md — Sonaria Development Guide

This document provides guidance for working with the Sonaria codebase.

## Project Overview

Sonaria is a TypeScript music library for Discord bots built on [Seyfert](https://seyfert.dev) 5. It
manages queues, playback and voice connections, and ships a native Discord voice implementation
under `src/voice` — there is no dependency on `discord.js` or `@discordjs/voice`.

- **Node.js**: >= 24.22.0 (Bun recommended)
- **Framework**: Seyfert `>= 5.0.0` (peer dependency)
- **Package Manager**: Bun
- **Build**: `bun build` (ESM, Bun target) + `tsc` (declarations)
- **Test Framework**: `bun:test`
- **Linter/Formatter**: Biome

## Quick Commands

```bash
bun install           # Install dependencies
bun run build         # Build JS + type declarations into dist/
bun run test          # Run tests (bun test)
bun run test:coverage # Run tests with coverage
bun run lint          # Check linting/formatting (biome ci .)
bun run lint:fix      # Fix linting issues (biome check --write --unsafe)
bun run format        # Format code (biome format --write)
bun run type          # Type check (tsc --noEmit)
```

> **Overlay/proot filesystems:** Bun's default `hardlink` backend can silently produce truncated or
> missing package files on these mounts. This repository keeps its package cache next to
> `node_modules` (`bunfig.toml`) and the `pre-push` hook installs with `--backend=copyfile`, which is
> slower but deterministic. If a plain `bun install` ever leaves `node_modules` incomplete, run
> `bun install --backend=copyfile`.

## Project Structure

```
src/
├── Sonaria.ts              # Main class - extends TypedEmitter, orchestrates everything
├── index.ts                # Public API exports
├── type.ts                 # TypeScript type definitions, enums, interfaces
├── constant.ts             # Constants, default filters, audio config
├── util.ts                 # Utility functions (validation, type guards)
├── core/
│   ├── SonariaBase.ts      # Abstract base class providing access to managers
│   ├── SonariaHandler.ts   # URL/string resolution to Song/Playlist
│   ├── SonariaOptions.ts   # Options validation and FFmpeg config
│   ├── SonariaStream.ts    # FFmpeg stream handling
│   ├── SonariaVoice.ts     # Voice connection management for a guild
│   └── manager/
│       ├── BaseManager.ts          # Collection-backed storage
│       ├── GuildIdManager.ts       # Guild-keyed storage
│       ├── QueueManager.ts         # Queue lifecycle and playback
│       ├── SonariaVoiceManager.ts  # Voice connection manager
│       └── FilterManager.ts        # Per-queue audio filters
├── struct/
│   ├── Plugin.ts                   # Abstract plugin base
│   ├── ExtractorPlugin.ts          # Full-featured plugin
│   ├── InfoExtractorPlugin.ts      # Info-only plugin
│   ├── PlayableExtractorPlugin.ts  # Playable-only plugin
│   ├── Song.ts                     # Song model
│   ├── Playlist.ts                 # Playlist model
│   ├── Queue.ts                    # Guild queue
│   ├── TaskQueue.ts                # Task queuing system
│   ├── TypedEmitter.ts             # Type-safe event emitter
│   └── SonariaError.ts             # Error class with predefined codes
└── voice/                  # Vendored native voice implementation
    ├── index.ts            # `voice()` plugin factory
    ├── plugin.ts           # Seyfert plugin wiring
    ├── manager.ts          # VoiceManager
    ├── connection.ts       # VoiceConnection
    ├── gateway.ts          # Voice gateway
    ├── media/              # RTP, Opus, Ogg/WebM demuxing, playback
    ├── crypto/             # Encryption providers
    ├── dave/               # DAVE (E2EE) session handling
    ├── mls/                # MLS group state for DAVE
    └── runtime/            # UDP / runtime adapters
```

## Architecture Patterns

### Event-Driven Architecture
- `TypedEmitter<T>` is a small, dependency-free, type-safe event emitter.
- Events are declared in `SonariaEvents` / `SonariaVoiceEvents` in `src/type.ts`.
- `Queue` and managers emit events through the owning `Sonaria` instance.
- Event names live in the `Events` enum (`playSong`, `addSong`, `error`, …).

### Manager Pattern
- `BaseManager<V>` stores values in a Seyfert `Collection`.
- `GuildIdManager<V>` adds guild-id resolution on top.
- Each manager owns the lifecycle and state for its domain.

### Plugin Architecture
Three plugin types with different capabilities:
- `ExtractorPlugin`: validate, resolve, search, getStreamURL
- `InfoExtractorPlugin`: validate, resolve, createSearchQuery
- `PlayableExtractorPlugin`: validate, resolve, getStreamURL

### Native Voice
- `voice()` returns a Seyfert plugin that attaches `client.voice` and registers the
  `GuildVoiceStates` intent.
- `SonariaVoice` wraps a `VoiceConnection` and implements pause/resume as a gate in front of the
  demuxed Opus packet source, since the transport has no pause primitive.
- Volume is applied by FFmpeg, so changing volume or filters restarts the stream from the current
  playback position.

## Constants

Audio and timing constants are defined in `src/constant.ts`:

```typescript
AudioSampleRate = 48_000     // Hz
AudioChannels = 2             // Stereo
AudioBitrate = "128k"
DefaultVolume = 100            // 0-100%
JoinTimeoutMs = 30_000       // 30 seconds
ReconnectTimeoutMs = 5_000   // 5 seconds
ReconnectMaxAttempts = 5     // Max rejoin attempts
HttpRedirectCodes            // Set of redirect status codes
MaxRedirectDepth = 5         // Max redirect follows
```

Always use these constants instead of magic numbers. The exported `version` must stay in sync with
`package.json` (enforced by `tests/constant.test.ts`).

## Coding Conventions

### TypeScript
- Strict mode enabled with all strict checks.
- Use `import type { ... } from "..."` for type-only imports.
- Path aliases: `@/*` maps to `src/*`, `@` maps to `src/index.ts`.
- No unused variables or parameters (enforced by tsconfig).
- Use `catch (error: unknown)` instead of `catch (error: any)`.

### Error Handling
```typescript
// Good - type-safe error handling
catch (e: unknown) {
  const error = e instanceof Error ? e : new Error(String(e));
  const message = e instanceof Error ? (e.stack ?? e.message) : String(e);
}

// Bad - loses type safety
catch (e: any) {
  console.log(e.message); // Unsafe
}
```

### Formatting (Biome)
- 2 spaces indentation
- 120 character line width
- Double quotes for strings
- Trailing commas everywhere
- Arrow functions: parentheses only when needed (`x => x`, `(a, b) => a + b`)
- No `console` calls in `src` (`noConsole` is enforced)

### Naming Conventions
- Classes: PascalCase (`SonariaVoice`, `QueueManager`)
- Methods/Properties: camelCase (`getQueue`, `playSong`)
- Private fields: prefix with `#` or `_` for internal (`#getQueue`, `_beginTime`)
- Constants: UPPER_SNAKE_CASE (`AudioSampleRate`, `DefaultVolume`)
- Enums: PascalCase with UPPER_SNAKE_CASE members

## Error Handling

### SonariaError Class
Custom error class with predefined error codes and messages:

```typescript
// Static error (no parameters)
throw new SonariaError("NoQueue");

// Template error (with parameters)
throw new SonariaError("InvalidType", "string", actualValue, "paramName");
throw new SonariaError("FfmpegExited", exitCode);
```

`SonariaError#errorCode` (alias `#code`) holds the code, and `#name` is `"SonariaError"`.

### Error Codes
Key categories:
- Type validation: `InvalidType`, `EmptyArray`, `EmptyString`, `InvalidKey`
- Voice operations: `NotInVoice`, `VoiceFull`, `VoiceConnectFailed`, `VoicePluginMissing`
- Queue operations: `NoQueue`, `QueueExist`, `NoPrevious`, `NoUpNext`, `NoSongPosition`
- Playback: `UnavailableVideo`, `UnplayableFormats`, `NonNsfw`, `NoStreamUrl`

### Validation Patterns
Use the guards from `src/util.ts`:
```typescript
if (!isSupportedVoiceChannel(channel)) {
  throw new SonariaError("InvalidType", "BaseGuildVoiceChannel", channel, "voiceChannel");
}
checkInvalidKey(options, validKeys, "options");
```

## Testing

Tests use the [Bun test runner](https://bun.sh/docs/cli/test) and mirror the source structure under
`tests/`.

```ts
import { describe, expect, mock, spyOn, test } from "bun:test";
import { SonariaError, Queue } from "../../src";

describe("Queue", () => {
  test("adds a song", () => {
    const queue = createQueue();
    queue.addToQueue(song);
    expect(queue.songs).toHaveLength(1);
  });
});
```

### Mocking
- `mock(() => value)` creates a standalone mock function.
- `spyOn(object, "method").mockImplementation(...)` replaces a method on an instance.
- `mock.module("node:child_process", () => ({ spawn, spawnSync }))` mocks built-in modules. Call it
  **before** dynamically importing the module under test.
- `mock.restore()` restores spies created with `spyOn`.
- Tests that construct `Sonaria` need a working `seyfert` install; the native voice plugin pulls in
  Seyfert at runtime.

### Running Tests
```bash
bun run test                 # Run all tests
bun test tests/struct        # Run a specific directory
bun test --watch             # Watch mode
```

## Plugin Development

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

## Build & Release

- `bun run build:js` bundles `src/index.ts` to `dist/index.js` (ESM, `--target bun`) with `seyfert`
  and the `@noble/*` packages marked external.
- `bun run build:types` emits declarations with `tsc --project tsconfig.build.json`.
- Publishing runs on GitHub releases; `prepublishOnly` runs lint, type check and tests, and
  `prepack` runs the build.

## Deprecations

The following are deprecated and will be removed in a future major version:

| Deprecated | Replacement |
| --- | --- |
| `sonaria.pause(guild)` | `sonaria.getQueue(guild).pause()` |
| `sonaria.resume(guild)` | `sonaria.getQueue(guild).resume()` |
| `sonaria.stop(guild)` | `sonaria.getQueue(guild).stop()` |
| `sonaria.setVolume(guild, vol)` | `sonaria.getQueue(guild).setVolume(vol)` |
| `sonaria.skip(guild, opts)` | `sonaria.getQueue(guild).skip(opts)` |
| `sonaria.previous(guild)` | `sonaria.getQueue(guild).previous()` |
| `sonaria.shuffle(guild)` | `sonaria.getQueue(guild).shuffle()` |
| `sonaria.jump(guild, n, opts)` | `sonaria.getQueue(guild).jump(n, opts)` |
| `sonaria.setRepeatMode(guild, mode)` | `sonaria.getQueue(guild).setRepeatMode(mode)` |
| `sonaria.toggleAutoplay(guild)` | `sonaria.getQueue(guild).toggleAutoplay()` |
| `sonaria.addRelatedSong(guild)` | `sonaria.getQueue(guild).addRelatedSong()` |
| `sonaria.seek(guild, time)` | `sonaria.getQueue(guild).seek(time)` |
| `queue.isPlaying()` | `!queue.paused` |
| `queue.isPaused()` | `queue.paused` |
| `queue.playing` | `!queue.paused` |
