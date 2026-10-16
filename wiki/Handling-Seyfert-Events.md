# Handling Seyfert Events

Sonaria provides utilities to help you handle Seyfert events for a better user experience. Register
a gateway event with [`createEvent`](https://seyfert.dev) and use the exported helpers.

> [!NOTE]
> The examples below assume the `sonaria` instance is exported from a module (for example
> `sonaria.js`), exactly as created in the [[Sonaria Guide]].

## Leave the voice channel if there is no user in it

```ts
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

## Pause the queue if there is no user in the voice channel and resume it if there is

```ts
import { createEvent } from "seyfert";
import { isVoiceChannelEmpty } from "sonaria";
import { sonaria } from "./sonaria.js";

export default createEvent({
  data: { name: "voiceStateUpdate" },
  run([state]) {
    const queue = sonaria.getQueue(state);
    if (!queue) return;

    if (isVoiceChannelEmpty(state)) {
      if (!queue.paused) void queue.pause();
    } else if (queue.paused) {
      void queue.resume();
    }
  },
});
```

## Leave the voice channel after a period of inactivity

```ts
import { Events } from "sonaria";
import { sonaria } from "./sonaria.js";

const inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Start a timer when the queue finishes
sonaria.on(Events.FINISH, queue => {
  const timer = setTimeout(() => {
    queue.voice.leave();
    inactivityTimers.delete(queue.id);
  }, 5 * 60 * 1000);
  inactivityTimers.set(queue.id, timer);
});

// Clear the timer whenever a new song starts playing
sonaria.on(Events.PLAY_SONG, queue => {
  const timer = inactivityTimers.get(queue.id);
  if (timer) {
    clearTimeout(timer);
    inactivityTimers.delete(queue.id);
  }
});
```
