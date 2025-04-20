import { cookies } from "next/headers";
import crypto from "crypto";
import twilio from "twilio";
import { NextResponse } from "next/server";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken) {
  throw new Error("Twilio environment variables are not configured correctly.");
}

// Initialize Twilio client (only if credentials exist)
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

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
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    // Generate a 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const messageBody = `Your verification code is: ${verificationCode}`;

    await client?.messages.create({
      body: messageBody,
      from: twilioPhoneNumber,
      to: phoneNumber, // User's phone number provided in the request body
    });

    cookieStore.set("phone_verification_code", verificationCode, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });
    cookieStore.set("phone_number", phoneNumber, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Twilio send verification error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send verification";
    // Avoid leaking sensitive error details in production
    return NextResponse.json(
      { error: "Could not send verification code via WhatsApp." },
      { status: 500 },
    );
  }
}
