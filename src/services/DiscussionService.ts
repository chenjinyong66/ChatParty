/**
 * 多模型对话讨论服务
 *
 * 核心流程：
 * 1. 用户提出问题
 * 2. 第一个模型回答问题
 * 3. 提取第一个模型的回答
 * 4. 将回答拼接讨论提示词，发送给第二个模型
 * 5. 第二个模型基于第一个模型的回答进行讨论
 * 6. 依此类推，直到所有模型发言完毕或达到最大轮次
 */

import type { AIProvider } from '../types'
import type { DiscussionUtterance, DiscussionMode } from '../types/discussion'
import { getSendMessageScript } from '../utils/GetLLMLastMessage'
import { generateDiscussionPrompt } from '../utils/DiscussionPrompts'
import { useDiscussionStore } from '../stores/discussion'
import { useChatStore } from '../stores'
import { ElMessage } from 'element-plus'

export class DiscussionService {
  private static instance: DiscussionService
  private abortFlag = false

  static getInstance(): DiscussionService {
    if (!DiscussionService.instance) {
      DiscussionService.instance = new DiscussionService()
    }
    return DiscussionService.instance
  }

  /**
   * 启动多模型讨论
   */
  async startDiscussion(
    originalQuery: string,
    participantProviders: AIProvider[],
    mode: DiscussionMode = 'sequential',
    maxRounds: number = 2
  ): Promise<boolean> {
    const discussionStore = useDiscussionStore()

    if (discussionStore.isRunning) {
      ElMessage.warning('已有讨论正在进行中')
      return false
    }

    if (participantProviders.length < 2) {
      ElMessage.warning('至少需要2个已登录的AI模型才能进行讨论')
      return false
    }

    this.abortFlag = false

    // 初始化讨论会话
    discussionStore.initSession(originalQuery, participantProviders.map(p => p.id), {
      mode,
      maxRounds,
      participantIds: participantProviders.map(p => p.id)
    })

    discussionStore.setSessionStatus('running')
    discussionStore.setProgress('讨论开始...')

    try {
      // 收集所有历史发言，用于拼接上下文
      const allUtterances: { providerName: string; content: string }[] = []

      for (let round = 1; round <= maxRounds; round++) {
        if (this.abortFlag) {
          discussionStore.setSessionStatus('paused', '用户中止了讨论')
          return false
        }

        discussionStore.session!.currentRound = round
        discussionStore.setProgress(`第 ${round}/${maxRounds} 轮讨论`)

        // 在每一轮中，每个参与者依次发言
        for (let speakerIndex = 0; speakerIndex < participantProviders.length; speakerIndex++) {
          if (this.abortFlag) {
            discussionStore.setSessionStatus('paused', '用户中止了讨论')
            return false
          }

          const provider = participantProviders[speakerIndex]
          discussionStore.session!.currentSpeakerIndex = speakerIndex
          discussionStore.setProgress(`第 ${round} 轮 - 等待 ${provider.name} 发言...`)

          // 生成讨论提示词
          const prompt = generateDiscussionPrompt(originalQuery, allUtterances, mode)

          // 发送消息到当前模型
          const sendSuccess = await this.sendToProvider(provider, prompt)
          if (!sendSuccess) {
            const utterance: DiscussionUtterance = {
              providerId: provider.id,
              providerName: provider.name,
              content: '[发送失败]',
              order: allUtterances.length + 1,
              timestamp: new Date(),
              success: false,
              error: '消息发送失败'
            }
            discussionStore.addUtterance(utterance)
            continue
          }

          // 等待模型回答完成并提取内容
          discussionStore.setProgress(`第 ${round} 轮 - ${provider.name} 正在思考...`)
          const responseContent = await this.waitForResponse(provider)

          // 记录发言
          const utterance: DiscussionUtterance = {
            providerId: provider.id,
            providerName: provider.name,
            content: responseContent,
            order: allUtterances.length + 1,
            timestamp: new Date(),
            success: !!responseContent && !responseContent.startsWith('[')
          }
          discussionStore.addUtterance(utterance)

          if (responseContent && !responseContent.startsWith('[')) {
            allUtterances.push({
              providerName: provider.name,
              content: responseContent
            })
          }

          // 轮次间延迟
          if (discussionStore.config.autoContinue) {
            await this.delay(1000)
          }
        }

        // 轮次间延迟
        if (round < maxRounds) {
          discussionStore.setProgress(`第 ${round} 轮完成，准备下一轮...`)
          await this.delay(discussionStore.config.roundDelay)
        }
      }

      discussionStore.setSessionStatus('completed')
      discussionStore.setProgress('讨论已完成！')
      ElMessage.success('多模型讨论已完成！')
      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : '讨论过程发生错误'
      discussionStore.setSessionStatus('error', msg)
      ElMessage.error(msg)
      return false
    }
  }

  /**
   * 停止讨论
   */
  stopDiscussion() {
    this.abortFlag = true
    const discussionStore = useDiscussionStore()
    discussionStore.setSessionStatus('paused', '用户手动停止')
    ElMessage.info('讨论已停止')
  }

