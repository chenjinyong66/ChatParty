# ChatAllAI2 功能分析与扩展方案报告

> **项目**: ChatAllAI2 - 一个同时与多个AI模型对话的桌面应用程序
> **分析日期**: 2025-01-15
> **分析范围**: 总结功能分析 / Agent-Skill系统 / 跨模型评审

---

## 一、当前"总结"功能详细分析

### 1.1 功能定位

"总结"功能是项目已有的**跨模型回答聚合分析**能力，核心作用是：**将多个AI模型对同一问题的回答收集起来，交给一个指定的AI模型进行综合分析和总结。**

### 1.2 完整工作流程

```
用户点击"总结"按钮
    ↓
SummaryService.executeSummary()
    ↓
步骤1: 收集各AI回答 (collectResponses)
    ├── 遍历所有已登录的AI模型
    ├── 通过WebView注入脚本提取每个AI的最后一条回答
    │   └── GetLLMLastMessage.ts 中为每个平台定制了提取脚本
    ├── 并发收集，带3次重试和10秒超时
    └── 更新进度 (0/3 → 1/3 → 2/3 → 3/3)
    ↓
步骤2: 生成总结提示词 (generateSummaryPrompt)
    ├── 将各AI回答格式化为Markdown
    ├── 拼接到总结模板中
    └── 支持4种模板: 默认/简洁/详细/对比
    ↓
步骤3: 发送总结请求 (sendSummaryRequest)
    ├── 打开右侧SummarySidebar面板
    ├── 在侧边栏中创建独立的WebView（summary-{providerId}）
    └── 将总结提示词发送给选中的AI模型
    ↓
步骤4: 查看总结结果
    └── 在侧边栏的WebView中直接查看AI生成的总结
```

### 1.3 触发条件

| 条件 | 说明 |
|------|------|
| **何时可用** | 至少有1个AI模型已登录 |
| **何时推荐使用** | 多个AI模型已回答完同一问题后 |
| **触发方式** | 点击输入区域的"总结"按钮 |
| **前置状态** | AI模型应处于`ai_completed`状态（回答完成） |

### 1.4 已支持的内容提取脚本

| 平台 | 提取选择器 | 状态 |
|------|-----------|------|
| Kimi | `.segment-content` | ✅ 已实现 |
| Grok | `.response-content-markdown` | ✅ 已实现 |
| DeepSeek | `.ds-markdown` | ✅ 已实现 |
| 豆包 | `[data-testid="receive_message"]` | ✅ 已实现 |
| GLM | `.answer-content-wrap` | ✅ 已实现 |
| 元宝 | `.agent-chat__list__item__content` | ✅ 已实现 |
| Miromind | `.report-container` | ✅ 已实现 |
| Mimo | `.markdown-prose` | ✅ 已实现 |
| Minimax | `.message-content` | ✅ 已实现 |
| 通义千问 | - | ❌ 未实现 |
| Copilot | - | ❌ 未实现 |
| Gemini | - | ❌ 未实现 |
| ChatGPT | - | ❌ 未实现 |

### 1.5 总结提示词模板

已内置4种模板：

1. **默认模板** (`DEFAULT_SUMMARY_PROMPT`) - 核心观点总结 + 观点对比 + 建议
2. **简洁版** (`CONCISE_SUMMARY_PROMPT`) - 简短概括核心观点
3. **详细版** (`DETAILED_SUMMARY_PROMPT`) - 深度分析 + 质量评估 + 综合建议
4. **对比分析** (`COMPARISON_PROMPT`) - 对比表格 + 差异原因 + 可信度评估

### 1.6 总结功能的局限性

| 局限 | 说明 |
|------|------|
| **只能提取纯文本** | 无法保留Markdown格式、代码块、数学公式 |
| **手动触发** | 不会在AI回答完成后自动总结 |
| **单次总结** | 每次只能总结最新一轮回答，无法跨轮次 |
| **部分平台未适配** | ChatGPT/Gemini/通义千问/Copilot 无法提取内容 |
| **总结结果在侧边栏** | 与主对话区域分离，查看不便 |
| **无评审维度** | 总结偏向信息聚合，缺乏专业评审打分 |

---

## 二、Agent/Skill 前缀拼接系统

### 2.1 需求描述

在用户发送消息前，根据选中的Agent或Skill，自动在消息前拼接系统提示词或角色设定，然后发送给对应的AI模型。

