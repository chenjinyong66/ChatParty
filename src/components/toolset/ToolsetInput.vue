<template>
  <div class="unified-input">
    <el-card class="input-card">
      <div class="input-header">
        <div class="header-left">
          <!--          <el-icon class="input-icon">-->
          <!--            <EditPen />-->
          <!--          </el-icon>-->
          <!--          <span class="input-title">to</span>-->
        </div>
        <div class="header-right">
          <el-tag
              v-if="hasRespondingAI"
              type="warning"
              size="small"
              class="ai-status-tag"
          >
            {{ respondingAICount }} 个AI回答中
          </el-tag>
        </div>
      </div>

      <!-- 模型选择器 -->
      <div class="model-selector">
        <div class="selector-header">
          <!--          <el-icon class="selector-icon">-->
          <!--            <Select />-->
          <!--          </el-icon>-->
          <!--          <span class="selector-title">选择AI模型</span>-->
        </div>
        <el-checkbox-group
            v-model="selectedProviders"
            class="provider-checkboxes"
            @change="handleProviderSelection"
        >
          <el-checkbox
              v-for="provider in sortedProviders"
              :key="provider.id"
              :label="provider.id"
              :disabled="provider.loadingState === 'loading'"
              class="provider-checkbox"
              draggable="true"
              @dragstart="handleDragStart($event, provider)"
              @dragover="handleDragOver($event)"
              @dragleave="handleDragLeave($event)"
              @drop="handleDrop($event, provider)"
              @dragend="handleDragEnd"
          >
            <div class="provider-option">
              <img
                  :src="provider.icon"
                  :alt="provider.name"
                  class="provider-icon-small"
                  @error="handleIconError"
              >
              <span class="provider-name">{{ provider.name }}</span>
              <!-- AI状态显示 -->
              <el-tag
                  v-if="getProviderAIStatus(provider.id) === 'responding'"
                  type="warning"
                  size="small"
                  class="ai-status-tag"
              >
                回答中
              </el-tag>
              <el-tag
                  v-else-if="provider.isLoggedIn && selectedProviders.includes(provider.id)"
                  type="success"
                  size="small"
                  class="status-tag"
              >
                已登录
              </el-tag>
              <el-icon
                  v-if="provider.loadingState === 'loading'"
                  class="loading-icon"
              >
                <Loading />
              </el-icon>
            </div>
          </el-checkbox>
        </el-checkbox-group>
      </div>
    </el-card>


  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref, nextTick
} from 'vue'
import {
  EditPen, Position, Refresh, Delete, Loading, Plus, Document, Lightning
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useToolsetStore } from '../../stores'
import { messageDispatcher } from '../../services/MessageDispatcher'
import type { MessageSendResult } from '../../services/MessageDispatcher'
import type { AIProvider } from '@/types'

const chatStore = useToolsetStore()

const draggedProvider = ref<AIProvider | null>(null)

const selectedProviders = computed({
  get: () => chatStore.selectedProviders,
  set: (value: string[]) => {
    chatStore.updateSelectedProviders(value)
  }
})

// AI状态管理
const aiStatusMap = ref<{ [providerId: string]: 'waiting_input' | 'responding' | 'completed' }>({})


// 快捷 Prompt 管理
const quickPrompt = ref<string>('')

// 默认 Prompt
const DEFAULT_PROMPT = '请帮我分析以下内容，并提供详细的建议和解决方案。'

// 输入框交互优化相关数据
const textareaRef = ref<any>(null)
const textareaRows = ref<number>(3)
const isExpanded = ref<boolean>(false)
const isResizing = ref<boolean>(false)
const minRows = ref<number>(3)
const maxRows = ref<number>(15)
const preferredHeight = ref<number | null>(null)
const resizeStartY = ref<number>(0)
const resizeStartHeight = ref<number>(0)

// 计算属性
const currentMessage = computed({
  get: () => chatStore.currentMessage,
  set: (value: string) => {
    chatStore.currentMessage = value
    // 自动调整高度
    nextTick(() => {
      autoResize()
    })
  }
})

