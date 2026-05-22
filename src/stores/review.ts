import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ReviewResult, ReviewConfig, ReviewProgress, ReviewStatus } from '../types/review'

/**
 * 评审状态管理
 */
export const useReviewStore = defineStore('review', () => {
  const currentResult = ref<ReviewResult | null>(null)
  const progress = ref<ReviewProgress>({
    status: 'idle',
    collectedCount: 0,
    totalCount: 0,
    message: ''
  })
  const config = ref<ReviewConfig>({
    reviewerProviderId: '',
    promptTemplate: '',
    autoReview: false,
    autoReviewDelay: 5000,
    timeout: 60000
  })
  const history = ref<ReviewResult[]>([])

  const isReviewing = computed(() =>
    progress.value.status === 'collecting' || progress.value.status === 'reviewing'
  )
  const canStartReview = computed(() =>
    progress.value.status === 'idle' || progress.value.status === 'completed' || progress.value.status === 'error'
  )

  function setProgress(status: ReviewStatus, message: string, collected = 0, total = 0) {
    progress.value = { status, collectedCount: collected, totalCount: total, message }
  }

  function setReviewResult(result: ReviewResult) {
    currentResult.value = result
    history.value.unshift(result)
    if (history.value.length > 20) {
      history.value = history.value.slice(0, 20)
    }
  }

  function clearReview() {
    currentResult.value = null
    progress.value = { status: 'idle', collectedCount: 0, totalCount: 0, message: '' }
  }

  function updateConfig(newConfig: Partial<ReviewConfig>) {
    config.value = { ...config.value, ...newConfig }
    try {
      localStorage.setItem('review-config', JSON.stringify(config.value))
    } catch { /* ignore */ }
  }

  function loadConfig() {
    try {
      const stored = localStorage.getItem('review-config')
      if (stored) {
        config.value = { ...config.value, ...JSON.parse(stored) }
      }
    } catch { /* ignore */ }
  }

  loadConfig()

  return {
    currentResult,
    progress,
    config,
    history,
    isReviewing,
    canStartReview,
    setProgress,
    setReviewResult,
    clearReview,
    updateConfig,
    loadConfig
  }
})
