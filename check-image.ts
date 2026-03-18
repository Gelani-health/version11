import ZAI, { VisionMessage } from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

async function main(imagePath: string, prompt: string) {
  try {
    const zai = await ZAI.create();
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : (ext === '.jpeg' || ext === '.jpg') ? 'image/jpeg' : 'image/png';
    
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const messages: VisionMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ];

    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages,
      thinking: { type: 'disabled' }
    });

    const reply = response.choices?.[0]?.message?.content;
    console.log('Vision model reply:');
    console.log(reply ?? JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error('Vision chat failed:', err?.message || err);
  }
}

const imagePath = './upload/WhatsApp Image 2026-03-16 at 01.33.44.jpeg';
const prompt = `Analyze this image carefully. Describe what you see:
1. What type of image is this? (UI screenshot, design mockup, photo, etc.)
2. If it's a UI/design, describe all visible elements, components, and layout
3. List any text, labels, or data visible
4. Describe the color scheme and styling
5. Identify any issues or notable features`;

main(imagePath, prompt);
