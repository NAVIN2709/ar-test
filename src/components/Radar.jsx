"use client";
import React, { useEffect, useRef, useState } from "react";

export default function Radar({ userGps, objects }) {
  const needleRef = useRef();
  const [heading, setHeading] = useState(0);

  // ----- Device orientation -----
  useEffect(() => {
    const handle = (e) => {
      let h;

      if (e.webkitCompassHeading) h = e.webkitCompassHeading;
      else if (e.alpha) h = 360 - e.alpha;

      if (typeof h === "number") setHeading(h);
    };

    window.addEventListener("deviceorientationabsolute", handle, true);
    window.addEventListener("deviceorientation", handle, true);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, []);

  // ----- Convert lat/lon to radar XY -----
  const getXY = (lat, lon) => {
    const R = 6371000;
    const dLat = (lat - userGps.lat) * (Math.PI / 180);
    const dLon = (lon - userGps.lon) * (Math.PI / 180);

    const x =
      dLon *
      Math.cos(((lat + userGps.lat) / 2) * (Math.PI / 180)) *
      R;
    const y = dLat * R;

    return { x, y };
  };

  const size = 140;
  const center = size / 2;
  const scale = center / 50; // 50m radar

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.65)",
        border: "2px solid #00ff88",
        overflow: "hidden",
        zIndex: 999,
      }}
    >
      {/* Needle */}
      <div
        ref={needleRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 4,
          height: 60,
          background: "#00ff88",
          transformOrigin: "50% 100%",
          transform: `translate(-50%,-100%) rotate(${heading}deg)`,
          borderRadius: 2,
        }}
      />

      {/* Center dot */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 8,
          height: 8,
          background: "white",
          borderRadius: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />

      {/* Objects */}
      {objects.map((o) => {
        const { x, y } = getXY(o.lat, o.lon);
        const dist = Math.sqrt(x * x + y * y);
        if (dist > 50) return null;

        return (
          <div
            key={o.id}
            style={{
              position: "absolute",
              left: center + x * scale,
              bottom: center + y * scale,
              width: 6,
              height: 6,
              background: "red",
              borderRadius: "50%",
              transform: "translate(-50%,50%)",
            }}
          />
        );
      })}
    </div>
  );
}
