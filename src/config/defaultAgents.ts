import type { Agent, Skill } from '../types/agent'

const now = new Date().toISOString()

/**
 * 预置智能体列表
 */
export const defaultAgents: Agent[] = [
  {
    id: 'code-expert',
    name: '代码专家',
    description: '资深软件工程师，擅长编写高质量代码',
    icon: 'Monitor',
    systemPrompt: '你是一个资深的软件工程师，擅长编写高质量、可维护的代码。请用专业但易懂的方式回答问题，并提供代码示例和最佳实践建议。',
    targetProviders: [],
    variables: [],
    category: '编程',
    isEnabled: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'translator',
    name: '翻译专家',
    description: '专业翻译，支持多语言互译',
    icon: 'Connection',
    systemPrompt: '你是一个专业的翻译专家，精通中英文互译。请准确翻译用户提供的文本，保持原文的语气和风格，必要时提供翻译说明。如果用户没有指定目标语言，默认翻译为中文。',
    targetProviders: [],
    variables: [
      { name: 'target_lang', description: '目标语言', defaultValue: '中文', required: true }
    ],
    category: '工具',
    isEnabled: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'reviewer',
    name: '评审专家',
    description: '对内容进行专业评审和打分',
    icon: 'DataAnalysis',
    systemPrompt: '你是一个专业的评审专家。请对用户提供的内容进行评审，从准确性、完整性、逻辑性、可读性四个维度进行评分（1-10分），并给出详细的改进建议。',
    targetProviders: [],
    variables: [],
    category: '评审',
    isEnabled: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'writer',
    name: '写作助手',
    description: '帮助润色和改进文章写作',
    icon: 'EditPen',
    systemPrompt: '你是一个专业的写作助手，擅长各类文体的写作和润色。请帮助用户改进文章的表达、结构和逻辑，使文章更加清晰、流畅、有说服力。',
    targetProviders: [],
    variables: [],
    category: '写作',
    isEnabled: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'data-analyst',
    name: '数据分析师',
    description: '数据分析和可视化专家',
    icon: 'TrendCharts',
    systemPrompt: '你是一个专业的数据分析师，擅长数据处理、统计分析和可视化。请帮助用户分析数据、解读趋势、提供数据驱动的建议，并给出相应的代码示例。',
    targetProviders: [],
    variables: [],
    category: '数据',
    isEnabled: true,
    createdAt: now,
    updatedAt: now
  }
]

/**
 * 预置Skill列表
 */
export const defaultSkills: Skill[] = [
  {
    id: 'chinese-reply',
    name: '中文回复',
    template: '请用中文回答以下问题：\n\n{{user_input}}',
    mode: 'wrap',
    targetProviders: [],
    isEnabled: true,
    icon: 'ChatDotRound',
    description: '要求AI用中文回答'
  },
  {
    id: 'step-by-step',
    name: '逐步分析',
    template: '请逐步分析以下问题，给出详细的推理过程：\n\n{{user_input}}',
    mode: 'wrap',
    targetProviders: [],
    isEnabled: true,
    icon: 'List',
    description: '要求AI逐步推理分析'
  },
  {
    id: 'code-only',
    name: '仅代码',
    template: '请只给出代码实现，不需要解释：\n\n{{user_input}}',
    mode: 'wrap',
    targetProviders: [],
    isEnabled: true,
    icon: 'Document',
    description: '只返回代码，不加解释'
  },
  {
    id: 'concise',
    name: '简洁回答',
    template: '请简洁回答，控制在200字以内：\n\n{{user_input}}',
    mode: 'wrap',
    targetProviders: [],
    isEnabled: true,
    icon: 'Minus',
    description: '要求AI简洁回答'
  }
]
