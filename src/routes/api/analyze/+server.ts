import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSourceSystemPrompt, getPasteSystemPrompt } from '$lib/utils/prompts';
import { callGemini } from '$lib/utils/gemini';
import { validateAngleResponse } from '$lib/utils/validators';

export const POST: RequestHandler = async ({ request, platform }) => {
  const geminiKey = platform?.env?.GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GOOGLE_GENAI_API_KEY;

  if (!geminiKey) {
    return error(500, 'API key not configured');
  }

  let body: {
    mode: 'source' | 'paste';
    extractedText?: string;
    fileUri?: string;
    query?: string;
    scope?: string;
    sourceType?: string;
    audience?: string;
    chartTypeHint?: string;
  };

  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid request body');
  }

  if (!body.extractedText?.trim() && !body.fileUri?.trim()) {
    return error(400, 'No data provided');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: { type: string; message?: string; data?: unknown }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
         // Only enable search if explicitly requested AND not restricting to source
         const useSearch = body.scope === 'search-widely' && body.sourceType !== 'paste';
         const isRestrictedMode = body.scope === 'restrict-to-source';

         send({ type: 'progress', message: useSearch ? 'Searching for related data...' : 'Analysing data...' });

        let systemPrompt: string;
        let userMessage: string;

        if (body.mode === 'paste') {
          systemPrompt = getPasteSystemPrompt();
          userMessage = body.query
            ? `JOURNALIST'S QUESTION: ${body.query}\n\n### PASTED DATA:\n${body.extractedText}`
            : `Suggest 3 data-driven story angles from this data.\n\n### PASTED DATA:\n${body.extractedText}`;
        } else {
           systemPrompt = getSourceSystemPrompt(
             body.scope || 'restrict-to-source',
             body.audience || ''
           );
           
           const isRestricted = (body.scope || 'restrict-to-source') === 'restrict-to-source';
           const restrictionNote = isRestricted
             ? '\n\nIMPORTANT: The document below is your ONLY source of data. Do not use any external information.'
             : '\n\nYou may supplement this with targeted web searches if needed.';
           
           // Use file URI if available (native PDF), otherwise use extracted text
           if (body.fileUri) {
             userMessage = body.query
               ? `JOURNALIST'S QUESTION: ${body.query}${restrictionNote}`
               : `Suggest 3 data-driven story angles from this source.${restrictionNote}`;
           } else {
             userMessage = body.query
               ? `JOURNALIST'S QUESTION: ${body.query}\n\n### SOURCE DOCUMENT:\n${body.extractedText}${restrictionNote}`
               : `Suggest 3 data-driven story angles from this source.\n\n### SOURCE DOCUMENT:\n${body.extractedText}${restrictionNote}`;
           }
         }

        const result = await callGemini({
          apiKey: geminiKey,
          systemPrompt,
          userMessage,
          fileUri: body.fileUri,
          useSearch: isRestrictedMode ? false : useSearch
        });

        send({ type: 'progress', message: 'Structuring data for charts...' });

        const validation = validateAngleResponse(result);
        if (validation.valid && validation.data) {
          send({ type: 'result', data: validation.data });
          controller.close();
          return;
        }

        // Retry
        send({ type: 'progress', message: 'Refining results...' });
        const retryResult = await callGemini({
          apiKey: geminiKey,
          systemPrompt: systemPrompt + '\n\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation. Just the JSON object.',
          userMessage,
          fileUri: body.fileUri,
          useSearch: isRestrictedMode ? false : useSearch
        });

        const retryValidation = validateAngleResponse(retryResult);
        if (retryValidation.valid && retryValidation.data) {
          send({ type: 'result', data: retryValidation.data });
        } else {
          send({ type: 'error', message: 'Failed to structure data. Please try again.' });
        }
        controller.close();
      } catch (err) {
        console.error('Analyze pipeline error:', err);
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
