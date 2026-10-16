import type { AllGuildTextableChannels, AllGuildVoiceChannels } from "seyfert";
import { Queue } from "../../struct/Queue";
import { SonariaError } from "../../struct/SonariaError";
import type { Song } from "../../struct/Song";
import { Events, RepeatMode } from "../../type";
import { objectKeys } from "../../util";
import type { StreamOptions } from "../SonariaStream";
import { checkFFmpeg, SonariaStream } from "../SonariaStream";
import { GuildIdManager } from "./GuildIdManager";

/**
 * Manages the queues of the guilds.
 */
export class QueueManager extends GuildIdManager<Queue> {
  /**
   * Create a queue for a guild
   * @param voiceChannel - The voice channel to join
   * @param textChannel  - The default text channel of the queue
   */
  async create(voiceChannel: AllGuildVoiceChannels, textChannel?: AllGuildTextableChannels): Promise<Queue> {
    if (this.has(voiceChannel.guildId)) throw new SonariaError("QueueExist");
    const voice = this.voices.create(voiceChannel);
    const queue = new Queue(this.sonaria, voice, textChannel);
    await queue._taskQueue.queuing();
    try {
      this.debug(`[${queue.id}] Creating queue`);
      checkFFmpeg(this.sonaria);
      await voice.join();
      this.#voiceEventHandler(queue);
      this.add(queue.id, queue);
      this.emit(Events.InitQueue, queue);
      return queue;
    } finally {
      queue._taskQueue.resolve();
    }
  }

  /**
   * Listen to the {@link SonariaVoice} events and handle the queue
   * @param queue - The queue to handle
   */
  #voiceEventHandler(queue: Queue) {
    queue._listeners = {
      disconnect: error => {
        queue.remove();
        this.emit(Events.Disconnect, queue);
        if (error) this.emitError(error, queue, queue.songs?.[0]);
      },
      error: error => void this.#handlePlayingError(queue, error),
      finish: () => void this.handleSongFinish(queue),
    };
    for (const event of objectKeys(queue._listeners)) {
      queue.voice.on(event, queue._listeners[event]);
    }
  }

  /**
   * Handle the queue when a {@link Song} finishes
   * @param queue - The queue
   */
  async handleSongFinish(queue: Queue): Promise<void> {
    if (queue._manualUpdate) {
      queue._manualUpdate = false;
      await this.playSong(queue);
      return;
    }
    this.debug(`[${queue.id}] Handling song finish`);
    const song = queue.songs[0];
    this.emit(Events.FinishSong, queue, song);
    await queue._taskQueue.queuing();
    try {
      if (queue.stopped) return;
      if (queue.repeatMode === RepeatMode.Queue) queue.songs.push(song);

      if (queue.repeatMode !== RepeatMode.Song) {
        const prev = queue.songs.shift() as Song;
        if (this.options.savePreviousSongs) queue.previousSongs.push(prev);
        else queue.previousSongs.push({ id: prev.id } as Song);
      }

      if (queue.songs.length === 0 && queue.autoplay) {
        try {
          this.debug(`[${queue.id}] Adding related song`);
          await queue._addRelatedSong(song);
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          this.debug(`[${queue.id}] Add related song error: ${errorMessage}`);
          if (e instanceof SonariaError) this.emit(Events.NoRelated, queue, e);
          else this.emit(Events.NoRelated, queue, new SonariaError("NoRelated"));
        }
      }

      if (queue.songs.length === 0) {
        this.debug(`[${queue.id}] Queue is empty, stopping...`);
        if (!queue.autoplay) this.emit(Events.Finish, queue);
        queue.remove();
        return;
      }

      if (song !== queue.songs[0]) {
        const playedSong = song.stream.playFromSource ? song : song.stream.song;
        if (playedSong?.stream.playFromSource) delete playedSong.stream.url;
      }
      await this.playSong(queue, true);
    } finally {
      queue._taskQueue.resolve();
    }
  }

  /**
   * Handle an error encountered while playing a song
   * @param queue - The queue
   * @param error - The error
   */
  async #handlePlayingError(queue: Queue, error: Error) {
    const song = queue.songs.shift() as Song;
    try {
      error.name = "PlayingError";
    } catch {
      // Emit the original error when it cannot be renamed
    }
    this.debug(`[${queue.id}] Error while playing: ${error.stack || error.message}`);
    this.emitError(error, queue, song);
    if (queue.songs.length > 0) {
      this.debug(`[${queue.id}] Playing next song: ${queue.songs[0]}`);
      await this.playSong(queue);
    } else {
      this.debug(`[${queue.id}] Queue is empty, stopping...`);
      await queue.stop();
    }
  }

  /**
   * Play a song on the voice connection with the queue properties
   * @param queue        - The guild queue to play
   * @param emitPlaySong - Whether or not to emit the {@link Events.PlaySong} event
   */
  async playSong(queue: Queue, emitPlaySong = true): Promise<void> {
    if (queue.stopped || queue.songs.length === 0) {
      await queue.stop();
      return;
    }
    try {
      const song = queue.songs[0];
      this.debug(`[${queue.id}] Getting stream from: ${song}`);
      await this.handler.attachStreamInfo(song);
      const willPlaySong = song.stream.playFromSource ? song : song.stream.song;
      const stream = willPlaySong?.stream;
      if (!willPlaySong || !stream?.playFromSource || !stream.url) {
        throw new SonariaError("NoStreamUrl", `${song}`);
      }
      this.debug(`[${queue.id}] Creating SonariaStream for: ${willPlaySong}`);
      const filterArgs = queue.filters.ffmpegArgs.af;
      const streamOptions: StreamOptions = {
        ffmpeg: {
          path: this.options.ffmpeg.path,
          args: {
            global: { ...queue.ffmpegArgs.global },
            input: { ...queue.ffmpegArgs.input },
            output: { ...queue.ffmpegArgs.output },
          },
        },
        volume: queue.voice.volume,
        filters: filterArgs === undefined ? undefined : String(filterArgs),
        seek: willPlaySong.duration ? queue._beginTime : undefined,
      };
      queue._beginTime = 0;
      const sonariaStream = new SonariaStream(stream.url, streamOptions);
      sonariaStream.on("debug", data => this.emit(Events.FfmpegDebug, `[${queue.id}] ${data}`));
      this.debug(`[${queue.id}] Started playing: ${willPlaySong}`);
      await queue.voice.play(sonariaStream);
      if (emitPlaySong) this.emit(Events.PlaySong, queue, song);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      await this.#handlePlayingError(queue, error);
    }
  }
}
