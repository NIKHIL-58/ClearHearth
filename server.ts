import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

const ALLOWED_HEATMAP_TYPES = new Set([
  'US_AQI',
  'UAQI_RED_GREEN',
  'UAQI_INDIGO_PERSIAN',
  'PM25_INDIGO_PERSIAN',
  'IND_CPCB',
  'GBR_DEFRA',
  'DEU_UBA',
]);

function getMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaStatus(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  const upper = bodyText.toUpperCase();
  return upper.includes('RESOURCE_EXHAUSTED') || upper.includes('OVER_QUERY_LIMIT');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// Expose Maps JS key to browser client safely (GEMINI_API_KEY is never exposed)
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    mapsApiKey: getMapsApiKey(),
  });
});

// Proxy Google Maps Platform Air Quality API: currentConditions:lookup
app.post('/api/air-quality/current', async (req: Request, res: Response) => {
  const mapsKey = getMapsApiKey();
  if (!mapsKey) {
    res.status(503).json({ error: 'Google Maps API key is not configured.' });
    return;
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(mapsKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
        },
        body: JSON.stringify({
          universalAqi: true,
          location: { latitude: lat, longitude: lng },
          extraComputations: [
            'HEALTH_RECOMMENDATIONS',
            'DOMINANT_POLLUTANT_CONCENTRATION',
            'POLLUTANT_CONCENTRATION',
            'LOCAL_AQI',
            'POLLUTANT_ADDITIONAL_INFO',
          ],
          languageCode: 'en',
        }),
      }
    );

    const rawText = await upstream.text();
    if (!upstream.ok) {
      const quotaExceeded = isQuotaStatus(upstream.status, rawText);
      res.status(quotaExceeded ? 429 : upstream.status).json({
        error: quotaExceeded
          ? 'Google Maps Platform Air Quality quota reached.'
          : 'Air quality data is unavailable for this coordinate.',
        code: quotaExceeded ? 'RESOURCE_EXHAUSTED' : 'UPSTREAM_ERROR',
      });
      return;
    }

    res.type('application/json').send(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch current air quality.';
    res.status(502).json({ error: message });
  }
});

