import { create } from 'zustand';
import * as THREE from 'three';

type EditMode = 'vertex' | 'edge' | 'face' | 'normal' | null;

interface SceneState {
  objects: Array<{
    id: string;
    object: THREE.Object3D;
    name: string;
    visible: boolean;
  }>;
  selectedObject: THREE.Object3D | null;
  transformMode: 'translate' | 'rotate' | 'scale' | null;
  editMode: EditMode;
  selectedElements: {
    vertices: number[];
    edges: number[];
    faces: number[];
  };
  draggedVertex: {
    indices: number[];
    position: THREE.Vector3;
    initialPosition: THREE.Vector3;
  } | null;
  draggedEdge: {
    indices: number[][];
    positions: THREE.Vector3[];
    initialPositions: THREE.Vector3[];
  } | null;
  addObject: (object: THREE.Object3D, name: string) => void;
  removeObject: (id: string) => void;
  setSelectedObject: (object: THREE.Object3D | null) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale' | null) => void;
  setEditMode: (mode: EditMode) => void;
  toggleVisibility: (id: string) => void;
  updateObjectName: (id: string, name: string) => void;
  updateObjectProperties: () => void;
  updateObjectColor: (color: string) => void;
  updateObjectOpacity: (opacity: number) => void;
  setSelectedElements: (type: 'vertices' | 'edges' | 'faces', indices: number[]) => void;
  startVertexDrag: (index: number, position: THREE.Vector3) => void;
  updateVertexDrag: (position: THREE.Vector3) => void;
  endVertexDrag: () => void;
  startEdgeDrag: (vertexIndices: number[], positions: THREE.Vector3[]) => void;
  updateEdgeDrag: (position: THREE.Vector3) => void;
  endEdgeDrag: () => void;
  updateCylinderVertices: (vertexCount: number) => void;
  updateSphereVertices: (vertexCount: number) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  selectedObject: null,
  transformMode: null,
  editMode: null,
  selectedElements: {
    vertices: [],
    edges: [],
    faces: [],
  },
  draggedVertex: null,
  draggedEdge: null,

