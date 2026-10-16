import { describe, expect, test } from "bun:test";
import { defaultOptions, Options } from "../../src";

const expectedDefaults = {
  plugins: [],
  emitNewSongOnly: false,
  savePreviousSongs: true,
  customFilters: undefined,
  nsfw: false,
  emitAddSongWhenCreatingQueue: true,
  emitAddListWhenCreatingQueue: true,
  joinNewVoiceChannel: true,
  ffmpeg: {
    path: "ffmpeg",
    args: { global: {}, input: {}, output: {} },
  },
};

describe("Options", () => {
  test("creates default options", () => {
    expect({ ...new Options({}) }).toEqual(expectedDefaults);
  });

  test("applies custom options", () => {
    const options = new Options({
      plugins: [],
      nsfw: true,
      joinNewVoiceChannel: false,
      savePreviousSongs: false,
      ffmpeg: { path: "/usr/bin/ffmpeg", args: { output: { vn: true } } },
    });
    expect(options.nsfw).toBe(true);
    expect(options.joinNewVoiceChannel).toBe(false);
    expect(options.savePreviousSongs).toBe(false);
    expect(options.ffmpeg.path).toBe("/usr/bin/ffmpeg");
    expect(options.ffmpeg.args.output).toEqual({ vn: true });
  });

  test("throws for non-object options", () => {
    expect(() => new Options(Number.NaN as never)).toThrow("Expected 'object' for 'SonariaOptions'");
    expect(() => new Options([] as never)).toThrow("Expected 'object' for 'SonariaOptions'");
  });

  test("validates the type of every option", () => {
    const typeOfOption = (option: string) => {
      if (option === "plugins") return "Array<Plugin>";
      return typeof (defaultOptions as Record<string, unknown>)[option];
    };
    for (const option of Object.keys(defaultOptions)) {
      const options: Record<string, unknown> = { [option]: Number.NaN };
      expect(() => new Options(options as never)).toThrow(
        `Expected '${typeOfOption(option)}' for 'SonariaOptions.${option}'`,
      );
    }
  });

  test("throws for invalid keys", () => {
    expect(() => new Options({ invalidKey: "an invalid key" } as never)).toThrow(
      "'invalidKey' is not a valid 'SonariaOptions' option",
    );
  });

  test("throws for invalid ffmpeg path/args", () => {
    expect(() => new Options({ ffmpeg: { path: 1 as never } })).toThrow("SonariaOptions.ffmpeg.path");
    expect(() => new Options({ ffmpeg: { args: { global: [] as never } } })).toThrow("SonariaOptions.ffmpeg.global");
    expect(() => new Options({ ffmpeg: { args: { output: { af: {} as never } } } })).toThrow(
      "SonariaOptions.ffmpeg.output.af",
    );
  });
});
