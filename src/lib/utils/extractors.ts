export async function extractPdfText(file: File): Promise<string> {
	const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
	GlobalWorkerOptions.workerSrc = new URL(
		'pdfjs-dist/build/pdf.worker.mjs',
		import.meta.url
	).href;

	const buffer = await file.arrayBuffer();
	const pdf = await getDocument({ data: buffer }).promise;
	const pages: string[] = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const text = content.items
			.filter((item) => 'str' in item)
			.map((item) => (item as { str: string }).str)
			.join(' ');
		pages.push(text);
	}

	return pages.join('\n\n');
}

type LineType = 'table' | 'heading' | 'list' | 'body';

function classifyLine(line: string): LineType {
	const trimmed = line.trim();
	if (!trimmed) return 'body';

	if (trimmed.includes('\t') || /\|/.test(trimmed) || /  {2,}/.test(trimmed)) {
		return 'table';
	}
	if (
		(trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) ||
		(trimmed.length < 80 && trimmed.endsWith(':'))
	) {
		return 'heading';
	}
	if (/^[•\-*]/.test(trimmed) || /^\d+\./.test(trimmed)) {
		return 'list';
	}
	return 'body';
}

export function truncateForLLM(fullText: string, maxChars: number = 100000): string {
	// For restrict-to-source mode, we need the full document to avoid gaps
	// that would trigger LLM to use training data. Only truncate if absolutely necessary.
	if (fullText.length <= maxChars) return fullText;

	// If we must truncate, do it more gently - keep order instead of reprioritizing
	// This preserves narrative flow and context
	const lines = fullText.split('\n');
	let output = '';

	for (const line of lines) {
		const addition = output ? '\n' + line : line;
		if (output.length + addition.length > maxChars) {
			break;
		}
		output += addition;
	}

	// Don't advertise truncation - it encourages Gemini to hallucinate
	return output;
}
