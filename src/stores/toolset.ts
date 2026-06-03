import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AIProvider, Message, Session } from '../types'

/**
 * 聊天状态管理
 */
export const useToolsetStore = defineStore('toolset', () => {
  // AI提供商列表
  const toolProviders = ref<AIProvider[]>([
    {
      id: 'ima',
      name: 'ima',
      url: 'https://ima.qq.com/',
      icon: './icons/ima.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-ima',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'xiazaitool',
      name: '下载狗',
      url: 'https://www.xiazaitool.com/',
      icon: './icons/xiazaigou.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-xiazaitool',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'smallpdf',
      name: 'smallpdf',
      url: 'https://smallpdf.com/cn#r=app',
      icon: './icons/smallpdf.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-smallpdf',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'MinerU',
      name: 'MinerU',
      url: 'https://mineru.net/OpenSourceTools/Extractor',
      icon: './icons/MinerU.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-MinerU',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'aibot',
      name: 'ai-bot',
      url: 'https://ai-bot.cn/',
      icon: './icons/ai-bot.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-aibot',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'tophub',
      name: '今日热榜',
      url: 'https://tophub.today/',
      icon: './icons/tophub.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-tophub',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'rebang',
      name: '热榜',
      url: 'https://rebang.today/',
      icon: './icons/rebang.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-rebang',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'coze',
      name: 'coze',
      url: 'https://www.coze.cn/space/7362708829798301759/library',
      icon: './icons/coze.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-coze',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'modelscope',
      name: 'modelscope',
      url: 'https://modelscope.cn/my/overview',
      icon: './icons/modelscope.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-modelscope',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'shuoqiudi',
      name: '说球帝',
      url: 'http://n.vip/',
      icon: './icons/shuoqiudi.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-shuoqiudi',
      isEnabled: true,
      loadingState: 'idle',
      retryCount: 0
    }
  ])

  // 当前输入的消息
  const currentMessage = ref<string>('')

  // 选中的提供商列表（用于排序）
  const selectedProviders = ref<string[]>([])

  // 对话历史记录
  const conversations = ref<Record<string, Message[]>>({})

  // 会话数据
  const sessions = ref<Record<string, Session>>({})

  // 消息发送状态
  const sendingStatus = ref<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({})

  // 计算属性
  const loggedInProviders = computed(() => toolProviders.value.filter((provider) => provider.isLoggedIn))

  const totalProviders = computed(() => toolProviders.value.length)

  const loggedInCount = computed(() => loggedInProviders.value.length)

  /**
   * 加载所有提供商的代理配置
   */
  const loadProxyConfigs = (): void => {
    try {
      toolProviders.value.forEach((provider) => {
        const storedConfig = localStorage.getItem(`proxy-config-${provider.id}`)
        if (storedConfig) {
          console.log(`Loaded proxy config for ${provider.name}:`, JSON.parse(storedConfig))
        }
      })
    } catch (error) {
      console.error('Failed to load proxy configs:', error)
    }
  }

  /**
   * 加载选中的提供商列表
   */
  const loadSelectedProviders = (): void => {
    try {
      const stored = localStorage.getItem('selected-providers')
      if (stored) {
        selectedProviders.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('加载选中的提供商失败:', error)
    }
  }

  /**
   * 保存选中的提供商列表
   */
  const saveSelectedProviders = (): void => {
    try {
      localStorage.setItem('selected-providers', JSON.stringify(selectedProviders.value))
    } catch (error) {
      console.error('保存选中的提供商失败:', error)
    }
  }

  /**
   * 更新选中的提供商列表
   */
  const updateSelectedProviders = (providers: string[]): void => {
    selectedProviders.value = providers
    saveSelectedProviders()
  }

  /**
   * 应用选中的提供商（启用选中的提供商）
   */
  const applySelectedProviders = (): void => {
    toolProviders.value.forEach((provider) => {
      const shouldEnable = selectedProviders.value.includes(provider.id)
      if (provider.isEnabled !== shouldEnable) {
        provider.isEnabled = shouldEnable
        if (shouldEnable) {
          provider.loadingState = 'loading'
        } else {
          provider.loadingState = 'idle'
        }
      }
    })
  }

  /**
   * 初始化对话历史
   */
  const initializeConversations = (): void => {
    toolProviders.value.forEach((provider) => {
      if (!conversations.value[provider.id]) {
        conversations.value[provider.id] = []
      }
      if (!sessions.value[provider.id]) {
        sessions.value[provider.id] = {
          providerId: provider.id,
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          isActive: false
        }
      }
      sendingStatus.value[provider.id] = 'idle'
    })
    // 加载代理配置
    loadProxyConfigs()
    // 加载选中的提供商列表
    loadSelectedProviders()
    // 应用选中的提供商（启用选中的提供商）
    applySelectedProviders()
  }

  /**
   * 添加消息到对话历史
   */
  const addMessage = (providerId: string, message: Message): void => {
    if (!conversations.value[providerId]) {
      conversations.value[providerId] = []
    }
    conversations.value[providerId].push(message)
  }

  /**
   * 更新提供商登录状态
   */
  const updateProviderLoginStatus = (providerId: string, isLoggedIn: boolean): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.isLoggedIn = isLoggedIn
    }
  }

  /**
   * 更新会话数据
   */
  const updateSession = (providerId: string, sessionData: Partial<Session>): void => {
    if (sessions.value[providerId]) {
      sessions.value[providerId] = { ...sessions.value[providerId], ...sessionData }
    }
  }

  /**
   * 设置消息发送状态
   */
  const setSendingStatus = (providerId: string, status: 'idle' | 'sending' | 'sent' | 'error'): void => {
    sendingStatus.value[providerId] = status
  }

  /**
   * 获取消息发送状态
   */
  const getSendingStatus = (providerId: string): 'idle' | 'sending' | 'sent' | 'error' => sendingStatus.value[providerId] || 'idle'

  /**
   * 检查是否有正在发送的消息
   */
  const hasSendingMessages = (): boolean => Object.values(sendingStatus.value).some((status) => status === 'sending')

  /**
   * 清空当前消息
   */
  const clearCurrentMessage = (): void => {
    currentMessage.value = ''
  }

  /**
   * 获取提供商信息
   */
  const getProvider = (providerId: string): AIProvider | undefined => toolProviders.value.find((p) => p.id === providerId)

  /**
   * 获取对话历史
   */
  const getConversation = (providerId: string): Message[] => conversations.value[providerId] || []

  /**
   * 更新提供商加载状态
   */
  const updateProviderLoadingState = (providerId: string, state: 'idle' | 'loading' | 'loaded' | 'error'): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.loadingState = state
      if (state === 'loaded') {
        provider.retryCount = 0
        provider.lastError = undefined
      }
    }
  }

  /**
   * 更新提供商错误信息
   */
  const updateProviderError = (providerId: string, error: string): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.loadingState = 'error'
      provider.lastError = error
      provider.retryCount = (provider.retryCount || 0) + 1
    }
  }

  /**
   * 启用/禁用提供商
   */
  const toggleProvider = (providerId: string, enabled: boolean): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.isEnabled = enabled
      if (enabled) {
        provider.loadingState = 'loading'
      } else {
        provider.loadingState = 'idle'
      }
    }
  }

  /**
   * 重置提供商状态
   */
  const resetProviderState = (providerId: string): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.loadingState = 'idle'
      provider.lastError = undefined
      provider.retryCount = 0
    }
  }

  /**
   * 更新提供商最后活跃时间
   */
  const updateProviderActiveTime = (providerId: string): void => {
    const provider = toolProviders.value.find((p) => p.id === providerId)
    if (provider) {
      provider.lastActiveTime = new Date()
      provider.sessionData.lastActiveTime = new Date()
    }
  }

  /**
   * 获取所有自定义提供商
   */
  const customProviders = computed(() => toolProviders.value.filter((p) => p.isCustom))

  /**
   * 获取内置提供商
   */
  const builtInProviders = computed(() => toolProviders.value.filter((p) => !p.isCustom))

  /**
   * 添加自定义工具网站
   */
  const addCustomProvider = (config: {
    name: string
    url: string
    icon?: string
  }): AIProvider => {
    const id = `custom-tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const provider: AIProvider = {
      id,
      name: config.name,
      url: config.url,
      icon: config.icon || './icons/default.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: `webview-${id}`,
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0,
      isCustom: true
    }
    toolProviders.value.push(provider)
    saveCustomProviders()
    return provider
  }

  /**
   * 删除自定义工具网站
   */
  const removeCustomProvider = (providerId: string): boolean => {
    const index = toolProviders.value.findIndex((p) => p.id === providerId && p.isCustom)
    if (index === -1) return false
    toolProviders.value.splice(index, 1)
    selectedProviders.value = selectedProviders.value.filter((id) => id !== providerId)
    saveSelectedProviders()
    saveCustomProviders()
    return true
  }

  /**
   * 更新自定义工具网站
   */
  const updateCustomProvider = (providerId: string, updates: {
    name?: string
    url?: string
    icon?: string
  }): boolean => {
    const provider = toolProviders.value.find((p) => p.id === providerId && p.isCustom)
    if (!provider) return false
    if (updates.name !== undefined) provider.name = updates.name
    if (updates.url !== undefined) provider.url = updates.url
    if (updates.icon !== undefined) provider.icon = updates.icon
    saveCustomProviders()
    return true
  }

  /**
   * 持久化自定义工具网站
   */
  const saveCustomProviders = (): void => {
    try {
      const customList = customProviders.value.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        icon: p.icon,
        isCustom: p.isCustom
      }))
      localStorage.setItem('custom-toolset-providers', JSON.stringify(customList))
    } catch (error) {
      console.error('Failed to save custom toolset providers:', error)
    }
  }

  /**
   * 加载持久化的自定义工具网站
   */
  const loadCustomProviders = (): void => {
    try {
      const stored = localStorage.getItem('custom-toolset-providers')
      if (stored) {
        const customList = JSON.parse(stored) as Array<{
          id: string
          name: string
          url: string
          icon?: string
        }>
        customList.forEach((item) => {
          // 避免重复加载
          if (!toolProviders.value.find((p) => p.id === item.id)) {
            toolProviders.value.push({
              id: item.id,
              name: item.name,
              url: item.url,
              icon: item.icon || './icons/default.svg',
              isLoggedIn: false,
              sessionData: {
                cookies: [],
                localStorage: {},
                sessionStorage: {},
                isActive: false,
                lastActiveTime: new Date()
              },
              webviewId: `webview-${item.id}`,
              isEnabled: false,
              loadingState: 'idle',
              retryCount: 0,
              isCustom: true
            })
          }
        })
      }
    } catch (error) {
      console.error('Failed to load custom toolset providers:', error)
    }
  }

  return {
    providers: toolProviders,
    toolProviders,
    currentMessage,
    selectedProviders,
    conversations,
    sessions,
    sendingStatus,
    loggedInProviders,
    totalProviders,
    loggedInCount,
    customProviders,
    builtInProviders,
    initializeConversations,
    addMessage,
    updateProviderLoginStatus,
    updateSession,
    setSendingStatus,
    getSendingStatus,
    hasSendingMessages,
    clearCurrentMessage,
    getProvider,
    getConversation,
    loadSelectedProviders,
    saveSelectedProviders,
    updateSelectedProviders,
    applySelectedProviders,
    updateProviderLoadingState,
    updateProviderError,
    toggleProvider,
    resetProviderState,
    updateProviderActiveTime,
    addCustomProvider,
    removeCustomProvider,
    updateCustomProvider,
    saveCustomProviders,
    loadCustomProviders
  }
})
