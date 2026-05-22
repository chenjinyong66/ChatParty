import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DiscussionSession, DiscussionConfig, DiscussionProgress, DiscussionRound, DiscussionUtterance } from '../types/discussion'

/**
 * 多模型对话讨论状态管理
 */
export const useDiscussionStore = defineStore('discussion', () => {
  const session = ref<DiscussionSession | null>(null)
  const progress = ref<DiscussionProgress>({
    status: 'idle',
    currentRound: 0,
    maxRounds: 0,
    currentSpeaker: '',
    message: ''
  })
  const config = ref<DiscussionConfig>({
    mode: 'sequential',
    participantIds: [],
    maxRounds: 2,
    responseTimeout: 60000,
    discussionPromptTemplate: '',
    autoContinue: true,
    roundDelay: 3000
  })

  const isRunning = computed(() => session.value?.status === 'running')
  const allUtterances = computed(() => {
    if (!session.value) return []
    return session.value.rounds.flatMap(r => r.utterances)
  })

  function setProgress(message: string) {
    if (!session.value) return
    progress.value = {
      status: session.value.status,
      currentRound: session.value.currentRound,
      maxRounds: session.value.config.maxRounds,
      currentSpeaker: session.value.config.participantIds[session.value.currentSpeakerIndex] || '',
      message
    }
  }

  function initSession(originalQuery: string, participantIds: string[], customConfig?: Partial<DiscussionConfig>) {
    const finalConfig = { ...config.value, ...customConfig, participantIds }
    session.value = {
      id: `discussion_${Date.now()}`,
      originalQuery,
      config: finalConfig,
      rounds: [],
      currentRound: 0,
      currentSpeakerIndex: 0,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setProgress('讨论已初始化')
  }

  function addUtterance(utterance: DiscussionUtterance) {
    if (!session.value) return
    let currentRound = session.value.rounds[session.value.currentRound - 1]
    if (!currentRound) {
      currentRound = {
        roundNumber: session.value.currentRound,
        utterances: [],
        status: 'in_progress'
      }
      session.value.rounds.push(currentRound)
    }
    currentRound.utterances.push(utterance)
    session.value.updatedAt = new Date()
  }

  function setSessionStatus(status: DiscussionSession['status'], error?: string) {
    if (!session.value) return
    session.value.status = status
    if (error) session.value.error = error
    session.value.updatedAt = new Date()
    setProgress(status === 'running' ? '讨论进行中...' : status === 'completed' ? '讨论已完成' : status === 'error' ? `错误: ${error}` : '讨论已暂停')
  }

  function clearSession() {
    session.value = null
    progress.value = { status: 'idle', currentRound: 0, maxRounds: 0, currentSpeaker: '', message: '' }
  }

  function updateConfig(newConfig: Partial<DiscussionConfig>) {
    config.value = { ...config.value, ...newConfig }
    try {
      localStorage.setItem('discussion-config', JSON.stringify(config.value))
    } catch { /* ignore */ }
  }

  function loadConfig() {
    try {
      const stored = localStorage.getItem('discussion-config')
      if (stored) {
        config.value = { ...config.value, ...JSON.parse(stored) }
      }
    } catch { /* ignore */ }
  }

  loadConfig()

  return {
    session,
    progress,
    config,
    isRunning,
    allUtterances,
    setProgress,
    initSession,
    addUtterance,
    setSessionStatus,
    clearSession,
    updateConfig,
    loadConfig
  }
})
