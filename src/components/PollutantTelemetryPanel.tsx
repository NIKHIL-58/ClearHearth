import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Wind } from 'lucide-react';
import type {
  CurrentAirQualityResponse,
  SelectedLocation,
  UserLifestyleProfile,
} from '../types/airQuality';
import {
  formatPollutantUnit,
  getPrimaryIndex,
  getSeverityMeta,
  HOUSEHOLD_LABELS,
  WHO_24H_GUIDELINES,
} from '../utils/airQualityHelpers';

interface PollutantTelemetryPanelProps {
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  profile: UserLifestyleProfile;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenPlan: () => void;
}

export function PollutantTelemetryPanel({
  location,
  airQuality,
  profile,
  isLoading,
  error,
  onRetry,
  onOpenPlan,
}: PollutantTelemetryPanelProps) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const { local, universal, preferred } = getPrimaryIndex(airQuality);
  const severity = getSeverityMeta(preferred);

  const relevantHealthNote = (() => {
    const rec = airQuality?.healthRecommendations;
    if (!rec) return null;
    if (profile.householdGroup === 'family_young_kids') {
      return rec.children || rec.generalPopulation;
    }
    if (profile.householdGroup === 'respiratory_sensitive') {
      return rec.lungDiseasePopulation || rec.elderly || rec.generalPopulation;
    }
    if (profile.householdGroup === 'outdoor_active') {
      return rec.athletes || rec.generalPopulation;
    }
    return rec.generalPopulation;
  })();

  if (isLoading) {
    return (
      <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-10 w-44 bg-slate-200 rounded" />
          <div className="h-3 w-56 bg-slate-100 rounded" />
        </div>
        <div className="space-y-2.5 pt-4 border-t border-slate-100">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-9 bg-slate-100 rounded" />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Live Air Reading Unavailable
        </h2>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors"
        >
          Retry Reading
        </button>
      </aside>
    );
  }

  const pollutants = airQuality?.pollutants ?? [];
  const dominantCode = (preferred?.dominantPollutant || universal?.dominantPollutant || '').toLowerCase();
  const updatedTime = airQuality?.dateTime
    ? new Date(airQuality.dateTime).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <aside
      aria-label="Current air quality telemetry"
      className="bg-white border border-slate-200 rounded-xl flex flex-col justify-between"
    >
      <div className="p-5 space-y-5">
        {/* Location & Primary AQI Readout */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">
                {location.subtitle}
                {updatedTime ? ` · Updated ${updatedTime}` : ''}
              </p>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
                {location.name}
              </h2>
            </div>
            <Wind className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
          </div>

          {/* Primary Numeric Readout */}
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono tabular-nums text-slate-900">
                  {preferred?.aqiDisplay ?? '—'}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {preferred?.displayName ?? 'AQI'}
                </span>
              </div>
              <p className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${severity.textClass}`}>
                <span aria-hidden="true">{severity.symbol}</span>
                <span>{severity.label}</span>
              </p>
            </div>

            {local && universal && (
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Universal AQI</p>
                <p className="text-lg font-mono font-semibold tabular-nums text-slate-800">
                  {universal.aqiDisplay}
                  <span className="text-xs text-slate-400 font-normal">/100</span>
                </p>
              </div>
            )}
          </div>

          {/* Severity Scale Bar */}
          <div className="mt-3.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${severity.barClass}`}
              style={{
                width: preferred
                  ? preferred.code === 'uaqi'
                    ? `${Math.max(8, 100 - preferred.aqi)}%`
                    : `${Math.min(100, Math.max(8, (preferred.aqi / 300) * 100))}%`
                  : '15%',
              }}
            />
          </div>

          {dominantCode && (
            <p className="text-xs text-slate-500 mt-2.5">
              Dominant pollutant:{' '}
              <span className="font-mono font-semibold text-slate-800 uppercase">
                {dominantCode}
              </span>
              {preferred?.code === 'uaqi'
                ? ' · Universal AQI runs 0 (poor) to 100 (cleanest)'
                : ' · Local scale runs 0 (clean) to 300+ (severe)'}
            </p>
          )}
        </div>

        {/* Household Advisory Note */}
        {relevantHealthNote && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">
              Advisory for {HOUSEHOLD_LABELS[profile.householdGroup]}
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {relevantHealthNote}
            </p>
          </div>
        )}

        {/* Pollutant Concentration Matrix */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-slate-900">
              Measured Pollutants
            </h3>
            <span className="text-[11px] text-slate-400">
              Tap row for source & impact
            </span>
          </div>

          {pollutants.length === 0 ? (
            <p className="text-xs text-slate-500">
              Individual pollutant concentrations were not reported for this point.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              {pollutants.map((p) => {
                const isDominant = p.code.toLowerCase() === dominantCode;
                const isExpanded = expandedCode === p.code;
                const who = WHO_24H_GUIDELINES[p.code.toLowerCase()];
                const val = p.concentration?.value;
                const unit = formatPollutantUnit(p.concentration?.units);

                return (
                  <div key={p.code}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCode(isExpanded ? null : p.code)
                      }
                      className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-slate-900">
                            {p.displayName}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {p.fullName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {isDominant ? 'Primary winter smog driver' : who ? who.label : 'Monitored gas'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-sm font-semibold text-slate-900">
                            {val !== undefined ? val.toFixed(1) : '—'}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1">
                            {unit}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && p.additionalInfo && (
                      <div className="pb-3 pt-1 px-1 text-xs text-slate-600 space-y-2 bg-slate-50/60">
                        {p.additionalInfo.sources && (
                          <p>
                            <span className="font-semibold text-slate-800">Sources: </span>
                            {p.additionalInfo.sources}
                          </p>
                        )}
                        {p.additionalInfo.effects && (
                          <p>
                            <span className="font-semibold text-slate-800">Health effects: </span>
                            {p.additionalInfo.effects}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Direct Action Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Tailored to your household
        </span>
        <button
          type="button"
          onClick={onOpenPlan}
          className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          View Daily Plan
        </button>
      </div>
    </aside>
  );
}
