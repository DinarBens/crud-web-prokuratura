"use client"

import "leaflet/dist/leaflet.css"
import React, { useEffect, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"

export interface CityPoint {
  name: string
  region: string
  lat: number
  lng: number
  incidents: number
  open: number
  critical: number
  facilities: number
}

const KZ_BOUNDS: LatLngBoundsExpression = [[40.5, 46.5], [55.5, 87.5]]

function FitTo({ points, selected }: { points: CityPoint[]; selected: string | null }) {
  const map = useMap()
  useEffect(() => {
    const target = points.find((p) => p.name === selected)
    if (target) map.flyTo([target.lat, target.lng], 11, { duration: 0.8 })
    else if (points.length > 1) map.flyToBounds(points.map((p) => [p.lat, p.lng]) as LatLngBoundsExpression, { padding: [60, 60], maxZoom: 7, duration: 0.8 })
    else if (points.length === 1) map.flyTo([points[0].lat, points[0].lng], 9, { duration: 0.8 })
  }, [map, points, selected])
  return null
}

// Карта Казахстана: кружок на город, размер — число событий за период, красная обводка — есть открытые
export default function OverviewMap({
  points,
  selected,
  onSelect,
}: {
  points: CityPoint[]
  selected: string | null
  onSelect: (city: string) => void
}) {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains("dark"))
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  const max = Math.max(1, ...points.map((p) => p.incidents))
  return (
    <MapContainer
      bounds={KZ_BOUNDS}
      zoomControl
      attributionControl={false}
      className="h-full w-full rounded-2xl"
      style={{ minHeight: 360, background: dark ? "#0f0f0f" : "#f1f5f9" }}
    >
      <TileLayer
        key={dark ? "d" : "l"}
        url={
          dark
            ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            : "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        }
      />
      <FitTo points={points} selected={selected} />
      {points.map((p) => (
        <CircleMarker
          key={p.name}
          center={[p.lat, p.lng]}
          radius={10 + Math.sqrt(p.incidents / max) * 22}
          pathOptions={{
            color: p.open > 0 ? "#dc2626" : "#16a34a",
            weight: p.name === selected ? 4 : 2,
            fillColor: p.critical > 0 ? "#dc2626" : "#16a34a",
            fillOpacity: 0.25,
          }}
          eventHandlers={{ click: () => onSelect(p.name) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <div className="text-xs">
              <div className="font-semibold">{p.name}</div>
              <div>{p.region}</div>
              <div>
                Объектов: {p.facilities} · событий: {p.incidents} · открытых: {p.open}
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
