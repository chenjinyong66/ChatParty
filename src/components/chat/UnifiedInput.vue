<template>
  <div class="unified-input" :class="{ collapsed: isCollapsed }">
    <!-- 收起时显示的悬浮展开按钮 -->
    <transition name="fade">
      <div v-if="isCollapsed" class="floating-expand-btn" title="展开输入框" @click="toggleCollapse">
        <el-icon :size="16">
          <ArrowDown />
        </el-icon>
        <span class="expand-label">展开输入框</span>
      </div>
    </transition>

    <el-card v-show="!isCollapsed" class="input-card">
      <div class="input-body">
        <!-- 智能体和Skill选择区 -->
        <div class="agent-skill-row">
          <div class="agent-group">
            <AgentSelector />
            <SkillBar />
          </div>
          <div class="prompt-group">
            <el-button type="info" :icon="Document" size="small" :disabled="loggedInCount === 0" class="prompt-btn"
              data-testid="prompt-manager-button" @click="handleOpenPromptManager">
              Prompt
            </el-button>
            <el-button type="warning" :icon="Lightning" size="small" :disabled="loggedInCount === 0 || !quickPrompt"
              :title="quickPrompt || '暂无快捷 Prompt'" class="prompt-btn" data-testid="quick-prompt-button"
              @click="handleApplyQuickPrompt">
              快捷
            </el-button>
          </div>
          <div class="header-actions">
            <el-tag v-if="hasRespondingAI" type="warning" size="small" class="ai-status-tag">
              {{ respondingAICount }} 个AI回答中
            </el-tag>
            <el-button :icon="ArrowUp" size="small" class="collapse-btn" title="收起输入框" @click="toggleCollapse">
              收起
            </el-button>
          </div>
        </div>

        <!-- 模型选择器 -->
        <div class="model-selector">

          <el-checkbox-group v-model="selectedProviders" class="provider-checkboxes" @change="handleProviderSelection">
            <el-checkbox v-for="provider in sortedProviders" :key="provider.id" :label="provider.id"
              :disabled="provider.loadingState === 'loading'" class="provider-checkbox" draggable="true"
              @dragstart="handleDragStart($event, provider)" @dragover="handleDragOver($event)"
              @dragleave="handleDragLeave($event)" @drop="handleDrop($event, provider)" @dragend="handleDragEnd">
              <div class="provider-option">
                <img :src="provider.icon" :alt="provider.name" class="provider-icon-small" @error="handleIconError">
                <span class="provider-name">{{ provider.name }}</span>
                <el-tag v-if="getProviderAIStatus(provider.id) === 'responding'" type="warning" size="small"
                  class="ai-status-tag">
                  回答中
                </el-tag>
                <el-tag v-else-if="provider.isLoggedIn && selectedProviders.includes(provider.id)" type="success"
                  size="small" class="status-tag">
                  已选
                </el-tag>
                <el-icon v-if="provider.loadingState === 'loading'" class="loading-icon">
                  <Loading />
                </el-icon>
                <span v-if="provider.isCustom" class="custom-remove" title="移除自定义网站"
                  @click.stop.prevent="handleRemoveCustomProvider(provider.id)">
                  <el-icon :size="12">
                    <Close />
                  </el-icon>
                </span>
              </div>
            </el-checkbox>
            <div class="add-provider-btn" @click="showAddProviderDialog">
              <el-icon :size="14">
                <Plus />
              </el-icon>
              <span>添加网站</span>
            </div>
          </el-checkbox-group>

          <el-dialog v-model="addProviderDialogVisible" title="添加自定义网站" width="400px" destroy-on-close append-to-body>
            <el-form :model="addProviderForm" label-width="60px">
              <el-form-item label="名称" required>
                <el-input v-model="addProviderForm.name" placeholder="如：MyGPT" />
              </el-form-item>
              <el-form-item label="网址" required>
                <el-input v-model="addProviderForm.url" placeholder="https://example.com" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="addProviderDialogVisible = false">取消</el-button>
              <el-button type="primary" @click="handleAddProvider">添加</el-button>
            </template>
          </el-dialog>
        </div>

        <div class="input-content">
          <div class="textarea-container">
            <el-input ref="textareaRef" v-model="currentMessage" type="textarea" :rows="textareaRows"
              :placeholder="inputPlaceholder" :disabled="loggedInCount === 0" class="message-input"
              data-testid="message-input" @keydown.ctrl.enter="handleSend" @keydown.meta.enter="handleSend"
              @input="handleInput" @focus="handleFocus" @blur="handleBlur" />
            <div class="textarea-resize-handle" title="拖拽调整大小" @mousedown="startResize" @touchstart="startResize" />
            <div class="textarea-expand-button" :title="isExpanded ? '收起输入框' : '全屏输入'" @click="toggleExpand">
              <el-icon>{{ isExpanded ? 'Minus' : 'Plus' }}</el-icon>
            </div>
          </div>

          <div v-if="attachedFiles.length > 0" class="attached-files">
            <el-tag v-for="(file, index) in attachedFiles" :key="index" closable size="small"
              :type="file.isText ? 'info' : 'warning'" @close="removeFile(index)">
              {{ file.name }} ({{ formatFileSize(file.size) }})
            </el-tag>
          </div>

          <div class="input-actions">
            <div class="actions-left">
              <div class="action-group action-group-util">
                <el-button :icon="Refresh" size="small" :disabled="hasSendingMessages" data-testid="refresh-button"
                  @click="handleRefresh">
                  刷新连接
                </el-button>
                <el-button :icon="UploadFilled" size="small" :disabled="loggedInCount === 0 || hasSendingMessages"
                  title="发送文件到已登录的AI" @click="triggerFileSelect">
                  发送文件
                </el-button>
                <input ref="fileInputRef" type="file" multiple style="display:none" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.svg"
                  @change="handleFileInputChange">
                <el-button :icon="Delete" size="small" :disabled="!currentMessage" data-testid="clear-button"
                  @click="handleClear">
                  清空
                </el-button>
              </div>
              <div class="action-group action-group-analysis">
                <el-button :type="discussionStore.isRunning ? 'danger' : 'success'" size="small"
                  @click="handleDiscussionToggle">
                  <el-icon :size="14">
                    <ChatLineRound />
                  </el-icon>
                  {{ discussionStore.isRunning ? '讨论中...' : '多模型讨论' }}
                </el-button>
                <el-button type="info" :icon="DocumentChecked" :disabled="!canSummarize" size="small" title="总结各AI的回答"
                  data-testid="summary-button" @click="handleSummary">
                  总结
                </el-button>
                <el-button type="success" :icon="ScaleToOriginal" :disabled="loggedInCount < 2" size="small"
                  title="对比各AI的回答" @click="handleComparison">
                  对比
                </el-button>
              </div>
            </div>

            <div class="actions-right">
              <el-button type="success" :icon="Plus" :disabled="loggedInCount === 0" size="small"
                data-testid="new-chat-button" @click="handleNewChat">
                新建对话
              </el-button>
              <el-button type="primary" :icon="Position" :loading="hasSendingMessages" size="small"
                :disabled="!currentMessage || loggedInCount === 0 || hasRespondingAI" data-testid="send-button"
                @click="handleSend">
                发送到所有AI (Ctrl+Enter)
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <PromptManager v-model="promptManagerVisible" :user-input="currentMessage" @apply-prompt="handleApplyPrompt" />
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref, nextTick
} from 'vue'
import {
  EditPen, Position, Refresh, Delete, Select, Loading, Plus, Minus, Document, Rank, Lightning, DocumentChecked, ArrowUp, ArrowDown, ChatLineRound, ScaleToOriginal, SetUp, UploadFilled, Close
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useChatStore } from '../../stores'
import { useAgentStore } from '../../stores/agent'
import AgentSelector from './AgentSelector.vue'
import SkillBar from './SkillBar.vue'
import { useDiscussionStore } from '../../stores/discussion'
import { discussionService } from '../../services/DiscussionService'
import { messageDispatcher } from '../../services/MessageDispatcher'
import type { MessageSendResult } from '../../services/MessageDispatcher'
import type { AIProvider } from '@/types'
import PromptManager from './PromptManager.vue'

