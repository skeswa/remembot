import { cookies } from "next/headers";
import twilio from "twilio";

export async function POST(request: Request) {
  // Check if user is authenticated with Notion
  const cookieStore = await cookies();
  const notionToken = cookieStore.get("notion_access_token");

  if (!notionToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return new Response("Phone number is required", { status: 400 });
    }

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );

    // Send verification SMS
    const message = await client.messages.create({
      body: "Welcome to Remembot! Your verification code is: 123456",
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    // Store the phone number in a cookie for later verification
    cookieStore.set("phone_verification_number", phoneNumber, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return new Response(JSON.stringify({ success: true, sid: message.sid }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending verification:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to send verification",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
