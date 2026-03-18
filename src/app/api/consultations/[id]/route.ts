import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const consultation = await db.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
        diagnoses: true,
        medications: true,
        documents: true,
        aiInteractions: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json(
        { success: false, error: "Consultation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: consultation,
    });
  } catch (error) {
    console.error("Get Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch consultation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const consultation = await db.consultation.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: consultation,
      message: "Consultation updated successfully",
    });
  } catch (error) {
    console.error("Update Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update consultation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.consultation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Consultation deleted successfully",
    });
  } catch (error) {
    console.error("Delete Consultation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete consultation" },
      { status: 500 }
    );
  }
}
