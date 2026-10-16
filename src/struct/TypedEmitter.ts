type EventMap = Record<string, (...args: any[]) => any>;
type Listener = (...args: any[]) => void;

/**
 * A minimal, dependency-free, type-safe event emitter.
 *
 * It intentionally implements only the surface Sonaria needs (`on`, `once`,
 * `off`, `emit`, `removeAllListeners` and `setMaxListeners`) so the library can
 * stay dependency-free without losing type safety.
 */
export class TypedEmitter<Events extends EventMap> {
  readonly #listeners = new Map<keyof Events, Set<Listener>>();
  #maxListeners = 10;

  /**
   * By default a `MaxListenersExceededWarning` is not emitted: the emitter only
   * stores the configured limit so subclasses can query it.
   */
  setMaxListeners(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("setMaxListeners() expects a non-negative integer");
    }
    this.#maxListeners = count;
    return this;
  }

  /**
   * The current maximum listener count.
   */
  getMaxListeners(): number {
    return this.#maxListeners;
  }

  /**
   * Register a listener for the given event.
   */
  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    let listeners = this.#listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(event, listeners);
    }
    listeners.add(listener as Listener);
    return this;
  }

  /**
   * Register a listener that is invoked at most once.
   */
  once<K extends keyof Events>(event: K, listener: Events[K]): this {
    const wrapper = (...args: Parameters<Events[K]>): void => {
      this.off(event, wrapper as unknown as Events[K]);
      (listener as Listener)(...args);
    };
    return this.on(event, wrapper as unknown as Events[K]);
  }

  /**
   * Remove a previously registered listener.
   */
  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    const listeners = this.#listeners.get(event);
    if (!listeners) return this;
    listeners.delete(listener as Listener);
    if (listeners.size === 0) this.#listeners.delete(event);
    return this;
  }

  /**
   * Remove all listeners, optionally scoped to a single event.
   */
  removeAllListeners(event?: keyof Events): this {
    if (event === undefined) this.#listeners.clear();
    else this.#listeners.delete(event);
    return this;
  }

  /**
   * The listeners currently registered for an event.
   */
  listeners<K extends keyof Events>(event: K): Events[K][] {
    return [...(this.#listeners.get(event) ?? [])] as Events[K][];
  }

  /**
   * Emit an event. Returns `true` when at least one listener handled it.
   */
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    const listeners = this.#listeners.get(event);
    if (!listeners?.size) return false;
    for (const listener of [...listeners]) listener(...args);
    return true;
  }
}

export default TypedEmitter;
