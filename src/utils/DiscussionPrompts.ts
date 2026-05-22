/**
 * 多模型对话讨论提示词模板
 */

/**
 * 顺序讨论模板 - 每个模型基于前面模型的回答继续讨论
 */
export const SEQUENTIAL_DISCUSSION_TEMPLATE = `你正在参与一个多AI讨论。请基于以下讨论上下文，继续发表你的观点。

## 原始问题
{originalQuery}

## 之前的讨论
{previousDiscussion}

## 你的任务
请针对原始问题，结合之前讨论中的观点，发表你的看法。你可以：
1. 赞同或反驳之前的观点，并说明理由
2. 补充之前讨论中遗漏的重要信息
3. 提出新的视角或解决方案
4. 对之前回答中的错误进行纠正

请直接发表你的观点，不要重复之前的讨论内容：`

/**
 * 辩论模式模板 - 模型间进行正反方辩论
 */
export const DEBATE_DISCUSSION_TEMPLATE = `你正在参与一个AI辩论。请基于以下辩论上下文，从你的角度进行辩论。

## 辩论主题
{originalQuery}

## 之前的辩论
{previousDiscussion}

## 你的任务
请针对辩论主题，基于之前的辩论内容，从你的角度进行反驳或补充论证。要求：
1. 明确你的立场（赞同/反对/部分赞同）
2. 提供有力的论据支持你的立场
3. 指出对方论点的不足之处
4. 保持逻辑严密和客观理性

请发表你的辩论观点：`

/**
 * 圆桌讨论模板 - 平等参与，各抒己见
 */
export const ROUND_ROBIN_DISCUSSION_TEMPLATE = `你正在参与一个AI圆桌讨论。请基于以下讨论内容，分享你的见解。

## 讨论主题
{originalQuery}

## 之前的讨论
{previousDiscussion}

## 你的任务
请针对讨论主题，结合之前的讨论内容，分享你独特的见解。你可以：
1. 从不同角度分析问题
2. 提出创新性的想法
3. 总结已有观点并给出综合建议

请分享你的观点：`

/**
 * 第一轮发言模板 - 第一个模型直接回答问题
 */
export const FIRST_SPEAKER_TEMPLATE = `{originalQuery}`

/**
 * 生成讨论提示词
 */
export function generateDiscussionPrompt(
  originalQuery: string,
  previousUtterances: { providerName: string; content: string }[],
  mode: 'sequential' | 'debate' | 'round-robin' = 'sequential'
): string {
  // 第一个发言者直接回答问题
  if (previousUtterances.length === 0) {
    return FIRST_SPEAKER_TEMPLATE.replace('{originalQuery}', originalQuery)
  }

  // 后续发言者基于之前的讨论
  const template = mode === 'debate'
    ? DEBATE_DISCUSSION_TEMPLATE
    : mode === 'round-robin'
      ? ROUND_ROBIN_DISCUSSION_TEMPLATE
      : SEQUENTIAL_DISCUSSION_TEMPLATE

  const previousDiscussion = previousUtterances
    .map((u, i) => `**${u.providerName}**: ${u.content}`)
    .join('\n\n---\n\n')

  return template
    .replace('{originalQuery}', originalQuery)
    .replace('{previousDiscussion}', previousDiscussion)
}

/**
 * 获取所有讨论模板
 */
export function getDiscussionTemplates() {
  return [
    { id: 'sequential', name: '顺序讨论', template: SEQUENTIAL_DISCUSSION_TEMPLATE, description: '模型依次基于前一个模型的回答继续讨论' },
    { id: 'debate', name: '辩论模式', template: DEBATE_DISCUSSION_TEMPLATE, description: '模型间进行正反方辩论' },
    { id: 'round-robin', name: '圆桌讨论', template: ROUND_ROBIN_DISCUSSION_TEMPLATE, description: '平等参与，各抒己见' }
  ]
}
