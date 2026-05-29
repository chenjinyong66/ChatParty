<template>
  <div class="session-status">
    <div class="session-header">
      <h3>登录状态</h3>
      <el-button
        size="small"
        :loading="isRefreshing"
        @click="refreshAllSessions"
      >
        刷新状态
      </el-button>
    </div>

    <div class="session-list">
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="session-item"
        :class="{ 'logged-in': sessionStates[provider.id] }"
      >
        <div class="provider-info">
          <img
            :src="provider.icon"
            :alt="provider.name"
            class="provider-icon"
          >
          <span class="provider-name">{{ provider.name }}</span>
        </div>

        <div class="session-actions">
          <el-tag
            :type="sessionStates[provider.id] ? 'success' : 'info'"
            size="small"
          >
            {{ sessionStates[provider.id] ? '已登录' : '未登录' }}
          </el-tag>

          <el-button-group size="small">
            <el-button
              :loading="loadingStates[provider.id]"
              @click="checkSingleSession(provider.id)"
            >
              检查
            </el-button>

            <el-button
              v-if="sessionStates[provider.id]"
              :loading="savingStates[provider.id]"
              @click="saveSession(provider.id)"
            >
              保存
            </el-button>

            <el-button
              type="danger"
              :loading="clearingStates[provider.id]"
              @click="clearSession(provider.id)"
            >
              清除
            </el-button>
          </el-button-group>
        </div>
      </div>
    </div>

    <div class="session-summary">
      <el-statistic
        title="已登录网站"
        :value="loggedInCount"
        :total="totalCount"
        :suffix="`/ ${totalCount}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import type { AIProvider } from '../../types'
import { useChatStore } from '../../stores'

interface Props {
  providers: AIProvider[]
}

const props = defineProps<Props>()

const chatStore = useChatStore()

const isRefreshing = ref(false)
const loadingStates = ref<Record<string, boolean>>({})
const savingStates = ref<Record<string, boolean>>({})
const clearingStates = ref<Record<string, boolean>>({})
const sessionStates = ref<Record<string, boolean>>({})

const loggedInCount = computed(() => Object.values(sessionStates.value).filter((state) => state).length)
const totalCount = computed(() => props.providers.length)

const checkSessionSilent = async(providerId: string): Promise<boolean> => {
  if (!window.electronAPI) return false

  loadingStates.value[providerId] = true

  try {
    const loadResponse = await window.electronAPI.loadSession({ providerId })

    if (loadResponse.exists && loadResponse.sessionData) {
      sessionStates.value[providerId] = true
      return true
    } else {
      sessionStates.value[providerId] = false
      return false
    }
  } catch (error) {
    console.error(`Failed to check session for ${providerId}:`, error)
    sessionStates.value[providerId] = false
    return false
  } finally {
    loadingStates.value[providerId] = false
  }
}

const checkSingleSession = async(providerId: string): Promise<void> => {
  const isLoggedIn = await checkSessionSilent(providerId)
  const name = getProviderName(providerId)
  if (isLoggedIn) {
    ElMessage.success(`${name} 会话有效`)
  } else {
    ElMessage.info(`${name} 未登录`)
  }
}

const saveSession = async(providerId: string): Promise<void> => {
  if (!window.electronAPI) return

  savingStates.value[providerId] = true

  try {
    const response = await window.electronAPI.saveSession({ providerId })

    if (response.success) {
      ElMessage.success(`${getProviderName(providerId)} 会话已保存`)
    } else {
      ElMessage.error(`保存 ${getProviderName(providerId)} 会话失败`)
    }
  } catch (error) {
    console.error(`Failed to save session for ${providerId}:`, error)
    ElMessage.error(`保存 ${getProviderName(providerId)} 会话失败`)
  } finally {
    savingStates.value[providerId] = false
  }
}

const clearSession = async(providerId: string): Promise<void> => {
  if (!window.electronAPI) return

  clearingStates.value[providerId] = true

  try {
    const response = await window.electronAPI.clearSession({ providerId })

    if (response.success) {
      sessionStates.value[providerId] = false
      ElMessage.success(`${getProviderName(providerId)} 会话已清除`)
    } else {
      ElMessage.error(`清除 ${getProviderName(providerId)} 会话失败`)
    }
  } catch (error) {
    console.error(`Failed to clear session for ${providerId}:`, error)
    ElMessage.error(`清除 ${getProviderName(providerId)} 会话失败`)
  } finally {
    clearingStates.value[providerId] = false
  }
}

const refreshAllSessions = async(): Promise<void> => {
  isRefreshing.value = true

  try {
    const results = await Promise.allSettled(
      props.providers.map((provider) => checkSessionSilent(provider.id))
    )

    const loggedIn = props.providers.filter(
      (p, i) => results[i].status === 'fulfilled' && results[i].value
    )
    const notLoggedIn = props.providers.filter(
      (p, i) => results[i].status === 'fulfilled' && !results[i].value
    )
    const failed = props.providers.filter(
      (p, i) => results[i].status === 'rejected'
    )

    const lines: string[] = []
    if (loggedIn.length > 0) {
      lines.push(`<div style="color:var(--el-color-success);margin:4px 0">✅ 已登录 (${loggedIn.length}): ${loggedIn.map((p) => p.name).join('、')}</div>`)
    }
    if (notLoggedIn.length > 0) {
      lines.push(`<div style="color:var(--el-color-info);margin:4px 0">⚪ 未登录 (${notLoggedIn.length}): ${notLoggedIn.map((p) => p.name).join('、')}</div>`)
    }
    if (failed.length > 0) {
      lines.push(`<div style="color:var(--el-color-danger);margin:4px 0">❌ 检测失败 (${failed.length}): ${failed.map((p) => p.name).join('、')}</div>`)
    }

    ElNotification({
      title: `状态刷新完成 — ${loggedIn.length}/${props.providers.length} 已登录`,
      dangerouslyUseHTMLString: true,
      message: lines.join(''),
      type: failed.length > 0 ? 'warning' : 'success',
      duration: 5000,
      position: 'top-right'
    })
  } catch (error) {
    console.error('Failed to refresh all sessions:', error)
    ElMessage.error('刷新会话状态失败')
  } finally {
    isRefreshing.value = false
  }
}

const getProviderName = (providerId: string): string => {
  const provider = props.providers.find((p) => p.id === providerId)
  return provider?.name || providerId
}

const initializeStates = (): void => {
  props.providers.forEach((provider) => {
    loadingStates.value[provider.id] = false
    savingStates.value[provider.id] = false
    clearingStates.value[provider.id] = false
    sessionStates.value[provider.id] = false
  })
}

onMounted(() => {
  initializeStates()
})
</script>

<style scoped>
.session-status {
  padding: 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.session-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.session-item:hover {
  border-color: var(--el-border-color);
}

.session-item.logged-in {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.provider-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-summary {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

:deep(.el-statistic__content) {
  font-size: 18px;
}

:deep(.el-statistic__number) {
  color: var(--el-color-primary);
}
</style>
