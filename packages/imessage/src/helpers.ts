/**
 * Helper to convert Apple CoreData timestamp to JavaScript Date.
 * @param appleTimestamp The timestamp from the iMessage database.
 * @returns The corresponding JavaScript Date.
 */
export function convertAppleTime(appleTimestamp: number): Date {
  if (appleTimestamp === 0) {
    return new Date(0);
  }

  // Apple CoreData timestamps are in nanoseconds since 2001-01-01 UTC.
  // JavaScript Date uses milliseconds since 1970-01-01 UTC.
  //
  // See https://www.epochconverter.com/coredata for more details.
  const coreDataEpoch = Date.UTC(2001, 0, 1);
  const timestampMilliseconds = appleTimestamp / 1_000_000;

  return new Date(coreDataEpoch + timestampMilliseconds);
}