const availableProviders = computed(() => chatStore.providers)

const sortedProviders = computed(() => {
  const providers = [...availableProviders.value]
  return providers.sort((a, b) => {
    const aSelected = selectedProviders.value.includes(a.id)
    const bSelected = selectedProviders.value.includes(b.id)

    if (aSelected && !bSelected) {
      return -1
    }
    if (!aSelected && bSelected) {
      return 1
    }

    if (aSelected && bSelected) {
      const aIndex = selectedProviders.value.indexOf(a.id)
      const bIndex = selectedProviders.value.indexOf(b.id)
      return bIndex - aIndex
    }

    return 0
  })
})

// 应用选中的提供商到聊天存储
const applySelectedProviders = (): void => {
  chatStore.providers.forEach((provider) => {
    const shouldEnable = selectedProviders.value.includes(provider.id)
    if (provider.isEnabled !== shouldEnable) {
      chatStore.toggleProvider(provider.id, shouldEnable)
    }
  })
}

// 处理提供商选择变化
const handleProviderSelection = (value: string[]): void => {
  availableProviders.value.forEach((item: AIProvider) => {
    if (!value.includes(item.id)) {
      item.isLoggedIn = false
    }
  })
  applySelectedProviders()
}

const handleDragStart = (event: DragEvent, provider: AIProvider): void => {
  draggedProvider.value = provider
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
  const target = event.target as HTMLElement
  const checkbox = target.closest('.provider-checkbox')
  if (checkbox) {
    checkbox.classList.add('dragging')
  }
}

const handleDragOver = (event: DragEvent): void => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  const target = event.target as HTMLElement
  const checkbox = target.closest('.provider-checkbox')
  if (checkbox && !checkbox.classList.contains('dragging')) {
    checkbox.classList.add('drag-over')
  }
}

const handleDragLeave = (event: DragEvent): void => {
  const target = event.target as HTMLElement
  const checkbox = target.closest('.provider-checkbox')
  if (checkbox) {
    checkbox.classList.remove('drag-over')
  }
}

const handleDragEnd = (): void => {
  const draggingCheckboxes = document.querySelectorAll('.provider-checkbox.dragging')
  draggingCheckboxes.forEach((el) => el.classList.remove('dragging'))
  const dragOverCheckboxes = document.querySelectorAll('.provider-checkbox.drag-over')
  dragOverCheckboxes.forEach((el) => el.classList.remove('drag-over'))
}

const handleDrop = (event: DragEvent, targetProvider: AIProvider): void => {
  event.preventDefault()

  const target = event.target as HTMLElement
  const checkbox = target.closest('.provider-checkbox')
  if (checkbox) {
    checkbox.classList.remove('drag-over')
  }

  if (!draggedProvider.value || draggedProvider.value.id === targetProvider.id) {
    draggedProvider.value = null
    return
  }

  const draggedIndex = selectedProviders.value.indexOf(draggedProvider.value.id)
  const targetIndex = selectedProviders.value.indexOf(targetProvider.id)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    const newSelectedProviders = [...selectedProviders.value]
    newSelectedProviders.splice(draggedIndex, 1)
    newSelectedProviders.splice(targetIndex, 0, draggedProvider.value.id)
    selectedProviders.value = newSelectedProviders
  }

  draggedProvider.value = null
}

// 处理图标加载错误
const handleIconError = (event: Event): void => {
  const img = event.target as HTMLImageElement
  img.src = '/icons/default.svg'
}

// AI状态相关方法
const getProviderAIStatus = (providerId: string): 'waiting_input' | 'responding' | 'completed' | undefined => aiStatusMap.value[providerId]

const updateAIStatus = (providerId: string, status: 'waiting_input' | 'responding' | 'completed'): void => {
  aiStatusMap.value[providerId] = status
}

