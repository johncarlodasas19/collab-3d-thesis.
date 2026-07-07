import React, { useRef, useEffect, useState } from 'react';
import { TransformControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export function ImagePlane({ url, isSelected, color }) {
  const texture = useTexture(url);
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[2.2, 2.2, 0.1]} />
        <meshStandardMaterial color={isSelected ? '#fca5a5' : color || 'white'} />
      </mesh>
    </group>
  );
}

export function VideoPlane({ url, isSelected, color }) {
  const [videoTexture, setVideoTexture] = useState(null);

  useEffect(() => {
    const vid = document.createElement('video');
    vid.src = url;
    vid.crossOrigin = 'Anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.play();

    const texture = new THREE.VideoTexture(vid);
    setVideoTexture(texture);
  }, [url]);

  if (!videoTexture) return null;

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={videoTexture} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[2.2, 2.2, 0.1]} />
        <meshStandardMaterial color={isSelected ? '#fca5a5' : color || 'white'} />
      </mesh>
    </group>
  );
}

export default function MediaObject({ id, type, url, position, rotation, scale, color, onSelect, selectedId, transformMode, socket, roomId, readOnly, onTransformEnd }) {
  const groupRef = useRef();
  const [isReady, setIsReady] = useState(false);
  const isSelected = selectedId === id;

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

  const handleMouseUp = () => {
    if (!groupRef.current || !onTransformEnd) return;
    const { position, rotation, scale } = groupRef.current;
    onTransformEnd(id, 
      [position.x, position.y, position.z], 
      [rotation.x, rotation.y, rotation.z], 
      [scale.x, scale.y, scale.z]
    );
  };

  return (
    <>
      <group ref={groupRef} position={position} rotation={rotation} scale={scale} onClick={handleClick}>
        {type === 'image' && <ImagePlane url={url} isSelected={isSelected} color={color} />}
        {type === 'video' && <VideoPlane url={url} isSelected={isSelected} color={color} />}
      </group>
      
      {!readOnly && isSelected && isReady && (
        <TransformControls 
          object={groupRef.current} 
          mode={transformMode}
          onChange={handleTransformChange}
          onMouseUp={handleMouseUp}
        />
      )}
    </>
  );
}
