"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
];

export default function ARGame() {
  const canvasRef = useRef();
  const radarCanvasRef = useRef();
  const overlayRef = useRef();
  const arButtonRef = useRef(null);

  const sceneRef = useRef();
  const rendererRef = useRef();
  const loader = useRef(new GLTFLoader());
  const modelsRef = useRef({});

  const headingRef = useRef(0);
  const lastHeadingRef = useRef(0);
  const userGpsRef = useRef(null);

  const [gpsReady, setGpsReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(
    "Acquiring GPS position...",
  );

  // ---------------- DEVICE HEADING (with smoothing) ----------------
  useEffect(() => {
    const handle = (e) => {
      let newHeading;
      if (e.webkitCompassHeading != null) {
        newHeading = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        newHeading = 360 - e.alpha;
      }

      if (typeof newHeading === "number") {
        // Smooth heading to reduce jitter
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

  // ---------------- GPS POLLING ----------------
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

  // ---------------- THREE SETUP ----------------
  useEffect(() => {
    // Remove existing AR button if any (prevent duplicates)
    if (arButtonRef.current) {
      arButtonRef.current.remove();
      arButtonRef.current = null;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });

    renderer.xr.enabled = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    sceneRef.current = scene;
    rendererRef.current = renderer;

    // Only create AR button when GPS is ready
    if (gpsReady) {
      const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlayRef.current },
      });
      arButtonRef.current = arButton;
      document.body.appendChild(arButton);
    }

    renderer.setAnimationLoop(() => {
      renderer.render(scene, renderer.xr.getCamera(camera));
      drawRadar(); // draw every frame
    });

    return () => {
      // Cleanup on unmount
      if (arButtonRef.current) {
        arButtonRef.current.remove();
        arButtonRef.current = null;
      }
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };
  }, [gpsReady]);

  // ---------------- SHOW / HIDE MODELS (<15m) ----------------
  async function updateModels() {
    const user = userGpsRef.current;
    if (!user) return;

    for (const obj of AR_OBJECTS) {
      const dist = getDistance(user, obj);

      if (dist < 15 && !modelsRef.current[obj.id]) {
        const gltf = await loader.current.loadAsync(obj.model);
        const model = gltf.scene;
        model.position.set(0, 0, -2);
        model.scale.set(0.4, 0.4, 0.4);
        sceneRef.current.add(model);
        modelsRef.current[obj.id] = model;
      }

      if (dist >= 15 && modelsRef.current[obj.id]) {
        sceneRef.current.remove(modelsRef.current[obj.id]);
        delete modelsRef.current[obj.id];
      }
    }
  }

  // ---------------- RADAR DRAW ----------------
  function drawRadar() {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;
    const heading = headingRef.current;

    ctx.clearRect(0, 0, size, size);

    // Background gradient
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
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = bgGradient;
    ctx.fill();

    // Range rings (25m and 50m)
    ctx.strokeStyle = "rgba(0, 255, 100, 0.3)";
    ctx.lineWidth = 1;

    // 25m ring
    ctx.beginPath();
    ctx.arc(center, center, radius / 2, 0, Math.PI * 2);
    ctx.stroke();

    // 50m ring (outer)
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

    // Cardinal directions (N, S, E, W) - FIXED, don't rotate
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

    // Direction needle - ROTATES based on heading
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((heading * Math.PI) / 180); // Rotate needle based on heading

    // Needle triangle pointing up (rotates with heading)
    ctx.beginPath();
    ctx.moveTo(0, -radius + 20);
    ctx.lineTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fillStyle = "#00ff88";
    ctx.fill();

    // Needle back (opposite direction)
    ctx.beginPath();
    ctx.moveTo(0, radius - 30);
    ctx.lineTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 100, 0.3)";
    ctx.fill();

    ctx.restore();

    // Objects (red dots for items within 50m) - FIXED positions (not rotated)
    if (userGpsRef.current) {
      const scale = radius / 50;
      for (const obj of AR_OBJECTS) {
        const { x, y, dist } = getXY(userGpsRef.current, obj);
        if (dist > 50) continue;

        // Fixed position - no rotation, shows actual world location
        // x = East/West, y = North/South
        const dotX = center + x * scale;
        const dotY = center - y * scale; // Y inverted because canvas Y goes down

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

        // Dot border
        ctx.strokeStyle = "#ff6666";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // User dot (center)
    ctx.beginPath();
    ctx.arc(center, center, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center, center, 3, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    // Range label
    ctx.font = "9px Arial";
    ctx.fillStyle = "rgba(0, 255, 100, 0.6)";
    ctx.textAlign = "right";
    ctx.fillText("50m", center + radius - 5, center + 10);
    ctx.fillText("25m", center + radius / 2 - 3, center + 10);
  }

  // ---------------- MATH ----------------
  function getXY(a, b) {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lon - a.lon) * (Math.PI / 180);

    const x = dLon * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)) * R;
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

      {/* Loading overlay - shown until GPS is ready */}
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
          {/* Spinner */}
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
