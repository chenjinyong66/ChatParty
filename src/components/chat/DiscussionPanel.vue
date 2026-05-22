<template>
  <div class="discussion-panel">
    <!-- ====== 配置区域 ====== -->
    <div
      v-if="!discussionStore.isRunning && (!discussionStore.session || discussionStore.session.status === 'idle' || discussionStore.session.status === 'completed' || discussionStore.session.status === 'paused' || discussionStore.session.status === 'error')"
      class="discussion-config">
      <div class="config-grid">
        <div class="config-item">
          <div class="config-item-label">讨论模式</div>
          <el-radio-group v-model="localConfig.mode" size="small">
            <el-radio-button value="sequential">顺序讨论</el-radio-button>
            <el-radio-button value="debate">辩论</el-radio-button>
            <el-radio-button value="round-robin">圆桌</el-radio-button>
          </el-radio-group>
        </div>
        <div class="config-item">
          <div class="config-item-label">轮次</div>
          <el-input-number v-model="localConfig.maxRounds" :min="1" :max="5" size="small" />
        </div>
      </div>

      <div class="config-item full-width">
        <div class="config-item-label">参与模型 <span class="sub-label">（点击选择，顺序即发言顺序）</span></div>
        <div class="participant-chips">
          <div v-for="provider in loggedInProviders" :key="provider.id" class="participant-chip"
            :class="{ active: localConfig.participantIds.includes(provider.id) }"
            @click="toggleParticipant(provider.id, !localConfig.participantIds.includes(provider.id))">
            <img :src="provider.icon" class="chip-icon" @error="handleIconError">
            <span class="chip-name">{{ provider.name }}</span>
            <span v-if="localConfig.participantIds.includes(provider.id)" class="chip-order">
              {{ localConfig.participantIds.indexOf(provider.id) + 1 }}
            </span>
          </div>
        </div>
      </div>

      <div class="config-item full-width">
        <div class="config-item-label">讨论话题</div>
        <el-input v-model="discussionTopic" type="textarea" :rows="2" placeholder="输入要讨论的问题或话题..." resize="none" />
      </div>

      <div class="start-action">
        <el-button type="primary" size="default"
          :disabled="localConfig.participantIds.length < 2 || !discussionTopic.trim()" @click="handleStartDiscussion">
          开始讨论
        </el-button>
        <span v-if="localConfig.participantIds.length < 2" class="hint-text">
          至少选择2个模型
        </span>
      </div>
    </div>

    <!-- ====== 进行中 - 进度条 ====== -->
    <div v-if="discussionStore.isRunning" class="discussion-running">
      <div class="running-header">
        <div class="running-indicator">
          <span class="pulse-dot" />
          讨论进行中
        </div>
        <el-button type="danger" size="small" plain @click="handleStop">
          停止
        </el-button>
      </div>
      <el-progress :percentage="discussionProgress" :stroke-width="6" :show-text="false" striped striped-flow />
      <div class="running-status">{{ discussionStore.progress.message }}</div>
    </div>

    <!-- ====== 讨论记录 ====== -->
    <div v-if="discussionStore.session && discussionStore.session.rounds.length > 0" class="discussion-record">
      <!-- 话题 -->
      <div class="topic-banner">
        <span class="topic-icon">💡</span>
        <span class="topic-text">{{ discussionStore.session.originalQuery }}</span>
        <el-tag v-if="discussionStore.session.status === 'completed'" type="success" size="small" round>
          已完成
        </el-tag>
        <el-tag v-else-if="discussionStore.session.status === 'paused'" type="warning" size="small" round>
          已暂停
        </el-tag>
      </div>

      <!-- 对话气泡列表 -->
      <div class="chat-bubbles">
        <template v-for="(utterance, idx) in discussionStore.allUtterances" :key="idx">
          <!-- 轮次分隔 -->
          <div v-if="isFirstInRound(utterance)" class="round-divider">
            <span class="divider-line" />
            <span class="divider-text">第 {{ getRoundNumber(utterance) }} 轮</span>
            <span class="divider-line" />
          </div>

          <!-- 气泡 -->
          <div class="bubble-row" :class="{ 'bubble-error': !utterance.success }">
            <div class="bubble-avatar">
              <img :src="getProviderIcon(utterance.providerId)" class="avatar-img" @error="handleIconError">
              <span class="avatar-name">{{ utterance.providerName }}</span>
            </div>
            <div class="bubble-content">
              <div class="content-body" v-html="renderMarkdown(utterance.content)" />
              <div class="bubble-actions">
                <el-button size="small" text @click="handleCopyContent(utterance.content)">
                  <el-icon :size="12">
                    <DocumentCopy />
                  </el-icon>
                  复制
                </el-button>
                <el-button size="small" text @click="handleGoToModel(utterance.providerId)">
                  <el-icon :size="12">
                    <View />
                  </el-icon>
                  查看对话
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 底部操作 -->
      <div v-if="discussionStore.session.status === 'completed' || discussionStore.session.status === 'paused'"
        class="record-actions">
        <el-button size="small" @click="handleNewDiscussion">
          新讨论
        </el-button>
        <el-button type="primary" size="small" @click="handleExportDiscussion">
          导出记录
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, View } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { useChatStore } from '../../stores'
import { useDiscussionStore } from '../../stores/discussion'
import { discussionService } from '../../services/DiscussionService'
import type { DiscussionMode, DiscussionUtterance } from '../../types/discussion'

