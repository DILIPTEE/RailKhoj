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

export default function LiveMap({
  polyline = [],
  stations = [],
  position = null,
  info = null,
  theme = "light",
  height = "h-[360px]",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef(null);
  const tileRef = useRef(null);
  const markerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;
    groupRef.current = L.layerGroup().addTo(map);
    animRef.current = null;
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      tileRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(TILES[theme] || TILES.light, {
      maxZoom: 19,
      attribution: ATTR,
    }).addTo(map);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    markerRef.current = null;
    if (polyline.length > 1) {
      L.polyline(polyline, {
        color: theme === "dark" ? "#34d399" : "#00694e",
        weight: 4,
        opacity: 0.9,
      }).addTo(group);
      stations.forEach((s) => {
        L.circleMarker([s.lat, s.lng], {
          radius: 4,
          color: theme === "dark" ? "#e2e8f0" : "#1f2937",
          weight: 1.5,
          fillColor: "#ffffff",
          fillOpacity: 1,
        })
          .bindTooltip(langName(s))
          .addTo(group);
      });
      map.fitBounds(L.latLngBounds(polyline), { padding: [26, 26] });
    }
  }, [polyline, stations, theme]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (!position) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      if (markerRef.current) {
        group.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    const to = L.latLng(position.lat, position.lng);
    const halted = info && (info.atStation || (info.speedKmh != null && info.speedKmh === 0));
    if (!markerRef.current) {
      markerRef.current = L.marker(to, {
        icon: L.divIcon({
          className: "rk-train-icon",
          html: '<div class="rk-train-dot"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1000,
      }).addTo(group);
      animRef.current = null;
    } else if (halted) {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      markerRef.current.setLatLng(to);
    } else {
      // Glide smoothly from the currently displayed position to the fresh
      // server position (Google-Maps feel) instead of jumping every poll.
      const from = markerRef.current.getLatLng();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const start = performance.now();
      const dur = 2000;
      const step = (ts) => {
        const k = Math.min(1, (ts - start) / dur);
        const e = 1 - Math.pow(1 - k, 3); // ease-out cubic
        markerRef.current.setLatLng([
          from.lat + (to.lat - from.lat) * e,
          from.lng + (to.lng - from.lng) * e,
        ]);
        animRef.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    }
    // Google-Maps-style navigation label pinned to the train marker:
    // "রংপুর → দিনাজপুর · দিনাজপুর ১২.৩ কিমি দূরে · কাছের স্টেশন ..."
    if (info) {
      const html = infoHtml(info);
      if (html) {
        if (!markerRef.current.getTooltip()) {
          markerRef.current
            .bindTooltip(html, {
              direction: "top",
              offset: [0, -12],
              permanent: true,
              className: "rk-train-label",
            })
            .openTooltip();
        } else {
          markerRef.current.setTooltipContent(html);
        }
      }
    }
  }, [position, info]);

  return (
    <div
      ref={containerRef}
      className={"w-full overflow-hidden rounded-2xl z-0 " + height}
    />
  );
}

function langName(s) {
  return s.nameBn && document.documentElement.lang === "bn"
    ? s.nameBn
    : s.nameEn;
}

// Google-Maps-style label content for the train marker: segment, km to next
// stop, nearest station, speed / station-stop state and position accuracy.
function infoHtml(info) {
  const bn = document.documentElement.lang === "bn";
  const nm = (s) => (!s ? "" : bn ? s.nameBn || s.nameEn : s.nameEn || s.code);
  const lines = [];
  if (info.atStation) {
    lines.push(
      `🚉 ${nm(info.atStation)} — ${bn ? "দাঁড়িয়ে আছে" : "stopped"}` +
        (info.atStation.depInMin != null
          ? ` · ${info.atStation.depInMin} ${bn ? "মিনিট বাকি" : "min left"}`
          : "")
    );
  } else if (info.prevStop && info.nextStop) {
    lines.push(`🚆 ${nm(info.prevStop)} → ${nm(info.nextStop)}`);
  }
  if (info.nextStop && info.nextStop.kmAway != null)
    lines.push(
      `${nm(info.nextStop)} · ${info.nextStop.kmAway} ${bn ? "কিমি দূরে" : "km away"}`
    );
  if (info.nearStop && info.nearStop.kmAway != null)
    lines.push(
      `${bn ? "কাছের স্টেশন" : "Near station"}: ${nm(info.nearStop)} (${info.nearStop.kmAway} ${bn ? "কিমি" : "km"})`
    );
  if (info.speedKmh != null && info.speedKmh > 0)
    lines.push(`⚡ ${info.speedKmh} km/h`);
  if (info.reports > 0)
    lines.push(
      `👥 ${info.reports} ${bn ? "জন যাত্রীর GPS রিপোর্ট" : "passenger GPS reports"}`
    );
  if (info.positionSource)
    lines.push(
      bn
        ? info.positionSource === "crowd"
          ? "✅ যাত্রী রিপোর্টে যাচাইকৃত"
          : "📍 সময়সূচি-ভিত্তিক আনুমানিক অবস্থান"
        : info.positionSource === "crowd"
          ? "✅ Verified by passenger reports"
          : "📍 Timetable-based estimate"
    );
  return lines.join("<br/>");
}
