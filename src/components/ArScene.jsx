"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

const ARGame = () => {
  const canvasRef = useRef(null);
  const radarCanvasRef = useRef(null);
  const sessionRef = useRef(null);
  
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gpsLocation, setGpsLocation] = useState({ lat: null, lon: null });
  const [arActive, setArActive] = useState(false);
  const [nearbyObjects, setNearbyObjects] = useState([]);
  const [debug, setDebug] = useState("");
  const [userHeading, setUserHeading] = useState(0);
  const [readyForAR, setReadyForAR] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  // Add debug log function
  const addDebugLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setDebugLogs(prev => [...prev.slice(-20), logEntry]); // Keep last 20 logs
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // AR Objects with GPS coordinates
  const ar_objects = [
    { 
      id: "tclogo", 
      name: "Tc Logo", 
      model: "/models/tc.glb",
      lat: 10.767501,
      lon: 78.813882,
      scale: 0.5,
      color: "#FF6B6B" // Red
    },
    { 
      id: "gold_coin", 
      name: "Gold Coin", 
      model: "/models/gold_coin.glb",
      lat: 10.767450,
      lon: 78.813460,
      scale: 0.3,
      color: "#FFD93D" // Yellow
    },
    { 
      id: "shiva_foods", 
      name: "Shiva Foods", 
      model: "/models/glowing_gem.glb",
      lat: 10.766162,
      lon: 78.817099,
      scale: 0.6,
      color: "#6BCB77" // Green
    },
  ];

  // Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate bearing
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    return Math.atan2(y, x) * 180 / Math.PI;
  };

  // Find nearby objects
  const findNearbyObjects = (userLat, userLon) => {
    const nearby = ar_objects
      .map(obj => {
        const distance = calculateDistance(userLat, userLon, obj.lat, obj.lon);
        const bearing = calculateBearing(userLat, userLon, obj.lat, obj.lon);
        return { ...obj, distance, bearing };
      })
      .filter(obj => obj.distance < 100)
      .sort((a, b) => a.distance - b.distance);
    
    setNearbyObjects(nearby);
    setDebug(`Found ${nearby.length} objects nearby`);
    addDebugLog(`Found ${nearby.length} objects within 100m`);
  };

  // Draw Radar
  useEffect(() => {
    if (!radarCanvasRef.current || nearbyObjects.length === 0) return;

    const canvas = radarCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 10;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw grid circles (distance markers)
    ctx.strokeStyle = "rgba(0, 255, 0, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const radius = (maxRadius / 4) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw distance labels
    ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText("25m", centerX - 5, centerY - (maxRadius / 4) + 3);
    ctx.fillText("50m", centerX - 5, centerY - (maxRadius / 2) + 3);
    ctx.fillText("75m", centerX - 5, centerY - (maxRadius * 3 / 4) + 3);
    ctx.fillText("100m", centerX - 5, centerY - maxRadius + 3);

    // Draw cardinal directions
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", centerX, 15);
    ctx.fillText("S", centerX, height - 5);
    ctx.textAlign = "right";
    ctx.fillText("E", width - 10, centerY + 4);
    ctx.textAlign = "left";
    ctx.fillText("W", 10, centerY + 4);

    // Draw north indicator arrow
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius + 20);
    ctx.lineTo(centerX - 5, centerY - maxRadius + 30);
    ctx.lineTo(centerX + 5, centerY - maxRadius + 30);
    ctx.closePath();
    ctx.fill();

    // Draw user position (center dot)
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw user heading line
    const headingRad = userHeading * Math.PI / 180;
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(headingRad) * maxRadius * 0.8,
      centerY - Math.cos(headingRad) * maxRadius * 0.8
    );
    ctx.stroke();

    // Draw objects as dots
    nearbyObjects.forEach(obj => {
      const objectBearing = obj.bearing * Math.PI / 180;
      const objectDistance = (obj.distance / 100) * maxRadius;

      const x = centerX + Math.sin(objectBearing) * objectDistance;
      const y = centerY - Math.cos(objectBearing) * objectDistance;

      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(obj.name.substring(0, 3), x, y + 15);
    });

  }, [nearbyObjects, userHeading]);

  const requestPermissions = async () => {
    setLoading(true);
    setError(null);
    addDebugLog("Starting permission request...");

    try {
      // Check if running on HTTPS (required for most sensors)
      addDebugLog(`Protocol: ${window.location.protocol}`);
      
      // Request camera permission
      addDebugLog("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      stream.getTracks().forEach(track => track.stop());
      addDebugLog("✓ Camera permission granted");
      
      // Request GPS permission
      addDebugLog("Requesting GPS permission...");
      const position = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      addDebugLog(`✓ GPS granted: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);

      setGpsLocation({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });

      // Request device orientation permission (iOS)
      if (typeof DeviceOrientationEvent !== "undefined" && 
          typeof DeviceOrientationEvent.requestPermission === "function") {
        addDebugLog("Requesting device orientation permission (iOS)...");
        try {
          const permissionState = await DeviceOrientationEvent.requestPermission();
          if (permissionState === "granted") {
            addDebugLog("✓ Device orientation granted");
          } else {
            addDebugLog("⚠ Device orientation denied", "warn");
          }
        } catch (err) {
          addDebugLog(`Device orientation error: ${err.message}`, "warn");
        }
      } else {
        addDebugLog("Device orientation auto-granted (Android)");
      }

      findNearbyObjects(position.coords.latitude, position.coords.longitude);
      setPermissionsGranted(true);
      setReadyForAR(true);
      setLoading(false);
      addDebugLog("✓ All permissions granted, ready for AR");

    } catch (err) {
      const errorMsg = `Error: ${err.message}`;
      setError(errorMsg);
      setLoading(false);
      addDebugLog(errorMsg, "error");
      alert(errorMsg);
    }
  };

  // GPS polling
  useEffect(() => {
    if (!permissionsGranted) return;

    const gpsInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          findNearbyObjects(position.coords.latitude, position.coords.longitude);
        }
      );
    }, 3000);

    return () => clearInterval(gpsInterval);
  }, [permissionsGranted]);

  // Device orientation (for heading)
  useEffect(() => {
    if (!permissionsGranted) return;

    const handleOrientation = (event) => {
      let heading = event.alpha || 0;
      if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
      }
      setUserHeading(heading);
    };

    window.addEventListener("deviceorientation", handleOrientation);
    addDebugLog("Device orientation listener added");

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      addDebugLog("Device orientation listener removed");
    };
  }, [permissionsGranted]);

  // AR Start function
  const startAR = async () => {
    if (!readyForAR || arActive) {
      addDebugLog("AR already active or not ready", "warn");
      return;
    }

    addDebugLog("=== STARTING AR SESSION ===");
    
    try {
      setLoading(true);
      
      // Check WebXR availability
      addDebugLog("Checking WebXR availability...");
      if (!navigator.xr) {
        throw new Error("WebXR not available (Chrome 79+ required, HTTPS required)");
      }
      addDebugLog("✓ WebXR available");

      // Check AR support
      addDebugLog("Checking AR session support...");
      const isARSupported = await navigator.xr.isSessionSupported("immersive-ar");
      addDebugLog(`AR Supported: ${isARSupported}`);
      
      if (!isARSupported) {
        throw new Error("AR (immersive-ar) not supported on this device. Try Chrome on Android ARCore device.");
      }
      addDebugLog("✓ AR session supported");

      // Get canvas
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas element not found");
      }
      addDebugLog("✓ Canvas found");

      // Create WebGL context
      addDebugLog("Creating WebGL2 context...");
      const gl = canvas.getContext("webgl2", { xrCompatible: true });
      if (!gl) {
        throw new Error("WebGL2 not supported");
      }
      addDebugLog("✓ WebGL2 context created");

      // Request AR session
      addDebugLog("Requesting AR session...");
      const sessionInit = {
        requiredFeatures: ["local"],
        optionalFeatures: ["dom-overlay", "hit-test"],
        domOverlay: { root: document.body }
      };
      addDebugLog(`Session config: ${JSON.stringify(sessionInit)}`);

      const session = await navigator.xr.requestSession("immersive-ar", sessionInit);
      sessionRef.current = session;
      addDebugLog("✓ AR session created!");

      // Session end handler
      session.addEventListener("end", () => {
        addDebugLog("AR session ended");
        setArActive(false);
      });

      // Create XR layer
      addDebugLog("Creating XR WebGL layer...");
      const baseLayer = new XRWebGLLayer(session, gl, {
        alpha: true,
        antialias: true,
        framebufferScaleFactor: 1
      });
      await session.updateRenderState({ baseLayer });
      addDebugLog("✓ XR layer created");

      // Get reference space
      addDebugLog("Requesting reference space...");
      const referenceSpace = await session.requestReferenceSpace("local");
      addDebugLog("✓ Reference space created");

      // Hit test (optional)
      let hitTestSource = null;
      try {
        addDebugLog("Requesting hit test source...");
        hitTestSource = await session.requestHitTestSource({
          space: referenceSpace
        });
        addDebugLog("✓ Hit test source created");
      } catch (err) {
        addDebugLog(`Hit test not available: ${err.message}`, "warn");
      }

      setupRendering(session, gl, referenceSpace, hitTestSource);
      setArActive(true);
      setLoading(false);
      addDebugLog("🎉 AR SESSION ACTIVE!");

    } catch (err) {
      const errorMsg = `AR Error: ${err.message}`;
      setError(errorMsg);
      setLoading(false);
      addDebugLog(errorMsg, "error");
      addDebugLog(`Error stack: ${err.stack}`, "error");
      console.error("Full AR error:", err);
    }
  };

  const setupRendering = (session, gl, referenceSpace, hitTestSource) => {
    addDebugLog("Setting up render loop...");
    
    const animate = (time, frame) => {
      const glLayer = session.renderState.baseLayer;
      gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        for (let view of pose.views) {
          const viewport = glLayer.getViewport(view);
          gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        }
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          // Objects can be placed here
        }
      }

      session.requestAnimationFrame(animate);
    };

    session.requestAnimationFrame(animate);
    addDebugLog("✓ Render loop started");
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black">
      {/* Debug Console - Always visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/95 text-white p-2 text-xs font-mono border-t-2 border-green-500 max-h-48 overflow-y-auto z-50">
        <div className="font-bold text-green-400 mb-1">🔍 DEBUG CONSOLE</div>
        {debugLogs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          debugLogs.map((log, idx) => (
            <div 
              key={idx} 
              className={`${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'warn' ? 'text-yellow-400' : 
                'text-green-300'
              }`}
            >
              [{log.timestamp}] {log.message}
            </div>
          ))
        )}
      </div>

      {/* Permission Screen */}
      {!permissionsGranted && !loading && (
        <div className="h-full flex flex-col justify-center items-center gap-6 px-6 pb-52">
          <h2 className="text-3xl font-bold text-center text-white">🌍 AR GPS Hunt</h2>
          <p className="text-center text-gray-300 max-w-md">
            Walk around to find virtual objects at fixed GPS coordinates
          </p>

          {error && (
            <div className="bg-red-900 border-2 border-red-500 text-red-200 p-4 rounded-lg max-w-md w-full text-sm">
              {error}
            </div>
          )}

          <button
            onClick={requestPermissions}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-white font-bold transition text-lg w-full max-w-xs"
          >
            🎯 Grant Permissions & Start
          </button>

          <div className="text-gray-400 text-xs max-w-md bg-gray-900 p-4 rounded-lg border border-gray-700">
            <p className="mb-2 font-bold text-gray-300">Requirements:</p>
            <ul className="space-y-1">
              <li>📱 Chrome 79+ on Android</li>
              <li>🔒 HTTPS connection required</li>
              <li>📹 Camera permission</li>
              <li>📍 GPS/Location permission</li>
              <li>🧭 Device orientation (auto on Android)</li>
              <li>🎯 ARCore compatible device</li>
            </ul>
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {loading && !arActive && (
        <div className="h-full flex flex-col justify-center items-center pb-52">
          <Loader2 className="animate-spin w-12 h-12 text-blue-600 mb-4" />
          <p className="text-gray-300">
            {permissionsGranted ? "Starting AR..." : "Getting permissions & GPS location..."}
          </p>
        </div>
      )}

      {/* Ready for AR Screen */}
      {readyForAR && !arActive && !loading && (
        <div className="h-full flex flex-col justify-center items-center gap-6 px-6 bg-gradient-to-b from-gray-900 to-black pb-52">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">🎯 Ready for AR!</h2>
            <p className="text-gray-300 mb-2">Found {nearbyObjects.length} objects nearby</p>
            <p className="text-sm text-gray-400">📍 {gpsLocation.lat?.toFixed(6)}, {gpsLocation.lon?.toFixed(6)}</p>
          </div>

          {nearbyObjects.length > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg border border-cyan-500 max-w-sm">
              <p className="font-bold text-cyan-400 mb-2">Nearby Objects:</p>
              {nearbyObjects.map((obj, idx) => (
                <div key={obj.id} className="text-sm text-gray-300 mb-1">
                  <span style={{ color: obj.color }}>●</span> {obj.name} - {obj.distance.toFixed(1)}m away
                </div>
              ))}
            </div>
          )}

          <button
            onClick={startAR}
            className="bg-green-600 hover:bg-green-700 px-12 py-6 rounded-xl text-white font-bold transition text-xl shadow-lg"
          >
            🚀 Start AR Experience
          </button>

          <p className="text-xs text-gray-500 max-w-xs text-center">
            Make sure you're on Chrome with ARCore support
          </p>
        </div>
      )}

      {/* AR Canvas - Always rendered, hidden when not active */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: arActive ? "block" : "none" }}
      />

      {/* Radar Canvas - Always rendered for GPS mode and AR mode */}
      {(readyForAR || arActive) && (
        <div className="absolute top-5 right-5 bg-black/95 p-3 rounded-lg border-2 border-green-500 shadow-lg z-30"
          style={{ width: "200px", height: "200px" }}>
          <canvas
            ref={radarCanvasRef}
            width={190}
            height={190}
            className="w-full h-full"
            style={{ display: "block" }}
          />
          <div className="text-green-400 text-xs font-bold mt-1 text-center">RADAR</div>
        </div>
      )}

      {/* AR UI Overlays */}
      {arActive && (
        <>
          {/* AR Overlay UI */}
          <div className="absolute inset-0 pointer-events-none pb-52">
            {/* Top Left - Current Location */}
            <div className="absolute top-5 left-5 bg-black/90 text-white p-4 rounded-lg pointer-events-auto max-w-xs text-xs border border-green-500">
              <div className="font-bold text-green-400 mb-2">● LIVE AR (GPS + RADAR)</div>
              <p className="text-gray-300 mb-1">📍 Your Position:</p>
              <p className="font-mono text-xs text-gray-400 mb-2">
                {gpsLocation.lat?.toFixed(6)}, {gpsLocation.lon?.toFixed(6)}
              </p>
              <p className="text-gray-300 mb-1">🧭 Heading: {userHeading.toFixed(0)}°</p>
              <p className="text-gray-300 text-xs">{debug}</p>
            </div>

            {/* Bottom Left - Instructions */}
            <div className="absolute bottom-5 left-5 bg-white/95 text-black p-4 rounded-lg pointer-events-auto text-xs max-w-xs">
              <p className="font-bold mb-2">🎮 How to use Radar:</p>
              <ul className="space-y-1 text-gray-700 text-xs">
                <li>🟢 Green circle = You (center)</li>
                <li>🔴 Colored dots = Objects</li>
                <li>📏 Rings = Distance (25m, 50m, 75m, 100m)</li>
                <li>🧭 Arrow = Your heading (north)</li>
                <li>↑ Walk towards objects on radar</li>
              </ul>
            </div>

            {/* Bottom Right - Nearby Objects List */}
            <div className="absolute bottom-5 right-5 bg-black/90 text-white p-4 rounded-lg pointer-events-auto max-w-xs border border-cyan-500 max-h-40 overflow-y-auto">
              <div className="font-bold text-cyan-400 mb-2">🎯 Objects ({nearbyObjects.length})</div>
              {nearbyObjects.length === 0 ? (
                <p className="text-gray-400 text-xs">No objects nearby</p>
              ) : (
                <div className="space-y-2">
                  {nearbyObjects.map((obj, idx) => (
                    <div key={obj.id} className="bg-gray-800 p-2 rounded border-l-4" style={{ borderColor: obj.color }}>
                      <div className="font-bold text-sm" style={{ color: obj.color }}>{idx + 1}. {obj.name}</div>
                      <div className="text-xs text-gray-300 mt-1">
                        <div>📏 <strong>{obj.distance.toFixed(1)}m</strong></div>
                        <div>🧭 {obj.bearing.toFixed(0)}°</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div className="absolute top-5 left-1/2 transform -translate-x-1/2 flex gap-2">
              <div className="bg-green-500/90 text-white p-3 rounded-lg pointer-events-auto text-xs">
                <div className="font-bold">📹 AR ACTIVE</div>
              </div>
            </div>
          </div>
        </>
      )}
      {error && arActive && (
        <div className="absolute top-5 right-5 bg-red-600 text-white p-4 rounded-lg pointer-events-auto flex items-center gap-2 text-sm max-w-xs border border-red-400 z-40">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
    </div>
  );
};

export default ARGame;