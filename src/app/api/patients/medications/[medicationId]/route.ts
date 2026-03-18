import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  try {
    const { medicationId } = await params;

    // Soft delete by updating status to discontinued
    const medication = await db.patientMedication.update({
      where: { id: medicationId },
      data: {
        status: "discontinued",
        endDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Medication discontinued successfully",
      data: medication,
    });
  } catch (error) {
    console.error("Discontinue Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to discontinue medication" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ medicationId: string }> }
) {
  try {
    const { medicationId } = await params;
    const body = await request.json();

    const medication = await db.patientMedication.update({
      where: { id: medicationId },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: medication,
      message: "Medication updated successfully",
    });
  } catch (error) {
    console.error("Update Medication Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update medication" },
      { status: 500 }
    );
  }
}
