# Audio Effects & Filters

Sonaria applies audio filters with FFmpeg. Filters are managed per queue through `queue.filters`.

## Built-in filters

The following filters are available out of the box (`defaultFilters`):

| Name | Description |
| --- | --- |
| `3d` | Harsh 3D audio effect. |
| `bassboost` | Boosts the bass frequencies. |
| `echo` | Adds an echo. |
| `flanger` | Applies a flanger effect. |
| `gate` | Applies a noise gate. |
| `haas` | Applies the Haas stereo effect. |
| `karaoke` | Reduces the vocal frequencies. |
| `nightcore` | Speeds up the song and boosts the bass. |
| `reverse` | Reverses the audio. |
| `vaporwave` | Slows down the song. |
| `mcompand` | Applies multiband dynamics compression. |
| `phaser` | Applies a phaser effect. |
| `tremolo` | Applies a tremolo effect. |
| `surround` | Applies a surround effect. |
| `earwax` | Applies the "earwax" effect. |

## Applying filters

```ts
queue.filters.add("bassboost"); // add one filter
queue.filters.add(["nightcore", "vaporwave"]); // add several
queue.filters.remove("bassboost"); // remove one
queue.filters.set(["3d"]); // replace all filters
queue.filters.clear(); // remove all filters
```

Applying filters restarts the stream at the current playback position, so playback resumes from
where it was.

## Custom filters

Add or override filters with the `customFilters` option. Values are raw FFmpeg `-af` arguments:

```ts
const sonaria = new Sonaria(client, {
  customFilters: {
    custom: "bass=g=5",
  },
});
```

You can then apply `"custom"` like any built-in filter, or pass an inline filter object:

```ts
queue.filters.add({ name: "custom", value: "bass=g=5" });
```

## FFmpeg arguments

The FFmpeg arguments used for every stream are available in `sonaria.options.ffmpeg.args`, split into
`global`, `input` and `output`. The `output.af` entry is controlled by the filters above.

```ts
const sonaria = new Sonaria(client, {
  ffmpeg: {
    args: {
      input: { reconnect: 1 },
    },
  },
});
```
