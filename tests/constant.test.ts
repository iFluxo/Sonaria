import { describe, expect, test } from "bun:test";
import pkg from "../package.json";
import { defaultFilters, defaultOptions, version } from "../src";

describe("constant", () => {
  test("version matches package.json", () => {
    expect(version).toBe(pkg.version);
  });

  test("defaultOptions only contains supported options", () => {
    expect(Object.keys(defaultOptions).sort()).toEqual([
      "emitAddListWhenCreatingQueue",
      "emitAddSongWhenCreatingQueue",
      "emitNewSongOnly",
      "joinNewVoiceChannel",
      "nsfw",
      "plugins",
      "savePreviousSongs",
    ]);
  });

  test("defaultFilters exposes string filter values", () => {
    expect(Object.keys(defaultFilters).length).toBeGreaterThan(0);
    for (const value of Object.values(defaultFilters)) expect(typeof value).toBe("string");
  });
});
