import React, { useMemo, useState } from 'react';
import type { ForecastHour } from '../types/airQuality';
import { analyzeForecastWindow } from '../utils/airQualityHelpers';

interface ForecastChartProps {
  hourlyForecasts: ForecastHour[];
  isLoading: boolean;
}

export function ForecastChart({ hourlyForecasts, isLoading }: ForecastChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    return hourlyForecasts.slice(0, 36).map((h) => {
      const uaqi = h.indexes?.find((i) => i.code === 'uaqi');
      const local = h.indexes?.find((i) => i.code !== 'uaqi');
      const date = new Date(h.dateTime);
      return {
        dateTime: h.dateTime,
        shortLabel: date.toLocaleTimeString(undefined, { hour: 'numeric' }),
        fullLabel: date.toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
        uaqi: uaqi?.aqi ?? 50,
        localAqi: local?.aqi ?? null,
        localName: local?.displayName ?? null,
        category: uaqi?.category ?? 'Moderate',
        dominant: (uaqi?.dominantPollutant ?? local?.dominantPollutant ?? 'pm25').toUpperCase(),
      };
    });
  }, [hourlyForecasts]);

  const summary = useMemo(
    () => analyzeForecastWindow(hourlyForecasts),
    [hourlyForecasts]
  );

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-44 w-full bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">
          36-Hour Air Quality Trajectory
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Hourly forecast data is currently unavailable for this coordinate. Try an adjacent urban center.
        </p>
      </div>
    );
  }

  const width = 680;
  const height = 180;
  const padLeft = 36;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const xFor = (idx: number) => padLeft + (idx / (points.length - 1)) * chartW;
  const yFor = (uaqi: number) =>
    padTop + chartH - (Math.max(0, Math.min(100, uaqi)) / 100) * chartH;

  const polylinePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(1)} ${yFor(pt.uaqi).toFixed(1)}`)
    .join(' ');

  const areaPath = `${polylinePath} L ${xFor(points.length - 1).toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

  let bestIndex = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].uaqi > points[bestIndex].uaqi) bestIndex = i;
  }

  const activeIdx = hoveredIdx !== null ? hoveredIdx : bestIndex;
  const activePoint = points[activeIdx];

  return (
    <section
      aria-label="36-hour air quality forecast"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            36-Hour Dispersion & Ventilation Forecast
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Universal AQI scale (higher = cleaner air) · Hover timeline to inspect winter inversion dips
          </p>
        </div>
        {summary && (
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            Best window: <span className="font-semibold text-teal-800">{summary.bestHourLabel}</span> (UAQI {summary.bestUaqi})
          </div>
        )}
      </div>

      {/* Live Crosshair Readout Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-mono tabular-nums">
          <span className="font-semibold text-slate-900">{activePoint.fullLabel}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>UAQI {activePoint.uaqi}/100</span>
          {activePoint.localAqi !== null && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>{activePoint.localName}: {activePoint.localAqi}</span>
            </>
          )}
        </div>
        <div className="text-slate-500">
          {activePoint.category} · Dominant: <span className="font-mono text-slate-700">{activePoint.dominant}</span>
        </div>
      </div>

      {/* Crisp SVG Dual-Zone Trajectory */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 min-w-[460px] select-none"
          role="img"
          aria-label="Hourly Universal AQI forecast chart over the next 36 hours"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="uaqiAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D7A6F" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0D7A6F" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Reference Grid Lines */}
          {[20, 40, 60, 80].map((val) => (
            <g key={val}>
              <line
                x1={padLeft}
                y1={yFor(val)}
                x2={width - padRight}
                y2={yFor(val)}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray={val === 60 ? 'none' : '3 3'}
              />
              <text
                x={padLeft - 8}
                y={yFor(val) + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Area and Primary Curve */}
          <path d={areaPath} fill="url(#uaqiAreaFill)" />
          <path
            d={polylinePath}
            fill="none"
            stroke="#0D7A6F"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Peak Cleanest Window Marker */}
          <circle
            cx={xFor(bestIndex)}
            cy={yFor(points[bestIndex].uaqi)}
            r="4"
            fill="#0D7A6F"
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* Interactive Crosshair */}
          <line
            x1={xFor(activeIdx)}
            y1={padTop}
            x2={xFor(activeIdx)}
            y2={padTop + chartH}
            stroke="#94A3B8"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle
            cx={xFor(activeIdx)}
            cy={yFor(activePoint.uaqi)}
            r="5"
            fill="#0F172A"
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* X-Axis Hour Labels every 6 hours */}
          {points.map((pt, idx) =>
            idx % 6 === 0 ? (
              <text
                key={pt.dateTime}
                x={xFor(idx)}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {pt.shortLabel}
              </text>
            ) : null
          )}

          {/* Invisible Hover Hit Columns */}
          {points.map((pt, idx) => {
            const colW = chartW / Math.max(1, points.length - 1);
            return (
              <rect
                key={`hit-${pt.dateTime}`}
                x={Math.max(padLeft, xFor(idx) - colW / 2)}
                y={padTop}
                width={colW}
                height={chartH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIdx(idx)}
                onClick={() => setHoveredIdx(idx)}
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}
