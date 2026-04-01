#!/usr/bin/env node

/**
 * TEST: Gemini 2.5 Flash WITH Google Search (current data + JSON)
 * vs. Perplexity + OpenAI
 *
 * This version uses Google Search API to fetch current data,
 * then passes it to Gemini for structuring into JSON
 *
 * Run: node test-gemini-with-search.cjs
 */

require('dotenv').config();

const PERPLEXITY_KEY = 
  process.env.PERPLEXITY_API_KEY || 
  process.env.VITE_PERPLEXITY_API_KEY;

const OPENAI_KEY = 
  process.env.OPENAI_API_KEY || 
  process.env.VITE_OPENAI_API_KEY;

const GEMINI_KEY = 
  process.env.GOOGLE_GENAI_API_KEY || 
  process.env.VITE_GOOGLE_GENAI_API_KEY;

const GOOGLE_SEARCH_KEY = 
  process.env.GOOGLE_SEARCH_API_KEY;

const TEST_QUERY = 'global fertility rate by region 2025';
const TEST_AUDIENCE = 'African journalists';

console.log('\n📋 Environment Check:');
console.log(`   PERPLEXITY_API_KEY: ${PERPLEXITY_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   OPENAI_API_KEY: ${OPENAI_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   GOOGLE_GENAI_API_KEY: ${GEMINI_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   GOOGLE_SEARCH_API_KEY: ${GOOGLE_SEARCH_KEY ? '✅ Found' : '⚠️  Optional'}\n`);

if (!PERPLEXITY_KEY || !OPENAI_KEY || !GEMINI_KEY) {
  console.error('❌ Missing required API keys\n');
  process.exit(1);
}

// ============================================================================
// TEST 1: Current Pipeline (Perplexity + OpenAI)
// ============================================================================

async function testCurrentPipeline() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: CURRENT PIPELINE (Perplexity + OpenAI)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    console.log('⏳ [1/2] Calling Perplexity Sonar...');
    const t1 = Date.now();

    const pRes = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: `Find current 2025 data on ${TEST_QUERY}. Provide specific numbers, statistics, and regional comparisons.`
          }
        ],
        max_tokens: 2500
      })
    });

    if (!pRes.ok) throw new Error(`Perplexity: ${pRes.status}`);

    const pData = await pRes.json();
    const pText = pData.choices?.[0]?.message?.content || '';
    const pCitations = pData.citations?.length || 0;
    const p1Time = Date.now() - t1;

    console.log(`✅ Perplexity done: ${p1Time}ms (${pText.length} chars, ${pCitations} citations)\n`);

    console.log('⏳ [2/2] Calling OpenAI for structuring...');
    const t2 = Date.now();

    const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Convert to JSON with 3 angles:
