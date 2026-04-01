#!/usr/bin/env node

/**
 * TEST: Gemini 3.1 Flash Lite (single-call) vs. Perplexity + OpenAI (dual-call)
 *
 * This test runs the same query through:
 * 1. CURRENT: Perplexity Sonar + OpenAI GPT-4o Mini (2 API calls)
 * 2. NEW: Gemini 3.1 Flash Lite with Google Search (1 API call)
 *
 * Metrics collected:
 * - Total latency
 * - JSON validity
 * - Output structure completeness
 * - Citations present/quality
 *
 * Run: node test-gemini-single-call.mjs
 */

import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const PERPLEXITY_KEY = process.env.VITE_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.VITE_GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

const TEST_QUERY = 'What is the current global fertility rate by region?';
const TEST_AUDIENCE = 'African journalists';

// ============================================================================
// CURRENT PIPELINE: Perplexity + OpenAI
// ============================================================================

async function testCurrentPipeline() {
  console.log('\n📊 CURRENT PIPELINE: Perplexity + OpenAI\n');
  const startTime = Date.now();

  try {
    // Step 1: Perplexity Sonar search
    console.log('⏳ Step 1: Perplexity Sonar (web search)...');
    const searchStartTime = Date.now();

    const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `You are a Senior Data Journalist AI. Find current data on global fertility rates by region. 
Provide facts, statistics, trends, and data that can be used to create charts for ${TEST_AUDIENCE}.
Include specific numbers, percentages, and comparisons between regions.`
          }
        ],
        max_tokens: 4000
      })
    });

    if (!perplexityRes.ok) {
      throw new Error(`Perplexity failed: ${perplexityRes.status}`);
    }

    const perplexityData = await perplexityRes.json();
    const analysisText = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];
    const searchElapsed = Date.now() - searchStartTime;

    console.log(`✅ Perplexity done in ${searchElapsed}ms`);
    console.log(`   - Response length: ${analysisText.length} chars`);
    console.log(`   - Citations found: ${citations.length}`);

    // Step 2: OpenAI structuring
    console.log('\n⏳ Step 2: OpenAI structuring to JSON...');
    const structStartTime = Date.now();

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Convert this analysis into strict JSON matching this structure:
{
  "angles": [
    {
      "id": "angle_1",
      "headline": "Question-based hook?",
      "summary": "40-word standfirst",
      "sources": ["Organisation: https://url"],
      "keyFinding": "Key insight",
      "data": {
        "labels": ["label1"],
        "datasets": [{"label": "Series", "data": [1, 2]}]
      }
    }
  ]
}

Analysis to convert:
${analysisText}

Citations:
${citations.join('\n')}`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.3
      })
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI failed: ${openaiRes.status}`);
    }

    const openaiData = await openaiRes.json();
    const jsonContent = openaiData.choices?.[0]?.message?.content || '';
    const structElapsed = Date.now() - structStartTime;

    console.log(`✅ OpenAI done in ${structElapsed}ms`);
    console.log(`   - JSON response length: ${jsonContent.length} chars`);

    // Parse and validate JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonContent);
      console.log(`   - JSON valid ✓`);
      console.log(`   - Angles parsed: ${parsedJson.angles?.length || 0}`);
    } catch (e) {
      console.log(`   - JSON INVALID ✗ (${e.message})`);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`\n✨ TOTAL TIME: ${totalElapsed}ms (${searchElapsed}ms + ${structElapsed}ms)`);
    console.log(`   - Per-call avg: ${totalElapsed / 2}ms`);

    return {
      method: 'current',
      totalTime: totalElapsed,
      step1Time: searchElapsed,
      step2Time: structElapsed,
      jsonValid: !!parsedJson,
      anglesCount: parsedJson?.angles?.length || 0,
      citationsCount: citations.length,
      rawResponse: jsonContent
    };
  } catch (err) {
    console.error('❌ Error:', err.message);
    return { method: 'current', error: err.message };
  }
}

// ============================================================================
// NEW PIPELINE: Gemini 3.1 Flash Lite (single call)
// ============================================================================

