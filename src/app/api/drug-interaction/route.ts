import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { authenticateRequest } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  description: string;
  clinicalEffects: string[];
  management: string;
  mechanism?: string;
  onset?: string;
  severityScore?: number;
  references: string[];
  source: 'database' | 'ai' | 'knowledge_base';
}

// Comprehensive drug interaction knowledge base
// In production, this should be replaced with a professional database like DrugBank or Lexicomp
const DRUG_INTERACTION_KB: DrugInteraction[] = [
  // ANTICOAGULANTS - High Risk Interactions
  {
    drug1: "Warfarin",
    drug2: "Aspirin",
    severity: "major",
    description: "Increased risk of bleeding due to additive effects on hemostasis. Aspirin inhibits platelet function while warfarin affects clotting factors.",
    clinicalEffects: ["Increased INR", "Major bleeding risk", "GI hemorrhage", "Intracranial hemorrhage"],
    management: "Avoid combination if possible. If necessary, monitor INR weekly, watch for bleeding signs. Consider alternative analgesic like acetaminophen.",
    mechanism: "Pharmacodynamic synergy - both affect hemostasis through different mechanisms",
    onset: "Rapid",
    severityScore: 8,
    references: ["FDA Drug Safety Communication 2024", "ACC/AHA Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Warfarin",
    drug2: "Ibuprofen",
    severity: "major",
    description: "NSAIDs enhance anticoagulant effect of warfarin and add independent bleeding risk through platelet inhibition and GI mucosal damage.",
    clinicalEffects: ["GI bleeding", "Increased INR", "Hematuria", "Melena", "Epistaxis"],
    management: "CONTRAINDICATED in most cases. Use acetaminophen for pain. If NSAID essential, use lowest dose with gastroprotection and frequent INR monitoring.",
    mechanism: "Pharmacodynamic (platelet inhibition) + Pharmacokinetic (CYP2C9 competition)",
    onset: "Days to weeks",
    severityScore: 9,
    references: ["ACCP Guidelines", "UpToDate", "Lexicomp Drug Interactions"],
    source: "knowledge_base"
  },
  {
    drug1: "Warfarin",
    drug2: "Amiodarone",
    severity: "major",
    description: "Amiodarone inhibits CYP2C9 and CYP1A2, significantly increasing warfarin levels and INR.",
    clinicalEffects: ["Marked INR elevation", "Bleeding", "Requires 30-50% warfarin dose reduction"],
    management: "Reduce warfarin dose by 30-50% when starting amiodarone. Monitor INR twice weekly initially. Effect persists months after stopping amiodarone.",
    mechanism: "CYP2C9 and CYP1A2 inhibition",
    onset: "1-2 weeks",
    severityScore: 9,
    references: ["ACCP Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Dabigatran",
    drug2: "Rifampin",
    severity: "contraindicated",
    description: "P-gp induction significantly reduces dabigatran exposure, leading to treatment failure.",
    clinicalEffects: ["Reduced anticoagulant effect", "Thromboembolic events", "Stroke"],
    management: "CONTRAINDICATED. Avoid combination. Use alternative antibiotic or anticoagulant.",
    mechanism: "P-glycoprotein induction",
    onset: "Days",
    severityScore: 10,
    references: ["RE-LY Trial", "FDA Prescribing Information"],
    source: "knowledge_base"
  },
  
  // DOAC Interactions
  {
    drug1: "Apixaban",
    drug2: "Carbamazepine",
    severity: "contraindicated",
    description: "Strong CYP3A4 and P-gp inducers significantly reduce apixaban exposure.",
    clinicalEffects: ["Reduced anticoagulant effect", "Thromboembolic risk"],
    management: "CONTRAINDICATED. Avoid combination. Consider alternative anticoagulant or antiepileptic.",
    mechanism: "CYP3A4 and P-gp induction",
    onset: "Days",
    severityScore: 10,
    references: ["ARISTOTLE Trial Subgroup", "FDA Prescribing Information"],
    source: "knowledge_base"
  },
  {
    drug1: "Rivaroxaban",
    drug2: "Ketoconazole",
    severity: "major",
    description: "Strong CYP3A4 and P-gp inhibitors significantly increase rivaroxaban exposure.",
    clinicalEffects: ["Increased bleeding risk", "Major hemorrhage"],
    management: "Avoid combination. If necessary, reduce rivaroxaban dose. Monitor for bleeding closely.",
    mechanism: "CYP3A4 and P-gp inhibition",
    onset: "Hours to days",
    severityScore: 8,
    references: ["ROCKET-AF Trial", "FDA Prescribing Information"],
    source: "knowledge_base"
  },
  
  // CARDIOVASCULAR INTERACTIONS
  {
    drug1: "Lisinopril",
    drug2: "Ibuprofen",
    severity: "moderate",
    description: "NSAIDs may reduce the antihypertensive effect of ACE inhibitors and worsen renal function, especially in volume-depleted patients.",
    clinicalEffects: ["Reduced BP control", "Acute kidney injury", "Hyperkalemia"],
    management: "Monitor blood pressure and renal function. Use lowest effective NSAID dose for shortest duration. Consider alternative analgesic.",
    mechanism: "NSAIDs inhibit prostaglandin synthesis, reducing ACE inhibitor vasodilatory effects",
    onset: "Days",
    severityScore: 6,
    references: ["AHFS Drug Information", "KDOQI Guidelines"],
    source: "knowledge_base"
  },
  {
    drug1: "Lisinopril",
    drug2: "Spironolactone",
    severity: "major",
    description: "ACE inhibitors and potassium-sparing diuretics can cause severe hyperkalemia, especially in patients with renal impairment.",
    clinicalEffects: ["Hyperkalemia", "Arrhythmias", "Cardiac arrest"],
    management: "Monitor serum potassium within 1 week of starting combination, then regularly. Avoid in patients with GFR <30 or baseline K >5.0.",
    mechanism: "Additive potassium-retaining effects",
    onset: "Days to weeks",
    severityScore: 7,
    references: ["KDIGO Guidelines", "UpToDate"],
    source: "knowledge_base"
  },
  {
    drug1: "Metoprolol",
    drug2: "Diltiazem",
    severity: "major",
    description: "Concomitant use of beta-blockers and non-dihydropyridine calcium channel blockers increases risk of bradycardia, AV block, and heart failure.",
    clinicalEffects: ["Severe bradycardia", "AV block", "Hypotension", "Heart failure exacerbation"],
    management: "Monitor heart rate and ECG closely. Avoid in patients with AV conduction abnormalities or systolic dysfunction. Consider alternative combinations.",
    mechanism: "Additive negative chronotropic and inotropic effects",
    onset: "Hours to days",
    severityScore: 7,
    references: ["ACC/AHA Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Atorvastatin",
    drug2: "Clarithromycin",
    severity: "contraindicated",
    description: "Strong CYP3A4 inhibitors dramatically increase atorvastatin exposure, significantly increasing risk of myopathy and rhabdomyolysis.",
    clinicalEffects: ["Myopathy", "Rhabdomyolysis", "Acute kidney injury", "Elevated CK"],
    management: "CONTRAINDICATED. Suspend atorvastatin during clarithromycin therapy. Use alternative antibiotic or temporarily discontinue statin.",
    mechanism: "CYP3A4 inhibition",
    onset: "Days",
    severityScore: 10,
    references: ["FDA Drug Safety Communication", "AHA Guidelines"],
    source: "knowledge_base"
  },
  {
    drug1: "Simvastatin",
    drug2: "Amlodipine",
    severity: "major",
    description: "Amlodipine inhibits CYP3A4, increasing simvastatin exposure and risk of myopathy.",
    clinicalEffects: ["Myopathy", "Rhabdomyolysis", "Muscle pain"],
    management: "Limit simvastatin dose to 20mg daily when used with amlodipine. Consider alternative statin like pravastatin or rosuvastatin.",
    mechanism: "CYP3A4 inhibition",
    onset: "Weeks",
    severityScore: 7,
    references: ["FDA Prescribing Information", "AHA Guidelines"],
    source: "knowledge_base"
  },
  
  // ANTIDIABETIC INTERACTIONS
  {
    drug1: "Metformin",
    drug2: "Cephalexin",
    severity: "major",
    description: "Certain cephalosporins can increase metformin levels and rarely cause lactic acidosis, especially with renal impairment.",
    clinicalEffects: ["Lactic acidosis", "Hypoglycemia", "GI upset"],
    management: "Monitor renal function. Watch for symptoms of lactic acidosis. Consider alternative antibiotic if renal function impaired.",
    mechanism: "Competition for renal tubular secretion",
    onset: "Days",
    severityScore: 7,
    references: ["ADA Standards of Care", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Metformin",
    drug2: "Furosemide",
    severity: "moderate",
    description: "Furosemide can increase metformin plasma concentrations, potentially increasing risk of lactic acidosis.",
    clinicalEffects: ["Increased metformin levels", "Potential lactic acidosis in renal impairment"],
    management: "Monitor renal function. Adjust metformin dose if needed. Watch for lactic acidosis symptoms.",
    mechanism: "Pharmacokinetic interaction",
    onset: "Variable",
    severityScore: 5,
    references: ["ADA Standards", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Insulin",
    drug2: "Beta-blocker",
    severity: "moderate",
    description: "Beta-blockers may mask symptoms of hypoglycemia (tachycardia, tremor) and impair recovery from hypoglycemia.",
    clinicalEffects: ["Masked hypoglycemia symptoms", "Prolonged hypoglycemia", "Sweating may still occur"],
    management: "Educate patient about altered hypoglycemia symptoms. Monitor glucose more frequently. Prefer cardioselective beta-blockers.",
    mechanism: "Beta-adrenergic blockade masks counterregulatory responses",
    onset: "Continuous",
    severityScore: 6,
    references: ["ADA Standards of Care", "Endocrine Society Guidelines"],
    source: "knowledge_base"
  },
  {
    drug1: "Glipizide",
    drug2: "Fluconazole",
    severity: "major",
    description: "Fluconazole inhibits CYP2C9, increasing sulfonylurea levels and risk of hypoglycemia.",
    clinicalEffects: ["Severe hypoglycemia", "Neuroglycopenic symptoms"],
    management: "Reduce glipizide dose by 50% when starting fluconazole. Monitor glucose closely. Consider alternative antifungal.",
    mechanism: "CYP2C9 inhibition",
    onset: "Days",
    severityScore: 7,
    references: ["ADA Standards", "IDSA Guidelines"],
    source: "knowledge_base"
  },
  
  // CNS INTERACTIONS
  {
    drug1: "Sertraline",
    drug2: "Tramadol",
    severity: "major",
    description: "Concomitant use increases risk of serotonin syndrome and seizures.",
    clinicalEffects: ["Serotonin syndrome", "Seizures", "Confusion", "Hyperthermia"],
    management: "Use with caution. Start with low doses. Monitor for serotonin syndrome symptoms. Consider alternative pain management.",
    mechanism: "Additive serotonergic effects",
    onset: "Hours to days",
    severityScore: 8,
    references: ["APA Guidelines", "FDA Drug Safety Communication"],
    source: "knowledge_base"
  },
  {
    drug1: "Fluoxetine",
    drug2: "Codeine",
    severity: "major",
    description: "CYP2D6 inhibition reduces conversion of codeine to morphine, decreasing analgesic effect. Risk of serotonin syndrome also exists.",
    clinicalEffects: ["Reduced analgesia", "Serotonin syndrome", "Opioid toxicity (in ultra-rapid metabolizers)"],
    management: "Consider alternative analgesic. If codeine used, monitor for efficacy and serotonin syndrome. Avoid in ultra-rapid CYP2D6 metabolizers.",
    mechanism: "CYP2D6 inhibition + serotonergic effects",
    onset: "Variable",
    severityScore: 7,
    references: ["CPIC Guidelines", "FDA Drug Safety"],
    source: "knowledge_base"
  },
  {
    drug1: "Phenytoin",
    drug2: "Warfarin",
    severity: "major",
    description: "Complex interaction - phenytoin can both increase and decrease warfarin effect through different mechanisms. Close monitoring essential.",
    clinicalEffects: ["Unpredictable INR", "Bleeding or clotting risk"],
    management: "Monitor INR frequently, especially when starting/stopping phenytoin. Warfarin dose adjustments may be needed in both directions.",
    mechanism: "CYP2C9 competition + enzyme induction",
    onset: "Days to weeks",
    severityScore: 8,
    references: ["Epilepsy Guidelines", "ACCP Guidelines"],
    source: "knowledge_base"
  },
  {
    drug1: "Carbamazepine",
    drug2: "Erythromycin",
    severity: "major",
    description: "Erythromycin inhibits carbamazepine metabolism, potentially causing toxicity.",
    clinicalEffects: ["Carbamazepine toxicity", "Dizziness", "Ataxia", "Nausea", "Diplopia"],
    management: "Avoid combination. Use alternative antibiotic. If combined, reduce carbamazepine dose and monitor levels.",
    mechanism: "CYP3A4 inhibition",
    onset: "Days",
    severityScore: 8,
    references: ["Epilepsy Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  
  // ANTIBIOTIC INTERACTIONS
  {
    drug1: "Ciprofloxacin",
    drug2: "Theophylline",
    severity: "major",
    description: "Fluoroquinolones inhibit theophylline metabolism, potentially causing theophylline toxicity.",
    clinicalEffects: ["Theophylline toxicity", "Tachycardia", "Arrhythmias", "Seizures"],
    management: "Monitor theophylline levels. Reduce dose by 30-50%. Watch for toxicity symptoms.",
    mechanism: "CYP1A2 inhibition",
    onset: "Days",
    severityScore: 8,
    references: ["GINA Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Azithromycin",
    drug2: "Warfarin",
    severity: "moderate",
    description: "May enhance anticoagulant effect of warfarin through unclear mechanisms.",
    clinicalEffects: ["Increased INR", "Bleeding"],
    management: "Monitor INR within 3 days of starting azithromycin and after discontinuation. Adjust warfarin dose if needed.",
    mechanism: "Possibly CYP inhibition or gut flora effects",
    onset: "Days",
    severityScore: 6,
    references: ["ACCP Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Trimethoprim-Sulfamethoxazole",
    drug2: "Methotrexate",
    severity: "contraindicated",
    description: "TMP-SMX increases methotrexate toxicity through multiple mechanisms including displacement from protein binding and impaired renal clearance.",
    clinicalEffects: ["Severe myelosuppression", "Mucositis", "Hepatotoxicity", "Death"],
    management: "CONTRAINDICATED. Use alternative antibiotic. If absolutely necessary, reduce methotrexate dose significantly and monitor intensively.",
    mechanism: "Protein binding displacement + impaired renal clearance + additive antifolate effects",
    onset: "Days",
    severityScore: 10,
    references: ["Rheumatology Guidelines", "FDA Boxed Warning"],
    source: "knowledge_base"
  },
  
  // IMMUNOSUPPRESSANT INTERACTIONS
  {
    drug1: "Cyclosporine",
    drug2: "Grapefruit",
    severity: "major",
    description: "Grapefruit juice inhibits CYP3A4 in gut wall, significantly increasing cyclosporine absorption.",
    clinicalEffects: ["Increased cyclosporine levels", "Nephrotoxicity", "Hypertension", "Neurotoxicity"],
    management: "Avoid grapefruit juice entirely. Monitor cyclosporine levels. Educate patient about food interactions.",
    mechanism: "CYP3A4 inhibition in gut wall",
    onset: "Hours",
    severityScore: 8,
    references: ["Transplant Guidelines", "FDA Information"],
    source: "knowledge_base"
  },
  {
    drug1: "Tacrolimus",
    drug2: "Clarithromycin",
    severity: "major",
    description: "Strong CYP3A4 inhibitor dramatically increases tacrolimus levels, risking nephrotoxicity and neurotoxicity.",
    clinicalEffects: ["Tacrolimus toxicity", "Nephrotoxicity", "Neurotoxicity", "Diabetes"],
    management: "Reduce tacrolimus dose by 50% or more. Monitor levels frequently. Consider alternative antibiotic.",
    mechanism: "CYP3A4 inhibition",
    onset: "Days",
    severityScore: 9,
    references: ["Transplant Guidelines", "AST Guidelines"],
    source: "knowledge_base"
  },
  
  // THYROID INTERACTIONS
  {
    drug1: "Levothyroxine",
    drug2: "Calcium",
    severity: "moderate",
    description: "Calcium supplements can reduce levothyroxine absorption when taken together.",
    clinicalEffects: ["Reduced levothyroxine efficacy", "Hypothyroid symptoms"],
    management: "Separate administration by at least 4 hours. Monitor thyroid function tests. Consistent timing is key.",
    mechanism: "Reduced GI absorption due to chelation",
    onset: "Weeks",
    severityScore: 5,
    references: ["ATA Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Levothyroxine",
    drug2: "Omeprazole",
    severity: "moderate",
    description: "PPIs reduce gastric acid which may decrease levothyroxine absorption.",
    clinicalEffects: ["Reduced levothyroxine efficacy", "Elevated TSH"],
    management: "Monitor thyroid function. May need to increase levothyroxine dose. Take on empty stomach.",
    mechanism: "Reduced gastric acid impairs absorption",
    onset: "Weeks",
    severityScore: 5,
    references: ["ATA Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  
  // DIURETIC INTERACTIONS
  {
    drug1: "Furosemide",
    drug2: "Gentamicin",
    severity: "major",
    description: "Loop diuretics and aminoglycosides have additive ototoxicity and nephrotoxicity risks.",
    clinicalEffects: ["Ototoxicity", "Nephrotoxicity", "Electrolyte disturbances"],
    management: "Monitor renal function and hearing. Use lowest effective doses. Consider alternative diuretic timing.",
    mechanism: "Additive toxicities",
    onset: "Variable",
    severityScore: 7,
    references: ["KDIGO Guidelines", "Lexicomp"],
    source: "knowledge_base"
  },
  {
    drug1: "Hydrochlorothiazide",
    drug2: "Digoxin",
    severity: "moderate",
    description: "Thiazide-induced hypokalemia increases risk of digoxin toxicity.",
    clinicalEffects: ["Digoxin toxicity", "Arrhythmias", "Hypokalemia"],
    management: "Monitor potassium and digoxin levels. Maintain K >3.5 mEq/L. Consider potassium supplementation.",
    mechanism: "Hypokalemia sensitizes myocardium to digoxin",
    onset: "Days to weeks",
    severityScore: 6,
    references: ["AHA Guidelines", "Lexicomp"],
    source: "knowledge_base"
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
    const { medications, patientId } = body as { medications: Medication[]; patientId?: string };

    if (!medications || medications.length < 1) {
      return NextResponse.json({
        success: false,
        error: "At least 1 medication is required for interaction checking",
      });
    }

    const drugNames = medications.map((m) => m.name.toLowerCase().trim());
    const foundInteractions: DrugInteraction[] = [];
    const checkedPairs: Set<string> = new Set();

    // Check for interactions between all pairs from knowledge base
    for (let i = 0; i < drugNames.length; i++) {
      for (let j = i + 1; j < drugNames.length; j++) {
        const pairKey = [drugNames[i], drugNames[j]].sort().join('-');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Find interaction in knowledge base
        const interaction = DRUG_INTERACTION_KB.find(
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

    // Also check database for additional interactions
    try {
      for (let i = 0; i < drugNames.length; i++) {
        for (let j = i + 1; j < drugNames.length; j++) {
          const dbInteraction = await db.drugInteractionKnowledge.findFirst({
            where: {
              OR: [
                {
                  AND: [
                    { drug1Name: { equals: drugNames[i] } },
                    { drug2Name: { equals: drugNames[j] } }
                  ]
                },
                {
                  AND: [
                    { drug1Name: { equals: drugNames[j] } },
                    { drug2Name: { equals: drugNames[i] } }
                  ]
                }
              ],
              isActive: true
            }
          });

          if (dbInteraction && !foundInteractions.some(
            interaction => (interaction.drug1.toLowerCase() === drugNames[i] && interaction.drug2.toLowerCase() === drugNames[j]) ||
                 (interaction.drug1.toLowerCase() === drugNames[j] && interaction.drug2.toLowerCase() === drugNames[i])
          )) {
            foundInteractions.push({
              drug1: dbInteraction.drug1Name,
              drug2: dbInteraction.drug2Name,
              severity: dbInteraction.severity as "major" | "moderate" | "minor",
              description: dbInteraction.description || 'Drug interaction detected',
              clinicalEffects: dbInteraction.clinicalEffects?.split(', ') || [],
              management: dbInteraction.management || 'Consult clinical pharmacist',
              mechanism: dbInteraction.mechanism || undefined,
              references: dbInteraction.literatureRef?.split(', ') || [],
              source: 'database'
            });
          }
        }
      }
    } catch (dbError) {
      console.warn('[Drug Interaction] Database lookup failed:', dbError);
      // Continue with knowledge base results
    }

    // If we have medications but no interactions found, use AI for comprehensive analysis
    if (medications.length >= 2) {
      const zai = await ZAI.create();

      const systemPrompt = `You are a clinical pharmacist AI assistant specializing in drug interactions.
Analyze the provided medications for potential interactions.
Provide information in a structured format including:
- Severity level (contraindicated/major/moderate/minor)
- Description of the interaction
- Clinical effects
- Management recommendations
- Mechanism if known
- References if available

If no significant interactions are found, state that clearly.
Focus on clinically significant interactions. Consider patient safety as the top priority.`;

      const userPrompt = `Check for drug interactions between these medications:
${medications.map((m) => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}${m.route ? ` (${m.route})` : ''}`).join("\n")}

${foundInteractions.length > 0 ? `Already found these interactions:\n${foundInteractions.map(i => `- ${i.drug1} + ${i.drug2}: ${i.severity}`).join("\n")}\n\nPlease check for any ADDITIONAL interactions not listed above.` : ''}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      });

      const aiAnalysis = completion?.choices?.[0]?.message?.content || 
        'AI analysis unavailable - please consult clinical pharmacist for comprehensive review.';

      // Generate clinical summary
      const summary = {
        total: foundInteractions.length,
        contraindicated: foundInteractions.filter((i) => i.severity === "contraindicated").length,
        major: foundInteractions.filter((i) => i.severity === "major").length,
        moderate: foundInteractions.filter((i) => i.severity === "moderate").length,
        minor: foundInteractions.filter((i) => i.severity === "minor").length,
        highestSeverity: foundInteractions.length > 0 
          ? foundInteractions.reduce((max, i) => {
              const severityOrder = { contraindicated: 4, major: 3, moderate: 2, minor: 1 };
              return severityOrder[i.severity] > severityOrder[max.severity] ? i : max;
            }).severity
          : 'none',
        requiresImmediateAttention: foundInteractions.some(i => 
          i.severity === 'contraindicated' || i.severity === 'major'
        )
      };

      // Log the interaction check for audit
      if (patientId) {
        try {
          await db.auditLog.create({
            data: {
              actorId: user.employeeId,
              actorName: user.name,
              actorRole: user.role,
              actionType: 'DRUG_INTERACTION_CHECK',
              resourceType: 'Patient',
              resourceId: patientId,
              metadata: JSON.stringify({ 
                action: `Checked ${medications.length} medications: ${medications.map(m => m.name).join(', ')}. Found ${foundInteractions.length} interactions.` 
              }),
              outcome: summary.requiresImmediateAttention ? 'WARNING' : 'SUCCESS',
            }
          });
        } catch {
          // Audit log failure should not affect the response
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          interactions: foundInteractions,
          aiAnalysis,
          summary,
          medicationsChecked: medications,
          checkedAt: new Date().toISOString(),
          checkedBy: user.employeeId,
          clinicalRecommendation: summary.requiresImmediateAttention
            ? 'IMMEDIATE ATTENTION REQUIRED: One or more significant drug interactions detected. Review and consider alternatives.'
            : foundInteractions.length > 0
              ? 'Drug interactions detected. Review management recommendations.'
              : 'No significant drug interactions detected.',
        },
      });
    }

    // Single medication - just return info
    return NextResponse.json({
      success: true,
      data: {
        interactions: [],
        summary: { total: 0, contraindicated: 0, major: 0, moderate: 0, minor: 0, highestSeverity: 'none', requiresImmediateAttention: false },
        medicationsChecked: medications,
        checkedAt: new Date().toISOString(),
        checkedBy: user.employeeId,
        clinicalRecommendation: 'Single medication provided. No interaction checking needed.',
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

  // Count interactions by severity
  const severityCounts = {
    contraindicated: DRUG_INTERACTION_KB.filter(i => i.severity === 'contraindicated').length,
    major: DRUG_INTERACTION_KB.filter(i => i.severity === 'major').length,
    moderate: DRUG_INTERACTION_KB.filter(i => i.severity === 'moderate').length,
    minor: DRUG_INTERACTION_KB.filter(i => i.severity === 'minor').length,
  };

  // Get unique drugs in knowledge base
  const uniqueDrugs = new Set<string>();
  DRUG_INTERACTION_KB.forEach(i => {
    uniqueDrugs.add(i.drug1);
    uniqueDrugs.add(i.drug2);
  });

  return NextResponse.json({
    status: "Drug Interaction Checker API is running",
    knowledgeBase: {
      totalInteractions: DRUG_INTERACTION_KB.length,
      uniqueDrugs: uniqueDrugs.size,
      severityBreakdown: severityCounts,
      lastUpdated: "2024-01",
      sources: ["FDA Guidelines", "Clinical Guidelines", "Lexicomp", "UpToDate"]
    },
    features: [
      "Drug-drug interactions",
      "Severity classification (contraindicated/major/moderate/minor)",
      "Clinical management recommendations",
      "Mechanism of interaction",
      "Onset timing",
      "AI-powered analysis for unknown combinations",
      "Database-backed knowledge storage",
      "Audit trail for HIPAA compliance"
    ],
    drugCategories: {
      anticoagulants: ["Warfarin", "Dabigatran", "Apixaban", "Rivaroxaban"],
      cardiovascular: ["Lisinopril", "Metoprolol", "Atorvastatin", "Simvastatin", "Diltiazem"],
      antidiabetic: ["Metformin", "Glipizide", "Insulin"],
      cns: ["Sertraline", "Fluoxetine", "Phenytoin", "Carbamazepine"],
      antibiotics: ["Ciprofloxacin", "Azithromycin", "Trimethoprim-Sulfamethoxazole"],
      immunosuppressants: ["Cyclosporine", "Tacrolimus"],
    }
  });
}
