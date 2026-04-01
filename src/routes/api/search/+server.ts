import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSearchSystemPrompt } from '$lib/utils/prompts';
import { callGemini } from '$lib/utils/gemini';
import { validateAngleResponse } from '$lib/utils/validators';

export const POST: RequestHandler = async ({ request, platform }) => {
  const geminiKey = platform?.env?.GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GOOGLE_GENAI_API_KEY;

  if (!geminiKey) {
    return error(500, 'API key not configured');
  }

  let body: { query: string; audience?: string; chartTypeHint?: string };
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid request body');
  }

  if (!body.query?.trim()) {
    return error(400, 'Query is required');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: { type: string; message?: string; data?: unknown }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        send({ type: 'progress', message: 'Searching for data...' });

        const systemPrompt = getSearchSystemPrompt(
          body.audience || '',
          body.chartTypeHint || 'any'
        );

        const result = await callGemini({
          apiKey: geminiKey,
          systemPrompt,
          userMessage: body.query,
          useSearch: true
        });

        const validation = validateAngleResponse(result);
        if (validation.valid && validation.data) {
          send({ type: 'result', data: validation.data });
          controller.close();
          return;
        }

        // Retry once
        send({ type: 'progress', message: 'Refining results...' });
        console.warn('First attempt failed, retrying...', validation.errors);

        const retryResult = await callGemini({
          apiKey: geminiKey,
          systemPrompt: systemPrompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation. Just the JSON object.',
          userMessage: body.query,
          useSearch: true
        });

        const retryValidation = validateAngleResponse(retryResult);
        if (retryValidation.valid && retryValidation.data) {
          send({ type: 'result', data: retryValidation.data });
        } else {
          console.error('Retry also failed:', retryValidation.errors);
          send({ type: 'error', message: 'Failed to structure data. Please try a different question.' });
        }
        controller.close();
      } catch (err) {
        console.error('Search pipeline error:', err);
        send({ type: 'error', message: 'An unexpected error occurred.' });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
