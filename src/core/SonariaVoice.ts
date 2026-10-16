import type { AllGuildVoiceChannels, GuildMember, VoiceState } from "seyfert";
import { JoinTimeoutMs } from "../constant";
import { SonariaError } from "../struct/SonariaError";
import { TypedEmitter } from "../struct/TypedEmitter";
import type { SonariaVoiceEvents } from "../type";
import { isSupportedVoiceChannel } from "../util";
import type { VoiceConnection } from "../voice/connection";
import type { VoicePlayback, VoicePlaybackSource } from "../voice/media/playback";
import type { VoiceConnectionState } from "../voice/types";
import type { SonariaVoiceManager } from "./manager/SonariaVoiceManager";
import type { SonariaStream } from "./SonariaStream";

/**
 * A voice connection managed by Sonaria for a single guild.
 *
 * The native voice implementation has no explicit pause primitive, so pausing
 * is implemented as a gate in front of the demuxed Opus packet source: while
 * paused the source simply stops yielding packets and the voice transport sends
 * silence without advancing the reported playback time.
 */
export class SonariaVoice extends TypedEmitter<SonariaVoiceEvents> {
  /**
   * The voice manager that instantiated this connection
   */
  readonly voices: SonariaVoiceManager;
  /**
   * Guild id of this connection
   */
  readonly id: string;
  /**
   * Whether the connection has been disconnected
   */
  isDisconnected = false;
  /**
   * Whether the current stream already emitted an error
   */
  emittedError = false;
  /**
   * The currently playing stream
   */
  stream?: SonariaStream;
  #channel!: AllGuildVoiceChannels;
  #connection?: VoiceConnection;
  #playback?: VoicePlayback;
  #volume = 100;
  #paused = false;
  #resumeSignal?: () => void;
  #generation = 0;
  #streamErrorHandler?: (error: Error) => void;

  constructor(voiceManager: SonariaVoiceManager, channel: AllGuildVoiceChannels) {
    super();
    this.voices = voiceManager;
    this.id = channel.guildId;
    this.channel = channel;
    this.voices.add(this.id, this);
    this.voices.client.voice.on("voiceConnectionStateChange", this.#onConnectionStateChange);
  }

  #onConnectionStateChange = (connection: VoiceConnection, next: VoiceConnectionState) => {
    if (connection.guildId !== this.id || next.status !== "destroyed" || this.isDisconnected) return;
    this.leave(next.error);
  };

  /**
   * The voice channel the bot is in
   */
  get channel(): AllGuildVoiceChannels {
    return this.#channel;
  }

