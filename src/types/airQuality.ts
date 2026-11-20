export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface AqiColor {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
}

export interface AqiIndex {
  code: string;
  displayName: string;
  aqi: number;
  aqiDisplay: string;
  color?: AqiColor;
  category: string;
  dominantPollutant?: string;
}

export interface PollutantConcentration {
  value: number;
  units: string;
}

export interface PollutantInfo {
  code: string;
  displayName: string;
  fullName: string;
  concentration?: PollutantConcentration;
  additionalInfo?: {
    sources?: string;
    effects?: string;
  };
}

export interface HealthRecommendations {
  generalPopulation?: string;
  elderly?: string;
  lungDiseasePopulation?: string;
  heartDiseasePopulation?: string;
  athletes?: string;
  pregnantWomen?: string;
  children?: string;
}

export interface CurrentAirQualityResponse {
  dateTime: string;
  regionCode?: string;
  indexes?: AqiIndex[];
  pollutants?: PollutantInfo[];
  healthRecommendations?: HealthRecommendations;
}

export interface ForecastHour {
  dateTime: string;
  indexes?: AqiIndex[];
  pollutants?: PollutantInfo[];
}

export interface ForecastAirQualityResponse {
  hourlyForecasts?: ForecastHour[];
  regionCode?: string;
}

export type HouseholdGroup =
  | 'family_young_kids'
  | 'respiratory_sensitive'
  | 'daily_commuter'
  | 'outdoor_active'
  | 'community_organizer';

export type HomeType = 'apartment' | 'independent_house' | 'shared_building';

export type CommuteMode = 'personal_car' | 'public_transit' | 'two_wheeler_bike' | 'walk_wfh';

export interface UserLifestyleProfile {
  householdGroup: HouseholdGroup;
  homeType: HomeType;
  commuteMode: CommuteMode;
  hasAirPurifier: boolean;
  cookingFuel: 'gas' | 'electric_induction' | 'solid_fuel';
}

export interface RoutineStep {
  timeBlock: string;
  title: string;
  action: string;
  exposureImpact: string;
  emissionImpact: string;
  category: string;
}

export interface IndoorHack {
  title: string;
  costTier: string;
  setupTime: string;
  reductionEstimate: string;
  targetPollutant: string;
  steps: string[];
  whyItWorks: string;
}

export interface SustainableSwap {
  currentHabit: string;
  sustainableChoice: string;
  personalBenefit: string;
  communityImpact: string;
  estimatedMonthlyReduction: string;
}

export interface TailoredAirPlan {
  headline: string;
  summary: string;
  bestVentilationWindow: string;
  winterSmogMechanism: string;
  dailyRoutine: RoutineStep[];
  indoorHacks: IndoorHack[];
  sustainableSwaps: SustainableSwap[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SelectedLocation {
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export type HeatmapLayerType =
  | 'US_AQI'
  | 'UAQI_RED_GREEN'
  | 'PM25_INDIGO_PERSIAN'
  | 'OFF';