const chatStore = useChatStore()
const discussionStore = useDiscussionStore()

const discussionTopic = ref('')

const localConfig = reactive({
  mode: 'sequential' as DiscussionMode,
  maxRounds: 2,
  participantIds: [] as string[]
})

const loggedInProviders = computed(() =>
  chatStore.providers.filter(p => p.isLoggedIn)
)

const discussionProgress = computed(() => {
  if (!discussionStore.session) return 0
  const { currentRound, currentSpeakerIndex } = discussionStore.session
  const totalParticipants = discussionStore.session.config.participantIds.length
  const maxRounds = discussionStore.session.config.maxRounds
  if (totalParticipants === 0) return 0
  const total = maxRounds * totalParticipants
  const current = (currentRound - 1) * totalParticipants + currentSpeakerIndex + 1
  return Math.min(Math.round((current / total) * 100), 100)
})

/** 渲染Markdown */
const renderMarkdown = (text: string): string => {
  if (!text) return ''
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string
  } catch {
    return text.replace(/\n/g, '<br>')
  }
}

/** 判断是否是新一轮的第一条发言 */
const isFirstInRound = (utterance: DiscussionUtterance): boolean => {
  const all = discussionStore.allUtterances
  const idx = all.indexOf(utterance)
  if (idx === 0) return true
  const participantCount = discussionStore.session?.config.participantIds.length || 1
  return idx % participantCount === 0
}

/** 获取发言所在轮次 */
const getRoundNumber = (utterance: DiscussionUtterance): number => {
  const all = discussionStore.allUtterances
  const idx = all.indexOf(utterance)
  const participantCount = discussionStore.session?.config.participantIds.length || 1
  return Math.floor(idx / participantCount) + 1
}

const toggleParticipant = (providerId: string, checked: boolean) => {
  if (checked) {
    if (!localConfig.participantIds.includes(providerId)) {
      localConfig.participantIds.push(providerId)
    }
  } else {
    localConfig.participantIds = localConfig.participantIds.filter(id => id !== providerId)
  }
}

const getProviderIcon = (id: string) => {
  return chatStore.providers.find(p => p.id === id)?.icon || ''
}

const handleIconError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

/** 复制内容到剪贴板 */
const handleCopyContent = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制到剪贴板')
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制到剪贴板')
  }
}

/** 跳转到对应模型的对话卡片 */
const handleGoToModel = (providerId: string) => {
  // 滚动到对应的AI卡片
  const cardElement = document.querySelector(`[data-provider-id="${providerId}"]`)
  if (cardElement) {
    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 高亮闪烁效果
    cardElement.classList.add('highlight-flash')
    setTimeout(() => cardElement.classList.remove('highlight-flash'), 2000)
  }
}

