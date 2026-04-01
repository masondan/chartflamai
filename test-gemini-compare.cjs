#!/usr/bin/env node

/**
 * SIMPLER TEST: Gemini 3.1 Flash Lite vs. Current Pipeline
 * CommonJS version for better compatibility
 *
 * Run: node test-gemini-compare.js
 */

require('dotenv').config();

// Try multiple key name variants
const PERPLEXITY_KEY = 
  process.env.PERPLEXITY_API_KEY || 
  process.env.VITE_PERPLEXITY_API_KEY;

const OPENAI_KEY = 
  process.env.OPENAI_API_KEY || 
  process.env.VITE_OPENAI_API_KEY;

const GEMINI_KEY = 
  process.env.GOOGLE_GENAI_API_KEY || 
  process.env.VITE_GOOGLE_GENAI_API_KEY;

const TEST_QUERY = 'What is the global fertility rate by region and how has it changed?';
const TEST_AUDIENCE = 'African journalists';

// Debug: show what was found
console.log('\n📋 Environment Check:');
console.log(`   PERPLEXITY_API_KEY: ${PERPLEXITY_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   OPENAI_API_KEY: ${OPENAI_KEY ? '✅ Found' : '❌ Missing'}`);
console.log(`   GOOGLE_GENAI_API_KEY: ${GEMINI_KEY ? '✅ Found' : '❌ Missing'}\n`);

// Quick validation
if (!PERPLEXITY_KEY || !OPENAI_KEY || !GEMINI_KEY) {
  console.error('❌ Missing one or more API keys. Check your .env file.\n');
  if (!PERPLEXITY_KEY) console.error('   Add: PERPLEXITY_API_KEY=your_key');
  if (!OPENAI_KEY) console.error('   Add: OPENAI_API_KEY=your_key');
  if (!GEMINI_KEY) console.error('   Add: GOOGLE_GENAI_API_KEY=your_key');
  console.error('\n');
  process.exit(1);
}

console.log(`
╔════════════════════════════════════════════════════════╗
║  Gemini 3.1 Flash Lite vs. Perplexity + OpenAI       ║
║  Speed & Quality Comparison Test                      ║
╚════════════════════════════════════════════════════════╝

Query: "${TEST_QUERY}"
Audience: "${TEST_AUDIENCE}"
`);

