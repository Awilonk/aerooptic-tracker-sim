import { GoogleGenAI } from "@google/genai";
import { SYSTEM_CONTEXT } from '../constants';
import { SimulationParams } from '../types';

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient && process.env.API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const analyzeSystemPerformance = async (
  params: SimulationParams,
  avgError: number,
  peakError: number
): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "API Key 未配置。请设置 process.env.API_KEY。";
  }

  const prompt = `
    分析光电跟踪系统的当前仿真状态。请使用中文回答。
    
    配置:
    - 控制模式: ${params.mode}
    - 载机干扰幅度: ${(params.disturbanceAmp * 57.3).toFixed(2)} 度
    - 框架增益 (Kp): ${params.kp_gimbal}
    
    性能指标:
    - 平均跟踪误差: ${(avgError * 1000).toFixed(2)} mrad
    - 峰值误差: ${(peakError * 1000).toFixed(2)} mrad

    基于“多级联合建模”理论：
    1. 解释给定模式下误差水平的原因。
    2. 如果是 PASSIVE（被动）模式，解释从载机到视轴的耦合。
    3. 如果是 TRACKING（跟踪）模式，解释快反镜 (FSM) 如何减少框架留下的残差。
    4. 保持回答简洁（每点最多 3 句话）。
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
            role: 'user',
            parts: [{ text: SYSTEM_CONTEXT }, { text: prompt }]
        }
      ],
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "未生成分析结果。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成分析失败。请检查 API Key 或网络连接。";
  }
};