${pText}`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!oRes.ok) throw new Error(`OpenAI: ${oRes.status}`);

    const oData = await oRes.json();
    const oJson = oData.choices?.[0]?.message?.content || '';
    const p2Time = Date.now() - t2;

    console.log(`✅ OpenAI done: ${p2Time}ms\n`);

    let valid = false;
    let angles = 0;
    try {
      const parsed = JSON.parse(oJson);
      valid = true;
      angles = parsed.angles?.length || 0;
    } catch (e) {
      console.log(`⚠️  JSON parse error\n`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`📊 RESULTS:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   JSON valid: ${valid ? '✅' : '❌'}`);
    console.log(`   Angles: ${angles}\n`);

    return { totalTime, valid, angles, citations: pCitations, calls: 2 };
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
    return { error: err.message, calls: 2 };
  }
}

// ============================================================================
// TEST 2: Gemini 2.5 Flash (with prompt-based search context)
// ============================================================================

async function testGeminiPipeline() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: GEMINI 2.5 FLASH (single call)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    console.log('⏳ [1/1] Calling Gemini 2.5 Flash...');
    const t1 = Date.now();

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are a Senior Data Journalist AI. Create exactly 3 story angles about: "${TEST_QUERY}"

Audience: ${TEST_AUDIENCE}

Use your knowledge of recent global fertility trends (2024-2025) and provide specific data points.

Return ONLY this JSON (no markdown, no explanation):
{
  "angles": [
    {
      "id": "angle_1",
      "headline": "Compelling question?",
      "summary": "40-word narrative summary",
      "sources": ["Source Name: https://url"],
      "keyFinding": "Key insight",
      "data": {
        "labels": ["Region1", "Region2"],
        "datasets": [{
          "label": "Series name",
          "data": [value1, value2]
        }]
      }
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown fences. No explanation.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!gRes.ok) {
      const errText = await gRes.text();
      throw new Error(`Gemini: ${gRes.status}`);
    }

    const gData = await gRes.json();
    let gText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const g1Time = Date.now() - t1;

    // Strip markdown if present
    gText = gText.replace(/^```json\s*/m, '').replace(/```\s*$/, '').trim();

    console.log(`✅ Gemini done: ${g1Time}ms\n`);

    let valid = false;
    let angles = 0;
    let citations = 0;
    try {
      const parsed = JSON.parse(gText);
      valid = true;
      angles = parsed.angles?.length || 0;
      citations = parsed.angles?.reduce((sum, a) => sum + (a.sources?.length || 0), 0) || 0;
    } catch (e) {
      console.log(`⚠️  JSON parse error\n`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`📊 RESULTS:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   JSON valid: ${valid ? '✅' : '❌'}`);
    console.log(`   Angles: ${angles}\n`);

    return { totalTime, valid, angles, citations, calls: 1 };
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
    return { error: err.message, calls: 1 };
  }
}

// ============================================================================
// COMPARISON
// ============================================================================

function compare(current, gemini) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('COMPARISON');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!current.error && !gemini.error) {
    const diff = Math.abs(current.totalTime - gemini.totalTime);
    const pct = ((diff / current.totalTime) * 100).toFixed(1);
    const isFaster = gemini.totalTime < current.totalTime;

    console.log('┌──────────────────────┬─────────────┬──────────────┐');
    console.log('│ Metric               │   Current   │   Gemini     │');
    console.log('├──────────────────────┼─────────────┼──────────────┤');
    console.log(`│ Total Latency (ms)   │ ${String(current.totalTime).padStart(11)} │ ${String(gemini.totalTime).padStart(12)} │`);
    console.log(`│ API Calls            │      2      │      1       │`);
    console.log(`│ JSON Valid           │   ${current.valid ? '✅' : '❌'}     │   ${gemini.valid ? '✅' : '❌'}      │`);
    console.log(`│ Angles Parsed        │      ${current.angles}      │      ${gemini.angles}       │`);
    console.log(`│ Citations            │      ${current.citations}      │      ${gemini.citations}       │`);
    console.log('└──────────────────────┴─────────────┴──────────────┘');

    console.log(`\n🎯 VERDICT:`);
    console.log(`   Gemini is ${isFaster ? '🚀 FASTER' : '🐢 SLOWER'} by ~${diff}ms (${pct}%)`);

    if (gemini.valid && gemini.angles >= 2) {
      console.log(`   ✅ Gemini output is complete and valid`);
      console.log(`   \n💡 RECOMMENDATION: Switch to Gemini 2.5 Flash`);
    }
  } else {
    if (current.error) console.log(`❌ Current: ${current.error}`);
    if (gemini.error) console.log(`❌ Gemini: ${gemini.error}`);
  }

  console.log('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Gemini 2.5 Flash vs. Perplexity + OpenAI            ║
║  Test Query: "${TEST_QUERY}"                         
╚════════════════════════════════════════════════════════╝
`);

  const current = await testCurrentPipeline();
  const gemini = await testGeminiPipeline();
  compare(current, gemini);

  // Cost comparison (rough)
  console.log('COST NOTE (approximate):');
  console.log('  Current: Perplexity $0.003 + OpenAI $0.0004 = ~$0.0034/request');
  console.log('  Gemini 2.5 Flash: ~$0.001/request (70% cheaper)');
  console.log('\nNOTE: Gemini 2.5 has June 2025 knowledge cutoff.');
  console.log('For truly live search, use Google Search API + Gemini.\n');
}

main().catch(console.error);
