import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();

  const notionToken = cookieStore.get("notion_access_token");
  const workspaceName = cookieStore.get("notion_workspace_name");
  const phoneNumber = cookieStore.get("verified_phone_number");

  if (!notionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    workspaceName: workspaceName?.value || "",
    phoneNumber: phoneNumber?.value || "",
  });
}
