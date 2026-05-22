<template>
  <div class="chat-view">
    <div class="chat-container">
      <!-- 统一输入区域 -->
      <div
          class="input-section"
          :class="{ 'input-section-collapsed': isInputCollapsed }"
      >
        <UnifiedInput @message-sent="handleMessageSent" />
      </div>

      <!-- 折叠/展开输入框按钮 -->
      <div
          class="toggle-input-btn"
          :title="isInputCollapsed ? '展开输入框' : '收起输入框'"
          @click="toggleInputCollapse"
      >
        <el-icon :size="16">
          <component :is="isInputCollapsed ? 'ArrowUp' : 'ArrowDown'" />
        </el-icon>
        <span class="btn-text">{{ isInputCollapsed ? '展开输入' : '收起输入' }}</span>
      </div>

      <!-- AI卡片网格 -->
      <div
          class="cards-grid"
          :style="gridStyle"
          :class="{ 'cards-grid-expanded': isInputCollapsed }"
      >
        <AICard
            v-for="provider in visibleProviders"
            :key="provider.id"
            :provider="provider"
            :config="getCardConfig(provider.id)"
            class="card-item"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref, watch
} from 'vue'
import { useChatStore, useLayoutStore } from '../stores'
import UnifiedInput from '../components/chat/UnifiedInput.vue'
import AICard from '../components/chat/AICard.vue'

const chatStore = useChatStore()
const layoutStore = useLayoutStore()
const isInputCollapsed = ref(false)

// 处理消息发送事件
const handleMessageSent = () => {
  isInputCollapsed.value = true
}

// 切换输入框收起/展开
const toggleInputCollapse = () => {
  isInputCollapsed.value = !isInputCollapsed.value

  // 当展开输入框时，自动滚动到输入区域
  if (!isInputCollapsed.value) {
    setTimeout(() => {
      const inputSection = document.querySelector('.input-section')
      if (inputSection) {
        inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }
}

// 监听是否有新的消息，如果有则自动展开输入框
watch(
    () => chatStore.currentMessage,
    (newMessage) => {
      if (newMessage && newMessage.trim() && isInputCollapsed.value) {
        // 当用户开始输入时，自动展开输入框
        isInputCollapsed.value = false
      }
    }
)

// 计算属性
const providers = computed(() => chatStore.providers)

const visibleProviders = computed(() => {
  const enabledProviders = providers.value.filter((provider) => {
    const config = getCardConfig(provider.id)
    // 只有当模型被选中且可见时才显示卡片
    return provider.isEnabled && config?.isVisible !== false
  })

  // 使用chatStore的selectedProviders进行排序
  const sortedProviders = [...enabledProviders].sort((a, b) => {
    const aSelected = chatStore.selectedProviders.includes(a.id)
    const bSelected = chatStore.selectedProviders.includes(b.id)

    if (aSelected && !bSelected) {
      return -1
    }
    if (!aSelected && bSelected) {
      return 1
    }

    if (aSelected && bSelected) {
      const aIndex = chatStore.selectedProviders.indexOf(a.id)
      const bIndex = chatStore.selectedProviders.indexOf(b.id)
      return bIndex - aIndex
    }

    return 0
  })

  return sortedProviders
})

const gridStyle = computed(() => {
  const { columns } = layoutStore.gridSettings
  const { gap } = layoutStore.gridSettings

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
    padding: `${gap}px`,
    alignItems: 'start' // 让卡片顶部对齐
  }
})

/**
 * 获取卡片配置
 */
const getCardConfig = (providerId: string) => layoutStore.getCardConfig(providerId)

// 响应式布局处理
const handleResize = () => {
  layoutStore.updateWindowSize(window.innerWidth, window.innerHeight)
}

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 检查是否按下了Ctrl或Cmd键
  const isModifierKey = event.ctrlKey || event.metaKey

  // 检查是否按下了数字键1-9
  if (isModifierKey && event.key >= '1' && event.key <= '9') {
    // 阻止默认行为，避免与浏览器快捷键冲突
    event.preventDefault()

    // 获取数字键对应的索引（从0开始）
    const index = parseInt(event.key, 10) - 1

    // 检查索引是否在可见卡片范围内
    if (index < visibleProviders.value.length) {
      // 获取对应的卡片provider
      const provider = visibleProviders.value[index]

      // 切换卡片最大化状态
      layoutStore.toggleCardMaximized(provider.id)
    }
  }

  // 添加快捷键 Ctrl+Shift+X 来切换输入框收起/展开
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'x') {
    event.preventDefault()
    toggleInputCollapse()
  }
}

