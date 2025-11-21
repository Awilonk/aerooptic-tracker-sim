import { SimulationMode, SimulationParams, FSMActuatorType } from './types';

export const INITIAL_PARAMS: SimulationParams = {
  disturbanceFreq: 0.5, // Hz (Maneuver frequency)
  disturbanceAmp: 0.15, // Radians (approx 8 degrees)
  targetSpeed: 0.8,
  targetDistance: 2000, // meters (500-7000m range)
  kp_gimbal: 0.2, // Increased gain for tighter coarse tracking
  kp_fsm: 0.8, // Increased gain for tighter fine tracking
  mode: SimulationMode.PASSIVE,
  fsmActuatorType: FSMActuatorType.VCM, // 默认使用VCM执行器
  
  // 载机层干扰 - 基于chap2.tex第2.1节
  atmosphericTurbulence: 0.1, // 大气湍流强度 (Dryden模型)
  windGustIntensity: 0.05, // 阵风强度 (1-cos模型)
  aircraftVibration: 0.08, // 载机振动幅度 (多谐波模型)
  unbalancedTorque: 0.06, // 未配平力矩强度
  
  // 伺服框架层干扰 - 基于chap2.tex第2.2节
  motorTorqueRipple: 0.03, // 电机力矩波动
  nonlinearFriction: 0.04, // 转轴非线性摩擦 (LuGre模型)
  
  // 精密跟踪层干扰 - 基于chap2.tex第2.3节
  vcmRipple: 0.02, // VCM力矩波动
  pztHysteresis: 0.07, // PZT迟滞效应 (Bouc-Wen模型)
  pztHysteresisAlpha: -0.475, // PZT迟滞α参数
  pztHysteresisBeta: 0.023, // PZT迟滞β参数
  pztHysteresisGamma: -0.0025, // PZT迟滞γ参数
  
  // 系统不确定性 - 基于chap2.tex第2.4节
  parameterUncertainty: 0.05, // 参数不确定性 (±10%摄动)
};

export const HISTORY_LENGTH = 100;

// Context for the LLM to understand the physics model based on the PDF "Multi-level Joint Modeling"
export const SYSTEM_CONTEXT = `
你是一名机载光电跟踪系统专家。
该系统被建模为“三级深耦合系统”：
1. 载机平台（第一级）：建模为“协调转弯”动力学。干扰源包括机动（低频）和风阵风/振动（高频）。
2. 伺服框架（第二级）：2轴框架（方位/俯仰）。受基座运动耦合和不平衡力矩影响。负责大视场校正。
3. 快反镜 (FSM)（第三级/精跟踪）：光路内的高带宽机构。负责校正残差和抖动。

用户正在运行仿真。请用中文回答。
输入数据包括：模式（被动/稳定/跟踪）、干扰幅度和跟踪误差（RMS）。
`;