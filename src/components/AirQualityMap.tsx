import React, { useCallback, useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { Crosshair, Layers, LocateFixed, Search, X } from 'lucide-react';
import type {
  CurrentAirQualityResponse,
  HeatmapLayerType,
  SelectedLocation,
} from '../types/airQuality';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import {
  getPrimaryIndex,
  getSeverityMeta,
  PRESET_CITIES,
} from '../utils/airQualityHelpers';

interface AirQualityMapProps {
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  heatmapLayer: HeatmapLayerType;
  heatmapOpacity: number;
  isLoadingData: boolean;
  onSelectLocation: (loc: SelectedLocation) => void;
  onMapClickCoordinates: (lat: number, lng: number) => void;
  onHeatmapLayerChange: (layer: HeatmapLayerType) => void;
  onHeatmapOpacityChange: (opacity: number) => void;
}

const HEATMAP_OPTIONS: Array<{ id: HeatmapLayerType; label: string }> = [
  { id: 'US_AQI', label: 'US AQI' },
  { id: 'UAQI_RED_GREEN', label: 'Universal AQI' },
  { id: 'PM25_INDIGO_PERSIAN', label: 'PM2.5 Plume' },
  { id: 'OFF', label: 'Base Map' },
];

function HeatmapOverlayController({
  layer,
  opacity,
  center,
}: {
  layer: HeatmapLayerType;
  opacity: number;
  center: { lat: number; lng: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [map, center.lat, center.lng]);

  useEffect(() => {
    if (!map) return;

    map.overlayMapTypes.clear();

    if (layer === 'OFF') {
      return;
    }

    const imageMapType = new google.maps.ImageMapType({
      getTileUrl(coord, zoom) {
        if (zoom < 0 || zoom > 16) return null;
        const numTiles = 1 << zoom;
        if (coord.y < 0 || coord.y >= numTiles) return null;
        const x = ((coord.x % numTiles) + numTiles) % numTiles;
        return `/api/air-quality/tiles/${layer}/${zoom}/${x}/${coord.y}`;
      },
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 16,
      minZoom: 0,
      name: `Air Quality (${layer})`,
      opacity,
    });

    map.overlayMapTypes.insertAt(0, imageMapType);

    return () => {
      map.overlayMapTypes.clear();
    };
  }, [map, layer, opacity]);

  return null;
}

function LocationSearchInput({
  onPlaceChosen,
}: {
  onPlaceChosen: (loc: SelectedLocation) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { suggestions, isLoading, resetSession } = useAutocompleteSuggestions(query);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        if (place.location) {
          onPlaceChosen({
            name: place.displayName || suggestion.placePrediction.text.text,
            subtitle: place.formattedAddress || 'Selected Location',
            lat: place.location.lat(),
            lng: place.location.lng(),
          });
        }
      } catch (err) {
        const msg = String(err);
        if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('RESOURCE_EXHAUSTED')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      } finally {
        setQuery('');
        setIsOpen(false);
        resetSession();
      }
    },
    [placesLib, onPlaceChosen, resetSession]
  );

  return (
    <div className="relative flex-1 min-w-[220px]">
      <label htmlFor="location-search" className="sr-only">
        Search city, neighborhood, or street address
      </label>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          id="location-search"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search any city, neighborhood, or address..."
          className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              resetSession();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-3.5 py-2.5 text-xs text-slate-500">
              Searching locations...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3.5 py-2.5 text-xs text-slate-500">
              No matching locations found.
            </div>
          ) : (
            <ul role="listbox" className="divide-y divide-slate-100">
              {suggestions.map((suggestion, idx) => (
                <li key={suggestion.placePrediction?.placeId ?? idx}>
                  <button
                    type="button"
                    onClick={() => void handleSelectSuggestion(suggestion)}
                    className="w-full text-left px-3.5 py-2.5 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    {suggestion.placePrediction?.text.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function AirQualityMap({
  location,
  airQuality,
  heatmapLayer,
  heatmapOpacity,
  isLoadingData,
  onSelectLocation,
  onMapClickCoordinates,
  onHeatmapLayerChange,
  onHeatmapOpacityChange,
}: AirQualityMapProps) {
  const apiStatus = useApiLoadingStatus();
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const { preferred } = getPrimaryIndex(airQuality);
  const severity = getSeverityMeta(preferred);

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const latLng = event.detail.latLng;
      if (!latLng) return;
      onMapClickCoordinates(latLng.lat, latLng.lng);
    },
    [onMapClickCoordinates]
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser location is not supported on this device.');
      return;
    }
    setGeoStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus(null);
        onMapClickCoordinates(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoStatus('Location permission denied. Search or tap the map instead.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [onMapClickCoordinates]);

  const mapFailed =
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  return (
    <section aria-label="Interactive air quality map" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Top Search & City Switcher Toolbar */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <LocationSearchInput onPlaceChosen={onSelectLocation} />
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <LocateFixed className="w-4 h-4 text-teal-700" />
            Use My Location
          </button>
        </div>

        {geoStatus && (
          <p className="text-xs text-slate-500">{geoStatus}</p>
        )}

        {/* Winter Smog Monitoring Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-xs text-slate-400 mr-1 whitespace-nowrap shrink-0">
            Smog basins:
          </span>
          {PRESET_CITIES.map((city) => {
            const active =
              Math.abs(city.lat - location.lat) < 0.05 &&
              Math.abs(city.lng - location.lng) < 0.05;
            return (
              <button
                key={city.name}
                type="button"
                onClick={() => onSelectLocation(city)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {city.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Canvas Container with explicit height (prevents CF2 0x0 collapse) */}
      <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[540px] bg-slate-100">
        {mapFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
            <Crosshair className="w-8 h-8 text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-800">
              Interactive map tiles could not load
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Air quality readings, forecast analysis, and Gemini guidance remain available for selected locations.
            </p>
          </div>
        ) : (
          <GoogleMap
            defaultCenter={{ lat: location.lat, lng: location.lng }}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={true}
            onClick={handleMapClick}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <HeatmapOverlayController
              layer={heatmapLayer}
              opacity={heatmapOpacity}
              center={{ lat: location.lat, lng: location.lng }}
            />

            <AdvancedMarker position={{ lat: location.lat, lng: location.lng }}>
              <div
                style={{
                  backgroundColor: severity.markerBg,
                  color: severity.markerText,
                }}
                className="px-2.5 py-1.5 rounded-lg shadow-md border border-white/80 flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums"
              >
                <span aria-hidden="true">{severity.symbol}</span>
                <span>
                  {isLoadingData
                    ? '...'
                    : preferred
                      ? `${preferred.aqiDisplay} ${preferred.code === 'uaqi' ? 'UAQI' : 'AQI'}`
                      : 'Probe'}
                </span>
              </div>
            </AdvancedMarker>
          </GoogleMap>
        )}

        {/* Map Hint Footer Overlay */}
        <div className="pointer-events-none absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-600 font-mono tabular-nums shadow-xs">
          Click anywhere on map to inspect · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
      </div>

      {/* Heatmap Layer Controls & Legend Bar */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 mr-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Heatmap Overlay
          </span>
          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
            {HEATMAP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onHeatmapLayerChange(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  heatmapLayer === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {heatmapLayer !== 'OFF' && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="heatmap-opacity"
              className="text-xs text-slate-500 whitespace-nowrap"
            >
              Opacity <span className="font-mono tabular-nums text-slate-700">{Math.round(heatmapOpacity * 100)}%</span>
            </label>
            <input
              id="heatmap-opacity"
              type="range"
              min={0.2}
              max={0.85}
              step={0.05}
              value={heatmapOpacity}
              onChange={(e) => onHeatmapOpacityChange(Number(e.target.value))}
              className="w-24 accent-teal-700 cursor-pointer"
            />
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 pl-2 border-l border-slate-200">
              <span>Clean</span>
              <span
                aria-hidden="true"
                className="w-16 h-2 rounded-sm bg-gradient-to-r from-emerald-500 via-amber-400 via-orange-500 to-rose-700"
              />
              <span>Severe</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
