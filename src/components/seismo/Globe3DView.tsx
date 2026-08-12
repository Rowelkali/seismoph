"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { EarthquakeEvent } from "@/lib/types";
import { severityOf, SEVERITY_LABEL, formatPHTTime } from "@/lib/ui";

// Hex colors for Three.js (CSS variables don't work in WebGL)
const SEV_HEX: Record<string, string> = {
  minor: "#7c8a99",
  light: "#5eead4",
  moderate: "#f5c451",
  strong: "#f59331",
  major: "#e6492d",
  great: "#b8271a",
};
import { WORLD_COASTLINE } from "@/lib/world-coastline";
import { PH_CITIES } from "@/lib/ingestion/seed-data";
import { FAULTS } from "@/components/map/faults";

interface Props {
  earthquakes: EarthquakeEvent[];
  selectedId?: string | null;
  latestId?: string | null;
  onSelect?: (eq: EarthquakeEvent) => void;
  className?: string;
}

const EARTH_RADIUS = 100;
const DEPTH_SCALE = 0.25;

/** Convert lat/lon to 3D position on sphere */
function latLonTo3D(lat: number, lon: number, radius: number): THREE.Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(latRad) * Math.cos(lonRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.sin(lonRad),
  );
}

/** Full-screen 3D globe with real world coastline data.
 *  Shows 3 most recent earthquakes with proportional depth visualization.
 */
