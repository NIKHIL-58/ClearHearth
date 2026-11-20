import React from 'react';
import { RefreshCw } from 'lucide-react';
import type {
  CommuteMode,
  HomeType,
  HouseholdGroup,
  UserLifestyleProfile,
} from '../types/airQuality';
import {
  COMMUTE_LABELS,
  COOKING_FUEL_LABELS,
  HOME_TYPE_LABELS,
  HOUSEHOLD_LABELS,
} from '../utils/airQualityHelpers';

interface LifestyleProfileBarProps {
  profile: UserLifestyleProfile;
  onChange: (next: UserLifestyleProfile) => void;
  onRefreshPlan: () => void;
  isGeneratingPlan: boolean;
}

export function LifestyleProfileBar({
  profile,
  onChange,
  onRefreshPlan,
  isGeneratingPlan,
}: LifestyleProfileBarProps) {
  return (
    <section
      aria-label="Household and lifestyle tailoring controls"
      className="bg-white border border-slate-200 rounded-xl p-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1">
          <div>
            <label
              htmlFor="profile-household"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Household Focus
            </label>
            <select
              id="profile-household"
              value={profile.householdGroup}
              onChange={(e) =>
                onChange({
                  ...profile,
                  householdGroup: e.target.value as HouseholdGroup,
                })
              }
              className="w-full h-9 px-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {(Object.keys(HOUSEHOLD_LABELS) as HouseholdGroup[]).map((key) => (
                <option key={key} value={key}>
                  {HOUSEHOLD_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-home"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Home Structure
            </label>
            <select
              id="profile-home"
              value={profile.homeType}
              onChange={(e) =>
                onChange({
                  ...profile,
                  homeType: e.target.value as HomeType,
                })
              }
              className="w-full h-9 px-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {(Object.keys(HOME_TYPE_LABELS) as HomeType[]).map((key) => (
                <option key={key} value={key}>
                  {HOME_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-commute"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Daily Commute
            </label>
            <select
              id="profile-commute"
              value={profile.commuteMode}
              onChange={(e) =>
                onChange({
                  ...profile,
                  commuteMode: e.target.value as CommuteMode,
                })
              }
              className="w-full h-9 px-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {(Object.keys(COMMUTE_LABELS) as CommuteMode[]).map((key) => (
                <option key={key} value={key}>
                  {COMMUTE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-cooking"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Cooking Fuel
            </label>
            <select
              id="profile-cooking"
              value={profile.cookingFuel}
              onChange={(e) =>
                onChange({
                  ...profile,
                  cookingFuel: e.target.value as UserLifestyleProfile['cookingFuel'],
                })
              }
              className="w-full h-9 px-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
            >
              {(
                Object.keys(COOKING_FUEL_LABELS) as Array<
                  UserLifestyleProfile['cookingFuel']
                >
              ).map((key) => (
                <option key={key} value={key}>
                  {COOKING_FUEL_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">
              HEPA Air Purifier
            </span>
            <div className="grid grid-cols-2 gap-1 p-0.5 h-9 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => onChange({ ...profile, hasAirPurifier: true })}
                className={`text-xs font-medium rounded-md transition-colors ${
                  profile.hasAirPurifier
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Have One
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...profile, hasAirPurifier: false })}
                className={`text-xs font-medium rounded-md transition-colors ${
                  !profile.hasAirPurifier
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                No Purifier
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefreshPlan}
          disabled={isGeneratingPlan}
          className="inline-flex items-center justify-center gap-2 h-9 px-4 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isGeneratingPlan ? 'animate-spin' : ''}`}
          />
          {isGeneratingPlan ? 'Updating Guidance...' : 'Tailor Guidance'}
        </button>
      </div>
    </section>
  );
}
