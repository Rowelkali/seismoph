"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Globe, X, RotateCcw } from "lucide-react";
import type { EarthquakeEvent } from "@/lib/types";
import { severityOf, SEVERITY_COLOR } from "@/lib/ui";

interface Props {
  earthquake: EarthquakeEvent;
  className?: string;
  onClose?: () => void;
}

const EARTH_RADIUS = 100;
const DEPTH_SCALE = 0.4; // depth km → scene units (scaled for visibility)

/** 3D Globe view with underground hypocenter visualization.
 *  Uses Three.js to render a sphere (Earth) with:
 *  - Surface epicenter marker (pulsing)
 *  - Vertical beam from surface to hypocenter
 *  - Underground hypocenter marker at actual depth
 *  - User can rotate/zoom to see the depth from any angle
 */
export function Globe3D({ earthquake, className, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f14);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(180, 120, 180);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ---- Earth sphere ----
    // Convert earthquake lat/lon to 3D position
    const latRad = (earthquake.latitude * Math.PI) / 180;
    const lonRad = (earthquake.longitude * Math.PI) / 180;
    const surfacePos = new THREE.Vector3(
      EARTH_RADIUS * Math.cos(latRad) * Math.cos(lonRad),
      EARTH_RADIUS * Math.sin(latRad),
      EARTH_RADIUS * Math.cos(latRad) * Math.sin(lonRad),
    );

    // Earth (semi-transparent so you can see the hypocenter inside)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x1a2a3a,
      transparent: true,
      opacity: 0.35,
      shininess: 5,
      wireframe: false,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Wireframe overlay for geographic context
    const wireGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, 32, 32);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x2a4a5a,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // ---- Lighting ----
    const ambient = new THREE.AmbientLight(0x404060, 1.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 200, 200);
    scene.add(dirLight);

    // ---- Epicenter marker (on surface) ----
    const sev = severityOf(earthquake.magnitude);
    const sevColor = SEVERITY_COLOR[sev];
    const color = new THREE.Color(sevColor);

    // Epicenter sphere
    const epiGeo = new THREE.SphereGeometry(4, 16, 16);
    const epiMat = new THREE.MeshBasicMaterial({ color });
    const epicenter = new THREE.Mesh(epiGeo, epiMat);
    epicenter.position.copy(surfacePos);
    scene.add(epicenter);

    // Epicenter glow
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(surfacePos);
    scene.add(glow);

    // ---- Hypocenter marker (underground) ----
    // Depth direction = inward from surface (toward center of Earth)
    const depthUnits = Math.min(earthquake.depthKm * DEPTH_SCALE, EARTH_RADIUS * 0.7);
    const inwardDir = surfacePos.clone().normalize().negate();
    const hypoPos = surfacePos.clone().add(inwardDir.multiplyScalar(depthUnits));

    const hypoGeo = new THREE.SphereGeometry(3, 16, 16);
    const hypoMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const hypocenter = new THREE.Mesh(hypoGeo, hypoMat);
    hypocenter.position.copy(hypoPos);
    scene.add(hypocenter);

    // Hypocenter glow
    const hypoGlowGeo = new THREE.SphereGeometry(6, 16, 16);
    const hypoGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.25 });
    const hypoGlow = new THREE.Mesh(hypoGlowGeo, hypoGlowMat);
    hypoGlow.position.copy(hypoPos);
    scene.add(hypoGlow);

    // ---- Beam from epicenter to hypocenter ----
    const beamGeo = new THREE.BufferGeometry().setFromPoints([surfacePos, hypoPos]);
    const beamMat = new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.6 });
    const beam = new THREE.Line(beamGeo, beamMat);
    scene.add(beam);

    // ---- Depth label (sprite) ----
    const depthCanvas = document.createElement("canvas");
    depthCanvas.width = 256;
    depthCanvas.height = 64;
    const dctx = depthCanvas.getContext("2d")!;
    dctx.fillStyle = "rgba(12,15,20,0.8)";
    dctx.fillRect(0, 0, 256, 64);
    dctx.font = "bold 24px monospace";
    dctx.fillStyle = sevColor;
    dctx.textAlign = "center";
    dctx.fillText(`${Math.round(earthquake.depthKm)} km`, 128, 40);
    const depthTexture = new THREE.CanvasTexture(depthCanvas);
    const depthSpriteMat = new THREE.SpriteMaterial({ map: depthTexture, transparent: true });
    const depthSprite = new THREE.Sprite(depthSpriteMat);
    const midPos = surfacePos.clone().lerp(hypoPos, 0.5);
    // Offset the label perpendicular to the beam
    const offset = new THREE.Vector3(0, 10, 0);
    depthSprite.position.copy(midPos).add(offset);
    depthSprite.scale.set(30, 8, 1);
    scene.add(depthSprite);

    // ---- Magnitude label ----
    const magCanvas = document.createElement("canvas");
    magCanvas.width = 256;
    magCanvas.height = 64;
    const mctx = magCanvas.getContext("2d")!;
    mctx.fillStyle = "rgba(12,15,20,0.8)";
    mctx.fillRect(0, 0, 256, 64);
    mctx.font = "bold 28px monospace";
    mctx.fillStyle = sevColor;
    mctx.textAlign = "center";
    mctx.fillText(`M ${earthquake.magnitude.toFixed(1)}`, 128, 42);
    const magTexture = new THREE.CanvasTexture(magCanvas);
    const magSpriteMat = new THREE.SpriteMaterial({ map: magTexture, transparent: true });
    const magSprite = new THREE.Sprite(magSpriteMat);
    magSprite.position.copy(surfacePos).add(new THREE.Vector3(0, 15, 0));
    magSprite.scale.set(35, 9, 1);
    scene.add(magSprite);

    // ---- Stars (background) ----
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 300;
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
    const starsMat = new THREE.PointsMaterial({ color: 0x444466, size: 1.5, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // ---- Interaction: mouse drag to rotate ----
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotation = { x: 0.3, y: 0.5 };
    let targetRotation = { x: 0.3, y: 0.5 };
    let zoom = 250;
    let targetZoom = 250;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      targetRotation.y += dx * 0.008;
      targetRotation.x += dy * 0.008;
      targetRotation.x = Math.max(-1.4, Math.min(1.4, targetRotation.x));
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom += e.deltaY * 0.3;
      targetZoom = Math.max(120, Math.min(500, targetZoom));
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - prevMouse.x;
      const dy = e.touches[0].clientY - prevMouse.y;
      targetRotation.y += dx * 0.008;
      targetRotation.x += dy * 0.008;
      targetRotation.x = Math.max(-1.4, Math.min(1.4, targetRotation.x));
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => { isDragging = false; };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    // ---- Animation loop ----
    let frame = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      frame++;

      // Smooth rotation
      rotation.x += (targetRotation.x - rotation.x) * 0.1;
      rotation.y += (targetRotation.y - rotation.y) * 0.1;
      zoom += (targetZoom - zoom) * 0.1;

      // Position camera based on rotation + zoom
      const cx = zoom * Math.cos(rotation.x) * Math.sin(rotation.y);
      const cy = zoom * Math.sin(rotation.x);
      const cz = zoom * Math.cos(rotation.x) * Math.cos(rotation.y);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);

      // Auto-rotate slowly when not dragging
      if (!isDragging) {
        targetRotation.y += 0.002;
      }

      // Pulse the epicenter glow
      const pulseScale = 1 + Math.sin(frame * 0.05) * 0.3;
      glow.scale.setScalar(pulseScale);
      hypoGlow.scale.setScalar(1 + Math.sin(frame * 0.04) * 0.2);

      renderer.render(scene, camera);
    };
    animate();
    setLoading(false);

    // ---- Resize handler ----
    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ---- Cleanup ----
    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [earthquake]);

  const resetView = () => {
    // Trigger re-render by changing the key
    if (containerRef.current) {
      const event = new Event("reset3D");
      window.dispatchEvent(event);
    }
  };

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-border bg-background", className)}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-background/90 to-transparent px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5 text-primary" />
          3D Hypocenter View
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={resetView}>
            <RotateCcw className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 3D canvas */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Loading 3D globe…
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>Drag to rotate · Scroll to zoom · Tilt to see depth underground</span>
        <span className="font-mono">M{earthquake.magnitude.toFixed(1)} · {Math.round(earthquake.depthKm)}km depth</span>
      </div>
    </div>
  );
}
