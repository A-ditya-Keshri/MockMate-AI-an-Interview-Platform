// app/api/transcribe-audio/route.js

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert the file to a buffer then to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Clean up MIME type — Gemini doesn't accept codec params like "audio/webm;codecs=opus"
    let mimeType = audioFile.type || "audio/webm";
    // Strip codec parameters: "audio/webm;codecs=opus" → "audio/webm"
    mimeType = mimeType.split(";")[0].trim();

    console.log(
      `[transcribe-audio] File size: ${arrayBuffer.byteLength} bytes, MIME: ${mimeType}, Original MIME: ${audioFile.type}`
    );

    if (arrayBuffer.byteLength < 100) {
      return NextResponse.json(
        { error: "Audio file is too small — no audio captured" },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType: mimeType,
              },
            },
            {
              text: "Transcribe the speech in this audio accurately. Return ONLY the transcribed text, nothing else. If the audio is silent or has no speech, return an empty string. Do not add any explanation, notes, or formatting — just the raw transcribed words.",
            },
          ],
        },
      ],
    });

    const transcription = response.text?.trim() || "";

    console.log(`[transcribe-audio] Transcription result: "${transcription.substring(0, 100)}..."`);

    return NextResponse.json({ text: transcription }, { status: 200 });
  } catch (error) {
    console.error("Error in transcribe-audio API:", error?.message || error);
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return NextResponse.json(
      { error: "Failed to transcribe audio", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
