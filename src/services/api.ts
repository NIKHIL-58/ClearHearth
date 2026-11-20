import type {
  ChatMessage,
  CurrentAirQualityResponse,
  ForecastAirQualityResponse,
  SelectedLocation,
  TailoredAirPlan,
  UserLifestyleProfile,
} from '../types/airQuality';
import type { ForecastWindowSummary } from '../utils/airQualityHelpers';

function notifyIfQuota(status: number, payload: { code?: string; error?: string }): void {
  if (
    status === 429 ||
    payload?.code === 'RESOURCE_EXHAUSTED' ||
    String(payload?.error || '').toUpperCase().includes('RESOURCE_EXHAUSTED')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export async function fetchAppConfig(): Promise<{ mapsApiKey: string }> {
  const res = await fetch('/api/config');
  if (!res.ok) {
    return { mapsApiKey: '' };
  }
  return res.json();
}

export async function fetchCurrentAirQuality(
  lat: number,
  lng: number
): Promise<CurrentAirQualityResponse> {
  const res = await fetch('/api/air-quality/current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    notifyIfQuota(res.status, data);
    throw new Error(data.error || 'Unable to load current air quality data.');
  }
  return data as CurrentAirQualityResponse;
}

export async function fetchForecastAirQuality(
  lat: number,
  lng: number
): Promise<ForecastAirQualityResponse> {
  const res = await fetch('/api/air-quality/forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    notifyIfQuota(res.status, data);
    throw new Error(data.error || 'Unable to load air quality forecast.');
  }
  return data as ForecastAirQualityResponse;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ name: string; subtitle: string }> {
  const res = await fetch(
    `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    notifyIfQuota(res.status, data);
    return {
      name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      subtitle: 'Selected Coordinates',
    };
  }
  return {
    name: data.name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    subtitle: data.subtitle || 'Monitoring Location',
  };
}

export async function generateTailoredPlan(params: {
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  forecastSummary: ForecastWindowSummary | null;
  profile: UserLifestyleProfile;
}): Promise<TailoredAirPlan> {
  const res = await fetch('/api/assistant/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not generate tailored guidance.');
  }
  return data as TailoredAirPlan;
}

export async function sendAssistantMessage(params: {
  messages: Array<{ role: ChatMessage['role']; content: string }>;
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  forecastSummary: ForecastWindowSummary | null;
  profile: UserLifestyleProfile;
}): Promise<{ reply: string }> {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not reach the assistant.');
  }
  return data as { reply: string };
}

export async function generateCommunityBrief(params: {
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  simulatedImpact: {
    co2Kg: number;
    noxGrams: number;
    pm25Grams: number;
    indoorReductionPct: number;
  };
  householdsCount: number;
}): Promise<{ brief: string }> {
  const res = await fetch('/api/assistant/community-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not draft neighborhood bulletin.');
  }
  return data as { brief: string };
}
