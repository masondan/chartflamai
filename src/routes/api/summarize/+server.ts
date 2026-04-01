import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSummaryPrompt } from '$lib/utils/prompts';
import { callGeminiText } from '$lib/utils/gemini';

export const POST: RequestHandler = async ({ request, platform }) => {
  const geminiKey = platform?.env?.GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GOOGLE_GENAI_API_KEY;

  if (!geminiKey) {
    return error(500, 'API key not configured');
  }

  let body: { extractedText: string };

  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid request body');
  }

  if (!body.extractedText?.trim()) {
    return error(400, 'No extracted text provided');
  }

  try {
    const prompt = getSummaryPrompt(body.extractedText);

    const summary = await callGeminiText({
      apiKey: geminiKey,
      systemPrompt: prompt,
      userMessage: 'Summarise this document.',
      maxOutputTokens: 1000
    });

    return json({ summary });
  } catch (err) {
    console.error('Summarize error:', err);
    return error(500, 'An unexpected error occurred');
  }
};
