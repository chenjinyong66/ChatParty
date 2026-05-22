

## 一、项目现有架构分析

### 1.1 核心消息流

```
用户输入 (UnifiedInput.vue)
    ↓ currentMessage
MessageDispatcher.sendMessage(content, providers)
    ↓ 遍历每个provider
sendToProvider(provider, message)
    ↓ window.electronAPI.sendMessageToWebView(webviewId, message)
IPC → 主进程 → WebView
    ↓ executeJavaScript
MessageScripts.getSendMessageScript(providerId, message)
    ↓ 拼接成脚本字符串
WebView内执行：找到输入框 → 填入消息 → 模拟Enter/点击发送
```

### 1.2 关键文件清单

| 文件 | 职责 | 扩展点 |
|------|------|--------|
| `src/components/chat/UnifiedInput.vue` | 统一输入组件 | 消息发送前的拦截/修改 |
| `src/services/MessageDispatcher.ts` | 消息分发器 | 消息内容转换/拼接 |
| `src/utils/MessageScripts.ts` | 各平台发送脚本 | 消息内容注入点 |
| `src/utils/StatusMonitorScripts.ts` | AI回复状态监控 | 回复内容提取 |
| `src/components/chat/PromptManager.vue` | Prompt管理器 | 已有模板+变量替换机制 |
| `src/types/index.ts` | 类型定义 | 新增智能体/评审类型 |
| `electron/preload.ts` | IPC桥接 | 新增内容提取API |

### 1.3 现有能力评估

| 能力 | 状态 | 说明 |
|------|------|------|
| 消息发送 | ✅ 已有 | 支持并发发送到多个AI |
| 消息内容拼接 | ⚠️ 部分 | PromptManager支持`{{user_input}}`变量替换 |
| AI回复状态检测 | ✅ 已有 | `waiting_input` / `ai_responding` / `ai_completed` |
| AI回复内容提取 | ❌ 缺失 | 只检测状态，不提取内容 |
| 跨模型消息转发 | ❌ 缺失 | 无自动转发机制 |
| 智能体/Skill系统 | ❌ 缺失 | 无智能体概念 |

---

## 二、功能一：智能体/Skill 前缀拼接

### 2.1 需求描述

在用户发送聊天内容之前，根据选中的智能体/Skill，自动在消息前面拼接预设的系统提示词或角色设定，然后发送给对应的AI模型。

**示例**：
```
用户输入: "帮我写一个排序算法"
选中智能体: "代码专家"
实际发送: "你是一个资深的软件工程师，擅长编写高质量代码。请用专业但易懂的方式回答问题。\n\n帮我写一个排序算法"
```

### 2.2 可行性分析

#### ✅ 完全可行

**理由**：

1. **消息发送链路清晰**：`UnifiedInput.handleSend()` → `MessageDispatcher.sendMessage()` → `sendToProvider()`，在任意环节都可以拦截和修改消息内容

2. **已有类似机制**：`PromptManager` 已经实现了模板+变量替换（`{{user_input}}`），智能体系统可以复用这套机制

3. **脚本注入点明确**：`MessageScripts.getSendMessageScript(providerId, message)` 中的 `message` 参数就是最终发送的文本，只需在调用前修改即可

4. **架构改动小**：核心逻辑不需要修改WebView或IPC，只在渲染进程的消息处理层增加一个中间件

### 2.3 技术方案

#### 方案架构

```
用户输入: "帮我写一个排序算法"
    ↓
智能体拦截器 (新增)
    ↓ 根据选中的智能体拼接前缀
拼接后: "[代码专家角色设定]\n\n帮我写一个排序算法"
    ↓
MessageDispatcher.sendMessage()
    ↓
各平台发送脚本执行
```

#### 数据模型设计

