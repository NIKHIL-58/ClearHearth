import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Activity,
  CalendarClock,
  Home,
  MapPin,
  MessageSquare,
} from 'lucide-react';
import type {
  ChatMessage,
  CurrentAirQualityResponse,
  ForecastHour,
  HeatmapLayerType,
  SelectedLocation,
  TailoredAirPlan,
  UserLifestyleProfile,
} from './types/airQuality';
import {
  analyzeForecastWindow,
  DEFAULT_PROFILE,
  PRESET_CITIES,
} from './utils/airQualityHelpers';
import {
  fetchAppConfig,
  fetchCurrentAirQuality,
  fetchForecastAirQuality,
  generateTailoredPlan,
  reverseGeocode,
  sendAssistantMessage,
} from './services/api';
import { AirQualityMap } from './components/AirQualityMap';
import { PollutantTelemetryPanel } from './components/PollutantTelemetryPanel';
import { ForecastChart } from './components/ForecastChart';
import { LifestyleProfileBar } from './components/LifestyleProfileBar';
import { DailyRoutineView } from './components/DailyRoutineView';
import { IndoorHacksView } from './components/IndoorHacksView';
import { ImpactLabView } from './components/ImpactLabView';
import { AssistantDrawer } from './components/AssistantDrawer';

type NavTab = 'map' | 'plan' | 'indoor' | 'impact';

const PROFILE_STORAGE_KEY = 'clearhearth_profile_v1';
const COMPLETED_STORAGE_KEY = 'clearhearth_completed_v1';

function loadSavedProfile(): UserLifestyleProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function loadCompletedSteps(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPLETED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof MapPin }> = [
  { id: 'map', label: 'Live Map', icon: MapPin },
  { id: 'plan', label: 'Daily Plan', icon: CalendarClock },
  { id: 'indoor', label: 'Indoor Hacks', icon: Home },
  { id: 'impact', label: 'Impact Lab', icon: Activity },
];

