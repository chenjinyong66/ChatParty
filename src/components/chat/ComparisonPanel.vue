<template>
  <div class="comparison-panel">
    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button
        type="primary"
        size="small"
        :loading="isCollecting"
        :disabled="loggedInProviders.length < 2"
        @click="handleCollect"
      >
        {{ isCollecting ? '收集中...' : '收集回答' }}
      </el-button>
      <el-button
        size="small"
        :disabled="responses.length === 0"
        @click="handleExport"
      >
        导出对比
      </el-button>
      <el-button
        size="small"
        :disabled="responses.length === 0"
        @click="handleClear"
      >
        清空
      </el-button>
    </div>

    <!-- 空状态 -->
    <div v-if="responses.length === 0 && !isCollecting" class="empty-state">
      <el-icon :size="40" class="empty-icon"><ScaleToOriginal /></el-icon>
      <p class="empty-title">多模型回答对比</p>
      <p class="empty-desc">点击"收集回答"自动提取各AI的最新回答，<br>以对比视图展示不同模型的回答差异</p>
    </div>

    <!-- 收集进度 -->
    <div v-if="isCollecting" class="collecting-state">
      <el-progress :percentage="collectProgress" :stroke-width="6" :show-text="false" striped striped-flow />
      <p class="collecting-text">{{ collectMessage }}</p>
    </div>

    <!-- 对比内容 -->
    <div v-if="responses.length > 0" class="comparison-content">
      <!-- 原始问题 -->
      <div v-if="lastQuery" class="query-banner">
        <span class="query-label">问题</span>
        <span class="query-text">{{ lastQuery }}</span>
      </div>

      <!-- 视图切换 -->
      <div class="view-switch">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
          <el-radio-button value="diff">差异</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="card-view">
        <div
          v-for="resp in responses"
          :key="resp.providerId"
          class="response-card"
        >
          <div class="response-card-header">
            <img :src="resp.icon" class="resp-icon" @error="handleIconError">
            <span class="resp-name">{{ resp.providerName }}</span>
            <el-tag v-if="resp.success" type="success" size="small">成功</el-tag>
            <el-tag v-else type="danger" size="small">失败</el-tag>
            <span class="resp-length">{{ resp.content.length }}字</span>
            <div class="card-actions">
              <el-button size="small" text @click="handleCopyContent(resp.content, resp.providerName)">
                <el-icon :size="12"><DocumentCopy /></el-icon>
              </el-button>
              <el-button size="small" text @click="handleGoToModel(resp.providerId)">
                <el-icon :size="12"><View /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="response-card-body" v-html="renderMarkdown(resp.content)" />
        </div>
      </div>

      <!-- 表格视图 -->
      <div v-if="viewMode === 'table'" class="table-view">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="col-dimension">维度</th>
              <th v-for="resp in responses" :key="resp.providerId" class="col-model">
                <img :src="resp.icon" class="resp-icon-sm" @error="handleIconError">
                {{ resp.providerName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="col-dimension">回答长度</td>
              <td v-for="resp in responses" :key="resp.providerId">
                {{ resp.content.length }} 字
              </td>
            </tr>
            <tr>
              <td class="col-dimension">是否有代码</td>
              <td v-for="resp in responses" :key="resp.providerId">
                {{ resp.content.includes('```') ? '✓' : '✗' }}
              </td>
            </tr>
            <tr>
              <td class="col-dimension">是否有列表</td>
              <td v-for="resp in responses" :key="resp.providerId">
                {{ (resp.content.includes('- ') || resp.content.includes('1. ')) ? '✓' : '✗' }}
              </td>
            </tr>
            <tr>
              <td class="col-dimension">开头预览</td>
              <td v-for="resp in responses" :key="resp.providerId" class="preview-cell">
                {{ resp.content.substring(0, 80) }}...
              </td>
            </tr>
            <tr>
              <td class="col-dimension">完整回答</td>
              <td v-for="resp in responses" :key="resp.providerId" class="full-content-cell">
                <div class="full-content-scroll" v-html="renderMarkdown(resp.content)" />
                <el-button size="small" text type="primary" @click="openFullContent(resp)">
                  放大查看
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 完整内容弹窗 -->
      <el-dialog
        v-model="fullContentVisible"
        :title="fullContentTitle"
        width="80%"
        top="5vh"
        destroy-on-close
        append-to-body
      >
        <div class="full-content-dialog-body" v-html="fullContentHtml" />
      </el-dialog>

      <!-- 差异视图 -->
      <div v-if="viewMode === 'diff'" class="diff-view">
        <div class="diff-controls">
          <span class="diff-label">对比：</span>
          <el-select v-model="diffLeft" size="small" class="diff-select">
            <el-option v-for="r in responses" :key="r.providerId" :label="r.providerName" :value="r.providerId" />
          </el-select>
          <span class="diff-vs">vs</span>
          <el-select v-model="diffRight" size="small" class="diff-select">
            <el-option v-for="r in responses" :key="r.providerId" :label="r.providerName" :value="r.providerId" />
          </el-select>
        </div>
        <div class="diff-content">
          <div class="diff-column">
            <div class="diff-column-header">
              <img :src="getIcon(diffLeft)" class="resp-icon-sm" @error="handleIconError">
              {{ getName(diffLeft) }}
              <div class="diff-column-actions">
                <el-button size="small" text @click="handleCopyContent(getContent(diffLeft), getName(diffLeft))">
                  <el-icon :size="11"><DocumentCopy /></el-icon>
                </el-button>
                <el-button size="small" text @click="handleGoToModel(diffLeft)">
                  <el-icon :size="11"><View /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="diff-column-body" v-html="renderMarkdown(getContent(diffLeft))" />
          </div>
          <div class="diff-column">
            <div class="diff-column-header">
              <img :src="getIcon(diffRight)" class="resp-icon-sm" @error="handleIconError">
              {{ getName(diffRight) }}
              <div class="diff-column-actions">
                <el-button size="small" text @click="handleCopyContent(getContent(diffRight), getName(diffRight))">
                  <el-icon :size="11"><DocumentCopy /></el-icon>
                </el-button>
                <el-button size="small" text @click="handleGoToModel(diffRight)">
                  <el-icon :size="11"><View /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="diff-column-body" v-html="renderMarkdown(getContent(diffRight))" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ScaleToOriginal, DocumentCopy, View } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { ElMessage } from 'element-plus'
import { useChatStore } from '../../stores'
import { getSendMessageScript } from '../../utils/GetLLMLastMessage'

interface ResponseData {
  providerId: string
  providerName: string
  icon: string
  content: string
  success: boolean
}

const chatStore = useChatStore()

const responses = ref<ResponseData[]>([])
const isCollecting = ref(false)
const collectProgress = ref(0)
const collectMessage = ref('')
const lastQuery = ref('')
const viewMode = ref<'card' | 'table' | 'diff'>('card')
const diffLeft = ref('')
const diffRight = ref('')
const fullContentVisible = ref(false)
const fullContentTitle = ref('')
const fullContentHtml = ref('')

const loggedInProviders = computed(() =>
  chatStore.providers.filter(p => p.isLoggedIn)
)

/** 渲染Markdown */
const renderMarkdown = (text: string): string => {
  if (!text) return '<span class="empty-text">无内容</span>'
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string
  } catch {
    return text.replace(/\n/g, '<br>')
  }
}

