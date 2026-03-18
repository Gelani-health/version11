import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const zai = await ZAI.create();
    
    const imageDir = './upload';
    const images = [
      'WhatsApp Image 2026-03-16 at 01.33.44.jpeg',
      'pasted_image_1773077792879.png',
      'pasted_image_1773078510179.png',
      'pasted_image_1773078954409.png',
      'pasted_image_1773080121025.png',
      'pasted_image_1773234543148.png',
      'pasted_image_1773301442429.png'
    ];

    const prompt = `Analyze this Patient Registration form in detail. 

List ALL fields visible on this form including:
1. Personal Information fields (name, DOB, gender, etc.)
2. Contact Information fields
3. Address fields  
4. Medical Information fields
5. Emergency Contact fields
6. Insurance fields
7. Any other fields visible

For each field, specify:
- Field label/name
- Whether it's required or optional
- The section it belongs to

Be comprehensive and list every single field you can see.`;

    for (const img of images) {
      const fullPath = path.join(imageDir, img);
      if (fs.existsSync(fullPath)) {
        console.log(`\n=== Analyzing: ${img} ===\n`);
        
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Image = imageBuffer.toString('base64');
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = ext === '.jpeg' || ext === '.jpg' ? 'image/jpeg' : 'image/png';

        try {
          const response = await zai.chat.completions.create({
            model: 'glm-4-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
              }
            ],
          });

          console.log(response.choices?.[0]?.message?.content);
        } catch (err: any) {
          console.log(`Error: ${err?.message || err}`);
        }
        
        console.log('\n' + '='.repeat(50));
      }
    }
  } catch (error: any) {
    console.error('Main error:', error?.message || error);
  }
}

main();