// Proxy Google Maps Platform Air Quality API: forecast:lookup (next 48h)
app.post('/api/air-quality/forecast', async (req: Request, res: Response) => {
  const mapsKey = getMapsApiKey();
  if (!mapsKey) {
    res.status(503).json({ error: 'Google Maps API key is not configured.' });
    return;
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    return;
  }

  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 47 * 60 * 60 * 1000);

  try {
    const upstream = await fetch(
      `https://airquality.googleapis.com/v1/forecast:lookup?key=${encodeURIComponent(mapsKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
        },
        body: JSON.stringify({
          universalAqi: true,
          location: { latitude: lat, longitude: lng },
          period: {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          },
          pageSize: 48,
          languageCode: 'en',
          extraComputations: ['LOCAL_AQI', 'DOMINANT_POLLUTANT_CONCENTRATION'],
        }),
      }
    );

    const rawText = await upstream.text();
    if (!upstream.ok) {
      const quotaExceeded = isQuotaStatus(upstream.status, rawText);
      res.status(quotaExceeded ? 429 : upstream.status).json({
        error: quotaExceeded
          ? 'Google Maps Platform Air Quality forecast quota reached.'
          : 'Forecast data unavailable for this location.',
        code: quotaExceeded ? 'RESOURCE_EXHAUSTED' : 'UPSTREAM_ERROR',
      });
      return;
    }

    res.type('application/json').send(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch air quality forecast.';
    res.status(502).json({ error: message });
  }
});

// Proxy Google Maps Platform Air Quality Heatmap PNG tiles
app.get('/api/air-quality/tiles/:mapType/:z/:x/:y', async (req: Request, res: Response) => {
  const mapsKey = getMapsApiKey();
  if (!mapsKey) {
    res.status(503).end();
    return;
  }

  const { mapType, z, x, y } = req.params;
  if (!ALLOWED_HEATMAP_TYPES.has(mapType)) {
    res.status(400).json({ error: 'Unsupported heatmap type.' });
    return;
  }

  const zoom = Number.parseInt(z, 10);
  const tileX = Number.parseInt(x, 10);
  const tileY = Number.parseInt(y, 10);
  const maxCoord = 1 << zoom;

  if (
    !Number.isInteger(zoom) ||
    zoom < 0 ||
    zoom > 16 ||
    !Number.isInteger(tileX) ||
    !Number.isInteger(tileY) ||
    tileX < 0 ||
    tileX >= maxCoord ||
    tileY < 0 ||
    tileY >= maxCoord
  ) {
    res.status(400).end();
    return;
  }

  try {
    const url = `https://airquality.googleapis.com/v1/mapTypes/${encodeURIComponent(mapType)}/heatmapTiles/${zoom}/${tileX}/${tileY}?key=${encodeURIComponent(mapsKey)}`;
    const upstream = await fetch(url, {
      headers: {
        'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
});

// Reverse Geocoding via Google Maps Geocoding REST API (server-side to avoid CORS and deprecated JS Geocoder)
app.get('/api/geocode/reverse', async (req: Request, res: Response) => {
  const mapsKey = getMapsApiKey();
  if (!mapsKey) {
    res.status(503).json({ error: 'Google Maps API key is not configured.' });
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'Valid lat and lng query params required.' });
    return;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=en&key=${encodeURIComponent(mapsKey)}`;
    const upstream = await fetch(url, {
      headers: {
        'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID,
      },
    });
    const data = await upstream.json();

    if (upstream.status === 429 || data?.status === 'OVER_QUERY_LIMIT') {
      res.status(429).json({ error: 'Geocoding quota reached.', code: 'RESOURCE_EXHAUSTED' });
      return;
    }

    const first = data?.results?.[0];
    if (!first) {
      res.json({
        name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        subtitle: 'Selected Coordinates',
      });
      return;
    }

    const components: Array<{ long_name: string; types: string[] }> = first.address_components || [];
    const locality =
      components.find((c) => c.types.includes('sublocality') || c.types.includes('neighborhood'))?.long_name ||
      components.find((c) => c.types.includes('locality'))?.long_name ||
      components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name;
    const city = components.find((c) => c.types.includes('locality'))?.long_name;
    const country = components.find((c) => c.types.includes('country'))?.long_name;

    const name = locality || city || first.formatted_address?.split(',')[0] || 'Selected Location';
    const subtitleParts = [city && city !== name ? city : null, country].filter(Boolean);
    res.json({
      name,
      subtitle: subtitleParts.join(', ') || first.formatted_address || 'Urban Monitoring Point',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reverse geocoding failed.';
    res.status(502).json({ error: message });
  }
});

// GenAI Structured Plan Generator (server-side @google/genai with gemini-4-hydrogen)
app.post('/api/assistant/plan', async (req: Request, res: Response) => {
  try {
    const ai = getGenAIClient();
    const { location, airQuality, forecastSummary, profile } = req.body ?? {};

    if (!location?.name || !profile) {
      res.status(400).json({ error: 'Location and household profile are required.' });
      return;
    }

    const prompt = `Create a practical, science-backed urban air quality and winter smog action plan tailored to this exact location, live telemetry, and household profile.

Location: ${location.name} (${location.subtitle || ''}) at ${location.lat}, ${location.lng}
Live Air Quality Telemetry:
${JSON.stringify(airQuality || {}, null, 2)}

48-Hour Forecast Window Summary:
${JSON.stringify(forecastSummary || {}, null, 2)}

Household & Lifestyle Profile:
- Group: ${profile.householdGroup}
- Home Type: ${profile.homeType}
- Primary Commute: ${profile.commuteMode}
- Has HEPA Air Purifier: ${profile.hasAirPurifier ? 'Yes' : 'No'}
- Cooking Fuel: ${profile.cookingFuel}

Requirements:
1. Be concrete, realistic, empathetic, and tailored to winter thermal inversions and urban smog.
2. Quantify the direct impact of every recommendation clearly (both personal exposure reduction e.g. indoor PM2.5 drop and community emission savings e.g. grams of NOx / PM2.5 / kg CO2 avoided).
3. Include budget-accessible indoor air hacks (including DIY Corsi-Rosenthal MERV-13 boxes if no purifier, wet cleaning, ventilation timing, and draft sealing).
4. Tailor sustainable alternatives to their exact commute mode and cooking fuel without judgment.
5. Keep all text concise, clear, scannable, and free of medical diagnosis claims.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an urban environmental scientist and practical family clean-air advisor specializing in winter smog inversions, indoor air quality engineering, and low-emission urban living. Provide clear, quantified, actionable guidance.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: { type: Type.STRING, description: 'Short actionable headline under 10 words for today.' },
            summary: { type: Type.STRING, description: '2-3 sentence summary explaining current air risk and top priority.' },
            bestVentilationWindow: { type: Type.STRING, description: 'Specific recommended window to air out the home or run outdoor errands based on forecast.' },
            winterSmogMechanism: { type: Type.STRING, description: '1-2 sentences explaining why the dominant pollutant spikes during winter conditions here.' },
            dailyRoutine: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeBlock: { type: Type.STRING, description: 'e.g. 07:00 - 09:30 (Morning Inversion)' },
                  title: { type: Type.STRING },
                  action: { type: Type.STRING, description: 'Specific step tailored to their household and commute.' },
                  exposureImpact: { type: Type.STRING, description: 'Direct personal exposure benefit with estimated metric.' },
                  emissionImpact: { type: Type.STRING, description: 'Direct community emission benefit with estimated metric.' },
                  category: { type: Type.STRING, description: 'One of: Commute, Ventilation, Outdoor Timing, Kitchen & Home' },
                },
                required: ['timeBlock', 'title', 'action', 'exposureImpact', 'emissionImpact', 'category'],
              },
            },
            indoorHacks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  costTier: { type: Type.STRING, description: 'Zero Cost, Low Cost ($15-$60), or Moderate ($80+)' },
                  setupTime: { type: Type.STRING, description: 'e.g. 10 min' },
                  reductionEstimate: { type: Type.STRING, description: 'e.g. 45-65% indoor PM2.5 reduction' },
                  targetPollutant: { type: Type.STRING, description: 'e.g. PM2.5 & Ultrafine Soot' },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyItWorks: { type: Type.STRING, description: 'Clear physical explanation of the direct impact.' },
                },
                required: ['title', 'costTier', 'setupTime', 'reductionEstimate', 'targetPollutant', 'steps', 'whyItWorks'],
              },
            },
            sustainableSwaps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  currentHabit: { type: Type.STRING },
                  sustainableChoice: { type: Type.STRING },
                  personalBenefit: { type: Type.STRING },
                  communityImpact: { type: Type.STRING },
                  estimatedMonthlyReduction: { type: Type.STRING, description: 'e.g. -28 kg CO2e & -42 g NOx / month' },
                },
                required: ['currentHabit', 'sustainableChoice', 'personalBenefit', 'communityImpact', 'estimatedMonthlyReduction'],
              },
            },
          },
          required: [
            'headline',
            'summary',
            'bestVentilationWindow',
            'winterSmogMechanism',
            'dailyRoutine',
            'indoorHacks',
            'sustainableSwaps',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate personalized air plan.';
    res.status(500).json({ error: message });
  }
});

