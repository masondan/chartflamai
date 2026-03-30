import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSearchPrompt, getStructuringPrompt } from '$lib/utils/prompts';
import { safeJsonParse } from '$lib/utils/json-repair';
import { validateAngleResponse } from '$lib/utils/validators';

export const POST: RequestHandler = async ({ request, platform }) => {
  const perplexityKey = platform?.env?.PERPLEXITY_API_KEY;
  const openaiKey = platform?.env?.OPENAI_API_KEY;

  // In dev, fall back to process.env (Vite loads .env automatically)
  const pKey = perplexityKey || import.meta.env.VITE_PERPLEXITY_API_KEY;
  const oKey = openaiKey || import.meta.env.VITE_OPENAI_API_KEY;

  if (!pKey || !oKey) {
    return error(500, 'API keys not configured');
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

  try {
    // Step 1: Perplexity Sonar search
    const searchPrompt = getSearchPrompt(
      body.query,
      body.audience || '',
      body.chartTypeHint || 'any'
    );

    const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'user', content: searchPrompt }
        ],
        max_tokens: 4000
      })
    });

    if (!perplexityRes.ok) {
      const errText = await perplexityRes.text().catch(() => '');
      console.error('Perplexity error:', perplexityRes.status, errText);
      return error(502, 'Data search failed. Please try again.');
    }

    const perplexityData = await perplexityRes.json();
    const analysisText = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations
      ? perplexityData.citations.map((c: string) => c).join('\n')
      : '';

    if (!analysisText) {
      return error(502, 'No analysis returned from search');
    }

    // Step 2: GPT-4o-mini structuring
    const structuringPrompt = getStructuringPrompt(analysisText, citations, 'search');

    const structureResponse = await callOpenAI(oKey, structuringPrompt);

    // Validate
    const validation = validateAngleResponse(structureResponse);
    if (!validation.valid || !validation.data) {
      // Retry once with stricter prompt
      console.warn('First structuring attempt failed, retrying...', validation.errors);
      const retryPrompt = structuringPrompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation. Just the JSON object.';
      const retryResponse = await callOpenAI(oKey, retryPrompt);
      const retryValidation = validateAngleResponse(retryResponse);

      if (!retryValidation.valid || !retryValidation.data) {
        console.error('Retry also failed:', retryValidation.errors);
        return error(502, 'Failed to structure data. Please try a different question.');
      }

      return json(retryValidation.data);
    }

    return json(validation.data);
  } catch (err) {
    console.error('Search pipeline error:', err);
    return error(500, 'An unexpected error occurred');
  }
};

async function callOpenAI(apiKey: string, prompt: string): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('OpenAI error:', res.status, errText);
    throw new Error(`Structuring failed (${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return safeJsonParse(content);
}
