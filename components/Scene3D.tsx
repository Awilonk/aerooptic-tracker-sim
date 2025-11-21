import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Html, Billboard, Environment, RenderTexture, Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SystemState } from '../types';
import { logger } from '../utils/logger';

// Configure useGLTF to handle legacy extensions
if (typeof window !== 'undefined') {
  logger.log('GLTF loader configured');
  logger.log('提示：在浏览器控制台输入 downloadLogs() 可以下载调试日志文件');
}

// Augment JSX namespace to include Three.js elements used by React Three Fiber
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      mesh: any;
      group: any;
      line: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      boxGeometry: any;
      torusGeometry: any;
      meshStandardMaterial: any;
      meshPhysicalMaterial: any;
      lineBasicMaterial: any;
      bufferGeometry: any;

      // HTML and SVG elements
      div: any;
      span: any;
      h1: any;
      h2: any;
      h3: any;
      p: any;
      header: any;
      main: any;
      section: any;
      button: any;
      input: any;
      label: any;
      svg: any;
      path: any;
    }
  }
}

// --- Materials ---
// Aircraft is now White as requested
const aircraftMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, metalness: 0.1 });
const wingMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4, metalness: 0.1 });

// Gimbal keeps its original dark grey/metallic look
const gimbalMaterial = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.7 });
const sensorHousingMaterial = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.8 });

// Shiny silver material for the mirror
const mirrorMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.05, metalness: 1.0 });

// Target aircraft materials (Red/Orange for visibility)
const targetAircraftMaterial = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.1 });
const targetWingMaterial = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4, metalness: 0.1 });

interface SceneContentProps {
  state: SystemState;
  fsmPhysicalRef: React.RefObject<THREE.Group>;
}

// Fallback Target Aircraft (if GLB fails to load)
const FallbackTargetAircraft: React.FC<{
  position: [number, number, number];
  isLocked: boolean;
}> = ({ position, isLocked }) => {
  const scale = 4;
  const material = isLocked ? 
    new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.3, metalness: 0.1, emissive: '#4ade80', emissiveIntensity: 0.5 }) :
    new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.1, emissive: '#ef4444', emissiveIntensity: 0.3 });
  const wingMat = isLocked ? 
    new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.4, metalness: 0.1 }) :
    new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4, metalness: 0.1 });

  return (
    <group position={position} scale={scale}>
      <mesh rotation={[Math.PI/2, 0, 0]} material={material}>
        <cylinderGeometry args={[0.5, 0.4, 8, 16]} />
      </mesh>
      <mesh position={[0, 0, 4.5]} rotation={[Math.PI/2, 0, 0]} material={material}>
        <coneGeometry args={[0.4, 1, 16]} />
      </mesh>
      <group position={[0, 0, 1]}>
        <mesh position={[3, 0, 0]} material={wingMat}>
          <boxGeometry args={[6, 0.1, 1.5]} />
        </mesh>
        <mesh position={[-3, 0, 0]} material={wingMat}>
          <boxGeometry args={[6, 0.1, 1.5]} />
        </mesh>
      </group>
      <group position={[0, 0.2, -3.5]}>
        <mesh position={[0, 0.8, 0]} material={wingMat}>
          <boxGeometry args={[0.1, 1.6, 1]} />
        </mesh>
        <mesh position={[0, 0, 0]} material={wingMat}>
          <boxGeometry args={[3, 0.1, 0.8]} />
        </mesh>
      </group>
    </group>
  );
};

