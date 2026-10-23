import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
// @ts-expect-error maath random types
import * as random from 'maath/random/dist/maath-random.esm';
import * as THREE from 'three';

function Starfield(props: Record<string, unknown>) {
  const ref = useRef<THREE.Points>(null!);
  const sphere = useMemo(() => {
    // Generate 5000 random points within a sphere radius 2
    return random.inSphere(new Float32Array(5000 * 3), { radius: 2 }) as Float32Array;
  }, []);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 10;
      ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#00f0ff"
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
}

function FloatingCodeBlocks() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[-1.2, 0.5, -2]} rotation={[0.5, 0.5, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#7000ff" wireframe />
      </mesh>
      <mesh position={[1.5, -0.5, -1]} rotation={[0.2, -0.5, 0]}>
        <octahedronGeometry args={[0.4]} />
        <meshStandardMaterial color="#00f0ff" wireframe />
      </mesh>
    </group>
  );
}

export default function Background3D() {
  return (
    <div className="w-full h-full absolute inset-0 bg-[#0a0a0c] -z-10 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} color="#00f0ff" />
        <directionalLight position={[-10, -10, -10]} intensity={1} color="#7000ff" />
        
        <Starfield />
        <FloatingCodeBlocks />
      </Canvas>
    </div>
  );
}
