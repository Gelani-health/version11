import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereClause = {};

    if (search) {
      whereClause = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { mrn: { contains: search } },
        ],
      };
    }

    const patients = await db.patient.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { updatedAt: "desc" },
      include: {
        consultations: {
          take: 1,
          orderBy: { consultationDate: "desc" },
        },
        medications: {
          where: { status: "active" },
          take: 5,
        },
      },
    });

    const total = await db.patient.count({ where: whereClause });

    return NextResponse.json({
      success: true,
      data: {
        patients,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error("Get Patients Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      city,
      bloodType,
      allergies,
      chronicConditions,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
    } = body;

    // Generate MRN
    const mrn = `MRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const patient = await db.patient.create({
      data: {
        mrn,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        phone,
        email,
        address,
        city,
        bloodType,
        allergies: allergies ? JSON.stringify(allergies) : null,
        chronicConditions: chronicConditions ? JSON.stringify(chronicConditions) : null,
        emergencyContactName,
        emergencyContactRelation: emergencyContactRelationship,
        emergencyContactPhone,
      },
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: "Patient created successfully",
    });
  } catch (error) {
    console.error("Create Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create patient" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    // Transform date fields
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    // Stringify JSON fields
    if (updateData.allergies) {
      updateData.allergies = JSON.stringify(updateData.allergies);
    }
    if (updateData.chronicConditions) {
      updateData.chronicConditions = JSON.stringify(updateData.chronicConditions);
    }

    const patient = await db.patient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: "Patient updated successfully",
    });
  } catch (error) {
    console.error("Update Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update patient" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Patient ID required" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const patient = await db.patient.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Patient deactivated successfully",
    });
  } catch (error) {
    console.error("Delete Patient Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete patient" },
      { status: 500 }
    );
  }
}