const getIcon = (id: string) => responses.value.find(r => r.providerId === id)?.icon || ''
const getName = (id: string) => responses.value.find(r => r.providerId === id)?.providerName || ''
const getContent = (id: string) => responses.value.find(r => r.providerId === id)?.content || ''

const handleIconError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

const openFullContent = (resp: any) => {
  fullContentTitle.value = `${resp.providerName} - 完整回答`
  fullContentHtml.value = renderMarkdown(resp.content)
  fullContentVisible.value = true
}

/** 复制内容到剪贴板 */
const handleCopyContent = async (content: string, providerName?: string) => {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success(`${providerName ? providerName + '的' : ''}回答已复制到剪贴板`)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(`${providerName ? providerName + '的' : ''}回答已复制到剪贴板`)
  }
}

/** 跳转到对应模型的对话卡片 */
const handleGoToModel = (providerId: string) => {
  const cardElement = document.querySelector(`[data-provider-id="${providerId}"]`)
  if (cardElement) {
    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    cardElement.classList.add('highlight-flash')
    setTimeout(() => cardElement.classList.remove('highlight-flash'), 2000)
  }
}

/** 收集各模型回答 */
const handleCollect = async () => {
  const providers = loggedInProviders.value
  if (providers.length < 2) {
    ElMessage.warning('至少需要2个已登录的模型')
    return
  }

  isCollecting.value = true
  collectProgress.value = 0
  collectMessage.value = '正在收集各模型回答...'
  responses.value = []

  // 获取最近发送的消息
  lastQuery.value = chatStore.currentMessage || ''

  let collected = 0
  for (const provider of providers) {
    collectMessage.value = `正在收集 ${provider.name} 的回答...`
    try {
      const script = getSendMessageScript(provider.id)
      if (!script) {
        responses.value.push({
          providerId: provider.id,
          providerName: provider.name,
          icon: provider.icon,
          content: '[该平台暂不支持内容提取]',
          success: false
        })
        collected++
        collectProgress.value = Math.round((collected / providers.length) * 100)
        continue
      }

      const result = await Promise.race([
        window.electronAPI.executeScriptInWebView(provider.webviewId, script),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时')), 10000))
      ])

      let content = ''
      if (typeof result === 'string') {
        content = result
      } else if (result && typeof result === 'object') {
        content = result.result || result.content || ''
      }

      responses.value.push({
        providerId: provider.id,
        providerName: provider.name,
        icon: provider.icon,
        content: content.trim() || '[未获取到内容]',
        success: !!content.trim()
      })
    } catch (error) {
      responses.value.push({
        providerId: provider.id,
        providerName: provider.name,
        icon: provider.icon,
        content: '[提取失败]',
        success: false
      })
    }
    collected++
    collectProgress.value = Math.round((collected / providers.length) * 100)
  }

  // 设置diff默认值
  if (responses.value.length >= 2) {
    diffLeft.value = responses.value[0].providerId
    diffRight.value = responses.value[1].providerId
  }

  isCollecting.value = false
  collectMessage.value = ''

  const successCount = responses.value.filter(r => r.success).length
  if (successCount > 0) {
    ElMessage.success(`成功收集 ${successCount}/${providers.length} 个模型的回答`)
  } else {
    ElMessage.warning('未能获取任何模型的回答')
  }
}

