import { safeJsonParse } from './json-repair';

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiOptions {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  fileUri?: string;
  useSearch?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function callGemini(options: GeminiOptions): Promise<unknown> {
  const {
    apiKey,
    systemPrompt,
    userMessage,
    fileUri,
    useSearch = false,
    temperature = 0.3,
    maxOutputTokens = 4000
  } = options;

  // Build message parts: file (if provided) + text
  const parts: Record<string, unknown>[] = [];
  
  if (fileUri) {
    parts.push({
      fileData: {
        mimeType: 'application/pdf',
        fileUri
      }
    });
  }
  
  parts.push({ text: userMessage });

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    }
  };

  if (useSearch) {
    body.tools = [{ googleSearch: {} }];
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Gemini error:', res.status, errText);
    throw new Error(`Gemini call failed (${res.status})`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!content) {
    throw new Error('No content in Gemini response');
  }

  return safeJsonParse(content);
}

export async function callGeminiText(options: GeminiOptions): Promise<string> {
  const {
    apiKey,
    systemPrompt,
    userMessage,
    temperature = 0.3,
    maxOutputTokens = 1000
  } = options;

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature, maxOutputTokens },
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Gemini error:', res.status, errText);
    throw new Error(`Gemini call failed (${res.status})`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