// GenAI Conversational Smog Advisor
app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  try {
    const ai = getGenAIClient();
    const { messages, location, airQuality, forecastSummary, profile } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    const contextBlock = `Current Live Context:
- Location: ${location?.name || 'Unknown'} (${location?.subtitle || ''})
- Current AQI: ${JSON.stringify(airQuality?.indexes || [])}
- Pollutants: ${JSON.stringify((airQuality?.pollutants || []).map((p: { displayName: string; concentration?: { value: number; units: string } }) => `${p.displayName}: ${p.concentration?.value ?? 'n/a'} ${p.concentration?.units ?? ''}`))}
- Forecast Window: ${JSON.stringify(forecastSummary || {})}
- Household Profile: ${JSON.stringify(profile || {})}`;

    const historyText = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `${contextBlock}\n\nConversation:\n${historyText}\n\nProvide a concise, practical, science-backed reply directly answering the user's latest question, clearly noting the direct exposure or emission impact of their choice.`,
      config: {
        systemInstruction:
          'You are ClearHearth, an urban air quality and winter smog advisor for families and communities. Ground every answer in the live AQI, pollutant concentrations, and household profile provided. Use clear formatting with short paragraphs or bullet points, plain everyday language, and quantified direct impact. Remind users to consult a clinician for medical symptoms without sounding robotic.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({
      reply: (response.text ?? 'I could not generate a response right now. Please try again.').trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach air quality assistant.';
    res.status(500).json({ error: message });
  }
});

// GenAI Shareable Neighborhood Smog Action Brief
app.post('/api/assistant/community-brief', async (req: Request, res: Response) => {
  try {
    const ai = getGenAIClient();
    const { location, airQuality, simulatedImpact, householdsCount } = req.body ?? {};

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Write a crisp, encouraging 140-word neighborhood bulletin for residents in ${location?.name || 'our neighborhood'} during winter smog conditions.
Live AQI context: ${JSON.stringify(airQuality?.indexes?.[0] || {})}
If ${householdsCount || 100} local families adopt our modeled clean-air habits, the community avoids approximately ${simulatedImpact?.co2Kg ?? 0} kg CO2e, ${simulatedImpact?.noxGrams ?? 0} g NOx, and ${simulatedImpact?.pm25Grams ?? 0} g PM2.5 per month while cutting indoor PM2.5 exposure by ~${simulatedImpact?.indoorReductionPct ?? 0}%.
Include 3 concrete collective winter habits neighbors can share via building chat or school groups. Keep tone practical, civic, and non-preachy.`,
      config: {
        systemInstruction: 'You write concise, practical community clean-air bulletins for neighborhood groups and parent associations.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({
      brief: (response.text ?? '').trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to draft neighborhood brief.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClearHearth server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
