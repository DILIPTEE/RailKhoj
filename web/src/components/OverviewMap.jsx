import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILES = {
  light:
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function isBn() {
  return document.documentElement.lang === "bn";
}
const nm = (s) => (!s ? "" : isBn() ? s.nameBn || s.nameEn : s.nameEn || s.code);

// Google-Maps-style tooltip for a train marker: segment + km to next stop.
function tooltipHtml(t) {
  const isDelayed = t.status === "delayed";
  const color = isDelayed ? "#ef4444" : "#10b981";
  const statusText = isBn()
    ? isDelayed
      ? "দেরি"
      : "চলমান"
    : isDelayed
      ? "Delayed"
      : "Running";
  const delay =
    t.delayMin && t.delayMin > 2 ? ` (+${Math.round(t.delayMin)}m)` : "";
  const speed =
    t.position && t.position.speedKmh ? ` · ${t.position.speedKmh} km/h` : "";
  const name = isBn() ? t.nameBn || t.nameEn : t.nameEn;
  const seg =
    t.prevStop && t.nextStop
      ? `<div style="font-size:11px;font-weight:600;color:#334155">🚆 ${nm(t.prevStop)} → ${nm(t.nextStop)}</div>`
      : "";
  const halt = t.atStation
    ? `<div style="font-size:11px;font-weight:600;color:#b45309">🚉 ${nm(t.atStation)} · ${isBn() ? "দাঁড়িয়ে আছে" : "stopped"}</div>`
    : "";
  const km =
    t.nextStop && t.nextStop.kmAway != null
      ? `<div style="font-size:11px;color:#0f766e">${nm(t.nextStop)} · ${t.nextStop.kmAway} ${isBn() ? "কিমি দূরে" : "km away"}</div>`
      : "";
  return (
    `<div style="font-weight:600;font-size:12px">${name}</div>${seg}${halt}${km}` +
    `<div style="font-size:11px;color:${color}">${statusText}${delay}${speed}</div>`
  );
}

export default function OverviewMap({
  trains = [],
  theme = "light",
  height = "h-[400px]",
  onTrainClick = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const tileRef = useRef(null);
  const layerGroupRef = useRef(null);
  const fitKeyRef = useRef("");

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      attributionControl: true,
      zoomControl: true,
    });
    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    // Set initial view to Bangladesh
    map.setView([23.685, 90.3563], 7);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      markersRef.current = new Map();
      tileRef.current = null;
      fitKeyRef.current = "";
    };
  }, []);

  // Update tile layer on theme change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[theme] || TILES.light, {
      maxZoom: 19,
      attribution: ATTR,
    }).addTo(map);
  }, [theme]);

  // Update train markers
  useEffect(() => {
    const group = layerGroupRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    const currentIds = new Set(trains.map((t) => t.id));
    const markers = markersRef.current;

    // Remove markers for trains no longer running/delayed
    for (const [id, marker] of markers.entries()) {
      if (!currentIds.has(id)) {
        group.removeLayer(marker);
        markers.delete(id);
      }
    }

    // Add or update markers
    const bounds = [];
    trains.forEach((t) => {
      if (!t.position || t.position.lat == null || t.position.lng == null) return;
      const lat = t.position.lat;
      const lng = t.position.lng;
      bounds.push([lat, lng]);

      const isDelayed = t.status === "delayed";
      const color = isDelayed ? "#ef4444" : "#10b981";
      const existing = markers.get(t.id);

      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setStyle({ color, fillColor: color });
        existing.setTooltipContent(tooltipHtml(t));
      } else {
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          color: color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.7,
        }).addTo(group);

        marker.bindTooltip(tooltipHtml(t), {
          direction: "top",
          offset: [0, -8],
        });

        if (onTrainClick) {
          marker.on("click", () => onTrainClick(t.id));
        }

        markers.set(t.id, marker);
      }
    });

    // Fit bounds only when the set of trains changes, so users can freely
    // pan/zoom without the map re-centring on every live refresh.
    const fitKey = trains.map((t) => t.id).sort().join(",");
    if (bounds.length > 0 && fitKey !== fitKeyRef.current) {
      fitKeyRef.current = fitKey;
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 9 });
      } catch {
        // ignore fitBounds errors
      }
    }
  }, [trains, onTrainClick]);

  return (
    <div
      ref={containerRef}
      className={"w-full overflow-hidden rounded-2xl z-0 border border-slate-200 dark:border-slate-700 " + height}
    />
  );
}
