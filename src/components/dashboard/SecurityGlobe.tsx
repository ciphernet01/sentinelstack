'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

type SecurityGlobeProps = { className?: string };

type RouteArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

// Purely decorative network topology. These lines are not security incidents,
// attack paths, or SentinelStack threat data.
const NETWORK_ARCS: RouteArc[] = [
  { startLat: 40.7, startLng: -74.0, endLat: 51.5, endLng: -0.1 },
  { startLat: 37.8, startLng: -122.4, endLat: 35.7, endLng: 139.7 },
  { startLat: 25.2, startLng: 55.3, endLat: 1.35, endLng: 103.8 },
  { startLat: 52.5, startLng: 13.4, endLat: 31.2, endLng: 121.5 },
  { startLat: 48.9, startLng: 2.35, endLat: 28.6, endLng: 77.2 },
  { startLat: -33.9, startLng: 151.2, endLat: 1.35, endLng: 103.8 },
  { startLat: 19.1, startLng: 72.9, endLat: 25.2, endLng: 55.3 },
  { startLat: 43.7, startLng: -79.4, endLat: 40.7, endLng: -74.0 },
  { startLat: 35.7, startLng: 139.7, endLat: 31.2, endLng: 121.5 },
  { startLat: 1.35, startLng: 103.8, endLat: 28.6, endLng: 77.2 },
  { startLat: 51.5, startLng: -0.1, endLat: 48.9, endLng: 2.35 },
  { startLat: 19.4, startLng: -99.1, endLat: 40.7, endLng: -74.0 },
  { startLat: -23.5, startLng: -46.6, endLat: 19.4, endLng: -99.1 },
  { startLat: -33.9, startLng: 18.4, endLat: 25.2, endLng: 55.3 },
  { startLat: 31.2, startLng: 121.5, endLat: 35.7, endLng: 139.7 },
];

/**
 * Presentation-only globe.
 *
 * The route lines are a visual network layer inspired by the official
 * Globe.GL airline-routes example; they are deliberately not presented as
 * SentinelStack security events or attack paths.
 */
export function SecurityGlobe({ className = '' }: SecurityGlobeProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<any>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(360, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !ready) return;

    const controls = globe.controls();
    controls.enableRotate = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.42;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.34;

    // Lock the camera radius as a second layer of protection against wheel,
    // trackpad and browser-specific OrbitControls zoom behaviour.
    globe.pointOfView({ lat: 18, lng: 8, altitude: 1.32 }, 0);
    const fixedDistance = globe.camera().position.length();
    controls.minDistance = fixedDistance;
    controls.maxDistance = fixedDistance;
    controls.update();

    const CLOUDS_IMG_URL = 'https://unpkg.com/three-globe/example/clouds/clouds.png';
    const CLOUDS_ALT = 0.004;
    let disposed = false;

    new THREE.TextureLoader().load(CLOUDS_IMG_URL, texture => {
      if (disposed || !globe.scene()) {
        texture.dispose();
        return;
      }

      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(globe.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
        new THREE.MeshPhongMaterial({
          map: texture,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );

      cloudMeshRef.current = clouds;
      globe.scene().add(clouds);

      const rotateClouds = () => {
        if (disposed || !cloudMeshRef.current) return;
        cloudMeshRef.current.rotation.y -= 0.006 * Math.PI / 180;
        frameRef.current = requestAnimationFrame(rotateClouds);
      };
      rotateClouds();
    }, undefined, () => undefined);

    return () => {
      disposed = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      const clouds = cloudMeshRef.current;
      if (clouds) {
        globe.scene()?.remove(clouds);
        clouds.geometry.dispose();
        const material = clouds.material as THREE.MeshPhongMaterial;
        material.map?.dispose();
        material.dispose();
        cloudMeshRef.current = null;
      }
    };
  }, [ready]);

  return (
    <div
      ref={wrapperRef}
      className={`relative h-[500px] min-h-[500px] overflow-hidden rounded-[8px] border border-cyan-400/20 bg-[#020b10] ${hovered ? 'border-cyan-300/45 shadow-[0_0_42px_rgba(21,194,241,.12)]' : ''} ${className}`}
      style={{ overscrollBehavior: 'contain' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onWheelCapture={(event) => {
        // Do not let wheel/trackpad gestures reach the globe controls. The
        // camera is intentionally fixed at one distance.
        event.stopPropagation();
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_48%,transparent_30%,rgba(1,7,11,.06)_58%,rgba(1,7,11,.55)_100%)]" />

      <div className="pointer-events-none absolute left-4 top-4 z-30">
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[.24em] text-cyan-300/75">Global Network Topology</div>
        <div className="mt-1 font-mono text-[8px] uppercase tracking-[.18em] text-slate-600">Live globe visualization / non-threat overlay</div>
      </div>

      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          animateIn={false}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor={hovered ? '#29E1FF' : '#16D9FF'}
          atmosphereAltitude={hovered ? 0.18 : 0.14}
          showAtmosphere
          arcsData={NETWORK_ARCS}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={() => 'rgba(33, 212, 253, 0.82)'}
          arcStroke={0.65}
          arcAltitudeAutoScale={0.45}
          arcDashLength={0.22}
          arcDashGap={0.95}
          arcDashInitialGap={(d: RouteArc, i: number) => (i * 0.17) % 1}
          arcDashAnimateTime={3600}
          arcsTransitionDuration={0}
          pointsData={[]}
          enablePointerInteraction={false}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[.18em] text-slate-600">Globe status</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {ready ? 'ONLINE' : 'INITIALIZING'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[8px] uppercase tracking-[.18em] text-slate-600">Camera</div>
          <div className="mt-1 font-mono text-[10px] text-cyan-300/80">FIXED / ROTATION ONLY</div>
        </div>
      </div>
    </div>
  );
}
