import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { SystemState, SimulationParams, SimulationMode, FSMActuatorType } from '../types';
import { INITIAL_PARAMS } from '../constants';

interface DashboardProps {
  history: SystemState[];
  params: SimulationParams;
  setParams: (p: SimulationParams) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  history, 
  params, 
  setParams
}) => {
  
  // State for active chart tab
  const [activeTab, setActiveTab] = React.useState<'error' | 'aircraft' | 'gimbal' | 'fsm'>('error');
  
  // Prepare chart data for different tabs
  const chartData = history.map(h => ({
    time: h.time.toFixed(2),
    error: (h.error * 1000), // Convert to mrad
    // Aircraft attitude (convert to degrees)
    roll: h.aircraftAttitude.roll * 57.3,
    pitch: h.aircraftAttitude.pitch * 57.3,
    yaw: h.aircraftAttitude.yaw * 57.3,
    // Gimbal angles (convert to degrees)
    gimbalAz: h.gimbalAngle.az * 57.3,
    gimbalEl: h.gimbalAngle.el * 57.3,
    gimbalCmdAz: h.gimbalCommand.az * 57.3,
    gimbalCmdEl: h.gimbalCommand.el * 57.3,
    // FSM angles (convert to mrad)
    fsmX: h.fsmAngle.x * 1000,
    fsmY: h.fsmAngle.y * 1000,
    fsmCmdX: h.fsmCommand.x * 1000,
    fsmCmdY: h.fsmCommand.y * 1000,
  }));

  const currentErrorMrad = history.length > 0 ? history[history.length - 1].error * 1000 : 0;

  // Calculate RMSE for the current window
  const calculateRMSE = (data: SystemState[]) => {
    if (data.length === 0) return 0;
    const sumSquaredErrors = data.reduce((sum, state) => sum + (state.error * state.error), 0);
    return Math.sqrt(sumSquaredErrors / data.length) * 1000; // Convert to mrad
  };

  const currentRMSE = calculateRMSE(history);

  // Format error helper: < 1 mrad shows in urad
  const formatErrorDisplay = (mrad: number) => {
    if (mrad < 1.0) {
      return `${(mrad * 1000).toFixed(0)} µrad`;
    }
    return `${mrad.toFixed(2)} mrad`;
  };

  const getModeName = (mode: string) => {
    switch(mode) {
      case SimulationMode.PASSIVE: return '被动模式';
      case SimulationMode.STABILIZED: return '稳定模式';
      case SimulationMode.TRACKING: return '跟踪模式';
      default: return mode;
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden pr-1">
      
      {/* Control Panel */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-md shrink-0 overflow-y-auto max-h-[50%] scrollbar-thin">
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            系统参数配置
          </h2>
          <button
            onClick={() => setParams(INITIAL_PARAMS)}
            className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded border border-slate-600 hover:border-slate-500 transition-all"
            title="恢复默认设置"
          >
            重置
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Mode Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">控制模式</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(Object.keys(SimulationMode) as Array<keyof typeof SimulationMode>).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setParams({ ...params, mode: SimulationMode[mode] })}
                  className={`py-1.5 text-[9px] font-bold rounded transition-all border ${
                    params.mode === mode 
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(8,145,178,0.4)]' 
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {getModeName(SimulationMode[mode])}
                </button>
              ))}
            </div>
          </div>

          {/* Environment Sliders */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-slate-500 uppercase">环境设置</div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>载机扰动幅度</span>
                <span className="font-mono text-slate-200">{(params.disturbanceAmp * 57.3).toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={params.disturbanceAmp}
                onChange={(e) => setParams({...params, disturbanceAmp: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div>
               <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>目标移动速度</span>
                <span className="font-mono text-slate-200">{params.targetSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.1"
                value={params.targetSpeed}
                onChange={(e) => setParams({...params, targetSpeed: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div>
               <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>目标距离</span>
                <span className="font-mono text-slate-200">{(params.targetDistance / 1000).toFixed(1)}km</span>
              </div>
              <input
                type="range"
                min="500"
                max="7000"
                step="100"
                value={params.targetDistance}
                onChange={(e) => setParams({...params, targetDistance: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          {/* 载机层干扰 */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-orange-400 uppercase">载机层干扰</div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>大气湍流</span>
                <span className="font-mono text-slate-200">{(params.atmosphericTurbulence * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.atmosphericTurbulence}
                onChange={(e) => setParams({...params, atmosphericTurbulence: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>阵风强度</span>
                <span className="font-mono text-slate-200">{(params.windGustIntensity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.windGustIntensity}
                onChange={(e) => setParams({...params, windGustIntensity: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>载机振动</span>
                <span className="font-mono text-slate-200">{(params.aircraftVibration * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.aircraftVibration}
                onChange={(e) => setParams({...params, aircraftVibration: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>未配平力矩</span>
                <span className="font-mono text-slate-200">{(params.unbalancedTorque * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.unbalancedTorque}
                onChange={(e) => setParams({...params, unbalancedTorque: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>

          {/* 伺服框架层干扰 */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-yellow-400 uppercase">伺服框架层干扰</div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>电机力矩波动</span>
                <span className="font-mono text-slate-200">{(params.motorTorqueRipple * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.motorTorqueRipple}
                onChange={(e) => setParams({...params, motorTorqueRipple: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>非线性摩擦</span>
                <span className="font-mono text-slate-200">{(params.nonlinearFriction * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.nonlinearFriction}
                onChange={(e) => setParams({...params, nonlinearFriction: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
          </div>

          {/* 精密跟踪层干扰 */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-green-400 uppercase">精密跟踪层干扰</div>
            
            {/* FSM执行器类型选择 */}
            <div>
              <div className="text-[10px] text-slate-400 mb-1">FSM执行器类型</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setParams({...params, fsmActuatorType: FSMActuatorType.VCM})}
                  className={`flex-1 px-2 py-1 text-[9px] rounded border transition-colors ${
                    params.fsmActuatorType === FSMActuatorType.VCM
                      ? 'bg-green-600 border-green-500 text-white font-bold'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  VCM
                </button>
                <button
                  onClick={() => setParams({...params, fsmActuatorType: FSMActuatorType.PZT})}
                  className={`flex-1 px-2 py-1 text-[9px] rounded border transition-colors ${
                    params.fsmActuatorType === FSMActuatorType.PZT
                      ? 'bg-purple-600 border-purple-500 text-white font-bold'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  PZT
                </button>
              </div>
            </div>
            
            {/* VCM参数 - 仅当选择VCM执行器时显示 */}
            {params.fsmActuatorType === FSMActuatorType.VCM && (
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>VCM力矩波动</span>
                  <span className="font-mono text-slate-200">{(params.vcmRipple * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.01"
                  value={params.vcmRipple}
                  onChange={(e) => setParams({...params, vcmRipple: parseFloat(e.target.value)})}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            )}
            {/* PZT参数 - 仅当选择PZT执行器时显示 */}
            {params.fsmActuatorType === FSMActuatorType.PZT && (
              <>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>PZT迟滞效应</span>
                    <span className="font-mono text-slate-200">{(params.pztHysteresis * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.01"
                    value={params.pztHysteresis}
                    onChange={(e) => setParams({...params, pztHysteresis: parseFloat(e.target.value)})}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                      <span>α</span>
                      <span className="font-mono text-slate-300">{params.pztHysteresisAlpha.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min="-1"
                      max="0"
                      step="0.001"
                      value={params.pztHysteresisAlpha}
                      onChange={(e) => setParams({...params, pztHysteresisAlpha: parseFloat(e.target.value)})}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                      <span>β</span>
                      <span className="font-mono text-slate-300">{params.pztHysteresisBeta.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.1"
                      step="0.001"
                      value={params.pztHysteresisBeta}
                      onChange={(e) => setParams({...params, pztHysteresisBeta: parseFloat(e.target.value)})}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
                      <span>γ</span>
                      <span className="font-mono text-slate-300">{params.pztHysteresisGamma.toFixed(4)}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.01"
                      max="0"
                      step="0.0001"
                      value={params.pztHysteresisGamma}
                      onChange={(e) => setParams({...params, pztHysteresisGamma: parseFloat(e.target.value)})}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 系统不确定性 */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-red-400 uppercase">系统不确定性</div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>参数不确定性</span>
                <span className="font-mono text-slate-200">{(params.parameterUncertainty * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.parameterUncertainty}
                onChange={(e) => setParams({...params, parameterUncertainty: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>

          {/* PID Tuners */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <div className="text-[10px] font-bold text-slate-500 uppercase">控制器参数 (PID)</div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>框架刚度 (50Hz)</span>
                <span className="font-mono text-slate-200">{params.kp_gimbal.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.kp_gimbal}
                onChange={(e) => setParams({...params, kp_gimbal: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>快反镜增益 (500Hz)</span>
                <span className="font-mono text-slate-200">{params.kp_fsm.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.01"
                value={params.kp_fsm}
                onChange={(e) => setParams({...params, kp_fsm: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Charts */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-md flex flex-col flex-grow min-h-[200px]">
        {/* Tab Header */}
        <div className="flex justify-between items-center mb-2 shrink-0">
          <div className="flex gap-1">
            {[
              { id: 'error', label: '跟踪误差', color: 'text-red-400' },
              { id: 'aircraft', label: '载机姿态', color: 'text-orange-400' },
              { id: 'gimbal', label: '框架跟随', color: 'text-cyan-400' },
              { id: 'fsm', label: '精跟踪', color: 'text-purple-400' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-[9px] px-2 py-1 rounded transition-all border ${
                  activeTab === tab.id 
                    ? `bg-slate-700 border-slate-600 ${tab.color} font-bold` 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {activeTab === 'error' && (
            <div className="flex gap-2">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${currentErrorMrad < 1 ? 'bg-green-900/50 border-green-700 text-green-400' : currentErrorMrad < 5 ? 'bg-yellow-900/50 border-yellow-700 text-yellow-400' : 'bg-red-900/50 border-red-700 text-red-400'}`}>
                 误差: {formatErrorDisplay(currentErrorMrad)}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${currentRMSE < 1 ? 'bg-blue-900/50 border-blue-700 text-blue-400' : currentRMSE < 5 ? 'bg-indigo-900/50 border-indigo-700 text-indigo-400' : 'bg-purple-900/50 border-purple-700 text-purple-400'}`}>
                 RMSE: {formatErrorDisplay(currentRMSE)}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1 w-full bg-slate-900/50 rounded border border-slate-700/50 p-1 overflow-hidden relative">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'error' && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  width={35}
                  domain={[0, 'auto']}
                  allowDataOverflow={false}
                  tickFormatter={(value) => {
                    if (value < 1.0 && value > 0) {
                      return value.toFixed(2);
                    }
                    return value.toFixed(0);
                  }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px', color: '#f8fafc' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'error') {
                      if (value < 1.0) {
                        return [(value * 1000).toFixed(0) + ' µrad', '误差'];
                      }
                      return [value.toFixed(2) + ' mrad', '误差'];
                    }
                    return [value.toFixed(2), name];
                  }}
                  labelStyle={{ display: 'none' }}
                  isAnimationActive={false}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="error" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} 
                  name="跟踪误差"
                />
              </LineChart>
            )}
            
            {activeTab === 'aircraft' && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  width={35}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px', color: '#f8fafc' }}
                  formatter={(value: number, name: string) => [value.toFixed(2) + '°', name]}
                  labelStyle={{ display: 'none' }}
                  isAnimationActive={false}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                  iconType="line"
                />
                <Line type="monotone" dataKey="roll" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} name="滚转" />
                <Line type="monotone" dataKey="pitch" stroke="#eab308" strokeWidth={1.5} dot={false} isAnimationActive={false} name="俯仰" />
                <Line type="monotone" dataKey="yaw" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} name="偏航" />
              </LineChart>
            )}
            
            {activeTab === 'gimbal' && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  width={35}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px', color: '#f8fafc' }}
                  formatter={(value: number, name: string) => [value.toFixed(2) + '°', name]}
                  labelStyle={{ display: 'none' }}
                  isAnimationActive={false}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                  iconType="line"
                />
                <Line type="monotone" dataKey="gimbalCmdAz" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} name="方位指令" />
                <Line type="monotone" dataKey="gimbalAz" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} name="方位实际" />
                <Line type="monotone" dataKey="gimbalCmdEl" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} name="俯仰指令" />
                <Line type="monotone" dataKey="gimbalEl" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name="俯仰实际" />
              </LineChart>
            )}
            
            {activeTab === 'fsm' && (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  width={35}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px', color: '#f8fafc' }}
                  formatter={(value: number, name: string) => [value.toFixed(2) + ' mrad', name]}
                  labelStyle={{ display: 'none' }}
                  isAnimationActive={false}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                  iconType="line"
                />
                <Line type="monotone" dataKey="fsmCmdX" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} name="X轴指令" />
                <Line type="monotone" dataKey="fsmX" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} name="X轴实际" />
                <Line type="monotone" dataKey="fsmCmdY" stroke="#ec4899" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} name="Y轴指令" />
                <Line type="monotone" dataKey="fsmY" stroke="#ec4899" strokeWidth={2} dot={false} isAnimationActive={false} name="Y轴实际" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;