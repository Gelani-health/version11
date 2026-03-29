import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/lab-results - Get lab results with optional filters
export async function GET(request: NextRequest) {
  // Authenticate the request
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check if user has permission to view lab results
  if (!user.permissions.includes('lab:read')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to view lab results" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const consultationId = searchParams.get("consultationId");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    
    if (patientId) where.patientId = patientId;
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

    // Audit log for PHI access
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | GET /api/lab-results | Patient: ${patientId || 'all'}`);

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
  // Authenticate the request
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check if user has permission to enter lab results
  // Only lab workers and admins can enter results
  if (!user.permissions.includes('lab:result_entry')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to enter lab results. This action is restricted to Lab Workers and Administrators." },
      { status: 403 }
    );
  }

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
      orderId,
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

    // Critical value detection
    let isCritical = false;
    if (autoInterpretation === "abnormal") {
      // Check for critical values based on common critical value thresholds
      const numericValue = parseFloat(resultValue);
      const testUpper = testName.toUpperCase();
      
      // Critical value thresholds (common medical critical values)
      const criticalThresholds: Record<string, { low?: number; high?: number }> = {
        'POTASSIUM': { low: 2.5, high: 6.5 },
        'SODIUM': { low: 120, high: 160 },
        'GLUCOSE': { low: 40, high: 500 },
        'HEMOGLOBIN': { low: 7, high: 20 },
        'PLATELET': { low: 20, high: 1000 },
        'WBC': { low: 2, high: 50 },
        'CREATININE': { high: 10 },
        'TROPONIN': { high: 0.5 },
      };

      for (const [key, thresholds] of Object.entries(criticalThresholds)) {
        if (testUpper.includes(key)) {
          if (!isNaN(numericValue)) {
            if (thresholds.low && numericValue < thresholds.low) isCritical = true;
            if (thresholds.high && numericValue > thresholds.high) isCritical = true;
          }
          break;
        }
      }

      if (isCritical) {
        autoInterpretation = "critical";
      }
    }

    const labResult = await db.labResult.create({
      data: {
        patientId,
        orderId,
        testName,
        testCode: testCode || null,
        category: category || "blood",
        resultValue,
        unit: unit || null,
        referenceRange: referenceRange || null,
        interpretation: autoInterpretation || "pending",
        orderedDate: orderedDate ? new Date(orderedDate) : new Date(),
        resultDate: resultDate ? new Date(resultDate) : new Date(),
        aiAlertFlag: autoInterpretation === "abnormal" || autoInterpretation === "critical",
        enteredBy: user.employeeId,
      },
    });

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | POST /api/lab-results | Test: ${testName} | Result: ${resultValue} | Patient: ${patientId} | Critical: ${isCritical}`);

    // If critical value, log alert
    if (isCritical) {
      console.log(`[CRITICAL ALERT] ${new Date().toISOString()} | Critical lab value detected | Test: ${testName} | Value: ${resultValue} | Patient: ${patientId} | Entered by: ${user.employeeId}`);
    }

    return NextResponse.json({
      success: true,
      data: labResult,
      message: "Lab result created successfully",
      criticalAlert: isCritical,
    });
  } catch (error) {
    console.error("Error creating lab result:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create lab result" },
      { status: 500 }
    );
  }
}
