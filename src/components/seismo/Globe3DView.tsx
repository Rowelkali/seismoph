"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import type { EarthquakeEvent } from "@/lib/types";
import { severityOf, SEVERITY_COLOR, SEVERITY_LABEL } from "@/lib/ui";
import { formatPHTTime } from "@/lib/ui";

interface Props {
  earthquakes: EarthquakeEvent[];
  selectedId?: string | null;
  latestId?: string | null;
  onSelect?: (eq: EarthquakeEvent) => void;
  className?: string;
}

const EARTH_RADIUS = 100;
const DEPTH_SCALE = 0.3;

/** Full-screen 3D globe with realistic Earth appearance.
 *  Shows only the 3 most recent earthquakes with detailed hypocenter visualization.
 *  Designed to look professional — not a tech demo.
 */
export function Globe3DView({ earthquakes, selectedId, latestId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
    camera.position.set(200, 80, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Realistic Earth ---
    // Create a canvas texture for the Earth surface (continents in green/brown)
    const earthCanvas = document.createElement("canvas");
    earthCanvas.width = 2048;
    earthCanvas.height = 1024;
    const ectx = earthCanvas.getContext("2d")!;

    // Ocean (deep teal-blue)
    const oceanGrad = ectx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, "#0a2a3a");
    oceanGrad.addColorStop(0.5, "#0d3548");
    oceanGrad.addColorStop(1, "#0a2a3a");
    ectx.fillStyle = oceanGrad;
    ectx.fillRect(0, 0, 2048, 1024);

    // Draw simplified continents (green/brown landmasses)
    // These are approximate outlines — enough for a recognizable Earth
    const landColor = "#1a4d2e";
    const landColor2 = "#2d5f3f";
    const landColor3 = "#3a6b48";

    // Helper: draw a filled polygon on the canvas
    const drawLand = (pts: [number, number][], color: string) => {
      ectx.fillStyle = color;
      ectx.beginPath();
      pts.forEach(([px, py], i) => {
        if (i === 0) ectx.moveTo(px, py);
        else ectx.lineTo(px, py);
      });
      ectx.closePath();
      ectx.fill();
    };

    // Convert lat/lon to canvas pixels (2048x1024, equirectangular)
    const ll = (lon: number, lat: number): [number, number] => [
      ((lon + 180) / 360) * 2048,
      ((90 - lat) / 180) * 1024,
    ];

    // --- Approximate continent outlines ---
    // Africa
    drawLand([
      ll(0, 35), ll(10, 37), ll(20, 32), ll(30, 31), ll(35, 22), ll(40, 12),
      ll(42, 5), ll(45, 0), ll(42, -10), ll(40, -22), ll(35, -30), ll(25, -34),
      ll(18, -35), ll(12, -30), ll(8, -20), ll(10, -10), ll(8, 0), ll(0, 5),
      ll(-5, 10), ll(-8, 20), ll(0, 35),
    ], landColor);

    // Europe
    drawLand([
      ll(-10, 58), ll(0, 60), ll(10, 62), ll(20, 65), ll(30, 65), ll(40, 60),
      ll(45, 55), ll(40, 48), ll(30, 45), ll(20, 43), ll(10, 45), ll(0, 48),
      ll(-10, 50), ll(-10, 58),
    ], landColor2);

    // Asia (large landmass)
    drawLand([
      ll(40, 65), ll(60, 70), ll(80, 72), ll(100, 72), ll(120, 70), ll(140, 68),
      ll(150, 62), ll(145, 55), ll(140, 48), ll(135, 42), ll(130, 35), ll(125, 28),
      ll(120, 22), ll(115, 18), ll(110, 15), ll(105, 12), ll(100, 8), ll(95, 15),
      ll(90, 22), ll(85, 25), ll(80, 28), ll(75, 32), ll(70, 35), ll(65, 38),
      ll(60, 42), ll(55, 45), ll(50, 48), ll(45, 52), ll(40, 55), ll(40, 65),
    ], landColor);

    // India
    drawLand([
      ll(68, 35), ll(75, 35), ll(80, 30), ll(82, 22), ll(80, 15), ll(78, 8),
      ll(76, 10), ll(74, 18), ll(72, 25), ll(68, 30), ll(68, 35),
    ], landColor3);

    // Southeast Asia + Indonesia
    drawLand([
      ll(95, 18), ll(100, 15), ll(105, 10), ll(108, 5), ll(110, 0),
      ll(115, -2), ll(120, -5), ll(125, -8), ll(130, -5), ll(135, -2),
      ll(140, -5), ll(140, -8), ll(130, -10), ll(120, -8), ll(110, -8),
      ll(100, -5), ll(95, 0), ll(93, 5), ll(95, 12), ll(95, 18),
    ], landColor3);

    // Australia
    drawLand([
      ll(113, -22), ll(120, -18), ll(128, -15), ll(135, -12), ll(142, -10),
      ll(148, -18), ll(152, -25), ll(150, -35), ll(145, -38), ll(138, -35),
      ll(130, -32), ll(120, -35), ll(115, -32), ll(113, -28), ll(113, -22),
    ], landColor);

    // North America
    drawLand([
      ll(-168, 65), ll(-155, 70), ll(-140, 72), ll(-120, 72), ll(-100, 72),
      ll(-80, 70), ll(-65, 60), ll(-55, 50), ll(-60, 45), ll(-70, 42),
      ll(-75, 35), ll(-80, 30), ll(-82, 25), ll(-85, 22), ll(-90, 18),
      ll(-97, 16), ll(-105, 20), ll(-110, 25), ll(-115, 30), ll(-120, 35),
      ll(-125, 40), ll(-125, 48), ll(-130, 55), ll(-140, 58), ll(-155, 60),
      ll(-168, 60), ll(-168, 65),
    ], landColor2);

    // South America
    drawLand([
      ll(-75, 10), ll(-70, 12), ll(-60, 8), ll(-50, 0), ll(-45, -8),
      ll(-40, -15), ll(-38, -22), ll(-42, -30), ll(-48, -38), ll(-55, -45),
      ll(-60, -52), ll(-65, -55), ll(-70, -52), ll(-72, -45), ll(-75, -38),
      ll(-78, -30), ll(-78, -22), ll(-80, -15), ll(-80, -8), ll(-78, 0),
      ll(-75, 5), ll(-75, 10),
    ], landColor);

    // Philippine islands (simplified)
    drawLand([
      ll(120, 18), ll(122, 17), ll(123, 14), ll(122, 10), ll(125, 8),
      ll(126, 5), ll(125, 0), ll(122, -2), ll(120, 0), ll(118, 5),
      ll(119, 10), ll(120, 14), ll(120, 18),
    ], landColor3);

    // Japan
    drawLand([
      ll(130, 33), ll(135, 35), ll(140, 38), ll(142, 42), ll(140, 40),
      ll(135, 36), ll(132, 34), ll(130, 33),
    ], landColor3);

    // Add subtle texture noise (land texture)
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 1024;
      const pixel = ectx.getImageData(x, y, 1, 1).data;
      // Only add noise to land areas (green pixels)
      if (pixel[1] > 50 && pixel[1] < 120) {
        ectx.fillStyle = `rgba(${30 + Math.random() * 40}, ${60 + Math.random() * 40}, ${30 + Math.random() * 30}, 0.3)`;
        ectx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
    }

    // Create Earth mesh with the canvas texture
    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 8,
      specular: 0x222233,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Subtle atmosphere glow
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x3a7ca5,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0x6a7a8a, 0.6);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(200, 100, 150);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0x4a6a8a, 0.3);
    fillLight.position.set(-200, -50, -150);
    scene.add(fillLight);

    // --- Stars ---
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 500 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({
      color: 0x8899aa, size: 1.2, transparent: true, opacity: 0.4, sizeAttenuation: true,
    })));

    // --- Earthquake markers (only 3 most recent) ---
    const markers: THREE.Mesh[] = [];
    const visibleEqs = earthquakes.slice(0, 3); // Only show 3 most recent

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
      const markerSize = Math.max(2.5, Math.min(6, 1.5 + eq.magnitude * 0.8));

      // --- Epicenter: glowing sphere on surface ---
      // Outer glow ring (concentric)
      for (let r = 3; r >= 1; r--) {
        const ringGeo = new THREE.SphereGeometry(markerSize * (1 + r * 0.4), 16, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.08 * (4 - r),
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(surfacePos);
        scene.add(ring);
      }

      // Epicenter sphere
      const epiGeo = new THREE.SphereGeometry(markerSize, 20, 20);
      const epiMat = new THREE.MeshBasicMaterial({ color });
      const epiMesh = new THREE.Mesh(epiGeo, epiMat);
      epiMesh.position.copy(surfacePos);
      epiMesh.userData = { earthquake: eq };
      scene.add(epiMesh);
      markers.push(epiMesh);

      // White outline for latest/selected
      if (isLatest || isSelected) {
        const outlineGeo = new THREE.SphereGeometry(markerSize * 1.4, 16, 16);
        const outlineMat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.4,
        });
        const outline = new THREE.Mesh(outlineGeo, outlineMat);
        outline.position.copy(surfacePos);
        scene.add(outline);
        outline.userData = { pulse: true, baseScale: 1 };
      }

      // --- Hypocenter: underground sphere ---
      const depthUnits = Math.min(eq.depthKm * DEPTH_SCALE, EARTH_RADIUS * 0.65);
      const inwardDir = surfacePos.clone().normalize().negate();
      const hypoPos = surfacePos.clone().add(inwardDir.multiplyScalar(depthUnits));

      const hypoGeo = new THREE.SphereGeometry(markerSize * 0.6, 16, 16);
      const hypoMat = new THREE.MeshBasicMaterial({
        color: 0xff3322, transparent: true, opacity: 0.9,
      });
      const hypoMesh = new THREE.Mesh(hypoGeo, hypoMat);
      hypoMesh.position.copy(hypoPos);
      scene.add(hypoMesh);

      // Hypocenter glow
      const hypoGlowGeo = new THREE.SphereGeometry(markerSize * 1.2, 12, 12);
      const hypoGlowMat = new THREE.MeshBasicMaterial({
        color: 0xff3322, transparent: true, opacity: 0.15,
      });
      const hypoGlow = new THREE.Mesh(hypoGlowGeo, hypoGlowMat);
      hypoGlow.position.copy(hypoPos);
      scene.add(hypoGlow);

      // --- Beam from epicenter to hypocenter ---
      // Create a cylinder beam for better visibility
      const beamDist = surfacePos.distanceTo(hypoPos);
      const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, beamDist, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.5,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      // Position at midpoint
      beam.position.copy(surfacePos).lerp(hypoPos, 0.5);
      // Orient the cylinder along the beam direction
      beam.lookAt(hypoPos);
      beam.rotateX(Math.PI / 2);
      scene.add(beam);

      // --- Detail label (sprite) ---
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 320;
      labelCanvas.height = 100;
      const lctx = labelCanvas.getContext("2d")!;

      // Background card
      lctx.fillStyle = "rgba(10, 14, 20, 0.85)";
      lctx.roundRect(0, 0, 320, 100, 8);
      lctx.fill();
      lctx.strokeStyle = sevColor;
      lctx.lineWidth = 2;
      lctx.roundRect(0, 0, 320, 100, 8);
      lctx.stroke();

      // Magnitude (large)
      lctx.font = "bold 28px monospace";
      lctx.fillStyle = sevColor;
      lctx.textAlign = "left";
      lctx.fillText(`M ${eq.magnitude.toFixed(1)}`, 12, 32);

      // Severity label
      lctx.font = "500 12px sans-serif";
      lctx.fillStyle = "#888";
      lctx.fillText(SEVERITY_LABEL[sev].toUpperCase(), 100, 30);

      // Depth
      lctx.font = "500 14px monospace";
      lctx.fillStyle = "#ff5544";
      lctx.fillText(`▼ ${Math.round(eq.depthKm)} km depth`, 12, 54);

      // Time
      lctx.font = "500 11px sans-serif";
      lctx.fillStyle = "#aaa";
      lctx.fillText(formatPHTTime(eq.originTime) + " PHT", 12, 74);

      // LATEST badge
      if (isLatest) {
        lctx.fillStyle = "#ffffff";
        lctx.font = "bold 10px sans-serif";
        lctx.textAlign = "right";
        lctx.fillText("★ LATEST", 308, 16);
      }

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: labelTex, transparent: true,
      }));
      // Position label above the epicenter, offset outward
      const labelOffset = surfacePos.clone().normalize().multiplyScalar(20);
      labelSprite.position.copy(surfacePos).add(labelOffset);
      labelSprite.scale.set(35, 11, 1);
      scene.add(labelSprite);

      // Depth indicator label (at hypocenter)
      const depthLabelCanvas = document.createElement("canvas");
      depthLabelCanvas.width = 120;
      depthLabelCanvas.height = 30;
      const dlctx = depthLabelCanvas.getContext("2d")!;
      dlctx.fillStyle = "rgba(10, 14, 20, 0.8)";
      dlctx.fillRect(0, 0, 120, 30);
      dlctx.font = "bold 13px monospace";
      dlctx.fillStyle = "#ff5544";
      dlctx.textAlign = "center";
      dlctx.fillText(`${Math.round(eq.depthKm)} km`, 60, 20);
      const depthTex = new THREE.CanvasTexture(depthLabelCanvas);
      const depthSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: depthTex, transparent: true,
      }));
      depthSprite.position.copy(hypoPos).add(new THREE.Vector3(8, 8, 8));
      depthSprite.scale.set(18, 4.5, 1);
      scene.add(depthSprite);
    }

    // --- Interaction ---
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    let rotation = { x: 0.15, y: 1.8 };
    let targetRotation = { x: 0.15, y: 1.8 };
    let zoom = 280;
    let targetZoom = 280;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevPointer = { x: e.clientX, y: e.clientY };
      dragStart = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!isDragging) return;
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      targetRotation.y += dx * 0.006;
      targetRotation.x += dy * 0.006;
      targetRotation.x = Math.max(-1.3, Math.min(1.3, targetRotation.x));
      prevPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dragDist = Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);
      if (dragDist < 5 && onSelect) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(markers);
        if (hits.length > 0) {
          const eq = hits[0].object.userData.earthquake as EarthquakeEvent;
          if (eq) onSelect(eq);
        }
      }
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom += e.deltaY * 0.25;
      targetZoom = Math.max(140, Math.min(500, targetZoom));
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // --- Animation ---
    let frame = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      frame++;

      rotation.x += (targetRotation.x - rotation.x) * 0.08;
      rotation.y += (targetRotation.y - rotation.y) * 0.08;
      zoom += (targetZoom - zoom) * 0.08;

      camera.position.set(
        zoom * Math.cos(rotation.x) * Math.sin(rotation.y),
        zoom * Math.sin(rotation.x),
        zoom * Math.cos(rotation.x) * Math.cos(rotation.y),
      );
      camera.lookAt(0, 0, 0);

      // Slow auto-rotation when not dragging
      if (!isDragging) targetRotation.y += 0.0008;

      // Pulse selected/latest outlines
      scene.traverse((obj) => {
        if (obj.userData?.pulse) {
          const s = 1 + Math.sin(frame * 0.05) * 0.15;
          obj.scale.setScalar(s);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
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
      aria-label="3D interactive globe showing the 3 most recent earthquakes with underground hypocenter visualization"
    />
  );
}
