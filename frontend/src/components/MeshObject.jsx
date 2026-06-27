import React, { useRef, useEffect, useState } from 'react';
import { TransformControls } from '@react-three/drei';

export default function MeshObject({ id, type, position, rotation, scale, color, onSelect, selectedId, transformMode, socket, roomId, readOnly }) {
  const groupRef = useRef();
  const [isReady, setIsReady] = useState(false);
  const isSelected = selectedId === id;

  // Sync external changes to the mesh
  useEffect(() => {
    if (groupRef.current) {
      setIsReady(true);
      groupRef.current.position.set(...position);
      groupRef.current.rotation.set(...rotation);
      groupRef.current.scale.set(...scale);
    }
  }, [position, rotation, scale]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (readOnly) return;
    onSelect(id);
  };

  const handleTransformChange = () => {
    if (!socket || !groupRef.current) return;
    
    const { position, rotation, scale } = groupRef.current;
    
    socket.emit('object-transformed', {
      roomId,
      transformData: {
        id,
        position: [position.x, position.y, position.z],
        rotation: [rotation.x, rotation.y, rotation.z],
        scale: [scale.x, scale.y, scale.z]
      }
    });
  };

  return (
    <>
      <group ref={groupRef} position={position} rotation={rotation} scale={scale} onClick={handleClick}>
        {type === 'cube' && (
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'sphere' && (
          <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'cone' && (
          <mesh>
            <coneGeometry args={[0.6, 1.2, 32]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'cylinder' && (
          <mesh>
            <cylinderGeometry args={[0.5, 0.5, 1.2, 32]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'torus' && (
          <mesh>
            <torusGeometry args={[0.5, 0.2, 16, 100]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'plane' && (
          <mesh>
            <planeGeometry args={[2, 2]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} side={2} />
          </mesh>
        )}
        {type === 'tetrahedron' && (
          <mesh>
            <tetrahedronGeometry args={[0.8]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'dodecahedron' && (
          <mesh>
            <dodecahedronGeometry args={[0.7]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'icosahedron' && (
          <mesh>
            <icosahedronGeometry args={[0.7]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
        {type === 'torusKnot' && (
          <mesh>
            <torusKnotGeometry args={[0.4, 0.15, 64, 16]} />
            <meshStandardMaterial color={color} emissive={isSelected ? '#4f46e5' : 'black'} emissiveIntensity={isSelected ? 0.5 : 0} />
          </mesh>
        )}
      </group>
      
      {!readOnly && isSelected && isReady && (
        <TransformControls 
          object={groupRef.current} 
          mode={transformMode}
          onChange={handleTransformChange}
        />
      )}
    </>
  );
}
