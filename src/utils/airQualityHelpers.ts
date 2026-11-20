import type {
  AqiIndex,
  CommuteMode,
  CurrentAirQualityResponse,
  ForecastHour,
  HomeType,
  HouseholdGroup,
  SelectedLocation,
  UserLifestyleProfile,
} from '../types/airQuality';

export const EDITORIAL_IMAGES = {
  indoorFiltration: '/src/assets/images/indoor_filtration_guide_1795159924120.jpg',
  winterCommute: '/src/assets/images/winter_commute_clean_1795159925398.jpg',
  kitchenVentilation: '/src/assets/images/kitchen_ventilation_clean_1795159923938.jpg',
};

export const PRESET_CITIES: SelectedLocation[] = [
  { name: 'New Delhi', subtitle: 'National Capital Region, India', lat: 28.6139, lng: 77.209 },
  { name: 'Salt Lake City', subtitle: 'Wasatch Basin, USA', lat: 40.7608, lng: -111.891 },
  { name: 'Milan', subtitle: 'Po Valley, Italy', lat: 45.4642, lng: 9.19 },
  { name: 'Lahore', subtitle: 'Punjab Plain, Pakistan', lat: 31.5204, lng: 74.3587 },
  { name: 'Krakow', subtitle: 'Lesser Poland, Poland', lat: 50.0647, lng: 19.945 },
  { name: 'Los Angeles', subtitle: 'South Coast Basin, USA', lat: 34.0522, lng: -118.2437 },
];

export const DEFAULT_PROFILE: UserLifestyleProfile = {
  householdGroup: 'family_young_kids',
  homeType: 'apartment',
  commuteMode: 'personal_car',
  hasAirPurifier: false,
  cookingFuel: 'gas',
};

export const HOUSEHOLD_LABELS: Record<HouseholdGroup, string> = {
  family_young_kids: 'Family with Children',
  respiratory_sensitive: 'Asthma / Elderly Care',
  daily_commuter: 'Daily Urban Commuter',
  outdoor_active: 'Outdoor Runner / Cyclist',
  community_organizer: 'School / Neighborhood Lead',
};

export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  apartment: 'Apartment / Flat',
  independent_house: 'Independent House',
  shared_building: 'Multi-Family Building',
};

export const COMMUTE_LABELS: Record<CommuteMode, string> = {
  personal_car: 'Private Car',
  public_transit: 'Metro / Bus / Rail',
  two_wheeler_bike: 'Scooter / Bicycle',
  walk_wfh: 'Walk / Remote Work',
};

export const COOKING_FUEL_LABELS: Record<UserLifestyleProfile['cookingFuel'], string> = {
  gas: 'Natural Gas / LPG',
  electric_induction: 'Electric / Induction',
  solid_fuel: 'Wood / Charcoal / Biomass',
};

export function formatPollutantUnit(unit?: string): string {
  if (!unit) return '';
  if (unit === 'MICROGRAMS_PER_CUBIC_METER') return 'µg/m³';
  if (unit === 'PARTS_PER_BILLION') return 'ppb';
  return unit.toLowerCase().replace(/_/g, ' ');
}

export const WHO_24H_GUIDELINES: Record<string, { limit: number; unit: string; label: string }> = {
  pm25: { limit: 15, unit: 'µg/m³', label: 'WHO 24h: 15 µg/m³' },
  pm10: { limit: 45, unit: 'µg/m³', label: 'WHO 24h: 45 µg/m³' },
  no2: { limit: 25, unit: 'µg/m³', label: 'WHO 24h: 25 µg/m³' },
  o3: { limit: 100, unit: 'µg/m³', label: 'WHO 8h: 100 µg/m³' },
  so2: { limit: 40, unit: 'µg/m³', label: 'WHO 24h: 40 µg/m³' },
  co: { limit: 4000, unit: 'µg/m³', label: 'WHO 24h: 4 mg/m³' },
};

export interface SeverityMeta {
  level: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'severe';
  label: string;
  symbol: string;
  textClass: string;
  barClass: string;
  markerBg: string;
  markerText: string;
}

/**
 * Classifies AQI index cleanly with explicit text + symbol (never color alone).
 * Handles both Universal AQI (100 = cleanest, 0 = worst) and local/EPA scales (0 = cleanest).
 */