const chatStore = useChatStore()

// 组件事件
const emit = defineEmits<{
  (e: 'summary'): void
  (e: 'open-discussion'): void
  (e: 'open-comparison'): void
}>()

const draggedProvider = ref<AIProvider | null>(null)

const selectedProviders = computed({
  get: () => chatStore.selectedProviders,
  set: (value: string[]) => {
    chatStore.updateSelectedProviders(value)
  }
})

// AI状态管理
const aiStatusMap = ref<{ [providerId: string]: 'waiting_input' | 'responding' | 'completed' }>({})

// Prompt 管理器
const promptManagerVisible = ref<boolean>(false)

// 快捷 Prompt 管理
const quickPrompt = ref<string>('')

// 折叠状态管理
const isCollapsed = ref<boolean>(false)

// 讨论面板状态
const discussionStore = useDiscussionStore()

/**
 * 切换讨论面板 - 打开侧边栏讨论Tab
 */
const handleDiscussionToggle = () => {
  if (discussionStore.isRunning) {
    discussionService.stopDiscussion()
    return
  }
  emit('open-discussion')
}

/**
 * 加载折叠状态
 */
const loadCollapsedState = (): void => {
  try {
    const stored = localStorage.getItem('unified-input-collapsed')
    if (stored !== null) {
      isCollapsed.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('加载折叠状态失败:', error)
  }
}

/**
 * 保存折叠状态
 */
const saveCollapsedState = (): void => {
  try {
    localStorage.setItem('unified-input-collapsed', JSON.stringify(isCollapsed.value))
  } catch (error) {
    console.error('保存折叠状态失败:', error)
  }
}

/**
 * 切换折叠状态
 */
const toggleCollapse = (): void => {
  isCollapsed.value = !isCollapsed.value
  saveCollapsedState()
}

// 默认 Prompt
const DEFAULT_PROMPT = '请帮我分析以下内容，并提供详细的建议和解决方案。'

// 输入框交互优化相关数据
const textareaRef = ref<any>(null)
const textareaRows = ref<number>(3)
const isExpanded = ref<boolean>(false)
const isResizing = ref<boolean>(false)
const minRows = ref<number>(3)
const maxRows = ref<number>(8)
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

const stopAIStatusMonitoring = async (): Promise<void> => {
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

// 已选中且已登录的提供商数量
const connectedProviders = computed(() => availableProviders.value.filter((provider) => provider.isLoggedIn && selectedProviders.value.includes(provider.id)))

const connectedCount = computed(() => connectedProviders.value.length)

const hasSendingMessages = computed(() => messageDispatcher.hasSendingMessages())

// AI状态相关计算属性
const hasRespondingAI = computed(() => Object.values(aiStatusMap.value).some((status) => status === 'responding'))

const respondingAICount = computed(() => Object.values(aiStatusMap.value).filter((status) => status === 'responding').length)

// 是否有AI已完成回答（用于判断是否可以总结）
const hasCompletedAI = computed(() => Object.values(aiStatusMap.value).some((status) => status === 'completed'))

// 是否可以进行总结
const canSummarize = computed(() =>
  // 至少有一个AI已完成回答，且没有AI正在回答中
  hasCompletedAI.value && !hasRespondingAI.value && loggedInCount.value > 0)

const inputPlaceholder = computed(() => {
  if (loggedInCount.value === 0) {
    return '请先登录至少一个AI网站...'
  }
  if (hasRespondingAI.value) {
    return 'AI正在回答中，请等待回答完成后再发送新消息...'
  }
  return '输入您的消息，将同时发送给所有已登录的AI...'
})

// 输入框交互优化相关方法

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
 * 处理输入事件
 */
const handleInput = (): void => {
  autoResize()
}

/**
 * 处理聚焦事件
 */
const handleFocus = (): void => {
  // 聚焦时可以添加一些视觉反馈
}

/**
 * 处理失焦事件
 */
const handleBlur = (): void => {
  // 失焦时保存用户偏好的高度
  savePreferredHeight()
}

/**
 * 开始调整大小
 */
const startResize = (event: MouseEvent | TouchEvent): void => {
  if (isExpanded.value) return

  isResizing.value = true

  // 获取起始位置
  if (event instanceof MouseEvent) {
    resizeStartY.value = event.clientY
  } else {
    resizeStartY.value = event.touches[0].clientY
  }

  // 获取起始高度
  const textarea = textareaRef.value.$el.querySelector('.el-textarea') as HTMLElement
  if (textarea) {
    resizeStartHeight.value = textarea.offsetHeight
  }

  // 添加事件监听器
  document.addEventListener('mousemove', resize)
  document.addEventListener('touchmove', resize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchend', stopResize)

  // 防止默认行为
  event.preventDefault()
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
 * 切换全屏状态
 */
const toggleExpand = (): void => {
  isExpanded.value = !isExpanded.value

  if (isExpanded.value) {
    // 全屏状态
    textareaRows.value = maxRows.value
  } else {
    // 回到最小行数
    textareaRows.value = minRows.value
  }

  // 保存用户偏好
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

/**
 * 发送消息
 */
const handleSend = async (): Promise<void> => {
  if (loggedInCount.value === 0) {
    ElMessage.warning('请先登录至少一个AI网站')
    return
  }

  if (!currentMessage.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }

  try {
    if (!isCollapsed.value) {
      isCollapsed.value = true
    }

    const { loggedInProviders } = chatStore

    if (attachedFiles.value.length > 0) {
      appendFileContentToMessage()
      sendBinaryFilesToWebViews()
    }

    const messageContent = currentMessage.value

    chatStore.clearCurrentMessage()
    attachedFiles.value = []

    // 使用消息分发器发送消息
    const results = await messageDispatcher.sendMessage(messageContent, loggedInProviders)

    // 处理发送结果
    const successCount = results.filter((result) => result.success).length
    const errorCount = results.length - successCount

    // 将消息添加到对话历史
    results.forEach((result) => {
      const message = {
        id: result.messageId,
        content: messageContent,
        timestamp: result.timestamp,
        sender: 'user' as const,
        providerId: result.providerId,
        status: result.success ? ('sent' as const) : ('error' as const),
        errorMessage: result.error
      }
      chatStore.addMessage(result.providerId, message)
    })

    // 显示结果消息
    if (successCount > 0 && errorCount === 0) {
      ElMessage.success(`消息已成功发送到 ${successCount} 个AI`)
    } else if (successCount > 0 && errorCount > 0) {
      ElMessage.warning(`消息已发送到 ${successCount} 个AI，${errorCount} 个发送失败`)
    } else {
      ElMessage.error('所有消息发送失败')
    }

    // P3: 自动评审触发 - 如果开启了自动评审，在消息发送成功后触发
    if (successCount >= 2) {
      triggerAutoReviewIfNeeded(messageContent, loggedInProviders)
    }
  } catch (error) {
    console.error('Failed to send messages:', error)
    ElMessage.error('发送消息失败')
  }
}

/**
 * 自动评审触发（P3）
 */
const triggerAutoReviewIfNeeded = (messageContent: string, providers: AIProvider[]) => {
  try {
    const { useReviewStore } = require('../../stores/review')
    const { reviewService } = require('../../services/ReviewService')
    const reviewStore = useReviewStore()

    if (!reviewStore.config.autoReview || !reviewStore.config.reviewerProviderId) return

    // 延迟触发，等待AI回答完成
    reviewService.autoReview(
      messageContent,
      providers,
      reviewStore.config.reviewerProviderId
    )
  } catch (error) {
    // 自动评审失败不影响主流程
    console.warn('自动评审触发失败:', error)
  }
}

/**
 * 刷新连接
 */
const handleRefresh = async (): Promise<void> => {
  try {
    messageDispatcher.resetAllStatus()
    if (window.electronAPI) {
      await window.electronAPI.refreshAllWebViews()
      ElMessage.success('连接状态已刷新')
    }
  } catch (error) {
    console.error('Failed to refresh connections:', error)
    ElMessage.error('刷新连接失败')
  }
}

interface AttachedFile {
  name: string
  size: number
  mimeType: string
  base64: string
  isText: boolean
}

const attachedFiles = ref<AttachedFile[]>([])

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript']

const isTextMimeType = (mimeType: string): boolean => {
  return TEXT_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix))
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const triggerFileSelect = async (): Promise<void> => {
  if (!window.electronAPI) return

  try {
    const result = await window.electronAPI.openFileDialog({ multiSelections: true })
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) return

    for (const filePath of result.filePaths) {
      const fileResult = await window.electronAPI.readFile({ filePath })
      if (!fileResult.success) continue

      const exists = attachedFiles.value.some(f => f.name === fileResult.name)
      if (exists) continue

      attachedFiles.value.push({
        name: fileResult.name,
        size: fileResult.size,
        mimeType: fileResult.mimeType,
        base64: fileResult.base64,
        isText: isTextMimeType(fileResult.mimeType)
      })
    }
  } catch (error) {
    console.error('File select error:', error)
    ElMessage.error('选择文件失败')
  }
}

const removeFile = (index: number): void => {
  attachedFiles.value.splice(index, 1)
}

const appendFileContentToMessage = (): void => {
  const textFiles = attachedFiles.value.filter(f => f.isText && f.size < 50 * 1024)
  textFiles.forEach(file => {
    try {
      const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))
      const decoded = new TextDecoder('utf-8').decode(bytes)
      chatStore.currentMessage += `\n\n\`\`\`${getLangFromMime(file.mimeType)}:${file.name}\n${decoded}\n\`\`\``
    } catch {
      chatStore.currentMessage += `\n\n[附件: ${file.name} (${formatFileSize(file.size)})]`
    }
  })
}

const getLangFromMime = (mimeType: string): string => {
  const map: Record<string, string> = {
    'text/javascript': 'javascript', 'text/typescript': 'typescript',
    'application/json': 'json', 'text/xml': 'xml', 'text/html': 'html',
    'text/css': 'css', 'text/x-python': 'python', 'text/x-java-source': 'java',
    'text/x-c': 'c', 'text/x-c++src': 'cpp', 'text/x-go': 'go',
    'text/x-rust': 'rust', 'text/x-ruby': 'ruby', 'text/x-php': 'php',
    'text/x-shellscript': 'bash', 'text/x-sql': 'sql', 'text/yaml': 'yaml'
  }
  return map[mimeType] || ''
}

const sendBinaryFilesToWebViews = async (): Promise<void> => {
  const filesToSend = attachedFiles.value
  const loggedIn = chatStore.loggedInProviders

  if (filesToSend.length === 0 || loggedIn.length === 0) return

  const { getFileUploadScript } = await import('../../utils/UploadScripts')
  let successCount = 0
  let failCount = 0

  for (const provider of loggedIn) {
    for (const file of filesToSend) {
      try {
        const script = getFileUploadScript(provider.id, {
          name: file.name,
          mimeType: file.mimeType,
          base64: file.base64
        })
        await window.electronAPI.executeScriptInWebView(provider.webviewId, script)
        successCount++
      } catch (error) {
        console.error(`Upload ${file.name} to ${provider.name} failed:`, error)
        failCount++
      }
    }
  }

  if (successCount > 0) {
    ElMessage.success(`${successCount} 个文件已发送到各AI${failCount > 0 ? `，${failCount} 个失败` : ''}`)
  } else if (failCount > 0) {
    ElMessage.warning('文件发送失败，请检查网站是否支持文件上传')
  }
}

const handleFileUpload = async (): Promise<void> => {
  await triggerFileSelect()
}

const addProviderDialogVisible = ref(false)
const addProviderForm = ref({ name: '', url: '' })

const showAddProviderDialog = () => {
  addProviderForm.value = { name: '', url: '' }
  addProviderDialogVisible.value = true
}

const handleAddProvider = () => {
  if (!addProviderForm.value.name.trim()) {
    ElMessage.warning('请输入网站名称')
    return
  }
  if (!addProviderForm.value.url.trim()) {
    ElMessage.warning('请输入网站网址')
    return
  }
  chatStore.addCustomProvider({
    name: addProviderForm.value.name.trim(),
    url: addProviderForm.value.url.trim()
  })
  addProviderDialogVisible.value = false
  ElMessage.success('网站已添加')
}

const handleRemoveCustomProvider = async (providerId: string) => {
  try {
    await ElMessageBox.confirm('确定移除该自定义网站？', '确认移除', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    chatStore.removeCustomProvider(providerId)
    ElMessage.success('已移除')
  } catch {
    // cancelled
  }
}

/**
 * 清空输入
 */
const handleClear = (): void => {
  chatStore.clearCurrentMessage()
}

/**
 * 新建对话
 */
const handleNewChat = async (): Promise<void> => {
  if (loggedInCount.value === 0) {
    ElMessage.warning('请先登录至少一个AI网站')
    return
  }

  try {
    // 获取已登录的提供商
    const { loggedInProviders } = chatStore

    // 使用messageDispatcher发送新建对话脚本
    const results = await messageDispatcher.sendNewChatScript(loggedInProviders.map((provider) => provider.id))

    // 检查发送结果
    const successCount = results.filter((result) => result.success).length
    const errorCount = results.filter((result) => !result.success).length

    if (errorCount === 0) {
      ElMessage.success(`新建对话请求已发送到 ${successCount} 个AI模型`)
    } else if (successCount > 0) {
      ElMessage.warning(`新建对话请求已发送到 ${successCount} 个AI模型，${errorCount} 个失败`)
    } else {
      ElMessage.error('新建对话请求发送失败')
    }
  } catch (error) {
    console.error('Failed to create new chat:', error)
    ElMessage.error('新建对话失败')
  }
}

/**
 * 打开 Prompt 管理器
 */
const handleOpenPromptManager = (): void => {
  promptManagerVisible.value = true
}

/**
 * 应用 Prompt
 */
const handleApplyPrompt = (prompt: any, userInput?: string): void => {
  let { content } = prompt

  if (userInput) {
    content = content.replace(/\{\{user_input\}\}/g, userInput)
  }

  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const datetime = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(/\//g, '-')
  content = content.replace(/\{\{date\}\}/g, date)
  content = content.replace(/\{\{datetime\}\}/g, datetime)

  chatStore.currentMessage = content
  promptManagerVisible.value = false

  // 同步更新快捷 Prompt - 保存原始模板（包含 {{user_input}}）
  quickPrompt.value = prompt.content
  saveQuickPrompt()
}

/**
 * 应用快捷 Prompt
 */
const handleApplyQuickPrompt = (): void => {
  if (!quickPrompt.value) {
    ElMessage.warning('暂无快捷 Prompt')
    return
  }

  let content = quickPrompt.value
  if (currentMessage.value) {
    content = content.replace(/\{\{user_input\}\}/g, currentMessage.value)
  }

  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const datetime = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(/\//g, '-')
  content = content.replace(/\{\{date\}\}/g, date)
  content = content.replace(/\{\{datetime\}\}/g, datetime)

  chatStore.currentMessage = content
  ElMessage.success('已应用快捷 Prompt')
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

/**
 * 处理总结按钮点击
 */
const handleSummary = (): void => {
  if (!canSummarize.value) {
    if (hasRespondingAI.value) {
      ElMessage.warning('请等待AI回答完成后再进行总结')
    } else if (!hasCompletedAI.value) {
      ElMessage.warning('至少需要一个AI完成回答才能进行总结')
    }
    return
  }

  // 触发总结事件，由父组件处理
  emit('summary')
}

/**
 * 处理对比按钮点击
 */
const handleComparison = (): void => {
  emit('open-comparison')
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
  window.addEventListener('login-status-changed', handleLoginStatusChanged as EventListener)

  // 组件挂载后，加载用户偏好的高度
  nextTick(() => {
    loadPreferredHeight()
  })

  // 加载快捷 Prompt
  loadQuickPrompt()

  // 加载折叠状态
  loadCollapsedState()

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
const startAIStatusMonitoringForLoggedInProviders = async (): Promise<void> => {
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
const startAIStatusMonitoringForProvider = async (providerId: string): Promise<void> => {
  try {
    if (!window.electronAPI) {
      console.warn('electronAPI不可用，无法启动AI状态监控')
      return
    }
    if (providerId.includes('summary')) {
      console.warn('总结模型不支持AI状态监控')
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
    setTimeout(async () => {
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
const stopAIStatusMonitoringForProvider = async (providerId: string): Promise<void> => {
  try {
    if (!window.electronAPI) {
      console.warn('electronAPI不可用，无法停止AI状态监控')
      return
    }
    if (providerId.includes('summary')) {
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
  transition: all 0.3s ease;
}

.unified-input.collapsed .input-card {
  display: none;
}

.input-card {
  box-shadow: var(--el-box-shadow-light);
}

.input-body {
  transition: all 0.3s ease;
}

.agent-skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.agent-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-8);
}

.prompt-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--el-color-warning-light-9);
  border-radius: 8px;
  border: 1px solid var(--el-color-warning-light-8);
}

.prompt-btn {
  font-size: 11px !important;
  border-radius: 12px !important;
  padding: 4px 8px !important;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.discussion-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  border-radius: 16px;
  padding: 4px 10px;
}

/* 悬浮展开按钮 - 收起时显示在右上角 */
.floating-expand-btn {
  position: fixed;
  top: 76px;
  right: 24px;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--el-color-primary);
  color: white;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  transition: all 0.3s ease;
  font-size: 13px;
  font-weight: 500;
  user-select: none;
}

.floating-expand-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.5);
  background: var(--el-color-primary-light-3);
}

.floating-expand-btn:active {
  transform: translateY(0);
}

.expand-label {
  white-space: nowrap;
}

/* 收起按钮 - 在输入框头部右侧 */
.collapse-btn {
  margin-left: 8px;
  background: var(--el-color-primary-light-7);
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  font-weight: 500;
}

.collapse-btn:hover {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 模型选择器标签 */
.selector-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  padding: 0 2px;
}

.selector-label .el-icon {
  color: var(--el-color-primary);
}

/* 模型选择器样式 */
.model-selector {
  margin-bottom: 16px;
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
  gap: 6px;
  align-items: center;
}

.provider-checkbox {
  margin: 0;
  min-height: auto;
  flex: 0 1 auto;
  min-width: 0;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-bg-color);
  border: 1.5px solid var(--el-border-color-lighter);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.custom-remove {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-danger);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
}

.provider-option:hover .custom-remove {
  opacity: 1;
}

.add-provider-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1.5px dashed var(--el-border-color);
  border-radius: 16px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.add-provider-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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

/* iOS风格选中状态 */
:deep(.provider-checkbox.is-checked .provider-option) {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

/* iOS风格悬停效果 */
.provider-option:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

/* iOS风格选中状态下的图标和文字 */
:deep(.provider-checkbox.is-checked .provider-option .provider-name) {
  color: var(--el-color-primary);
  font-weight: 600;
}

:deep(.provider-checkbox.is-checked .provider-option .status-tag) {
  background: var(--el-color-primary-light-8);
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.provider-icon-small {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: contain;
}

.provider-name {
  font-weight: 500;
  color: var(--el-text-color-regular);
  font-size: 12px;
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
    padding: 3px 8px;
  }
}

@media (max-width: 768px) {
  .provider-checkboxes {
    gap: 4px;
  }

  .provider-option {
    padding: 3px 8px;
    gap: 4px;
  }

  .provider-icon-small {
    width: 16px;
    height: 16px;
  }

  .provider-name {
    font-size: 11px;
  }

  .status-tag {
    font-size: 10px;
    padding: 1px 4px;
  }
}

@media (max-width: 480px) {
  .provider-checkboxes {
    gap: 3px;
  }

  .provider-option {
    padding: 2px 6px;
    gap: 3px;
  }

  .provider-name {
    font-size: 10px;
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

.attached-files {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  margin-top: 4px;
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
  flex-wrap: wrap;
  gap: 6px;
}

.actions-left,
.actions-right {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 8px;
}

.action-group-util {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.action-group-analysis {
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-8);
}

.actions-left .el-button,
.actions-right .el-button {
  font-size: 12px;
  padding: 6px 10px;
}

/* 输入框样式优化 */
:deep(.el-textarea) {
  position: relative;
  transition: all 0.3s ease;
}

:deep(.el-textarea__inner) {
  resize: none;
  min-height: 80px;
  max-height: 25vh;
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
  overflow-y: auto;
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px rgba(48, 165, 255, 0.2);
}

/* 展开状态样式 */
.textarea-container.expanded :deep(.el-textarea__inner) {
  min-height: 200px;
  max-height: 30vh;
  overflow-y: auto;
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
</style>
