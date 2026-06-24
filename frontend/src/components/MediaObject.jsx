import React, { useRef, useEffect, useState } from 'react';
import { TransformControls, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';

export function ImagePlane({ url, isSelected, color }) {
  const resolvedUrl = url.startsWith('/uploads/') ? (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + url : url;
  const texture = useTexture(resolvedUrl);
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

  const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'));

  useEffect(() => {
    if (isYouTube) return;
    const vid = document.createElement('video');
    // Check if the URL is relative and needs to be resolved
    vid.src = url.startsWith('/uploads/') ? (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + url : url;
    vid.crossOrigin = 'Anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.play().catch(e => console.error('Video play error:', e));

    const texture = new THREE.VideoTexture(vid);
    setVideoTexture(texture);
  }, [url, isYouTube]);

  if (isYouTube) {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('embed/')) {
      videoId = url.split('embed/')[1].split('?')[0];
    }
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
    
    return (
      <group>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[3.2, 2.0, 0.1]} />
          <meshStandardMaterial color={isSelected ? '#fca5a5' : color || '#111'} />
        </mesh>
        <Html transform position={[0, 0, 0]} scale={0.1}>
          <iframe 
            width="560" 
            height="315" 
            src={embedUrl} 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            style={{ borderRadius: '10px', pointerEvents: 'auto' }}
          ></iframe>
        </Html>
      </group>
    );
  }

  if (!videoTexture) return null;

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[3, 2]} />
        <meshBasicMaterial map={videoTexture} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[3.2, 2.2, 0.1]} />
        <meshStandardMaterial color={isSelected ? '#fca5a5' : color || 'white'} />
      </mesh>
    </group>
  );
}

export default function MediaObject({ id, type, url, position, rotation, scale, color, onSelect, selectedId, transformMode, socket, roomId }) {
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
        {type === 'image' && <ImagePlane url={url} isSelected={isSelected} color={color} />}
        {type === 'video' && <VideoPlane url={url} isSelected={isSelected} color={color} />}
      </group>
      
      {isSelected && isReady && (
        <TransformControls 
          object={groupRef.current} 
          mode={transformMode}
          onChange={handleTransformChange}
        />
      )}
    </>
  );
}
