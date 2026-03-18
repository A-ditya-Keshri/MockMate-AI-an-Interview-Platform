// app/api/generate-feedback/route.js

import { NextResponse } from "next/server";
import { generateContent } from "@/utils/GeminiAIModal";
import { auth } from "@clerk/nextjs/server";

export async function POST(req) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, userAnswer } = await req.json();

    const feedbackPrompt = `Question: ${question}, User Answer: ${userAnswer}. Please give a rating out of 10 and feedback on improvement in JSON format { "rating": <number>, "feedback": <text> }`;

    const responseText = await generateContent(feedbackPrompt);
    const cleanedResponse = responseText.replace(/```json\n?|```/g, "").trim();
    const feedbackJson = JSON.parse(cleanedResponse);

    return NextResponse.json(feedbackJson, { status: 200 });
  } catch (error) {
    console.error("Error in generate-feedback API:", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
