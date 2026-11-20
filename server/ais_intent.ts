/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ais_intent.ts
 * LLM Intent Extraction and Zilliz Filter Builder for AIS telemetry queries.
 */

import { GoogleGenAI, Type } from '@google/genai';

let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAIInstance;
}

export interface AisIntent {
  mmsi: number | null;
  vessel_name: string | null;
}

export async function extractAisIntent(prompt: string): Promise<AisIntent> {
  const ai = getGenAI();
  const systemInstruction = `You are an intent extraction engine for maritime AIS telemetry. 
Extract the maritime vessel MMSI (9-digit integer or null) and vessel name (string or null, forced to UPPERCASE) from the user prompt.
Return ONLY valid JSON with keys "mmsi" and "vessel_name". No markdown formatting, no code blocks, just raw JSON.`;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `${systemInstruction}\n\nPrompt: "${prompt}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mmsi: { type: Type.INTEGER, nullable: true },
            vessel_name: { type: Type.STRING, nullable: true }
          },
          required: ['mmsi', 'vessel_name']
        }
      }
    });

    const text = res.text?.trim() || '{}';
    // Match the first valid JSON object in case of markdown wrapping or trailing text
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleanJson);

    return {
      mmsi: typeof parsed.mmsi === 'number' ? parsed.mmsi : (parsed.mmsi ? Number(parsed.mmsi) : null),
      vessel_name: parsed.vessel_name ? String(parsed.vessel_name).trim().toUpperCase() : null
    };
  } catch (err) {
    console.warn('[extractAisIntent] Warning parsing intent (falling back to regex):', err);
    const mmsiMatch = prompt.match(/(?<!\d)(\d{9})(?!\d)/);
    const mmsi = mmsiMatch ? Number(mmsiMatch[1]) : null;
    return {
      mmsi,
      vessel_name: null
    };
  }
}

export function buildAisFilter(intent: AisIntent): string {
  // PRIORITY LOGIC: If we have the MMSI (unique ID), use it exclusively to prevent 
  // strict 'AND' matching failures due to typos/spacing in the AIS database.
  if (intent.mmsi !== null && !isNaN(intent.mmsi)) {
    return `MMSI == ${intent.mmsi}`;
  }
  
  if (intent.vessel_name) {
    return `VesselName == "${intent.vessel_name.trim().toUpperCase()}"`;
  }
  
  return "";
}

export async function runAisIntentUnitTest() {
  const testPrompts = [
    "Where is my vessel RELIANCE II",
    "RELIANCE II (MMSI: 671226100)",
    "Show me fast ships"
  ];

  console.log("=== AIS Intent Extraction & Zilliz Filter Unit Test ===");
  for (const prompt of testPrompts) {
    console.log(`\nTest Prompt: "${prompt}"`);
    const intent = await extractAisIntent(prompt);
    console.log(`Extracted Intent:`, intent);
    const filter = buildAisFilter(intent);
    console.log(`Generated Zilliz Filter: "${filter}"`);
  }
  console.log("\n=== Unit Test Complete ===");
}