export default function App() {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || ''
  );
  const [configReady, setConfigReady] = useState<boolean>(
    () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavTab>('map');
  const [location, setLocation] = useState<SelectedLocation>(PRESET_CITIES[0]);
  const [profile, setProfile] = useState<UserLifestyleProfile>(loadSavedProfile);
  const [completedIds, setCompletedIds] = useState<string[]>(loadCompletedSteps);

  const [heatmapLayer, setHeatmapLayer] = useState<HeatmapLayerType>('US_AQI');
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.55);

  const [airQuality, setAirQuality] = useState<CurrentAirQualityResponse | null>(null);
  const [hourlyForecasts, setHourlyForecasts] = useState<ForecastHour[]>([]);
  const [isLoadingAq, setIsLoadingAq] = useState<boolean>(true);
  const [aqError, setAqError] = useState<string | null>(null);

  const [plan, setPlan] = useState<TailoredAirPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const planRequestIdRef = useRef(0);

  const forecastSummary = useMemo(
    () => analyzeForecastWindow(hourlyForecasts),
    [hourlyForecasts]
  );

  // Listen for Google Maps Platform quota exhaustion events (Tier 1 & Tier 2)
  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Load Maps API key from server config if not injected into Vite env
  useEffect(() => {
    if (mapsApiKey) {
      setConfigReady(true);
      return;
    }
    let cancelled = false;
    fetchAppConfig()
      .then((cfg) => {
        if (!cancelled) {
          if (cfg.mapsApiKey) setMapsApiKey(cfg.mapsApiKey);
          setConfigReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setConfigReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mapsApiKey]);

  // Persist user profile & completed checklist locally
  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COMPLETED_STORAGE_KEY,
        JSON.stringify(completedIds)
      );
    } catch {
      // ignore storage errors
    }
  }, [completedIds]);

  // Fetch live current conditions + 48h forecast for selected coordinates
  const loadAirData = useCallback(async (target: SelectedLocation) => {
    setIsLoadingAq(true);
    setAqError(null);

    try {
      const [currentRes, forecastRes] = await Promise.allSettled([
        fetchCurrentAirQuality(target.lat, target.lng),
        fetchForecastAirQuality(target.lat, target.lng),
      ]);

      if (currentRes.status === 'fulfilled') {
        setAirQuality(currentRes.value);
      } else {
        setAirQuality(null);
        setAqError(
          currentRes.reason instanceof Error
            ? currentRes.reason.message
            : 'Unable to fetch current air quality data for this location.'
        );
      }

      if (forecastRes.status === 'fulfilled') {
        setHourlyForecasts(forecastRes.value.hourlyForecasts ?? []);
      } else {
        setHourlyForecasts([]);
      }
    } finally {
      setIsLoadingAq(false);
    }
  }, []);

  useEffect(() => {
    void loadAirData(location);
  }, [location.lat, location.lng, loadAirData]);

  // Generate tailored GenAI daily plan & indoor hacks grounded in live AQI
  const refreshPlan = useCallback(
    async (
      targetLoc: SelectedLocation,
      targetAq: CurrentAirQualityResponse | null,
      targetForecast: ReturnType<typeof analyzeForecastWindow>,
      targetProfile: UserLifestyleProfile
    ) => {
      const reqId = ++planRequestIdRef.current;
      setIsGeneratingPlan(true);
      setPlanError(null);

      try {
        const result = await generateTailoredPlan({
          location: targetLoc,
          airQuality: targetAq,
          forecastSummary: targetForecast,
          profile: targetProfile,
        });
        if (reqId === planRequestIdRef.current) {
          setPlan(result);
        }
      } catch (err) {
        if (reqId === planRequestIdRef.current) {
          setPlanError(
            err instanceof Error
              ? err.message
              : 'Unable to generate tailored guidance.'
          );
        }
      } finally {
        if (reqId === planRequestIdRef.current) {
          setIsGeneratingPlan(false);
        }
      }
    },
    []
  );

  // Trigger tailored plan generation whenever live air data finishes loading for a new location
  useEffect(() => {
    if (isLoadingAq) return;
    void refreshPlan(location, airQuality, forecastSummary, profile);
    // Intentionally regenerate automatically on location/AQ update; manual profile button also calls refreshPlan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAq, location.lat, location.lng]);

  const handleMapClickCoordinates = useCallback(
    async (lat: number, lng: number) => {
      setLocation({
        name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        subtitle: 'Inspecting neighborhood...',
        lat,
        lng,
      });

      const resolved = await reverseGeocode(lat, lng);
      setLocation((prev) =>
        Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001
          ? { name: resolved.name, subtitle: resolved.subtitle, lat, lng }
          : prev
      );
    },
    []
  );

  const handleToggleComplete = useCallback((id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleSendMessage = useCallback(
    async (text: string) => {
      const now = new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: now,
      };

      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setIsSendingChat(true);
      setChatError(null);

      try {
        const res = await sendAssistantMessage({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          location,
          airQuality,
          forecastSummary,
          profile,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: res.reply,
            timestamp: new Date().toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            }),
          },
        ]);
      } catch (err) {
        setChatError(
          err instanceof Error ? err.message : 'Assistant request failed.'
        );
      } finally {
        setIsSendingChat(false);
      }
    },
    [messages, location, airQuality, forecastSummary, profile]
  );

  const handleAskQuestionFromView = useCallback(
    (prompt: string) => {
      setIsAssistantOpen(true);
      void handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  const workspaceContent = (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB] text-slate-900 pb-16 md:pb-0">
      {/* Required Google Maps Platform Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-[var(--font-display)]"
          >
            ClearHearth
          </button>

          {/* Zone 2: 4 clean single-line navigation links */}
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-teal-700 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              Ask Assistant
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tailoring Controls Toolbar */}
        <LifestyleProfileBar
          profile={profile}
          onChange={setProfile}
          onRefreshPlan={() =>
            void refreshPlan(location, airQuality, forecastSummary, profile)
          }
          isGeneratingPlan={isGeneratingPlan}
        />

        {/* Active View Content */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-6">
                <AirQualityMap
                  location={location}
                  airQuality={airQuality}
                  heatmapLayer={heatmapLayer}
                  heatmapOpacity={heatmapOpacity}
                  isLoadingData={isLoadingAq}
                  onSelectLocation={setLocation}
                  onMapClickCoordinates={handleMapClickCoordinates}
                  onHeatmapLayerChange={setHeatmapLayer}
                  onHeatmapOpacityChange={setHeatmapOpacity}
                />

                <ForecastChart
                  hourlyForecasts={hourlyForecasts}
                  isLoading={isLoadingAq}
                />
              </div>

              <div className="lg:col-span-4 space-y-6">
                <PollutantTelemetryPanel
                  location={location}
                  airQuality={airQuality}
                  profile={profile}
                  isLoading={isLoadingAq}
                  error={aqError}
                  onRetry={() => void loadAirData(location)}
                  onOpenPlan={() => setActiveTab('plan')}
                />

                {/* Concise GenAI Headline Card */}
                <section
                  aria-label="Today's tailored smog briefing"
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <p className="text-xs text-slate-500">
                    Tailored Smog Briefing · {location.name}
                  </p>
                  {isGeneratingPlan ? (
                    <div className="space-y-2">
                      <div className="h-5 w-4/5 bg-slate-200 rounded" />
                      <div className="h-12 w-full bg-slate-100 rounded" />
                    </div>
                  ) : plan ? (
                    <>
                      <h3 className="text-base font-bold text-slate-900 [text-wrap:balance]">
                        {plan.headline}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {plan.summary}
                      </p>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('indoor')}
                          className="text-xs font-medium text-teal-800 hover:text-teal-900"
                        >
                          See {plan.indoorHacks.length} indoor air hacks →
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('impact')}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Model impact
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {planError || 'Select Tailor Guidance above to generate your winter smog plan.'}
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <DailyRoutineView
            location={location}
            profile={profile}
            plan={plan}
            isLoading={isGeneratingPlan}
            error={planError}
            completedIds={completedIds}
            onToggleComplete={handleToggleComplete}
            onRetry={() =>
              void refreshPlan(location, airQuality, forecastSummary, profile)
            }
            onAskQuestion={handleAskQuestionFromView}
          />
        )}

        {activeTab === 'indoor' && (
          <IndoorHacksView
            location={location}
            profile={profile}
            plan={plan}
            isLoading={isGeneratingPlan}
            error={planError}
            onRetry={() =>
              void refreshPlan(location, airQuality, forecastSummary, profile)
            }
            onAskQuestion={handleAskQuestionFromView}
          />
        )}

        {activeTab === 'impact' && (
          <ImpactLabView location={location} airQuality={airQuality} />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            ClearHearth · Environmental air quality guidance for families &amp; communities (not medical advice).
          </p>
          <p>
            Interactive mapping &amp; live AQI powered by Google Maps Platform.{' '}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700"
            >
              Maps Terms
            </a>
          </p>
        </div>
      </footer>

      {/* Mobile Compact Bottom Tab Bar (keeps combined mobile sticky height <= 15%) */}
      <nav
        aria-label="Mobile sections"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white border-t border-slate-200 grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-teal-700' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Slide-Over GenAI Assistant */}
      <AssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        location={location}
        airQuality={airQuality}
        profile={profile}
        messages={messages}
        isSending={isSendingChat}
        error={chatError}
        onSendMessage={(text) => void handleSendMessage(text)}
      />
    </div>
  );

  if (!configReady) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center text-sm text-slate-500">
        Initializing ClearHearth air telemetry...
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      language="en"
      region="US"
      libraries={['places']}
    >
      {workspaceContent}
    </APIProvider>
  );
}