```typescript
// src/types/agent.ts

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

/** 智能体变量 */
export interface AgentVariable {
  name: string        // 如 {{language}}, {{style}}
  description: string
  defaultValue: string
  required: boolean
}

/** Skill配置（轻量级智能体） */
export interface Skill {
  id: string
  name: string
  /** 拼接模板，支持 {{user_input}} 变量 */
  template: string
  /** 拼接位置: prefix=前缀, suffix=后缀, replace=替换 */
  mode: 'prefix' | 'suffix' | 'wrap' | 'replace'
  /** 适用模型 */
  targetProviders: string[]
  /** 快捷键 */
  shortcut?: string
  isEnabled: boolean
}
```

#### 核心实现

**1. 消息拦截器 - 在 MessageDispatcher 中增加**

```typescript
// src/services/MessageDispatcher.ts - 扩展

export class MessageDispatcher extends BrowserEventEmitter {
  private agent: Agent | null = null
  private activeSkills: Skill[] = []

  /** 设置当前智能体 */
  setActiveAgent(agent: Agent | null): void {
    this.agent = agent
  }

  /** 添加/移除Skill */
  toggleSkill(skill: Skill, enabled: boolean): void {
    if (enabled) {
      this.activeSkills.push(skill)
    } else {
      this.activeSkills = this.activeSkills.filter(s => s.id !== skill.id)
    }
  }

  /** 消息内容转换 */
  private transformMessage(content: string, providerId: string): string {
    let result = content

    // 1. 应用智能体前缀
    if (this.agent) {
      const shouldApply = this.agent.targetProviders.length === 0 
        || this.agent.targetProviders.includes(providerId)
      if (shouldApply) {
        let systemPrompt = this.agent.systemPrompt
        // 替换智能体变量
        this.agent.variables.forEach(v => {
          systemPrompt = systemPrompt.replace(
            new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), 
            v.defaultValue
          )
        })
        result = `${systemPrompt}\n\n${result}`
      }
    }

    // 2. 应用Skills
    this.activeSkills.forEach(skill => {
      const shouldApply = skill.targetProviders.length === 0 
        || skill.targetProviders.includes(providerId)
      if (shouldApply) {
        switch (skill.mode) {
          case 'prefix':
            result = skill.template.replace('{{user_input}}', result)
            break
          case 'suffix':
            result = result + '\n\n' + skill.template.replace('{{user_input}}', result)
            break
          case 'wrap':
            result = skill.template.replace('{{user_input}}', result)
            break
          case 'replace':
            result = skill.template.replace('{{user_input}}', result)
            break
        }
      }
    })

    return result
  }

  // 修改现有的 sendToProvider 方法
  private async sendToProvider(provider: AIProvider, message: Message): Promise<MessageSendResult> {
    // 关键修改：在发送前转换消息内容
    const transformedContent = this.transformMessage(message.content, provider.id)
    const transformedMessage = { ...message, content: transformedContent }
    
    // ... 后续逻辑不变，使用 transformedMessage
  }
}
```

**2. 智能体管理UI - 复用PromptManager的设计**

```vue
<!-- src/components/chat/AgentSelector.vue -->
<template>
  <div class="agent-selector">
    <el-dropdown trigger="click" @command="handleSelectAgent">
      <el-button :type="activeAgent ? 'warning' : 'info'" size="small">
        <el-icon><MagicStick /></el-icon>
        {{ activeAgent ? activeAgent.name : '选择智能体' }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="">无智能体</el-dropdown-item>
          <el-dropdown-item 
            v-for="agent in agents" 
            :key="agent.id" 
            :command="agent.id"
          >
            <img :src="agent.icon" class="agent-icon" />
            {{ agent.name }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
```

**3. 预置智能体配置**

