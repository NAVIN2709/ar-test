import React from "react";

const Radar = ({ userLat, userLon, objects, radiusMeters = 100 }) => {
  const targetHeading = React.useRef(0);
  const currentHeading = React.useRef(0);
  const lastHeading = React.useRef(0);
  const beamRef = React.useRef(null);

  React.useEffect(() => {
    const handleOrientation = (e) => {
      let newHeading;

      if (e.webkitCompassHeading != null) {
        newHeading = e.webkitCompassHeading;
      } else if (e.alpha != null) {
        newHeading = 360 - e.alpha;
      }

      if (typeof newHeading === "number") {
        const smoothHeading =
          lastHeading.current + (newHeading - lastHeading.current) * 0.1;

        lastHeading.current = smoothHeading;
        targetHeading.current = smoothHeading;
      }
    };

    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", handleOrientation);
    }
    window.addEventListener("deviceorientation", handleOrientation);

    let animationFrameId;
    const updateLoop = () => {
      if (!beamRef.current) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      const target = targetHeading.current;
      const current = currentHeading.current;

      let delta = ((target - current + 540) % 360) - 180;

      const smoothingFactor = 0.025;
      if (Math.abs(delta) < 0.5) {
        currentHeading.current = target;
      } else {
        currentHeading.current = (current + delta * smoothingFactor) % 360;
        if (currentHeading.current < 0) currentHeading.current += 360;
      }

      beamRef.current.style.transform = `translate(-50%, -100%) rotate(${currentHeading.current - 90}deg)`;

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();

    return () => {
      if ("ondeviceorientationabsolute" in window) {
        window.removeEventListener(
          "deviceorientationabsolute",
          handleOrientation,
        );
      }
      window.removeEventListener("deviceorientation", handleOrientation);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!userLat || !userLon) return null;

  const radarSize = 120;
  const center = radarSize / 2;
  const scale = radarSize / 2 / radiusMeters;

  const getRelativePosition = (objLat, objLon) => {
    const R = 6371000;
    const dLat = (objLat - userLat) * (Math.PI / 180);
    const dLon = (objLon - userLon) * (Math.PI / 180);
    // x = East/West, y = North/South
    const x = dLon * Math.cos(((userLat + objLat) / 2) * (Math.PI / 180)) * R;
    const y = dLat * R;

    return { x, y };
  };

  // Filter and map objects
  const visibleObjects = objects.reduce((acc, obj) => {
    const { x, y } = getRelativePosition(obj.lat, obj.lon);
    const distance = Math.sqrt(x * x + y * y);

    if (distance <= radiusMeters) {
      acc.push({ ...obj, x, y });
    }
    return acc;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        width: `${radarSize}px`,
        height: `${radarSize}px`,
        borderRadius: "50%",
        backgroundColor: "rgba(0, 20, 0, 0.6)",
        border: "2px solid rgba(100, 255, 100, 0.5)",
        boxShadow: "0 0 10px rgba(0, 255, 0, 0.3)",
        overflow: "hidden",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Grid circles */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "66%",
          height: "66%",
          borderRadius: "50%",
          border: "1px solid rgba(100, 255, 100, 0.3)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "33%",
          height: "33%",
          borderRadius: "50%",
          border: "1px solid rgba(100, 255, 100, 0.3)",
        }}
      />

      {/* Crosshairs */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "0",
          width: "100%",
          height: "1px",
          backgroundColor: "rgba(100, 255, 100, 0.2)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "50%",
          width: "1px",
          height: "100%",
          backgroundColor: "rgba(100, 255, 100, 0.2)",
        }}
      />

      {/* Rotating Scanner Animation */}
      <div
        className="radar-scanner"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, transparent 270deg, rgba(0, 255, 0, 0.4) 360deg)",
          animation: "radar-spin 2s linear infinite",
        }}
      />
      <div
        ref={beamRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "0",
          height: "0",
          // Create a triangle/cone shape using borders or conic-gradient
          // Here we use a conic gradient for a nice "beam" look
          background:
            "conic-gradient(from -22.5deg at 50% 100%, rgba(255, 255, 255, 0.4) 0deg, transparent 45deg)",
          // Dimensions to extend outward
          width: "100px",
          height: "60px", // The beam length radius roughly
          transformOrigin: "50% 100%", // Pivot at the user dot location
          transform: `translate(-50%, -100%) rotate(0deg)`, // Initial value, updated by JS
          zIndex: 1,
          pointerEvents: "none",
          borderRadius: "50% 50% 0 0", // Soften the edge
          filter: "blur(2px)",
        }}
      />

      {/* User Dot (Center) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "6px",
          height: "6px",
          backgroundColor: "#fff",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 4px #fff",
          zIndex: 2,
        }}
      />

      {/* Object Dots */}
      {visibleObjects.map((obj) => (
        <div
          key={obj.id}
          style={{
            position: "absolute",
            left: `${center + obj.x * scale}px`,
            bottom: `${center + obj.y * scale}px`, // +Y is North (Up), so use bottom relative to center
            width: "6px",
            height: "6px",
            backgroundColor: "#FF3333",
            borderRadius: "50%",
            transform: "translate(-50%, 50%)", // Center the dot on the coordinate
            boxShadow: "0 0 4px #FF0000",
            zIndex: 1,
            transition: "left 0.5s ease-out, bottom 0.5s ease-out",
          }}
          title={obj.name}
        />
      ))}

      <style jsx>{`
        @keyframes radar-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div className="text-white font-bold text-center text-[12px] absolute top-21 left-5">
        Range:50m
      </div>
      <div className="text-white font-bold text-center text-[8px] absolute top-1 left-1/2 transform -translate-x-1/2">
        N
      </div>
      <div className="text-white font-bold text-center text-[8px] absolute top-1/2 right-2 transform -translate-y-1/2">
        E
      </div>
      <div className="text-white font-bold text-center text-[8px] absolute bottom-1 left-1/2 transform -translate-x-1/2">
        S
      </div>
      <div className="text-white font-bold text-center text-[8px] absolute top-1/2 left-2 transform -translate-y-1/2">
        W
      </div>
    </div>
  );
};

export default Radar;
