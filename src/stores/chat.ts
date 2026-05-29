import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AIProvider, Message, Session, CustomProviderConfig } from '../types'

/**
 * 聊天状态管理
 */
export const useChatStore = defineStore('chat', () => {
  // AI提供商列表
  const providers = ref<AIProvider[]>([
    {
      id: 'deepseek',
      name: 'DeepSeek',
      url: 'https://chat.deepseek.com',
      icon: './icons/deepseek.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-deepseek',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'doubao',
      name: '豆包',
      url: 'https://www.doubao.com',
      icon: './icons/doubao.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-doubao',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'qwen',
      name: '通义千问',
      url: 'https://qianwen.com',
      icon: './icons/qwen.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-qwen',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'kimi',
      name: 'Kimi',
      url: 'https://www.kimi.com/',
      icon: './icons/kimi.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-kimi',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'grok',
      name: 'Grok',
      url: 'https://grok.com/',
      icon: './icons/grok.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-grok',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'copilot',
      name: 'Copilot',
      url: 'https://copilot.microsoft.com',
      icon: './icons/copilot.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-copilot',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'glm',
      name: 'GLM',
      url: 'https://chatglm.cn/',
      icon: './icons/glm.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-glm',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'yuanbao',
      name: '元宝',
      url: 'https://yuanbao.tencent.com/chat',
      icon: './icons/yuanbao.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-yuanbao',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'miromind',
      name: 'MiroThinker',
      url: 'https://dr.miromind.ai/',
      icon: './icons/miromind.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-miromind',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'gemini',
      name: 'Gemini',
      url: 'https://gemini.google.com/',
      icon: './icons/gemini.svg',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-gemini',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      url: 'https://chatgpt.com/',
      icon: './icons/chatgpt.png',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-chatgpt',
      isEnabled: false,
      loadingState: 'idle',
      retryCount: 0
    },
    {
      id: 'mimo',
      name: 'mimo',
      url: 'https://aistudio.xiaomimimo.com/#/',
      icon: './icons/mimo.ico',
      isLoggedIn: false,
      sessionData: {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        isActive: false,
        lastActiveTime: new Date()
      },
      webviewId: 'webview-mimo',
      isEnabled: false,
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
  const loggedInProviders = computed(() => providers.value.filter((provider) => provider.isLoggedIn))

  const totalProviders = computed(() => providers.value.length)

  const loggedInCount = computed(() => loggedInProviders.value.length)

  /**
   * 加载所有提供商的代理配置
   */
  const loadProxyConfigs = (): void => {
    try {
      providers.value.forEach((provider) => {
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
    providers.value.forEach((provider) => {
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
    loadCustomProviders()
    providers.value.forEach((provider) => {
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
    const provider = providers.value.find((p) => p.id === providerId)
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
  const getProvider = (providerId: string): AIProvider | undefined => providers.value.find((p) => p.id === providerId)

  /**
   * 获取对话历史
   */
  const getConversation = (providerId: string): Message[] => conversations.value[providerId] || []

  /**
   * 更新提供商加载状态
   */
  const updateProviderLoadingState = (providerId: string, state: 'idle' | 'loading' | 'loaded' | 'error'): void => {
    const provider = providers.value.find((p) => p.id === providerId)
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
    const provider = providers.value.find((p) => p.id === providerId)
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
    const provider = providers.value.find((p) => p.id === providerId)
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
    const provider = providers.value.find((p) => p.id === providerId)
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
    const provider = providers.value.find((p) => p.id === providerId)
    if (provider) {
      provider.lastActiveTime = new Date()
      provider.sessionData.lastActiveTime = new Date()
    }
  }

  const customProviders = computed(() => providers.value.filter((p) => p.isCustom))
  const builtInProviders = computed(() => providers.value.filter((p) => !p.isCustom))

  const addCustomProvider = (config: {
    name: string
    url: string
    icon?: string
    customConfig?: Partial<CustomProviderConfig>
  }): AIProvider => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const defaultCustomConfig: CustomProviderConfig = {
      loginCheckScript: 'false',
      sendMessageScript: '',
      newChatScript: '',
      statusMonitorScript: '',
      fileUploadScript: ''
    }
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
      isCustom: true,
      customConfig: { ...defaultCustomConfig, ...config.customConfig }
    }
    providers.value.push(provider)
    saveCustomProviders()
    return provider
  }

  const removeCustomProvider = (providerId: string): boolean => {
    const index = providers.value.findIndex((p) => p.id === providerId && p.isCustom)
    if (index === -1) return false
    providers.value.splice(index, 1)
    selectedProviders.value = selectedProviders.value.filter((id) => id !== providerId)
    saveSelectedProviders()
    saveCustomProviders()
    return true
  }

  const updateCustomProvider = (providerId: string, updates: Partial<Pick<AIProvider, 'name' | 'url' | 'icon'>> & { customConfig?: Partial<CustomProviderConfig> }): boolean => {
    const provider = providers.value.find((p) => p.id === providerId && p.isCustom)
    if (!provider) return false
    if (updates.name) provider.name = updates.name
    if (updates.url) provider.url = updates.url
    if (updates.icon) provider.icon = updates.icon
    if (updates.customConfig && provider.customConfig) {
      provider.customConfig = { ...provider.customConfig, ...updates.customConfig }
    }
    saveCustomProviders()
    return true
  }

  const saveCustomProviders = (): void => {
    try {
      const customList = customProviders.value.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        icon: p.icon,
        isCustom: p.isCustom,
        customConfig: p.customConfig
      }))
      localStorage.setItem('custom-providers', JSON.stringify(customList))
    } catch (error) {
      console.error('Failed to save custom providers:', error)
    }
  }

  const loadCustomProviders = (): void => {
    try {
      const stored = localStorage.getItem('custom-providers')
      if (!stored) return
      const customList = JSON.parse(stored) as Array<{
        id: string
        name: string
        url: string
        icon: string
        isCustom: boolean
        customConfig: CustomProviderConfig
      }>
      const existingIds = new Set(providers.value.map((p) => p.id))
      for (const item of customList) {
        if (existingIds.has(item.id)) continue
        const provider: AIProvider = {
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
          isCustom: true,
          customConfig: item.customConfig
        }
        providers.value.push(provider)
      }
    } catch (error) {
      console.error('Failed to load custom providers:', error)
    }
  }

  return {
    providers,
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
