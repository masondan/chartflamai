import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  const geminiKey = platform?.env?.GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GOOGLE_GENAI_API_KEY;

  if (!geminiKey) {
    return error(500, 'API key not configured');
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return error(400, 'No file provided');
    }

    // Upload to Gemini Files API
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const uploadRes = await fetch(
      'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + geminiKey,
      {
        method: 'POST',
        body: uploadFormData
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      console.error('Gemini file upload error:', uploadRes.status, errText);
      throw new Error(`File upload failed (${uploadRes.status})`);
    }

    const result = await uploadRes.json();
    const fileUri = result.file?.uri;

    if (!fileUri) {
      throw new Error('No file URI in response');
    }

    return new Response(JSON.stringify({ fileUri, fileName: file.name }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Upload error:', err);
    const message = err instanceof Error ? err.message : 'Failed to upload file';
    return error(400, message);
  }
};