### 2.2 与现有PromptManager的关系

当前项目已有 `PromptManager` 组件，支持：
- 模板管理（创建/编辑/删除/分类）
- 变量替换（`{{user_input}}`）
- 快捷Prompt应用

**Agent/Skill与PromptManager的区别**：

| 特性 | PromptManager | Agent/Skill |
|------|--------------|-------------|
| 定位 | 消息模板工具 | 角色扮演/能力增强 |
| 触发方式 | 手动选择后替换输入框 | 选中后自动拼接每次发送 |
| 持续性 | 一次性应用 | 持续生效直到取消 |
| 粒度 | 整条消息替换 | 前缀/后缀拼接 |
| 模型适配 | 所有模型相同 | 可针对不同模型定制 |

### 2.3 技术方案

#### 消息流改造

```
当前流程:
用户输入 → MessageDispatcher.sendMessage(content, providers) → 各平台脚本

改造后:
用户输入 → Agent拦截器.transform(content, providerId) → MessageDispatcher.sendMessage() → 各平台脚本
                ↓
         如果有Agent: systemPrompt + "\n\n" + content
         如果有Skill:  skill.template.replace("{{user_input}}", content)
         如果都没有:    content (原样)
```

#### 核心改动点

**1. MessageDispatcher.ts - 增加消息转换**

```typescript
// 在 sendToProvider 方法中，发送前转换消息
private async sendToProvider(provider: AIProvider, message: Message): Promise<MessageSendResult> {
  // 新增：根据providerId转换消息内容
  const transformedContent = this.transformMessage(message.content, provider.id)
  const transformedMessage = { ...message, content: transformedContent }
  
  // 后续逻辑使用 transformedMessage...
}
```

**2. 新增 AgentStore**

```typescript
// src/stores/agent.ts
export const useAgentStore = defineStore('agent', () => {
  const activeAgent = ref<Agent | null>(null)
  const activeSkills = ref<Skill[]>([])
  
  // 消息转换核心方法
  const transformMessage = (content: string, providerId: string): string => {
    let result = content
    
    // Agent前缀拼接
    if (activeAgent.value) {
      const agent = activeAgent.value
      const shouldApply = agent.targetProviders.length === 0 
        || agent.targetProviders.includes(providerId)
      if (shouldApply) {
        result = `${agent.systemPrompt}\n\n${result}`
      }
    }
    
    // Skill拼接
    activeSkills.value.forEach(skill => {
      const shouldApply = skill.targetProviders.length === 0 
        || skill.targetProviders.includes(providerId)
      if (shouldApply && skill.isEnabled) {
        if (skill.mode === 'prefix') {
          result = skill.template.replace('{{user_input}}', result)
        } else if (skill.mode === 'suffix') {
          result = result + '\n\n' + skill.template
        }
      }
    })
    
    return result
  }
  
  return { activeAgent, activeSkills, transformMessage }
})
```

**3. UnifiedInput.vue - 增加Agent选择器**

在输入框头部区域增加Agent选择下拉和Skill快捷开关。

### 2.4 可行性评估

| 评估项 | 结论 |
|--------|------|
| **可行性** | ✅ 完全可行 |
| **技术难度** | 🟢 低 |
| **架构改动** | 小 - 只在MessageDispatcher增加一个转换步骤 |
| **开发周期** | 3-5天 |
| **风险** | 低 - 不影响现有功能，可渐进式开发 |

---

## 三、跨模型回答评审

### 3.1 需求描述

自动获取不同AI模型的回答内容，将回答转发给其他模型进行评审，形成"AI评审AI"的闭环。

### 3.2 与现有总结功能的关系

**总结功能已经是评审的雏形**，它已经实现了：
- ✅ 从各AI模型提取回答内容（`GetLLMLastMessage.ts`）
- ✅ 将回答内容拼接成提示词（`SummaryPrompts.ts`）
- ✅ 发送给指定AI模型进行分析（`SummaryService.sendSummaryRequest`）
- ✅ 在独立侧边栏展示结果（`SummarySidebar.vue`）

**评审与总结的区别**：

| 特性 | 总结 | 评审 |
|------|------|------|
| 目的 | 信息聚合 | 质量评估 |
| 输出 | 综合概述 | 评分+改进建议 |
| 维度 | 共识/差异 | 准确性/完整性/逻辑性 |
| 流程 | 一次性 | 可多轮迭代 |
| 触发 | 手动 | 可自动 |

