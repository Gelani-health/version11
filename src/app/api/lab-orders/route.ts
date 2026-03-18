import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/lab-orders - Get lab orders with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const labOrders = await db.labOrder.findMany({
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
        orderItems: true,
      },
      orderBy: { orderDate: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: labOrders,
    });
  } catch (error) {
    console.error("Error fetching lab orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lab orders" },
      { status: 500 }
    );
  }
}

// POST /api/lab-orders - Create a new lab order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      consultationId,
      priority,
      clinicalNotes,
      diagnosis,
      orderedBy,
      department,
      tests,
    } = body;

    if (!patientId || !tests || tests.length === 0) {
      return NextResponse.json(
        { success: false, error: "Patient ID and at least one test are required" },
        { status: 400 }
      );
    }

    // Generate order number
    const year = new Date().getFullYear();
    const count = await db.labOrder.count();
    const orderNumber = `LAB-${year}-${String(count + 1).padStart(4, "0")}`;

    // Create order with items
    const labOrder = await db.labOrder.create({
      data: {
        patientId,
        consultationId,
        orderNumber,
        priority: priority || "routine",
        clinicalNotes,
        diagnosis,
        orderedBy,
        department,
        orderItems: {
          create: tests.map((test: {
            testName: string;
            testCode?: string;
            category?: string;
            subcategory?: string;
            unit?: string;
            referenceRange?: string;
          }) => ({
            testName: test.testName,
            testCode: test.testCode,
            category: test.category,
            subcategory: test.subcategory,
            unit: test.unit,
            referenceRange: test.referenceRange,
            status: "pending",
          })),
        },
      },
      include: {
        orderItems: true,
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

    return NextResponse.json({
      success: true,
      data: labOrder,
      message: `Lab order ${orderNumber} created successfully`,
    });
  } catch (error) {
    console.error("Error creating lab order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create lab order" },
      { status: 500 }
    );
  }
}

// PUT /api/lab-orders - Update lab order or item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, itemId, action, data } = body;

    // Update order status
    if (action === "updateOrder" && orderId) {
      const order = await db.labOrder.update({
        where: { id: orderId },
        data: {
          status: data.status,
          sampleCollected: data.sampleCollected,
          collectedAt: data.collectedAt,
          collectedBy: data.collectedBy,
        },
      });
      return NextResponse.json({ success: true, data: order });
    }

    // Update item result (for lab technician)
    if (action === "updateItemResult" && itemId) {
      const item = await db.labOrderItem.update({
        where: { id: itemId },
        data: {
          resultValue: data.resultValue,
          interpretation: data.interpretation,
          resultNotes: data.resultNotes,
          status: data.status || "completed",
          resultEnteredAt: new Date(),
          enteredBy: data.enteredBy,
        },
      });

      // Check if all items are completed
      const allItems = await db.labOrderItem.findMany({
        where: { orderId: item.orderId },
      });
      const allCompleted = allItems.every(i => i.status === "completed");
      
      if (allCompleted) {
        await db.labOrder.update({
          where: { id: item.orderId },
          data: { status: "completed" },
        });
      }

      return NextResponse.json({ success: true, data: item });
    }

    // Collect sample
    if (action === "collectSample" && orderId) {
      const order = await db.labOrder.update({
        where: { id: orderId },
        data: {
          sampleCollected: true,
          collectedAt: new Date(),
          collectedBy: data.collectedBy,
          status: "collected",
        },
      });

      // Update all items to collected
      await db.labOrderItem.updateMany({
        where: { orderId },
        data: { status: "collected" },
      });

      return NextResponse.json({ success: true, data: order });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating lab order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lab order" },
      { status: 500 }
    );
  }
}

// DELETE /api/lab-orders - Cancel lab order
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    const order = await db.labOrder.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });

    return NextResponse.json({
      success: true,
      data: order,
      message: "Lab order cancelled",
    });
  } catch (error) {
    console.error("Error cancelling lab order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel lab order" },
      { status: 500 }
    );
  }
}
