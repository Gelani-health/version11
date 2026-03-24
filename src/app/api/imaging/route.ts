/**
 * Imaging API Route - HIPAA Compliant
 * 
 * Imaging orders and results management with role-based access control.
 * 
 * Permissions:
 * - GET (view): imaging:read
 * - POST (order): imaging:write
 * - PUT (update): imaging:write or imaging:perform or imaging:interpret
 * - DELETE (cancel): imaging:write
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth-middleware";

// GET /api/imaging - Get imaging orders
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check imaging read permission
  if (!user.permissions.includes('imaging:read')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to view imaging orders" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get clinical orders for imaging
    const where: Record<string, unknown> = {
      orderType: 'imaging'
    };
    
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const imagingOrders = await db.clinicalOrder.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        orderer: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { orderedAt: "desc" },
      take: limit,
    });

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | GET /api/imaging | Patient: ${patientId || 'all'}`);

    return NextResponse.json({
      success: true,
      data: imagingOrders,
    });
  } catch (error) {
    console.error("Error fetching imaging orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch imaging orders" },
      { status: 500 }
    );
  }
}

// POST /api/imaging - Create imaging order
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check imaging write permission
  if (!user.permissions.includes('imaging:write')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to create imaging orders. Only doctors, specialists, radiologists, and admins can order imaging studies." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      patientId,
      soapNoteId,
      orderName,
      orderDetails,
      urgency,
      clinicalIndication,
      useContrast,
    } = body;

    if (!patientId || !orderName) {
      return NextResponse.json(
        { success: false, error: "Patient ID and order name are required" },
        { status: 400 }
      );
    }

    // Generate order number
    const orderNumber = `IMG-${Date.now().toString().slice(-8)}`;

    const imagingOrder = await db.clinicalOrder.create({
      data: {
        patientId,
        soapNoteId,
        orderType: 'imaging',
        orderName,
        orderDetails: JSON.stringify({
          clinicalIndication,
          useContrast,
          orderNumber,
        }),
        urgency: urgency || 'routine',
        status: 'pending',
        orderedBy: user.employeeId,
      },
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
    });

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | POST /api/imaging | Order: ${orderNumber} | Patient: ${patientId}`);

    return NextResponse.json({
      success: true,
      data: imagingOrder,
      message: `Imaging order ${orderNumber} created successfully`,
    });
  } catch (error) {
    console.error("Error creating imaging order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create imaging order" },
      { status: 500 }
    );
  }
}

// PUT /api/imaging - Update imaging order
export async function PUT(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  try {
    const body = await request.json();
    const { orderId, action, data } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Get existing order
    const existingOrder = await db.clinicalOrder.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: "Imaging order not found" },
        { status: 404 }
      );
    }

    // Handle different actions based on role permissions
    switch (action) {
      case 'schedule':
        if (!user.permissions.includes('imaging:write')) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to schedule imaging studies" },
            { status: 403 }
          );
        }
        return await updateOrderStatus(orderId, 'scheduled', user);

      case 'perform':
        if (!user.permissions.includes('imaging:perform') && !user.permissions.includes('imaging:write')) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to perform imaging studies" },
            { status: 403 }
          );
        }
        return await updateOrderStatus(orderId, 'in-progress', user, { performedBy: user.employeeId });

      case 'complete':
        if (!user.permissions.includes('imaging:perform') && !user.permissions.includes('imaging:write')) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to complete imaging studies" },
            { status: 403 }
          );
        }
        return await updateOrderStatus(orderId, 'completed', user);

      case 'interpret':
        if (!user.permissions.includes('imaging:interpret')) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to interpret imaging studies. This action is restricted to Radiologists and Administrators." },
            { status: 403 }
          );
        }
        return await updateOrderWithFindings(orderId, data, user);

      case 'approve':
        if (!user.permissions.includes('imaging:approve')) {
          return NextResponse.json(
            { success: false, error: "You don't have permission to approve imaging reports. This action is restricted to Radiologists and Administrators." },
            { status: 403 }
          );
        }
        return await updateOrderStatus(orderId, 'report-ready', user);

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating imaging order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update imaging order" },
      { status: 500 }
    );
  }
}

// DELETE /api/imaging - Cancel imaging order
export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  if (!user.permissions.includes('imaging:write')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to cancel imaging orders" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    const order = await db.clinicalOrder.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | DELETE /api/imaging | Order: ${orderId}`);

    return NextResponse.json({
      success: true,
      data: order,
      message: "Imaging order cancelled",
    });
  } catch (error) {
    console.error("Error cancelling imaging order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel imaging order" },
      { status: 500 }
    );
  }
}

// Helper functions
async function updateOrderStatus(
  orderId: string, 
  status: string, 
  user: { employeeId: string; role: string },
  additionalData?: Record<string, unknown>
) {
  const order = await db.clinicalOrder.update({
    where: { id: orderId },
    data: { 
      status,
      ...additionalData,
    },
  });

  console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | Update imaging status: ${status} | Order: ${orderId}`);

  return NextResponse.json({ success: true, data: order });
}

async function updateOrderWithFindings(
  orderId: string,
  data: { findings?: string; impression?: string; technique?: string },
  user: { employeeId: string; role: string }
) {
  const orderDetails = {
    findings: data.findings,
    impression: data.impression,
    technique: data.technique,
    interpretedBy: user.employeeId,
    interpretedAt: new Date().toISOString(),
  };

  const order = await db.clinicalOrder.update({
    where: { id: orderId },
    data: {
      status: 'interpreted',
      orderDetails: JSON.stringify(orderDetails),
    },
  });

  console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | Interpret imaging | Order: ${orderId}`);

  return NextResponse.json({ success: true, data: order });
}