// F-117 Target Aircraft Component - using fallback due to large file size
// TODO: Optimize the 26MB GLB file to enable loading
const TargetAircraft: React.FC<{ 
  position: [number, number, number]; 
  isLocked: boolean;
  targetMatRef?: React.RefObject<THREE.MeshStandardMaterial>;
}> = ({ position, isLocked, targetMatRef }) => {
  // Using fallback for now due to 26MB file size causing loading issues
  return <FallbackTargetAircraft position={position} isLocked={isLocked} />;
  
  /* Uncomment when GLB file is optimized:
  const gltf = useGLTF('/lockheed_f-117_nighthawk.glb');
  const groupRef = useRef<THREE.Group>(null);
  
  React.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat: THREE.Material) => {
              if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const stdMat = mat as THREE.MeshStandardMaterial;
                if (isLocked) {
                  stdMat.emissive.set('#4ade80');
                  stdMat.emissiveIntensity = 0.3;
                } else {
                  stdMat.emissive.set('#ff0000');
                  stdMat.emissiveIntensity = 0.2;
                }
              }
            });
          }
        }
      });
    }
  }, [isLocked]);

  return (
    <group ref={groupRef} position={position} scale={4}>
      <primitive object={gltf.scene} />
    </group>
  );
  */
};

// Wing Loong UAV Component - loaded from GLB
const WingLoongAircraft: React.FC = () => {
  try {
    const gltf = useGLTF('/wing_loong_i_uav_war_thunder.glb');
    
    React.useEffect(() => {
      logger.log('===== Wing Loong 模型加载成功 =====');
      logger.log('场景信息', {
        children: gltf.scene.children.length,
        type: gltf.scene.type
      });
      
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          
          const mapImage = mat?.map?.image as any;
          logger.log(`网格: ${mesh.name}`, {
            hasMaterial: !!mesh.material,
            materialType: mat?.type,
            color: mat?.color ? `rgb(${Math.round(mat.color.r * 255)}, ${Math.round(mat.color.g * 255)}, ${Math.round(mat.color.b * 255)})` : 'none',
            hasMap: !!mat?.map,
            hasNormalMap: !!mat?.normalMap,
            hasMetalnessMap: !!mat?.metalnessMap,
            hasRoughnessMap: !!mat?.roughnessMap,
            metalness: mat?.metalness,
            roughness: mat?.roughness,
            mapImage: mapImage ? `${mapImage.width}x${mapImage.height}` : 'none',
            mapColorSpace: (mat?.map as any)?.colorSpace || 'unknown'
          });
          
          // 临时方案：由于GLB文件没有颜色贴图，给模型添加灰蓝色
          // 这样至少能看到模型的形状和细节
          if (!mat?.map && mat?.color) {
            mat.color.setHex(0x8BA5B8); // 灰蓝色，类似无人机的常见颜色
            mat.metalness = 0.6;
            mat.roughness = 0.4;
            logger.log(`为 ${mesh.name} 设置临时颜色（因为没有贴图）`);
          }
        }
      });
      
      logger.log('===== 材质检查完成 =====');
    }, [gltf]);
    
    return (
      <primitive object={gltf.scene} scale={1} />
    );
  } catch (error) {
    logger.error('加载 Wing Loong 模型失败', error);
    return null;
  }
};


