/**
 * @fileoverview Type definitions for @remembot/imessage handles.
 * Used throughout the @remembot/imessage automation and querying utilities.
 */

import { executeAppleScript } from "@/applescript";

/**
 * Represents a handle (phone, email, or group chat ID) in iMessage.
 */
export interface Handle {
  /** The unique ID of the handle (e.g., phone number or email). */
  readonly id: string;
  /** The name associated with the handle. */
  readonly name: string | null;
}

/**
 * Gets names for an array of handles by querying Contacts and returns handles with populated names.
 * @param handles Array of handles to look up names for.
 * @returns A promise that resolves with an array of handles with their name properties populated.
 *          Names will be null if not found.
 */
export async function applyNamesToHandles(
  handles: Handle[],
): Promise<Handle[]> {
  if (!handles?.length) return [];

  const script = getNamesForHandlesAppleScript(handles.map((h) => h.id));
  try {
    const results = await executeAppleScript(script);
    if (!Array.isArray(results)) {
      throw new Error("Expected array of names from AppleScript");
    }

    return handles.map((handle, index) => ({
      id: handle.id,
      name: results[index] as string | null,
    }));
  } catch (error) {
    console.error("Failed to get names for handles:", error);
    return handles.map((handle) => ({ ...handle, name: null }));
  }
}

/**
 * Generates AppleScript to get names for multiple handles in a single query.
 * @param handles Array of handle IDs to look up.
 * @returns The AppleScript string.
 */
function getNamesForHandlesAppleScript(handles: string[]): string {
  const escapedHandles = handles.map((h) => h.replace(/"/g, '\\"'));
  return `
tell application "Contacts"
  set results to {}
  ${escapedHandles
    .map(
      (handle) => `
  -- Search by phone number
  set thePeople to every person whose (phones contains a phone whose value is "${handle}")
  if (count of thePeople) is 0 then
    -- Search by email if not found by phone
    set thePeople to every person whose (emails contains an email whose value is "${handle}")
  end if
  
  if (count of thePeople) > 0 then
    set end of results to name of item 1 of thePeople
  else
    set end of results to missing value
  end if`,
    )
    .join("\n")}
  
  return results
end tell
`;
}