export function getSeverityMeta(index?: AqiIndex): SeverityMeta {
  if (!index) {
    return {
      level: 'moderate',
      label: 'Awaiting Data',
      symbol: '○',
      textClass: 'text-slate-600',
      barClass: 'bg-slate-400',
      markerBg: '#475569',
      markerText: '#FFFFFF',
    };
  }

  const isUaqi = index.code === 'uaqi';
  const score = index.aqi;

  if (isUaqi) {
    // Universal AQI: 80-100 Excellent, 60-79 Good, 40-59 Moderate, 20-39 Low, 0-19 Poor
    if (score >= 80) {
      return {
        level: 'good',
        label: index.category || 'Excellent Air Quality',
        symbol: '●',
        textClass: 'text-emerald-700',
        barClass: 'bg-emerald-600',
        markerBg: '#15803D',
        markerText: '#FFFFFF',
      };
    }
    if (score >= 60) {
      return {
        level: 'good',
        label: index.category || 'Good Air Quality',
        symbol: '●',
        textClass: 'text-teal-700',
        barClass: 'bg-teal-600',
        markerBg: '#0F766E',
        markerText: '#FFFFFF',
      };
    }
    if (score >= 40) {
      return {
        level: 'moderate',
        label: index.category || 'Moderate Air Quality',
        symbol: '▲',
        textClass: 'text-amber-700',
        barClass: 'bg-amber-600',
        markerBg: '#B45309',
        markerText: '#FFFFFF',
      };
    }
    if (score >= 20) {
      return {
        level: 'unhealthy',
        label: index.category || 'Low Air Quality',
        symbol: '▲',
        textClass: 'text-orange-700',
        barClass: 'bg-orange-600',
        markerBg: '#C2410C',
        markerText: '#FFFFFF',
      };
    }
    return {
      level: 'severe',
      label: index.category || 'Poor Air Quality',
      symbol: '✖',
      textClass: 'text-rose-700',
      barClass: 'bg-rose-600',
      markerBg: '#BE123C',
      markerText: '#FFFFFF',
    };
  }

  // Local / EPA-style AQI: lower is cleaner
  if (score <= 50) {
    return {
      level: 'good',
      label: index.category || 'Good',
      symbol: '●',
      textClass: 'text-emerald-700',
      barClass: 'bg-emerald-600',
      markerBg: '#15803D',
      markerText: '#FFFFFF',
    };
  }
  if (score <= 100) {
    return {
      level: 'moderate',
      label: index.category || 'Moderate',
      symbol: '▲',
      textClass: 'text-amber-700',
      barClass: 'bg-amber-600',
      markerBg: '#B45309',
      markerText: '#FFFFFF',
    };
  }
  if (score <= 150) {
    return {
      level: 'sensitive',
      label: index.category || 'Sensitive Groups',
      symbol: '▲',
      textClass: 'text-orange-700',
      barClass: 'bg-orange-600',
      markerBg: '#C2410C',
      markerText: '#FFFFFF',
    };
  }
  if (score <= 200) {
    return {
      level: 'unhealthy',
      label: index.category || 'Unhealthy',
      symbol: '✖',
      textClass: 'text-red-700',
      barClass: 'bg-red-600',
      markerBg: '#DC2626',
      markerText: '#FFFFFF',
    };
  }
  return {
    level: 'severe',
    label: index.category || 'Severe / Hazardous',
    symbol: '✖',
    textClass: 'text-rose-800',
    barClass: 'bg-rose-700',
    markerBg: '#881337',
    markerText: '#FFFFFF',
  };
}

export function getPrimaryIndex(data: CurrentAirQualityResponse | null): {
  local: AqiIndex | undefined;
  universal: AqiIndex | undefined;
  preferred: AqiIndex | undefined;
} {
  const indexes = data?.indexes ?? [];
  const universal = indexes.find((i) => i.code === 'uaqi');
  const local = indexes.find((i) => i.code !== 'uaqi');
  return {
    local,
    universal,
    preferred: local ?? universal,
  };
}

export interface ForecastWindowSummary {
  bestHourLabel: string;
  bestUaqi: number;
  worstHourLabel: string;
  worstUaqi: number;
  trendLabel: string;
}

export function analyzeForecastWindow(hours: ForecastHour[]): ForecastWindowSummary | null {
  if (!hours || hours.length === 0) return null;

  const scored = hours
    .map((h) => {
      const uaqi = h.indexes?.find((i) => i.code === 'uaqi');
      return {
        dateTime: h.dateTime,
        uaqi: uaqi?.aqi ?? 50,
      };
    })
    .slice(0, 36);

  if (scored.length === 0) return null;

  let best = scored[0];
  let worst = scored[0];
  for (const item of scored) {
    if (item.uaqi > best.uaqi) best = item;
    if (item.uaqi < worst.uaqi) worst = item;
  }

  const formatLocalHour = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const first = scored[0].uaqi;
  const mid = scored[Math.min(12, scored.length - 1)].uaqi;
  const diff = mid - first;
  const trendLabel =
    diff >= 6
      ? 'Air clearing over next 12h'
      : diff <= -6
        ? 'Smog concentrating over next 12h'
        : 'Steady atmospheric inversion';

  return {
    bestHourLabel: formatLocalHour(best.dateTime),
    bestUaqi: best.uaqi,
    worstHourLabel: formatLocalHour(worst.dateTime),
    worstUaqi: worst.uaqi,
    trendLabel,
  };
}
