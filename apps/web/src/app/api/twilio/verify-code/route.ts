import { cookies } from "next/headers";

export async function POST(request: Request) {
  // Check if user is authenticated with Notion
  const cookieStore = await cookies();

  const notionToken = cookieStore.get("notion_access_token");
  const verificationNumber = cookieStore.get("phone_verification_number");

  if (!notionToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!verificationNumber) {
    return new Response("No verification in progress", { status: 400 });
  }

  try {
    const { phoneNumber, code } = await request.json();

    if (!phoneNumber || !code) {
      return new Response("Phone number and code are required", {
        status: 400,
      });
    }

    // Check if the phone number matches the one we sent the code to
    if (phoneNumber !== verificationNumber.value) {
      return new Response("Phone number mismatch", { status: 400 });
    }

    // In a real app, we would verify the code with Twilio
    // For this example, we'll accept any 6-digit code
    if (!/^\d{6}$/.test(code)) {
      return new Response("Invalid verification code", { status: 400 });
    }

    // Store the verified phone number in a persistent cookie
    cookieStore.set("verified_phone_number", phoneNumber, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    // Clear the verification cookie
    cookieStore.delete("phone_verification_number");

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to verify code",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
