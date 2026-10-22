import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 3D Procedural Mesh inside Canvas
function FloatingMesh() {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Iridescent glass-like procedural material
  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#6366F1'),
      emissive: new THREE.Color('#4338CA'),
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
      thickness: 1.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    // Gentle floating bob
    meshRef.current.position.y = Math.sin(t * 0.8) * 0.15;

    // Follow mouse pointer smoothly
    const targetX = state.pointer.x * 0.4;
    const targetY = state.pointer.y * 0.4;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetY, 0.05);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetX + t * 0.15, 0.05);
  });

  return (
    <mesh
      ref={meshRef}
      scale={hovered ? 1.48 : 1.4}
      material={material}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

// Light CSS fallback for mobile / reduced-motion
function CSSOrbFallback() {
  return (
    <div className="w-36 h-36 md:w-44 md:h-44 rounded-full relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-blue via-indigo-500 to-accent-violet opacity-80 blur-xl animate-pulse" />
      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full relative z-10 orb-avatar" />
    </div>
  );
}

export function AIOrb3D() {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [reducedMotion, setReducedMotion] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  useEffect(() => {
    // Check screen width
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);

    // Check reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e) => setReducedMotion(e.matches);
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionChange);
      }
    };
  }, []);

  // Performance rule: on mobile or reduced-motion, use the lightweight CSS orb
  if (isMobile || reducedMotion) {
    return (
      <div className="w-44 h-44 flex items-center justify-center my-2">
        <CSSOrbFallback />
      </div>
    );
  }

  return (
    <div className="w-48 h-48 md:w-56 md:h-56 relative flex items-center justify-center my-2 select-none">
      <Suspense fallback={<CSSOrbFallback />}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 3.2], fov: 45 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 5, 4]} intensity={2.2} color="#93C5FD" />
          <pointLight position={[-4, -3, -2]} intensity={2.5} color="#C084FC" />
          <FloatingMesh />
        </Canvas>
      </Suspense>
    </div>
  );
}
