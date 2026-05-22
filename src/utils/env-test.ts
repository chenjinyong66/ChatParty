/**
 * 环境变量测试
 * 用于验证工具集功能的环境变量配置是否正确
 */

console.log('=== 环境变量测试 ===')
console.log('')

console.log('环境变量值:')
console.log('  VITE_ENABLE_TOOLSET:', import.meta.env.VITE_ENABLE_TOOLSET)
console.log('  类型:', typeof import.meta.env.VITE_ENABLE_TOOLSET)
console.log('  是否为 "true":', import.meta.env.VITE_ENABLE_TOOLSET === 'true')
console.log('')

console.log('模式:')
console.log('  MODE:', import.meta.env.MODE)
console.log('  DEV:', import.meta.env.DEV)
console.log('  PROD:', import.meta.env.PROD)
console.log('')

console.log('工具集功能:')
if (import.meta.env.VITE_ENABLE_TOOLSET === 'true') {
  console.log('  ✅ 工具集功能已启用')
  console.log('  - 工具集菜单将显示')
  console.log('  - 工具集路由将加载')
} else {
  console.log('  ❌ 工具集功能已禁用')
  console.log('  - 工具集菜单将隐藏')
  console.log('  - 工具集路由不会加载')
}
console.log('')

console.log('=== 测试完成 ===')
