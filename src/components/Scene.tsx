import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

const VertexCoordinates = ({ position, onPositionChange }) => {
  if (!position) return null;

  const handleChange = (axis: 'x' | 'y' | 'z', value: string) => {
    const newPosition = position.clone();
    newPosition[axis] = parseFloat(value) || 0;
    onPositionChange(newPosition);
  };

  return (
    <div className="absolute right-4 bottom-4 bg-black/75 text-white p-4 rounded-lg font-mono">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="w-8">X:</label>
          <input
            type="number"
            value={position.x.toFixed(3)}
            onChange={(e) => handleChange('x', e.target.value)}
            className="bg-gray-800 px-2 py-1 rounded w-24 text-right"
            step="0.1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-8">Y:</label>
          <input
            type="number"
            value={position.y.toFixed(3)}
            onChange={(e) => handleChange('y', e.target.value)}
            className="bg-gray-800 px-2 py-1 rounded w-24 text-right"
            step="0.1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-8">Z:</label>
          <input
            type="number"
            value={position.z.toFixed(3)}
            onChange={(e) => handleChange('z', e.target.value)}
            className="bg-gray-800 px-2 py-1 rounded w-24 text-right"
            step="0.1"
          />
        </div>
      </div>
    </div>
  );
};

const VertexCountSelector = () => {
  const { selectedObject, updateCylinderVertices, updateSphereVertices } = useSceneStore();

  if (!(selectedObject instanceof THREE.Mesh)) {
    return null;
  }

  const isCylinder = selectedObject.geometry instanceof THREE.CylinderGeometry;
  const isSphere = selectedObject.geometry instanceof THREE.SphereGeometry;

  if (!isCylinder && !isSphere) {
    return null;
  }

  let currentVertexCount;
  let options;
  let onChange;

  if (isCylinder) {
    currentVertexCount = selectedObject.geometry.parameters.radialSegments;
    options = [
      { value: 32, label: '32 Vertices' },
      { value: 16, label: '16 Vertices' },
      { value: 8, label: '8 Vertices' }
    ];
    onChange = updateCylinderVertices;
  } else {
    currentVertexCount = selectedObject.geometry.parameters.widthSegments;
    options = [
      { value: 64, label: '64 Vertices' },
      { value: 32, label: '32 Vertices' },
      { value: 16, label: '16 Vertices' },
      { value: 8, label: '8 Vertices' }
    ];
    onChange = updateSphereVertices;
  }

  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 bg-black/75 text-white p-4 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Vertex Count:</label>
        <select
          className="bg-gray-800 px-3 py-1.5 rounded text-sm"
          onChange={(e) => onChange(parseInt(e.target.value))}
          value={currentVertexCount}
        >
          {options.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

const VertexPoints = ({ geometry, object }) => {
  const { editMode, selectedElements, startVertexDrag } = useSceneStore();
  const positions = geometry.attributes.position;
  const vertices = [];
  const worldMatrix = object.matrixWorld;
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    ).applyMatrix4(worldMatrix);
    vertices.push(vertex);
  }

  return editMode === 'vertex' ? (
    <group>
      {vertices.map((vertex, i) => (
        <mesh
          key={i}
          position={vertex}
          onClick={(e) => {
            e.stopPropagation();
            if (editMode === 'vertex') {
              startVertexDrag(i, vertex);
            }
          }}
        >
          <sphereGeometry args={[0.05]} />
          <meshBasicMaterial
            color={selectedElements.vertices.includes(i) ? 'red' : 'yellow'}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}
    </group>
  ) : null;
};

const EdgeLines = ({ geometry, object }) => {
  const { editMode, draggedEdge, startEdgeDrag, isDraggingEdge, setIsDraggingEdge, endEdgeDrag } = useSceneStore();
  const { camera, raycaster, pointer } = useThree();
  const positions = geometry.attributes.position;
  const edges = [];
  const worldMatrix = object.matrixWorld;
  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Get all edges including vertical ones
  const indices = geometry.index ? Array.from(geometry.index.array) : null;
  
  if (indices) {
    // For indexed geometry
    for (let i = 0; i < indices.length; i += 3) {
      const addEdge = (a: number, b: number) => {
        const v1 = new THREE.Vector3(
          positions.getX(indices[a]),
          positions.getY(indices[a]),
          positions.getZ(indices[a])
        ).applyMatrix4(worldMatrix);

        const v2 = new THREE.Vector3(
          positions.getX(indices[b]),
          positions.getY(indices[b]),
          positions.getZ(indices[b])
        ).applyMatrix4(worldMatrix);

        const midpoint = v1.clone().add(v2).multiplyScalar(0.5);

        edges.push({
          vertices: [indices[a], indices[b]],
          positions: [v1, v2],
          midpoint
        });
      };

      // Add all three edges of the triangle
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  } else {
    // For non-indexed geometry
    for (let i = 0; i < positions.count; i += 3) {
      const addEdge = (a: number, b: number) => {
        const v1 = new THREE.Vector3(
          positions.getX(a),
          positions.getY(a),
          positions.getZ(a)
        ).applyMatrix4(worldMatrix);

        const v2 = new THREE.Vector3(
          positions.getX(b),
          positions.getY(b),
          positions.getZ(b)
        ).applyMatrix4(worldMatrix);

        const midpoint = v1.clone().add(v2).multiplyScalar(0.5);

        edges.push({
          vertices: [a, b],
          positions: [v1, v2],
          midpoint
        });
      };

      // Add all three edges of the triangle
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  }

  useEffect(() => {
    if (!isDraggingEdge || !draggedEdge) return;

    const handlePointerMove = (event) => {
      // Set up a plane perpendicular to camera for dragging
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      plane.current.setFromNormalAndCoplanarPoint(cameraDirection, draggedEdge.midpoint);

      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
        useSceneStore.getState().updateEdgeDrag(intersection.current);
      }
    };

    const handleRightClick = (event) => {
      if (event.button === 2) { // Right click
        event.preventDefault();
        setIsDraggingEdge(false);
        endEdgeDrag();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('contextmenu', handleRightClick);
    window.addEventListener('mousedown', handleRightClick);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('contextmenu', handleRightClick);
      window.removeEventListener('mousedown', handleRightClick);
    };
  }, [isDraggingEdge, draggedEdge, camera, raycaster, pointer, setIsDraggingEdge, endEdgeDrag]);

  const handleEdgeClick = (vertices: [number, number], positions: [THREE.Vector3, THREE.Vector3], midpoint: THREE.Vector3) => {
    if (isDraggingEdge) return;

    setClickCount(prev => prev + 1);

    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    const timer = setTimeout(() => {
      if (clickCount + 1 >= 2) {
        // Double click detected - start dragging
        setIsDraggingEdge(true);
        startEdgeDrag(vertices, positions, midpoint);
      }
      setClickCount(0);
    }, 300);

    setClickTimer(timer);
  };

  return editMode === 'edge' ? (
    <group>
      {edges.map(({ vertices: [v1, v2], positions: [p1, p2], midpoint }, i) => {
        const points = [p1, p2];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const isSelected = draggedEdge?.indices.some(([a, b]) => 
          (a === v1 && b === v2) || (a === v2 && b === v1)
        );
        
        return (
          <group key={i}>
            <line geometry={geometry}>
              <lineBasicMaterial
                color={isSelected ? 'red' : 'yellow'}
                linewidth={2}
              />
            </line>
            <mesh
              position={midpoint}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleEdgeClick([v1, v2], [p1, p2], midpoint);
              }}
            >
              <sphereGeometry args={[0.08]} />
              <meshBasicMaterial
                color={isSelected ? 'red' : 'yellow'}
                transparent
                opacity={0.7}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  ) : null;
};

const EditModeOverlay = () => {
  const { 
    selectedObject, 
    editMode,
    setSelectedElements,
    draggedVertex,
    updateVertexDrag,
    endVertexDrag
  } = useSceneStore();
  const { scene, camera, raycaster, pointer } = useThree();
  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!selectedObject || !editMode || !(selectedObject instanceof THREE.Mesh)) return;

    const handlePointerMove = (event) => {
      if (draggedVertex) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        plane.current.normal.copy(cameraDirection);
        plane.current.setFromNormalAndCoplanarPoint(
          cameraDirection,
          draggedVertex.position
        );

        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
          updateVertexDrag(intersection.current);
        }
      }
    };

    const handlePointerUp = () => {
      if (draggedVertex) {
        endVertexDrag();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    selectedObject,
    editMode,
    camera,
    raycaster,
    pointer,
    setSelectedElements,
    draggedVertex,
    updateVertexDrag,
    endVertexDrag
  ]);

  if (!selectedObject || !editMode || !(selectedObject instanceof THREE.Mesh)) return null;

  return (
    <>
      <VertexPoints geometry={selectedObject.geometry} object={selectedObject} />
      <EdgeLines geometry={selectedObject.geometry} object={selectedObject} />
    </>
  );
};

const Scene: React.FC = () => {
  const { objects, selectedObject, setSelectedObject, transformMode, editMode, draggedVertex, selectedElements, updateVertexDrag } = useSceneStore();
  const [selectedPosition, setSelectedPosition] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (editMode === 'vertex' && selectedObject instanceof THREE.Mesh) {
      if (draggedVertex) {
        setSelectedPosition(draggedVertex.position);
      } else if (selectedElements.vertices.length > 0) {
        const geometry = selectedObject.geometry;
        const positions = geometry.attributes.position;
        const vertexIndex = selectedElements.vertices[0];
        const position = new THREE.Vector3(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        );
        position.applyMatrix4(selectedObject.matrixWorld);
        setSelectedPosition(position);
      } else {
        setSelectedPosition(null);
      }
    } else {
      setSelectedPosition(null);
    }
  }, [editMode, selectedObject, draggedVertex, selectedElements.vertices]);

  const handlePositionChange = (newPosition: THREE.Vector3) => {
    if (selectedObject instanceof THREE.Mesh) {
      updateVertexDrag(newPosition);
    }
  };

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 75 }}
        className="w-full h-full bg-gray-900"
        onContextMenu={(e) => e.preventDefault()} // Prevent default right-click menu
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <Grid
          infiniteGrid
          cellSize={1}
          sectionSize={3}
          fadeDistance={30}
          fadeStrength={1}
        />

        {objects.map(({ object, visible, id }) => (
          visible && (
            <primitive
              key={id}
              object={object}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedObject(object);
              }}
            />
          )
        ))}

        {selectedObject && transformMode && (
          <TransformControls
            object={selectedObject}
            mode={transformMode}
          />
        )}

        <EditModeOverlay />
        <OrbitControls makeDefault />
      </Canvas>
      {editMode === 'vertex' && selectedPosition && (
        <VertexCoordinates 
          position={selectedPosition}
          onPositionChange={handlePositionChange}
        />
      )}
      {editMode === 'vertex' && selectedObject && !(selectedObject.geometry instanceof THREE.ConeGeometry) && (
        <VertexCountSelector />
      )}
    </div>
  );
};

export default Scene;