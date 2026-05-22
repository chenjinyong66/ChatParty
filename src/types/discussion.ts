/**
 * 多模型对话讨论类型定义
 *
 * 实现模型间的顺序讨论：A回答 → B基于A的回答讨论 → C基于A和B讨论 → ...
 */

/** 讨论模式 */
export type DiscussionMode = 'sequential' | 'round-robin' | 'debate'

/** 讨论轮次中的一条发言 */
export interface DiscussionUtterance {
  /** 发言的模型ID */
  providerId: string
  /** 发言的模型名称 */
  providerName: string
  /** 发言内容 */
  content: string
  /** 发言序号 */
  order: number
  /** 时间戳 */
  timestamp: Date
  /** 是否成功获取 */
  success: boolean
  /** 错误信息 */
  error?: string
}

/** 讨论轮次 */
export interface DiscussionRound {
  /** 轮次号 */
  roundNumber: number
  /** 该轮次的发言列表 */
  utterances: DiscussionUtterance[]
  /** 轮次状态 */
  status: 'pending' | 'in_progress' | 'completed' | 'error'
}

/** 讨论配置 */
export interface DiscussionConfig {
  /** 讨论模式 */
  mode: DiscussionMode
  /** 参与讨论的模型ID列表（顺序决定发言顺序） */
  participantIds: string[]
  /** 讨论轮次数 */
  maxRounds: number
  /** 每轮等待回答的超时（毫秒） */
  responseTimeout: number
  /** 讨论提示词模板 */
  discussionPromptTemplate: string
  /** 是否自动开始下一轮 */
  autoContinue: boolean
  /** 轮次间延迟（毫秒） */
  roundDelay: number
}

/** 讨论会话 */
export interface DiscussionSession {
  /** 会话ID */
  id: string
  /** 原始问题 */
  originalQuery: string
  /** 讨论配置 */
  config: DiscussionConfig
  /** 所有轮次 */
  rounds: DiscussionRound[]
  /** 当前轮次号 */
  currentRound: number
  /** 当前发言者索引 */
  currentSpeakerIndex: number
  /** 会话状态 */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 错误信息 */
  error?: string
}

/** 讨论进度 */
export interface DiscussionProgress {
  status: DiscussionSession['status']
  currentRound: number
  maxRounds: number
  currentSpeaker: string
  message: string
}