const stopAIStatusMonitoring = async(): Promise<void> => {
  try {
    if (window.electronAPI) {
      const { loggedInProviders } = chatStore

      for (const provider of loggedInProviders) {
        const result = await window.electronAPI.stopAIStatusMonitoring({
          providerId: provider.id
        })

        if (result.success) {
          console.log(`AI状态监控已停止: ${provider.name}`)
        }
      }
    }
  } catch (error) {
    console.error('停止AI状态监控失败:', error)
  }
}

// 处理AI状态变化事件
const handleAIStatusChange = (data: any) => {
  const {
    providerId, status, timestamp, details
  } = data

  console.log(`AI状态变化: ${providerId} -> ${status}`, details)

  // 更新状态映射
  updateAIStatus(providerId, status)

  // 根据状态变化进行相应处理
  if (status === 'responding') {
    // AI开始回答，可以在这里添加相关逻辑
    console.log(`${providerId} 开始回答`)
  } else if (status === 'completed') {
    // AI回答完成，可以在这里添加相关逻辑
    console.log(`${providerId} 回答完成`)
  } else if (status === 'waiting_input') {
    // AI等待输入，可以在这里添加相关逻辑
    console.log(`${providerId} 等待输入`)
  }
}

const loggedInCount = computed(() => chatStore.loggedInCount)
const totalProviders = computed(() => chatStore.totalProviders)

// AI状态相关计算属性
const hasRespondingAI = computed(() => Object.values(aiStatusMap.value).some((status) => status === 'responding'))

const respondingAICount = computed(() => Object.values(aiStatusMap.value).filter((status) => status === 'responding').length)

/**
 * 自动调整输入框高度
 */
const autoResize = (): void => {
  if (!textareaRef.value || isResizing.value || isExpanded.value) return

  const textarea = textareaRef.value.$el.querySelector('.el-textarea__inner') as HTMLTextAreaElement
  if (!textarea) return

  // 重置高度以获取正确的滚动高度
  textarea.style.height = 'auto'

  // 计算所需行数
  const computedStyle = getComputedStyle(textarea)
  const lineHeight = parseFloat(computedStyle.lineHeight)
  const { scrollHeight } = textarea
  const padding = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom)
  const contentHeight = scrollHeight - padding
  const rows = Math.ceil(contentHeight / lineHeight)

  // 限制行数在最小和最大之间
  textareaRows.value = Math.max(minRows.value, Math.min(maxRows.value, rows))
}

/**
 * 调整大小
 */
const resize = (event: MouseEvent | TouchEvent): void => {
  if (!isResizing.value) return

  // 获取当前位置
  let currentY: number
  if (event instanceof MouseEvent) {
    currentY = event.clientY
  } else {
    currentY = event.touches[0].clientY
  }

  // 计算高度变化
  const deltaY = currentY - resizeStartY.value
  const textareaInner = textareaRef.value.$el.querySelector('.el-textarea__inner') as HTMLElement
  const lineHeight = parseFloat(getComputedStyle(textareaInner).lineHeight)
  const deltaRows = Math.round(deltaY / lineHeight)

  // 更新行数
  textareaRows.value = Math.max(minRows.value, Math.min(maxRows.value, textareaRows.value + deltaRows))

  // 更新起始位置和高度
  resizeStartY.value = currentY
  const textarea = textareaRef.value.$el.querySelector('.el-textarea') as HTMLElement
  if (textarea) {
    resizeStartHeight.value = textarea.offsetHeight
  }
}

/**
 * 停止调整大小
 */
