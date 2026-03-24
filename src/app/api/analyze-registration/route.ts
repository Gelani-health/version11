import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('ai:use')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const zai = await ZAI.create();
    
    const imageDir = path.join(process.cwd(), 'upload');
    
    // Analyze the WhatsApp image (the newest one)
    const targetImage = 'WhatsApp Image 2026-03-16 at 01.33.44.jpeg';
    const imagePath = path.join(imageDir, targetImage);
    
    if (!fs.existsSync(imagePath)) {
      return NextResponse.json({ error: 'Image not found', path: imagePath }, { status: 404 });
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this Patient Registration form image in detail. 

I need you to extract and list ALL form fields visible. This is a comparison task.

List every single field you can see including:
1. Personal Information fields (name, DOB, gender, ID numbers, etc.)
2. Contact Information fields (phone, email, etc.)
3. Address fields (street, city, region, country, etc.)
4. Medical Information fields (blood type, allergies, conditions)
5. Emergency Contact fields
6. Insurance fields
7. Any other fields visible

For each field write:
- Field name/label exactly as shown on the form
- The section it belongs to

Be comprehensive and list every single field you can see on this registration form.`;

    const response = await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
    });

    const result = response.choices?.[0]?.message?.content;
    
    return NextResponse.json({ 
      success: true, 
      image: targetImage,
      analysis: result 
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Unknown error' 
    }, { status: 500 });
  }
}
