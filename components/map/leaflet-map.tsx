"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { FeatureCollection, Feature, Polygon, MultiPolygon, Position } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { PLACEHOLDER_CAMERAS } from "./placeholder-cameras";
import { SECTORS, SECTOR_META, type Sector } from "@/lib/sectors";

interface MapFacility {
  id: string;
  name: string;
  sector: Sector;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  camerasTotal: number;
  camerasOnline: number;
  openIncidents: number;
}

// Маркер объекта: цвет и буква сектора, красное кольцо — есть открытые инциденты
const facilityIcon = (f: MapFacility) => {
  const meta = SECTOR_META[f.sector];
  const alert = f.openIncidents > 0;
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        ${alert ? '<span class="absolute inline-flex h-7 w-7 rounded-full bg-red-500/40 animate-ping"></span>' : ""}
        <div class="relative flex h-6 w-6 items-center justify-center rounded-full border-2 ${alert ? "border-red-500" : "border-white"} text-[10px] font-bold text-white shadow-md transition-transform duration-200 hover:scale-125" style="background:${meta.color}">
          ${meta.short}
        </div>
      </div>
    `,
    className: "custom-div-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

type AreaKey = "district" | "city";

interface AreaConfig {
  label: string;
  title: string;
  subtitle: string;
  url: string;
  bounds: LatLngBoundsExpression;
  maxBounds: LatLngBoundsExpression;
}

// Границы из OpenStreetMap: район — relation 5550509, город — relation 3389772
const AREAS: Record<AreaKey, AreaConfig> = {
  district: {
    label: "Аль-Фараби",
    title: "Аль-Фарабийский район",
    subtitle: "г. Шымкент",
    url: "/data/al-farabi.geojson",
    bounds: [[42.1090, 69.4836], [42.3480, 69.6521]],
    maxBounds: [[42.05, 69.38], [42.41, 69.76]],
  },
  city: {
    label: "Весь город",
    title: "г. Шымкент",
    subtitle: "Все районы",
    url: "/data/shymkent.geojson",
    bounds: [[42.1090, 69.3018], [42.4794, 69.9357]],
    maxBounds: [[42.03, 69.18], [42.56, 70.06]],
  },
};

const AREA_KEYS: AreaKey[] = ["city", "district"];

// Перелетает к выбранной области и ограничивает перетаскивание её рамкой
function FitArea({ area }: { area: AreaConfig }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(undefined);
    map.flyToBounds(area.bounds, { duration: 0.8 });
    map.once("moveend", () => map.setMaxBounds(area.maxBounds));
  }, [map, area]);
  return null;
}

const getStatusLabelAndClass = (status: string) => {
  switch (status) {
    case "stable":
      return {
        label: "Стабильно",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      };
    case "warning":
      return {
        label: "Предупреждение",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      };
    case "critical":
    default:
      return {
        label: "Критично",
        className: "bg-red-500/10 text-red-600 dark:text-red-400"
      };
  }
};

const customMarkerIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="relative flex h-4 w-4 items-center justify-center rounded-full bg-background border-2 border-primary shadow-md transition-transform duration-200 hover:scale-125">
          <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
        </div>
      </div>
    `,
    className: "custom-div-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

// Полигон «весь мир с дыркой в форме района» — затемняет всё вокруг района
const buildOutsideMask = (district: FeatureCollection): Feature<Polygon> | null => {
  const geometry = district.features[0]?.geometry as Polygon | MultiPolygon | undefined;
  if (!geometry) return null;
  const holes: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((polygon) => polygon[0]);
  const world: Position[] = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
};

export default function LeafletMap() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [areaKey, setAreaKey] = useState<AreaKey>("city");
  const [boundaries, setBoundaries] = useState<Partial<Record<AreaKey, FeatureCollection>>>({});
  const [facilities, setFacilities] = useState<MapFacility[] | null>(null);
  const [layers, setLayers] = useState<Record<Sector, boolean>>(
    () => Object.fromEntries(SECTORS.map((s) => [s, true])) as Record<Sector, boolean>
  );
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  useEffect(() => {
    const loadFacilities = () =>
      fetch("/api/facilities")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => json && setFacilities(json.items))
        .catch(() => setFacilities([]));
    loadFacilities();
    const t = setInterval(loadFacilities, 60_000);
    return () => clearInterval(t);
  }, []);

  const visibleFacilities = useMemo(
    () => (facilities ?? []).filter((f) => layers[f.sector] && (!onlyAlerts || f.openIncidents > 0)),
    [facilities, layers, onlyAlerts]
  );
  const sectorCounts = useMemo(() => {
    const c: Partial<Record<Sector, { n: number; alerts: number }>> = {};
    (facilities ?? []).forEach((f) => {
      const cur = c[f.sector] ?? { n: 0, alerts: 0 };
      cur.n++;
      if (f.openIncidents > 0) cur.alerts++;
      c[f.sector] = cur;
    });
    return c;
  }, [facilities]);
  const hasFacilities = (facilities?.length ?? 0) > 0;

  useEffect(() => {
    // Determine theme from document class
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          const isDark = document.documentElement.classList.contains("dark");
          setTheme(isDark ? "dark" : "light");
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Initial check
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    AREA_KEYS.forEach((key) => {
      fetch(AREAS[key].url)
        .then(res => res.json())
        .then(data => setBoundaries(prev => ({ ...prev, [key]: data })))
        .catch(err => console.error(`Error loading ${key} GeoJSON`, err));
    });

    return () => observer.disconnect();
  }, []);

  const area = AREAS[areaKey];
  const boundary = boundaries[areaKey];
  const district = boundaries.district;
  const outsideMask = useMemo(() => (boundary ? buildOutsideMask(boundary) : null), [boundary]);

  const accent = theme === "dark" ? "#34d399" : "#15803d";

  const tileUrl = theme === "dark"
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

  return (
    <div className="w-full h-full relative z-0" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-2 rounded-md border border-border bg-background/90 p-2 shadow-sm backdrop-blur">
        <div className="px-1">
          <div className="text-sm font-semibold text-foreground">{area.title}</div>
          <div className="text-xs text-muted-foreground">{area.subtitle}</div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/40 p-1">
          {AREA_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAreaKey(key)}
              className={`h-7 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors ${
                areaKey === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {AREAS[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Слои объектов */}
      {hasFacilities && (
        <div className="absolute left-4 bottom-4 z-[1000] flex flex-col gap-1.5 rounded-md border border-border bg-background/90 p-3 shadow-sm backdrop-blur min-w-[210px]">
          <div className="text-xs font-semibold text-foreground mb-1">Слои объектов</div>
          {SECTORS.filter((s) => sectorCounts[s]).map((s) => (
            <label key={s} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={layers[s]}
                onChange={(e) => setLayers((prev) => ({ ...prev, [s]: e.target.checked }))}
                className="accent-[var(--primary)]"
              />
              <span className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: SECTOR_META[s].color }}>
                {SECTOR_META[s].short}
              </span>
              <span className="flex-1">{SECTOR_META[s].plural}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {sectorCounts[s]?.n}
                {sectorCounts[s]?.alerts ? <span className="text-red-500"> · {sectorCounts[s]?.alerts}!</span> : null}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer border-t border-border/60 pt-1.5 mt-1">
            <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} className="accent-red-500" />
            Только с открытыми инцидентами
          </label>
        </div>
      )}

      <MapContainer
        bounds={AREAS.city.bounds}
        maxBounds={AREAS.city.maxBounds}
        maxBoundsViscosity={1}
        zoomSnap={0.25}
        minZoom={10}
        maxZoom={18}
        attributionControl={false}
        zoomControl={false}
        className="w-full h-full"
        style={{ width: "100%", height: "100%", background: theme === "dark" ? "#0f0f0f" : "#f8f9fa" }}
      >
        <TileLayer key={theme} url={tileUrl} maxZoom={18} />
        {theme === "dark" && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        )}
        <ZoomControl position="topright" />
        <FitArea area={area} />

        {outsideMask && (
          <GeoJSON
            key={`mask-${areaKey}-${theme}`}
            data={outsideMask}
            interactive={false}
            style={{
              stroke: false,
              fillColor: theme === "dark" ? "#000000" : "#1f2937",
              fillOpacity: theme === "dark" ? 0.6 : 0.35,
            }}
          />
        )}

        {boundary && (
          <GeoJSON
            key={`boundary-${areaKey}-${theme}`}
            data={boundary}
            interactive={false}
            style={{ fill: false, weight: 3, color: accent }}
          />
        )}

        {/* В режиме «весь город» район остаётся виден пунктиром */}
        {areaKey === "city" && district && (
          <GeoJSON
            key={`district-hint-${theme}`}
            data={district}
            interactive={false}
            style={{ fill: false, weight: 1.5, dashArray: "6 4", color: accent }}
          />
        )}

        {visibleFacilities.map((f) => (
          <Marker key={f.id} position={[f.latitude, f.longitude]} icon={facilityIcon(f)}>
            <Popup className="custom-premium-popup font-sans">
              <div className="p-1 min-w-[220px]">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h4 className="font-semibold text-sm text-foreground leading-tight">{f.name}</h4>
                  <span className="text-[10px] font-medium shrink-0" style={{ color: SECTOR_META[f.sector].color }}>
                    {SECTOR_META[f.sector].label}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">{f.district} р-н, {f.address}</div>
                <div className="space-y-1 text-[11px] border-t pt-2 border-border/60">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Камеры онлайн:</span>
                    <span className="font-medium text-foreground">{f.camerasOnline}/{f.camerasTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Открытые инциденты:</span>
                    <span className={`font-medium ${f.openIncidents ? "text-red-600" : "text-foreground"}`}>{f.openIncidents}</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-2 text-[11px]">
                  <a href={`/objects?sector=${f.sector}&query=${encodeURIComponent(f.name)}`} className="text-primary hover:underline">Камеры объекта</a>
                  <a href={`/incidents?facilityId=${f.id}&status=all&days=30`} className="text-primary hover:underline">Инциденты</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {facilities !== null && !hasFacilities && PLACEHOLDER_CAMERAS.map((camera) => {
          const statusInfo = getStatusLabelAndClass(camera.status);
          return (
            <Marker
              key={camera.id}
              position={[camera.latitude, camera.longitude]}
              icon={customMarkerIcon()}
            >
              <Popup className="custom-premium-popup font-sans">
                <div className="p-1 min-w-[180px]">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h4 className="font-semibold text-sm text-foreground">{camera.name}</h4>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-muted-foreground border-t pt-2 border-border/60">
                    <div className="flex justify-between">
                      <span>Координаты:</span>
                      <span className="font-medium text-foreground">
                        {camera.latitude.toFixed(4)}, {camera.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div>Заглушка — реальная камера ещё не привязана</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
