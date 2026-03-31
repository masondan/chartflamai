require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function testGeminiSearch() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const searchPrompt = `You are a Senior Data Journalist AI discovering 3 high-quality story angles.

JOURNALIST'S QUESTION: What is the current state of childhood obesity rates globally and by major regions?
JOURNALIST'S AUDIENCE: Health policy professionals

### TASK:
Identify 3 distinct story angles with data. For EACH, provide:
- **Headline:** Creative question hook (max 70 chars)
- **Summary:** 40-word narrative standfirst
- **Chart Type & Reasoning:** Select from: pie, bar, stackedBar, groupedBar, line
- **Key Finding:** One powerful sentence with actual numbers
- **The Mini-Explainer:** 3-paragraph deep dive
- **Source Citations:** Full URLs to specific datasets with organisation name
- **Numerical Data:** Raw data points that could be charted

Return as plain text, NOT JSON.`;

  console.log("🔍 Testing Gemini 2.0 Flash with web search...\n");
  console.time("Gemini Search");

  try {
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
    console.log("\n📊 First 1500 chars of response:\n");
    console.log(response.substring(0, 1500));
    console.log("\n...[truncated]\n");

    // Check for citations
    const metadata = result.response.candidates?.[0]?.groundingMetadata;
    if (metadata) {
      console.log("✅ Grounding metadata found:");
      console.log(JSON.stringify(metadata, null, 2).substring(0, 800));
    } else {
      console.log("⚠️  Check citations in response text itself");
    }

    console.log("\n✅ Response completed successfully");
    return response;
  } catch (err) {
    console.error("❌ Error:", err);
    throw err;
  }
}

testGeminiSearch().catch(console.error);
