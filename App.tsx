import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import Scene3D from './components/Scene3D';
import Dashboard from './components/Dashboard';
import { SystemState, SimulationParams, SimulationMode } from './types';
import { INITIAL_PARAMS, HISTORY_LENGTH } from './constants';

const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [history, setHistory] = useState<SystemState[]>([]);
  const [currentState, setCurrentState] = useState<SystemState>({
    time: 0,
    aircraftAttitude: { roll: 0, pitch: 0, yaw: 0 },
    gimbalAngle: { az: 0, el: 0 },
    gimbalCommand: { az: 0, el: 0 },
    fsmAngle: { x: 0, y: 0 },
    fsmCommand: { x: 0, y: 0 },
    fsmHysteresisState: { hx: 0, hy: 0 },
    targetPos: { x: 0, y: 5, z: 2000 },
    error: 0,
    controlSignal: { az: 0, el: 0 }
  });

  // Physics loop ref to avoid closure staleness
  const stateRef = useRef(currentState);
  const paramsRef = useRef(params);
  
  // Accumulators for multi-rate simulation
  const accumulators = useRef({
    gimbal: 0,
    fsm: 0
  });

  // Reusable Three.js objects for physics math (Avoid GC)
  // Initialize with standard forward Z+ orientation
  const phys = useRef({
    aircraftPos: new THREE.Vector3(0, 0, 0),
    // FIX: Set gimbalOffset to the Intersection of Gimbal Axes (Center of Rotation).
    // Visual Hierarchy: Aircraft -> Mount(0,-0.6,2) -> Az(0,-0.3,0) -> El(0,-0.3,0).
    // Total Offset to Rotation Center = (0, -1.2, 2.0).
    // Using the sensor tip (2.36) caused geometric parallax error during rotation.
    gimbalOffset: new THREE.Vector3(0, -1.2, 2.0), 
    
    quatAc: new THREE.Quaternion(),
    quatGimbalAz: new THREE.Quaternion(),
    quatGimbalEl: new THREE.Quaternion(),
    quatFsmX: new THREE.Quaternion(),
    quatFsmY: new THREE.Quaternion(),
    quatTotal: new THREE.Quaternion(),
    
    vecTarget: new THREE.Vector3(),
    vecGimbalBase: new THREE.Vector3(),
    vecLosIdeal: new THREE.Vector3(), // The vector from Gimbal to Target
    vecLosBody: new THREE.Vector3(),  // Target vector in Aircraft Body Frame
    vecLosGimbal: new THREE.Vector3(), // Target vector in Gimbal Frame
    
    vecPointing: new THREE.Vector3(), // Where the laser actually points
    vecZ: new THREE.Vector3(0, 0, 1), // Reference forward vector
  });

  // Control frequencies
  const GIMBAL_DT = 1 / 50; // 50 Hz (20ms)
  const FSM_DT = 1 / 500;   // 500 Hz (2ms)

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1); // Cap dt to avoid jumps
      lastTime = time;

      const s = stateRef.current;
      const p = paramsRef.current;
      const t = s.time + dt;
      const math = phys.current;

      // --- 1. 载机层干扰 (Aircraft Layer Disturbances) ---
      const maneuverFreq = p.disturbanceFreq; 
      const vibrationFreq = 15; // Hz
      
      // 基础载机运动
      let roll = p.disturbanceAmp * Math.sin(2 * Math.PI * maneuverFreq * t);
      let pitch = 0.5 * p.disturbanceAmp * Math.cos(2 * Math.PI * maneuverFreq * 0.8 * t);
      let yaw = 0.3 * p.disturbanceAmp * Math.sin(t * 0.5);
      
      // 大气湍流 (Dryden模型简化版)
      const turbulenceScale = p.atmosphericTurbulence;
      roll += turbulenceScale * 0.02 * (Math.random() - 0.5) * Math.sin(2 * Math.PI * 2.5 * t);
      pitch += turbulenceScale * 0.015 * (Math.random() - 0.5) * Math.cos(2 * Math.PI * 3.2 * t);
      yaw += turbulenceScale * 0.01 * (Math.random() - 0.5) * Math.sin(2 * Math.PI * 1.8 * t);
      
      // 阵风干扰 (1-cos模型)
      const gustScale = p.windGustIntensity;
      const gustPeriod = 4.0; // 阵风周期
      const gustPhase = (t % gustPeriod) / gustPeriod;
      if (gustPhase < 0.5) {
        const gustFactor = 0.5 * (1 - Math.cos(4 * Math.PI * gustPhase));
        roll += gustScale * 0.03 * gustFactor;
        pitch += gustScale * 0.025 * gustFactor;
      }
      
      // 载机振动 (多谐波模型)
      const vibrationScale = p.aircraftVibration;
      roll += vibrationScale * 0.008 * Math.sin(2 * Math.PI * vibrationFreq * t);
      pitch += vibrationScale * 0.006 * Math.cos(2 * Math.PI * vibrationFreq * t);
      yaw += vibrationScale * 0.004 * Math.sin(2 * Math.PI * (vibrationFreq * 1.2) * t);
      
      // 高频振动谐波
      roll += vibrationScale * 0.003 * Math.sin(2 * Math.PI * (vibrationFreq * 3) * t);
      pitch += vibrationScale * 0.002 * Math.cos(2 * Math.PI * (vibrationFreq * 5) * t);

      // Update Aircraft Quaternion (YXZ order is typical for aircraft heading/pitch/roll)
      math.quatAc.setFromEuler(new THREE.Euler(-pitch, yaw, -roll, 'YXZ'));

      // --- 2. Target Motion ---
      // Distance adjustable from 500m to 7000m
      const targetZ = p.targetDistance;
      // Scale movement proportionally to distance for realistic angular motion
      const distanceScale = p.targetDistance / 2000; // Normalize to 2000m baseline
      // Horizontal motion (X-axis): sinusoidal
      const targetX = 150 * distanceScale * Math.sin(t * p.targetSpeed * 0.5);
      // Vertical motion (Y-axis): larger amplitude for more visible vertical movement
      // Base altitude + sinusoidal vertical motion with different frequency
      const targetY = 20 + 120 * distanceScale * Math.sin(t * p.targetSpeed * 0.3);
      math.vecTarget.set(targetX, targetY, targetZ);

      // --- 3. Geometric Calculations (Kinematics) ---
      
      // Calculate Gimbal Base Position in World Space
      // Base = AircraftPos + Rot * Offset
      math.vecGimbalBase.copy(math.gimbalOffset).applyQuaternion(math.quatAc).add(math.aircraftPos);

      // Calculate Ideal Line of Sight (LOS) Vector in World Space
      math.vecLosIdeal.subVectors(math.vecTarget, math.vecGimbalBase).normalize();

      // Transform LOS into Aircraft Body Frame (Inverse of Aircraft Rotation)
      // This represents "Where is the target relative to the aircraft nose?"
      math.vecLosBody.copy(math.vecLosIdeal).applyQuaternion(math.quatAc.clone().invert());

      // Calculate Ideal Gimbal Angles (Az/El) based on Body Frame Vector
      // Azimuth = atan2(x, z)
      // Elevation = atan2(y, z) (simplified for small angles, use asin(y) for full spherical)
      // Using asin(y) for elevation since vec is normalized
      const idealAz = Math.atan2(math.vecLosBody.x, math.vecLosBody.z);
      const idealEl = Math.asin(math.vecLosBody.y); // Pitch up

      // --- 4. Control Loops ---
      
      let currentGimbalAz = s.gimbalAngle.az;
      let currentGimbalEl = s.gimbalAngle.el;
      let currentFsmX = s.fsmAngle.x;
      let currentFsmY = s.fsmAngle.y;

      // Update Accumulators
      accumulators.current.gimbal += dt;
      accumulators.current.fsm += dt;

      // --- Gimbal Control Loop (50 Hz) ---
      while (accumulators.current.gimbal >= GIMBAL_DT) {
        accumulators.current.gimbal -= GIMBAL_DT;
        
        if (p.mode === SimulationMode.PASSIVE) {
            // Friction/Decay with nonlinear friction effects
            const frictionScale = p.nonlinearFriction;
            currentGimbalAz *= (0.98 - frictionScale * 0.02);
            currentGimbalEl *= (0.98 - frictionScale * 0.02);
        } else {
            // In TRACKING/STABILIZED, we want to drive Gimbal to ideal angles
            const errorAz = idealAz - currentGimbalAz;
            const errorEl = idealEl - currentGimbalEl;

            const kGimbal = p.kp_gimbal * 50.0; // Gain
            
            // 伺服框架层干扰
            // 电机力矩波动 (Motor Torque Ripple)
            const motorRippleScale = p.motorTorqueRipple;
            const motorRippleAz = motorRippleScale * 0.001 * Math.sin(2 * Math.PI * 70 * t); // 70Hz波动
            const motorRippleEl = motorRippleScale * 0.001 * Math.cos(2 * Math.PI * 75 * t); // 75Hz波动
            
            // 转轴非线性摩擦 (LuGre模型简化)
            const frictionScale = p.nonlinearFriction;
            const frictionAz = frictionScale * 0.0005 * Math.sign(errorAz) * (1 - Math.exp(-Math.abs(errorAz) * 100));
            const frictionEl = frictionScale * 0.0005 * Math.sign(errorEl) * (1 - Math.exp(-Math.abs(errorEl) * 100));
            
            // 未配平力矩 (Unbalanced Torque)
            const unbalanceScale = p.unbalancedTorque;
            const unbalanceAz = unbalanceScale * 0.002 * Math.sin(2 * Math.PI * 0.5 * t);
            const unbalanceEl = unbalanceScale * 0.0015 * Math.cos(2 * Math.PI * 0.3 * t);
            
            currentGimbalAz += (errorAz * kGimbal + motorRippleAz - frictionAz + unbalanceAz) * GIMBAL_DT;
            currentGimbalEl += (errorEl * kGimbal + motorRippleEl - frictionEl + unbalanceEl) * GIMBAL_DT;
        }
      }

      // --- FSM Control Loop (500 Hz) ---
      while (accumulators.current.fsm >= FSM_DT) {
        accumulators.current.fsm -= FSM_DT;

        if (p.mode === SimulationMode.TRACKING) {
            // Calculate Residual Error seen by FSM
            // We approximate this by checking the difference between ideal and current gimbal
            // In a real system, this is measured by a PSD/Quad-cell sensor
            
            const residualAz = idealAz - currentGimbalAz;
            const residualEl = idealEl - currentGimbalEl;

            // FSM P-Controller with disturbances
            const fsmLimit = 0.025; // rad
            let kFSM = p.kp_fsm * 1.0; 
            
            // 精密跟踪层干扰 - 根据执行器类型应用不同特性
            let actuatorDisturbanceX = 0;
            let actuatorDisturbanceY = 0;
            
            if (p.fsmActuatorType === 'VCM') {
              // VCM执行器：力矩波动 (高线性度、低迟滞)
              const vcmRippleScale = p.vcmRipple;
              actuatorDisturbanceX = vcmRippleScale * 0.0002 * Math.sin(2 * Math.PI * 200 * t + Math.PI/4);
              actuatorDisturbanceY = vcmRippleScale * 0.0002 * Math.cos(2 * Math.PI * 180 * t);
              
              // VCM没有显著迟滞，重置迟滞状态
              s.fsmHysteresisState.hx = 0;
              s.fsmHysteresisState.hy = 0;
              
            } else if (p.fsmActuatorType === 'PZT') {
              // PZT执行器：迟滞效应 (完整Bouc-Wen动态模型)
              const pztHysteresisScale = p.pztHysteresis;
              
              // Bouc-Wen模型参数 (基于您的MATLAB实现)
              const alpha = p.pztHysteresisAlpha;
              const beta = p.pztHysteresisBeta;
              const gamma = p.pztHysteresisGamma;
              const d = 1.408;
              const l = 0.02; // 焦距参数
              const n = 1;
              
              // 获取当前迟滞内部状态
              let hx = s.fsmHysteresisState.hx;
              let hy = s.fsmHysteresisState.hy;
              
              // 计算输入变化率 (数值微分)
              const u_dt_x = (residualEl - (s.fsmCommand.x || 0)) / FSM_DT;
              const u_dt_y = (residualAz - (s.fsmCommand.y || 0)) / FSM_DT;
              
              // Bouc-Wen动态方程: ḣ = α*u̇ + β*|u̇|*|h|^(n-1)*h - γ*u̇*|h|^n
              const h_dt_x = alpha * u_dt_x + beta * Math.abs(u_dt_x) * Math.pow(Math.abs(hx), n-1) * hx - gamma * u_dt_x * Math.pow(Math.abs(hx), n);
              const h_dt_y = alpha * u_dt_y + beta * Math.abs(u_dt_y) * Math.pow(Math.abs(hy), n-1) * hy - gamma * u_dt_y * Math.pow(Math.abs(hy), n);
              
              // 更新内部状态 (欧拉积分)
              hx += h_dt_x * FSM_DT * pztHysteresisScale;
              hy += h_dt_y * FSM_DT * pztHysteresisScale;
              
              // 迟滞输出: y = d*u + h, θ = atan(y/l)
              const y_x = d * residualEl + hx;
              const y_y = d * residualAz + hy;
              actuatorDisturbanceX = -(Math.atan(y_x / l) - residualEl); // 迟滞引起的角度偏差
              actuatorDisturbanceY = -(Math.atan(y_y / l) - residualAz);
              
              // 更新状态中的迟滞内部状态
              s.fsmHysteresisState.hx = hx;
              s.fsmHysteresisState.hy = hy;
            }
            
            // 参数不确定性影响 (Parameter Uncertainty)
            const uncertaintyScale = p.parameterUncertainty;
            kFSM *= (1 + uncertaintyScale * 0.2 * (Math.random() - 0.5));
            
            // FSM Frame: X rotates Pitch, Y rotates Yaw
            const dx = residualEl - currentFsmX;
            const dy = residualAz - currentFsmY;
            
            currentFsmX += (dx * kFSM + actuatorDisturbanceX);
            currentFsmY += (dy * kFSM + actuatorDisturbanceY);

            // Hard limits
            currentFsmX = Math.max(-fsmLimit, Math.min(fsmLimit, currentFsmX));
            currentFsmY = Math.max(-fsmLimit, Math.min(fsmLimit, currentFsmY));
        } else {
            // Center FSM if not tracking
            currentFsmX *= 0.9;
            currentFsmY *= 0.9;
        }
      }

      // --- 5. Calculate Actual Pointing Vector & True Error (Kinematics) ---
      
      // Build the full rotation chain:
      // World -> Aircraft -> Gimbal Az -> Gimbal El -> FSM Y -> FSM X -> Laser(Z+)
      
      math.quatGimbalAz.setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentGimbalAz);
      math.quatGimbalEl.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -currentGimbalEl); // Inverted X in ThreeJS scene logic
      
      math.quatFsmY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentFsmY);
      math.quatFsmX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -currentFsmX);

      // Combine Rotations: Order matters (Parent -> Child)
      math.quatTotal.copy(math.quatAc)
        .multiply(math.quatGimbalAz)
        .multiply(math.quatGimbalEl)
        .multiply(math.quatFsmY)
        .multiply(math.quatFsmX);
      
      // Transform Forward Vector (0,0,1)
      math.vecPointing.copy(math.vecZ).applyQuaternion(math.quatTotal).normalize();
      
      // Compute Angle between Ideal LOS and Actual Pointing Vector
      // This is the True 3D Error
      const totalError = math.vecPointing.angleTo(math.vecLosIdeal);

      const newState: SystemState = {
        time: t,
        aircraftAttitude: { roll, pitch, yaw },
        gimbalAngle: { az: currentGimbalAz, el: currentGimbalEl },
        gimbalCommand: { az: idealAz, el: idealEl },
        fsmAngle: { x: currentFsmX, y: currentFsmY },
        fsmCommand: { 
          x: p.mode === SimulationMode.TRACKING ? (idealEl - currentGimbalEl) : 0, 
          y: p.mode === SimulationMode.TRACKING ? (idealAz - currentGimbalAz) : 0 
        },
        fsmHysteresisState: { hx: s.fsmHysteresisState.hx, hy: s.fsmHysteresisState.hy },
        targetPos: { x: targetX, y: targetY, z: targetZ },
        error: totalError,
        controlSignal: { az: 0, el: 0 }
      };

      stateRef.current = newState;
      setCurrentState(newState);
      
      if (t - (history.length > 0 ? history[history.length-1].time : 0) > 0.05) {
        setHistory(prev => {
          const newH = [...prev, newState];
          if (newH.length > HISTORY_LENGTH) return newH.slice(newH.length - HISTORY_LENGTH);
          return newH;
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [history]);

  const getModeName = (mode: SimulationMode) => {
    switch(mode) {
      case SimulationMode.PASSIVE: return '被动模式';
      case SimulationMode.STABILIZED: return '稳定模式';
      case SimulationMode.TRACKING: return '跟踪模式';
      default: return mode;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-slate-800 bg-slate-900 px-4 flex items-center justify-between shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-lg flex items-center justify-center shadow-cyan-500/20 shadow-lg">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white leading-none">光电跟踪系统<span className="text-cyan-400 font-light">多级仿真</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
           <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span>系统运行中</span>
           </div>
           <div className={`px-2 py-0.5 rounded-full border ${params.mode === SimulationMode.PASSIVE ? 'border-slate-600 text-slate-400 bg-slate-800' : 'border-cyan-600 text-cyan-400 bg-cyan-950/40'} transition-all`}>
             当前: {getModeName(params.mode)}
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left: 3D Viewport */}
        <section className="flex-[2] relative min-w-[400px] flex flex-col bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
           <Scene3D state={currentState} />
           <div className="absolute bottom-3 right-3 pointer-events-none">
              <div className="bg-slate-950/80 backdrop-blur-md text-[9px] text-slate-500 px-2 py-1 rounded border border-white/5 shadow-lg">
                左键: 旋转 • 右键: 平移 • 滚轮: 缩放
              </div>
           </div>
        </section>

        {/* Right: Controls & Data */}
        <section className="flex-1 min-w-[300px] max-w-[400px] flex flex-col h-full">
          <Dashboard 
            history={history} 
            params={params} 
            setParams={setParams}
          />
        </section>
      </main>
    </div>
  );
};

export default App;