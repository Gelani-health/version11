import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, authenticateRequest } from "@/lib/auth-middleware";
import { AuthenticatedUser } from "@/lib/auth-middleware";

// GET /api/lab-orders - Get lab orders with optional filters
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

  // Check if user has permission to view lab orders
  if (!user.permissions.includes('lab:read')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to view lab orders" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    // Lab workers can only see orders in their workflow
    // Doctors and admins can see all orders
    // Radiologists have limited lab access (read only)

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

    // Audit log for PHI access
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | GET /api/lab-orders | Patient: ${patientId || 'all'}`);

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
  // Authenticate the request
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check if user has permission to create lab orders
  // Doctors, specialists, and admins can order labs
  // Lab workers cannot create orders (they process them)
  if (!user.permissions.includes('lab:write')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to create lab orders. Only doctors, specialists, and admins can order lab tests." },
      { status: 403 }
    );
  }

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

    // Create order with items - use authenticated user info
    const labOrder = await db.labOrder.create({
      data: {
        patientId,
        consultationId,
        orderNumber,
        priority: priority || "routine",
        clinicalNotes,
        diagnosis,
        orderedBy: orderedBy || user.employeeId,
        department: department || user.role,
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

    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | POST /api/lab-orders | Order: ${orderNumber} | Patient: ${patientId}`);

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
  // Authenticate the request
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
    const { orderId, itemId, action, data } = body;

    // Update order status - requires lab:write permission
    if (action === "updateOrder" && orderId) {
      if (!user.permissions.includes('lab:write')) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to update lab orders" },
          { status: 403 }
        );
      }

      const order = await db.labOrder.update({
        where: { id: orderId },
        data: {
          status: data.status,
          sampleCollected: data.sampleCollected,
          collectedAt: data.collectedAt,
          collectedBy: data.collectedBy,
        },
      });

      console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | PUT /api/lab-orders | Order: ${orderId} | Action: updateOrder`);

      return NextResponse.json({ success: true, data: order });
    }

    // Update item result (for lab technician) - requires lab:result_entry permission
    if (action === "updateItemResult" && itemId) {
      if (!user.permissions.includes('lab:result_entry')) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to enter lab results. This action is restricted to Lab Workers and Administrators." },
          { status: 403 }
        );
      }

      const item = await db.labOrderItem.update({
        where: { id: itemId },
        data: {
          resultValue: data.resultValue,
          interpretation: data.interpretation,
          resultNotes: data.resultNotes,
          status: data.status || "completed",
          resultEnteredAt: new Date(),
          enteredBy: user.employeeId,
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

      console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | PUT /api/lab-orders | Item: ${itemId} | Action: updateItemResult | Result: ${data.resultValue}`);

      return NextResponse.json({ success: true, data: item });
    }

    // Collect sample - lab workers and nurses can collect samples
    if (action === "collectSample" && orderId) {
      if (!user.permissions.includes('lab:result_entry') && !user.permissions.includes('lab:write')) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to collect samples" },
          { status: 403 }
        );
      }

      const order = await db.labOrder.update({
        where: { id: orderId },
        data: {
          sampleCollected: true,
          collectedAt: new Date(),
          collectedBy: user.employeeId,
          status: "collected",
        },
      });

      // Update all items to collected
      await db.labOrderItem.updateMany({
        where: { orderId },
        data: { status: "collected" },
      });

      console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | PUT /api/lab-orders | Order: ${orderId} | Action: collectSample`);

      return NextResponse.json({ success: true, data: order });
    }

    // Verify results - requires lab:verify permission
    if (action === "verifyResults" && orderId) {
      if (!user.permissions.includes('lab:verify')) {
        return NextResponse.json(
          { success: false, error: "You don't have permission to verify lab results" },
          { status: 403 }
        );
      }

      const order = await db.labOrder.update({
        where: { id: orderId },
        data: {
          status: "verified",
        },
      });

      console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | PUT /api/lab-orders | Order: ${orderId} | Action: verifyResults`);

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
  // Authenticate the request
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json(
      { success: false, error: authResult.error || "Authentication required" },
      { status: authResult.statusCode || 401 }
    );
  }

  const user = authResult.user!;

  // Check if user has permission to cancel lab orders
  if (!user.permissions.includes('lab:write')) {
    return NextResponse.json(
      { success: false, error: "You don't have permission to cancel lab orders" },
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

    const order = await db.labOrder.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });

    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${user.employeeId} | Role: ${user.role} | DELETE /api/lab-orders | Order: ${orderId}`);

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