  addObject: (object, name) =>
    set((state) => ({
      objects: [...state.objects, { id: crypto.randomUUID(), object, name, visible: true }],
    })),

  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObject: state.objects.find((obj) => obj.id === id)?.object === state.selectedObject
        ? null
        : state.selectedObject,
    })),

  setSelectedObject: (object) => set({ selectedObject: object }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setEditMode: (mode) => set({ editMode: mode }),

  toggleVisibility: (id) =>
    set((state) => {
      const updatedObjects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj
      );
      
      const toggledObject = updatedObjects.find((obj) => obj.id === id);
      
      const newSelectedObject = (toggledObject && !toggledObject.visible && toggledObject.object === state.selectedObject)
        ? null
        : state.selectedObject;

      return {
        objects: updatedObjects,
        selectedObject: newSelectedObject,
      };
    }),

  updateObjectName: (id, name) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, name } : obj
      ),
    })),

  updateObjectProperties: () => set((state) => ({ ...state })),

  updateObjectColor: (color) => 
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.color.setStyle(color);
        material.needsUpdate = true;
      }
      return state;
    }),

  updateObjectOpacity: (opacity) =>
    set((state) => {
      if (state.selectedObject instanceof THREE.Mesh) {
        const material = state.selectedObject.material as THREE.MeshStandardMaterial;
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.needsUpdate = true;
      }
      return state;
    }),

  setSelectedElements: (type, indices) =>
    set((state) => ({
      selectedElements: {
        ...state.selectedElements,
        [type]: indices,
      },
    })),

  startVertexDrag: (index, position) =>
    set((state) => {
      if (!(state.selectedObject instanceof THREE.Mesh)) return state;

      const geometry = state.selectedObject.geometry;
      const positions = geometry.attributes.position;
      const overlappingIndices = [];
      const selectedPos = new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index)
      );

      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );
        if (pos.distanceTo(selectedPos) < 0.0001) {
          overlappingIndices.push(i);
        }
      }

      return {
        draggedVertex: {
          indices: overlappingIndices,
          position: position.clone(),
          initialPosition: position.clone()
        },
        selectedElements: {
          ...state.selectedElements,
          vertices: overlappingIndices
        }
      };
    }),

  updateVertexDrag: (position) =>
    set((state) => {
      if (!state.draggedVertex || !(state.selectedObject instanceof THREE.Mesh)) return state;

      const geometry = state.selectedObject.geometry;
      const positions = geometry.attributes.position;
      
      state.draggedVertex.indices.forEach(index => {
        positions.setXYZ(
          index,
          position.x,
          position.y,
          position.z
        );
      });

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      
      return {
        draggedVertex: {
          ...state.draggedVertex,
          position: position.clone()
        }
      };
    }),

  endVertexDrag: () => set({ draggedVertex: null }),

  startEdgeDrag: (vertexIndices, positions) =>
    set((state) => {
      if (!(state.selectedObject instanceof THREE.Mesh)) return state;

      const geometry = state.selectedObject.geometry;
      const positionAttribute = geometry.attributes.position;
      const overlappingEdges = [];
      const allPositions = [];
      const initialPositions = [];
      const processedVertices = new Set();

      // Find all connected edges
      const findConnectedEdges = (startIndex: number) => {
        if (processedVertices.has(startIndex)) return;
        processedVertices.add(startIndex);

        const startPos = new THREE.Vector3(
          positionAttribute.getX(startIndex),
          positionAttribute.getY(startIndex),
          positionAttribute.getZ(startIndex)
        );

        for (let i = 0; i < positionAttribute.count; i++) {
          if (processedVertices.has(i)) continue;

          const pos = new THREE.Vector3(
            positionAttribute.getX(i),
            positionAttribute.getY(i),
            positionAttribute.getZ(i)
          );

          if (pos.distanceTo(startPos) < 0.0001) {
            overlappingEdges.push([startIndex, i]);
            allPositions.push(startPos.clone(), pos.clone());
            initialPositions.push(startPos.clone(), pos.clone());
            findConnectedEdges(i);
          }
        }
      };

      // Start the recursive search from each vertex in the selected edge
      vertexIndices.forEach(index => findConnectedEdges(index));

      return {
        draggedEdge: {
          indices: overlappingEdges,
          positions: allPositions,
          initialPositions: initialPositions
        },
        selectedElements: {
          ...state.selectedElements,
          edges: Array.from(processedVertices)
        }
      };
    }),

  updateEdgeDrag: (position) =>
    set((state) => {
      if (!state.draggedEdge || !(state.selectedObject instanceof THREE.Mesh)) return state;

      const geometry = state.selectedObject.geometry;
      const positions = geometry.attributes.position;
      const offset = position.clone().sub(state.draggedEdge.initialPositions[0]);
      
      // Move all connected vertices together while maintaining edge shape
      const processedVertices = new Set();
      state.draggedEdge.indices.forEach(([v1, v2]) => {
        if (!processedVertices.has(v1)) {
          const newPos = state.draggedEdge.positions[0].clone().add(offset);
          positions.setXYZ(v1, newPos.x, newPos.y, newPos.z);
          processedVertices.add(v1);
        }
        if (!processedVertices.has(v2)) {
          const newPos = state.draggedEdge.positions[1].clone().add(offset);
          positions.setXYZ(v2, newPos.x, newPos.y, newPos.z);
          processedVertices.add(v2);
        }
      });

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      
      return state;
    }),

  endEdgeDrag: () => set({ draggedEdge: null }),

  updateCylinderVertices: (vertexCount) =>
    set((state) => {
      if (!(state.selectedObject instanceof THREE.Mesh) || 
          !(state.selectedObject.geometry instanceof THREE.CylinderGeometry)) {
        return state;
      }

      const oldGeometry = state.selectedObject.geometry;
      const newGeometry = new THREE.CylinderGeometry(
        oldGeometry.parameters.radiusTop,
        oldGeometry.parameters.radiusBottom,
        oldGeometry.parameters.height,
        vertexCount,
        oldGeometry.parameters.heightSegments,
        oldGeometry.parameters.openEnded,
        oldGeometry.parameters.thetaStart,
        oldGeometry.parameters.thetaLength
      );

      state.selectedObject.geometry.dispose();
      state.selectedObject.geometry = newGeometry;

      return {
        ...state,
        selectedElements: {
          vertices: [],
          edges: [],
          faces: []
        }
      };
    }),

  updateSphereVertices: (vertexCount) =>
    set((state) => {
      if (!(state.selectedObject instanceof THREE.Mesh) || 
          !(state.selectedObject.geometry instanceof THREE.SphereGeometry)) {
        return state;
      }

      const oldGeometry = state.selectedObject.geometry;
      const newGeometry = new THREE.SphereGeometry(
        oldGeometry.parameters.radius,
        vertexCount,
        vertexCount / 2,
        oldGeometry.parameters.phiStart,
        oldGeometry.parameters.phiLength,
        oldGeometry.parameters.thetaStart,
        oldGeometry.parameters.thetaLength
      );

      state.selectedObject.geometry.dispose();
      state.selectedObject.geometry = newGeometry;

      return {
        ...state,
        selectedElements: {
          vertices: [],
          edges: [],
          faces: []
        }
      };
    }),
}));