const SceneContent: React.FC<SceneContentProps> = ({ state, fsmPhysicalRef }) => {
  const aircraftRef = useRef<THREE.Group>(null);
  const azimuthRef = useRef<THREE.Group>(null);
  const elevationRef = useRef<THREE.Group>(null);
  const fsmVisualRef = useRef<THREE.Group>(null); // For visual exaggeration
  const laserRef = useRef<THREE.Line>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const targetMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (aircraftRef.current && azimuthRef.current && elevationRef.current && fsmVisualRef.current && fsmPhysicalRef.current && laserRef.current && targetRef.current) {
      
      // 1. Aircraft Attitude (Disturbance)
      aircraftRef.current.rotation.set(
        -state.aircraftAttitude.pitch,
        state.aircraftAttitude.yaw,
        -state.aircraftAttitude.roll,
        'YXZ' 
      );

      // 2. Gimbal Azimuth (Outer Frame)
      azimuthRef.current.rotation.y = state.gimbalAngle.az;

      // 3. Gimbal Elevation (Inner Frame)
      elevationRef.current.rotation.x = -state.gimbalAngle.el;

      // 4. FSM (Fine Steering)
      // Use actual angles without exaggeration
      fsmVisualRef.current.rotation.x = -state.fsmAngle.x; 
      fsmVisualRef.current.rotation.y = state.fsmAngle.y;

      // PHYSICAL: Actual angle (1x) for the Laser Ray & Camera
      fsmPhysicalRef.current.rotation.order = 'YXZ';
      fsmPhysicalRef.current.rotation.x = -state.fsmAngle.x;
      fsmPhysicalRef.current.rotation.y = state.fsmAngle.y;

      // 5. Target Position
      targetRef.current.position.set(state.targetPos.x, state.targetPos.y, state.targetPos.z);

      // Visual Feedback: Change target color if locked
      if (targetMatRef.current) {
        const isLocked = (state.error * 1000) < 5.0;
        const c = isLocked ? '#4ade80' : '#ef4444';
        targetMatRef.current.color.set(c);
        targetMatRef.current.emissive.set(c);
        targetMatRef.current.emissiveIntensity = isLocked ? 1.0 : 0.5;
      }

      // 6. Laser Ray Calculation
      const laserOrigin = new THREE.Vector3();
      const laserDir = new THREE.Vector3(0, 0, 1);

      fsmPhysicalRef.current.getWorldPosition(laserOrigin);
      fsmPhysicalRef.current.getWorldDirection(laserDir);

      // Ray geometry
      const points = [
        laserOrigin,
        laserOrigin.clone().add(laserDir.multiplyScalar(3000))
      ];
      
      if (laserRef.current.geometry) {
        laserRef.current.geometry.setFromPoints(points);
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[20, 30, 20]} intensity={1.0} />
      <directionalLight position={[-10, 10, -5]} intensity={1.5} />
      {/* Environment map makes metals look like metal */}
      <Environment preset="city" />
      
      <Grid infiniteGrid fadeDistance={300} cellColor="#1e293b" sectionColor="#334155" position={[0, -10, 0]} />

      {/* Target Aircraft */}
      <group ref={targetRef as any} position={[state.targetPos.x, state.targetPos.y, state.targetPos.z]}>
        <TargetAircraft 
          position={[0, 0, 0]} 
          isLocked={(state.error * 1000) < 5.0}
          targetMatRef={targetMatRef}
        />
      </group>

      {/* --- STAGE 1: FIXED-WING AIRCRAFT (Wing Loong UAV) --- */}
      <group ref={aircraftRef}>
        <WingLoongAircraft />

        <Html position={[0, 2.5, 0]} center>
          <div className="text-slate-400 text-xs font-mono whitespace-nowrap pointer-events-none select-none">
            第一级: 载机平台
          </div>
        </Html>

        {/* --- STAGE 2: GIMBAL (Pod) --- */}
        {/* Mounted under the belly */}
        <group position={[0, -0.6, 2]}>
           
           {/* Mount Strut */}
           <mesh position={[0, 0.1, 0]} material={gimbalMaterial}>
             <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
           </mesh>

           {/* Azimuth Frame (Rotates Y) */}
           <group ref={azimuthRef} position={[0, -0.3, 0]}>
              
              {/* Yoke Base */}
              <mesh position={[0, 0.2, 0]} material={gimbalMaterial}>
                 <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
              </mesh>
              {/* Yoke Arms */}
              <mesh position={[-0.35, -0.3, 0]} material={gimbalMaterial}>
                 <boxGeometry args={[0.1, 0.8, 0.4]} />
              </mesh>
              <mesh position={[0.35, -0.3, 0]} material={gimbalMaterial}>
                 <boxGeometry args={[0.1, 0.8, 0.4]} />
              </mesh>

              {/* Elevation Frame (Rotates X) */}
              <group ref={elevationRef} position={[0, -0.3, 0]}>
                 
                 {/* Sensor Ball / Pod */}
                 <mesh rotation={[0, 0, Math.PI/2]} material={sensorHousingMaterial}>
                    <cylinderGeometry args={[0.3, 0.3, 0.68, 32]} />
                 </mesh>
                 
                 {/* Camera/Sensor Window */}
                 <mesh position={[0, 0, 0.3]} rotation={[Math.PI/2, 0, 0]}>
                    <cylinderGeometry args={[0.25, 0.25, 0.1, 32]} />
                    <meshStandardMaterial color="#1e293b" />
                 </mesh>

                 <Html position={[1.0, 0, 0]} center>
                   <div className="text-slate-300 text-xs font-mono whitespace-nowrap pointer-events-none select-none">
                     第二级: 伺服框架
                   </div>
                 </Html>

                 {/* --- STAGE 3: FAST STEERING MIRROR (FSM) --- */}
                 <group position={[0, 0, 0.36]}>
                    
                    {/* 1. Visual Mirror (Exaggerated for visibility) */}
                    <group ref={fsmVisualRef}>
                       <mesh rotation={[Math.PI/2, 0, 0]} material={mirrorMaterial}>
                          <cylinderGeometry args={[0.2, 0.2, 0.02, 32]} />
                       </mesh>
                       {/* Gold rim to make it pop */}
                       <mesh position={[0, 0, -0.015]} rotation={[Math.PI/2, 0, 0]}>
                          <cylinderGeometry args={[0.21, 0.21, 0.01, 32]} />
                          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
                       </mesh>
                    </group>

                    {/* 2. Physical Laser Emitter (Invisible, Accurate) */}
                    <group ref={fsmPhysicalRef}>
                      {/* Debug mesh hidden */}
                      <mesh rotation={[Math.PI/2, 0, 0]} visible={false}>
                          <cylinderGeometry args={[0.05, 0.05, 0.05]} />
                      </mesh>
                    </group>

                    <Html position={[0, -0.6, 0]} center>
                      <div className="text-blue-400 text-xs font-mono whitespace-nowrap pointer-events-none select-none">
                        第三级: 快反镜 (FSM)
                      </div>
                    </Html>
                 </group>

              </group>
           </group>
        </group>
      </group>


    {/* Laser Beam (Red) */}
    <line ref={laserRef as any}>
      <bufferGeometry />
      <lineBasicMaterial color="#ef4444" linewidth={2} transparent opacity={0.8} />
    </line>
    </>
  );
};

