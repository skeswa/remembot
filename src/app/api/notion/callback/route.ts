import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin")}/api/notion/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Notion token exchange failed:", error);
      return new Response("Failed to authenticate with Notion", {
        status: 500,
      });
    }

    const tokenData = await tokenResponse.json();
    const cookiesInstance = await cookies();

    // Store the access token and workspace info in cookies or database
    cookiesInstance.set("notion_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    cookiesInstance.set("notion_workspace_id", tokenData.workspace_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    cookiesInstance.set("notion_workspace_name", tokenData.workspace_name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  } catch (error) {
    console.error("Error during Notion OAuth:", error);
    return new Response("Internal server error", { status: 500 });
  }

  // Redirect to the phone verification page
  return redirect("/dashboard/phone-verification");
}
