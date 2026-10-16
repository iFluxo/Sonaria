import { describe, expect, mock, test } from "bun:test";
import { TypedEmitter } from "../../src/struct/TypedEmitter";

type Events = {
  ping: (value: number) => void;
  pong: () => void;
};

describe("TypedEmitter", () => {
  test("emits to registered listeners", () => {
    const emitter = new TypedEmitter<Events>();
    const listener = mock(() => undefined);
    emitter.on("ping", listener);
    expect(emitter.emit("ping", 42)).toBe(true);
    expect(listener).toHaveBeenCalledWith(42);
  });

  test("returns false when no listener handled the event", () => {
    const emitter = new TypedEmitter<Events>();
    expect(emitter.emit("pong")).toBe(false);
  });

  test("removes a listener", () => {
    const emitter = new TypedEmitter<Events>();
    const listener = mock(() => undefined);
    emitter.on("ping", listener);
    emitter.off("ping", listener);
    expect(emitter.emit("ping", 1)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(emitter.listeners("ping")).toEqual([]);
  });

  test("supports once listeners", () => {
    const emitter = new TypedEmitter<Events>();
    const listener = mock(() => undefined);
    emitter.once("pong", listener);
    emitter.emit("pong");
    emitter.emit("pong");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("removes all listeners", () => {
    const emitter = new TypedEmitter<Events>();
    emitter.on(
      "ping",
      mock(() => undefined),
    );
    emitter.on(
      "pong",
      mock(() => undefined),
    );
    emitter.removeAllListeners("ping");
    expect(emitter.listeners("ping")).toEqual([]);
    expect(emitter.listeners("pong")).toHaveLength(1);
    emitter.removeAllListeners();
    expect(emitter.listeners("pong")).toEqual([]);
  });

  test("tracks the maximum listener count", () => {
    const emitter = new TypedEmitter<Events>();
    expect(emitter.getMaxListeners()).toBe(10);
    expect(emitter.setMaxListeners(1)).toBe(emitter);
    expect(emitter.getMaxListeners()).toBe(1);
    expect(() => emitter.setMaxListeners(-1)).toThrow(RangeError);
    expect(() => emitter.setMaxListeners(1.5)).toThrow(RangeError);
  });

  test("does not fail when emitting a removed event twice", () => {
    const emitter = new TypedEmitter<Events>();
    emitter.on(
      "ping",
      mock(() => undefined),
    );
    emitter.removeAllListeners("ping");
    emitter.removeAllListeners("ping");
    expect(emitter.emit("ping", 1)).toBe(false);
  });
});