const stopResize = (): void => {
  isResizing.value = false

  // 移除事件监听器
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('touchmove', resize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchend', stopResize)

  // 保存用户偏好的高度
  savePreferredHeight()
}

/**
 * 保存用户偏好的高度
 */
const savePreferredHeight = (): void => {
  if (textareaRef.value) {
    const textarea = textareaRef.value.$el.querySelector('.el-textarea') as HTMLElement
    if (textarea) {
      preferredHeight.value = textarea.offsetHeight
      localStorage.setItem('textarea-preferred-height', JSON.stringify({
        height: preferredHeight.value,
        isExpanded: isExpanded.value
      }))
    }
  }
}

/**
 * 加载用户偏好的高度
 */
const loadPreferredHeight = (): void => {
  try {
    const stored = localStorage.getItem('textarea-preferred-height')
    if (stored) {
      const { height, isExpanded: expanded } = JSON.parse(stored)
      preferredHeight.value = height
      isExpanded.value = expanded

      if (expanded) {
        textareaRows.value = maxRows.value
      } else if (height) {
        // 根据高度计算行数
        const textareaInner = textareaRef.value.$el.querySelector('.el-textarea__inner') as HTMLElement
        const computedStyle = getComputedStyle(textareaInner)
        const lineHeight = parseFloat(computedStyle.lineHeight)
        const padding = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom)
        const contentHeight = height - padding
        textareaRows.value = Math.max(
            minRows.value,
            Math.min(maxRows.value, Math.round(contentHeight / lineHeight))
        )
      }
    }
  } catch (error) {
    console.error('加载用户偏好的高度失败:', error)
  }
}

/**
 * 保存快捷 Prompt
 */
const saveQuickPrompt = (): void => {
  try {
    localStorage.setItem('quick-prompt', JSON.stringify({
      content: quickPrompt.value
    }))
  } catch (error) {
    console.error('保存快捷 Prompt 失败:', error)
  }
}

/**
 * 加载快捷 Prompt
 */
const loadQuickPrompt = (): void => {
  try {
    const stored = localStorage.getItem('quick-prompt')
    if (stored) {
      const { content } = JSON.parse(stored)
      quickPrompt.value = content
    } else {
      // 如果没有保存的快捷 Prompt，使用默认值
      quickPrompt.value = DEFAULT_PROMPT
      saveQuickPrompt()
    }
  } catch (error) {
    console.error('加载快捷 Prompt 失败:', error)
    quickPrompt.value = DEFAULT_PROMPT
  }
}

// 添加 emits 定义
const emit = defineEmits(['message-sent'])

/**
 * 收起输入框
 */
const collapseInput = (): void => {
  // 收起输入框到最小状态
  isExpanded.value = false
  textareaRows.value = minRows.value

  // 停止任何调整大小的操作
  if (isResizing.value) {
    stopResize()
  }

  // 保存当前状态
  savePreferredHeight()
}

/**
 * 处理消息分发器状态变化
 */
const handleStatusChanged = (data: { providerId: string; status: string; messageId: string; error?: any }) => {
  // 更新聊天存储中的发送状态
  chatStore.setSendingStatus(data.providerId, data.status as any)
}

/**
 * 处理消息发送完成
 */
const handleMessageSent = (data: { messageId: string; results: MessageSendResult[] }) => {
  console.log('Message sent:', data)
}

let unsubscribeAIStatusChange: (() => void) | null = null

/**
 * 组件挂载时设置事件监听
 */
onMounted(() => {
  messageDispatcher.on('status-changed', handleStatusChanged)
  messageDispatcher.on('message-sent', handleMessageSent)

  // 监听AI状态变化事件
  if (window.electronAPI && window.electronAPI.onAIStatusChange) {
    unsubscribeAIStatusChange = window.electronAPI.onAIStatusChange(handleAIStatusChange)
  }

  // 监听登录状态变化事件
  window.addEventListener('login-status-changed', handleLoginStatusChanged)

  // 组件挂载后，加载用户偏好的高度
  nextTick(() => {
    loadPreferredHeight()
  })

  // 加载快捷 Prompt
  loadQuickPrompt()

  // 初始检查：为当前已登录的提供商启动AI状态监控
  startAIStatusMonitoringForLoggedInProviders()
})

/**
 * 处理登录状态变化事件
 */
const handleLoginStatusChanged = (event: CustomEvent) => {
  const { providerId, isLoggedIn } = event.detail
  console.log(`登录状态变化: ${providerId} -> ${isLoggedIn ? '已登录' : '未登录'}`)

  if (isLoggedIn) {
    // 用户从未登录状态变为登录状态，启动AI状态监控
    startAIStatusMonitoringForProvider(providerId)
  } else {
    // 用户从登录状态变为未登录状态，停止AI状态监控
    stopAIStatusMonitoringForProvider(providerId)
  }
}

