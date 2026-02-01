"use client";

import React, { useEffect, useRef, useState } from "react";

const ArScene = () => {
  const sceneRef = useRef(null);
  const scriptsLoaded = useRef(false);
  const pollInterval = useRef(null);

  const [arInfo, setArInfo] = useState({
    distanceInfo: {}, // distances for all objects
    latitude: null,
    longitude: null,
    caught: {},
  });

  const handleCaught = (name) => {
    alert(`You caught the ${name}! 🎉`);
  };

  useEffect(() => {
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

      // Load AR.js
      await loadScript(
        "https://raw.githack.com/AR-js-org/AR.js/3.4.7/three.js/build/ar-threex-location-only.js"
      );
      await loadScript(
        "https://raw.githack.com/AR-js-org/AR.js/3.4.7/aframe/build/aframe-ar.js"
      );
      await new Promise((r) => setTimeout(r, 500));

      // ✅ Register dynamic scaling component
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

      // Define objects with GPS
      const arObjects = [
        {
          name: "Cube",
          model: "/models/cube.glb",
          lat: 10.767406,
          lon: 78.813385,
        },
        {
          name: "Cottage Blender",
          model: "/models/cottage-blender.glb",
          lat: 10.767450,
          lon: 78.813420,
        },
      ];

      // Inject A-Frame scene
      const container = sceneRef.current.querySelector("[data-ar-container]");

      let entitiesHtml = "";
      arObjects.forEach((obj) => {
        entitiesHtml += `
          <a-entity
            id="${obj.name.replace(/\s+/g, "-").toLowerCase()}"
            gltf-model="${obj.model}"
            gps-new-entity-place="latitude: ${obj.lat}; longitude: ${obj.lon};"
            dynamic-scale-by-distance
            animation="property: rotation; to: 0 360 0; loop: true; dur: 5000"
          ></a-entity>

          <a-entity
            gps-new-entity-place="latitude: ${obj.lat}; longitude: ${obj.lon};"
            position="0 2 0"
          >
            <a-text
              value="${obj.name}"
              align="center"
              color="white"
              scale="2 2 2"
              look-at="[gps-camera]"
            ></a-text>
          </a-entity>
        `;
      });

      container.innerHTML = `
        <a-scene
          vr-mode-ui="enabled: false"
          arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false;"
          renderer="antialias: true; alpha: true"
        >
          <a-camera gps-new-camera="gpsMinDistance: 0.5" look-controls-enabled="false"></a-camera>
          ${entitiesHtml}
        </a-scene>
      `;

      startGPSPolling(arObjects);
    };

    // GPS polling for distances
    const startGPSPolling = (arObjects) => {
      const poll = () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          const R = 6371000; // Earth radius in meters

          const distanceInfo = {};
          const caughtInfo = {};

          arObjects.forEach((obj) => {
            const dLat = (obj.lat - latitude) * (Math.PI / 180);
            const dLon = (obj.lon - longitude) * (Math.PI / 180);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(latitude * (Math.PI / 180)) *
                Math.cos(obj.lat * (Math.PI / 180)) *
                Math.sin(dLon / 2) ** 2;
            const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

            distanceInfo[obj.name] = Math.round(distance);
            caughtInfo[obj.name] = distance < 1; // 1m to catch
          });

          setArInfo({
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            distanceInfo,
            caught: caughtInfo,
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
  }, []);

  return (
    <div
      ref={sceneRef}
      style={{ width: "100vw", height: "100vh", background: "#000" }}
    >
      <div data-ar-container style={{ width: "100%", height: "100%" }} />

      {/* UI */}
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
        <hr />
        {arInfo.distanceInfo &&
          Object.keys(arInfo.distanceInfo).map((name) => (
            <div key={name} style={{ marginBottom: 6 }}>
              <strong>{name}</strong> - {arInfo.distanceInfo[name]}m -{" "}
              {arInfo.caught[name] ? (
                <>
                  🎉 CAUGHT!
                  <button
                    onClick={() => handleCaught(name)}
                    style={{ marginLeft: 6 }}
                  >
                    Catch
                  </button>
                </>
              ) : (
                "SEARCHING"
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default ArScene;
