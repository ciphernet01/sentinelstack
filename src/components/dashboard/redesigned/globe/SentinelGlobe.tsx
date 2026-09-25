'use client';

import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  atmosphereFragmentShader,
  atmosphereVertexShader,
  earthFragmentShader,
  earthVertexShader,
  nodeFragmentShader,
} from './shaders';
import { createEarthPoints } from './utils/createEarthPoints';
import { latLngToVector3 } from './utils/latLngToVector3';
import worldData from '../../../../../public/data/world-countries.json';

const CYAN = new THREE.Color('#21d4fd');
const LAND_RADIUS = 1.78;
const BORDER_RADIUS = 1.792;
const INTERACTION_RADIUS = 1.805;

type NodeSpec = { lat: number; lng: number; lift?: number };
type ArcSpec = { from: number; to: number; lift?: number };

type CountryGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

type Country = {
  name: string;
  iso2: string;
  iso3: string;
  region: string;
  subregion: string;
  capital: string;
  population?: number;
  area?: number;
  lat: number;
  lng: number;
  geometry: CountryGeometry;
};

const COUNTRIES = (worldData as { features: Array<{ properties: Omit<Country, 'geometry'>; geometry: CountryGeometry }> }).features.map(
  (feature) => ({ ...feature.properties, geometry: feature.geometry }),
) as Country[];

const NETWORK_NODES: NodeSpec[] = [
  { lat: 40.7, lng: -74, lift: 0.06 },
  { lat: 51.5, lng: -0.1, lift: 0.08 },
  { lat: 25.2, lng: 55.3, lift: 0.08 },
  { lat: 28.6, lng: 77.2, lift: 0.06 },
  { lat: 1.3, lng: 103.8, lift: 0.07 },
  { lat: 35.7, lng: 139.7, lift: 0.08 },
  { lat: 37.8, lng: -122.4, lift: 0.07 },
  { lat: -23.5, lng: -46.6, lift: 0.06 },
  { lat: -33.9, lng: 151.2, lift: 0.08 },
  { lat: 52.5, lng: 13.4, lift: 0.06 },
  { lat: 19.4, lng: -99.1, lift: 0.07 },
  { lat: -1.3, lng: 36.8, lift: 0.08 },
];

const NETWORK_ARCS: ArcSpec[] = [
  { from: 0, to: 1, lift: 0.34 }, { from: 0, to: 6, lift: 0.25 }, { from: 0, to: 10, lift: 0.29 },
  { from: 1, to: 9, lift: 0.23 }, { from: 1, to: 3, lift: 0.38 }, { from: 9, to: 2, lift: 0.27 },
  { from: 2, to: 3, lift: 0.22 }, { from: 2, to: 4, lift: 0.31 }, { from: 3, to: 4, lift: 0.29 },
  { from: 4, to: 5, lift: 0.25 }, { from: 4, to: 8, lift: 0.38 }, { from: 5, to: 8, lift: 0.28 },
  { from: 6, to: 7, lift: 0.34 }, { from: 7, to: 10, lift: 0.24 }, { from: 7, to: 11, lift: 0.42 },
  { from: 10, to: 3, lift: 0.37 }, { from: 11, to: 2, lift: 0.33 },
];

function normalizeLng(lng: number) {
  let value = lng;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function vectorToLatLng(vector: THREE.Vector3) {
  const r = vector.length() || 1;
  const lat = Math.asin(THREE.MathUtils.clamp(vector.y / r, -1, 1)) * THREE.MathUtils.RAD2DEG;
  const theta = Math.atan2(vector.z, -vector.x);
  const lng = normalizeLng(theta * THREE.MathUtils.RAD2DEG - 180);
  return { lat, lng };
}

function pointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: number[][][]) {
  if (!polygon.length || !pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

function countryContains(country: Country, lng: number, lat: number) {
  if (country.geometry.type === 'Polygon') return pointInPolygon(lng, lat, country.geometry.coordinates);
  return country.geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon));
}

function findCountryAt(lng: number, lat: number) {
  // Small longitude wraparound guard for countries close to +/-180.
  const candidates = [lng, lng + 360, lng - 360];
  for (const candidateLng of candidates) {
    for (const country of COUNTRIES) {
      if (countryContains(country, candidateLng, lat)) return country;
    }
  }
  return null;
}