  set channel(channel: AllGuildVoiceChannels) {
    if (!isSupportedVoiceChannel(channel)) {
      throw new SonariaError("InvalidType", "BaseGuildVoiceChannel", channel, "SonariaVoice#channel");
    }
    if (channel.guildId !== this.id) throw new SonariaError("VoiceDifferentGuild");
    if (channel.client?.botId !== this.voices.client.botId) throw new SonariaError("VoiceDifferentClient");
    if (channel.id === this.#channel?.id) return;
    this.#channel = channel;
  }

  /**
   * The guild id of this connection
   */
  get guildId() {
    return this.id;
  }

  /**
   * The voice channel id the bot is in, if connected
   */
  get channelId(): string | undefined {
    return this.#connection?.channelId ?? undefined;
  }

  /**
   * The cached guild member of the client for this guild
   */
  get clientMember(): GuildMember | undefined {
    return this.voices.client.cache.members?.get(this.voices.client.botId, this.id);
  }

  /**
   * The cached voice state of the client for this guild
   */
  get voiceState(): VoiceState | undefined {
    return this.voices.client.cache.voiceStates?.get(this.voices.client.botId, this.id);
  }

  /**
   * Join a voice channel with this connection
   * @param channel - A voice channel
   */
  async join(channel?: AllGuildVoiceChannels): Promise<SonariaVoice> {
    if (channel) this.channel = channel;
    try {
      this.#connection = await this.voices.client.voice.connect({
        guildId: this.id,
        channelId: this.#channel.id,
        move: true,
        selfMute: false,
        selfDeaf: false,
      });
    } catch {
      this.#connection = undefined;
      this.voices.remove(this.id);
      throw new SonariaError("VoiceConnectFailed", JoinTimeoutMs / 1000);
    }
    return this;
  }

  /**
   * Stop the playing stream and terminate its FFmpeg process
   */
  stop(): Promise<void> {
    const playback = this.#playback;
    this.#playback = undefined;
    const stream = this.stream;
    this.stream = undefined;
    const stopping = playback ? playback.stop() : Promise.resolve();
    return stopping.finally(() => stream?.kill());
  }

  /**
   * Leave the voice channel of this connection
   * @param error - Optional, an error to emit with the `disconnect` event.
   */
  leave(error?: Error) {
    void this.stop();
    if (!this.isDisconnected) {
      this.emit("disconnect", error);
      this.isDisconnected = true;
    }
    const connection = this.#connection;
    this.#connection = undefined;
    if (connection && connection.state.status !== "destroyed") {
      void this.voices.client.voice.disconnect(this.id).catch(() => undefined);
    }
    this.voices.remove(this.id);
    this.voices.client.voice.off("voiceConnectionStateChange", this.#onConnectionStateChange);
  }

  /**
   * Play a {@link SonariaStream}
   * @param dtStream - SonariaStream
   */
  async play(dtStream: SonariaStream) {
    this.emittedError = false;
    // Remove previous error listener to prevent memory leaks
    if (this.stream && this.#streamErrorHandler) this.stream.off("error", this.#streamErrorHandler);
    this.#streamErrorHandler = (error: Error) => {
      if (this.emittedError) return;
      this.emittedError = true;
      this.emit("error", error);
    };
    dtStream.on("error", this.#streamErrorHandler);

    const generation = ++this.#generation;

    // The voice transport only allows a single active transmission at a time.
    const previous = this.#playback;
    this.#playback = undefined;
    if (previous) await previous.stop();

    const connection = this.#connection;
    if (!connection || connection.state.status === "destroyed") {
      dtStream.kill();
      throw new SonariaError("VoiceReconnectFailed");
    }
    if (connection.state.status !== "ready") {
      dtStream.kill();
      throw new SonariaError("VoiceConnectFailed", JoinTimeoutMs / 1000);
    }

    dtStream.spawn();
    this.stream = dtStream;

    let playback: VoicePlayback;
    try {
      playback = connection.play(this.#gate(dtStream.source));
    } catch (error) {
      dtStream.kill();
      this.stream = undefined;
      throw error;
    }
    this.#playback = playback;
    void playback.done.then(
      () => {
        if (generation === this.#generation) this.emit("finish");
      },
      (error: unknown) => {
        if (generation !== this.#generation || this.emittedError) return;
        this.emittedError = true;
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      },
    );
  }

  #gate(source: VoicePlaybackSource): VoicePlaybackSource {
    const self = this;
    return {
      async *[Symbol.asyncIterator]() {
        for await (const packet of source) {
          while (self.#paused) {
            await new Promise<void>(resolve => {
              self.#resumeSignal = resolve;
            });
            self.#resumeSignal = undefined;
          }
          yield packet;
        }
      },
    };
  }

  /**
   * Pause the playing stream without closing the voice connection
   */
  pause() {
    this.#paused = true;
  }

  /**
   * Resume the playing stream
   */
  unpause() {
    this.#paused = false;
    const resume = this.#resumeSignal;
    this.#resumeSignal = undefined;
    resume?.();
  }

  /**
   * Get or set the volume percentage
   */
  get volume() {
    return this.#volume;
  }

  set volume(volume: number) {
    if (typeof volume !== "number" || Number.isNaN(volume)) {
      throw new SonariaError("InvalidType", "number", volume, "volume");
    }
    if (volume < 0) {
      throw new SonariaError("NumberCompare", "Volume", "bigger or equal to", 0);
    }
    const changed = this.#volume !== volume;
    this.#volume = volume;
    if (!changed || !this.#playback || !this.stream || this.#paused) return;
    // Volume is applied by FFmpeg, so changing it restarts the stream at the
    // current playback position (mirroring how filters are re-applied).
    const queue = this.voices.queues.get(this.id);
    if (!queue?.songs.length || queue.stopped) return;
    queue._beginTime = this.playbackTime;
    void queue.play(false);
  }

  /**
   * Playback duration of the current playback in seconds (time since playback started)
   */
  get playbackDuration() {
    return (this.#playback?.playedDurationMs ?? 0) / 1000;
  }

  /**
   * Current playback time in seconds, accounting for seek offset
   */
  get playbackTime() {
    return this.playbackDuration + (this.stream?.seekTime ?? 0);
  }

  /**
   * Self-deaf the bot.
   * @param selfDeaf - Whether or not the bot should be SelfDeafened
   * @returns `true` if the self state was updated
   */
  async setSelfDeaf(selfDeaf: boolean): Promise<boolean> {
    if (typeof selfDeaf !== "boolean") {
      throw new SonariaError("InvalidType", "boolean", selfDeaf, "selfDeaf");
    }
    const connection = this.#connection;
    if (connection?.state.status !== "ready") return false;
    await connection.setSelfState({ selfDeaf });
    return true;
  }

  /**
   * Self-mute the bot.
   * @param selfMute - Whether or not the bot should be SelfMuted
   * @returns `true` if the self state was updated
   */
  async setSelfMute(selfMute: boolean): Promise<boolean> {
    if (typeof selfMute !== "boolean") {
      throw new SonariaError("InvalidType", "boolean", selfMute, "selfMute");
    }
    const connection = this.#connection;
    if (connection?.state.status !== "ready") return false;
    await connection.setSelfState({ selfMute });
    return true;
  }
}
