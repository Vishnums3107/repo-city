import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// @ts-ignore
import * as random from 'maath/random/dist/maath-random.esm';

export const DigitalRain: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Generate 2000 particles in a 100x100x100 box
  const { positions } = useMemo(() => {
    const positions = new Float32Array(2000 * 3);
    // Use maath to fill the buffer efficiently
    random.inBox(positions, { sides: [100, 100, 100] });
    return { positions };
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    // Move every particle down
    for (let i = 0; i < 2000; i++) {
      // Y index is i * 3 + 1
      let y = positions[i * 3 + 1];
      
      // Speed: Randomize slightly or constant? Let's do constant + slight variance based on index
      const speed = 10 + (i % 5); 
      y -= speed * delta;

      // Reset if below -50
      if (y < -50) {
        y = 50;
        // Reset to a new random X/Z position to create a continuous "rain" feel
        // We need to access the X and Z indices
        positions[i * 3] = (Math.random() - 0.5) * 100; // New X
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100; // New Z
      }

      positions[i * 3 + 1] = y;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2000}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00ffcc"
        size={0.2}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </points>
  );
};
