import type { Sonaria } from "../Sonaria";
import type { Queue } from "../struct/Queue";
import type { Song } from "../struct/Song";
import type { SonariaClient, SonariaEvents, SonariaPlugin } from "../type";
import type { QueueManager } from "./manager/QueueManager";
import type { SonariaVoiceManager } from "./manager/SonariaVoiceManager";
import type { SonariaHandler } from "./SonariaHandler";
import type { Options } from "./SonariaOptions";

export abstract class SonariaBase {
  sonaria: Sonaria;
  constructor(sonaria: Sonaria) {
    /**
     * Sonaria
     */
    this.sonaria = sonaria;
  }
  /**
   * Emit the {@link Sonaria} event of this base
   * @param eventName - Event name
   * @param args      - arguments
   */
  emit(eventName: keyof SonariaEvents, ...args: any): boolean {
    return this.sonaria.emit(eventName, ...args);
  }
  /**
   * Emit error event
   * @param error   - error
   * @param queue   - The queue encountered the error
   * @param song    - The playing song when encountered the error
   */
  emitError(error: Error, queue: Queue, song?: Song) {
    this.sonaria.emitError(error, queue, song);
  }
  /**
   * Emit debug event
   * @param message - debug message
   */
  debug(message: string) {
    this.sonaria.debug(message);
  }
  /**
   * The queue manager
   */
  get queues(): QueueManager {
    return this.sonaria.queues;
  }
  /**
   * The voice manager
   */
  get voices(): SonariaVoiceManager {
    return this.sonaria.voices;
  }
  /**
   * Seyfert client
   */
  get client(): SonariaClient {
    return this.sonaria.client;
  }
  /**
   * Sonaria options
   */
  get options(): Options {
    return this.sonaria.options;
  }
  /**
   * Sonaria handler
   */
  get handler(): SonariaHandler {
    return this.sonaria.handler;
  }
  /**
   * Sonaria plugins
   */
  get plugins(): SonariaPlugin[] {
    return this.sonaria.plugins;
  }
}
