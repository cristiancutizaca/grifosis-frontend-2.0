// Este archivo sería "GlobeWithFlights.jsx" o en la misma estructura de tu proyecto

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useRef, useEffect, useState } from "react";

// Función para crear una línea curva entre dos puntos en el espacio
function FlightLine({ start, end }) {
  const lineRef = useRef();

  useFrame(() => {
    if (lineRef.current) {
      // Opción para animar la línea si es necesario
    }
  });

  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...start),
    new THREE.Vector3(0, 5, 0), // Punto de control para la curva
    new THREE.Vector3(...end)
  );

  const points = curve.getPoints(50); // Cantidad de puntos para suavizar la curva
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial attach="material" color="white" linewidth={2} />
    </line>
  );
}

const RotatingGlobe = () => {
  const globeRef = useRef();

  // Rotar el globo
  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.005; // Ajuste de velocidad
    }
  });

  return (
    <mesh ref={globeRef} position={[0, 0, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial map={new THREE.TextureLoader().load("/textures/ima5.jpg")} />
    </mesh>
  );
};

const GlobeWithFlights = () => {
  const [isClient, setIsClient] = useState(false);

  // Verificar si estamos en cliente (para evitar problemas de renderizado)
  useEffect(() => {
    setIsClient(typeof window !== "undefined");
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <Canvas
      style={{
        width: "600px",
        height: "600px",
        margin: "0 auto",
      }}
      camera={{ position: [0, 0, 5], fov: 50 }}
    >
      <OrbitControls enableZoom={false} />
      <Stars radius={300} depth={50} count={5000} factor={7} fade />

      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 5, 2]} intensity={1} />

      {/* El globo */}
      <RotatingGlobe />

      {/* Líneas de vuelo */}
      <FlightLine start={[-2, 1, 0]} end={[2, -1, 0]} /> {/* Ejemplo de una línea */}
      <FlightLine start={[1, 1, -1]} end={[-1, -1, 1]} /> {/* Ejemplo de otra línea */}
    </Canvas>
  );
};

export default GlobeWithFlights;
