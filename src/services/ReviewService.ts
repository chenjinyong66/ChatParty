/**
 * AI评审服务 - 基于SummaryService扩展
 */

import type { AIProvider } from '../types'
import type { ReviewResult, ModelReviewResult } from '../types/review'
import { getSendMessageScript } from '../utils/GetLLMLastMessage'
import { generateReviewPrompt } from '../utils/ReviewPrompts'
import { useReviewStore } from '../stores/review'
import { ElMessage } from 'element-plus'

export class ReviewService {
  private static instance: ReviewService

  static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService()
    }
    return ReviewService.instance
  }

  /**
   * 执行评审流程
   */
  async executeReview(
    originalQuery: string,
    providers: AIProvider[],
    reviewerProviderId: string,
    promptTemplate?: string
  ): Promise<boolean> {
    const reviewStore = useReviewStore()

    if (!reviewStore.canStartReview) {
      ElMessage.warning('当前正在进行评审，请等待完成')
      return false
    }

    const reviewerProvider = providers.find(p => p.id === reviewerProviderId)
    if (!reviewerProvider) {
      ElMessage.error('未找到评审模型')
      return false
    }

    const targetProviders = providers.filter(p => p.isLoggedIn && p.id !== reviewerProviderId)
    if (targetProviders.length === 0) {
      ElMessage.warning('至少需要2个已登录的AI模型才能进行评审')
      return false
    }

    try {
      // 步骤1: 收集回答
      reviewStore.setProgress('collecting', '正在收集AI回答...', 0, targetProviders.length)

      const responses: { providerName: string; content: string; providerId: string }[] = []
      let collected = 0

      for (const provider of targetProviders) {
        try {
          const script = getSendMessageScript(provider.id)
          if (!script) continue

          const result = await Promise.race([
            window.electronAPI.executeScriptInWebView(provider.webviewId, script),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('超时')), 10000))
          ])

          const content = typeof result === 'string' ? result : (result?.result || '')
          if (content.trim()) {
            responses.push({ providerName: provider.name, content, providerId: provider.id })
          }
        } catch (error) {
          console.warn(`收集 ${provider.name} 回答失败:`, error)
        }
        collected++
        reviewStore.setProgress('collecting', `正在收集AI回答 (${collected}/${targetProviders.length})`, collected, targetProviders.length)
      }

      if (responses.length === 0) {
        reviewStore.setProgress('error', '未能获取任何AI的回答')
        ElMessage.error('未能获取任何AI的回答')
        return false
      }

      // 步骤2: 生成评审提示词
      reviewStore.setProgress('reviewing', '正在生成评审请求...')
      const prompt = generateReviewPrompt(originalQuery, responses, promptTemplate)

      // 步骤3: 发送评审请求
      const webviewId = `webview-${reviewerProviderId}`
      await window.electronAPI.sendMessageToWebView(webviewId, prompt)

      // 步骤4: 构建评审结果
      const reviewResult: ReviewResult = {
        id: `review_${Date.now()}`,
        originalQuery,
        modelResults: responses.map(r => ({
          providerId: r.providerId,
          providerName: r.providerName,
          originalContent: r.content,
          scores: { accuracy: 0, completeness: 0, logic: 0, readability: 0, practicality: 0 },
          totalScore: 0,
          comments: '',
          improvements: ''
        })),
        bestModelId: '',
        bestModelName: '',
        bestReason: '',
        reviewerId: reviewerProviderId,
        reviewerName: reviewerProvider.name,
        reviewerContent: '评审请求已发送，请在侧边栏查看评审模型的回答',
        timestamp: new Date(),
        status: 'completed'
      }

      reviewStore.setReviewResult(reviewResult)
      reviewStore.setProgress('completed', '评审请求已发送')
      ElMessage.success(`评审请求已发送到 ${reviewerProvider.name}，请在侧边栏查看`)

      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : '评审过程发生错误'
      reviewStore.setProgress('error', msg)
      ElMessage.error(msg)
      return false
    }
  }

  /**
   * 自动评审 - 在所有AI回答完成后触发
   */
  async autoReview(
    originalQuery: string,
    providers: AIProvider[],
    reviewerProviderId: string
  ): Promise<boolean> {
    const reviewStore = useReviewStore()
    if (!reviewStore.config.autoReview) return false

    // 延迟等待回答完成
    await this.delay(reviewStore.config.autoReviewDelay)

    return this.executeReview(originalQuery, providers, reviewerProviderId)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const reviewService = ReviewService.getInstance()