// PIP Scene Component - renders only the target for PIP view
const PIPScene: React.FC<{ state: SystemState; fsmPhysicalRef: React.RefObject<THREE.Group> }> = ({ state, fsmPhysicalRef }) => {
  const pipCamRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (pipCamRef.current && fsmPhysicalRef.current) {
      // Get FSM world position and direction
      const laserOrigin = new THREE.Vector3();
      const laserDir = new THREE.Vector3(0, 0, 1);
      
      fsmPhysicalRef.current.getWorldPosition(laserOrigin);
      fsmPhysicalRef.current.getWorldDirection(laserDir);
      
      // Position camera forward from FSM
      const cameraOffset = laserDir.clone().multiplyScalar(2.0);
      pipCamRef.current.position.copy(laserOrigin).add(cameraOffset);
      
      // CRITICAL FIX: Point camera along laser direction, NOT towards target
      // This makes PIP camera follow the actual laser line-of-sight
      const laserEndPoint = laserOrigin.clone().add(laserDir.clone().multiplyScalar(2000));
      pipCamRef.current.lookAt(laserEndPoint);
      pipCamRef.current.updateMatrixWorld();
    }
  });

  return (
    <>
      <PerspectiveCamera 
        ref={pipCamRef}
        makeDefault
        fov={2.0}
        near={100}
        far={10000}
        position={[0, 0, 0]}
      />
      
      {/* Lighting for PIP */}
      <ambientLight intensity={0.6} />
      <directionalLight intensity={2.0} position={[0, 0, 1]} />
      
      {/* Target aircraft for PIP view */}
      <TargetAircraft 
        position={[state.targetPos.x, state.targetPos.y, state.targetPos.z]} 
        isLocked={state.error * 1000 < 5}
      />
      
      {/* Simple starfield background */}
      <mesh>
        <sphereGeometry args={[9000, 8, 8]} />
        <meshBasicMaterial color="#0a0a0a" side={THREE.BackSide} />
      </mesh>
    </>
  );
};

