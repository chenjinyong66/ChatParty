/**
 * 评审功能类型定义
 */

/** 评审状态 */
export type ReviewStatus = 'idle' | 'collecting' | 'reviewing' | 'completed' | 'error'

/** 评审评分维度 */
export interface ReviewScore {
  accuracy: number      // 准确性 1-10
  completeness: number  // 完整性 1-10
  logic: number         // 逻辑性 1-10
  readability: number   // 可读性 1-10
  practicality: number  // 实用性 1-10
}

/** 单个模型的评审结果 */
export interface ModelReviewResult {
  providerId: string
  providerName: string
  originalContent: string
  scores: ReviewScore
  totalScore: number
  comments: string
  improvements: string
}

/** 评审结果 */
export interface ReviewResult {
  id: string
  originalQuery: string
  modelResults: ModelReviewResult[]
  bestModelId: string
  bestModelName: string
  bestReason: string
  reviewerId: string
  reviewerName: string
  reviewerContent: string
  timestamp: Date
  status: ReviewStatus
  error?: string
}

/** 评审配置 */
export interface ReviewConfig {
  /** 评审模型ID */
  reviewerProviderId: string
  /** 评审提示词模板 */
  promptTemplate: string
  /** 是否自动评审 */
  autoReview: boolean
  /** 自动评审延迟（毫秒） */
  autoReviewDelay: number
  /** 超时时间（毫秒） */
  timeout: number
}

/** 评审进度 */
export interface ReviewProgress {
  status: ReviewStatus
  collectedCount: number
  totalCount: number
  message: string
}
