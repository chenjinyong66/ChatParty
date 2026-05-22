/**
 * Agent/Skill 类型定义
 */

/** 智能体变量 */
export interface AgentVariable {
  name: string
  description: string
  defaultValue: string
  required: boolean
}

/** 智能体配置 */
export interface Agent {
  id: string
  name: string
  description: string
  icon: string
  /** 系统提示词前缀 */
  systemPrompt: string
  /** 适用模型（空=全部适用） */
  targetProviders: string[]
  /** 变量列表 */
  variables: AgentVariable[]
  /** 分类 */
  category: string
  /** 是否启用 */
  isEnabled: boolean
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** Skill拼接模式 */
export type SkillMode = 'prefix' | 'suffix' | 'wrap'

/** Skill配置（轻量级智能体） */
export interface Skill {
  id: string
  name: string
  /** 拼接模板，支持 {{user_input}} 变量 */
  template: string
  /** 拼接位置 */
  mode: SkillMode
  /** 适用模型（空=全部适用） */
  targetProviders: string[]
  /** 快捷键 */
  shortcut?: string
  /** 是否启用 */
  isEnabled: boolean
  /** 图标 */
  icon: string
  /** 描述 */
  description: string
}
