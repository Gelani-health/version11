import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientInfo, visitType, notes, chiefComplaint } = body;

    // Initialize ZAI SDK (reads from .z-ai-config file)
    const zai = await ZAI.create();

    const systemPrompt = `You are a medical documentation assistant integrated with Bahmni HIS.
Your task is to generate comprehensive SOAP notes from clinical encounter information.

SOAP FORMAT:
- SUBJECTIVE: Patient's description of symptoms, history, relevant context
- OBJECTIVE: Vital signs, physical exam findings, diagnostic results
- ASSESSMENT: Clinical impression, diagnoses with ICD-10 codes
- PLAN: Treatment plan, medications, follow-up instructions

GUIDELINES:
1. Use professional medical terminology
2. Include ICD-10 codes for diagnoses
3. Be concise but comprehensive
4. Include relevant clinical reasoning
5. Suggest appropriate follow-up`;

    const userPrompt = `Generate a SOAP note for the following clinical encounter:

Patient: ${patientInfo?.name || "Patient"}
Visit Type: ${visitType || "Consultation"}
Chief Complaint: ${chiefComplaint || "Not specified"}
Clinical Notes: ${notes || "No additional notes"}

Please generate a complete SOAP note.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    const soapNote = completion.choices[0]?.message?.content || "";

    // Parse the SOAP note into sections
    const sections = parseSOAPSections(soapNote);

    return NextResponse.json({
      success: true,
      data: {
        rawContent: soapNote,
        sections,
        patientInfo,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Documentation API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate documentation",
      },
      { status: 500 }
    );
  }
}

function parseSOAPSections(content: string) {
  const sections = {
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  };

  // Simple parsing - in production, this would be more robust
  const subjectiveMatch = content.match(/SUBJECTIVE:?\s*([\s\S]*?)(?=OBJECTIVE:|$)/i);
  const objectiveMatch = content.match(/OBJECTIVE:?\s*([\s\S]*?)(?=ASSESSMENT:|$)/i);
  const assessmentMatch = content.match(/ASSESSMENT:?\s*([\s\S]*?)(?=PLAN:|$)/i);
  const planMatch = content.match(/PLAN:?\s*([\s\S]*?)$/i);

  if (subjectiveMatch) sections.subjective = subjectiveMatch[1].trim();
  if (objectiveMatch) sections.objective = objectiveMatch[1].trim();
  if (assessmentMatch) sections.assessment = assessmentMatch[1].trim();
  if (planMatch) sections.plan = planMatch[1].trim();

  return sections;
}

export async function GET() {
  return NextResponse.json({
    status: "Documentation Assistant API is running",
    features: [
      "SOAP note generation",
      "ICD-10 code suggestions",
      "Template-based documentation",
      "AI-assisted medical writing",
    ],
  });
}