/**
 * 为当前已登录的提供商启动AI状态监控
 */
const startAIStatusMonitoringForLoggedInProviders = async(): Promise<void> => {
  const { loggedInProviders } = chatStore

  if (loggedInProviders.length === 0) {
    console.log('没有已登录的提供商，跳过AI状态监控启动')
    return
  }

  console.log(`为${loggedInProviders.length}个已登录提供商启动AI状态监控`)

  for (const provider of loggedInProviders) {
    await startAIStatusMonitoringForProvider(provider.id)
  }
}

/**
 * 为单个提供商启动AI状态监控
 */
const startAIStatusMonitoringForProvider = async(providerId: string): Promise<void> => {
  try {
    if (!window.electronAPI) {
      console.warn('electronAPI不可用，无法启动AI状态监控')
      return
    }

    const provider = chatStore.providers.find((p) => p.id === providerId)
    if (!provider) {
      console.warn(`提供商不存在: ${providerId}`)
      return
    }

    const webviewId = `webview-${providerId}`
    console.log(`启动AI状态监控: ${provider.name} (webviewId: ${webviewId})`)

    // 延迟启动，确保webview和登录检测脚本已完全加载
    setTimeout(async() => {
      try {
        const result = await window.electronAPI.startAIStatusMonitoring({
          webviewId,
          providerId
        })

        if (result.success) {
          console.log(`AI状态监控已启动: ${provider.name}`)
        } else {
          console.warn(`AI状态监控启动失败: ${provider.name}`, result.error)

          // 启动失败时重试
          setTimeout(() => {
            startAIStatusMonitoringForProvider(providerId)
          }, 2000)
        }
      } catch (error) {
        console.error(`启动AI状态监控时发生错误: ${provider.name}`, error)

        // 发生错误时重试
        setTimeout(() => {
          startAIStatusMonitoringForProvider(providerId)
        }, 2000)
      }
    }, 1000) // 延迟1秒，确保登录检测脚本已执行
  } catch (error) {
    console.error(`启动AI状态监控失败: ${providerId}`, error)
  }
}

/**
 * 为单个提供商停止AI状态监控
 */
const stopAIStatusMonitoringForProvider = async(providerId: string): Promise<void> => {
  try {
    if (!window.electronAPI) {
      console.warn('electronAPI不可用，无法停止AI状态监控')
      return
    }

    const provider = chatStore.providers.find((p) => p.id === providerId)
    if (!provider) {
      console.warn(`提供商不存在: ${providerId}`)
      return
    }

    console.log(`停止AI状态监控: ${provider.name}`)

    const result = await window.electronAPI.stopAIStatusMonitoring({
      providerId
    })

    if (result.success) {
      console.log(`AI状态监控已停止: ${provider.name}`)
    } else {
      console.warn(`AI状态监控停止失败: ${provider.name}`, result.error)
    }
  } catch (error) {
    console.error(`停止AI状态监控失败: ${providerId}`, error)
  }
}

/**
 * 组件卸载时清理事件监听
 */
onUnmounted(() => {
  messageDispatcher.off('status-changed', handleStatusChanged)
  messageDispatcher.off('message-sent', handleMessageSent)

  // 保存用户偏好的高度
  savePreferredHeight()

  // 移除AI状态变化事件监听
  if (unsubscribeAIStatusChange) {
    unsubscribeAIStatusChange()
  }

  // 停止AI状态监控
  stopAIStatusMonitoring()
})
</script>

<style scoped>
.unified-input {
  width: 100%;
}

.input-card {
  box-shadow: var(--el-box-shadow-light);
}

.input-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-icon {
  color: var(--el-color-primary);
  font-size: 18px;
}

