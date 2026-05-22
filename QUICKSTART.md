# 快速开始指南

## 🚀 快速构建步骤

### 步骤 1: 安装依赖e:

<br />

```bash
npm install
```

如果遇到网络问题，可以使用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 步骤 2: 清理缓存（可选）

如果之前构建失败，建议先清理缓存：

```bash
npm run clean
```

**注意**：如果遇到权限错误，请以管理员身份运行 PowerShell 或 CMD。

### 步骤 3: 构建应用

#### 方案 A: 构建不含工具集的版本（推荐）

```bash
npm run build:prod
```

#### 方案 B: 构建含工具集的版本

```bash
npm run build:with-toolset
```

## ⚠️ 常见问题解决

### 问题 1: 权限错误

**错误信息**：

```
ERROR: Cannot create symbolic link : 客户端没有所需的特权
```

**解决方案**：

#### 方法一：以管理员身份运行（推荐）

1. 右键点击 PowerShell 或 CMD
2. 选择"以管理员身份运行"
3. 导航到项目目录
4. 运行构建命令

#### 方法二：启用 Windows 开发者模式

1. 打开"设置" > "更新和安全" > "开发者选项"
2. 启用"开发人员模式"
3. 重启电脑
4. 正常运行构建命令

### 问题 2: 网络下载失败

**错误信息**：

```
downloading url=... failed
```

**解决方案**：

#### 方法一：使用镜像源

创建或编辑 `.npmrc` 文件：

```ini
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

#### 方法二：手动下载

1. 访问镜像网站下载所需文件
2. 放置到缓存目录：`%LOCALAPPDATA%\electron-builder\Cache\`

### 问题 3: 文件不存在错误

**错误信息**：

```
file source doesn't exist from=node_modules/...
```

**解决方案**：

已在 `package.json` 中移除 `extraResources` 配置，此问题已解决。

如果仍然出现，请运行：

```bash
# 清理并重新安装
npm run clean
rm -rf node_modules
npm install
```

## 📦 构建输出

构建完成后，安装包位于 `dist/` 目录：

- **Windows**: `dist/ChatParty Setup 1.0.1.exe`
- **macOS**: `dist/ChatParty-1.0.1.dmg`

## 🎯 推荐构建流程

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

### 生产构建（首次）

```bash
# 1. 以管理员身份运行 PowerShell

# 2. 清理缓存
npm run clean

# 3. 安装依赖
npm install

# 4. 构建（不含工具集）
npm run build:prod
```

### 生产构建（后续）

```bash
# 直接构建即可
npm run build:prod
```

## 🔧 环境变量配置

### .env 文件（开发环境）

```env
VITE_ENABLE_TOOLSET=true
```

### .env.production 文件（生产环境）

```env
VITE_ENABLE_TOOLSET=false
```

### 临时修改

```bash
# Windows PowerShell
$env:VITE_ENABLE_TOOLSET="true"
npm run build

# Windows CMD
set VITE_ENABLE_TOOLSET=true
npm run build

# Linux/Mac
VITE_ENABLE_TOOLSET=true npm run build
```

## 📝 构建检查清单

构建前请确认：

- [ ] 已安装 Node.js 16+ 和 npm
- [ ] 已运行 `npm install`
- [ ] 已配置环境变量（可选）
- [ ] 以管理员身份运行（Windows）
- [ ] 有足够的磁盘空间（至少 2GB）
- [ ] 杀毒软件已添加信任（可选）

## 🆘 仍然无法解决？

1. 查看完整构建日志
2. 检查 Node.js 版本：`node -v`
3. 检查 npm 版本：`npm -v`
4. 清理所有缓存并重新安装：

```bash
# Windows
npm run clean
rmdir /s /q node_modules
del package-lock.json
npm install

# Linux/Mac
npm run clean
rm -rf node_modules
rm package-lock.json
npm install
```

1. 提交 Issue 并附上完整错误日志

## 💡 提示

- 首次构建会下载 Electron 等依赖，需要等待较长时间
- 建议使用管理员权限运行构建命令
- 如果网络不稳定，建议使用国内镜像源
- 构建完成后可以删除 `node_modules` 节省空间（开发时需要重新安装）

