"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { VIBE_META } from "@/lib/vibe-ui";
import type { MapVenue } from "@/server/services/venues";

export const MAP_CENTER: [number, number] = [40.7235, -73.9865]; // East Village / Lower East Side

type Props = {
  venues: MapVenue[];
  userPos: { lat: number; lng: number } | null;
  userIsSimulated: boolean;
  selectedId: string | null;
  simMode: boolean;
  onSelect: (id: string) => void;
  onMapClick: (pos: { lat: number; lng: number }) => void;
};

/** Pin HTML is inserted raw by Leaflet, so every interpolated string must be escaped. */
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function pinHtml(v: MapVenue, selected: boolean) {
  const meta = VIBE_META[v.vibe];
  const noData = v.vibe === "NO_DATA";
  // "No data" is a hollow dashed ring with a "?"; "Dead" is a solid slate pin. Never confusable.
  const body = noData
    ? `<div style="width:26px;height:26px;border-radius:50%;border:2px dashed ${meta.color};background:rgba(11,11,18,.85);color:${meta.color};display:flex;align-items:center;justify-content:center;font:700 13px system-ui">?</div>`
    : `<div style="width:26px;height:26px;border-radius:50%;background:${meta.color};border:2px solid #0b0b12;box-shadow:0 0 ${v.vibe === "PACKED" ? 14 : 6}px ${meta.color}"></div>`;
  const badge = v.friendsGoing
    ? `<div style="position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#b388ff;color:#0b0b12;font:700 10px/16px system-ui;text-align:center;border:1.5px solid #0b0b12" title="${v.friendsGoing} friends going">${v.friendsGoing}</div>`
    : "";
  const ring = selected ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #f1f1f7"></div>` : "";
  return `<div style="position:relative;width:26px;height:26px" aria-label="${esc(v.name)}: ${esc(meta.label)}">${ring}${body}${badge}</div>`;
}

export default function LeafletMap({ venues, userPos, userIsSimulated, selectedId, simMode, onSelect, onMapClick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.CircleMarker | null>(null);
  const handlers = useRef({ onSelect, onMapClick, simMode });
  handlers.current = { onSelect, onMapClick, simMode };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(MAP_CENTER, 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (handlers.current.simMode) handlers.current.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const v of venues) {
      L.marker([v.lat, v.lng], {
        icon: L.divIcon({ html: pinHtml(v, v.id === selectedId), className: "", iconSize: [26, 26], iconAnchor: [13, 13] }),
        keyboard: true,
        title: v.name,
        zIndexOffset: v.id === selectedId ? 1000 : 0,
      })
        .on("click", () => handlers.current.onSelect(v.id))
        .addTo(g);
    }
  }, [venues, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!userPos) {
      me.current?.remove();
      me.current = null;
      return;
    }
    const style = { radius: 8, color: "#0b0b12", weight: 3, fillColor: userIsSimulated ? "#ffcc4d" : "#4da3ff", fillOpacity: 1 };
    if (!me.current) me.current = L.circleMarker([userPos.lat, userPos.lng], style).addTo(m);
    else me.current.setLatLng([userPos.lat, userPos.lng]).setStyle(style);
  }, [userPos, userIsSimulated]);

  useEffect(() => {
    if (map.current) map.current.getContainer().style.cursor = simMode ? "crosshair" : "";
  }, [simMode]);

  return <div ref={el} className="absolute inset-0" />;
}