// 生命周期
onMounted(() => {
  // 初始化聊天数据
  chatStore.initializeConversations()

  // 立即更新窗口大小，确保初始布局计算正确
  layoutStore.updateWindowSize(window.innerWidth, window.innerHeight)

  // 立即加载布局配置，不要等待
  const initializeLayout = () => {
    console.log('开始初始化布局...')
    const providerIds = providers.value.map((p) => p.id)

    // 先加载保存的布局配置
    layoutStore.loadLayoutConfig()
    console.log('布局配置加载完成，当前网格设置:', layoutStore.gridSettings)

    // 清空现有卡片配置，强制重新初始化所有provider的配置
    console.log('清空现有卡片配置')
    // @ts-ignore - 直接访问cardConfigs以清空它
    layoutStore.cardConfigs = {}

    // 重新初始化所有卡片配置
    console.log('重新初始化所有卡片配置:', providerIds)
    layoutStore.initializeCardConfigs(providerIds)

    // 重新计算布局，确保所有卡片正确显示
    layoutStore.recalculateLayout()
    console.log('布局重新计算完成')
  }

  // 立即执行布局初始化
  initializeLayout()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 移除窗口大小变化监听器
  window.removeEventListener('resize', handleResize)

  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.chat-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.input-section {
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 400px;
  overflow: hidden;
  opacity: 1;
  transform: translateY(0);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.input-section.input-section-collapsed {
  max-height: 0;
  opacity: 0;
  transform: translateY(-20px);
  padding: 0;
  margin: 0;
  box-shadow: none;
}

.toggle-input-btn {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(209, 213, 219, 0.5);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  color: #4B5563;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  user-select: none;
}

.toggle-input-btn:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
  color: #1F2937;
}

.toggle-input-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.btn-text {
  font-weight: 500;
  letter-spacing: 0.3px;
}

.cards-grid {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: calc(100vh - 140px);
  padding: 16px;
  margin: 0 -8px;
}

.cards-grid-expanded {
  max-height: calc(100vh - 40px) !important;
  padding-top: 24px;
}

.card-item {
  width: 100%;
  max-width: 100%;
  min-width: 100%;
  height: 100%;
  grid-column: auto;
  grid-row: auto;
  animation: fadeInUp 0.3s ease-out;
}

/* 自定义滚动条 */
.cards-grid::-webkit-scrollbar {
  width: 8px;
}

.cards-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.cards-grid::-webkit-scrollbar-thumb {
  background: rgba(2, 126, 234, 0.5);
  border-radius: 4px;
  transition: background 0.3s ease;
}

.cards-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(2, 16, 234, 0.8);
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 800px) {
  .cards-grid {
    grid-template-columns: 1fr !important;
    padding: 12px;
  }

  .toggle-input-btn {
    top: 8px;
    right: 12px;
    padding: 6px 10px;
  }

  .btn-text {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .chat-container {
    padding: 4px;
  }

  .cards-grid {
    padding: 8px;
  }

  .toggle-input-btn {
    top: 6px;
    right: 8px;
    padding: 5px 8px;
  }

  .btn-text {
    display: none;
  }
}

/* 卡片动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 平滑过渡效果 */
.chat-container * {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
