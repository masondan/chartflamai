export function getSearchPrompt(query: string, audience: string, chartTypeHint: string): string {
  return `You are a data journalist AI. A journalist is asking a question to find
relevant data and story angles.

JOURNALIST'S AUDIENCE: ${audience || 'General news audience'}
JOURNALIST'S QUESTION: ${query}
${chartTypeHint && chartTypeHint !== 'any' ? `PREFERRED CHART TYPE: ${chartTypeHint}` : ''}

Your task:
1. Search authoritative sources for relevant data (government stats,
   academic research, NGO reports, etc.)
2. Identify 3 distinct story angles from this data
3. For EACH angle, provide:
   - A compelling headline (max 70 characters, no quotes)
   - A brief summary (1–2 sentences explaining the angle)
   - The best chart type(s) to visualize (choose from: pie, bar, stackedBar, groupedBar, line)
   - Reasoning for why this chart type works well
   - Source citations (with URLs if possible)
   - One key finding (1 sentence)
   - A 2-3 paragraph explanation of what the data means and why it matters
4. Include the underlying numerical data for each angle

IMPORTANT:
- Include actual numerical data points (not just descriptions)
- Each angle should present a DIFFERENT perspective on the same data
- Avoid speculation; cite sources
- Keep summaries jargon-free for non-technical journalists

Return your analysis as structured text with clear sections for each angle.`;
}

export function getStructuringPrompt(analysisText: string, citations: string, sourceType: string): string {
  return `You are a data formatting assistant. Convert the following analysis into
a strict JSON structure for Chart.js visualization.

ANALYSIS:
${analysisText}

SOURCES/CITATIONS:
${citations}

Return a JSON object with this exact structure. Data is nested INSIDE each angle:
{
  "query": "original question",
  "sourceType": "${sourceType}",
  "sourceData": {
    "text": "Brief summary",
    "citations": ["url1", "url2"]
  },
  "angles": [
    {
      "id": "angle_1",
      "headline": "headline (max 70 chars)",
      "summary": "1-2 sentence summary",
      "suggestedChartType": "line",
      "compatibleChartTypes": ["line", "bar", "groupedBar"],
      "reasoning": "why this chart works",
      "sources": ["Source Name: url"],
      "keyFinding": "key insight",
      "explain": "2-3 paragraph explanation of what this data means",
      "data": {
        "labels": ["x-axis labels"],
        "datasets": [{
          "label": "Series name",
          "data": [10, 20, 30],
          "borderColor": "#5422b0",
          "backgroundColor": "rgba(84, 34, 176, 0.1)"
        }]
      }
    }
  ]
}

IMPORTANT:
- All data values must be numeric (no strings in data arrays)
- Labels must be strings
- Include exactly 3 angles
- Each angle MUST include its own "data" object
- "suggestedChartType" is your primary recommendation (one of: pie, bar, stackedBar, groupedBar, line)
- "compatibleChartTypes" lists ALL chart types that would work with this data shape
  - pie: only for single-series categorical data
  - bar: for categorical comparisons
  - stackedBar: for part-to-whole across categories (multiple series)
  - groupedBar: for side-by-side comparison of multiple series
  - line: for time-series or sequential data
- "explain" should be a journalist-friendly explanation (2-3 paragraphs) of what the data means and why it matters`;
}

export function getSourcePrompt(extractedText: string, query: string, scope: string, audience: string): string {
  return `You are a data journalist AI. A journalist has provided a document or URL
and wants to extract data and find story angles.

DOCUMENT/SOURCE CONTENT:
${extractedText}

JOURNALIST'S AUDIENCE: ${audience || 'General news audience'}
JOURNALIST'S REQUEST: ${query || 'Suggest three compelling story angles from this data'}
SEARCH SCOPE: ${scope} (values: "restrict-to-source" or "search-widely")

Your task:
1. Analyze the data in the provided content
2. If scope is "search-widely", supplement with external authoritative sources
3. Identify 3 distinct story angles from this data
4. For EACH angle, provide:
   - A compelling headline (max 70 characters, no quotes)
   - A brief summary (1–2 sentences)
   - The best chart type(s) to visualize (choose from: pie, bar, stackedBar, groupedBar, line)
   - Reasoning for the chart choice
   - Source citations
   - One key finding
   - A 2-3 paragraph explanation of what the data means
5. Include the actual numerical data for each angle

IMPORTANT:
- If restricting to source, use ONLY data from the provided content
- If searching widely, cite both document and external sources
- Highlight what the data reveals that might be surprising
- Include actual data points, not just descriptions

Return your analysis as structured text with clear sections for each angle.`;
}

export function getPastePrompt(csvData: string, query: string): string {
  return `You are a data journalist AI. A journalist has pasted CSV data
and wants to discover story angles.

CSV DATA:
${csvData}

${query ? `JOURNALIST'S QUESTION: ${query}` : 'Find the most compelling story angles in this data.'}

Your task:
1. Analyze the pasted data
2. Identify 3 distinct story angles (or answer the question if provided)
3. For EACH angle:
   - Compelling headline (max 70 characters, no quotes)
   - Brief summary (1–2 sentences)
   - Best chart type(s) (choose from: pie, bar, stackedBar, groupedBar, line)
   - Reasoning for chart choice
   - One key finding (derived from the data)
   - A 2-3 paragraph explanation of what the data means
4. Include the actual numerical data for each angle

IMPORTANT:
- Base insights on the PROVIDED data only (no external search)
- Avoid speculation
- Highlight what makes this data newsworthy
- Keep summaries simple and clear

Return your analysis as structured text with clear sections for each angle.`;
}
