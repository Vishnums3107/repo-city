import * as THREE from 'three';

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  loc?: number; // Lines of Code
  content?: string;
  url?: string; // GitHub API URL for blob
}

export interface CityNode {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  type: 'file' | 'folder';
  codeSnippet?: string;
  parentId?: string;
  loc: number;
  lastModified: number; // Timestamp
  extension: string;
  url?: string;
}

interface SimulationNode {
  id: string;
  type: 'file' | 'folder';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  targetHeight: number;
  parentId: string | null;
  childrenIds: string[];
  codeSnippet?: string;
  loc: number;
  url?: string;
}

/**
 * Converts a file tree into a 3D city layout using a force-directed algorithm.
 */
export const generateCityLayout = (root: FileNode, iterations = 50): CityNode[] => {
  const nodes: SimulationNode[] = [];
  
  // 1. Flatten the tree and initialize nodes
  const flatten = (node: FileNode, parentId: string | null = null) => {
    // Safety cap: Stop if we have too many nodes to prevent freezing
    if (nodes.length >= 400) return;

    const id = parentId ? `${parentId}/${node.name}` : node.name;
    
    // Determine size/radius
    // Files: Radius based on fixed size (e.g., 5)
    // Folders: Radius starts small, but effectively they are centers
    const isFile = node.type === 'file';
    const radius = isFile ? 5 : 10; 
    
    // Height based on LOC
    // Scale: 1 LOC = 0.1 unit height, min 1, max 100
    const loc = node.loc || 0;
    const height = isFile ? Math.max(2, Math.min(loc * 0.5, 100)) : 1;

    // Initial position: Random scatter or near parent
    // If parent exists, place near parent
    let position = new THREE.Vector3(0, 0, 0);
    if (parentId) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (parentNode) {
        position.copy(parentNode.position).add(
          new THREE.Vector3((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100)
        );
      }
    }

    const simNode: SimulationNode = {
      id,
      type: node.type,
      position,
      velocity: new THREE.Vector3(),
      radius,
      targetHeight: height,
      parentId,
      childrenIds: [],
      codeSnippet: node.content,
      loc,
      url: node.url
    };

    nodes.push(simNode);

    if (parentId) {
      const parent = nodes.find(n => n.id === parentId);
      if (parent) parent.childrenIds.push(id);
    }

    if (node.children) {
      node.children.forEach(child => flatten(child, id));
    }
  };

  flatten(root);

  // 2. Run Force Simulation
  // Forces:
  // - Repulsion: All nodes repel each other (prevent overlap)
  // - Attraction: Children attracted to Parent
  // - Center Gravity: Root attracted to (0,0,0)
  
  const nodeCount = nodes.length;
  // Dynamic spacing based on repo size. More nodes = need more space.
  const spacingMultiplier = Math.max(1, Math.log(nodeCount) * 0.5); 

  const REPULSION_STRENGTH = 2000 * spacingMultiplier;
  const ATTRACTION_STRENGTH = 0.01 / spacingMultiplier;
  const PADDING = 15 * spacingMultiplier;
  const DAMPING = 0.9;
  const TIME_STEP = 0.1;

  for (let i = 0; i < iterations; i++) {
    // Calculate Forces
    nodes.forEach(node => {
      const force = new THREE.Vector3();

      // A. Repulsion (All nodes vs All nodes)
      // Optimization: Only check nearby or siblings? For now, all vs all (O(N^2)) - okay for small trees
      nodes.forEach(other => {
        if (node.id === other.id) return;
        
        const diff = new THREE.Vector3().subVectors(node.position, other.position);
        diff.y = 0; // Force only on XZ plane
        const distSq = diff.lengthSq();
        
        // Avoid division by zero
        if (distSq < 0.1) {
            diff.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }

        // Repel if close
        const minDist = node.radius + other.radius + PADDING; 
        if (distSq < minDist * minDist * 4) { // Repel range
           const strength = REPULSION_STRENGTH / (distSq + 0.1);
           force.add(diff.normalize().multiplyScalar(strength));
        }
      });

      // B. Attraction (Child to Parent)
      if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
          const diff = new THREE.Vector3().subVectors(parent.position, node.position);
          diff.y = 0;
          force.add(diff.multiplyScalar(ATTRACTION_STRENGTH));
        }
      } else {
        // Root to center
        const diff = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), node.position);
        diff.y = 0;
        force.add(diff.multiplyScalar(ATTRACTION_STRENGTH));
      }

      // Apply Force to Velocity
      node.velocity.add(force.multiplyScalar(TIME_STEP));
    });

    // Update Positions & Resolve Collisions
    nodes.forEach(node => {
      node.velocity.multiplyScalar(DAMPING);
      node.position.add(node.velocity.multiplyScalar(TIME_STEP));
      node.position.y = 0; // Keep on ground plane
    });

    // C. Collision Resolution (Circle Packing)
    // Simple iterative impulse
    for (let k = 0; k < 2; k++) {
        nodes.forEach(node => {
            nodes.forEach(other => {
                if (node.id === other.id) return;
                const diff = new THREE.Vector3().subVectors(node.position, other.position);
                diff.y = 0;
                const dist = diff.length();
                const minDist = node.radius + other.radius + PADDING; // Padding

                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const correction = diff.normalize().multiplyScalar(overlap * 0.5);
                    node.position.add(correction);
                    other.position.sub(correction);
                }
            });
        });
    }
  }

  // 3. Convert to Output Format
  return nodes.map(node => ({
    id: node.id,
    position: [node.position.x, node.targetHeight / 2, node.position.z], // Y is center, so height/2
    size: [node.radius * 1.5, node.targetHeight, node.radius * 1.5], // Box size
    type: node.type,
    codeSnippet: node.codeSnippet,
    parentId: node.parentId || undefined,
    loc: node.loc,
    lastModified: Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 30, // Mock: Random last 30 days
    extension: node.type === 'file' ? (node.id.split('.').pop() || 'txt') : 'folder',
    url: node.url
  }));
};