.input-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 模型选择器样式 */
.model-selector {
  margin-bottom: 1px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.selector-icon {
  color: #007aff;
  font-size: 16px;
}

.selector-title {
  font-weight: 600;
  color: #1c1c1e;
  font-size: 14px;
}

.provider-checkboxes {
  display: flex;
  flex-wrap: wrap;
  column-gap: 5px;
  row-gap: 3px;
  align-items: start;
}

.provider-checkbox {
  margin: 0;
  min-height: 60px;
  flex: 0 1 auto;
  min-width: 0;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #ffffff;
  border: 2px solid #e5e5ea;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  min-width: 140px;
  max-width: 240px;
  box-sizing: border-box;
}

.drag-handle {
  cursor: grab;
  color: #999;
  font-size: 16px;
  transition: color 0.2s;
  flex-shrink: 0;
}

.drag-handle:hover {
  color: #666;
}

.drag-handle:active {
  cursor: grabbing;
}

.provider-checkbox[draggable="true"] .drag-handle {
  cursor: grab;
}

.provider-checkbox[draggable="true"]:active .drag-handle {
  cursor: grabbing;
}

.provider-checkbox.dragging {
  opacity: 0.5;
}

.provider-checkbox.drag-over {
  border: 2px dashed #4a90e2;
  background: rgba(74, 144, 226, 0.1);
}

/* iOS风格复选框样式 */
:deep(.provider-checkbox .el-checkbox__input) {
  display: none;
}

:deep(.provider-checkbox .el-checkbox__label) {
  padding: 0;
  margin: 0;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #ffffff;
  border: 2px solid #e5e5ea;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
}

/* iOS风格选中状态 */
:deep(.provider-checkbox.is-checked .provider-option) {
  background: linear-gradient(135deg, #4a90e2 0%, #7b68ee 100%);
  border-color: #4a90e2;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
}

/* iOS风格悬停效果 */
.provider-option:hover {
  border-color: #007aff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
}

/* iOS风格选中状态下的图标和文字 */
:deep(.provider-checkbox.is-checked .provider-option .provider-icon-small) {
  /* 移除图标变白效果，保持原色 */
}

:deep(.provider-checkbox.is-checked .provider-option .provider-name) {
  color: white;
}

:deep(.provider-checkbox.is-checked .provider-option .status-tag) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.provider-icon-small {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: contain;
}

.provider-name {
  font-weight: 500;
  color: #1c1c1e;
  font-size: 14px;
  flex: 1;
}

.status-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.ai-status-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #f59e0b;
  border-color: #f59e0b;
  color: white;
}

.header-right .ai-status-tag {
  margin-left: 8px;
}

.loading-icon {
  color: #8e8e93;
  animation: rotate 1s linear infinite;
}

:deep(.provider-checkbox.is-checked .provider-option .loading-icon) {
  color: rgba(255, 255, 255, 0.8);
}

/* 禁用状态样式 */
:deep(.provider-checkbox.is-disabled .provider-option) {
  opacity: 0.5;
  cursor: not-allowed;
}

:deep(.provider-checkbox.is-disabled .provider-option:hover) {
  transform: none;
  border-color: #e5e5ea;
  box-shadow: none;
}

/* 响应式布局优化 */
@media (max-width: 1200px) {
  .provider-option {
    min-width: 130px;
    max-width: 200px;
  }
}

@media (max-width: 768px) {
  .provider-checkboxes {
    gap: 6px;
  }

  .provider-option {
    min-width: 120px;
    max-width: 180px;
    padding: 10px 12px;
    gap: 8px;
  }

  .provider-icon-small {
    width: 20px;
    height: 20px;
  }

  .provider-name {
    font-size: 12px;
  }

  .status-tag {
    font-size: 10px;
    padding: 1px 4px;
  }
}

@media (max-width: 480px) {
  .provider-checkboxes {
    gap: 4px;
  }

  .provider-option {
    min-width: 110px;
    max-width: 160px;
    padding: 8px 10px;
    gap: 6px;
  }

  .provider-name {
    font-size: 11px;
  }
}

.input-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 输入框容器样式 */
.textarea-container {
  position: relative;
  width: 100%;
  transition: all 0.3s ease;
}

.message-input {
  width: 100%;
  transition: all 0.3s ease;
}

/* 调整大小手柄样式 */
.textarea-resize-handle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 16px;
  height: 16px;
  cursor: ns-resize;
  background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23909399' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.5;
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 10;
  user-select: none;
}

