import React, { useRef, useState, useEffect, Suspense, memo } from 'react';
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { X, Move, MousePointer2, Loader2, Focus, Activity, Maximize } from 'lucide-react';

/**
 * 3D Core Rendering logic
 * Must be child of <Canvas>
 */
const SceneContent = memo(({ 
  imageUrl, 
  depthUrl, 
  displacementScale = 15,
  onTelemetryUpdate 
}: any) => {
  const { camera } = useThree();
  const [colorMap, depthMap] = useLoader(THREE.TextureLoader, [imageUrl, depthUrl]);
  const keys = useRef<Record<string, boolean>>({});
  const lastUpdateTime = useRef(0);

  useEffect(() => {
    if (colorMap) {
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.mapping = THREE.EquirectangularReflectionMapping;
    }
    
    const handleDown = (e: KeyboardEvent) => { keys.current[e.code.toLowerCase()] = true; };
    const handleUp = (e: KeyboardEvent) => { keys.current[e.code.toLowerCase()] = false; };
    
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [colorMap]);

  useFrame((state, delta) => {
    const speed = 6 * delta;
    const move = new THREE.Vector3();
    
    if (keys.current['keyw']) move.z += speed;
    if (keys.current['keys']) move.z -= speed;
    if (keys.current['keya']) move.x += speed;
    if (keys.current['keyd']) move.x -= speed;

    const rotation = new THREE.Quaternion();
    camera.getWorldQuaternion(rotation);
    move.applyQuaternion(rotation);
    move.y = 0; 
    camera.position.add(move);

    const now = performance.now();
    if (now - lastUpdateTime.current > 100) {
      onTelemetryUpdate({
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2),
        rot: THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(0),
        fov: (camera as THREE.PerspectiveCamera).fov
      });
      lastUpdateTime.current = now;
    }
  });

  return (
    <>
      <PointerLockControls />
      {/* Fix: Suppress intrinsic element error for ambientLight */}
      {/* @ts-ignore */}
      <ambientLight intensity={1.8} />
      {/* Fix: Suppress intrinsic element error for mesh */}
      {/* @ts-ignore */}
      <mesh scale={[-1, 1, 1]} rotation={[0, -Math.PI / 2, 0]}>
        {/* Fix: Suppress intrinsic element error for sphereGeometry */}
        {/* @ts-ignore */}
        <sphereGeometry args={[80, 256, 256]} />
        {/* Fix: Suppress intrinsic element error for meshStandardMaterial */}
        {/* @ts-ignore */}
        <meshStandardMaterial
          map={colorMap}
          // Fix: Removed depthMap property which does not exist on MeshStandardMaterial
          displacementMap={depthMap}
          displacementScale={displacementScale}
          displacementBias={-0.5}
          side={THREE.BackSide}
          roughness={1}
          metalness={0.1}
        />
      {/* Fix: Suppress intrinsic element error for mesh closing tag */}
      {/* @ts-ignore */}
      </mesh>
    </>
  );
});

export const SceneReferenceViewer = ({ image, depth = "https://ar-media.com/wp-content/uploads/2021/04/depth-map.jpg", title, onClose, onCapture }: any) => {
  const [mounted, setMounted] = useState(false);
  const [telemetry, setTelemetry] = useState({ x: '0', y: '0', z: '0', rot: '0', fov: 75 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleCapture = () => {
    if (!canvasRef.current) return;
    try {
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        if (onCapture) onCapture(dataUrl);
        const link = document.createElement('a');
        link.download = `SORA_FRAME_${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
    } catch (e) {
        console.error("Capture failure", e);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col overflow-hidden animate-in fade-in duration-500">
      <div className="flex-1 relative">
        <Canvas 
          ref={canvasRef}
          gl={{ 
            preserveDrawingBuffer: true, 
            antialias: true, 
            powerPreference: "high-performance" 
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 0.1]} fov={75} />
          <Suspense fallback={<Html center><div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-apple-blue" size={48}/><span className="text-white text-[10px] font-black uppercase tracking-widest">Reconstructing Universe</span></div></Html>}>
            <SceneContent 
                imageUrl={image} 
                depthUrl={depth} 
                onTelemetryUpdate={setTelemetry} 
            />
          </Suspense>
        </Canvas>

        {/* Cinematic HUD */}
        <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-black/60 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] text-white font-mono shadow-2xl animate-in slide-in-from-left duration-700">
              <div className="flex items-center gap-3 text-apple-blue mb-4">
                <Activity size={14} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">{title || 'Telemetry Output'}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                <div className="flex flex-col"><span className="text-[8px] text-white/30 uppercase">Pos-X</span><span className="text-xs">{telemetry.x}</span></div>
                <div className="flex flex-col"><span className="text-[8px] text-white/30 uppercase">Pos-Y</span><span className="text-xs">{telemetry.y}</span></div>
                <div className="flex flex-col"><span className="text-[8px] text-white/30 uppercase">Pos-Z</span><span className="text-xs">{telemetry.z}</span></div>
                <div className="flex flex-col"><span className="text-[8px] text-white/30 uppercase">Rotation</span><span className="text-xs">{telemetry.rot}°</span></div>
              </div>
            </div>

            <button onClick={onClose} className="p-5 bg-white/10 hover:bg-red-500 text-white rounded-full pointer-events-auto transition-all shadow-xl backdrop-blur-md border border-white/10">
              <X size={28} />
            </button>
          </div>

          <div className="flex justify-between items-end">
            <div className="bg-black/80 backdrop-blur-xl px-8 py-5 rounded-[24px] border border-white/10 flex gap-10 text-[10px] text-white/40 pointer-events-auto uppercase tracking-widest font-black shadow-2xl">
                <span className="flex items-center gap-3"><Move size={14}/> W/A/S/D Move</span>
                <div className="w-[1px] h-4 bg-white/10" />
                <span className="flex items-center gap-3"><MousePointer2 size={14}/> ESC: Unlock</span>
            </div>

            <button onClick={handleCapture} className="bg-white text-black h-20 px-12 rounded-[28px] flex items-center gap-5 font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-apple-blue hover:text-white transition-all pointer-events-auto group">
                <Focus size={28} className="group-hover:scale-110 transition-transform" />
                Capture Visual Proof
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
