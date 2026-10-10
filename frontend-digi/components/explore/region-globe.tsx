"use client";

import { Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useEffect, useRef, useState } from "react";
import type { RegionNode } from "@/lib/explore/regions";
import { formatUsdPerHour } from "@/lib/format";
import styles from "./region-market.module.css";

const HOME: [number, number] = [35, -22];
const GRID = geoGraticule10();

export default function RegionGlobe({ nodes, selected, onSelect, reset }: {
  nodes: RegionNode[]; selected: string | null; onSelect: (region: string) => void; reset: number;
}) {
  const [land, setLand] = useState<GeoPermissibleObjects | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [rotation, setRotation] = useState<[number, number]>(HOME);
  const rotationRef = useRef(rotation);
  const frame = useRef(0);
  const drag = useRef<{ x: number; y: number; rotation: [number, number]; moved: boolean } | null>(null);
  const reduced = useReducedMotion();
  const coordinates = nodes.find((node) => node.region === selected)?.coordinates;
  const longitude = coordinates?.[0];
  const latitude = coordinates?.[1];

  useEffect(() => {
    const controller = new AbortController();
    fetch("/maps/land-110m.json", { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error("Map unavailable");
      return response.json();
    }).then(setLand).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const target: [number, number] = longitude === undefined || latitude === undefined ? HOME : [-longitude, -latitude];
    const start = rotationRef.current;
    const delta = ((target[0] - start[0]) % 360 + 540) % 360 - 180;
    let began: number | undefined;
    const tick = (now: number) => {
      began ??= now;
      const t = reduced ? 1 : Math.min(1, (now - began) / 650);
      const ease = 1 - Math.pow(1 - t, 3);
      const next: [number, number] = [start[0] + delta * ease, start[1] + (target[1] - start[1]) * ease];
      rotationRef.current = next;
      setRotation(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [longitude, latitude, reset, reduced]);

  const projection = geoOrthographic().translate([350, 237]).scale(214).rotate(rotation).precision(0.5);
  const path = geoPath(projection);
  return <div className={styles.globeStage}>
    <div className={styles.stageCaption}><Text fz={11} c="dimmed">REGIONAL INVENTORY</Text><Text fz={12}>{nodes.length} regions · {nodes.reduce((sum, node) => sum + node.count, 0)} offers</Text></div>
    {failed ? <Stack className={styles.mapFallback} align="center" gap="sm"><Text>Map unavailable. Choose a region from the list.</Text><Button variant="default" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry map</Button></Stack> : <>
      {!land && <Text className={styles.loading} role="status" fz={12}>Loading geography…</Text>}
      <svg viewBox="0 0 700 480" className={styles.globe} aria-label="Interactive regional globe. Drag to rotate, or use the region list." role="group"
        onPointerDown={(event) => {
          if ((event.target as Element).closest('[role="button"]')) return;
          cancelAnimationFrame(frame.current);
          drag.current = { x: event.clientX, y: event.clientY, rotation: rotationRef.current, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = (event.clientX - drag.current.x) * 700 / event.currentTarget.getBoundingClientRect().width;
          const dy = (event.clientY - drag.current.y) * 480 / event.currentTarget.getBoundingClientRect().height;
          drag.current.moved = Math.abs(dx) + Math.abs(dy) > 4;
          const next: [number, number] = [drag.current.rotation[0] + dx * 0.3, Math.max(-80, Math.min(80, drag.current.rotation[1] - dy * 0.3))];
          rotationRef.current = next; setRotation(next);
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <path d={path({ type: "Sphere" }) ?? ""} fill="#1b1f22" stroke="#535a60" strokeWidth="1" />
        {land && <path d={path(land) ?? ""} fill="#343b40" stroke="#657078" strokeWidth="0.55" />}
        <path d={path(GRID) ?? ""} fill="none" stroke="#626d74" strokeWidth="0.5" opacity="0.3" />
        {nodes.map((node) => {
          if (!node.coordinates || geoDistance(node.coordinates, [-rotation[0], -rotation[1]]) > Math.PI / 2) return null;
          const [x, y] = projection(node.coordinates)!;
          return <g key={node.region} transform={`translate(${x},${y})`}>
            {selected === node.region && <circle r={node.radius + 7} fill="none" stroke="#FF6352" strokeWidth="1.5" />}
            <Tooltip withArrow label={<Stack gap={2}><Text size="sm" fw={600}>{node.region}</Text><Text size="xs">{node.count} {node.count === 1 ? "offer" : "offers"} · median {formatUsdPerHour(node.median)}</Text><Text size="xs">Lowest {formatUsdPerHour(node.lowest)}</Text><Text size="xs">{node.models.slice(0, 3).join(", ")}</Text></Stack>}>
              <circle r={node.radius} fill={node.color} stroke="#1b1d1f" strokeWidth="2" role="button" tabIndex={0}
                aria-label={`Select ${node.region}, ${node.count} ${node.count === 1 ? "offer" : "offers"}, median ${formatUsdPerHour(node.median)}`}
                aria-pressed={selected === node.region} className={styles.node}
                onClick={() => onSelect(node.region)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.region); } }} />
            </Tooltip>
            <text y={node.radius + 20} textAnchor="middle" fill="#F9F7F4" fontSize="12" paintOrder="stroke" stroke="#1b1f22" strokeWidth="3" pointerEvents="none">{node.region}</text>
          </g>;
        })}
      </svg>
    </>}
    <Group justify="space-between" className={styles.stageFooter}><Text fz={11} c="dimmed">Drag to rotate · Select a region</Text><Text fz={11} c="dimmed">Natural Earth</Text></Group>
  </div>;
}
