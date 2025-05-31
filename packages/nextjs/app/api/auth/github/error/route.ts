import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Error logging in via Github",
      message: "Authentication failed. Please try again.",
    },
    { status: 400 },
  );
}
