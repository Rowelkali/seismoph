"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { EarthquakeEvent } from "@/lib/types";
import { severityOf, SEVERITY_COLOR } from "@/lib/ui";
import { PH_CENTER } from "@/lib/geo";

interface Props {
  earthquakes: EarthquakeEvent[];
  selectedId?: string | null;
  latestId?: string | null;
  onSelect?: (eq: EarthquakeEvent) => void;
  className?: string;
}

const EARTH_RADIUS = 100;
const DEPTH_SCALE = 0.35;

/** Full-screen 3D globe showing ALL earthquakes with underground hypocenters.
 *  This is a MAP STYLE — replaces the MapLibre 2D map when "3D Globe" is selected.
 *  Each earthquake shows:
 *  - Surface epicenter marker (colored by magnitude)
 *  - Underground hypocenter at actual depth
 *  - Beam connecting them
 *  Users can drag to rotate, scroll to zoom, tilt to see underground.
 */
export function Globe3DView({ earthquakes, selectedId, latestId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const markersRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f14);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(180, 100, 180);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Earth sphere (semi-transparent)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x1a2a3a,
      transparent: true,
      opacity: 0.3,
      shininess: 5,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Wireframe overlay
    const wireGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, 32, 32);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x2a4a5a,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    scene.add(new THREE.Mesh(wireGeo, wireMat));

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 200, 200);
    scene.add(dirLight);

    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 400 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0x444466, size: 1.5, transparent: true, opacity: 0.5 })));

    // ---- Earthquake markers ----
    markersRef.current = [];
    const visibleEqs = earthquakes.slice(0, 80); // limit for performance

    for (const eq of visibleEqs) {
      const latRad = (eq.latitude * Math.PI) / 180;
      const lonRad = (eq.longitude * Math.PI) / 180;
      const surfacePos = new THREE.Vector3(
        EARTH_RADIUS * Math.cos(latRad) * Math.cos(lonRad),
        EARTH_RADIUS * Math.sin(latRad),
        EARTH_RADIUS * Math.cos(latRad) * Math.sin(lonRad),
      );

      const sev = severityOf(eq.magnitude);
      const sevColor = SEVERITY_COLOR[sev];
      const color = new THREE.Color(sevColor);
      const isLatest = eq.id === latestId;
      const isSelected = eq.id === selectedId;

      // Marker size based on magnitude
      const markerSize = Math.max(2, Math.min(8, 2 + eq.magnitude * 1.2));

      // Epicenter sphere
      const epiGeo = new THREE.SphereGeometry(markerSize, 12, 12);
      const epiMat = new THREE.MeshBasicMaterial({ color });
      const epiMesh = new THREE.Mesh(epiGeo, epiMat);
      epiMesh.position.copy(surfacePos);
      epiMesh.userData = { earthquake: eq, type: "epicenter" };
      scene.add(epiMesh);
      markersRef.current.push(epiMesh);

      // Glow for latest/selected
      if (isLatest || isSelected) {
        const glowGeo = new THREE.SphereGeometry(markerSize * 2, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(surfacePos);
        scene.add(glow);
        // Store for pulsing
        glow.userData = { pulse: true, baseScale: 1 };
        epiMesh.userData.glow = glow;
      }

      // Hypocenter (underground)
      const depthUnits = Math.min(eq.depthKm * DEPTH_SCALE, EARTH_RADIUS * 0.7);
      const inwardDir = surfacePos.clone().normalize().negate();
      const hypoPos = surfacePos.clone().add(inwardDir.multiplyScalar(depthUnits));

      const hypoGeo = new THREE.SphereGeometry(markerSize * 0.7, 8, 8);
      const hypoMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.8 });
      const hypoMesh = new THREE.Mesh(hypoGeo, hypoMat);
      hypoMesh.position.copy(hypoPos);
      scene.add(hypoMesh);

      // Beam from surface to hypocenter
      const beamGeo = new THREE.BufferGeometry().setFromPoints([surfacePos, hypoPos]);
      const beamMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
      scene.add(new THREE.Line(beamGeo, beamMat));

      // For M5+, add depth label
      if (eq.magnitude >= 5 || isLatest || isSelected) {
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 128;
        labelCanvas.height = 32;
        const lctx = labelCanvas.getContext("2d")!;
        lctx.fillStyle = "rgba(12,15,20,0.8)";
        lctx.fillRect(0, 0, 128, 32);
        lctx.font = "bold 14px monospace";
        lctx.fillStyle = sevColor;
        lctx.textAlign = "center";
        lctx.fillText(`M${eq.magnitude.toFixed(1)} · ${Math.round(eq.depthKm)}km`, 64, 22);
        const tex = new THREE.CanvasTexture(labelCanvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.position.copy(surfacePos).add(new THREE.Vector3(0, 12, 0));
        sprite.scale.set(20, 5, 1);
        scene.add(sprite);
      }
    }

    // ---- Interaction ----
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotation = { x: 0.2, y: 0.5 };
    let targetRotation = { x: 0.2, y: 0.5 };
    let zoom = 250;
    let targetZoom = 250;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      // Update mouse for raycasting (click detection)
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      targetRotation.y += dx * 0.008;
      targetRotation.x += dy * 0.008;
      targetRotation.x = Math.max(-1.4, Math.min(1.4, targetRotation.x));
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      // If it was a click (not a drag), check for earthquake hit
      const dragDist = Math.abs(e.clientX - prevMouse.x) + Math.abs(e.clientY - prevMouse.y);
      if (dragDist < 5 && onSelect) {
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(markersRef.current);
        if (intersects.length > 0) {
          const eq = intersects[0].object.userData.earthquake as EarthquakeEvent;
          if (eq) onSelect(eq);
        }
      }
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom += e.deltaY * 0.3;
      targetZoom = Math.max(120, Math.min(500, targetZoom));
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // ---- Animation loop ----
    let frame = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      frame++;

      rotation.x += (targetRotation.x - rotation.x) * 0.1;
      rotation.y += (targetRotation.y - rotation.y) * 0.1;
      zoom += (targetZoom - zoom) * 0.1;

      camera.position.set(
        zoom * Math.cos(rotation.x) * Math.sin(rotation.y),
        zoom * Math.sin(rotation.x),
        zoom * Math.cos(rotation.x) * Math.cos(rotation.y),
      );
      camera.lookAt(0, 0, 0);

      if (!isDragging) targetRotation.y += 0.001;

      // Pulse glows
      scene.traverse((obj) => {
        if (obj.userData?.pulse && obj.userData?.baseScale) {
          const s = obj.userData.baseScale + Math.sin(frame * 0.04) * 0.3;
          obj.scale.setScalar(s);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [earthquakes, selectedId, latestId, onSelect]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full cursor-grab active:cursor-grabbing", className)}
      role="application"
      aria-label="3D interactive globe showing earthquake epicenters and underground hypocenters"
    />
  );
}
