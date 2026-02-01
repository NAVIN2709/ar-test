"use client";

import React, { useEffect, useRef, useState } from "react";

const ArScene = () => {
  const sceneRef = useRef(null);
  const scriptsLoaded = useRef(false);
  const pollInterval = useRef(null);

  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const [arInfo, setArInfo] = useState({
    distance: null,
    latitude: null,
    longitude: null,
    caught: false,
  });

  const requestPermissions = async () => {
    try {
      // Camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });

      // Location permission
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          () => reject(),
          { enableHighAccuracy: true }
        );
      });

      setPermissionsGranted(true);
    } catch (e) {
      alert("Camera and Location permissions are required for AR.");
    }
  };

  const handleCaught = () => {
    alert("You caught the Champagne Bottle! 🍾");
  };

  useEffect(() => {
    if (!permissionsGranted) return;
    if (scriptsLoaded.current) return;
    scriptsLoaded.current = true;

    const loadScript = (src) =>
      new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = false;
        document.head.appendChild(s);
        s.onload = resolve;
        s.onerror = resolve;
      });

    const initializeAR = async () => {
      // Load A-Frame
      if (!window.AFRAME)
        await loadScript("https://aframe.io/releases/1.6.0/aframe.min.js");

      await new Promise((r) => setTimeout(r, 500));

      // Load AR.js GPS build
      await loadScript(
        "https://raw.githack.com/AR-js-org/AR.js/3.4.7/three.js/build/ar-threex-location-only.js"
      );
      await loadScript(
        "https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js"
      );

      await new Promise((r) => setTimeout(r, 500));

      // Real world scaling component
      AFRAME.registerComponent("dynamic-scale-by-distance", {
        schema: {
          minDistance: { default: 0.5 },
          maxDistance: { default: 10 },
          minScale: { default: 8 },
          maxScale: { default: 30 },
        },
        tick: function () {
          const gps = this.el.components["gps-new-entity-place"];
          if (!gps || gps.distance == null) return;

          const d = gps.distance;
          const { minDistance, maxDistance, minScale, maxScale } = this.data;

          let scale;
          if (d <= minDistance) scale = maxScale;
          else if (d >= maxDistance) scale = minScale;
          else {
            const n = (d - minDistance) / (maxDistance - minDistance);
            scale = maxScale - n * (maxScale - minScale);
          }

          this.el.object3D.scale.set(scale, scale, scale);
        },
      });

      // Inject scene
      const container = sceneRef.current.querySelector("[data-ar-container]");
      container.innerHTML = `
        <a-scene
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;"
          renderer="antialias: true; alpha: true"
        >
          <a-camera gps-new-camera="gpsMinDistance: 0.5" look-controls-enabled="false"></a-camera>

          <a-entity
            id="bottle"
            gltf-model="/models/champagne-bottle.glb"
            gps-new-entity-place="latitude: 10.767406; longitude: 78.813385;"
            dynamic-scale-by-distance
            animation="property: rotation; to: 0 360 0; loop: true; dur: 5000"
          ></a-entity>

          <a-entity
            gps-new-entity-place="latitude: 10.767406; longitude: 78.813385;"
            position="0 2 0"
          >
            <a-text
              value="Champagne 🍾"
              align="center"
              color="white"
              scale="2 2 2"
              look-at="[gps-camera]"
            ></a-text>
          </a-entity>
        </a-scene>
      `;

      startGPSPolling();
    };

    const startGPSPolling = () => {
      const TARGET_LAT = 10.767406;
      const TARGET_LON = 78.813385;

      const poll = () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;

          const R = 6371000;
          const dLat = (TARGET_LAT - latitude) * (Math.PI / 180);
          const dLon = (TARGET_LON - longitude) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(latitude * (Math.PI / 180)) *
              Math.cos(TARGET_LAT * (Math.PI / 180)) *
              Math.sin(dLon / 2) ** 2;
          const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

          setArInfo({
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            distance: Math.round(distance),
            caught: distance < 1,
          });
        });
      };

      poll();
      pollInterval.current = setInterval(poll, 5000);
    };

    initializeAR();

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [permissionsGranted]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      {!permissionsGranted ? (
        <div
          style={{
            color: "white",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            fontFamily: "sans-serif",
            textAlign: "center",
            padding: 20,
          }}
        >
          <h2>AR Experience Requires Permissions</h2>
          <p>Please allow Camera and Location access</p>
          <button
            onClick={requestPermissions}
            style={{
              padding: "12px 20px",
              fontSize: 16,
              borderRadius: 8,
              border: "none",
              background: "#4CAF50",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Grant Permissions
          </button>
        </div>
      ) : (
        <>
          <div
            ref={sceneRef}
            style={{ width: "100%", height: "100%", background: "#000" }}
          >
            <div data-ar-container style={{ width: "100%", height: "100%" }} />
          </div>

          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              padding: 15,
              borderRadius: 10,
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            <div>Lat: {arInfo.latitude}</div>
            <div>Lon: {arInfo.longitude}</div>
            <div>Distance: {arInfo.distance}m</div>
            <div>{arInfo.caught ? "🎉 CAUGHT!" : "SEARCHING"}</div>
            {arInfo.caught && (
              <div style={{ marginTop: 10, color: "yellow" }}>
                You caught the Champagne Bottle! 🍾
                <button onClick={handleCaught}>Catch</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ArScene;