```typescript
// src/config/defaultAgents.ts
export const defaultAgents: Agent[] = [
  {
    id: 'code-expert',
    name: '代码专家',
    description: '资深软件工程师，擅长编写高质量代码',
    icon: '/icons/agents/code.svg',
    systemPrompt: '你是一个资深的软件工程师，擅长编写高质量、可维护的代码。请用专业但易懂的方式回答问题，并提供代码示例和最佳实践建议。',
    targetProviders: [],  // 所有模型
    variables: [],
    category: '编程',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'translator',
    name: '翻译专家',
    description: '专业翻译，支持多语言互译',
    icon: '/icons/agents/translate.svg',
    systemPrompt: '你是一个专业的翻译专家，精通中英文互译。请准确翻译用户提供的文本，保持原文的语气和风格，必要时提供翻译说明。',
    targetProviders: [],
    variables: [
      { name: 'target_lang', description: '目标语言', defaultValue: '中文', required: true }
    ],
    category: '工具',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'reviewer',
    name: '评审专家',
    description: '对AI回答进行专业评审',
    icon: '/icons/agents/review.svg',
    systemPrompt: '你是一个专业的评审专家。请对以下AI回答进行评审，从准确性、完整性、逻辑性、可读性四个维度进行评分（1-10分），并给出改进建议。',
    targetProviders: [],
    variables: [],
    category: '评审',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]
```

### 2.4 改动量评估

| 模块 | 改动内容 | 工作量 |
|------|---------|--------|
| `types/index.ts` | 新增Agent/Skill类型 | 小 |
| `services/MessageDispatcher.ts` | 增加消息转换逻辑 | 中 |
| `components/chat/AgentSelector.vue` | 新建智能体选择器 | 中 |
| `components/chat/SkillBar.vue` | 新建Skill快捷栏 | 中 |
| `config/defaultAgents.ts` | 预置智能体配置 | 小 |
| `stores/agent.ts` | 智能体状态管理 | 中 |
| `UnifiedInput.vue` | 集成智能体选择器 | 小 |

**总工作量**: 约 3-5 天

---

## 三、功能二：跨模型回答评审

### 3.1 需求描述

自动获取不同AI模型的回答内容，然后将这些回答转发给其他模型进行评审，形成"AI评审AI"的闭环。

**流程示例**：
```
1. 用户发送问题 → DeepSeek/豆包/通义千问 同时回答
2. 所有模型回答完成 → 自动提取各模型的回答内容
3. 将回答内容拼接评审Prompt → 发送给评审模型（如GPT-4）
4. 评审模型输出评审结果 → 展示给用户
```

### 3.2 可行性分析

#### ⚠️ 部分可行，存在技术挑战

**可行部分**：
- ✅ AI回复状态检测已实现（`StatusMonitorScripts`）
- ✅ WebView脚本注入能力已具备
- ✅ 消息发送机制完善
- ✅ IPC通信通道可用

**核心挑战**：

| 挑战 | 难度 | 说明 |
|------|------|------|
| **AI回答内容提取** | 🔴 高 | 各平台DOM结构不同，需要为每个平台编写内容提取脚本 |
| **流式输出识别** | 🔴 高 | AI回答是流式的，需要判断何时回答真正完成 |
| **内容完整性** | 🟡 中 | Markdown/代码块/数学公式等格式提取困难 |
| **平台反爬检测** | 🟡 中 | 频繁提取内容可能触发反爬机制 |
| **上下文关联** | 🟡 中 | 多轮对话中需要识别哪条是最新回答 |

### 3.3 技术方案

#### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    评审流程控制器                          │
│                                                         │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐           │
│  │ 问题发送 │───→│ 等待完成  │───→│ 内容提取  │           │
│  └─────────┘    └──────────┘    └──────────┘           │
│                                      │                  │
│                                      ↓                  │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐           │
│  │ 结果展示 │←───│ 评审发送  │←───│ 内容拼接  │           │
│  └─────────┘    └──────────┘    └──────────┘           │
└─────────────────────────────────────────────────────────┘
```

#### 核心模块1：回答内容提取脚本

这是最关键也最复杂的部分。需要为每个AI平台编写内容提取脚本。

```typescript
// src/utils/ResponseExtractScripts.ts

