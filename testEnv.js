import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

console.log("Gemini key is:", process.env.NEXT_PUBLIC_GEMINI_API_KEY);

console.log(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
