import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  clinicalEffects: string[];
  management: string;
  references: string[];
}

// Mock drug interaction database (in production, this would be a real database)
const mockInteractions: DrugInteraction[] = [
  {
    drug1: "Warfarin",
    drug2: "Aspirin",
    severity: "major",
    description: "Increased risk of bleeding due to additive effects on hemostasis.",
    clinicalEffects: ["Increased INR", "Bleeding risk", "Bruising"],
    management: "Monitor INR more frequently. Consider alternative analgesic. Avoid combination if possible.",
    references: ["FDA Drug Safety Communication", "Clinical Pharmacology Database"],
  },
  {
    drug1: "Warfarin",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs enhance anticoagulant effect of warfarin, increasing bleeding risk.",
    clinicalEffects: ["GI bleeding", "Increased INR", "Hematuria"],
    management: "Avoid concurrent use. If necessary, use lowest effective dose for shortest duration.",
    references: ["Lexicomp Drug Interactions", "UpToDate"],
  },
  {
    drug1: "Lisinopril",
    drug2: "Ibuprofen",
    severity: "moderate",
    description: "NSAIDs may reduce the antihypertensive effect of ACE inhibitors.",
    clinicalEffects: ["Reduced BP control", "Potential renal impairment"],
    management: "Monitor blood pressure. Consider alternative pain management.",
    references: ["AHFS Drug Information"],
  },
  {
    drug1: "Metformin",
    drug2: "Omeprazole",
    severity: "minor",
    description: "Proton pump inhibitors may reduce metformin efficacy.",
    clinicalEffects: ["Reduced glycemic control"],
    management: "Monitor blood glucose. Adjust metformin dose if needed.",
    references: ["Drug Interaction Facts"],
  },
  {
    drug1: "Atorvastatin",
    drug2: "Grapefruit",
    severity: "moderate",
    description: "Grapefruit juice can increase atorvastatin levels.",
    clinicalEffects: ["Increased risk of myopathy", "Elevated liver enzymes"],
    management: "Avoid large quantities of grapefruit juice. Monitor for muscle symptoms.",
    references: ["FDA Prescribing Information"],
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { medications } = body as { medications: Medication[] };

    if (!medications || medications.length < 2) {
      return NextResponse.json({
        success: false,
        error: "At least 2 medications are required for interaction checking",
      });
    }

    const drugNames = medications.map((m) => m.name.toLowerCase());
    const foundInteractions: DrugInteraction[] = [];

    // Check for interactions between all pairs
    for (let i = 0; i < drugNames.length; i++) {
      for (let j = i + 1; j < drugNames.length; j++) {
        const interaction = mockInteractions.find(
          (int) =>
            (int.drug1.toLowerCase() === drugNames[i] &&
              int.drug2.toLowerCase() === drugNames[j]) ||
            (int.drug1.toLowerCase() === drugNames[j] &&
              int.drug2.toLowerCase() === drugNames[i])
        );

        if (interaction) {
          foundInteractions.push(interaction);
        }
      }
    }

    // If we have medications but no local interactions, use AI to check
    if (foundInteractions.length === 0 && medications.length >= 2) {
      const zai = await ZAI.create();

      const systemPrompt = `You are a clinical pharmacist AI assistant specializing in drug interactions.
Analyze the provided medications for potential interactions.
Provide information in a structured format including:
- Severity level (major/moderate/minor)
- Description of the interaction
- Clinical effects
- Management recommendations
- References if available

If no significant interactions are found, state that clearly.`;

      const userPrompt = `Check for drug interactions between these medications:
${medications.map((m) => `- ${m.name} ${m.dosage || ""} ${m.frequency || ""}`).join("\n")}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      });

      const aiAnalysis = completion.choices[0]?.message?.content;

      return NextResponse.json({
        success: true,
        data: {
          interactions: foundInteractions,
          aiAnalysis,
          medicationsChecked: medications,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    // Generate summary
    const summary = {
      total: foundInteractions.length,
      major: foundInteractions.filter((i) => i.severity === "major").length,
      moderate: foundInteractions.filter((i) => i.severity === "moderate").length,
      minor: foundInteractions.filter((i) => i.severity === "minor").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        interactions: foundInteractions,
        summary,
        medicationsChecked: medications,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Drug Interaction API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check drug interactions",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Drug Interaction Checker API is running",
    database: "Integrated drug interaction database",
    features: [
      "Drug-drug interactions",
      "Severity classification",
      "Clinical management recommendations",
      "AI-powered interaction analysis",
    ],
  });
}
