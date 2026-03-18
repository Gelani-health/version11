/**
 * ICD Codes API
 * Search and retrieve ICD codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/icd-codes - Search ICD codes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const code = searchParams.get('code');
    const category = searchParams.get('category');
    const isICD11 = searchParams.get('isICD11');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};

    if (code) {
      // Exact code match
      where.code = { contains: code.toUpperCase() };
    } else if (search) {
      // Search in code or description
      where.OR = [
        { code: { contains: search.toUpperCase() } },
        { description: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (isICD11 !== null) {
      where.isICD11 = isICD11 === 'true';
    }

    const icdCodes = await db.iCDCode.findMany({
      where,
      orderBy: [
        { code: 'asc' },
      ],
      take: limit,
    });

    return NextResponse.json({ success: true, data: icdCodes });
  } catch (error) {
    console.error('Error fetching ICD codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ICD codes' },
      { status: 500 }
    );
  }
}

// POST /api/icd-codes - Create ICD code (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, description, category, chapter, isICD11 } = body;

    if (!code || !description) {
      return NextResponse.json(
        { success: false, error: 'Code and description are required' },
        { status: 400 }
      );
    }

    // Check for existing code
    const existingCode = await db.iCDCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'ICD code already exists' },
        { status: 400 }
      );
    }

    const icdCode = await db.iCDCode.create({
      data: {
        code: code.toUpperCase(),
        description,
        category,
        chapter,
        isICD11: isICD11 || false,
      },
    });

    return NextResponse.json({ success: true, data: icdCode }, { status: 201 });
  } catch (error) {
    console.error('Error creating ICD code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create ICD code' },
      { status: 500 }
    );
  }
}