export function getResponseExtractScript(providerId: string): string {
  const scripts: Record<string, string> = {
    doubao: `
      (function() {
        // 豆包：查找所有AI消息
        const messages = document.querySelectorAll('[data-testid="message_text_content"]');
        if (messages.length === 0) return null;
        
        // 获取最后一条AI消息（即最新回答）
        const lastMessage = messages[messages.length - 1];
        
        // 提取纯文本内容
        return {
          content: lastMessage.textContent.trim(),
          html: lastMessage.innerHTML,
          isComplete: true  // 配合状态监控判断
        };
      })()
    `,
    
    deepseek: `
      (function() {
        // DeepSeek：查找对话消息
        const messages = document.querySelectorAll('.ds-markdown--block');
        if (messages.length === 0) return null;
        
        const lastMessage = messages[messages.length - 1];
        return {
          content: lastMessage.textContent.trim(),
          html: lastMessage.innerHTML,
          isComplete: true
        };
      })()
    `,
    
    kimi: `
      (function() {
        // Kimi：查找消息列表
        const messages = document.querySelectorAll('.message-body');
        if (messages.length === 0) return null;
        
        const lastMessage = messages[messages.length - 1];
        return {
          content: lastMessage.textContent.trim(),
          html: lastMessage.innerHTML,
          isComplete: true
        };
      })()
    `,
    
    // ... 其他平台类似
  }
  
  return scripts[providerId] || `
    (function() {
      // 通用提取：尝试多种选择器
      const selectors = [
        '[data-testid*="message"]',
        '[class*="message-content"]',
        '[class*="response"]',
        '[class*="answer"]',
        '.markdown-body',
        '.prose'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          return {
            content: lastElement.textContent.trim(),
            html: lastElement.innerHTML,
            isComplete: true
          };
        }
      }
      
      return null;
    })()
  `
}
```

#### 核心模块2：评审流程控制器

```typescript
// src/services/ReviewOrchestrator.ts

export interface ReviewConfig {
  /** 被评审的模型列表 */
  reviewees: string[]
  /** 评审模型 */
  reviewer: string
  /** 评审提示词模板 */
  reviewPromptTemplate: string
  /** 是否自动评审 */
  autoReview: boolean
  /** 等待超时（毫秒） */
  timeout: number
}

export interface ReviewResult {
  revieweeId: string
  revieweeContent: string
  reviewerId: string
  reviewerContent: string
  timestamp: Date
}

export class ReviewOrchestrator {
  private config: ReviewConfig
  private pendingReviews: Map<string, { content: string; completed: boolean }> = new Map()
  private results: ReviewResult[] = []

  constructor(config: ReviewConfig) {
    this.config = config
  }

  /**
   * 启动评审流程
   * 在消息发送后调用
   */
  async startReview(originalQuestion: string): Promise<void> {
    // 1. 重置状态
    this.pendingReviews.clear()
    this.results = []
    this.config.reviewees.forEach(id => {
      this.pendingReviews.set(id, { content: '', completed: false })
    })

    // 2. 等待所有被评审模型回答完成
    await this.waitForAllResponses()

    // 3. 提取所有回答内容
    await this.extractAllResponses()

    // 4. 拼接评审Prompt并发送给评审模型
    await this.sendReviewRequest(originalQuestion)

    // 5. 等待评审完成
    await this.waitForReviewResponse()

    // 6. 提取评审结果
    await this.extractReviewResult()
  }

  /** 等待所有被评审模型回答完成 */
  private async waitForAllResponses(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const allCompleted = Array.from(this.pendingReviews.values())
          .every(v => v.completed)
        
        if (allCompleted) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 1000)