const Scene3D: React.FC<{ state: SystemState }> = ({ state }) => {
  const fsmPhysicalRef = useRef<THREE.Group>(null);

  // Calculate distance for display
  const dist = Math.sqrt(
    state.targetPos.x**2 + 
    state.targetPos.y**2 + 
    state.targetPos.z**2
  ).toFixed(1);

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-inner border border-slate-700 relative">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[6, 3, 6]} fov={45} near={0.1} far={10000} />
        <OrbitControls target={[0, 0, 0]} minDistance={5} maxDistance={50} />
        <Suspense fallback={null}>
          <SceneContent state={state} fsmPhysicalRef={fsmPhysicalRef} />
        </Suspense>
      </Canvas>
      
      {/* PIP Canvas - Independent rendering */}
      <div 
        className="absolute top-4 right-4 border-2 border-cyan-500/50 shadow-2xl pointer-events-none overflow-hidden rounded-sm"
        style={{ width: '240px', height: '180px' }}
      >
        <Canvas 
          style={{ width: '100%', height: '100%' }}
          dpr={[1, 1]}
          gl={{ alpha: false, antialias: false }}
        >
          <Suspense fallback={null}>
            <PIPScene state={state} fsmPhysicalRef={fsmPhysicalRef} />
          </Suspense>
        </Canvas>
        
        {/* Reticle / Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center opacity-60 pointer-events-none">
          <div className="w-8 h-8 border border-yellow-400/50 rounded-full flex items-center justify-center relative">
            <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
            <div className="absolute w-12 h-px bg-yellow-400/30"></div>
            <div className="absolute h-12 w-px bg-yellow-400/30"></div>
          </div>
        </div>
        
        {/* Label */}
        <div className="absolute top-1 left-1 text-[9px] font-mono text-cyan-400 bg-black/60 px-1 rounded pointer-events-none">
          EO CAMERA | FOV 2.0°
        </div>
        
        {/* Distance */}
        <div className="absolute bottom-1 left-1 text-[9px] font-mono text-yellow-400 bg-black/60 px-1 rounded pointer-events-none">
          距离: {dist}m
        </div>
        
        {/* Status */}
        <div className="absolute bottom-1 right-1 text-[9px] font-mono text-green-400 bg-black/60 px-1 rounded pointer-events-none">
          {(state.error * 1000) < 5 ? "LOCKED" : "SEARCHING"}
        </div>
      </div>

      {/* Telemetry Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur p-3 rounded border border-slate-700 text-xs font-mono text-slate-300 shadow-xl">
          <div className="font-bold text-white mb-2 border-b border-slate-700 pb-1">系统遥测数据</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500">滚转 (Roll):</span>
            <span>{(state.aircraftAttitude.roll * 57.3).toFixed(2)}°</span>
            
            <span className="text-slate-500">俯仰 (Pitch):</span>
            <span>{(state.aircraftAttitude.pitch * 57.3).toFixed(2)}°</span>
            
            <span className="text-slate-500">偏航 (Yaw):</span>
            <span>{(state.aircraftAttitude.yaw * 57.3).toFixed(2)}°</span>
            
            <div className="col-span-2 h-px bg-slate-800 my-1"></div>
            
            <span className="text-cyan-400">框架方位:</span>
            <span className="text-cyan-400">{(state.gimbalAngle.az * 57.3).toFixed(2)}°</span>
            
            <span className="text-cyan-400">框架俯仰:</span>
            <span className="text-cyan-400">{(state.gimbalAngle.el * 57.3).toFixed(2)}°</span>
            
            <div className="col-span-2 h-px bg-slate-800 my-1"></div>
            
            <span className="text-purple-400">FSM X轴:</span>
            <span className="text-purple-400">{(state.fsmAngle.x * 1000).toFixed(2)} mrad</span>
            
            <span className="text-purple-400">FSM Y轴:</span>
            <span className="text-purple-400">{(state.fsmAngle.y * 1000).toFixed(2)} mrad</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Preload the Wing Loong GLB model
// F-117 is disabled due to 26MB file size
try {
  useGLTF.preload('/wing_loong_i_uav_war_thunder.glb');
  // useGLTF.preload('/lockheed_f-117_nighthawk.glb'); // Disabled - file too large
} catch (error) {
  console.warn('Failed to preload GLB model:', error);
}

export default Scene3D;