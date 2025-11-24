import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, shaderMaterial, QuadraticBezierLine, Html, Text, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { type CityNode } from '../utils/layoutEngine';
import { DigitalRain } from './DigitalRain';
import { CyberDrone, useCyberSound } from './AudioManager';
import { CodeHologram } from './CodeHologram';

// --- Shader Material for Cyberpunk Buildings ---
const BuildingMaterial = shaderMaterial(
  { 
    time: 0, 
    rimColor: new THREE.Color(0.0, 0.8, 1.0) // Neon Blue
  },
  // Vertex Shader
  `
    attribute vec3 instanceColor;
    varying vec3 vInstanceColor;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      vInstanceColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float time;
    uniform vec3 rimColor;
    varying vec3 vInstanceColor;
    varying vec2 vUv;

    void main() {
      float thickness = 0.05;
      
      // Create a border effect using UV coordinates
      float edgeX = step(vUv.x, thickness) + step(1.0 - thickness, vUv.x);
      float edgeY = step(vUv.y, thickness) + step(1.0 - thickness, vUv.y);
      float isEdge = max(edgeX, edgeY);
      
      // Base color is the instance color (black or red if buggy)
      // Edge color is rimColor (neon blue)
      vec3 finalColor = mix(vInstanceColor, rimColor, isEdge);
      
      // Add a subtle pulse to the base color if it's not black (i.e., buggy)
      if (length(vInstanceColor) > 0.1) {
         finalColor += vInstanceColor * sin(time * 5.0) * 0.5;
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ BuildingMaterial });

// Add type definition for the custom material
declare module '@react-three/fiber' {
  interface ThreeElements {
    buildingMaterial: any;
  }
}

export interface Connection {
  sourceId: string;
  targetId: string;
  code?: string;
}

type VisualizationMode = 'STANDARD' | 'THERMAL' | 'STRUCTURE' | 'LANGUAGE';

interface CitySceneProps {
  layout: CityNode[];
  connections?: Connection[];
  onFetchCode?: (node: CityNode) => Promise<string>;
}

const Buildings: React.FC<{ 
  layout: CityNode[], 
  mode: VisualizationMode,
  onHover: () => void, 
  onClick: () => void,
  onSelect: (index: number) => void
}> = ({ layout, mode, onHover, onClick, onSelect }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Prepare data for InstancedMesh
  const { count, tempObject, colorArray } = useMemo(() => {
    const count = layout.length;
    const tempObject = new THREE.Object3D();
    const colorArray = new Float32Array(count * 3);
    return { count, tempObject, colorArray };
  }, [layout]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    layout.forEach((node, i) => {
      const { position, size, type } = node;
      
      // Set Position & Scale
      tempObject.position.set(position[0], position[1], position[2]);
      tempObject.scale.set(size[0], size[1], size[2]);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);

      // Set Color based on Mode
      const color = new THREE.Color();
      
      if (type === 'folder') {
          color.set(0x050505); // Almost black
      } else {
          switch (mode) {
              case 'THERMAL':
                  // Red (Hot/New) -> Blue (Cold/Old)
                  const age = Date.now() - (node.lastModified || 0);
                  const days = age / (1000 * 60 * 60 * 24);
                  if (days < 2) color.set(0xff0000); // Hot
                  else if (days < 7) color.set(0xff8800); // Warm
                  else if (days < 14) color.set(0xffff00); // Lukewarm
                  else color.set(0x0000ff); // Cold
                  break;
              
              case 'STRUCTURE':
                  // LOC based
                  const loc = node.loc || 0;
                  if (loc < 50) color.set(0x00ff00); // Small - Green
                  else if (loc < 200) color.set(0xffff00); // Medium - Yellow
                  else color.set(0xff0000); // Large - Red
                  break;

              case 'LANGUAGE':
                  switch (node.extension) {
                      case 'ts': case 'tsx': color.set(0x007acc); break; // TS Blue
                      case 'js': case 'jsx': color.set(0xf1e05a); break; // JS Yellow
                      case 'css': case 'scss': color.set(0x563d7c); break; // CSS Purple
                      case 'html': color.set(0xe34c26); break; // HTML Orange
                      case 'json': color.set(0x858585); break; // JSON Grey
                      case 'md': color.set(0xffffff); break; // Markdown White
                      default: color.set(0x444444); // Unknown Grey
                  }
                  break;

              case 'STANDARD':
              default:
                  // Mock: Every 5th file is "buggy"
                  const isBuggy = i % 5 === 0;
                  color.set(isBuggy ? 0xff0000 : 0x000000);
                  break;
          }
      }

      color.toArray(colorArray, i * 3);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Set instanceColor attribute
    meshRef.current.geometry.setAttribute(
        'instanceColor', 
        new THREE.InstancedBufferAttribute(colorArray, 3)
    );

  }, [layout, tempObject, colorArray, mode]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[undefined, undefined, count]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(); }}
      onClick={(e) => { 
        e.stopPropagation(); 
        onClick(); 
        if (e.instanceId !== undefined) onSelect(e.instanceId);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      {/* @ts-ignore */}
      <buildingMaterial ref={materialRef} transparent />
    </instancedMesh>
  );
};

const TrafficParticles: React.FC<{ 
  connections: Connection[]; 
  nodeMap: Map<string, CityNode>; 
}> = ({ connections, nodeMap }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleCount = 200; // Number of particles
  
  // Particle state
  const particles = useMemo(() => {
    return new Array(particleCount).fill(0).map(() => ({
      connectionIndex: Math.floor(Math.random() * connections.length),
      t: Math.random(), // Random start position
      speed: 0.2 + Math.random() * 0.5 // Random speed
    }));
  }, [connections.length]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Reusable vectors to prevent GC
  const vecStart = useMemo(() => new THREE.Vector3(), []);
  const vecEnd = useMemo(() => new THREE.Vector3(), []);
  const vecMid = useMemo(() => new THREE.Vector3(), []);
  const vecPos = useMemo(() => new THREE.Vector3(), []);
  const vecTangent = useMemo(() => new THREE.Vector3(), []);
  const vecLookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_state, delta) => {
    if (!meshRef.current || connections.length === 0) return;

    particles.forEach((particle, i) => {
      // Update progress
      particle.t += particle.speed * delta;
      if (particle.t >= 1) {
        particle.t = 0;
        particle.connectionIndex = Math.floor(Math.random() * connections.length);
      }

      // Get connection points
      const conn = connections[particle.connectionIndex];
      const source = nodeMap.get(conn.sourceId);
      const target = nodeMap.get(conn.targetId);

      if (source && target) {
        vecStart.set(source.position[0], source.position[1], source.position[2]);
        vecEnd.set(target.position[0], target.position[1], target.position[2]);
        
        // Recalculate mid (same logic as lines)
        const distance = vecStart.distanceTo(vecEnd);
        vecMid.addVectors(vecStart, vecEnd).multiplyScalar(0.5);
        vecMid.y += Math.min(distance * 0.5, 50);

        // Quadratic Bezier: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const t = particle.t;
        const t1 = 1 - t;
        
        // pos = (1-t)^2 * start + 2(1-t)t * mid + t^2 * end
        vecPos.copy(vecStart).multiplyScalar(t1 * t1)
          .addScaledVector(vecMid, 2 * t1 * t)
          .addScaledVector(vecEnd, t * t);

        dummy.position.copy(vecPos);
        
        // Orient particle along the curve (derivative)
        // Tangent = 2(1-t)(P1-P0) + 2t(P2-P1)
        // P1-P0
        vecTangent.copy(vecMid).sub(vecStart).multiplyScalar(2 * t1);
        // P2-P1
        vecLookAt.copy(vecEnd).sub(vecMid).multiplyScalar(2 * t); // Reuse vecLookAt temporarily
        
        vecTangent.add(vecLookAt).normalize();
            
        vecLookAt.copy(vecPos).add(vecTangent);
        dummy.lookAt(vecLookAt);
        
        dummy.scale.set(1, 1, 3); // Elongated particle
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
      }
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (connections.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshBasicMaterial color="#ffff00" />
    </instancedMesh>
  );
};

const Connections: React.FC<{ layout: CityNode[]; connections?: Connection[]; groupRef: React.RefObject<THREE.Group | null> }> = ({ layout, connections, groupRef }) => {
    const [hoveredInfo, setHoveredInfo] = useState<{ pos: [number, number, number], text: string } | null>(null);

    // 1. Prepare Data
    const { validConnections, nodeMap } = useMemo(() => {
        const nodeMap = new Map(layout.map(n => [n.id, n]));
        let links = connections ? [...connections] : [];

        if (links.length === 0) {
             const files = layout.filter(n => n.type === 'file');
             for (let i = 0; i < Math.min(files.length, 20); i++) {
                const source = files[i];
                const target = files[Math.floor(Math.random() * files.length)];
                if (source.id !== target.id) {
                    links.push({ sourceId: source.id, targetId: target.id });
                }
             }
        }
        
        // Filter to ensure nodes exist
        const valid = links.filter(c => nodeMap.has(c.sourceId) && nodeMap.has(c.targetId));
        return { validConnections: valid, nodeMap };
    }, [layout, connections]);

    // 2. Generate Line Visuals
    const lines = useMemo(() => {
        return validConnections.map((conn, i) => {
            const source = nodeMap.get(conn.sourceId)!;
            const target = nodeMap.get(conn.targetId)!;
            
            const start = new THREE.Vector3(source.position[0], source.position[1], source.position[2]);
            const end = new THREE.Vector3(target.position[0], target.position[1], target.position[2]);
            
            const distance = start.distanceTo(end);
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            mid.y += Math.min(distance * 0.5, 50);

            const sourceName = source.id.split('/').pop() || source.id;
            const targetName = target.id.split('/').pop() || target.id;

            return (
                <QuadraticBezierLine
                    key={`${source.id}-${target.id}-${i}`}
                    start={start}
                    end={end}
                    mid={mid}
                    color={hoveredInfo && hoveredInfo.text.includes(sourceName) && hoveredInfo.text.includes(targetName) ? "#00ff00" : "#00ffff"}
                    lineWidth={hoveredInfo && hoveredInfo.text.includes(sourceName) && hoveredInfo.text.includes(targetName) ? 5 : 3}
                    transparent
                    opacity={0.6}
                    userData={{ code: conn.code || `import { Something } from '${target.id}';` }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        document.body.style.cursor = 'help';
                        setHoveredInfo({
                            pos: [e.point.x, e.point.y, e.point.z],
                            text: `DEPENDENCY DETECTED:\n${sourceName} -> ${targetName}`
                        });
                    }}
                    onPointerOut={() => {
                        document.body.style.cursor = 'auto';
                        setHoveredInfo(null);
                    }}
                />
            );
        });
    }, [validConnections, nodeMap, hoveredInfo]);

    return (
        <group ref={groupRef}>
            {lines}
            <TrafficParticles connections={validConnections} nodeMap={nodeMap} />
            {hoveredInfo && (
                <Html position={hoveredInfo.pos} style={{ pointerEvents: 'none', zIndex: 100 }}>
                    <div style={{
                        background: 'rgba(0, 10, 20, 0.95)',
                        border: '1px solid #00ff00',
                        padding: '8px',
                        borderRadius: '4px',
                        color: '#00ff00',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 0 15px rgba(0, 255, 0, 0.3)',
                        transform: 'translate3d(-50%, -100%, 0)',
                        marginTop: '-10px'
                    }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #004400', marginBottom: '4px', paddingBottom: '2px' }}>
                            LINK ESTABLISHED
                        </div>
                        {hoveredInfo.text}
                    </div>
                </Html>
            )}
        </group>
    );
};

const Typewriter: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 30); // Typing speed
    return () => clearInterval(timer);
  }, [text]);

  return <span style={{ fontFamily: 'monospace', color: '#00ff00' }}>{displayedText}</span>;
};

const ParserFlightController: React.FC<{ 
  linesRef: React.RefObject<THREE.Group | null>;
  onHoverChange: (isHovering: boolean) => void;
}> = ({ linesRef, onHoverChange }) => {
  const { camera, raycaster, controls } = useThree();
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<THREE.Vector3>(new THREE.Vector3());

  // Store original speeds to restore them
  const originalSpeed = useRef({ rotate: 1.0, zoom: 1.0 });

  useEffect(() => {
    if (controls) {
        // @ts-ignore
        originalSpeed.current.rotate = controls.rotateSpeed;
        // @ts-ignore
        originalSpeed.current.zoom = controls.zoomSpeed;
    }
  }, [controls]);

  useFrame(() => {
    if (!linesRef.current) return;

    // Cast ray from center of screen
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Intersect with lines
    const intersects = raycaster.intersectObjects(linesRef.current.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const code = hit.object.userData.code || hit.object.parent?.userData.code;
      
      if (code) {
        if (activeCode !== code) {
            setActiveCode(code);
            onHoverChange(true);
            
            // Slow down OrbitControls if active
            if (controls) {
                // @ts-ignore
                controls.rotateSpeed = 0.1;
                // @ts-ignore
                controls.zoomSpeed = 0.1;
            }
        }
        setTooltipPos(hit.point);
      }
    } else {
      if (activeCode !== null) {
        setActiveCode(null);
        onHoverChange(false);

        // Restore OrbitControls speed
        if (controls) {
            // @ts-ignore
            controls.rotateSpeed = originalSpeed.current.rotate;
            // @ts-ignore
            controls.zoomSpeed = originalSpeed.current.zoom;
        }
      }
    }
  });

  return (
    <>
      {activeCode && (
        <Html position={tooltipPos} center>
          <div style={{
            background: 'rgba(0, 20, 40, 0.9)',
            border: '1px solid #00ffff',
            padding: '10px',
            borderRadius: '4px',
            color: 'white',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 10px #00ffff'
          }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>DEPENDENCY DETECTED</div>
            <Typewriter text={activeCode} />
          </div>
        </Html>
      )}
    </>
  );
};

const DroneController: React.FC<{ active: boolean; layout: CityNode[]; isHovering: boolean }> = ({ active, layout, isHovering }) => {
    const { camera } = useThree();
    const progress = useRef(0);
    
    // Create a simple flight path based on nodes
    const path = useMemo(() => {
        if (layout.length < 2) return null;
        const points = layout.filter((_, i) => i % 2 === 0).map(n => new THREE.Vector3(n.position[0], n.position[1] + 20, n.position[2]));
        return new THREE.CatmullRomCurve3(points, true);
    }, [layout]);

    useFrame((_state, delta) => {
        if (!active || !path) return;

        // Slow down significantly if hovering over a dependency
        // Reduced speed to make drone view more cinematic and less nauseating
        const speed = isHovering ? 0.002 : 0.01;
        progress.current = (progress.current + delta * speed) % 1;
        
        const position = path.getPoint(progress.current);
        const lookAt = path.getPoint((progress.current + 0.01) % 1);

        camera.position.lerp(position, 0.05);
        camera.lookAt(lookAt);
    });

    return null;
};

const DistrictLabels: React.FC<{ layout: CityNode[] }> = ({ layout }) => {
  const labels = useMemo(() => {
    const folders = layout.filter(n => n.type === 'folder');
    
    return folders.map(folder => {
      // Find children of this folder
      const children = layout.filter(n => n.parentId === folder.id);
      
      let position: [number, number, number];
      
      if (children.length > 0) {
        // Calculate centroid of children
        const sum = children.reduce((acc, child) => {
          acc[0] += child.position[0];
          acc[1] += child.position[1];
          acc[2] += child.position[2];
          return acc;
        }, [0, 0, 0]);
        
        const center = [
            sum[0] / children.length,
            sum[1] / children.length,
            sum[2] / children.length
        ];
        
        // Place label 50 units above the center
        position = [center[0], center[1] + 50, center[2]];
      } else {
        // Fallback to folder position if no children
        position = [folder.position[0], folder.position[1] + 50, folder.position[2]];
      }

      return {
        id: folder.id,
        name: folder.id.split('/').pop() || folder.id,
        position
      };
    });
  }, [layout]);

  return (
    <>
      {labels.map((label) => (
        <Billboard
          key={label.id}
          position={label.position}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
        >
          <Text
            fontSize={8}
            color="#00ffff"
            outlineWidth={0.2}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.8}
          >
            {label.name}
          </Text>
        </Billboard>
      ))}
    </>
  );
};

const SearchBeam: React.FC<{ position: [number, number, number] | null }> = ({ position }) => {
  if (!position) return null;
  
  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* The Beam */}
      <mesh position={[0, 50, 0]}>
        <cylinderGeometry args={[2, 2, 100, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {/* The Spotlight Source */}
      <spotLight
        position={[0, 100, 0]}
        angle={0.3}
        penumbra={0.5}
        intensity={2}
        color="#00ffff"
        castShadow
        target-position={[0, 0, 0]}
      />
      {/* Ground Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[4, 5, 32]} />
        <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const SearchController: React.FC<{ target: [number, number, number] | null }> = ({ target }) => {
  const { camera, controls } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const cameraTargetPos = useRef<THREE.Vector3 | null>(null);
  const isFlying = useRef(false);

  useEffect(() => {
    if (target) {
        targetPos.current = new THREE.Vector3(target[0], target[1], target[2]);
        cameraTargetPos.current = new THREE.Vector3(target[0] + 30, target[1] + 30, target[2] + 30);
        isFlying.current = true;
    }
  }, [target]);

  useFrame((_state, delta) => {
    if (isFlying.current && targetPos.current && cameraTargetPos.current && controls) {
        // Lerp camera position
        camera.position.lerp(cameraTargetPos.current, 5 * delta);
        
        // Lerp controls target
        // @ts-ignore
        controls.target.lerp(targetPos.current, 5 * delta);
        // @ts-ignore
        controls.update();

        // Stop flying when close
        if (camera.position.distanceTo(cameraTargetPos.current) < 1) {
            isFlying.current = false;
        }
    }
  });

  return null;
};

export const CityScene: React.FC<CitySceneProps> = ({ layout, connections, onFetchCode }) => {
  const linesRef = useRef<THREE.Group>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [droneMode, setDroneMode] = useState(false);
  const [vizMode, setVizMode] = useState<VisualizationMode>('STANDARD');
  const [isHovering, setIsHovering] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CityNode | null>(null);
  const { playHover, playClick } = useCyberSound();

  // Hologram State
  const [hologramCode, setHologramCode] = useState('');
  
  useEffect(() => {
      if (selectedNode) {
          if (selectedNode.codeSnippet) {
              setHologramCode(selectedNode.codeSnippet);
          } else if (onFetchCode && selectedNode.url) {
              setHologramCode('// Loading content from GitHub...');
              onFetchCode(selectedNode).then(code => {
                  setHologramCode(code);
                  // Cache it
                  selectedNode.codeSnippet = code; 
              }).catch(err => {
                  setHologramCode(`// Error fetching code: ${err.message}`);
              });
          } else {
              setHologramCode('// No content available locally.');
          }
      }
  }, [selectedNode, onFetchCode]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<[number, number, number] | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length > 2) {
        const match = layout.find(n => n.id.toLowerCase().includes(query.toLowerCase()));
        if (match) {
            setSearchTarget(match.position);
            setDroneMode(false); // Exit drone mode to allow search flight
        } else {
            setSearchTarget(null);
        }
    } else {
        setSearchTarget(null);
    }
  };

  // Calculate dynamic grid size
  const gridSize = useMemo(() => {
      if (layout.length === 0) return 200;
      let maxDist = 0;
      layout.forEach(node => {
          const dist = Math.max(Math.abs(node.position[0]), Math.abs(node.position[2]));
          if (dist > maxDist) maxDist = dist;
      });
      // Size is diameter (2 * radius) + padding
      return Math.max(200, maxDist * 2.5); 
  }, [layout]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '600px', background: '#050505', position: 'relative' }}>
      {/* Search Bar */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <input 
            type="text" 
            placeholder="SEARCH SYSTEM..." 
            value={searchQuery}
            onChange={handleSearch}
            style={{
                background: 'rgba(0, 10, 20, 0.9)',
                color: '#00ffff',
                border: '1px solid #00ffff',
                padding: '10px 15px',
                fontFamily: 'monospace',
                fontSize: '14px',
                width: '250px',
                outline: 'none',
                boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
                textTransform: 'uppercase'
            }}
        />
        {searchTarget && (
            <div style={{ color: '#00ff00', fontSize: '10px', marginTop: '5px', fontFamily: 'monospace' }}>
                TARGET ACQUIRED
            </div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
        <button 
            onClick={toggleFullscreen}
            style={{
                background: isFullscreen ? '#00ffff' : '#222',
                color: isFullscreen ? '#000' : '#fff',
                border: '1px solid #00ffff',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '150px'
            }}
        >
            {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
        </button>

        <button 
            onClick={() => setDroneMode(!droneMode)}
            style={{
                background: droneMode ? '#00ffff' : '#222',
                color: droneMode ? '#000' : '#fff',
                border: '1px solid #00ffff',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '150px'
            }}
        >
            {droneMode ? 'EXIT DRONE' : 'DRONE VIEW'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(['STANDARD', 'THERMAL', 'STRUCTURE', 'LANGUAGE'] as VisualizationMode[]).map(m => (
                <button
                    key={m}
                    onClick={() => setVizMode(m)}
                    style={{
                        background: vizMode === m ? '#00ffff' : 'rgba(0,0,0,0.5)',
                        color: vizMode === m ? '#000' : '#00ffff',
                        border: '1px solid #00ffff',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'right',
                        width: '150px'
                    }}
                >
                    {m} MODE
                </button>
            ))}
        </div>
      </div>
      
      <Canvas>
        <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={60} />
        {!droneMode && <OrbitControls makeDefault />}
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />

        <DigitalRain />
        <CyberDrone />
        <DistrictLabels layout={layout} />
        
        <SearchBeam position={searchTarget} />
        <SearchController target={searchTarget} />

        <Buildings 
            layout={layout} 
            mode={vizMode}
            onHover={() => playHover()} 
            onClick={() => playClick()} 
            onSelect={(index) => {
                if (layout[index]) setSelectedNode(layout[index]);
            }}
        />
        <Connections layout={layout} connections={connections} groupRef={linesRef} />
        
        <ParserFlightController linesRef={linesRef} onHoverChange={setIsHovering} />
        <DroneController active={droneMode} layout={layout} isHovering={isHovering} />

        <EffectComposer>
          <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} height={300} intensity={1.5} />
        </EffectComposer>
        
        <gridHelper args={[gridSize, Math.floor(gridSize / 10), 0x222222, 0x111111]} />
      </Canvas>

      <CodeHologram 
        isOpen={!!selectedNode} 
        onClose={() => setSelectedNode(null)} 
        code={hologramCode} 
        fileName={selectedNode?.id || 'Unknown File'} 
      />
    </div>
  );
};