      // 超时处理
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()  // 超时也继续，用已有内容
      }, this.config.timeout)
    })
  }

  /** 提取所有模型的回答 */
  private async extractAllResponses(): Promise<void> {
    for (const [providerId, review] of this.pendingReviews) {
      try {
        const script = getResponseExtractScript(providerId)
        const result = await window.electronAPI.executeScriptInWebView(
          providerId, script
        )
        
        if (result) {
          review.content = result.content
          review.completed = true
        }
      } catch (error) {
        console.error(`提取 ${providerId} 回答失败:`, error)
        review.content = '[提取失败]'
        review.completed = true
      }
    }
  }

  /** 发送评审请求 */
  private async sendReviewRequest(originalQuestion: string): Promise<void> {
    // 拼接评审内容
    let reviewContent = this.config.reviewPromptTemplate
      .replace('{{question}}', originalQuestion)

    const responsesSection = Array.from(this.pendingReviews.entries())
      .map(([id, review]) => `### ${id} 的回答:\n${review.content}`)
      .join('\n\n---\n\n')

    reviewContent = reviewContent.replace('{{responses}}', responsesSection)

    // 发送给评审模型
    await window.electronAPI.sendMessageToWebView(
      this.config.reviewer, reviewContent
    )
  }

  /** 等待评审模型回答完成 */
  private async waitForReviewResponse(): Promise<void> {
    // 复用状态监控机制
    return new Promise((resolve) => {
      const unsubscribe = window.electronAPI.onAIStatusChange((data) => {
        if (data.providerId === this.config.reviewer && data.status === 'ai_completed') {
          unsubscribe()
          resolve()
        }
      })

      // 超时
      setTimeout(() => {
        unsubscribe()
        resolve()
      }, this.config.timeout)
    })
  }

  /** 提取评审结果 */
  private async extractReviewResult(): Promise<void> {
    const script = getResponseExtractScript(this.config.reviewer)
    const result = await window.electronAPI.executeScriptInWebView(
      this.config.reviewer, script
    )

    // 构建评审结果
    this.results = Array.from(this.pendingReviews.entries()).map(([id, review]) => ({
      revieweeId: id,
      revieweeContent: review.content,
      reviewerId: this.config.reviewer,
      reviewerContent: result?.content || '[评审提取失败]',
      timestamp: new Date()
    }))
  }

  /** 获取评审结果 */
  getResults(): ReviewResult[] {
    return this.results
  }
}
```

#### 核心模块3：评审结果展示

```vue
<!-- src/components/review/ReviewPanel.vue -->
<template>
  <div class="review-panel">
    <el-card v-for="result in results" :key="result.revieweeId" class="review-card">
      <template # header>
        <div class="review-header">
          <span>{{ getProviderName(result.revieweeId) }} 的回答</span>
          <el-tag type="info">被 {{ getProviderName(result.reviewerId) }} 评审</el-tag>
        </div>
      </template>
      
      <div class="review-content">
        <div class="original-response">
          <h4>原始回答</h4>
          <div class="markdown-body" v-html="renderMarkdown(result.revieweeContent)" />
        </div>
        
        <el-divider />
        
        <div class="review-comment">
          <h4>评审意见</h4>
          <div class="markdown-body" v-html="renderMarkdown(result.reviewerContent)" />
        </div>
      </div>
    </el-card>
  </div>
</template>
```

### 3.4 评审提示词模板设计

```typescript
// src/config/reviewTemplates.ts

