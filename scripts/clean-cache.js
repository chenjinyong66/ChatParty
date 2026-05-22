#!/usr/bin/env node

/**
 * 清理构建缓存脚本
 */

const fs = require('fs')
const path = require('path')

console.log('🧹 清理构建缓存...\n')

const pathsToClean = [
  'dist',
  'dist-electron',
  'node_modules/.vite',
  'node_modules/.cache'
]

// Windows 特有的 Electron Builder 缓存路径
const windowsCachePaths = [
  path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache'),
  path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache')
]

pathsToClean.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir)
  if (fs.existsSync(dirPath)) {
    console.log(`删除: ${dir}`)
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
})

// 清理 Windows 缓存
if (process.platform === 'win32') {
  windowsCachePaths.forEach(cachePath => {
    if (fs.existsSync(cachePath)) {
      console.log(`删除 Windows 缓存: ${cachePath}`)
      try {
        fs.rmSync(cachePath, { recursive: true, force: true })
      } catch (error) {
        console.log(`⚠️  无法删除 ${cachePath}: ${error.message}`)
        console.log('   请手动删除或以管理员身份运行')
      }
    }
  })
}

console.log('\n✅ 清理完成！')
console.log('\n💡 提示：')
console.log('   - 如果遇到权限错误，请以管理员身份运行')
console.log('   - 清理后需要重新运行 npm install（如果删除了 node_modules）')
console.log('   - 然后运行构建命令: npm run build:prod')