  /**
   * 发送消息到指定模型
   */
  private async sendToProvider(provider: AIProvider, message: string): Promise<boolean> {
    try {
      if (!window.electronAPI) return false

      await window.electronAPI.sendMessageToWebView(provider.webviewId, message)
      console.log(`[Discussion] 消息已发送到 ${provider.name} (webviewId: ${provider.webviewId})`)
      return true
    } catch (error) {
      console.error(`[Discussion] 发送消息到 ${provider.name} 失败:`, error)
      return false
    }
  }

  /**
   * 等待模型回答完成并提取内容
   *
   * 策略：
   * 1. 先等待AI开始回答（8秒初始延迟）
   * 2. 轮询检查AI状态（通过StatusMonitor）
   * 3. AI回答完成后，提取内容
   * 4. 如果状态检测不可用，则轮询尝试提取内容
   */
  private async waitForResponse(provider: AIProvider): Promise<string> {
    const timeout = 120000 // 120秒总超时
    const startTime = Date.now()

    // 阶段1：等待AI开始回答（给WebView处理时间）
    console.log(`[Discussion] 等待 ${provider.name} 开始回答...`)
    await this.delay(8000)

    // 阶段2：轮询等待AI回答完成
    console.log(`[Discussion] 开始轮询 ${provider.name} 的回答状态...`)
    let aiCompleted = false
    const statusCheckInterval = 3000 // 每3秒检查一次状态

    while (Date.now() - startTime < timeout) {
      if (this.abortFlag) return ''

      // 尝试通过状态监控检测AI是否完成回答
      const statusResult = await this.checkAIStatus(provider)
      console.log(`[Discussion] ${provider.name} 状态: ${statusResult}`)

      if (statusResult === 'ai_completed' || statusResult === 'waiting_input') {
        aiCompleted = true
        break
      }

      await this.delay(statusCheckInterval)
    }

    if (!aiCompleted && !this.abortFlag) {
      console.warn(`[Discussion] ${provider.name} 状态检测超时，尝试直接提取内容`)
    }

    // 阶段3：AI回答完成，提取内容
    console.log(`[Discussion] 尝试从 ${provider.name} 提取回答内容...`)
    const content = await this.extractResponse(provider)

    if (content) {
      console.log(`[Discussion] 从 ${provider.name} 提取到回答 (${content.length} 字)`)
      return content
    }

    // 阶段4：如果首次提取失败，多次重试
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.abortFlag) return ''

      console.log(`[Discussion] 重试提取 ${provider.name} 的回答 (${attempt + 1}/3)...`)
      await this.delay(3000)

      const retryContent = await this.extractResponse(provider)
      if (retryContent) {
        console.log(`[Discussion] 重试成功，从 ${provider.name} 提取到回答 (${retryContent.length} 字)`)
        return retryContent
      }
    }

    console.warn(`[Discussion] 从 ${provider.name} 提取回答失败`)
    return '[内容提取失败，请查看该模型的对话窗口]'
  }

  /**
   * 检查AI状态
   * 通过执行状态监控脚本检测AI是否完成回答
   */
  private async checkAIStatus(provider: AIProvider): Promise<string> {
    try {
      if (!window.electronAPI) return 'unknown'

      // 使用StatusMonitor脚本检测状态
      const { getStatusMonitorScript } = await import('../utils/StatusMonitorScripts')
      const script = getStatusMonitorScript(provider.id)
      if (!script) return 'unknown'

      const result = await window.electronAPI.executeScriptInWebView(provider.webviewId, script)

      if (typeof result === 'string') {
        return result
      }
      if (result && typeof result === 'object') {
        return result.result || result.status || 'unknown'
      }

      return 'unknown'
    } catch (error) {
      // 状态检测失败不影响主流程
      return 'unknown'
    }
  }

  /**
   * 提取AI回答内容
   */
  private async extractResponse(provider: AIProvider): Promise<string> {
    try {
      if (!window.electronAPI) return ''

      const script = getSendMessageScript(provider.id)
      if (!script) {
        console.warn(`[Discussion] ${provider.name} 没有内容提取脚本`)
        return ''
      }

      console.log(`[Discussion] 在 ${provider.name} (webviewId: ${provider.webviewId}) 中执行提取脚本`)

      const result = await Promise.race([
        window.electronAPI.executeScriptInWebView(provider.webviewId, script),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('提取脚本执行超时')), 15000)
        )
      ])

      // 解析结果
      let content = ''
      if (typeof result === 'string') {
        content = result
      } else if (result && typeof result === 'object') {
        content = result.result || result.content || result.data || ''
        if (typeof content !== 'string') {
          content = String(content)
        }
      }

      content = content.trim()

      // 验证内容有效性（太短可能是提取到了错误的内容）
      if (content.length < 10) {
        console.log(`[Discussion] ${provider.name} 提取内容太短 (${content.length} 字): "${content.substring(0, 50)}"`)
        return ''
      }

      return content
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`[Discussion] 提取 ${provider.name} 回答失败:`, errMsg)
      return ''
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const discussionService = DiscussionService.getInstance()