export const defaultReviewTemplates = {
  comprehensive: {
    name: '综合评审',
    template: `你是一个专业的AI回答评审专家。请对以下AI模型的回答进行综合评审。

## 原始问题
{{question}}

## 待评审的回答
{{responses}}

## 评审要求
请从以下维度进行评审：
1. **准确性** (1-10分): 回答是否事实正确
2. **完整性** (1-10分): 回答是否全面覆盖了问题
3. **逻辑性** (1-10分): 回答的逻辑是否清晰
4. **可读性** (1-10分): 回答是否易于理解
5. **实用性** (1-10分): 回答的实用价值如何

请给出每个维度的评分和评语，并选出最佳回答。`
  },

  comparison: {
    name: '对比分析',
    template: `请对比以下不同AI模型对同一问题的回答，分析各自的优势和不足。

## 问题
{{question}}

## 回答
{{responses}}

请从以下角度进行对比分析：
1. 各回答的核心观点
2. 回答深度和广度
3. 代码/示例质量（如有）
4. 创新性见解
5. 综合推荐排名`
  },

  factcheck: {
    name: '事实核查',
    template: `请对以下AI回答进行事实核查，找出可能存在的错误或不准确之处。

## 问题
{{question}}

## 回答
{{responses}}

请逐一检查每个回答中的：
1. 事实性错误
2. 过时信息
3. 误导性表述
4. 遗漏的重要信息
5. 修正建议`
  }
}
```

### 3.5 改动量评估

| 模块 | 改动内容 | 工作量 | 难度 |
|------|---------|--------|------|
| `utils/ResponseExtractScripts.ts` | 各平台内容提取脚本 | 大 | 🔴 高 |
| `services/ReviewOrchestrator.ts` | 评审流程控制器 | 大 | 🔴 高 |
| `components/review/ReviewPanel.vue` | 评审结果展示 | 中 | 🟡 中 |
| `components/review/ReviewConfig.vue` | 评审配置界面 | 中 | 🟡 中 |
| `config/reviewTemplates.ts` | 评审提示词模板 | 小 | 🟢 低 |
| `stores/review.ts` | 评审状态管理 | 中 | 🟡 中 |
| `preload.ts` | 新增内容提取IPC | 小 | 🟢 低 |
| `UnifiedInput.vue` | 集成评审触发 | 小 | 🟢 低 |

**总工作量**: 约 7-14 天

---

## 四、两个功能的联动方案

智能体系统和评审系统可以深度联动，形成完整的AI协作工作流：

```
┌──────────────────────────────────────────────────────────┐
│                     完整工作流                             │
│                                                          │
│  1. 用户选择智能体（如"代码专家"）                          │
│  2. 用户输入问题                                          │
│  3. 智能体拼接前缀 → 发送到多个模型                         │
│  4. 等待所有模型回答完成                                    │
│  5. 自动提取各模型回答                                     │
│  6. 使用"评审专家"智能体 → 发送给评审模型                    │
│  7. 展示评审结果                                           │
│  8. 用户可选择最佳回答或继续追问                             │
└──────────────────────────────────────────────────────────┘
```

### 联动实现

```typescript
// src/services/WorkflowEngine.ts

export class WorkflowEngine {
  private agent: Agent | null = null
  private reviewConfig: ReviewConfig | null = null
  private orchestrator: ReviewOrchestrator | null = null

  /** 执行完整工作流 */
  async execute(question: string, providers: AIProvider[]): Promise<void> {
    // 阶段1: 智能体拼接 + 消息发送
    const messageContent = this.agent 
      ? this.transformWithAgent(question) 
      : question

    await messageDispatcher.sendMessage(messageContent, providers)

    // 阶段2: 等待回答完成
    if (this.reviewConfig?.autoReview) {
      this.orchestrator = new ReviewOrchestrator(this.reviewConfig)
      await this.orchestrator.startReview(question)
      
      // 阶段3: 展示评审结果
      const results = this.orchestrator.getResults()
      this.emit('review-completed', results)
    }
  }
}
```

---

## 五、风险与挑战

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 各平台DOM结构频繁变化 | 内容提取脚本失效 | 多重选择器兜底 + 用户反馈机制 |
| 流式输出未完成就提取 | 提取到不完整内容 | 依赖StatusMonitor的`ai_completed`状态 |
| 频繁脚本注入触发反爬 | 账号被限制 | 控制提取频率，添加随机延迟 |
| 长内容提取性能问题 | 页面卡顿 | 分段提取，限制最大长度 |
| Markdown格式丢失 | 评审质量下降 | 提取HTML并转换，保留格式 |

### 5.2 用户体验风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 评审流程耗时过长 | 用户等待不耐烦 | 显示进度条，支持取消 |
| 智能体前缀过长 | 占用Token限制 | 提示Token数量，支持精简模式 |
| 评审结果不准确 | 误导用户 | 标注"AI评审仅供参考" |

### 5.3 合规风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 违反AI平台使用条款 | 账号被封 | 仅提取用户自己的对话内容 |
| 数据隐私 | 回答内容泄露 | 本地处理，不上传第三方 |

---

## 六、实施路线图

### 阶段一：智能体/Skill系统（1-2周）

```
Week 1:
├── Day 1-2: 类型定义 + 数据模型
├── Day 3-4: MessageDispatcher消息转换逻辑
├── Day 5:   AgentSelector组件 + 集成到UnifiedInput

