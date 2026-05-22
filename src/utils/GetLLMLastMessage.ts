/**
 * 获取AI最后一条消息的脚本
 * @param providerId AI提供商ID
 * @returns 对应的JavaScript脚本字符串
 */
import { useScriptConfigStore } from '../stores/scriptConfig'
import type { ScriptType } from '../types'

function resolveScript(
  providerId: string,
  scriptType: ScriptType,
  defaultScript: string,
  params?: Record<string, string>
): string {
  try {
    const store = useScriptConfigStore()
    const custom = store.getCustomScript(providerId, scriptType)
    if (custom) {
      let result = custom
      if (params) {
        Object.keys(params).forEach((key) => {
          result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), params[key])
        })
      }
      return result
    }
  } catch {
    // Store not available, use default
  }
  return defaultScript
}

/**
 * HTML转Markdown的辅助脚本（注入到WebView中执行）
 */
const htmlToMarkdownHelper = `
  function htmlToMarkdown(el) {
    if (!el) return '';
    function processNode(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(processNode).join('');
      switch (tag) {
        case 'h1': return '# ' + children + '\\n\\n';
        case 'h2': return '## ' + children + '\\n\\n';
        case 'h3': return '### ' + children + '\\n\\n';
        case 'h4': return '#### ' + children + '\\n\\n';
        case 'h5': return '##### ' + children + '\\n\\n';
        case 'h6': return '###### ' + children + '\\n\\n';
        case 'p': return children + '\\n\\n';
        case 'br': return '\\n';
        case 'strong': case 'b': return '**' + children + '**';
        case 'em': case 'i': return '*' + children + '*';
        case 'code': return (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') ? children : '\`' + children + '\`';
        case 'pre': return '\\n\`\`\`\\n' + children + '\\n\`\`\`\\n\\n';
        case 'blockquote': return '> ' + children.replace(/\\n/g, '\\n> ') + '\\n\\n';
        case 'ul': return children;
        case 'ol': return children;
        case 'li': {
          const parent = node.parentElement;
          const idx = parent ? Array.from(parent.children).indexOf(node) + 1 : 1;
          const prefix = parent && parent.tagName.toLowerCase() === 'ol' ? idx + '. ' : '- ';
          return prefix + children.replace(/^\\n+|\\n+$/g, '') + '\\n';
        }
        case 'a': return '[' + children + '](' + (node.getAttribute('href') || '') + ')';
        case 'img': return '![' + (node.getAttribute('alt') || '') + '](' + (node.getAttribute('src') || '') + ')';
        case 'hr': return '\\n---\\n\\n';
        case 'table': return children + '\\n';
        case 'thead': return children;
        case 'tbody': return children;
        case 'tr': {
          const cells = Array.from(node.children).map(processNode).join('|');
          return '|' + cells + '|\\n';
        }
        case 'th': case 'td': return children;
        case 'span': return children;
        case 'div': return children + '\\n';
        case 'svg': return '';
        default: return children;
      }
    }
    let md = processNode(el);
    // 清理多余空行
    md = md.replace(/\\n{3,}/g, '\\n\\n').trim();
    return md;
  }
`

export function getSendMessageScript(providerId: string): string {
  const scripts: Record<string, () => string> = {
    kimi: () => getKimiLastMessageScript(),
    grok: () => getGrokLastMessageScript(),
    deepseek: () => getDeepSeekLastMessageScript(),
    doubao: () => getDouBaoLastMessageScript(),
    qwen: () => getQwenLastMessageScript(),
    copilot: () => getCopilotLastMessageScript(),
    glm: () => getGLMLastMessageScript(),
    yuanbao: () => getYuanBaoLastMessageScript(),
    miromind: () => getMiromindLastMessageScript(),
    gemini: () => getGeminiLastMessageScript(),
    chatgpt: () => getChatGPTLastMessageScript(),
    mimo: () => getMimoLastMessageScript(),
    minimax: () => getMinimaxLastMessageScript(),
    ima: () => getIMALastMessageScript()
  }

  const scriptGenerator = scripts[providerId]
  const defaultScript = scriptGenerator ? scriptGenerator() : ''
  return resolveScript(providerId, 'getLLMLastMessage', defaultScript)
}

function getKimiLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.segment-content');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getGrokLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.response-content-markdown');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getDeepSeekLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.ds-markdown');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getDouBaoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // 豆包：多种选择器尝试，适配不同版本
    const selectors = [
      // 2024+ 版本选择器
      '[data-testid="receive_message"]',
      '[data-testid="receive_message"] .message-content',
      // 聊天消息容器
      '.chat-message-assistant',
      '[class*="assistant-message"]',
      '[class*="bot-message"]',
      '[class*="ai-message"]',
      // 消息气泡中的markdown内容
      '[class*="message-bubble"] [class*="markdown"]',
      '.message-content-container [class*="markdown"]',
      '[class*="chat-content"] [class*="markdown"]',
      // 通用内容选择器
      '[class*="response-content"]',
      '[class*="answer-content"]',
      '.markdown-body',
      // 兜底：查找所有包含大量文本的聊天消息容器
      '[class*="message-item"]:last-of-type [class*="content"]',
      '[class*="chat-item"]:last-of-type [class*="content"]'
    ];

    // 调试：记录选择器匹配情况
    const debugInfo = [];

    for (const sel of selectors) {
      try {
        const messages = document.querySelectorAll(sel);
        debugInfo.push(sel + ' => ' + messages.length + ' matches');
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const text = htmlToMarkdown(lastMessage).trim();
          if (text.length > 10) {
            console.log('[Doubao] 使用选择器:', sel, '提取到', text.length, '字符');
            return text;
          }
        }
      } catch(e) {
        debugInfo.push(sel + ' => error: ' + e.message);
      }
    }

    // 最终兜底：尝试从页面中找到AI回复的通用模式
    const allDivs = document.querySelectorAll('[class*="markdown"]');
    debugInfo.push('[class*="markdown"] total: ' + allDivs.length);
    for (let i = allDivs.length - 1; i >= 0; i--) {
      const text = htmlToMarkdown(allDivs[i]).trim();
      if (text.length > 20) {
        console.log('[Doubao] 兜底提取到', text.length, '字符');
        return text;
      }
    }

    // 额外兜底：查找所有 data-testid 属性的元素
    const testIdEls = document.querySelectorAll('[data-testid]');
    const testIds = Array.from(testIdEls).map(el => el.getAttribute('data-testid'));
    debugInfo.push('data-testid values: ' + testIds.join(', '));

    // 查找所有可能的聊天消息容器
    const chatEls = document.querySelectorAll('[class*="chat"] [class*="content"], [class*="message"] [class*="content"]');
    debugInfo.push('chat/message content elements: ' + chatEls.length);
    for (let i = chatEls.length - 1; i >= 0; i--) {
      const text = chatEls[i].innerText || chatEls[i].textContent || '';
      if (text.trim().length > 50) {
        console.log('[Doubao] 文本兜底提取到', text.trim().length, '字符');
        return text.trim();
      }
    }

    console.warn('[Doubao] 所有选择器均未匹配:', debugInfo);
    return '';
  })()`
}

function getQwenLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // 通义千问：多种选择器尝试
    const selectors = [
      '.markdown-body',
      '[class*="answer-content"]',
      '[class*="response-content"]',
      '[class*="chat-message-assistant"]',
      '.chat-msg-content'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getCopilotLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // Copilot：多种选择器尝试
    const selectors = [
      '[class*="ac-textBlock"]',
      '[class*="response-content"]',
      '[class*="answer-content"]',
      '.markdown-body',
      '[class*="chat-message"]'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getGLMLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.answer-content-wrap');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getYuanBaoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.agent-chat__list__item__content');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getMiromindLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.report-container');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getGeminiLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // Gemini：多种选择器尝试
    const selectors = [
      'message-content',
      '[class*="model-response"]',
      '[class*="response-container"]',
      '.markdown-main-panel',
      '[class*="message-content"]',
      'model-response'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getChatGPTLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // ChatGPT：多种选择器尝试
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[class*="markdown"]',
      '.agent-turn',
      '[class*="message-content"]',
      '[class*="response"]'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getMimoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.markdown-prose');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getMinimaxLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    const messages = document.querySelectorAll('.message-content');
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getIMALastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    // IMA：多种选择器尝试
    const selectors = [
      '[class*="message-content"]',
      '[class*="response-content"]',
      '.markdown-body',
      '[class*="answer"]'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}