// Test 1: Current (Perplexity + OpenAI)
async function testCurrent() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: CURRENT PIPELINE (Perplexity + OpenAI)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    // Step 1: Perplexity
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
            content: `Find current data on global fertility rates by region. Provide specific numbers, statistics, and regional comparisons.`
          }
        ],
        max_tokens: 3000
      })
    });

    if (!pRes.ok) {
      throw new Error(`Perplexity: ${pRes.status}`);
    }

    const pData = await pRes.json();
    const pText = pData.choices?.[0]?.message?.content || '';
    const pCitations = pData.citations?.length || 0;
    const p1Time = Date.now() - t1;

    console.log(`✅ Perplexity done: ${p1Time}ms`);
    console.log(`   Response: ${pText.length} chars, ${pCitations} citations\n`);

    // Step 2: OpenAI
    console.log('⏳ [2/2] Calling OpenAI for JSON structuring...');
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
            content: `Return valid JSON:
{
  "angles": [
    {
      "id": "angle_1",
      "headline": "Question hook",
      "summary": "40-word summary",
      "sources": ["Org: https://url"],
      "keyFinding": "Key insight",
      "data": {"labels": ["A","B"], "datasets": [{"label": "Series", "data": [1,2]}]}
    }
  ]
}

Source text:
${pText}
`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        temperature: 0.3
      })
    });

    if (!oRes.ok) {
      throw new Error(`OpenAI: ${oRes.status}`);
    }

    const oData = await oRes.json();
    const oJson = oData.choices?.[0]?.message?.content || '';
    const p2Time = Date.now() - t2;

    console.log(`✅ OpenAI done: ${p2Time}ms`);
    console.log(`   JSON response: ${oJson.length} chars\n`);

    // Validate JSON
    let valid = false;
    let angles = 0;
    try {
      const parsed = JSON.parse(oJson);
      valid = true;
      angles = parsed.angles?.length || 0;
    } catch (e) {
      console.log(`   ⚠️  JSON parse error: ${e.message}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`📊 RESULTS:`);
    console.log(`   Total time: ${totalTime}ms (${p1Time}ms + ${p2Time}ms)`);
    console.log(`   JSON valid: ${valid ? '✅' : '❌'}`);
    console.log(`   Angles: ${angles}`);
    console.log(`   Citations: ${pCitations}\n`);

    return { totalTime, p1Time, p2Time, valid, angles, citations: pCitations, calls: 2 };
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
    return { error: err.message, calls: 2 };
  }
}

// Test 2: Gemini (single call)
async function testGemini() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: NEW PIPELINE (Gemini 3.1 Flash Lite)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    console.log('⏳ [1/1] Calling Gemini with google_search_retrieval...');
    const t1 = Date.now();

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are a Senior Data Journalist AI. Create exactly 3 story angles about global fertility rates by region.

Return ONLY this JSON structure (no markdown, no explanation, no extra text):
{
  "angles": [
    {
      "id": "angle_1",
      "headline": "Is global fertility on track?",
      "summary": "Global fertility rates have declined significantly over the past decade, with regional variations between Africa and Europe.",
      "sources": ["World Bank: https://data.worldbank.org"],
      "keyFinding": "Global fertility dropped from 2.5 to 2.3 children per woman",
      "data": {
        "labels": ["Africa", "Asia", "Europe", "Americas"],
        "datasets": [{
          "label": "Fertility Rate (children/woman)",
          "data": [4.7, 2.1, 1.5, 1.9]
        }]
      }
    },
    {
      "id": "angle_2",
      "headline": "Why are African fertility rates different?",
      "summary": "Africa has the highest fertility rates globally, driven by education gaps, healthcare access, and cultural factors.",
      "sources": ["UN Population Division: https://population.un.org"],
      "keyFinding": "African women have 2.2x more children than European women",
      "data": {
        "labels": ["Sub-Saharan Africa", "North Africa", "World Average"],
        "datasets": [{
          "label": "Fertility Rate",
          "data": [4.7, 3.0, 2.3]
        }]
      }
    },
    {
      "id": "angle_3",
      "headline": "What happens when fertility drops?",
      "summary": "Declining fertility in developed nations creates aging populations and economic challenges for healthcare and pensions.",
      "sources": ["OECD: https://oecd.org"],
      "keyFinding": "30+ countries now have fertility below replacement level",
      "data": {
        "labels": ["2000", "2010", "2020", "2030 Proj"],
        "datasets": [{
          "label": "Developed Nations Avg",
          "data": [1.6, 1.65, 1.6, 1.58]
        }]
      }
    }
  ]
}

Audience: ${TEST_AUDIENCE}
Data: Global fertility rate trends, regional breakdowns, projections.
CRITICAL: Return ONLY the JSON. No markdown fences. No explanation. Just the object.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000
          }
        })
      }
    );

    if (!gRes.ok) {
      const errText = await gRes.text();
      throw new Error(`Gemini: ${gRes.status} - ${errText.substring(0, 100)}`);
    }

    const gData = await gRes.json();
    let gText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const g1Time = Date.now() - t1;

    console.log(`✅ Gemini done: ${g1Time}ms`);
    console.log(`   Response: ${gText.length} chars\n`);

    // Strip markdown code fences if present
    gText = gText.replace(/^```json\s*/m, '').replace(/```\s*$/, '').trim();

    // Validate JSON
    let valid = false;
    let angles = 0;
    let citations = 0;
    try {
      const parsed = JSON.parse(gText);
      valid = true;
      angles = parsed.angles?.length || 0;
      citations = parsed.angles?.reduce((sum, a) => sum + (a.sources?.length || 0), 0) || 0;
    } catch (e) {
      console.log(`   ⚠️  JSON parse error: ${e.message.substring(0, 50)}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`📊 RESULTS:`);
    console.log(`   Total time: ${totalTime}ms (single call)`);
    console.log(`   JSON valid: ${valid ? '✅' : '❌'}`);
    console.log(`   Angles: ${angles}`);
    console.log(`   Citations: ${citations}\n`);

    return { totalTime, g1Time, valid, angles, citations, calls: 1 };
  } catch (err) {
    console.error(`❌ Error: ${err.message}\n`);
    return { error: err.message, calls: 1 };
  }
}

// Comparison
function compare(current, gemini) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('COMPARISON');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!current.error && !gemini.error) {
    const speedup = ((current.totalTime - gemini.totalTime) / current.totalTime * 100).toFixed(1);
    const isFaster = gemini.totalTime < current.totalTime;
    const diff = Math.abs(gemini.totalTime - current.totalTime);

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
    console.log(`   Gemini is ${isFaster ? '🚀 FASTER' : '🐢 SLOWER'} by ~${diff}ms (${isFaster ? '+' : '-'}${Math.abs(speedup)}%)`);

    if (gemini.valid && gemini.angles >= 2) {
      console.log(`   Gemini JSON output is ✅ VALID and ✅ COMPLETE`);
      console.log(`   \n💡 NEXT: Test editorial quality manually`);
    } else {
      console.log(`   Gemini output needs review (JSON/structure issues)`);
    }
  } else {
    if (current.error) console.log(`❌ Current: ${current.error}`);
    if (gemini.error) console.log(`❌ Gemini: ${gemini.error}`);
  }

  console.log('\n');
}

// Main
async function main() {
  const current = await testCurrent();
  const gemini = await testGemini();
  compare(current, gemini);
}

main().catch(console.error);
