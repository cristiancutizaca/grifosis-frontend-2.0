import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, useGLTF } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

// Componente para la rotación del modelo de la Tierra
const RotatingGlobeModel = () => {
  const globeRef = useRef<THREE.Mesh>(null);
  const { scene, animations } = useGLTF("/glb/earth_cartoon.glb");
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    if (animations && animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      mixerRef.current = mixer;
      // Iniciar todas las animaciones encontradas en el archivo GLB
      animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
      });
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction(); // Detener todas las acciones cuando se desmonta el componente
      }
    };
  }, [animations, scene]);

  // Actualizar el mixer en cada frame para mantener las animaciones
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    // Rotar el modelo en su propio eje
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.002; 
    }
  });

  return <primitive ref={globeRef} object={scene} scale={1.20} />;
};

// Componente principal del globo
const Globe = () => {
  const [isClient, setIsClient] = useState(false);
  const [size, setSize] = useState({ width: 600, height: 600 });

  useEffect(() => {
    setIsClient(typeof window !== "undefined");

    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSize({ width: 300, height: 300 });
      } else {
        setSize({ width: 600, height: 600 });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <Canvas
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        margin: "0 auto",
      }}
      camera={{ position: [0, 0, 5], fov: 50 }}
    > 
      <OrbitControls enableZoom={false} />
      <Stars radius={100} depth={50} count={5000} factor={7} fade />
      <ambientLight intensity={2} />
      <directionalLight position={[2, 5, 2]} intensity={1} />
    
      {/* Modelo 3D de la Tierra */}
      <RotatingGlobeModel />
    </Canvas>
  );
};

export default Globe;
