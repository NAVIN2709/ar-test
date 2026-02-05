"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const AR_OBJECTS = [
  {
    id: "tclogo",
    model:
      "https://res.cloudinary.com/dosaigy3m/image/upload/v1770233896/glowing_gem_ncmwjz.glb",
    lat: 10.767406,
    lon: 78.813385,
  },
  {
    id: "gold_coin",
    model: "/models/gold_coin.glb",
    lat: 10.7678,
    lon: 78.8134,
  },
  {
    id: "tclogo2",
    name: "TC Logo 2",
    model: "/models/tc.glb",
    lat: 10.76668,
    lon: 78.81745,
  },
];

// ============================================
// LOW-QUALITY OPTIMIZATION SETTINGS
// ============================================
const QUALITY_SETTINGS = {
  pixelRatio: 0.5, // Half resolution (can go lower for more performance)
  antialias: false, // Disable anti-aliasing
  precision: "lowp", // Low precision math
  powerPreference: "low-power", // GPU hint
  radarFrameSkip: 4, // Redraw radar every 4 frames (15 FPS instead of 60)
  maxDrawDistance: 15, // Don't render models beyond 15m
};

export default function ARGame() {
  const canvasRef = useRef();
  const radarCanvasRef = useRef();
  const overlayRef = useRef();
  const arButtonRef = useRef(null);

  const sceneRef = useRef();
  const rendererRef = useRef();
  const loader = useRef(new GLTFLoader());
  const modelsRef = useRef({});
  const gradientCacheRef = useRef({}); // Cache gradients

  const headingRef = useRef(0);
  const lastHeadingRef = useRef(0);
  const userGpsRef = useRef(null);
  const frameCounterRef = useRef(0); // For throttling

  const [gpsReady, setGpsReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    "Acquiring GPS position...",
  );

  // ============================================
  // SETUP DRACO COMPRESSION
  // ============================================
  useEffect(() => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
    );
    loader.current.setDRACOLoader(dracoLoader);
  }, []);

  // ============================================
  // DEVICE HEADING (with smoothing)
  // ============================================
  useEffect(() => {
    const handle = (e) => {
      let newHeading;
      if (e.webkitCompassHeading != null) {
        newHeading = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        newHeading = 360 - e.alpha;
      }

      if (typeof newHeading === "number") {
        const smoothHeading =
          lastHeadingRef.current + (newHeading - lastHeadingRef.current) * 0.1;
        lastHeadingRef.current = smoothHeading;
        headingRef.current = smoothHeading;
      }
    };

    window.addEventListener("deviceorientationabsolute", handle, true);
    window.addEventListener("deviceorientation", handle, true);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, []);

  // ============================================
  // GPS POLLING
  // ============================================
  useEffect(() => {
    const poll = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userGpsRef.current = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          if (!gpsReady) {
            setGpsReady(true);
            setLoadingMessage("");
          }
          updateModels();
        },
        (error) => {
          setLoadingMessage("GPS Error: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 100000 },
      );
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [gpsReady]);

  // ============================================
  // THREE SETUP WITH LOW-QUALITY OPTIMIZATION
  // ============================================
  useEffect(() => {
    if (arButtonRef.current) {
      arButtonRef.current.remove();
      arButtonRef.current = null;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    // ✅ LOW-QUALITY RENDERER SETTINGS
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: QUALITY_SETTINGS.antialias, // false
      precision: QUALITY_SETTINGS.precision, // "lowp"
      powerPreference: QUALITY_SETTINGS.powerPreference, // "low-power"
    });

    // ✅ REDUCE PIXEL RATIO (Main performance boost)
    renderer.setPixelRatio(QUALITY_SETTINGS.pixelRatio); // 0.5x resolution
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    // ✅ DISABLE EXPENSIVE FEATURES
    renderer.shadowMap.enabled = false; // No shadow rendering
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.autoClear = true;

    renderer.xr.enabled = true;

    // ✅ USE CHEAP AMBIENT LIGHT ONLY
    // HemisphereLight is more expensive than AmbientLight
    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // Reduced intensity

    sceneRef.current = scene;
    rendererRef.current = renderer;

    if (gpsReady) {
      const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlayRef.current },
      });
      arButtonRef.current = arButton;
      document.body.appendChild(arButton);
    }

    // ✅ THROTTLED ANIMATION LOOP
    renderer.setAnimationLoop(() => {
      renderer.render(scene, renderer.xr.getCamera(camera));

      // Only redraw radar every N frames
      if (frameCounterRef.current % QUALITY_SETTINGS.radarFrameSkip === 0) {
        drawRadar();
      }
      frameCounterRef.current++;
    });

    return () => {
      if (arButtonRef.current) {
        arButtonRef.current.remove();
        arButtonRef.current = null;
      }
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };
  }, [gpsReady]);

  // ============================================
  // SHOW / HIDE MODELS (optimized)
  // ============================================
  async function updateModels() {
    const user = userGpsRef.current;
    if (!user) return;

    for (const obj of AR_OBJECTS) {
      const dist = getDistance(user, obj);

      if (dist < QUALITY_SETTINGS.maxDrawDistance && !modelsRef.current[obj.id]) {
        try {
          const gltf = await loader.current.loadAsync(obj.model);
          const model = gltf.scene;

          // ✅ OPTIMIZE GEOMETRY
          model.traverse((child) => {
            if (child.isMesh) {
              // Remove expensive attributes
              if (child.geometry.attributes.normal)
                child.geometry.deleteAttribute("normal");
              if (child.geometry.attributes.uv)
                child.geometry.deleteAttribute("uv");
              if (child.geometry.attributes.uv2)
                child.geometry.deleteAttribute("uv2");

              // Disable shadows
              child.castShadow = false;
              child.receiveShadow = false;

              // Use simple material rendering
              if (child.material) {
                child.material.side = THREE.FrontSide;
                child.material.flatShading = true; // Flat shading is faster
              }
            }
          });

          // ✅ SMALLER SCALE FOR LOW-QUALITY
          model.position.set(0, 0, -2);
          model.scale.set(0.25, 0.25, 0.25); // Even smaller
          sceneRef.current.add(model);
          modelsRef.current[obj.id] = model;
        } catch (error) {
          console.error(`Failed to load model ${obj.id}:`, error);
        }
      }

      if (dist >= QUALITY_SETTINGS.maxDrawDistance && modelsRef.current[obj.id]) {
        sceneRef.current.remove(modelsRef.current[obj.id]);

        // ✅ PROPER CLEANUP
        modelsRef.current[obj.id].traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        delete modelsRef.current[obj.id];
      }
    }
  }

  // ============================================
  // RADAR DRAW (optimized with gradient caching)
  // ============================================
  function drawRadar() {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: false,
      alpha: true,
    });

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;
    const heading = headingRef.current;

    ctx.clearRect(0, 0, size, size);

    // ✅ CACHE GRADIENT (Don't recreate every frame)
    const gradientKey = `${size}-${center}-${radius}`;
    if (!gradientCacheRef.current[gradientKey]) {
      const bgGradient = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        radius,
      );
      bgGradient.addColorStop(0, "rgba(0, 20, 10, 0.9)");
      bgGradient.addColorStop(1, "rgba(0, 10, 5, 0.95)");
      gradientCacheRef.current[gradientKey] = bgGradient;
    }

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradientCacheRef.current[gradientKey];
    ctx.fill();

    // Range rings (25m and 50m)
    ctx.strokeStyle = "rgba(0, 255, 100, 0.3)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(center, center, radius / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 255, 100, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cross lines
    ctx.strokeStyle = "rgba(0, 255, 100, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center, center + radius);
    ctx.moveTo(center - radius, center);
    ctx.lineTo(center + radius, center);
    ctx.stroke();

    // Cardinal directions
    const cardinals = [
      { label: "N", angle: 0, color: "#ff4444" },
      { label: "E", angle: 90, color: "#00ff88" },
      { label: "S", angle: 180, color: "#00ff88" },
      { label: "W", angle: 270, color: "#00ff88" },
    ];

    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const dir of cardinals) {
      const angleRad = (dir.angle * Math.PI) / 180;
      const labelRadius = radius - 12;
      const x = center + Math.sin(angleRad) * labelRadius;
      const y = center - Math.cos(angleRad) * labelRadius;
      ctx.fillStyle = dir.color;
      ctx.fillText(dir.label, x, y);
    }

    // Direction needle
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((heading * Math.PI) / 180);

    ctx.beginPath();
    ctx.moveTo(0, -radius + 20);
    ctx.lineTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fillStyle = "#00ff88";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, radius - 30);
    ctx.lineTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 100, 0.3)";
    ctx.fill();

    ctx.restore();

    // Objects on radar
    if (userGpsRef.current) {
      const scale = radius / 50;
      for (const obj of AR_OBJECTS) {
        const { x, y, dist } = getXY(userGpsRef.current, obj);
        if (dist > 50) continue;

        const dotX = center + x * scale;
        const dotY = center - y * scale;

        // Glow effect
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.fill();

        // Red dot
        ctx.beginPath();
        ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3333";
        ctx.fill();

        ctx.strokeStyle = "#ff6666";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // User dot
    ctx.beginPath();
    ctx.arc(center, center, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center, center, 3, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    // Range labels
    ctx.font = "9px Arial";
    ctx.fillStyle = "rgba(0, 255, 100, 0.6)";
    ctx.textAlign = "right";
    ctx.fillText("50m", center + radius - 5, center + 10);
    ctx.fillText("25m", center + radius / 2 - 3, center + 10);
  }

  // ============================================
  // MATH HELPERS
  // ============================================
  function getXY(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lon - a.lon) * (Math.PI / 180);

    const x =
      dLon * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)) * R;
    const y = dLat * R;

    return { x, y, dist: Math.sqrt(x * x + y * y) };
  }

  function getDistance(a, b) {
    const { dist } = getXY(a, b);
    return dist;
  }

  return (
    <div className="w-screen h-screen relative">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!gpsReady && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              border: "4px solid rgba(0, 255, 100, 0.3)",
              borderTop: "4px solid #00ff88",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p
            style={{
              marginTop: 20,
              color: "#00ff88",
              fontSize: 16,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {loadingMessage}
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* DOM Overlay container for WebXR */}
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Radar Canvas HUD */}
        <canvas
          ref={radarCanvasRef}
          width={140}
          height={140}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10,
            background: "rgba(0,0,0,0.6)",
            borderRadius: "50%",
            pointerEvents: "auto",
          }}
        />
      </div>
    </div>
  );
}