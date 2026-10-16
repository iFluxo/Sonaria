# Plugin System

Sonaria does not bundle any music source. Instead, sources are provided by **plugins**, so you can
support exactly the services you need. All of Sonaria's public queue and playback APIs are source
agnostic.

## Plugin types

Sonaria ships three abstract plugin classes. Extend the one that matches your source:

### `ExtractorPlugin`

Can extract the info, search, and play songs directly from its source.

- `validate(url)` - whether this plugin handles the given URL.
- `resolve(url, options)` - turn a URL into a `Song` or `Playlist`.
- `searchSong(query, options)` - search for a song by text.
- `getStreamURL(song)` - the audio stream URL to play.
- `getRelatedSongs(song)` - related songs, used by autoplay.

### `InfoExtractorPlugin`

Only extracts the info from supported links, but cannot play songs directly from its source. This is
useful for services that provide metadata but not audio, when the audio itself must be provided by
another plugin.

- `validate(url)`
- `resolve(url, options)`
- `createSearchQuery(song)` - a query used to find a playable version elsewhere.

### `PlayableExtractorPlugin`

Can extract and play songs from supported links, but cannot search for songs from its source.

- `validate(url)`
- `resolve(url, options)`
- `getStreamURL(song)`
- `getRelatedSongs(song)`

## Registering plugins

Plugins are passed to the `plugins` option and are checked in order, so put higher priority plugins
first:

```ts
import { Sonaria } from "sonaria";

const sonaria = new Sonaria(client, {
  plugins: [firstPlugin, secondPlugin],
});
```

## How resolution works

When you pass a string to `Sonaria#play()`:

- If it is a URL, Sonaria asks each plugin (in order) if `validate(url)` matches, then calls
  `resolve(url, options)` on the first match.
- If it is a search query, Sonaria asks each `ExtractorPlugin` for `searchSong(query, options)`.

The resulting `Song` remembers the plugin that created it, so the correct `getStreamURL` /
`createSearchQuery` implementation is used later during playback.

## Related pages

- [[Projects Hub]] - plugins and community projects.
- [API Documentation](https://sonaria.js.org/) - full reference for the plugin base classes.
