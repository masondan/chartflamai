import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

async function testGeminiSearch() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const searchPrompt = `You are a Senior Data Journalist AI. A journalist is using you to discover 3 high-quality, data-driven story angles.

JOURNALIST'S QUESTION: What is the current state of childhood obesity rates globally and by major regions?
JOURNALIST'S AUDIENCE: Health policy professionals
PREFERRED CHART TYPE: bar

### MANDATORY EDITORIAL STANDARDS:
1. **Headline Hooks:** Headlines MUST be creative questions that act as "scroll-stopping" hooks. Use sentence case.
2. **The Standfirst (Summary):** Provide a ~40-word narrative summary. This should be a "compelling lede" that sets the scene.
3. **Language:** Use impeccable British English.
4. **Data Depth:** Bar charts need 5+ distinct categories for comprehensive comparison.
5. **The Mini-Explainer:** 3 short paragraphs explaining the "so what," context, and what numbers reveal.

### YOUR TASK:
Identify 3 distinct story angles. For EACH angle, provide:
- **Headline:** Creative question hook (max 70 chars).
- **Summary:** 40-word narrative standfirst.
- **Chart Type & Reasoning:** Select from: pie, bar, stackedBar, groupedBar, line.
- **Key Finding:** One powerful sentence.
- **The Mini-Explainer:** 3-paragraph deep dive.
- **Source Citations:** Full URLs to the specific datasets.
- **Numerical Data:** Structured list of raw data points.

Return the response as plain text (NOT JSON).`;

  console.log("🔍 Testing Gemini 2.0 Flash with web search...\n");
  console.time("Gemini Search");

  try {
    // Enable Google Search Grounding
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: searchPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
      tools: [
        {
          googleSearch: {},
        },
      ],
    });

    console.timeEnd("Gemini Search");

    const response = result.response.text();
    console.log("\n📊 Response:\n");
    console.log(response.substring(0, 1500)); // First 1500 chars
    console.log("\n...[truncated]\n");

    // Check for citations/grounding
    const groundingMetadata = (result.response as any).groundingMetadata;
    if (groundingMetadata) {
      console.log("✅ Grounding/Citation metadata found:");
      console.log(JSON.stringify(groundingMetadata, null, 2).substring(0, 500));
    } else {
      console.log("⚠️  No grounding metadata detected");
    }

    return response;
  } catch (err) {
    console.error("❌ Error:", err);
    throw err;
  }
}

// Run test
testGeminiSearch().catch(console.error);
