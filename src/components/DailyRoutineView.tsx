import React, { useState } from 'react';
import { ArrowRight, Check, MessageSquare, RefreshCw } from 'lucide-react';
import type {
  SelectedLocation,
  TailoredAirPlan,
  UserLifestyleProfile,
} from '../types/airQuality';
import {
  COMMUTE_LABELS,
  EDITORIAL_IMAGES,
  HOUSEHOLD_LABELS,
} from '../utils/airQualityHelpers';

interface DailyRoutineViewProps {
  location: SelectedLocation;
  profile: UserLifestyleProfile;
  plan: TailoredAirPlan | null;
  isLoading: boolean;
  error: string | null;
  completedIds: string[];
  onToggleComplete: (id: string) => void;
  onRetry: () => void;
  onAskQuestion: (prompt: string) => void;
}

export function DailyRoutineView({
  location,
  profile,
  plan,
  isLoading,
  error,
  completedIds,
  onToggleComplete,
  onRetry,
  onAskQuestion,
}: DailyRoutineViewProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-7 w-2/3 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-5/6 bg-slate-100 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="h-3 w-36 bg-slate-200 rounded" />
              <div className="h-5 w-3/4 bg-slate-200 rounded" />
              <div className="h-12 w-full bg-slate-100 rounded" />
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
          Could not build today&apos;s routine
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {error || 'Generate a tailored low-emission daily schedule based on live air quality data.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Generate Routine
        </button>
      </div>
    );
  }

  const completedCount = plan.dailyRoutine.filter((_, idx) =>
    completedIds.includes(`routine-${idx}`)
  ).length;

  return (
    <div className="space-y-8">
      {/* Executive Atmospheric Briefing — Asymmetric 2-Column Split */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {location.name} · {HOUSEHOLD_LABELS[profile.householdGroup]} ·{' '}
              {COMMUTE_LABELS[profile.commuteMode]}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              {plan.headline}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              {plan.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Best Ventilation &amp; Errand Window
              </p>
              <p className="text-sm font-semibold text-teal-800 mt-1">
                {plan.bestVentilationWindow}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">
                Why Winter Smog Peaks Here
              </p>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                {plan.winterSmogMechanism}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[220px] bg-slate-100">
          {!imgFailed ? (
            <img
              src={EDITORIAL_IMAGES.winterCommute}
              alt="Clean electric tram and pedestrians commuting along a winter urban boulevard"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          ) : (
            <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-slate-100 to-teal-50 flex items-center justify-center p-6">
              <p className="text-sm font-medium text-slate-600">
                Low-Emission Winter Mobility &amp; Daily Timing
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Low-Emission Time-Blocked Daily Schedule */}
      <section aria-label="Time-blocked daily routine" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Low-Emission Daily Schedule
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Check off actions as you complete them to cut both household exposure and street-level emissions.
            </p>
          </div>
          <p className="text-xs font-mono tabular-nums text-slate-600">
            Completed today: <span className="font-semibold text-teal-800">{completedCount}/{plan.dailyRoutine.length}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {plan.dailyRoutine.map((step, idx) => {
            const stepId = `routine-${idx}`;
            const isDone = completedIds.includes(stepId);

            return (
              <div
                key={`${step.timeBlock}-${idx}`}
                className={`p-5 transition-colors ${isDone ? 'bg-teal-50/30' : 'hover:bg-slate-50/50'}`}
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => onToggleComplete(stepId)}
                    aria-pressed={isDone}
                    aria-label={`Mark "${step.title}" as completed`}
                    className={`mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-slate-300 text-transparent hover:border-teal-600'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-mono tabular-nums text-slate-700 font-medium">
                        {step.timeBlock}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{step.category}</span>
                    </div>

                    <h4
                      className={`text-base font-semibold ${
                        isDone ? 'line-through text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {step.title}
                    </h4>

                    <p className="text-sm text-slate-700 leading-relaxed">
                      {step.action}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">
                          Personal exposure impact:{' '}
                        </span>
                        <span className="text-slate-600">{step.exposureImpact}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-teal-800">
                          Community emission impact:{' '}
                        </span>
                        <span className="text-slate-600">{step.emissionImpact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sustainable Lifestyle Swaps */}
      <section aria-label="Sustainable winter alternatives" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Sustainable Alternatives &amp; Direct Impact
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Practical swaps matched to your commute and home setup, showing exact monthly reductions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.sustainableSwaps.map((swap, idx) => (
            <article
              key={`${swap.sustainableChoice}-${idx}`}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <p className="text-xs font-mono tabular-nums font-semibold text-teal-800">
                  {swap.estimatedMonthlyReduction}
                </p>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 line-through">
                    {swap.currentHabit}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-900">
                    {swap.sustainableChoice}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs leading-relaxed">
                  <p className="text-slate-700">
                    <span className="font-semibold text-slate-900">For your family: </span>
                    {swap.personalBenefit}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">For your neighborhood: </span>
                    {swap.communityImpact}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskQuestion(
                    `Give me a practical first week transition plan to switch from "${swap.currentHabit}" to "${swap.sustainableChoice}" in ${location.name}.`
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-900 pt-2 self-start"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask how to start this swap
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
