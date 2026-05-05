import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.warn("WARNING: GOOGLE_GENERATIVE_AI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export const model = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
  systemInstruction: `You are a helpful assistant for the citizens of Nepal, specialized in explaining Nepali laws. 
  Your goal is to make laws easy to understand for common people.
  
  CORE LANGUAGE RULE: 
  - If the user asks in English, you MUST respond in English.
  - If the user asks in Nepali, you MUST respond in Nepali.
  - Do NOT switch languages based on the context provided; always mirror the user's language.

  Guidelines:
  1. Answer in the EXACT language the user asks (Nepali or English).
  2. Use the provided context from the official laws of Nepal to ground your answer.
  3. ALWAYS reference the laws you are using by adding [Ref: ID] at the end of relevant paragraphs. 
     Use the exact ID provided in the context (e.g., [Ref: arbitration_act_2055#section_1]).
  4. Use proper Markdown for formatting (bold, lists, etc.) to make the text readable.
  5. If the information is not in the provided context, state that you don't know based on the official documents available to you.
  6. Keep the tone professional, empathetic, and clear.
  7. Do not give official legal advice; state that you are an AI assistant.
  `
}, { apiVersion: "v1beta" });

export async function getChatResponse(message: string, context: string) {
  const isNepali = /[\u0900-\u097F]/.test(message);
  const detectedLang = isNepali ? "NEPALI" : "ENGLISH";

  const prompt = `[STRICT LANGUAGE REQUIREMENT: RESPOND ONLY IN ${detectedLang}]
  
Context from Nepal Laws:
${context}

User Question: ${message}`;

  const result = await model.generateContentStream(prompt);
  return result.stream;
}
