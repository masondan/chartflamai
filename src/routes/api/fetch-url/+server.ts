import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  let body: { url: string };

  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid request body');
  }

  if (!body.url?.trim()) {
    return error(400, 'No URL provided');
  }

  try {
    const url = new URL(body.url);
    
    // Fetch the URL
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChartFlamAI/1.0)'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (${res.status})`);
    }

    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return new Response(
        JSON.stringify({ text: JSON.stringify(json, null, 2) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await res.text();
    const text = extractTextFromHtml(html);

    if (!text.trim()) {
      throw new Error('No readable content found at URL');
    }

    return new Response(JSON.stringify({ text }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Fetch URL error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch URL';
    return error(400, message);
  }
};

function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}
