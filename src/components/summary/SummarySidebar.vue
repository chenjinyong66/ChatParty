<template>
  <div class="side-panel" :class="{ collapsed: isCollapsed }">
    <!-- 收起时的展开按钮 -->
    <div v-if="isCollapsed" class="expand-trigger" @click="toggleCollapse" title="展开面板">
      <el-icon :size="18">
        <ArrowLeft />
      </el-icon>
    </div>

    <!-- 侧边栏内容 -->
    <div v-show="!isCollapsed" class="sidebar-content">
      <!-- 右上角关闭按钮 -->
      <div class="panel-close-btn" @click="toggleCollapse" title="关闭面板">
        <el-icon :size="14">
          <Close />
        </el-icon>
      </div>

      <!-- Tab 切换 -->
      <div class="sidebar-tabs">
        <div class="tab-item" :class="{ active: activeTab === 'comparison' }" @click="activeTab = 'comparison'">
          <el-icon :size="14">
            <ScaleToOriginal />
          </el-icon>
          <span>对比</span>
        </div>
        <div class="tab-item" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">
          <el-icon :size="14">
            <DocumentChecked />
          </el-icon>
          <span>总结</span>
        </div>
        <div class="tab-item" :class="{ active: activeTab === 'discussion' }" @click="activeTab = 'discussion'">
          <el-icon :size="14">
            <ChatLineRound />
          </el-icon>
          <span>讨论</span>
        </div>
      </div>

      <!-- 对比面板 -->
      <div v-show="activeTab === 'comparison'" class="tab-panel comparison-panel-wrapper">
        <ComparisonPanel />
      </div>

      <!-- 总结面板 -->
      <div v-show="activeTab === 'summary'" class="tab-panel">
        <div class="panel-header">
          <span class="header-title">AI 总结</span>
          <el-select v-model="selectedModelId" size="small" class="model-select" @change="handleModelChange">
            <el-option v-for="p in availableProviders" :key="p.id" :label="p.name" :value="p.id">
              <div class="provider-option">
                <img :src="p.icon" class="provider-icon-small" @error="handleIconError">
                <span>{{ p.name }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div class="ai-card-container">
          <AICard v-if="provider" :key="summaryProviderId" :provider="provider" :config="cardConfig"
            class="summary-ai-card" />
        </div>
      </div>

      <!-- 讨论面板 -->
      <div v-show="activeTab === 'discussion'" class="tab-panel discussion-panel-wrapper">
        <DiscussionPanel ref="discussionPanelRef" />
      </div>

      <!-- 底部收起按钮 -->
      <div class="collapse-trigger" @click="toggleCollapse" title="收起面板">
        <el-icon :size="18">
          <ArrowRight />
        </el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DocumentChecked, ChatLineRound, ScaleToOriginal, ArrowLeft, ArrowRight, Close } from '@element-plus/icons-vue'
import AICard from '../chat/AICard.vue'
import DiscussionPanel from '../chat/DiscussionPanel.vue'
import ComparisonPanel from '../chat/ComparisonPanel.vue'
import type { AIProvider } from '../../types'

/**
 * 组件属性
 */
interface Props {
  originalProviderId: string
  originalProviderName: string
  originalProvider: AIProvider | null
  visible: boolean
  availableProviders: AIProvider[]
  selectedProviderId: string
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', visible: boolean): void
  (e: 'model-change', providerId: string): void
}

const emit = defineEmits<Emits>()

// 折叠状态
const isCollapsed = ref(true)

// 当前Tab
const activeTab = ref<'comparison' | 'summary' | 'discussion'>('comparison')

// 讨论面板引用
const discussionPanelRef = ref<InstanceType<typeof DiscussionPanel> | null>(null)

// 选中的模型ID
const selectedModelId = ref(props.selectedProviderId)

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleModelChange = (providerId: string) => {
  emit('model-change', providerId)
}

const handleIconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = '/icons/default.svg'
}

const summaryProviderId = computed(() => `summary-${props.originalProviderId}`)

const provider = computed((): AIProvider | null => {
  if (!props.originalProvider) return null
  return {
    ...props.originalProvider,
    id: summaryProviderId.value,
    name: `${props.originalProviderName} (总结)`,
    webviewId: `webview-${summaryProviderId.value}`,
    isEnabled: true,
    isLoggedIn: props.originalProvider.isLoggedIn,
    loadingState: props.originalProvider.isLoggedIn ? 'loaded' : 'loading'
  }
})

const cardConfig = computed(() => ({
  id: summaryProviderId.value,
  providerId: summaryProviderId.value,
  position: { x: 0, y: 0 },
  size: { width: '100%', height: '100%' },
  isVisible: true,
  isHidden: false,
  isMinimized: false,
  isMaximized: false,
  zIndex: 1,
  title: `${props.originalProviderName || '未知模型'} (总结)`
}))

// 监听visible变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    isCollapsed.value = false
  }
})

// 监听selectedProviderId变化
watch(() => props.selectedProviderId, (newId) => {
  selectedModelId.value = newId
})

/**
 * 切换到讨论Tab
 */
const showDiscussion = () => {
  activeTab.value = 'discussion'
  isCollapsed.value = false
}

/**
 * 切换到总结Tab
 */
const showSummary = () => {
  activeTab.value = 'summary'
  isCollapsed.value = false
}

/**
 * 切换到对比Tab
 */
const showComparison = () => {
  activeTab.value = 'comparison'
  isCollapsed.value = false
}

defineExpose({ showDiscussion, showSummary, showComparison, activeTab })
</script>

<style scoped>
.side-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 65%;
  max-width: 960px;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.08);
  z-index: 1000;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
}

.side-panel.collapsed {
  transform: translateX(100%);
}

.expand-trigger {
  position: absolute;
  left: -36px;
  bottom: 80px;
  width: 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  border: 1px solid var(--el-color-primary-light-5);
  border-right: none;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-trigger:hover {
  background: var(--el-color-primary);
  color: #fff;
  border-color: var(--el-color-primary);
  box-shadow: -3px 0 14px rgba(0, 0, 0, 0.15);
}

.collapse-trigger {
  position: absolute;
  left: -32px;
  bottom: 80px;
  width: 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  border: 1px solid var(--el-color-primary-light-5);
  border-right: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 5;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.08);
}

.collapse-trigger:hover {
  background: var(--el-color-primary);
  color: #fff;
}

.panel-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  background: #f56c6c;
  color: #fff;
  transition: all 0.2s;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(245, 108, 108, 0.4);
}

.panel-close-btn:hover {
  background: #e04040;
  box-shadow: 0 3px 10px rgba(245, 108, 108, 0.6);
  transform: scale(1.1);
}

/* 侧边栏内容 */
.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tab 切换 */
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  user-select: none;
}

.tab-item:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-lighter);
}

.tab-item.active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  background: var(--el-bg-color);
}

/* Tab 面板 */
.tab-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 总结面板 */
.panel-header {
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.header-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.model-select {
  width: 140px;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon-small {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  object-fit: contain;
}

.ai-card-container {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

.summary-ai-card {
  width: 100%;
  height: 100%;
}

.summary-ai-card :deep(.ai-card) {
  height: 100%;
  border: none;
  box-shadow: none;
}

.summary-ai-card :deep(.webview-container) {
  height: calc(100% - 44px);
}

/* 讨论面板 */
.discussion-panel-wrapper {
  padding: 0 12px;
  overflow-y: auto;
}

/* 对比面板 */
.comparison-panel-wrapper {
  padding: 0 12px;
  overflow-y: auto;
}
</style>
