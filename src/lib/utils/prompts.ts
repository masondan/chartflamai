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
   - The best chart type(s) to visualize (choose from: pie, doughnut, line, bar, horizontalBar, stackedBar)
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
      "compatibleChartTypes": ["line", "bar"],
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
- "suggestedChartType" is your primary recommendation (one of: pie, doughnut, line, bar, horizontalBar, stackedBar)
- "compatibleChartTypes" lists ALL chart types that would work with this data shape
  - pie/doughnut: only for single-series categorical data
  - line: for time-series or sequential data
  - bar/horizontalBar: for categorical comparisons
  - stackedBar: only when multiple series exist
- "explain" should be a journalist-friendly explanation (2-3 paragraphs) of what the data means and why it matters`;
}