function countMappedNodes(country: Country) {
  return NETWORK_NODES.reduce((count, node) => count + (countryContains(country, node.lng, node.lat) ? 1 : 0), 0);
}

function EarthPointCloud({ onReady, onError }: { onReady?: () => void; onError?: () => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      '/branding/sentinel-globe-world-mask.png',
      (loadedTexture) => {
        if (!mounted) { loadedTexture.dispose(); return; }
        loadedTexture.colorSpace = THREE.NoColorSpace;
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
        onReady?.();
      },
      undefined,
      () => { if (mounted) { setFailed(true); onError?.(); } },
    );
    return () => { mounted = false; };
  }, [onReady, onError]);

  const points = useMemo(() => texture?.image ? createEarthPoints(texture.image, LAND_RADIUS, 2) : null, [texture]);
  const geometry = useMemo(() => {
    if (!points || points.count === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(points.positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(points.sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(points.seeds, 1));
    return geometry;
  }, [points]);
  const material = useMemo(() => {
    if (!points) return null;
    return new THREE.ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    });
  }, [points]);

  useFrame((state) => { if (material) material.uniforms.uTime.value = state.clock.elapsedTime; });
  useEffect(() => () => { geometry?.dispose(); material?.dispose(); texture?.dispose(); }, [geometry, material, texture]);
  if (failed || !geometry || !material) return null;
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function EarthBaseSphere() {
  return <mesh><sphereGeometry args={[1.765, 96, 64]} /><meshBasicMaterial color="#01070a" /></mesh>;
}

function Atmosphere() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCameraPosition: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#16d9ff') }, uIntensity: { value: 0.72 } },
  }), []);
  useFrame(({ camera }) => materialRef.current?.uniforms.uCameraPosition.value.copy(camera.position));
  useEffect(() => () => material.dispose(), [material]);
  return <mesh scale={1.035}><sphereGeometry args={[1.79, 96, 64]} /><primitive ref={materialRef} object={material} attach="material" /></mesh>;
}

function geometryRings(geometry: CountryGeometry) {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flatMap((polygon) => polygon);
}

