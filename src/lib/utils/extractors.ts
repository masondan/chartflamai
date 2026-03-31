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

export function truncateForLLM(fullText: string, maxChars: number = 24000): string {
	if (fullText.length <= maxChars) return fullText;

	const lines = fullText.split('\n');

	const tables: string[] = [];
	const headings: string[] = [];
	const lists: string[] = [];
	const body: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const type = classifyLine(lines[i]);
		switch (type) {
			case 'table':
				tables.push(lines[i]);
				break;
			case 'heading': {
				headings.push(lines[i]);
				const next = lines[i + 1];
				if (next !== undefined && classifyLine(next) === 'body' && next.trim()) {
					headings.push(next);
					i++;
				}
				break;
			}
			case 'list':
				lists.push(lines[i]);
				break;
			default:
				body.push(lines[i]);
				break;
		}
	}

	const prioritised = [...tables, ...headings, ...lists, ...body];
	let output = '';
	let truncated = false;

	for (const line of prioritised) {
		const addition = output ? '\n' + line : line;
		if (output.length + addition.length > maxChars) {
			truncated = true;
			break;
		}
		output += addition;
	}

	if (truncated) {
		output += '\n[Document truncated. Showing prioritised content.]';
	}

	return output;
}
