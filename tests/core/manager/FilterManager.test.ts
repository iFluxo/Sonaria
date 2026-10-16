import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { FilterResolvable, Queue } from "../../../src";
import { defaultFilters, FilterManager, SonariaError } from "../../../src";

const play = mock(() => undefined);

const createQueue = () =>
  ({
    sonaria: { filters: defaultFilters },
    currentTime: 0,
    _beginTime: 0,
    play,
  }) as unknown as Queue;

const fNames = Object.keys(defaultFilters);
const fValues = Object.values(defaultFilters);

beforeEach(() => {
  play.mockClear();
});

describe("FilterManager#add()", () => {
  test("adds a filter", () => {
    const filters = new FilterManager(createQueue());
    filters.add("3d");
    expect(filters.collection.size).toBe(1);
    expect(filters.has("3d")).toBe(true);
    expect(filters.collection.get("3d")).toEqual({ name: "3d", value: defaultFilters["3d"] });
    expect(filters.names).toEqual(["3d"]);
    expect(filters.ffmpegArgs).toEqual({ af: defaultFilters["3d"] });
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("does not override an existing filter by default", () => {
    const filters = new FilterManager(createQueue());
    filters.add("3d");
    const oldFilter = filters.collection.get("3d");
    play.mockClear();
    filters.add("3d");
    expect(filters.collection.get("3d")).toBe(oldFilter);
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("overrides an existing filter when requested", () => {
    const filters = new FilterManager(createQueue());
    filters.add("3d");
    const oldFilter = filters.collection.get("3d");
    filters.add("3d", true);
    expect(filters.collection.get("3d")).not.toBe(oldFilter);
    expect(filters.collection.get("3d")).toEqual(oldFilter);
  });

  test("adds multiple filters", () => {
    const filters = new FilterManager(createQueue());
    filters.add(fNames);
    expect(filters.collection.size).toBe(fNames.length);
    expect(filters.names).toEqual(fNames);
    expect(filters.ffmpegArgs).toEqual({ af: fValues.join(",") });
  });

  test("adds a custom filter", () => {
    const filters = new FilterManager(createQueue());
    const customFilter = { name: "custom", value: "customValue" };
    filters.add([...fNames, customFilter]);
    expect(filters.has("custom")).toBe(true);
    expect(filters.collection.get("custom")).toEqual(customFilter);
    expect(filters.ffmpegArgs).toEqual({ af: [...fValues, customFilter.value].join(",") });
  });

  test("throws for invalid filters", () => {
    const filters = new FilterManager(createQueue());
    expect(() => filters.add(["invalid"])).toThrow(SonariaError);
    expect(() => filters.add({ name: "invalid", value: 1 } as never)).toThrow(
      "Expected 'FilterResolvable' for 'filter'",
    );
    expect(play).toHaveBeenCalledTimes(0);
  });
});

describe("FilterManager#remove()", () => {
  test("removes a filter", () => {
    const filters = new FilterManager(createQueue());
    filters.add(fNames);
    play.mockClear();
    filters.remove("3d");
    expect(filters.collection.size).toBe(fNames.length - 1);
    expect(filters.has("3d")).toBe(false);
    expect(filters.names).toEqual(fNames.filter(f => f !== "3d"));
    expect(filters.ffmpegArgs).toEqual({ af: fValues.filter(f => f !== defaultFilters["3d"]).join(",") });
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("removes multiple filters", () => {
    const filters = new FilterManager(createQueue());
    filters.add(fNames);
    const removed = ["bassboost", "echo"];
    filters.remove(removed);
    const rest = fNames.filter(f => !removed.includes(f));
    expect(filters.names).toEqual(rest);
    expect(filters.ffmpegArgs).toEqual({ af: rest.map(f => defaultFilters[f]).join(",") });
  });
});

describe("FilterManager#set()", () => {
  test("sets filters", () => {
    const filters = new FilterManager(createQueue());
    const newFilters: FilterResolvable[] = [...fNames, { name: "custom", value: "customValue" }];
    filters.set(newFilters);
    expect(filters.collection.size).toBe(newFilters.length);
    expect(filters.names).toEqual(newFilters.map(f => (typeof f === "string" ? f : f.name)));
    expect(filters.ffmpegArgs).toEqual({
      af: newFilters.map(f => (typeof f === "string" ? defaultFilters[f] : f.value)).join(","),
    });
  });

  test("throws for invalid arguments", () => {
    const filters = new FilterManager(createQueue());
    expect(() => filters.set({ name: "invalid", value: 1 } as never)).toThrow("Array<FilterResolvable>");
    expect(() => filters.set(0 as never)).toThrow("Array<FilterResolvable>");
    expect(play).toHaveBeenCalledTimes(0);
  });

  test("clears filters", () => {
    const filters = new FilterManager(createQueue());
    filters.add(fNames);
    filters.clear();
    expect(filters.collection.size).toBe(0);
    expect(filters.names).toEqual([]);
    expect(filters.values).toEqual([]);
    expect(filters.ffmpegArgs).toEqual({});
  });
});

describe("FilterManager#add() invalid filter", () => {
  test("throws a SonariaError with InvalidType code", () => {
    const filters = new FilterManager(createQueue());
    try {
      filters.add("invalid");
    } catch (error) {
      expect(error).toBeInstanceOf(SonariaError);
      expect((error as SonariaError).errorCode).toBe("InvalidType");
      return;
    }
    throw new Error("Expected an error");
  });
});
