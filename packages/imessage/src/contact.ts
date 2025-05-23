/**
 * @fileoverview Utilities for resolving iMessage handles and contact names
 * using AppleScript and Contacts.
 *
 * Provides functions to look up handles by name and names by handle.
 */

import { executeAppleScript } from "@/applescript";
import type { Handle } from "@/handle";

/**
 * Gets a handle for a given name by querying Contacts.
 * @param name The full name of the desired contact.
 * @returns A promise that resolves with the handle or null if not found.
 */
export async function handleForName(name: string): Promise<Handle | null> {
  if (!name) throw new Error("Name must be provided.");
  const script = getHandleForNameAppleScript(name.replace(/"/g, '\\"'));
  try {
    const result = await executeAppleScript(script);
    return typeof result === "string" ? result : null;
  } catch (error) {
    console.error(`Error getting handle for name "${name}":`, error);
    return null;
  }
}

/**
 * Gets the name associated with a given handle by querying Contacts.
 * @param handle The handle of a contact.
 * @returns A promise that resolves with the name or null if not found.
 */
export async function nameForHandle(handle: Handle): Promise<string | null> {
  if (!handle) throw new Error("Handle must be provided.");
  const script = getNameForHandleAppleScript(handle.replace(/"/g, '\\"'));
  try {
    const result = await executeAppleScript(script);
    return typeof result === "string" ? result : null;
  } catch (error) {
    console.error(`Error getting name for handle "${handle}":`, error);
    return null;
  }
}

// --- Non-exported helpers ---

/**
 * Generates AppleScript to get a handle for a given name.
 * @param name The contact name.
 * @returns The AppleScript string.
 */
function getHandleForNameAppleScript(name: string): string {
  return `
tell application "Contacts"
  set thePerson to first person whose name is "${name}"
  if thePerson exists then
    -- This attempts to get an iMessage-compatible handle (email or phone).
    -- It might need refinement to pick the correct one if multiple exist.
    set imessageHandles to {}
    repeat with aValue in (value of phones of thePerson)
      if aValue is not missing value then
        set end of imessageHandles to aValue as string
      end if
    end repeat
    repeat with anEmail in (value of emails of thePerson)
      if anEmail is not missing value then
        set end of imessageHandles to anEmail as string
      end if
    end repeat
    
    -- Prioritize iMessage handles if possible by checking Messages app state
    -- This part is more complex and might require querying Messages app directly
    -- For simplicity, returning the first found handle here.
    if (count of imessageHandles) > 0 then
      return item 1 of imessageHandles
    else
      return missing value -- Or throw an error
    end if
  else
    return missing value -- Or throw an error
  end if
end tell
`;
}

/**
 * Generates AppleScript to get a name for a given handle.
 * @param handle The contact handle.
 * @returns The AppleScript string.
 */
function getNameForHandleAppleScript(handle: Handle): string {
  return `
tell application "Contacts"
  -- Search by phone number
  set thePeople to every person whose (phones contains a phone whose value is "${handle}")
  if (count of thePeople) is 0 then
    -- Search by email if not found by phone
    set thePeople to every person whose (emails contains an email whose value is "${handle}")
  end if
  
  if (count of thePeople) > 0 then
    return name of item 1 of thePeople
  else
    -- If not in contacts, try to get a name from Messages if it's a group chat or known participant
    -- This part is more complex; for now, returning the handle itself or missing value.
    return missing value -- Or return the handle itself if no name found
  end if
end tell
`;
}
