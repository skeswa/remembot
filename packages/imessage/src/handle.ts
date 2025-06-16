/**
 * @fileoverview Type definitions for @remembot/imessage handles.
 * Used throughout the @remembot/imessage automation and querying utilities.
 */

import { AppleScriptExecutor } from "./applescript";

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
 * Populates the name property for each handle by querying the Contacts app.
 * 
 * This function takes an array of handles and returns a new array where each handle
 * has its name property populated based on matching phone numbers or email addresses
 * in the Contacts app. If no matching contact is found, the name will be null.
 * 
 * @param executor The AppleScript executor to use for querying contacts
 * @param handles Array of handles to look up names for
 * @returns A promise that resolves with an array of handles with populated names
 */
export async function applyNamesToHandles(
  executor: AppleScriptExecutor,
  handles: Handle[]
): Promise<Handle[]> {
  if (!handles || handles.length < 1) {
    return [];
  }

  const script = getNamesForHandlesAppleScript(handles.map((h) => h.id));

  try {
    const results = await executor.execute(script);
    if (!Array.isArray(results)) {
      throw new Error("Expected array of names from AppleScript");
    }

    return handles.map((handle, index) => ({
      id: handle.id,
      name: results[index] as string | null,
    }));
  } catch (error) {
    return handles.map((handle) => ({ ...handle, name: null }));
  }
}

/**
 * Generates an efficient AppleScript to get contact names for multiple handles.
 * The script builds a list of handles and uses a single loop to find contacts
 * by either phone or email, which is more performant and avoids syntax errors.
 *
 * @param handles An array of handle IDs (phone numbers or emails) to look up.
 * @returns The generated AppleScript string.
 */
function getNamesForHandlesAppleScript(handles: string[]): string {
  const handlesListString = handles
    .map((h) => `\t"${h.replace(/"/g, '\\"')}"`)
    .join(", ¬\n");

  // This AppleScript efficiently looks up contact names for a list of
  // identifiers (phone numbers or emails).
  //
  // It works by:
  // 1. Creating a list of identifiers to search for
  // 2. Initializing an empty list to store found names
  // 3. For each identifier:
  //    - Searches Contacts app for people with matching phone or email.
  //    - If found, adds their name to the results.
  //    - If not found, adds missing value (null) to results.
  // 4. Returns the complete list of names in the same order as input identifiers.
  return `
set identifiersToFind to {¬
${handlesListString}}

set foundNames to {}

tell application "Contacts"
	repeat with anIdentifier in identifiersToFind
		set thePeople to every person whose (value of phones contains anIdentifier) or (value of emails contains anIdentifier)
		
		if (count of thePeople) > 0 then
			set end of foundNames to name of item 1 of thePeople
		else
			set end of foundNames to missing value
		end if
	end repeat
end tell

return foundNames
`;
}
