import React, { useMemo, useState } from 'react';
import { Check, Copy, FileText, Users } from 'lucide-react';
import type {
  CurrentAirQualityResponse,
  SelectedLocation,
} from '../types/airQuality';
import { generateCommunityBrief } from '../services/api';

interface ImpactLabViewProps {
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
}

const COMMUNITY_SCALES = [
  { count: 1, label: 'Your Household' },
  { count: 25, label: '25 Neighbors' },
  { count: 200, label: 'School / Block (200)' },
  { count: 1000, label: 'District (1,000)' },
];

export function ImpactLabView({ location, airQuality }: ImpactLabViewProps) {
  const [carTripsReplacedPerWeek, setCarTripsReplacedPerWeek] = useState(4);
  const [filtrationHoursPerDay, setFiltrationHoursPerDay] = useState(10);
  const [noIndoorCombustion, setNoIndoorCombustion] = useState(true);
  const [ventedCooking, setVentedCooking] = useState(true);
  const [draftSealing, setDraftSealing] = useState(true);
  const [householdsCount, setHouseholdsCount] = useState(25);

  const [briefText, setBriefText] = useState<string | null>(null);
  const [isDraftingBrief, setIsDraftingBrief] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const outdoorPm25 = useMemo(() => {
    const pm25 = airQuality?.pollutants?.find(
      (p) => p.code.toLowerCase() === 'pm25'
    );
    return pm25?.concentration?.value ?? 42;
  }, [airQuality]);

  const impact = useMemo(() => {
    // Transparent urban environmental engineering estimates (monthly per household)
    // Average urban short winter cold-start car trip (~8 km): ~1.95 kg CO2e, 2.8 g NOx, 0.24 g PM2.5 (exhaust + brake/tire)
    const monthlyTrips = carTripsReplacedPerWeek * 4.3;
    const commuteCo2Kg = monthlyTrips * 1.95;
    const commuteNoxG = monthlyTrips * 2.8;
    const commutePm25G = monthlyTrips * 0.24;

    // Stopping indoor solid fuel / incense / candle combustion & wood hearth use
    const combustionCo2Kg = noIndoorCombustion ? 18 : 0;
    const combustionNoxG = noIndoorCombustion ? 14 : 0;
    const combustionPm25G = noIndoorCombustion ? 11.5 : 0;

    // Vented induction/lid cooking efficiency savings
    const cookingCo2Kg = ventedCooking ? 6.5 : 0;
    const cookingNoxG = ventedCooking ? 9.2 : 0;
    const cookingPm25G = ventedCooking ? 3.2 : 0;

    // Indoor PM2.5 exposure reduction percentage (capped realistically at 82%)
    const filtrationPct = Math.min(48, filtrationHoursPerDay * 3.2);
    const sealingPct = draftSealing ? 16 : 0;
    const cookingIndoorPct = ventedCooking ? 11 : 0;
    const noSmokeIndoorPct = noIndoorCombustion ? 10 : 0;
    const indoorReductionPct = Math.min(
      82,
      Math.round(filtrationPct + sealingPct + cookingIndoorPct + noSmokeIndoorPct)
    );

    const baselineIndoorPm25 = outdoorPm25 * 0.68;
    const projectedIndoorPm25 = Math.max(
      3.5,
      baselineIndoorPm25 * (1 - indoorReductionPct / 100)
    );

    const singleHousehold = {
      co2Kg: Math.round(commuteCo2Kg + combustionCo2Kg + cookingCo2Kg),
      noxGrams: Math.round(commuteNoxG + combustionNoxG + cookingNoxG),
      pm25Grams: Number(
        (commutePm25G + combustionPm25G + cookingPm25G).toFixed(1)
      ),
      indoorReductionPct,
      baselineIndoorPm25: Number(baselineIndoorPm25.toFixed(1)),
      projectedIndoorPm25: Number(projectedIndoorPm25.toFixed(1)),
    };

    return {
      singleHousehold,
      community: {
        co2Kg: Math.round(singleHousehold.co2Kg * householdsCount),
        noxGrams: Math.round(singleHousehold.noxGrams * householdsCount),
        pm25Grams: Number(
          (singleHousehold.pm25Grams * householdsCount).toFixed(1)
        ),
        indoorReductionPct,
      },
    };
  }, [
    carTripsReplacedPerWeek,
    filtrationHoursPerDay,
    noIndoorCombustion,
    ventedCooking,
    draftSealing,
    householdsCount,
    outdoorPm25,
  ]);

  const handleDraftBrief = async () => {
    setIsDraftingBrief(true);
    setBriefError(null);
    try {
      const result = await generateCommunityBrief({
        location,
        airQuality,
        simulatedImpact: impact.community,
        householdsCount,
      });
      setBriefText(result.brief);
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : 'Unable to generate bulletin.'
      );
    } finally {
      setIsDraftingBrief(false);
    }
  };

  const handleCopyBrief = async () => {
    if (!briefText) return;
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header & Community Scale Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            {location.name} · Baseline outdoor PM2.5:{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {outdoorPm25.toFixed(1)} µg/m³
            </span>
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Direct Impact &amp; Community Ripple Lab
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Model how everyday winter routines directly reduce the particulates your family breathes indoors and the smog precursors released into your neighborhood.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start md:self-auto overflow-x-auto max-w-full">
          {COMMUNITY_SCALES.map((scale) => (
            <button
              key={scale.count}
              type="button"
              onClick={() => setHouseholdsCount(scale.count)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                householdsCount === scale.count
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {scale.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column Full-Width Quantified Impact Strip */}
      <section
        aria-label="Modeled air quality impact metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Indoor PM2.5 Exposure Drop</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-teal-800 mt-2">
            -{impact.singleHousehold.indoorReductionPct}%
          </p>
          <p className="text-xs font-mono tabular-nums text-slate-500 mt-1.5">
            {impact.singleHousehold.baselineIndoorPm25} →{' '}
            <span className="font-semibold text-slate-800">
              {impact.singleHousehold.projectedIndoorPm25} µg/m³
            </span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">
            Avoided CO₂e ({householdsCount === 1 ? '1 home' : `${householdsCount.toLocaleString()} homes`}/mo)
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {impact.community.co2Kg.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">kg</span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Cold-start tailpipe &amp; fuel avoided
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">
            Avoided NOₓ Smog Precursors / mo
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {impact.community.noxGrams >= 1000
              ? (impact.community.noxGrams / 1000).toFixed(2)
              : impact.community.noxGrams.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">
              {impact.community.noxGrams >= 1000 ? 'kg' : 'g'}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Reduces secondary winter nitrate haze
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">
            Avoided Direct PM2.5 Soot / mo
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {impact.community.pm25Grams >= 1000
              ? (impact.community.pm25Grams / 1000).toFixed(2)
              : impact.community.pm25Grams.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">
              {impact.community.pm25Grams >= 1000 ? 'kg' : 'g'}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Fine respiratory particulate prevented
          </p>
        </div>
      </section>

      {/* Interactive Controls + Community Action Brief Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Choice Controls */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Adjust Daily Household Choices
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every slider updates both indoor exposure modeling and neighborhood-scale emissions immediately.
            </p>
          </div>

          {/* Slider 1 */}
          <div className="space-y-2 pb-5 border-b border-slate-100">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="slider-trips" className="text-sm font-medium text-slate-800">
                Short winter car trips shifted to transit, carpool, bike, or walking
              </label>
              <span className="text-sm font-mono font-semibold tabular-nums text-teal-800 whitespace-nowrap">
                {carTripsReplacedPerWeek} trips / wk
              </span>
            </div>
            <input
              id="slider-trips"
              type="range"
              min={0}
              max={14}
              step={1}
              value={carTripsReplacedPerWeek}
              onChange={(e) => setCarTripsReplacedPerWeek(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
            <p className="text-xs text-slate-500">
              Cold-start winter engines emit 2–3× more NOₓ and fine soot during the first 5 km before catalytic converters warm up.
            </p>
          </div>

          {/* Slider 2 */}
          <div className="space-y-2 pb-5 border-b border-slate-100">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="slider-hepa" className="text-sm font-medium text-slate-800">
                HEPA or DIY MERV-13 Corsi-Rosenthal runtime in primary living/sleeping room
              </label>
              <span className="text-sm font-mono font-semibold tabular-nums text-teal-800 whitespace-nowrap">
                {filtrationHoursPerDay} hrs / day
              </span>
            </div>
            <input
              id="slider-hepa"
              type="range"
              min={0}
              max={24}
              step={2}
              value={filtrationHoursPerDay}
              onChange={(e) => setFiltrationHoursPerDay(Number(e.target.value))}
              className="w-full accent-teal-700 cursor-pointer"
            />
            <p className="text-xs text-slate-500">
              Continuous low-speed filtration prevents nighttime PM2.5 buildup while windows remain closed during cold inversions.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              {
                id: 'toggle-combustion',
                checked: noIndoorCombustion,
                onChange: setNoIndoorCombustion,
                title: 'Zero indoor wood, coal, incense, or candle burning on smog days',
                detail: 'Eliminates one of the highest localized PM2.5 spike sources inside winter homes.',
              },
              {
                id: 'toggle-cooking',
                checked: ventedCooking,
                onChange: setVentedCooking,
                title: 'Exhaust range hood + covered pots during stove cooking',
                detail: 'Cuts indoor NO₂ and cooking aerosol peaks by up to 55% within 15 minutes.',
              },
              {
                id: 'toggle-drafts',
                checked: draftSealing,
                onChange: setDraftSealing,
                title: 'Seal window drafts & air out only during midday mixing window',
                detail: 'Slows outdoor smog infiltration during morning and evening temperature inversions.',
              },
            ].map((item) => (
              <label
                key={item.id}
                htmlFor={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/70 cursor-pointer transition-colors"
              >
                <input
                  id={item.id}
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.onChange(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-teal-700 rounded cursor-pointer"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Right: Community Bulletin Generator */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Shareable Neighborhood Action Brief
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Draft a localized winter smog bulletin for building chats, HOA boards, or school parent groups in {location.name}.
              </p>
            </div>
            <Users className="w-5 h-5 text-slate-400 shrink-0" />
          </div>

          <button
            type="button"
            onClick={() => void handleDraftBrief()}
            disabled={isDraftingBrief}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {isDraftingBrief
              ? 'Drafting Neighborhood Brief...'
              : `Draft Brief for ${householdsCount.toLocaleString()} ${householdsCount === 1 ? 'Household' : 'Households'}`}
          </button>

          {briefError && (
            <p className="text-xs text-rose-700">{briefError}</p>
          )}

          {briefText ? (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {briefText}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyBrief()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                    Copied to clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy bulletin text
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 leading-relaxed space-y-2">
              <p>
                Collective timing amplifies impact during winter thermal inversions: when even 25–200 nearby households shift short cold-start errands and pause solid-fuel burning during morning peak hours, neighborhood street-level PM2.5 spikes flatten noticeably.
              </p>
              <p className="text-slate-400">
                Impact figures are science-based environmental estimates for planning and community education, not medical diagnoses.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
