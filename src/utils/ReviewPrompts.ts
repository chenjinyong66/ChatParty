/**
 * AI评审提示词模板
 */

/** 综合评审模板 */
export const COMPREHENSIVE_REVIEW_PROMPT = `你是一个专业的AI回答评审专家。请对以下AI模型的回答进行严格评审。

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

请严格按以下格式输出（不要遗漏任何模型）：

## 评审结果

### 各模型评分
| 模型 | 准确性 | 完整性 | 逻辑性 | 可读性 | 实用性 | 总分 |
|------|--------|--------|--------|--------|--------|------|
{scoreTableRows}

### 最佳回答
**最佳模型**: [模型名]
**理由**: [选择理由]

### 各模型改进建议
{improvementSection}`

/** 事实核查模板 */
export const FACT_CHECK_REVIEW_PROMPT = `请对以下AI回答进行事实核查，找出可能存在的错误或不准确之处。

## 问题
{originalQuery}

## 回答
{responses}

请逐一检查每个回答中的：
1. 事实性错误
2. 过时信息
3. 误导性表述
4. 遗漏的重要信息
5. 修正建议

请按以下格式输出：

## 事实核查结果

### 各模型核查
{factCheckSection}

### 综合可信度排名
{credibilityRanking}`

/** 对比分析模板 */
export const COMPARISON_REVIEW_PROMPT = `请对比以下不同AI模型对同一问题的回答，分析各自的优势和不足。

## 问题
{originalQuery}

## 回答
{responses}

请从以下角度进行对比分析：
1. 各回答的核心观点
2. 回答深度和广度
3. 代码/示例质量（如有）
4. 创新性见解
5. 综合推荐排名

请输出对比分析报告：`

/**
 * 生成评审提示词
 */
export function generateReviewPrompt(
  originalQuery: string,
  responses: { providerName: string; content: string }[],
  customPrompt?: string
): string {
  const prompt = customPrompt || COMPREHENSIVE_REVIEW_PROMPT

  const formattedResponses = responses
    .filter(r => r.content.trim())
    .map((r, index) => `### AI ${index + 1}: ${r.providerName}\n${r.content}`)
    .join('\n\n---\n\n')

  return prompt
    .replace(/\{originalQuery\}/g, originalQuery)
    .replace(/\{responses\}/g, formattedResponses)
}

/** 获取所有评审模板 */
export function getReviewTemplates() {
  return [
    { id: 'comprehensive', name: '综合评审', template: COMPREHENSIVE_REVIEW_PROMPT },
    { id: 'factcheck', name: '事实核查', template: FACT_CHECK_REVIEW_PROMPT },
    { id: 'comparison', name: '对比分析', template: COMPARISON_REVIEW_PROMPT }
  ]
}
