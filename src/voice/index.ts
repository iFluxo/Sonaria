import { createDaveSessionFactory } from "./dave/session";
import { createVoicePlugin, type VoicePlugin } from "./plugin";
import { createRuntimeAdapter } from "./runtime/adapter";
import { createBunUdpSocket } from "./runtime/bun-udp";
import type { VoicePluginOptions } from "./types";

const runtime = createRuntimeAdapter(createBunUdpSocket);

/**
 * Creates a stateful Seyfert voice plugin for a single client.
 *
 * The returned plugin is the native Sonaria voice implementation. Register it on
 * your Seyfert client so Sonaria can manage voice connections and receive raw
 * gateway voice dispatches.
 *
 * @param options - Optional voice plugin options.
 */
export function voice(options: VoicePluginOptions = {}): VoicePlugin {
  return createVoicePlugin(runtime, createDaveSessionFactory(), options);
}

export * from "./public";