function buildBorderGeometry() {
  const positions: number[] = [];
  for (const country of COUNTRIES) {
    for (const ring of geometryRings(country.geometry)) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const a = latLngToVector3(ring[i][1], ring[i][0], BORDER_RADIUS);
        const b = latLngToVector3(ring[i + 1][1], ring[i + 1][0], BORDER_RADIUS);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function CountryBorders({ hovered }: { hovered: Country | null }) {
  const geometry = useMemo(buildBorderGeometry, []);
  const highlightGeometry = useMemo(() => {
    if (!hovered) return null;
    const positions: number[] = [];
    for (const ring of geometryRings(hovered.geometry)) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const a = latLngToVector3(ring[i][1], ring[i][0], BORDER_RADIUS + 0.008);
        const b = latLngToVector3(ring[i + 1][1], ring[i + 1][0], BORDER_RADIUS + 0.008);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [hovered]);

  useEffect(() => () => { geometry.dispose(); highlightGeometry?.dispose(); }, [geometry, highlightGeometry]);

  return (
    <group>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial color="#1aaec1" transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {highlightGeometry ? (
        <lineSegments geometry={highlightGeometry} frustumCulled={false}>
          <lineBasicMaterial color="#b8fbff" transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      ) : null}
    </group>
  );
}

function NetworkNodes() {
  const geometry = useMemo(() => {
    const positions = NETWORK_NODES.flatMap((node) => { const v = latLngToVector3(node.lat, node.lng, 1.815 + (node.lift ?? 0)); return [v.x, v.y, v.z]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); return g;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `uniform float uPixelRatio; void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_PointSize=8.5*uPixelRatio*clamp(1.4/max(0.7,-mvPosition.z),0.6,1.7);gl_Position=projectionMatrix*mvPosition;}`,
    fragmentShader: nodeFragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: CYAN }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
  }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} />;
}

function curveForArc(arc: ArcSpec) {
  const a = NETWORK_NODES[arc.from]; const b = NETWORK_NODES[arc.to];
  const start = latLngToVector3(a.lat, a.lng, 1.82 + (a.lift ?? 0));
  const end = latLngToVector3(b.lat, b.lng, 1.82 + (b.lift ?? 0));
  const midpoint = start.clone().add(end).multiplyScalar(0.5).normalize();
  midpoint.multiplyScalar(1.82 + (arc.lift ?? 0.28) + start.distanceTo(end) * 0.08);
  return new THREE.QuadraticBezierCurve3(start, midpoint, end);
}

function NetworkParticle({ curve, offset }: { curve: THREE.QuadraticBezierCurve3; offset: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => { if (ref.current) ref.current.position.copy(curve.getPointAt((state.clock.elapsedTime * 0.045 + offset) % 1)); });
  return <mesh ref={ref}><sphereGeometry args={[0.022, 10, 10]} /><meshBasicMaterial color="#b8fbff" transparent opacity={0.95} blending={THREE.AdditiveBlending} /></mesh>;
}

function NetworkArcs() {
  const curves = useMemo(() => NETWORK_ARCS.map(curveForArc), []);
  return (
    <group>
      {curves.map((curve, index) => (
        <group key={`arc-${index}`}>
          <Line points={curve.getPoints(40)} color="#22dff0" transparent opacity={0.20} lineWidth={3.8} />
          <Line points={curve.getPoints(40)} color={index % 4 === 0 ? '#9afaff' : '#27cbd9'} transparent opacity={index % 4 === 0 ? 0.98 : 0.78} lineWidth={index % 4 === 0 ? 1.8 : 1.35} />
        </group>
      ))}
      {curves.slice(0, 12).map((curve, index) => <NetworkParticle key={`particle-${index}`} curve={curve} offset={(index * 0.083) % 1} />)}
    </group>
  );
}

function StarField() {
  const geometry = useMemo(() => {
    const count = 950; const positions = new Float32Array(count * 3); let seed = 17;
    const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < count; i += 1) { const radius = 4.2 + random() * 2.8; const theta = random() * Math.PI * 2; const phi = Math.acos(2 * random() - 1); positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta); positions[i * 3 + 1] = radius * Math.cos(phi); positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); return g;
  }, []);
  const material = useMemo(() => new THREE.PointsMaterial({ color: '#78d8df', size: 0.018, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} />;
}

function GlobeController({ onEarthReady, onEarthError, onCountryHover, onCountryLeave, onCursorMove }: {
  onEarthReady: () => void;
  onEarthError: () => void;
  onCountryHover: (country: Country) => void;
  onCountryLeave: () => void;
  onCursorMove: (x: number, y: number) => void;
})  {
  const globeRef = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const resumeAt = useRef(0);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);

  useFrame((state) => {
    const group = globeRef.current;
    if (!group) return;
    if (!dragging.current) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduced && performance.now() / 1000 > resumeAt.current) group.rotation.y += 0.00065;
    }
  });

  const handlePointerDown = useCallback((event: any) => {
    dragging.current = true;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    resumeAt.current = Infinity;
    event.stopPropagation();
  }, []);

  const handlePointerMove = useCallback((event: any) => {
    // R3F's event object can wrap the browser PointerEvent. Always read the
    // viewport coordinates from nativeEvent first so the tooltip follows the
    // real browser cursor, not the Three.js raycast coordinates.
    const nativeEvent = event?.nativeEvent ?? event;
    const clientX = Number(nativeEvent?.clientX);
    const clientY = Number(nativeEvent?.clientY);
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      onCursorMove(clientX, clientY);
    }

    const group = globeRef.current;
    if (!group) return;
    if (dragging.current) {
      const dx = clientX - lastPointer.current.x;
      const dy = clientY - lastPointer.current.y;
      group.rotation.y += dx * 0.0052;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * 0.0032, -0.7, 0.7);
      lastPointer.current = { x: clientX, y: clientY };
      return;
    }

    const localPoint = group.worldToLocal(event.point.clone());
    const { lat, lng } = vectorToLatLng(localPoint);
    const country = findCountryAt(lng, lat);
    if (country?.iso3 !== hoveredCountry?.iso3) {
      setHoveredCountry(country);

      if (country) {
        onCountryHover(country);
      }   else {
        onCountryLeave();
      }
    }
  }, [hoveredCountry, onCountryHover, onCountryLeave, onCursorMove]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    resumeAt.current = performance.now() / 1000 + 0.45;
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; resumeAt.current = performance.now() / 1000 + 0.45; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  return (
    <>
      <color attach="background" args={['#02080b']} />
      <group ref={globeRef} rotation={[0.04, -0.42, 0]}>
        <EarthBaseSphere />
        <EarthPointCloud onReady={onEarthReady} onError={onEarthError} />
        <CountryBorders hovered={hoveredCountry} />
        <Atmosphere />
        <NetworkArcs />
        <NetworkNodes />
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={() => { setHoveredCountry(null); onCountryLeave(); }}
          position={[0, 0, 0]}
        >
          <sphereGeometry args={[INTERACTION_RADIUS, 64, 48]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} color="#21d4fd" />
        </mesh>
      </group>
      <StarField />
    </>
  );
}

