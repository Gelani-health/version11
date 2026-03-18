import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// Common lab tests with reference ranges for suggestions
const commonLabTests = [
  { name: "Hemoglobin", code: "HGB", unit: "g/dL", range: "12-16", category: "CBC" },
  { name: "Hematocrit", code: "HCT", unit: "%", range: "36-48", category: "CBC" },
  { name: "White Blood Cell Count", code: "WBC", unit: "x10^9/L", range: "4.5-11.0", category: "CBC" },
  { name: "Platelet Count", code: "PLT", unit: "x10^9/L", range: "150-400", category: "CBC" },
  { name: "Red Blood Cell Count", code: "RBC", unit: "x10^12/L", range: "4.5-5.5", category: "CBC" },
  { name: "Mean Corpuscular Volume", code: "MCV", unit: "fL", range: "80-100", category: "CBC" },
  { name: "Mean Corpuscular Hemoglobin", code: "MCH", unit: "pg", range: "27-33", category: "CBC" },
  { name: "Sodium", code: "Na", unit: "mmol/L", range: "136-145", category: "Electrolytes" },
  { name: "Potassium", code: "K", unit: "mmol/L", range: "3.5-5.0", category: "Electrolytes" },
  { name: "Chloride", code: "Cl", unit: "mmol/L", range: "98-107", category: "Electrolytes" },
  { name: "Bicarbonate", code: "HCO3", unit: "mmol/L", range: "22-29", category: "Electrolytes" },
  { name: "Blood Urea Nitrogen", code: "BUN", unit: "mg/dL", range: "7-20", category: "Renal" },
  { name: "Creatinine", code: "Cr", unit: "mg/dL", range: "0.7-1.3", category: "Renal" },
  { name: "Glucose (Fasting)", code: "FBS", unit: "mg/dL", range: "70-100", category: "Metabolic" },
  { name: "Glucose (Random)", code: "RBS", unit: "mg/dL", range: "< 140", category: "Metabolic" },
  { name: "HbA1c", code: "HbA1c", unit: "%", range: "< 5.7", category: "Metabolic" },
  { name: "Total Protein", code: "TP", unit: "g/dL", range: "6.0-8.3", category: "LFT" },
  { name: "Albumin", code: "Alb", unit: "g/dL", range: "3.5-5.0", category: "LFT" },
  { name: "Total Bilirubin", code: "TBIL", unit: "mg/dL", range: "0.1-1.2", category: "LFT" },
  { name: "Direct Bilirubin", code: "DBIL", unit: "mg/dL", range: "0.0-0.3", category: "LFT" },
  { name: "AST (SGOT)", code: "AST", unit: "U/L", range: "10-40", category: "LFT" },
  { name: "ALT (SGPT)", code: "ALT", unit: "U/L", range: "7-56", category: "LFT" },
  { name: "Alkaline Phosphatase", code: "ALP", unit: "U/L", range: "44-147", category: "LFT" },
  { name: "GGT", code: "GGT", unit: "U/L", range: "9-48", category: "LFT" },
  { name: "Total Cholesterol", code: "TC", unit: "mg/dL", range: "< 200", category: "Lipid" },
  { name: "LDL Cholesterol", code: "LDL", unit: "mg/dL", range: "< 100", category: "Lipid" },
  { name: "HDL Cholesterol", code: "HDL", unit: "mg/dL", range: "> 40", category: "Lipid" },
  { name: "Triglycerides", code: "TG", unit: "mg/dL", range: "< 150", category: "Lipid" },
  { name: "TSH", code: "TSH", unit: "mIU/L", range: "0.4-4.0", category: "Thyroid" },
  { name: "Free T4", code: "FT4", unit: "ng/dL", range: "0.8-1.8", category: "Thyroid" },
  { name: "Free T3", code: "FT3", unit: "pg/mL", range: "2.3-4.2", category: "Thyroid" },
  { name: "Uric Acid", code: "UA", unit: "mg/dL", range: "3.5-7.2", category: "Metabolic" },
  { name: "Calcium", code: "Ca", unit: "mg/dL", range: "8.5-10.5", category: "Electrolytes" },
  { name: "Magnesium", code: "Mg", unit: "mg/dL", range: "1.7-2.2", category: "Electrolytes" },
  { name: "Phosphate", code: "PO4", unit: "mg/dL", range: "2.5-4.5", category: "Electrolytes" },
  { name: "Iron", code: "Fe", unit: "mcg/dL", range: "60-170", category: "Iron Studies" },
  { name: "Ferritin", code: "Ferritin", unit: "ng/mL", range: "20-300", category: "Iron Studies" },
  { name: "Vitamin B12", code: "B12", unit: "pg/mL", range: "200-900", category: "Vitamins" },
  { name: "Vitamin D", code: "VitD", unit: "ng/mL", range: "30-100", category: "Vitamins" },
  { name: "Folate", code: "Folate", unit: "ng/mL", range: "> 3", category: "Vitamins" },
  { name: "CRP", code: "CRP", unit: "mg/L", range: "< 10", category: "Inflammatory" },
  { name: "ESR", code: "ESR", unit: "mm/hr", range: "0-20", category: "Inflammatory" },
  { name: "PT/INR", code: "INR", unit: "ratio", range: "0.9-1.1", category: "Coagulation" },
  { name: "PTT", code: "PTT", unit: "seconds", range: "25-35", category: "Coagulation" },
];

// GET /api/ai-suggestions/lab-tests - Get lab test suggestions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    
    let filteredTests = commonLabTests;
    
    if (query) {
      filteredTests = commonLabTests.filter(test => 
        test.name.toLowerCase().includes(query) ||
        test.code.toLowerCase().includes(query) ||
        test.category.toLowerCase().includes(query)
      );
    }
    
    return NextResponse.json({
      success: true,
      data: filteredTests.slice(0, 20),
    });
  } catch (error) {
    console.error("Error fetching lab suggestions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

// POST /api/ai-suggestions/clinical - Get AI-powered clinical suggestions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, text, cursorPosition } = body;

    if (!text) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // Use ZAI SDK to get context-aware suggestions (reads from .z-ai-config file)
    const zai = await ZAI.create();
    
    const prompt = `You are a medical AI assistant helping a healthcare provider write clinical notes.
    
Context: ${context || 'General consultation'}
Current text being written: "${text}"

Provide 3-5 relevant medical term suggestions or clinical phrase completions that the provider might want to use next. Return ONLY a JSON array of objects with "term" and "description" fields. No other text.

Example format:
[{"term": "blood pressure", "description": "Vital sign measurement"}, {"term": "BID", "description": "Twice daily dosing"}]`;

    const completion = await zai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content || "";

    // Parse the response to get suggestions
    let suggestions = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, return empty suggestions
      suggestions = [];
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 5),
    });
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    return NextResponse.json(
      { success: true, suggestions: [] },
      { status: 200 }
    );
  }
}
