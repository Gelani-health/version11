import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/lab-results - Get lab results with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const consultationId = searchParams.get("consultationId");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    
    if (patientId) where.patientId = patientId;
    // Note: consultationId not in schema, filter by patientId only
    if (category) where.category = category;

    const labResults = await db.labResult.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
      orderBy: { orderedDate: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: labResults,
    });
  } catch (error) {
    console.error("Error fetching lab results:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lab results" },
      { status: 500 }
    );
  }
}

// POST /api/lab-results - Create a new lab result
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      consultationId,
      testName,
      testCode,
      category,
      resultValue,
      unit,
      referenceRange,
      interpretation,
      orderedDate,
      resultDate,
    } = body;

    if (!patientId || !testName || !resultValue) {
      return NextResponse.json(
        { success: false, error: "Patient ID, test name, and result value are required" },
        { status: 400 }
      );
    }

    // Determine interpretation if not provided
    let autoInterpretation = interpretation;
    if (!interpretation && referenceRange) {
      const numericValue = parseFloat(resultValue);
      if (!isNaN(numericValue)) {
        // Parse reference range (e.g., "10-20", "< 50", "> 100")
        const rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        const lessThanMatch = referenceRange.match(/<\s*(\d+\.?\d*)/);
        const greaterThanMatch = referenceRange.match(/>\s*(\d+\.?\d*)/);
        
        if (rangeMatch) {
          const min = parseFloat(rangeMatch[1]);
          const max = parseFloat(rangeMatch[2]);
          if (numericValue < min || numericValue > max) {
            autoInterpretation = "abnormal";
          } else {
            autoInterpretation = "normal";
          }
        } else if (lessThanMatch) {
          autoInterpretation = numericValue < parseFloat(lessThanMatch[1]) ? "normal" : "abnormal";
        } else if (greaterThanMatch) {
          autoInterpretation = numericValue > parseFloat(greaterThanMatch[1]) ? "normal" : "abnormal";
        }
      }
    }

    const labResult = await db.labResult.create({
      data: {
        patientId,
        testName,
        testCode: testCode || null,
        category: category || "blood",
        resultValue,
        unit: unit || null,
        referenceRange: referenceRange || null,
        interpretation: autoInterpretation || "pending",
        orderedDate: orderedDate ? new Date(orderedDate) : new Date(),
        resultDate: resultDate ? new Date(resultDate) : null,
        aiAlertFlag: autoInterpretation === "abnormal" || autoInterpretation === "critical",
      },
    });

    return NextResponse.json({
      success: true,
      data: labResult,
      message: "Lab result created successfully",
    });
  } catch (error) {
    console.error("Error creating lab result:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create lab result" },
      { status: 500 }
    );
  }
}
