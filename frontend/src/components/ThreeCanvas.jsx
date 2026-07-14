import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import MeshObject from './MeshObject';
import MediaObject from './MediaObject';

export default function ThreeCanvas({ objects, selectedId, setSelectedId, transformMode, socket, roomId, readOnly, onTransformEnd }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas 
        camera={{ position: [5, 5, 5], fov: 50 }}
        onPointerMissed={() => { if (!readOnly) setSelectedId(null); }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1e1e24']} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        
        <Grid infiniteGrid fadeDistance={40} sectionColor="#6366f1" cellColor="#333" />
        <OrbitControls makeDefault />

        {objects.map((obj) => {
          if (obj.type === 'image' || obj.type === 'video') {
            return null;
          }
          return (
            <MeshObject 
              key={obj.id}
              {...obj}
              selectedId={selectedId}
              onSelect={setSelectedId}
              transformMode={transformMode}
              socket={socket}
              roomId={roomId}
              readOnly={readOnly}
              onTransformEnd={onTransformEnd}
            />
          );
        })}
      </Canvas>
    </div>
  );
}
