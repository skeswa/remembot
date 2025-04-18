import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Parse the incoming Twilio webhook
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    const { From: from, Body: messageBody } = body;

    if (!from || !messageBody) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Find the user by phone number
    // In a real app, you would query your database
    const cookieStore = await cookies();

    const verifiedPhone = cookieStore.get("verified_phone_number")?.value;
    const notionToken = cookieStore.get("notion_access_token")?.value;

    if (!verifiedPhone || !notionToken) {
      console.log("No matching user found for phone:", from);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create a todo in Notion
    // In a real app, you would use the Notion API to create a todo
    console.log(`Creating todo in Notion: ${messageBody}`);

    // Send a confirmation SMS via Twilio
    // In a real app, you would use the Twilio API to send a confirmation
    console.log(`Sending confirmation to ${from}`);

    // Return TwiML response
    const twiml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>✅ Todo added to Notion: "${messageBody}"</Message>
      </Response>
    `;

    return new Response(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