const handleStartDiscussion = () => {
  if (localConfig.participantIds.length < 2) {
    ElMessage.warning('请选择至少2个模型参与讨论')
    return
  }
  if (!discussionTopic.value.trim()) {
    ElMessage.warning('请输入讨论话题')
    return
  }

  const providers = localConfig.participantIds
    .map(id => chatStore.providers.find(p => p.id === id))
    .filter(Boolean) as any[]

  discussionService.startDiscussion(
    discussionTopic.value.trim(),
    providers,
    localConfig.mode,
    localConfig.maxRounds
  )
}

const handleStop = () => {
  discussionService.stopDiscussion()
}

const handleNewDiscussion = () => {
  discussionStore.clearSession()
}

const handleExportDiscussion = () => {
  if (!discussionStore.session) return
  const content = discussionStore.allUtterances
    .map(u => `## ${u.providerName} (第${u.order}位发言)\n\n${u.content}`)
    .join('\n\n---\n\n')
  const header = `# 多模型讨论记录\n\n**问题**: ${discussionStore.session.originalQuery}\n**模式**: ${discussionStore.session.config.mode}\n**轮次**: ${discussionStore.session.config.maxRounds}\n\n---\n\n`
  const blob = new Blob([header + content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `discussion_${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

const startDiscussion = (query: string) => {
  discussionTopic.value = query
  handleStartDiscussion()
}

defineExpose({ startDiscussion, localConfig, discussionTopic })
</script>

<style scoped>
.discussion-panel {
  padding: 12px 0;
  font-size: 13px;
}

/* ====== 配置区域 ====== */
.config-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 12px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item.full-width {
  margin-bottom: 12px;
}

.config-item-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.sub-label {
  font-weight: 400;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

/* 参与模型芯片 */
.participant-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.participant-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--el-border-color);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  position: relative;
}

.participant-chip:hover {
  border-color: var(--el-color-primary);
}

.participant-chip.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.chip-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.chip-name {
  font-size: 12px;
  font-weight: 500;
}

.chip-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: white;
  font-size: 10px;
  font-weight: 700;
}

.hint-text {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.start-action {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  padding-top: 4px;
}

/* ====== 进行中 ====== */
.discussion-running {
  padding: 12px 0;
}

.running-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.running-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-success);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(1.3);
  }
}

.running-status {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ====== 讨论记录 ====== */
.discussion-record {
  padding: 4px 0;
}

.topic-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  border-radius: 10px;
  margin-bottom: 16px;
  border: 1px solid var(--el-color-primary-light-7);
}

.topic-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.topic-text {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.5;
}

/* 聊天气泡 */
.chat-bubbles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 4px;
}

/* 轮次分隔 */
.round-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 8px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--el-border-color-lighter);
}

.divider-text {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  font-weight: 500;
}

/* 气泡行 */
.bubble-row {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  transition: background 0.2s;
}

.bubble-row:hover {
  background: var(--el-fill-color-lighter);
}

.bubble-row.bubble-error {
  opacity: 0.5;
}

.bubble-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 48px;
  flex-shrink: 0;
}

.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--el-border-color-lighter);
}

.avatar-name {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  text-align: center;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble-content {
  flex: 1;
  min-width: 0;
}

.bubble-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.bubble-row:hover .bubble-actions {
  opacity: 1;
}

.content-body {
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
}

.content-body :deep(p) {
  margin: 0 0 8px;
}

.content-body :deep(p:last-child) {
  margin-bottom: 0;
}

.content-body :deep(pre) {
  background: var(--el-fill-color-darker);
  border-radius: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 12px;
}

.content-body :deep(code) {
  background: var(--el-fill-color);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}

.content-body :deep(pre code) {
  background: none;
  padding: 0;
}

.content-body :deep(ul),
.content-body :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.content-body :deep(blockquote) {
  border-left: 3px solid var(--el-color-primary-light-5);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
}

.content-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 12px;
}

.content-body :deep(th),
.content-body :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 6px 10px;
  text-align: left;
}

.content-body :deep(th) {
  background: var(--el-fill-color-lighter);
  font-weight: 600;
}

/* 底部操作 */
.record-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: center;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
