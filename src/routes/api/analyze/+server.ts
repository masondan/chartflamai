import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSourcePrompt, getPastePrompt, getStructuringPrompt } from '$lib/utils/prompts';
import { safeJsonParse } from '$lib/utils/json-repair';
import { validateAngleResponse } from '$lib/utils/validators';

export const POST: RequestHandler = async ({ request, platform }) => {
  const perplexityKey = platform?.env?.PERPLEXITY_API_KEY;
  const openaiKey = platform?.env?.OPENAI_API_KEY;

  const pKey = perplexityKey || import.meta.env.VITE_PERPLEXITY_API_KEY;
  const oKey = openaiKey || import.meta.env.VITE_OPENAI_API_KEY;

  if (!oKey) {
    return error(500, 'API keys not configured');
  }

  let body: {
    mode: 'source' | 'paste';
    extractedText: string;
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

  if (!body.extractedText?.trim()) {
    return error(400, 'No data provided');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: { type: string; message?: string; data?: unknown }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const isSearchWidely = body.scope === 'search-widely';
        let analysisText = '';
        let citations = '';

        if (body.mode === 'source' && body.sourceType === 'url') {
          // URL source: use Perplexity to fetch and analyze
          if (!pKey) {
            send({ type: 'error', message: 'Perplexity API key required for URL analysis.' });
            controller.close();
            return;
          }
          send({ type: 'progress', message: 'Fetching and analyzing URL...' });

          const sourcePrompt = getSourcePrompt(
            body.extractedText,
            body.query || '',
            body.scope || 'restrict-to-source',
            body.audience || ''
          );

          const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${pKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [{ role: 'user', content: sourcePrompt }],
              max_tokens: 4000
            })
          });

          if (!perplexityRes.ok) {
            console.error('Perplexity error:', perplexityRes.status);
            send({ type: 'error', message: 'Failed to analyze URL. Please try again.' });
            controller.close();
            return;
          }

          const pData = await perplexityRes.json();
          analysisText = pData.choices?.[0]?.message?.content || '';
          citations = pData.citations ? pData.citations.join('\n') : '';
        } else if (isSearchWidely && pKey) {
          // Source with search-widely: use Perplexity to supplement
          send({ type: 'progress', message: 'Searching for related data...' });

          const sourcePrompt = getSourcePrompt(
            body.extractedText,
            body.query || '',
            'search-widely',
            body.audience || ''
          );

          const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${pKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [{ role: 'user', content: sourcePrompt }],
              max_tokens: 4000
            })
          });

          if (perplexityRes.ok) {
            const pData = await perplexityRes.json();
            analysisText = pData.choices?.[0]?.message?.content || '';
            citations = pData.citations ? pData.citations.join('\n') : '';
          } else {
            // Fall through to direct OpenAI analysis
            analysisText = '';
          }
        }

        // If no Perplexity analysis (paste mode, or restrict-to-source PDF), go direct to OpenAI
        if (!analysisText) {
          send({ type: 'progress', message: 'Analyzing data...' });

          let prompt: string;
          if (body.mode === 'paste') {
            prompt = getPastePrompt(body.extractedText, body.query || '');
          } else {
            prompt = getSourcePrompt(
              body.extractedText,
              body.query || '',
              body.scope || 'restrict-to-source',
              body.audience || ''
            );
          }

          // Use OpenAI directly for analysis + structuring in one step
          analysisText = prompt;
          // Actually, send the analysis prompt to OpenAI for analysis first, then structure
          const analysisRes = await callOpenAI(oKey, prompt, false);
          analysisText = typeof analysisRes === 'string' ? analysisRes : JSON.stringify(analysisRes);
        }

        send({ type: 'progress', message: 'Structuring data for charts...' });

        const sourceType = body.sourceType || (body.mode === 'paste' ? 'csv' : 'document');
        const structuringPrompt = getStructuringPrompt(analysisText, citations, sourceType);
        const structureResponse = await callOpenAI(oKey, structuringPrompt, true);

        const validation = validateAngleResponse(structureResponse);
        if (validation.valid && validation.data) {
          send({ type: 'result', data: validation.data });
          controller.close();
          return;
        }

        // Retry
        send({ type: 'progress', message: 'Refining results...' });
        const retryPrompt = structuringPrompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation.';
        const retryResponse = await callOpenAI(oKey, retryPrompt, true);
        const retryValidation = validateAngleResponse(retryResponse);

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

async function callOpenAI(apiKey: string, prompt: string, jsonMode: boolean): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.3
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('OpenAI error:', res.status, errText);
    throw new Error(`OpenAI call failed (${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (jsonMode) {
    return safeJsonParse(content);
  }
  return content;
}
