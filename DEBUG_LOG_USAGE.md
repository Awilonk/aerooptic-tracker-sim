# 调试日志使用说明

## 如何下载日志文件

### 方法1：使用界面按钮（推荐）
在左侧控制面板的顶部，点击 **"📥 下载日志"** 按钮，会自动下载一个包含所有调试信息的文本文件。

### 方法2：使用浏览器控制台
1. 按 F12 打开浏览器开发者工具
2. 切换到 Console（控制台）标签
3. 输入以下命令并回车：
   ```javascript
   downloadLogs()
   ```
4. 日志文件会自动下载

## 日志内容说明

日志文件包含以下信息：

### Wing Loong 模型加载信息
- **场景信息**：模型的子对象数量和类型
- **网格信息**：每个网格的详细材质属性
  - `hasMaterial`: 是否有材质
  - `materialType`: 材质类型（通常是 MeshStandardMaterial）
  - `color`: 材质的基础颜色（RGB值）
  - `hasMap`: 是否有颜色贴图（纹理）
  - `hasNormalMap`: 是否有法线贴图
  - `hasMetalnessMap`: 是否有金属度贴图
  - `hasRoughnessMap`: 是否有粗糙度贴图
  - `metalness`: 金属度值
  - `roughness`: 粗糙度值
  - `mapImage`: 贴图的尺寸（宽x高）
  - `mapColorSpace`: 颜色空间

## 问题排查

### 如果模型显示为纯白色

检查日志中的以下信息：

1. **hasMap 是否为 true**
   - 如果为 false，说明模型没有颜色贴图
   - 需要检查GLB文件是否包含纹理

2. **color 的RGB值**
   - 如果是 rgb(255, 255, 255)，说明材质颜色被设置为白色
   - 正常情况下应该有不同的颜色值

3. **mapImage 的值**
   - 如果显示 "none"，说明贴图没有加载
   - 如果显示尺寸（如 "1024x1024"），说明贴图已加载

4. **KHR_materials_pbrSpecularGlossiness 警告**
   - 这是一个旧的材质扩展
   - 虽然有警告，但Three.js仍会尝试加载
   - 可能导致材质显示不正确

## 当前代码保证

代码中已经确保：
- ✅ **不修改材质颜色**：Wing Loong组件不会改变任何材质的color属性
- ✅ **不修改贴图**：所有贴图（map, normalMap等）保持原样
- ✅ **不修改材质参数**：metalness、roughness等参数不被修改

## 联系支持

如果下载的日志文件显示模型有贴图但仍然显示为白色，请提供日志文件以便进一步分析。