.textarea-resize-handle:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* 展开按钮样式 */
.textarea-expand-button {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.3s ease;
  z-index: 10;
  user-select: none;
  font-size: 14px;
  color: #606266;
}

.textarea-expand-button:hover {
  opacity: 1;
  background-color: #ffffff;
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.textarea-expand-button:active {
  transform: scale(0.95);
}

/* 输入框操作区域样式 */
.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}

.actions-left,
.actions-right {
  display: flex;
  gap: 8px;
}

/* 输入框样式优化 */
:deep(.el-textarea) {
  position: relative;
  transition: all 0.3s ease;
}

:deep(.el-textarea__inner) {
  resize: none;
  min-height: 80px;
  height: auto !important;
  min-height: 80px !important;
  line-height: 1.6;
  font-size: 14px;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
  box-sizing: border-box;
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(48, 165, 255, 0.2);
}

/* 展开状态样式 */
.textarea-container.expanded :deep(.el-textarea__inner) {
  min-height: 400px;
  max-height: 60vh;
}

/* 调整大小状态样式 */
.textarea-container.resizing :deep(.el-textarea__inner) {
  cursor: ns-resize;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .textarea-container {
    width: 100%;
  }

  .textarea-expand-button {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .textarea-resize-handle {
    width: 14px;
    height: 14px;
  }

  :deep(.el-textarea__inner) {
    font-size: 13px;
    line-height: 1.5;
  }
}

@media (max-width: 480px) {
  .textarea-container {
    width: 100%;
  }

  .input-actions {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .actions-left,
  .actions-right {
    justify-content: center;
  }
}

/* 动画过渡效果 */
:deep(.el-textarea) {
  transition: height 0.3s ease, min-height 0.3s ease, max-height 0.3s ease;
}

:deep(.el-textarea__inner) {
  transition:
      height 0.3s ease,
      min-height 0.3s ease,
      max-height 0.3s ease,
      border-color 0.3s ease,
      box-shadow 0.3s ease;
}

/* 滚动条样式优化 */
:deep(.el-textarea__inner::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.el-textarea__inner::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 3px;
}

:deep(.el-textarea__inner::-webkit-scrollbar-thumb) {
  background: #c1c1c1;
  border-radius: 3px;
  transition: background 0.3s ease;
}

:deep(.el-textarea__inner::-webkit-scrollbar-thumb:hover) {
  background: #a8a8a8;
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .textarea-resize-handle {
    width: 24px;
    height: 24px;
    opacity: 0.8;
  }

  .textarea-expand-button {
    width: 32px;
    height: 32px;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .provider-checkboxes {
    justify-content: center;
  }

  .model-selector {
    padding: 12px;
  }

  .provider-option {
    padding: 10px 12px;
  }
}

/* 在原有的CSS基础上添加以下样式 */

.unified-input {
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-card {
  box-shadow: var(--el-box-shadow-light);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(209, 213, 219, 0.3);
}

/* 模型选择器样式增强 */
.model-selector {
  margin-bottom: 8px;
  padding: 6px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 优化输入框容器动画 */
.textarea-container {
  position: relative;
  width: 100%;
  transition: all 0.3s ease;
}

/* 响应式设计优化 */
@media (max-width: 768px) {
  .input-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .input-actions {
    flex-direction: column;
    gap: 12px;
  }

  .actions-left,
  .actions-right {
    width: 100%;
    justify-content: center;
  }
}

/* 优化动画效果 */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(102, 126, 234, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
  }
}

/* 添加发送时的动画效果 */
.has-sending .el-button--primary {
  animation: pulse 1.5s infinite;
}
</style>