### 3.3 基于总结功能扩展评审

评审功能可以**直接复用总结功能的全部基础设施**，只需要：

1. **新增评审提示词模板** - 在 `SummaryPrompts.ts` 中添加评审专用模板
2. **增加评分解析** - 从AI评审结果中提取结构化评分
3. **自动触发机制** - 在AI回答完成后自动启动评审
4. **评审结果展示** - 新增评审面板组件

#### 评审提示词模板

```typescript
// 在 SummaryPrompts.ts 中新增
export const REVIEW_PROMPT = `你是一个专业的AI回答评审专家。请对以下AI模型的回答进行严格评审。

## 原始问题
{originalQuery}

## 待评审的回答
{responses}

## 评审要求
请对每个AI的回答从以下维度评分（1-10分）：

| 维度 | 说明 |
|------|------|
| 准确性 | 事实是否正确，有无错误信息 |
| 完整性 | 是否全面覆盖了问题的各个方面 |
| 逻辑性 | 论证是否清晰，推理是否合理 |
| 可读性 | 表达是否清晰，结构是否合理 |
| 实用性 | 回答的实际参考价值 |

请按以下格式输出：

## 评审结果

### 各模型评分
| 模型 | 准确性 | 完整性 | 逻辑性 | 可读性 | 实用性 | 总分 |
|------|--------|--------|--------|--------|--------|------|
| [模型名] | X | X | X | X | X | XX/50 |

### 最佳回答
[选出最佳回答及理由]

### 各模型改进建议
[针对每个模型的不足给出改进建议]`
```

#### 自动评审触发

```typescript
// 在 UnifiedInput.vue 的 AI状态监控中
const handleAIStatusChange = (data: any) => {
  // 当所有AI回答完成时，自动触发评审
  if (data.status === 'ai_completed') {
    updateAIStatus(data.providerId, 'completed')
    
    // 检查是否所有选中的AI都已完成
    const allCompleted = selectedProviders.value.every(id => 
      aiStatusMap.value[id] === 'completed'
    )
    
    if (allCompleted && autoReviewEnabled.value) {
      // 自动触发评审
      executeReview()
    }
  }
}
```

### 3.4 可行性评估

| 评估项 | 结论 |
|--------|------|
| **可行性** | ✅ 可行 - 已有80%的基础设施 |
| **技术难度** | 🟡 中 |
| **核心依赖** | 内容提取脚本的准确性 |
| **开发周期** | 5-7天（基于总结功能扩展） |
| **主要风险** | 内容提取可能不完整（纯文本丢失格式） |

### 3.5 内容提取的挑战与解决方案

**当前问题**：`GetLLMLastMessage.ts` 使用 `.textContent` 提取，丢失了所有格式。

**解决方案**：改用 `.innerHTML` 提取，然后转换为Markdown。

```typescript
// 改进后的提取脚本示例（豆包）
function getDouBaoLastMessageScript(): string {
  return `(() => {
    const messages = document.querySelectorAll('[data-testid="receive_message"]');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    
    // 尝试获取Markdown原文（部分平台在data属性中存储）
    const markdownEl = lastMessage.querySelector('[data-markdown]');
    if (markdownEl) return markdownEl.getAttribute('data-markdown') || '';
    
    // 降级：获取HTML并简单转换
    const html = lastMessage.innerHTML;
    // 将HTML转为近似Markdown的文本
    return html
      .replace(/<code[^>]*>(.*?)<\\/code>/g, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\\/pre>/gs, '\\n```\\n$1\\n```\\n')
      .replace(/<h([1-6])[^>]*>(.*?)<\\/h[1-6]>/g, (_, l, t) => '#'.repeat(+l) + ' ' + t)
      .replace(/<li[^>]*>(.*?)<\\/li>/g, '- $1')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .trim();
  })()`
}
```

---

## 四、三个功能的协同架构

### 4.1 统一工作流

