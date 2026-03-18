import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { searchMedicalTerms } from "@/lib/medical-dictionary";

interface SmartSuggestion {
  term: string;
  category: string;
  description?: string;
  icdCode?: string;
  relevance: number;
  source: "dictionary" | "ai";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, context, patientContext } = body;

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: { suggestions: [] },
      });
    }

    // First, get dictionary matches
    const dictionaryResults = searchMedicalTerms(query, 5);
    
    // Prepare suggestions
    const suggestions: SmartSuggestion[] = dictionaryResults.map(term => ({
      term: term.term,
      category: term.category,
      description: term.description,
      icdCode: term.icdCode,
      relevance: 1.0,
      source: "dictionary" as const,
    }));

    // If we have context or patient context, use LLM for smart suggestions
    if ((context && context.length > 10) || patientContext) {
      try {
        const zai = await ZAI.create();
        
        const systemPrompt = `You are a medical terminology assistant. Given a partial word or phrase that a healthcare provider is typing, suggest relevant medical terms that could complete it.

Consider:
1. The partial word being typed
2. The surrounding clinical context
3. The patient's medical history if provided

Return up to 3 suggestions in JSON format:
[
  { "term": "suggested term", "category": "category", "description": "brief description", "relevance": 0.9 }
]

Only return valid medical terms, drugs, diagnoses, or clinical phrases. Be concise.`;

        const userPrompt = `Partial word: "${query}"
${context ? `Surrounding text: "${context}"` : ""}
${patientContext ? `Patient context: ${JSON.stringify(patientContext)}` : ""}

Suggest relevant medical terms that could complete this.`;

        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          thinking: { type: "disabled" },
        });

        const aiResponse = completion.choices[0]?.message?.content || "";
        
        // Parse AI response for suggestions
        // Try to extract JSON array from response
        const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          try {
            const aiSuggestions = JSON.parse(jsonMatch[0]);
            for (const suggestion of aiSuggestions) {
              // Add AI suggestions if not already in dictionary results
              if (!suggestions.some(s => s.term.toLowerCase() === suggestion.term.toLowerCase())) {
                suggestions.push({
                  term: suggestion.term,
                  category: suggestion.category || "AI Suggestion",
                  description: suggestion.description,
                  relevance: suggestion.relevance || 0.8,
                  source: "ai",
                });
              }
            }
          } catch {
            // If parsing fails, continue with dictionary results only
          }
        }
      } catch (aiError) {
        // AI failed, continue with dictionary results only
        console.log("AI suggestion failed:", aiError);
      }
    }

    // Sort by relevance
    suggestions.sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 8),
        query,
      },
    });
  } catch (error) {
    console.error("Smart suggestion error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get suggestions" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  
  const results = searchMedicalTerms(query, 10);
  
  return NextResponse.json({
    success: true,
    data: {
      suggestions: results,
      query,
    },
  });
}
