import { describe, expect, test } from "bun:test";
import { convertAppleTime } from "./helpers";

describe("Helpers Module", () => {
  describe("convertAppleTime", () => {
    test("should convert zero timestamp to epoch", () => {
      const result = convertAppleTime(0);
      expect(result).toEqual(new Date(0));
    });

    test("should convert Apple timestamp to correct JavaScript Date", () => {
      // This timestamp represents 2024-01-01 00:00:00 UTC.
      const appleTimestamp = 725817600000000000;
      const result = convertAppleTime(appleTimestamp);
      expect(result).toEqual(new Date(Date.UTC(2024, 0, 1, 16, 0, 0, 0)));
    });
  });
});
