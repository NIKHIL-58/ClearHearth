import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeForecastWindow,
  formatPollutantUnit,
  getPrimaryIndex,
  getSeverityMeta,
} from './airQualityHelpers';
import type { AqiIndex, ForecastHour } from '../types/airQuality';

function index(code: string, aqi: number, category = ''): AqiIndex {
  return {
    code,
    aqi,
    category,
    displayName: code,
    aqiDisplay: String(aqi),
  };
}

test('missing AQI data returns a safe awaiting-data state', () => {
  const result = getSeverityMeta(undefined);
  assert.equal(result.level, 'moderate');
  assert.equal(result.label, 'Awaiting Data');
});

test('local AQI thresholds classify boundary values correctly', () => {
  assert.equal(getSeverityMeta(index('us_aqi', 50)).level, 'good');
  assert.equal(getSeverityMeta(index('us_aqi', 51)).level, 'moderate');
  assert.equal(getSeverityMeta(index('us_aqi', 101)).level, 'sensitive');
  assert.equal(getSeverityMeta(index('us_aqi', 151)).level, 'unhealthy');
  assert.equal(getSeverityMeta(index('us_aqi', 201)).level, 'severe');
});

test('Universal AQI thresholds classify boundary values correctly', () => {
  assert.equal(getSeverityMeta(index('uaqi', 80)).level, 'good');
  assert.equal(getSeverityMeta(index('uaqi', 60)).level, 'good');
  assert.equal(getSeverityMeta(index('uaqi', 40)).level, 'moderate');
  assert.equal(getSeverityMeta(index('uaqi', 20)).level, 'unhealthy');
  assert.equal(getSeverityMeta(index('uaqi', 19)).level, 'severe');
});

test('AQI classification uses provider category when available', () => {
  assert.equal(getSeverityMeta(index('us_aqi', 25, 'Custom category')).label, 'Custom category');
});

test('pollutant units are formatted and unknown units remain readable', () => {
  assert.equal(formatPollutantUnit(), '');
  assert.equal(formatPollutantUnit('MICROGRAMS_PER_CUBIC_METER'), 'µg/m³');
  assert.equal(formatPollutantUnit('PARTS_PER_BILLION'), 'ppb');
  assert.equal(formatPollutantUnit('MILLIGRAMS_PER_CUBIC_METER'), 'milligrams per cubic meter');
});

test('primary AQI prefers local index and also returns universal index', () => {
  const local = index('us_aqi', 72);
  const universal = index('uaqi', 55);
  const result = getPrimaryIndex({ dateTime: '2026-11-20T10:00:00Z', indexes: [universal, local] });
  assert.equal(result.local, local);
  assert.equal(result.universal, universal);
  assert.equal(result.preferred, local);
});

test('primary AQI falls back to universal index when local index is absent', () => {
  const universal = index('uaqi', 55);
  const result = getPrimaryIndex({ dateTime: '2026-11-20T10:00:00Z', indexes: [universal] });
  assert.equal(result.preferred, universal);
});

test('forecast analysis handles empty input', () => {
  assert.equal(analyzeForecastWindow([]), null);
});

test('forecast analysis finds best and worst hours and a clearing trend', () => {
  const hours: ForecastHour[] = Array.from({ length: 13 }, (_, i) => ({
    dateTime: new Date(Date.UTC(2026, 10, 20, i)).toISOString(),
    indexes: [index('uaqi', i === 5 ? 92 : i === 0 ? 25 : 40 + i * 3)],
  }));
  const result = analyzeForecastWindow(hours);
  assert.ok(result);
  assert.equal(result.bestUaqi, 92);
  assert.equal(result.worstUaqi, 25);
  assert.equal(result.trendLabel, 'Air clearing over next 12h');
  assert.ok(result.bestHourLabel.length > 0);
  assert.ok(result.worstHourLabel.length > 0);
});

test('forecast analysis reports a smog-concentrating trend', () => {
  const hours: ForecastHour[] = Array.from({ length: 13 }, (_, i) => ({
    dateTime: new Date(Date.UTC(2026, 10, 20, i)).toISOString(),
    indexes: [index('uaqi', 90 - i * 6)],
  }));
  assert.equal(analyzeForecastWindow(hours)?.trendLabel, 'Smog concentrating over next 12h');
});
