import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  // Clear all auth cookies
  const cookieStore = await cookies();

  cookieStore.delete("notion_access_token");
  cookieStore.delete("notion_workspace_id");
  cookieStore.delete("notion_workspace_name");
  cookieStore.delete("verified_phone_number");

  return NextResponse.json({ success: true });
}
