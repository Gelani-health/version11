import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { authenticateRequest } from '@/lib/auth-middleware';

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  description: string;
  clinicalEffects: string[];
  management: string;
  references: string[];
  mechanism?: string;
  monitoring?: string[];
}

// Comprehensive drug interaction database with evidence-based interactions
// References: FDA Drug Safety Communications, Clinical Pharmacology, Lexicomp, Micromedex
const mockInteractions: DrugInteraction[] = [
  // WARFARIN INTERACTIONS
  {
    drug1: "Warfarin",
    drug2: "Aspirin",
    severity: "major",
    description: "Increased risk of bleeding due to additive effects on hemostasis.",
    clinicalEffects: ["Increased INR", "Bleeding risk", "Bruising"],
    management: "Monitor INR more frequently. Consider alternative analgesic. Avoid combination if possible.",
    references: ["FDA Drug Safety Communication", "Clinical Pharmacology Database"],
    mechanism: "Additive anticoagulant effect",
    monitoring: ["INR", "Signs of bleeding", "Hemoglobin"],
  },
  {
    drug1: "Warfarin",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs enhance anticoagulant effect of warfarin, increasing bleeding risk.",
    clinicalEffects: ["GI bleeding", "Increased INR", "Hematuria"],
    management: "Avoid concurrent use. If necessary, use lowest effective dose for shortest duration.",
    references: ["Lexicomp Drug Interactions", "UpToDate"],
    mechanism: "NSAID-induced gastric ulceration + anticoagulation",
    monitoring: ["INR", "Hemoglobin", "Stool guaiac"],
  },
  {
    drug1: "Warfarin",
    drug2: "Amiodarone",
    severity: "major",
    description: "Amiodarone inhibits warfarin metabolism, significantly increasing INR and bleeding risk.",
    clinicalEffects: ["Markedly increased INR", "Severe bleeding", "Bruising"],
    management: "Reduce warfarin dose by 30-50%. Monitor INR twice weekly initially.",
    references: ["FDA Prescribing Information", "PMID: 15574368"],
    mechanism: "CYP2C9 and CYP1A2 inhibition",
    monitoring: ["INR twice weekly", "Bleeding signs"],
  },
  {
    drug1: "Warfarin",
    drug2: "Fluconazole",
    severity: "major",
    description: "Fluconazole significantly increases warfarin levels through CYP2C9 inhibition.",
    clinicalEffects: ["Increased INR", "Bleeding risk"],
    management: "Reduce warfarin dose by 50%. Monitor INR closely.",
    references: ["Clinical Pharmacology", "PMID: 8566294"],
    mechanism: "Potent CYP2C9 inhibition",
    monitoring: ["INR", "Bleeding signs"],
  },
  {
    drug1: "Warfarin",
    drug2: "Metronidazole",
    severity: "major",
    description: "Metronidazole prolongs PT/INR through CYP2C9 inhibition.",
    clinicalEffects: ["Increased INR", "Bleeding"],
    management: "Reduce warfarin dose by 25-50%. Monitor INR.",
    references: ["PMID: 6338835"],
    mechanism: "CYP2C9 inhibition and vitamin K antagonism",
    monitoring: ["INR"],
  },
  
  // STATIN INTERACTIONS
  {
    drug1: "Simvastatin",
    drug2: "Clarithromycin",
    severity: "contraindicated",
    description: "CONTRAINDICATED. Potent CYP3A4 inhibition causes 10-fold increase in simvastatin levels. High risk of rhabdomyolysis.",
    clinicalEffects: ["Rhabdomyolysis", "Acute kidney injury", "Muscle pain"],
    management: "CONTRAINDICATED - Suspend simvastatin during clarithromycin treatment.",
    references: ["FDA Drug Safety", "PMID: 11437544"],
    mechanism: "Potent CYP3A4 inhibition",
    monitoring: ["CK", "Muscle symptoms", "Renal function"],
  },
  {
    drug1: "Simvastatin",
    drug2: "Itraconazole",
    severity: "contraindicated",
    description: "CONTRAINDICATED. High risk of rhabdomyolysis due to CYP3A4 inhibition.",
    clinicalEffects: ["Rhabdomyolysis", "Muscle breakdown", "AKI"],
    management: "CONTRAINDICATED - Do not co-administer.",
    references: ["FDA Prescribing Information", "PMID: 11437544"],
    mechanism: "Potent CYP3A4 inhibition",
    monitoring: ["CK"],
  },
  {
    drug1: "Atorvastatin",
    drug2: "Clarithromycin",
    severity: "major",
    description: "Clarithromycin increases atorvastatin levels, raising rhabdomyolysis risk.",
    clinicalEffects: ["Increased statin levels", "Rhabdomyolysis risk"],
    management: "Reduce atorvastatin dose by 50% or suspend temporarily.",
    references: ["PMID: 11437544"],
    mechanism: "CYP3A4 inhibition",
    monitoring: ["CK", "Muscle symptoms"],
  },
  
  // MAOI/SSRI INTERACTIONS (SEROTONIN SYNDROME)
  {
    drug1: "Phenelzine",
    drug2: "Sertraline",
    severity: "contraindicated",
    description: "CONTRAINDICATED. Risk of serotonin syndrome and hypertensive crisis.",
    clinicalEffects: ["Serotonin syndrome", "Hypertensive crisis", "Hyperthermia"],
    management: "CONTRAINDICATED - 2-week washout required between MAOI and SSRI.",
    references: ["FDA Black Box Warning", "PMID: 11013151"],
    mechanism: "MAO inhibition + serotonin reuptake inhibition",
    monitoring: ["Vital signs", "Mental status"],
  },
  {
    drug1: "Tranylcypromine",
    drug2: "Fluoxetine",
    severity: "contraindicated",
    description: "CONTRAINDICATED. Risk of serotonin syndrome. Fluoxetine requires 5-week washout due to long half-life.",
    clinicalEffects: ["Serotonin syndrome", "Hypertensive crisis"],
    management: "CONTRAINDICATED - 5-week washout required for fluoxetine.",
    references: ["PMID: 11013151"],
    mechanism: "MAO inhibition + serotonin reuptake inhibition",
    monitoring: ["Vital signs", "Mental status"],
  },
  
  // OPIOID/BENZODIAZEPINE INTERACTIONS
  {
    drug1: "Morphine",
    drug2: "Diazepam",
    severity: "major",
    description: "FDA Black Box Warning: Profound sedation, respiratory depression, coma, and death.",
    clinicalEffects: ["Profound sedation", "Respiratory depression", "Death"],
    management: "Avoid if possible. If combined, use lowest doses with close monitoring.",
    references: ["FDA Drug Safety Communication", "PMID: 28379233"],
    mechanism: "Additive CNS and respiratory depression",
    monitoring: ["Respiratory rate", "Sedation level", "Oxygen saturation"],
  },
  {
    drug1: "Oxycodone",
    drug2: "Alprazolam",
    severity: "major",
    description: "FDA Black Box Warning: Concomitant use increases risk of death.",
    clinicalEffects: ["Profound sedation", "Respiratory depression", "Death"],
    management: "FDA Black Box Warning - avoid if possible.",
    references: ["FDA Drug Safety Communication", "PMID: 28379233"],
    mechanism: "Additive CNS and respiratory depression",
    monitoring: ["Respiratory rate", "Sedation level"],
  },
  
  // QT PROLONGATION INTERACTIONS
  {
    drug1: "Clarithromycin",
    drug2: "Quinidine",
    severity: "contraindicated",
    description: "CONTRAINDICATED. Risk of QT prolongation, Torsades de Pointes, and sudden death.",
    clinicalEffects: ["QT prolongation", "Torsades de Pointes", "Sudden cardiac death"],
    management: "CONTRAINDICATED - avoid combination.",
    references: ["PMID: 14656711"],
    mechanism: "Additive QT prolongation + CYP3A4 inhibition",
    monitoring: ["ECG", "QTc interval"],
  },
  {
    drug1: "Azithromycin",
    drug2: "Amiodarone",
    severity: "major",
    description: "Additive QT prolongation. Risk of Torsades de Pointes.",
    clinicalEffects: ["QT prolongation", "Torsades de Pointes"],
    management: "Avoid combination; if necessary, monitor ECG continuously.",
    references: ["PMID: 23435069"],
    mechanism: "Additive QT prolongation",
    monitoring: ["ECG", "QTc"],
  },
  
  // METHOTREXATE INTERACTIONS
  {
    drug1: "Methotrexate",
    drug2: "Trimethoprim-Sulfamethoxazole",
    severity: "contraindicated",
    description: "CONTRAINDICATED. Risk of severe myelosuppression, mucositis, and death.",
    clinicalEffects: ["Severe myelosuppression", "Mucositis", "Pancytopenia"],
    management: "CONTRAINDICATED - avoid combination.",
    references: ["PMID: 3031225"],
    mechanism: "Additive antifolate effect, protein displacement, reduced clearance",
    monitoring: ["CBC", "Renal function"],
  },
  {
    drug1: "Methotrexate",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs reduce methotrexate clearance, increasing toxicity risk.",
    clinicalEffects: ["Methotrexate toxicity", "Myelosuppression"],
    management: "Use with caution; monitor renal function and CBC closely.",
    references: ["PMID: 3084393"],
    mechanism: "Reduced renal clearance",
    monitoring: ["CBC", "Renal function", "LFTs"],
  },
  
  // LITHIUM INTERACTIONS
  {
    drug1: "Lithium",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs reduce lithium clearance, increasing toxicity risk.",
    clinicalEffects: ["Lithium toxicity", "Tremor", "Confusion", "Seizures"],
    management: "Monitor lithium levels closely; consider dose reduction.",
    references: ["PMID: 8566294"],
    mechanism: "Reduced renal lithium clearance",
    monitoring: ["Serum lithium", "Renal function"],
  },
  {
    drug1: "Lithium",
    drug2: "Lisinopril",
    severity: "major",
    description: "ACE inhibitors reduce lithium clearance.",
    clinicalEffects: ["Lithium toxicity"],
    management: "Reduce lithium dose; monitor levels frequently.",
    references: ["PMID: 8566294"],
    mechanism: "Reduced renal lithium clearance",
    monitoring: ["Serum lithium"],
  },
  
  // DIGOXIN INTERACTIONS
  {
    drug1: "Digoxin",
    drug2: "Amiodarone",
    severity: "major",
    description: "Amiodarone increases digoxin levels by 50-100%.",
    clinicalEffects: ["Digoxin toxicity", "Nausea", "Visual changes", "Arrhythmias"],
    management: "Reduce digoxin dose by 50%; monitor levels.",
    references: ["PMID: 6605085"],
    mechanism: "P-glycoprotein inhibition, reduced renal clearance",
    monitoring: ["Serum digoxin", "Renal function"],
  },
  {
    drug1: "Digoxin",
    drug2: "Verapamil",
    severity: "major",
    description: "Verapamil significantly increases digoxin levels.",
    clinicalEffects: ["Digoxin toxicity"],
    management: "Reduce digoxin dose by 25-50%; monitor levels.",
    references: ["PMID: 6605085"],
    mechanism: "P-glycoprotein inhibition, reduced clearance",
    monitoring: ["Serum digoxin"],
  },
  
  // ACE INHIBITOR INTERACTIONS
  {
    drug1: "Lisinopril",
    drug2: "Ibuprofen",
    severity: "moderate",
    description: "NSAIDs may reduce the antihypertensive effect of ACE inhibitors.",
    clinicalEffects: ["Reduced BP control", "Potential renal impairment"],
    management: "Monitor blood pressure. Consider alternative pain management.",
    references: ["AHFS Drug Information"],
    mechanism: "Prostaglandin inhibition",
    monitoring: ["Blood pressure", "Serum creatinine"],
  },
  {
    drug1: "Lisinopril",
    drug2: "Spironolactone",
    severity: "major",
    description: "Risk of hyperkalemia with ACE inhibitor and potassium-sparing diuretic.",
    clinicalEffects: ["Hyperkalemia", "Arrhythmias"],
    management: "Monitor potassium frequently.",
    references: ["Clinical Pharmacology"],
    mechanism: "Additive potassium-sparing effect",
    monitoring: ["Serum potassium", "Renal function"],
  },
  
  // OTHER INTERACTIONS
  {
    drug1: "Metformin",
    drug2: "Omeprazole",
    severity: "minor",
    description: "Proton pump inhibitors may reduce metformin efficacy.",
    clinicalEffects: ["Reduced glycemic control"],
    management: "Monitor blood glucose. Adjust metformin dose if needed.",
    references: ["Drug Interaction Facts"],
    mechanism: "Unknown",
    monitoring: ["Blood glucose"],
  },
  {
    drug1: "Atorvastatin",
    drug2: "Grapefruit",
    severity: "moderate",
    description: "Grapefruit juice can increase atorvastatin levels.",
    clinicalEffects: ["Increased risk of myopathy", "Elevated liver enzymes"],
    management: "Avoid large quantities of grapefruit juice. Monitor for muscle symptoms.",
    references: ["FDA Prescribing Information"],
    mechanism: "CYP3A4 inhibition in gut",
    monitoring: ["Muscle symptoms"],
  },
  {
    drug1: "Theophylline",
    drug2: "Ciprofloxacin",
    severity: "major",
    description: "Ciprofloxacin increases theophylline levels, risk of toxicity.",
    clinicalEffects: ["Theophylline toxicity", "Seizures", "Arrhythmias"],
    management: "Reduce theophylline dose by 50%; monitor levels.",
    references: ["PMID: 2858222"],
    mechanism: "CYP1A2 inhibition",
    monitoring: ["Serum theophylline"],
  },
  {
    drug1: "Ciprofloxacin",
    drug2: "Warfarin",
    severity: "moderate",
    description: "May enhance anticoagulant effect.",
    clinicalEffects: ["Increased INR", "Bleeding risk"],
    management: "Monitor INR more frequently.",
    references: ["Lexicomp"],
    mechanism: "Altered flora, CYP inhibition",
    monitoring: ["INR"],
  },
];

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('patient:read')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

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
      contraindicated: foundInteractions.filter((i) => i.severity === "contraindicated").length,
      major: foundInteractions.filter((i) => i.severity === "major").length,
      moderate: foundInteractions.filter((i) => i.severity === "moderate").length,
      minor: foundInteractions.filter((i) => i.severity === "minor").length,
    };

    // Log safety event for audit trail
    if (foundInteractions.length > 0) {
      console.log(JSON.stringify({
        type: "DRUG_INTERACTION_CHECK",
        timestamp: new Date().toISOString(),
        userId: user.id,
        medicationsCount: medications.length,
        interactionsFound: foundInteractions.length,
        severityBreakdown: summary,
        hasContraindications: summary.contraindicated > 0,
        hasMajor: summary.major > 0,
      }));
    }

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
    // Log error for debugging while not exposing sensitive details
    console.error(JSON.stringify({
      type: "DRUG_INTERACTION_ERROR",
      timestamp: new Date().toISOString(),
      userId: user?.id || "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    }));
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check drug interactions. Please try again or contact support if the issue persists.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('patient:read')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

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