```
┌──────────────────────────────────────────────────────────────┐
│                        用户输入                                │
│                    "帮我写一个排序算法"                         │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  Agent/Skill 拦截器                                           │
│  选中Agent: "代码专家"                                        │
│  拼接后: "你是一个资深软件工程师...\n\n帮我写一个排序算法"      │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  MessageDispatcher                                            │
│  并发发送到: DeepSeek / 豆包 / 通义千问 / Kimi                │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  等待所有AI回答完成 (StatusMonitor)                           │
│  DeepSeek: completed ✓  豆包: completed ✓  ...               │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  自动/手动触发评审                                            │
│  1. 提取各AI回答内容 (GetLLMLastMessage)                     │
│  2. 拼接评审提示词 (ReviewPrompts)                            │
│  3. 发送给评审模型 (如GPT-4)                                  │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  展示评审结果                                                 │
│  ┌──────────┬──────┬──────┬──────┬──────┬──────┬──────┐     │
│  │ 模型     │准确性│完整性│逻辑性│可读性│实用性│ 总分 │     │
│  ├──────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│  │ DeepSeek │  9   │  8   │  9   │  8   │  9   │43/50 │     │
│  │ 豆包     │  8   │  7   │  8   │  9   │  7   │39/50 │     │
│  │ Kimi     │  7   │  8   │  7   │  8   │  8   │38/50 │     │
│  └──────────┴──────┴──────┴──────┴──────┴──────┴──────┘     │
│  最佳回答: DeepSeek (理由: ...)                               │
│  改进建议: ...                                                │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 代码复用关系

```
现有代码                          新增代码
─────────                        ────────
PromptManager.vue        →  AgentSelector.vue (复用模板管理UI)
MessageDispatcher.ts     →  增加transformMessage()方法
GetLLMLastMessage.ts     →  直接复用（评审也需要提取内容）
SummaryPrompts.ts        →  新增REVIEW_PROMPT等评审模板
SummaryService.ts        →  ReviewService.ts (复用收集+发送逻辑)
SummarySidebar.vue       →  ReviewPanel.vue (复用侧边栏展示)
StatusMonitorScripts.ts  →  直接复用（判断回答完成）
```

---

## 五、实施优先级与路线图

### 5.1 优先级排序

| 优先级 | 功能 | 理由 |
|--------|------|------|
| 🔥 P0 | Agent/Skill前缀拼接 | 改动最小、价值最高、风险最低 |
| 🔥 P1 | 完善内容提取脚本 | 评审和总结都依赖它，ChatGPT/Gemini等4个平台未适配 |
| 🌟 P2 | 评审功能（基于总结扩展） | 已有80%基础设施，增量开发 |
| 🌟 P3 | 自动评审触发 | 在P2基础上增加自动化 |

### 5.2 实施路线图

#### 阶段一：Agent/Skill系统（3-5天）

```
Day 1: 类型定义 + AgentStore
Day 2: MessageDispatcher消息转换 + AgentSelector组件
Day 3: Skill快捷栏 + 预置Agent配置
Day 4: 集成测试 + 修复
Day 5: 文档 + 发布
```

#### 阶段二：完善内容提取（3-5天）

```
Day 1: ChatGPT内容提取脚本
Day 2: Gemini内容提取脚本
Day 3: 通义千问/Copilot内容提取脚本
Day 4: HTML→Markdown转换优化
Day 5: 全平台提取测试
```

#### 阶段三：评审功能（5-7天）

```
Day 1-2: 评审提示词模板 + 评分解析
Day 3-4: ReviewService（复用SummaryService）+ ReviewPanel组件
Day 5: 自动评审触发机制
Day 6-7: 集成测试 + 优化
```

---

## 六、总结

### 6.1 现有总结功能评估

总结功能是一个**已经可用的跨模型分析工具**，核心价值在于：
- 将分散在多个AI卡片中的回答聚合分析
- 支持多种总结风格（简洁/详细/对比）
- 有独立的侧边栏展示区域

**主要不足**：9个平台中4个未适配内容提取、只能提取纯文本、手动触发。

### 6.2 三个功能的递进关系

```
Agent/Skill（消息增强）
    → 让每个AI在特定角色下回答，提高回答质量
        → 总结/评审（回答分析）
            → 对增强后的回答进行质量评估
                → 形成完整的 "增强 → 回答 → 评估" 闭环
```

### 6.3 核心结论

1. **Agent/Skill** - ✅ 完全可行，改动小，应优先实施
2. **总结功能** - ✅ 已有基础，需完善内容提取脚本
3. **评审功能** - ✅ 可基于总结功能扩展，复用80%代码
4. **自动评审** - ✅ 在评审基础上增加触发机制即可

三个功能形成递进关系，建议按 P0→P1→P2→P3 顺序实施。

---

*报告完成。*
