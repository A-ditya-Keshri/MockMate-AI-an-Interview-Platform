// app/api/generate-interview/route.js

import { NextResponse } from "next/server";
import { generateContent } from "@/utils/GeminiAIModal";
import { db } from "@/utils/db";
import { MockInterview } from "@/utils/schema";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const emailAddress = user.emailAddresses?.[0]?.emailAddress;

    if (!emailAddress) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    const { jobPosition, jobDescription, jobExperience } = await req.json();

    const inputPrompt = `Job position: ${jobPosition}, Job Description: ${jobDescription}, Years of Experience: ${jobExperience}.
    Generate 5 interview questions and answers in JSON format. The response should be a JSON array where each element has "question" and "answer" fields.`;

    const responseText = await generateContent(inputPrompt);
    const cleanedResponse = responseText.replace(/```json\n?|```/g, "").trim();
    const mockResponse = JSON.parse(cleanedResponse);

    // Save to database
    const res = await db
      .insert(MockInterview)
      .values({
        mockId: uuidv4(),
        jsonMockResp: JSON.stringify(mockResponse),
        jobPosition: jobPosition,
        jobDesc: jobDescription,
        jobExperience: jobExperience,
        createdBy: emailAddress,
        createdAt: moment().format("DD-MM-YYYY"),
      })
      .returning({ mockId: MockInterview.mockId });

    return NextResponse.json({ mockId: res[0]?.mockId }, { status: 200 });
  } catch (error) {
    console.error("Error in generate-interview API:", error);
    return NextResponse.json(
      { error: "Failed to generate interview" },
      { status: 500 }
    );
  }
}