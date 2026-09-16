import React, { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);

const valid = (p) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  Math.abs(p.lat) < 85.05 &&
  Math.abs(p.lon) <= 180 &&
  !(p.lat === 0 && p.lon === 0);
const position = (p) => [p.lon, p.lat];
export default function RouteMap({ points, hover, demo }) {
  const node = useRef(null),
    mapRef = useRef(null),
    cursor = useRef(null);
  const [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  const route = useMemo(() => points.filter(valid), [points]);
  const fit = () => {
    if (!mapRef.current || route.length < 2) return;
    const bounds = route.reduce(
      (b, p) => b.extend(position(p)),
      new maplibregl.LngLatBounds(),
    );
    mapRef.current.fitBounds(bounds, { padding: 36, maxZoom: 16, duration: 0 });
  };
  useEffect(() => {
    if (!node.current || route.length < 2) return;
    setFailed(false);
    let map;
    try {
      map = new maplibregl.Map({
        container: node.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: position(route[0]),
        zoom: 12,
        dragRotate: false,
        pitchWithRotate: false,
        scrollZoom: false,
        attributionControl: { compact: false },
        locale: {
          "NavigationControl.ZoomIn": "지도 확대",
          "NavigationControl.ZoomOut": "지도 축소",
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left",
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
    map.on("error", () => setFailed(true));
    map.on("idle", () => {
      if (map.areTilesLoaded()) setFailed(false);
    });
    fit();
    const marker = (p, label, color) => {
      const el = document.createElement("div");
      el.className = "route-dot";
      el.style.backgroundColor = color;
      el.title = label;
      el.setAttribute("aria-label", label);
      return new maplibregl.Marker({ element: el })
        .setLngLat(position(p))
        .addTo(map);
    };
    marker(route[0], "출발", "#506982");
    marker(route.at(-1), "도착", "#b47552");
    cursor.current = marker(route[0], "차트에서 선택한 위치", "#303942");
    cursor.current.getElement().style.visibility = "hidden";
    map.on("load", () => {
      // Keep roads and place names, omit points of interest and building detail.
      for (const layer of map.getStyle().layers) {
        if (/poi|housenumber|building/i.test(layer.id))
          map.setLayoutProperty(layer.id, "visibility", "none");
      }
      const segments = [];
      let line = [],
        previous = null;
      for (const p of points) {
        if (!valid(p)) {
          if (line.length > 1) segments.push(line);
          line = [];
          previous = null;
          continue;
        }
        if (previous && p.time - previous.time > 120) {
          if (line.length > 1) segments.push(line);
          line = [];
        }
        line.push(position(p));
        previous = p;
      }
      if (line.length > 1) segments.push(line);
      map.addSource("running-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "MultiLineString", coordinates: segments },
        },
      });
      map.addLayer({
        id: "running-route-border",
        type: "line",
        source: "running-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fff", "line-width": 8, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "running-route",
        type: "line",
        source: "running-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#a76c42", "line-width": 4 },
      });
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(node.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      cursor.current = null;
    };
  }, [points, route, revision]);
  useEffect(() => {
    if (!cursor.current) return;
    cursor.current.getElement().style.visibility =
      hover && valid(hover) ? "visible" : "hidden";
    if (hover && valid(hover)) cursor.current.setLngLat(position(hover));
  }, [hover]);
  return (
    <section className="analysis-section route-section">
      <div className="analysis-toolbar">
        <h3>{demo ? "데모 경로" : "달린 경로"}</h3>
        {route.length > 1 && (
          <button className="text-button" onClick={fit}>
            전체 경로 보기
          </button>
        )}
      </div>
      {route.length > 1 ? (
        <>
          <div
            className="activity-map"
            ref={node}
            aria-label="달리기 경로 지도"
          />
          {failed && (
            <p className="helper" role="status">
              배경 지도를 불러오지 못했습니다.{" "}
              <button
                className="text-button"
                onClick={() => setRevision((r) => r + 1)}
              >
                지도 다시 로드
              </button>
            </p>
          )}
          <p className="helper">
            초록색 출발 · 갈색 도착 · 확대하거나 지도를 움직여 경로를
            살펴보세요. 차트의 위치도 지도에 표시됩니다.
          </p>
        </>
      ) : (
        <p className="analysis-empty">
          GPS 경로가 없는 활동입니다. 실내 활동과 위치 미기록 활동에는 지도를
          표시하지 않습니다.
        </p>
      )}
    </section>
  );
}
