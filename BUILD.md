# 构建说明

## 构建命令

### 1. 开发环境

```bash
# 开发模式（默认启用工具集）
npm run dev

# 生产模式（默认启用工具集）
npm run prod
```

### 2. 生产构建

#### 方式一：使用环境变量文件（推荐）

```bash
# 默认构建（不包含工具集）
# .env.production 中 VITE_ENABLE_TOOLSET=false
npm run build:prod

# 自定义构建
# 可以修改 .env.production 中的 VITE_ENABLE_TOOLSET 值
npm run build:custom
```

#### 方式二：使用命令行参数

```bash
# 构建包含工具集的版本
npm run build:with-toolset

# 构建不包含工具集的版本
npm run build:without-toolset
```

#### 方式三：手动设置环境变量

```bash
# Windows (PowerShell)
$env:ENABLE_TOOLSET="true"
npm run build:custom

# Windows (CMD)
set ENABLE_TOOLSET=true
npm run build:custom

# Linux/Mac
ENABLE_TOOLSET=true npm run build:custom
```

### 3. 平台特定构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# macOS ARM64 (M1/M2)
npm run build:mac:arm64

# macOS x64 (Intel)
npm run build:mac:x64

# macOS Universal (同时支持Intel和M1/M2)
npm run build:mac:universal
```

## 环境变量说明

### VITE_ENABLE_TOOLSET

控制是否启用工具集功能。

- `true`: 启用工具集（菜单和路由都会显示）
- `false`: 禁用工具集（菜单和路由都会隐藏）

**位置**：
- `.env`: 开发环境配置
- `.env.production`: 生产环境配置

## 构建错误解决方案

### 错误1: file source doesn't exist

**原因**: `extraResources` 配置中引用的 node_modules 文件不存在

**解决方案**: 已在 `package.json` 中移除 `extraResources` 配置，这些文件会被打包到 asar 中。

### 错误2: Cannot create symbolic link - 客户端没有所需的特权

**原因**: Windows 创建符号链接需要管理员权限

**解决方案**:

#### 方案一：以管理员身份运行（推荐）

1. 右键点击 PowerShell 或 CMD
2. 选择"以管理员身份运行"
3. 导航到项目目录
4. 运行构建命令

#### 方案二：启用开发者模式（Windows 10/11）

1. 打开"设置" > "更新和安全" > "开发者选项"
2. 启用"开发人员模式"
3. 重启电脑
4. 正常运行构建命令

#### 方案三：禁用代码签名（已自动处理）

构建配置已优化，会自动处理签名问题。

## 构建输出

构建完成后，安装包位于 `dist/` 目录：

- Windows: `dist/ChatParty Setup 1.0.1.exe`
- macOS: `dist/ChatParty-1.0.1.dmg`

## 注意事项

1. **首次构建**: 首次构建会下载 Electron 和相关工具，可能需要较长时间
2. **网络问题**: 如果下载失败，可以配置国内镜像源
3. **杀毒软件**: 某些杀毒软件可能会拦截构建过程，请添加信任
4. **磁盘空间**: 构建过程需要约 2GB 临时空间

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 构建不含工具集的版本（推荐）
npm run build:prod

# 或构建包含工具集的版本
npm run build:with-toolset
```

## 高级配置

### 自定义构建配置

编辑 `electron-builder.config.js` 或 `package.json` 中的 `build` 字段：

```json
{
  "build": {
    "appId": "com.yourapp.app",
    "productName": "YourAppName",
    "compression": "maximum",
    "asar": true
  }
}
```

### 环境变量优先级

命令行参数 > .env.production > .env > 默认值

示例：
```bash
# 会使用命令行的 true，忽略 .env 文件
ENABLE_TOOLSET=true npm run build:custom
```