async function testGeminiPipeline() {
  console.log('\n\n🚀 NEW PIPELINE: Gemini 3.1 Flash Lite (single-call)\n');
  const startTime = Date.now();

  try {
    console.log('⏳ Gemini search + structure (single call)...');

    const geminiStartTime = Date.now();

    // Gemini API call with google_search_retrieval tool
    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are a Senior Data Journalist AI. Search the web for current global fertility rate data by region.
Return your findings as JSON matching this structure EXACTLY:

{
  "angles": [
    {
      "id": "angle_1",
      "headline": "Question-based hook?",
      "summary": "40-word standfirst about the data",
      "sources": ["Organisation Name: https://full-url-to-data"],
      "keyFinding": "The most important insight",
      "data": {
        "labels": ["Region/Category names"],
        "datasets": [{
          "label": "Series name",
          "data": [numeric values]
        }]
      }
    },
    {
      "id": "angle_2",
      "headline": "Different angle question?",
      "summary": "40-word standfirst",
      "sources": ["Organisation Name: https://url"],
      "keyFinding": "Different key insight",
      "data": {
        "labels": ["labels"],
        "datasets": [{"label": "Series", "data": [numbers]}]
      }
    },
    {
      "id": "angle_3",
      "headline": "Third angle question?",
      "summary": "40-word standfirst",
      "sources": ["Organisation Name: https://url"],
      "keyFinding": "Third insight",
      "data": {
        "labels": ["labels"],
        "datasets": [{"label": "Series", "data": [numbers]}]
      }
    }
  ]
}

Audience: ${TEST_AUDIENCE}
Query: ${TEST_QUERY}

IMPORTANT: Return ONLY valid JSON. No markdown code fences, no explanation. Just the JSON object.`
              }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 4000
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini failed: ${geminiRes.status} - ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const geminiElapsed = Date.now() - geminiStartTime;

    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`✅ Gemini done in ${geminiElapsed}ms`);
    console.log(`   - Response length: ${textContent.length} chars`);

    // Parse and validate JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(textContent);
      console.log(`   - JSON valid ✓`);
      console.log(`   - Angles parsed: ${parsedJson.angles?.length || 0}`);
      
      // Count citations
      let citationCount = 0;
      parsedJson.angles?.forEach((angle) => {
        if (angle.sources && Array.isArray(angle.sources)) {
          citationCount += angle.sources.length;
        }
      });
      console.log(`   - Total citations: ${citationCount}`);
    } catch (e) {
      console.log(`   - JSON INVALID ✗ (${e.message})`);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`\n✨ TOTAL TIME: ${totalElapsed}ms (single call)`);

    return {
      method: 'gemini',
      totalTime: totalElapsed,
      singleCallTime: geminiElapsed,
      jsonValid: !!parsedJson,
      anglesCount: parsedJson?.angles?.length || 0,
      citationsCount: parsedJson?.angles?.reduce((sum, a) => sum + (a.sources?.length || 0), 0) || 0,
      rawResponse: textContent
    };
  } catch (err) {
    console.error('❌ Error:', err.message);
    return { method: 'gemini', error: err.message };
  }
}

// ============================================================================
// COMPARISON & SUMMARY
// ============================================================================

function summarizeResults(current, gemini) {
  console.log('\n\n📈 COMPARISON SUMMARY\n');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│               Metric    │  Current  │  Gemini  │');
  console.log('├─────────────────────────────────────────────────┤');

  if (!current.error && !gemini.error) {
    const speedup = ((current.totalTime - gemini.totalTime) / current.totalTime * 100).toFixed(1);
    console.log(`│ Total Latency (ms)      │ ${String(current.totalTime).padEnd(8)} │ ${String(gemini.totalTime).padEnd(7)} │`);
    console.log(`│ API Calls               │    2     │    1     │`);
    console.log(`│ Speed gain              │    -     │  ${speedup}%  │`);
    console.log(`│ JSON Valid              │  ${current.jsonValid ? '✓' : '✗'}    │  ${gemini.jsonValid ? '✓' : '✗'}    │`);
    console.log(`│ Angles Parsed           │    ${current.anglesCount}    │    ${gemini.anglesCount}    │`);
    console.log(`│ Total Citations         │    ${current.citationsCount}    │    ${gemini.citationsCount}    │`);
  } else {
    console.log('│ Status                  │  ERROR   │  ERROR   │');
    if (current.error) console.log(`│ Current Error: ${current.error.substring(0, 30)}`);
    if (gemini.error) console.log(`│ Gemini Error: ${gemini.error.substring(0, 30)}`);
  }

  console.log('└─────────────────────────────────────────────────┘');

  if (!current.error && !gemini.error) {
    const isFaster = gemini.totalTime < current.totalTime;
    const speed = isFaster ? 'FASTER' : 'SLOWER';
    const diff = Math.abs(gemini.totalTime - current.totalTime);
    console.log(`\n🎯 Recommendation: Gemini is ~${diff}ms ${speed}`);
    
    if (gemini.jsonValid && gemini.anglesCount > 0) {
      console.log(`✅ Gemini output is structurally valid and complete`);
      console.log(`\nNEXT STEP: Review sample outputs manually for editorial quality\n`);
    } else {
      console.log(`⚠️  Gemini output needs review - JSON validity or structure issues`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔═════════════════════════════════════════════════╗');
  console.log('║  ChartFlamAI: Gemini vs. Perplexity + OpenAI   ║');
  console.log('║  Single-Call Speed & Quality Test              ║');
  console.log('╚═════════════════════════════════════════════════╝');

  // Validate keys
  if (!PERPLEXITY_KEY) {
    console.error('❌ Missing PERPLEXITY_API_KEY in .env');
    process.exit(1);
  }
  if (!OPENAI_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in .env');
    process.exit(1);
  }
  if (!GEMINI_KEY) {
    console.error('❌ Missing GOOGLE_GENAI_API_KEY in .env');
    process.exit(1);
  }

  console.log(`\n📌 Test Query: "${TEST_QUERY}"`);
  console.log(`📌 Test Audience: "${TEST_AUDIENCE}"\n`);

  const currentResults = await testCurrentPipeline();
  const geminiResults = await testGeminiPipeline();

  summarizeResults(currentResults, geminiResults);

  // Save detailed results to file
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    query: TEST_QUERY,
    audience: TEST_AUDIENCE,
    current: currentResults,
    gemini: geminiResults
  };

  fs.writeFileSync(
    'test-results-gemini.json',
    JSON.stringify(results, null, 2)
  );
  console.log('💾 Full results saved to test-results-gemini.json');
}

main().catch(console.error);
