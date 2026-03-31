import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSummaryPrompt } from '$lib/utils/prompts';

export const POST: RequestHandler = async ({ request, platform }) => {
  const openaiKey = platform?.env?.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;

  if (!openaiKey) {
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('OpenAI error:', res.status, errText);
      return error(502, 'Failed to generate summary');
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content || '';

    return json({ summary });
  } catch (err) {
    console.error('Summarize error:', err);
    return error(500, 'An unexpected error occurred');
  }
};