Week 2:
├── Day 1-2: SkillBar组件 + 快捷键
├── Day 3-4: 智能体管理界面（CRUD）
├── Day 5:   预置智能体 + 测试
```

### 阶段二：内容提取脚本（1-2周）

```
Week 3:
├── Day 1-2: 豆包/DeepSeek内容提取脚本
├── Day 3-4: Kimi/通义千问/Grok内容提取脚本
├── Day 5:   通用提取脚本 + 兜底机制

Week 4:
├── Day 1-2: ChatGPT/Gemini内容提取脚本
├── Day 3:   提取结果格式化（Markdown保留）
├── Day 4-5: 提取脚本测试 + 修复
```

### 阶段三：评审系统（1-2周）

```
Week 5:
├── Day 1-2: ReviewOrchestrator核心逻辑
├── Day 3-4: 评审配置界面
├── Day 5:   评审提示词模板

Week 6:
├── Day 1-2: ReviewPanel结果展示
├── Day 3:   工作流引擎（联动智能体+评审）
├── Day 4-5: 集成测试 + Bug修复
```

### 阶段四：优化与打磨（1周）

```
Week 7:
├── Day 1-2: 性能优化 + 错误处理
├── Day 3:   用户体验优化
├── Day 4-5: 文档 + 发布
```

---

## 七、结论

### 功能一：智能体/Skill前缀拼接

| 评估项 | 结论 |
|--------|------|
| **可行性** | ✅ **完全可行** |
| **技术难度** | 🟢 低-中 |
| **架构改动** | 小，只在消息发送链路增加中间层 |
| **开发周期** | 1-2周 |
| **用户价值** | 高 - 大幅提升对话质量和效率 |
| **推荐优先级** | 🔥🔥🔥 高 |

**理由**：
- 项目已有PromptManager的模板+变量替换机制，可直接复用
- MessageDispatcher的消息发送链路清晰，拦截点明确
- 不涉及WebView底层改动，风险低
- 与现有功能完美融合，用户体验提升明显

### 功能二：跨模型回答评审

| 评估项 | 结论 |
|--------|------|
| **可行性** | ⚠️ **部分可行，存在技术挑战** |
| **技术难度** | 🔴 高 |
| **架构改动** | 中-大，需要新增内容提取和评审流程 |
| **开发周期** | 2-3周 |
| **用户价值** | 极高 - 创新的AI协作模式 |
| **推荐优先级** | 🔥🔥 中-高 |

**理由**：
- AI回答内容提取是核心难点，各平台DOM结构不同且会变化
- 流式输出的完成判断依赖StatusMonitor，已具备基础
- 评审流程控制逻辑复杂，需要处理超时、失败、部分完成等边界情况
- 一旦实现，将形成独特的"AI评审AI"差异化竞争力

### 建议实施顺序

1. **先做智能体/Skill系统** - 风险低、价值高、改动小
2. **再做内容提取脚本** - 逐步适配各平台，先支持主流3-5个
3. **最后做评审系统** - 基于前两步的积累，实现完整工作流

---

*报告完成。如需进一步细化某个模块的实现方案，请告知。*