export function SentinelGlobe({ className }: { className?: string }) {
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [earthReady, setEarthReady] = useState(false);
  const [earthError, setEarthError] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const globeRootRef = useRef<HTMLDivElement>(null);

  // Track the browser pointer at the DOM level in capture phase. This is
  // deliberately independent of R3F's raycaster/event propagation. It makes
  // the cursor coordinates authoritative even when Three.js calls
  // stopPropagation() or changes its internal event target.
  useEffect(() => {
    const root = globeRootRef.current;
    if (!root) return;

    const handleDomPointerMove = (event: PointerEvent) => {
      setTooltip({ x: event.clientX, y: event.clientY });
    };

    root.addEventListener('pointermove', handleDomPointerMove, true);
    return () => root.removeEventListener('pointermove', handleDomPointerMove, true);
  }, []);

  const handleCursorMove = useCallback((x: number, y: number) => {
    setTooltip({ x, y });
  }, []);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglAvailable(Boolean(gl));
    } catch { setWebglAvailable(false); }
  }, []);

  const markEarthReady = useCallback(() => { setEarthError(false); setEarthReady(true); }, []);
  const markEarthError = useCallback(() => setEarthError(true), []);
  const handleCountryHover = useCallback((country: Country) => {
    setHoveredCountry(country);
  }, []);
  const handleCountryLeave = useCallback(() => setHoveredCountry(null), []);

  if (!webglAvailable) {
    return <div className={`sentinel-globe-fallback ${className ?? ''}`} role="img" aria-label="SentinelStack digital Earth visualization"><div className="sentinel-globe-fallback__orb"><div className="sentinel-globe-fallback__grid" /></div></div>;
  }

  return (
    <div
      ref={globeRootRef}
      className={`sentinel-globe ${className ?? ''}`}
      aria-label="SentinelStack digital Earth"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.2, 5.55], fov: 39, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop="always"
      >
        <GlobeController onEarthReady={markEarthReady} onEarthError={markEarthError} onCountryHover={handleCountryHover} onCountryLeave={handleCountryLeave} onCursorMove={handleCursorMove} />
      </Canvas>
      {hoveredCountry && typeof document !== 'undefined' ? createPortal(
        <div
          className="pointer-events-none fixed z-[2147483647] min-w-[220px] max-w-[260px] rounded-lg border border-cyan-200/15 bg-[#071317]/95 px-3 py-2.5 text-left shadow-[0_16px_40px_rgba(0,0,0,.45)] backdrop-blur-md"
          style={{
            left: `${tooltip.x}px`,
            // The tooltip is anchored to the cursor's bottom edge, then
            // translated upward by its own height plus an 8px gap. This
            // works identically whether the cursor is over the top, middle,
            // or bottom portion of the globe.
            top: `${tooltip.y}px`,
            margin: 0,
            transform: 'translateY(calc(-100% - 8px))',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-cyan-50">{hoveredCountry.name}</span>
            <span className="font-mono text-[8px] text-cyan-300/60">{hoveredCountry.iso2 || hoveredCountry.iso3}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px]">
            <span className="text-slate-600">Region</span><span className="text-right text-slate-300">{hoveredCountry.region || '—'}</span>
            <span className="text-slate-600">Capital</span><span className="text-right text-slate-300">{hoveredCountry.capital || '—'}</span>
            <span className="text-slate-600">Population</span><span className="text-right text-cyan-200">{hoveredCountry.population ? hoveredCountry.population.toLocaleString('en-IN') : '—'}</span>
          </div>
        </div>,
        document.body,
      ) : null}
      {!earthReady && !earthError ? <div className="sentinel-globe__loading" aria-live="polite"><span className="sentinel-globe__loading-dot" /><span>Rendering infrastructure surface</span></div> : null}
      {earthError ? <div className="sentinel-globe__asset-error" role="status"><span>Digital Earth asset unavailable</span></div> : null}
    </div>
  );
}
