export enum SimulationMode {
  PASSIVE = 'PASSIVE', // No control, moves with aircraft
  STABILIZED = 'STABILIZED', // Coarse gimbal stabilization
  TRACKING = 'TRACKING', // Coarse + Fine tracking
}

export enum FSMActuatorType {
  VCM = 'VCM', // Voice Coil Motor - 高线性度、低迟滞
  PZT = 'PZT', // Piezoelectric - 高精度、存在迟滞
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Euler {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface SystemState {
  time: number;
  aircraftAttitude: Euler; // Disturbance from carrier
  gimbalAngle: { az: number; el: number }; // Coarse stage actual angles
  gimbalCommand: { az: number; el: number }; // Coarse stage command angles
  fsmAngle: { x: number; y: number }; // Fine stage actual angles (Fast Steering Mirror)
  fsmCommand: { x: number; y: number }; // Fine stage command angles
  fsmHysteresisState: { hx: number; hy: number }; // PZT hysteresis internal states
  targetPos: Vector3;
  error: number; // Line of sight error magnitude
  controlSignal: { az: number; el: number };
}

export interface SimulationParams {
  disturbanceFreq: number;
  disturbanceAmp: number;
  targetSpeed: number;
  targetDistance: number; // Target distance in meters (500-7000m)
  kp_gimbal: number; // Proportional gain for gimbal
  kp_fsm: number; // Proportional gain for FSM
  mode: SimulationMode;
  fsmActuatorType: FSMActuatorType; // FSM执行器类型
  
  // 载机层干扰 (Aircraft Layer Disturbances)
  atmosphericTurbulence: number; // 大气湍流强度 (0-1)
  windGustIntensity: number; // 阵风强度 (0-1)
  aircraftVibration: number; // 载机振动幅度 (0-1)
  unbalancedTorque: number; // 未配平力矩强度 (0-1)
  
  // 伺服框架层干扰 (Servo Frame Layer Disturbances)
  motorTorqueRipple: number; // 电机力矩波动 (0-1)
  nonlinearFriction: number; // 转轴非线性摩擦 (0-1)
  
  // 精密跟踪层干扰 (Precision Tracking Layer Disturbances)
  vcmRipple: number; // VCM力矩波动 (0-1)
  pztHysteresis: number; // PZT迟滞效应 (0-1)
  pztHysteresisAlpha: number; // PZT迟滞α参数
  pztHysteresisBeta: number; // PZT迟滞β参数
  pztHysteresisGamma: number; // PZT迟滞γ参数
  
  // 系统不确定性 (System Uncertainties)
  parameterUncertainty: number; // 参数不确定性 (0-1)
}

export interface AnalysisResult {
  text: string;
  loading: boolean;
}