export function Globe3DView({ earthquakes, selectedId, latestId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b10);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 2000);
    camera.position.set(200, 60, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Create Earth texture from REAL coastline data ---
    const texCanvas = document.createElement("canvas");
    texCanvas.width = 2048;
    texCanvas.height = 1024;
    const tctx = texCanvas.getContext("2d")!;

    // Ocean: deep dark blue-teal gradient
    const oceanGrad = tctx.createRadialGradient(1024, 512, 200, 1024, 512, 1200);
    oceanGrad.addColorStop(0, "#0a2030");
    oceanGrad.addColorStop(1, "#06121e");
    tctx.fillStyle = oceanGrad;
    tctx.fillRect(0, 0, 2048, 1024);

    // Draw REAL world coastlines from Natural Earth data
    for (const polygon of WORLD_COASTLINE) {
      tctx.beginPath();
      polygon.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * 2048;
        const y = ((90 - lat) / 180) * 1024;
        if (i === 0) tctx.moveTo(x, y);
        else tctx.lineTo(x, y);
      });
      tctx.closePath();
      // Land fill: dark green-grey
      tctx.fillStyle = "#142028";
      tctx.fill();
      // Coastline stroke: subtle teal
      tctx.strokeStyle = "rgba(60, 120, 140, 0.25)";
      tctx.lineWidth = 0.5;
      tctx.stroke();
    }

    // Highlight the Philippines region with a slightly brighter land color
    for (const polygon of WORLD_COASTLINE) {
      // Check if polygon is in PH bounds (rough check)
      const inPH = polygon.some(([lon, lat]) => lon >= 115 && lon <= 127 && lat >= 4 && lat <= 21);
      if (inPH) {
        tctx.beginPath();
        polygon.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * 2048;
          const y = ((90 - lat) / 180) * 1024;
          if (i === 0) tctx.moveTo(x, y);
          else tctx.lineTo(x, y);
        });
        tctx.closePath();
        tctx.fillStyle = "#1a2e22";
        tctx.fill();
        tctx.strokeStyle = "rgba(94, 234, 212, 0.3)";
        tctx.lineWidth = 0.8;
        tctx.stroke();
      }
    }

    // Draw lat/lon grid (subtle)
    tctx.strokeStyle = "rgba(60, 80, 100, 0.06)";
    tctx.lineWidth = 0.5;
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = ((90 - lat) / 180) * 1024;
      tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(2048, y); tctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 20) {
      const x = ((lon + 180) / 360) * 2048;
      tctx.beginPath(); tctx.moveTo(x, 0); tctx.lineTo(x, 1024); tctx.stroke();
    }

    // Draw fault lines on the texture
    for (const fault of FAULTS) {
      tctx.beginPath();
      fault.coordinates.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * 2048;
        const y = ((90 - lat) / 180) * 1024;
        if (i === 0) tctx.moveTo(x, y);
        else tctx.lineTo(x, y);
      });
      tctx.strokeStyle = fault.type === "TRENCH" ? "rgba(224, 123, 90, 0.4)" : "rgba(245, 166, 35, 0.3)";
      tctx.lineWidth = 0.8;
      tctx.setLineDash([3, 2]);
      tctx.stroke();
      tctx.setLineDash([]);
    }

    // Draw major Philippine cities as dots on the texture
    for (const city of PH_CITIES) {
      const x = ((city.lon + 180) / 360) * 2048;
      const y = ((90 - city.lat) / 180) * 1024;
      tctx.fillStyle = "rgba(94, 234, 212, 0.5)";
      tctx.beginPath();
      tctx.arc(x, y, 1.5, 0, Math.PI * 2);
      tctx.fill();
    }

    // Create Earth mesh
    const earthTexture = new THREE.CanvasTexture(texCanvas);
    earthTexture.minFilter = THREE.LinearFilter;
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 6,
      specular: 0x111122,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Atmosphere glow (subtle)
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x2a5a7a, transparent: true, opacity: 0.06, side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // Lighting
    scene.add(new THREE.AmbientLight(0x4a5a6a, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(200, 80, 150);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x3a5a7a, 0.25);
    fill.position.set(-200, -30, -150);
    scene.add(fill);

    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 500;
    const sp = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 500 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      sp[i*3] = r * Math.sin(phi) * Math.cos(theta);
      sp[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      sp[i*3+2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({
      color: 0x667788, size: 1.0, transparent: true, opacity: 0.3, sizeAttenuation: true,
    })));

    // --- Earthquake markers (3 most recent) ---
    const markers: THREE.Mesh[] = [];
    const visibleEqs = earthquakes.slice(0, 3);

    for (const eq of visibleEqs) {
      const surfacePos = latLonTo3D(eq.latitude, eq.longitude, EARTH_RADIUS);
      const sev = severityOf(eq.magnitude);
      const sevColor = SEV_HEX[sev];
      const color = new THREE.Color(sevColor);
      const isLatest = eq.id === latestId;
      const isSelected = eq.id === selectedId;
      const markerSize = Math.max(2, Math.min(5, 1 + eq.magnitude * 0.6));

      // Epicenter glow rings
      for (let r = 2; r >= 1; r--) {
        const ringGeo = new THREE.SphereGeometry(markerSize * (1 + r * 0.5), 12, 12);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06 * (3 - r) });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(surfacePos);
        scene.add(ring);
      }

      // Epicenter sphere
      const epiGeo = new THREE.SphereGeometry(markerSize, 16, 16);
      const epiMat = new THREE.MeshBasicMaterial({ color });
      const epiMesh = new THREE.Mesh(epiGeo, epiMat);
      epiMesh.position.copy(surfacePos);
      epiMesh.userData = { earthquake: eq };
      scene.add(epiMesh);
      markers.push(epiMesh);

      // Latest/selected pulse
      if (isLatest || isSelected) {
        const pulseGeo = new THREE.SphereGeometry(markerSize * 1.5, 12, 12);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.copy(surfacePos);
        pulse.userData = { pulse: true };
        scene.add(pulse);
      }

      // Hypocenter (underground at actual depth)
      const depthUnits = Math.min(eq.depthKm * DEPTH_SCALE, EARTH_RADIUS * 0.6);
      const inwardDir = surfacePos.clone().normalize().negate();
      const hypoPos = surfacePos.clone().add(inwardDir.multiplyScalar(depthUnits));

      const hypoGeo = new THREE.SphereGeometry(markerSize * 0.5, 12, 12);
      const hypoMat = new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0.85 });
      const hypoMesh = new THREE.Mesh(hypoGeo, hypoMat);
      hypoMesh.position.copy(hypoPos);
      scene.add(hypoMesh);

      // Beam (cylinder)
      const beamDist = surfacePos.distanceTo(hypoPos);
      if (beamDist > 0.5) {
        const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, beamDist, 6);
        const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.copy(surfacePos).lerp(hypoPos, 0.5);
        beam.lookAt(hypoPos);
        beam.rotateX(Math.PI / 2);
        scene.add(beam);
      }

      // Info card label
      const lblCanvas = document.createElement("canvas");
      lblCanvas.width = 280;
      lblCanvas.height = 85;
      const lctx = lblCanvas.getContext("2d")!;
      lctx.fillStyle = "rgba(8, 11, 16, 0.9)";
      lctx.strokeStyle = sevColor;
      lctx.lineWidth = 1.5;
      lctx.beginPath();
      lctx.roundRect(0, 0, 280, 85, 6);
      lctx.fill();
      lctx.stroke();

      lctx.font = "bold 22px monospace";
      lctx.fillStyle = sevColor;
      lctx.textAlign = "left";
      lctx.fillText(`M ${eq.magnitude.toFixed(1)}`, 10, 28);

      lctx.font = "500 10px sans-serif";
      lctx.fillStyle = "#666";
      lctx.fillText(SEVERITY_LABEL[sev].toUpperCase(), 80, 26);

      lctx.font = "500 12px monospace";
      lctx.fillStyle = "#ff5544";
      lctx.fillText(`▼ ${Math.round(eq.depthKm)} km`, 10, 48);

      lctx.font = "500 10px sans-serif";
      lctx.fillStyle = "#999";
      lctx.fillText(formatPHTTime(eq.originTime) + " PHT", 10, 66);

      if (isLatest) {
        lctx.fillStyle = "#fff";
        lctx.font = "bold 9px sans-serif";
        lctx.textAlign = "right";
        lctx.fillText("★ LATEST", 270, 14);
      }

      const lblTex = new THREE.CanvasTexture(lblCanvas);
      const lblSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: lblTex, transparent: true }));
      const lblOffset = surfacePos.clone().normalize().multiplyScalar(18);
      lblSprite.position.copy(surfacePos).add(lblOffset);
      lblSprite.scale.set(30, 9, 1);
      scene.add(lblSprite);

      // Depth label at hypocenter
      const dCanvas = document.createElement("canvas");
      dCanvas.width = 100;
      dCanvas.height = 24;
      const dctx = dCanvas.getContext("2d")!;
      dctx.fillStyle = "rgba(8, 11, 16, 0.85)";
      dctx.fillRect(0, 0, 100, 24);
      dctx.font = "bold 12px monospace";
      dctx.fillStyle = "#ff5544";
      dctx.textAlign = "center";
      dctx.fillText(`${Math.round(eq.depthKm)} km`, 50, 16);
      const dTex = new THREE.CanvasTexture(dCanvas);
      const dSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dTex, transparent: true }));
      dSprite.position.copy(hypoPos).add(new THREE.Vector3(6, 6, 6));
      dSprite.scale.set(15, 3.5, 1);
      scene.add(dSprite);
    }

    // --- Interaction ---
    let isDragging = false;
    let prevP = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    let rot = { x: 0.12, y: 1.8 };
    let targetRot = { x: 0.12, y: 1.8 };
    let zoom = 270;
    let targetZoom = 270;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onDown = (e: PointerEvent) => { isDragging = true; prevP = { x: e.clientX, y: e.clientY }; dragStart = { x: e.clientX, y: e.clientY }; };
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      if (!isDragging) return;
      targetRot.y += (e.clientX - prevP.x) * 0.005;
      targetRot.x += (e.clientY - prevP.y) * 0.005;
      targetRot.x = Math.max(-1.3, Math.min(1.3, targetRot.x));
      prevP = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const d = Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);
      if (d < 5 && onSelect) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(markers);
        if (hits.length > 0) {
          const eq = hits[0].object.userData.earthquake as EarthquakeEvent;
          if (eq) onSelect(eq);
        }
      }
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); targetZoom = Math.max(140, Math.min(500, targetZoom + e.deltaY * 0.2)); };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let frame = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frame++;
      rot.x += (targetRot.x - rot.x) * 0.08;
      rot.y += (targetRot.y - rot.y) * 0.08;
      zoom += (targetZoom - zoom) * 0.08;
      camera.position.set(zoom * Math.cos(rot.x) * Math.sin(rot.y), zoom * Math.sin(rot.x), zoom * Math.cos(rot.x) * Math.cos(rot.y));
      camera.lookAt(0, 0, 0);
      if (!isDragging) targetRot.y += 0.0006;
      scene.traverse((o) => { if (o.userData?.pulse) o.scale.setScalar(1 + Math.sin(frame * 0.05) * 0.12); });
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [earthquakes, selectedId, latestId, onSelect]);

  return (
    <div ref={containerRef} className={cn("h-full w-full cursor-grab active:cursor-grabbing", className)}
      role="application" aria-label="3D globe with real world coastlines and earthquake hypocenter visualization" />
  );
}