const handleExport = () => {
  if (responses.value.length === 0) return
  const content = responses.value
    .map(r => `## ${r.providerName}\n\n${r.content}`)
    .join('\n\n---\n\n')
  const header = `# 多模型回答对比\n\n**问题**: ${lastQuery.value}\n**时间**: ${new Date().toLocaleString()}\n\n---\n\n`
  const blob = new Blob([header + content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comparison_${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

const handleClear = () => {
  responses.value = []
  lastQuery.value = ''
}
</script>

<style scoped>
.comparison-panel {
  padding: 12px 0;
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 12px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-placeholder);
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

/* 收集进度 */
.collecting-state {
  padding: 20px;
  text-align: center;
}

.collecting-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 对比内容 */
.comparison-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-7);
}

.query-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.query-text {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 视图切换 */
.view-switch {
  display: flex;
  justify-content: center;
}

/* ====== 卡片视图 ====== */
.card-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow-y: auto;
}

.response-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.response-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.resp-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.resp-name {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
}

.resp-length {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.card-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.response-card:hover .card-actions {
  opacity: 1;
}

.response-card-body {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
  max-height: 200px;
  overflow-y: auto;
}

.response-card-body :deep(p) { margin: 0 0 6px; }
.response-card-body :deep(p:last-child) { margin-bottom: 0; }
.response-card-body :deep(pre) {
  background: var(--el-fill-color-darker);
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  font-size: 12px;
  margin: 6px 0;
}
.response-card-body :deep(code) {
  background: var(--el-fill-color);
  padding: 1px 3px;
  border-radius: 3px;
  font-size: 12px;
}
.response-card-body :deep(pre code) {
  background: none;
  padding: 0;
}

/* ====== 表格视图 ====== */
.table-view {
  overflow-x: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.compare-table th,
.compare-table td {
  border: 1px solid var(--el-border-color);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.compare-table th {
  background: var(--el-fill-color-lighter);
  font-weight: 600;
  white-space: nowrap;
}

.col-dimension {
  width: 80px;
  background: var(--el-fill-color-lighter);
  font-weight: 500;
  white-space: nowrap;
}

.col-model {
  min-width: 120px;
}

.col-model img {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: middle;
  margin-right: 4px;
}

.preview-cell {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  max-width: 200px;
}

.full-content-cell {
  vertical-align: top;
}

.full-content-scroll {
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.6;
  padding: 6px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  margin-bottom: 6px;
}

.full-content-scroll :deep(pre) {
  margin: 4px 0;
  padding: 8px;
  background: var(--el-bg-color);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

.full-content-scroll :deep(code) {
  font-size: 12px;
}

.full-content-scroll :deep(p) {
  margin: 4px 0;
}

.full-content-dialog-body {
  max-height: 70vh;
  overflow-y: auto;
  padding: 16px;
  line-height: 1.8;
}

.full-content-dialog-body :deep(pre) {
  margin: 8px 0;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  overflow-x: auto;
}

.full-content-dialog-body :deep(code) {
  font-size: 13px;
}

.full-content-dialog-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.full-content-dialog-body :deep(th),
.full-content-dialog-body :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 6px 10px;
}

.resp-icon-sm {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: middle;
}

/* ====== 差异视图 ====== */
.diff-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.diff-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.diff-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.diff-select {
  width: 120px;
}

.diff-vs {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
}

.diff-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 55vh;
  overflow-y: auto;
}

.diff-column {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.diff-column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.diff-column-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
}

.diff-column-body {
  padding: 10px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 45vh;
  overflow-y: auto;
}

.diff-column-body :deep(p) { margin: 0 0 6px; }
.diff-column-body :deep(pre) {
  background: var(--el-fill-color-darker);
  border-radius: 4px;
  padding: 6px;
  overflow-x: auto;
  font-size: 11px;
}
.diff-column-body :deep(code) {
  background: var(--el-fill-color);
  padding: 1px 2px;
  border-radius: 2px;
  font-size: 11px;
}
.diff-column-body :deep(pre code) {
  background: none;
  padding: 0;
}

.empty-text {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}
</style>
