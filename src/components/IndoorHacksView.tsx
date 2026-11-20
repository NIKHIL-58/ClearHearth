import React, { useMemo, useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import type {
  SelectedLocation,
  TailoredAirPlan,
  UserLifestyleProfile,
} from '../types/airQuality';
import {
  COOKING_FUEL_LABELS,
  EDITORIAL_IMAGES,
  HOME_TYPE_LABELS,
} from '../utils/airQualityHelpers';

interface IndoorHacksViewProps {
  location: SelectedLocation;
  profile: UserLifestyleProfile;
  plan: TailoredAirPlan | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAskQuestion: (prompt: string) => void;
}

type CostFilter = 'all' | 'zero' | 'low' | 'moderate';

export function IndoorHacksView({
  location,
  profile,
  plan,
  isLoading,
  error,
  onRetry,
  onAskQuestion,
}: IndoorHacksViewProps) {
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [filtrationImgFailed, setFiltrationImgFailed] = useState(false);
  const [kitchenImgFailed, setKitchenImgFailed] = useState(false);

  const filteredHacks = useMemo(() => {
    const hacks = plan?.indoorHacks ?? [];
    if (costFilter === 'all') return hacks;
    return hacks.filter((h) => {
      const lower = h.costTier.toLowerCase();
      if (costFilter === 'zero') return lower.includes('zero') || lower.includes('free');
      if (costFilter === 'low') return lower.includes('low');
      return lower.includes('moderate') || lower.includes('equipment') || lower.includes('$80');
    });
  }, [plan, costFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-52 bg-slate-200/70 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
            >
              <div className="h-3 w-40 bg-slate-200 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 rounded" />
              <div className="h-16 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Indoor Air Quality Guide Unavailable
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {error || 'Refresh to generate indoor filtration and ventilation hacks tailored to your home.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Load Indoor Hacks
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Visual Editorial Primer: Filtration & Clean Kitchen */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
            {!filtrationImgFailed ? (
              <img
                src={EDITORIAL_IMAGES.indoorFiltration}
                alt="Living room with a sealed winter window and matte white HEPA air purifier"
                referrerPolicy="no-referrer"
                onError={() => setFiltrationImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-teal-50 flex items-center justify-center p-6">
                <span className="text-sm font-medium text-slate-600">
                  Sealed Envelope &amp; Clean Air Room
                </span>
              </div>
            )}
          </div>
          <div className="p-5 space-y-1.5">
            <p className="text-xs text-slate-500">
              {HOME_TYPE_LABELS[profile.homeType]} ·{' '}
              {profile.hasAirPurifier ? 'HEPA Unit Equipped' : 'DIY & Passive Filtration Focus'}
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Create One Clean-Air Sanctuary Room
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              During severe winter inversions, sealing a single bedroom or living space with continuous MERV-13 or HEPA recirculation drops overnight PM2.5 inhalation far more effectively than trying to filter an entire open floor plan.
            </p>
          </div>
        </article>

        <article className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
            {!kitchenImgFailed ? (
              <img
                src={EDITORIAL_IMAGES.kitchenVentilation}
                alt="Bright clean kitchen with range hood venting over a covered pot on an induction cooktop"
                referrerPolicy="no-referrer"
                onError={() => setKitchenImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-amber-50 flex items-center justify-center p-6">
                <span className="text-sm font-medium text-slate-600">
                  Source Control in Winter Kitchens
                </span>
              </div>
            )}
          </div>
          <div className="p-5 space-y-1.5">
            <p className="text-xs text-slate-500">
              Cooking fuel: {COOKING_FUEL_LABELS[profile.cookingFuel]} · Source Control
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Stop Indoor PM2.5 &amp; NO₂ Spikes at the Stove
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Unvented winter cooking can briefly push indoor particulate and nitrogen dioxide levels above outdoor smog peaks. Back burners, tight pot lids, and 10 minutes of post-cook exhaust venting trap fumes before they spread.
            </p>
          </div>
        </article>
      </section>

      {/* Filter Header */}
      <section aria-label="Tailored indoor air quality hacks" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Tailored Indoor Air Quality Hacks for {location.name}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Science-backed interventions ranked for your home type and dominant winter pollutant.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter indoor hacks by budget"
            className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'zero', label: 'Zero Cost' },
                { id: 'low', label: 'Low Cost' },
                { id: 'moderate', label: 'Equipment' },
              ] as Array<{ id: CostFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCostFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  costFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHacks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-600">
              No hacks in this budget filter right now. Switch back to &ldquo;All&rdquo; to see every tailored recommendation.
            </p>
            <button
              type="button"
              onClick={() => setCostFilter('all')}
              className="mt-3 px-3.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
            >
              Show All Hacks
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredHacks.map((hack, idx) => (
              <article
                key={`${hack.title}-${idx}`}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Unboxed Metadata Line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{hack.costTier}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{hack.setupTime}</span>
                    <span aria-hidden="true">·</span>
                    <span>Targets {hack.targetPollutant}</span>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900">
                      {hack.title}
                    </h4>
                    <p className="text-sm font-mono font-semibold text-teal-800 mt-1 tabular-nums">
                      {hack.reductionEstimate}
                    </p>
                  </div>

                  {/* Step-by-step instructions */}
                  <ol className="space-y-2 text-sm text-slate-700">
                    {hack.steps.map((step, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs font-semibold text-slate-400 mt-0.5 tabular-nums">
                          {String(sIdx + 1).padStart(2, '0')}.
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-900">Direct mechanism: </span>
                    {hack.whyItWorks}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onAskQuestion(
                      `Walk me through setting up "${hack.title}" in my ${HOME_TYPE_LABELS[profile.homeType]} and how to verify it is reducing ${hack.targetPollutant}.`
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-900 pt-1 self-start"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask Assistant for setup checklist
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
