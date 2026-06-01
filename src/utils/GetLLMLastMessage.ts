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

const visibilityHelper = `
  function __isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }
  function __isInViewport(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return rect.top < window.innerHeight && rect.bottom > 0;
  }
  function __getLastVisibleMessage(messages) {
    const arr = Array.from(messages);
    if (arr.length === 0) return null;
    const visible = arr.filter(el => __isVisible(el));
    if (visible.length > 0) {
      const inViewport = visible.filter(el => __isInViewport(el));
      if (inViewport.length > 0) return inViewport[inViewport.length - 1];
      return visible[visible.length - 1];
    }
    return arr[arr.length - 1];
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
    ${visibilityHelper}
    const messages = document.querySelectorAll('.segment-content');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getGrokLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.response-content-markdown');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getDeepSeekLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.ds-markdown');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getDouBaoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}

    function getChatArea() {
      const mainEl = document.querySelector('main');
      if (mainEl) return mainEl;
      const chatArea = document.querySelector('[class*="chat-area"]')
        || document.querySelector('[class*="chat-main"]')
        || document.querySelector('[class*="conversation-main"]')
        || document.querySelector('[class*="dialogue"]')
        || document.querySelector('[id*="chat"]');
      if (chatArea) return chatArea;
      const allSections = document.querySelectorAll('section');
      for (const section of allSections) {
        if (section.querySelector('[data-testid="receive_message"]')) return section;
      }
      return document.body;
    }

    function stripRecommendQuestions(el) {
      const clone = el.cloneNode(true);
      const removeSelectors = [
        '[class*="recommend"]',
        '[class*="suggest"]',
        '[class*="related-question"]',
        '[class*="follow-up"]',
        '[class*="hot-question"]',
        '[class*="question-list"]',
        '[class*="question-card"]',
        '[class*="more-question"]',
        '[data-testid*="question"]',
        '[class*="expand-btn"]',
        '[class*="action-bar"]',
        '[class*="toolbar"]',
        '[class*="feedback"]',
        '[class*="copy-btn"]',
        '[class*="like-btn"]',
        '[class*="dislike"]'
      ];
      for (const sel of removeSelectors) {
        const nodes = clone.querySelectorAll(sel);
        nodes.forEach(n => n.remove());
      }
      return clone;
    }

    const chatArea = getChatArea();

    const selectors = [
      '[data-testid="receive_message"] [class*="markdown"]',
      '[data-testid="receive_message"] .message-content',
      '[data-testid="receive_message"]',
      '.chat-message-assistant [class*="markdown"]',
      '.chat-message-assistant',
      '[class*="assistant-message"] [class*="markdown"]',
      '[class*="bot-message"] [class*="markdown"]',
      '[class*="ai-message"] [class*="markdown"]',
      '[class*="message-bubble"] [class*="markdown"]',
      '.message-content-container [class*="markdown"]',
      '[class*="chat-content"] [class*="markdown"]',
      '[class*="response-content"] [class*="markdown"]',
      '[class*="answer-content"] [class*="markdown"]',
      '.markdown-body'
    ];

    const debugInfo = [];

    for (const sel of selectors) {
      try {
        const messages = chatArea.querySelectorAll(sel);
        debugInfo.push(sel + ' => ' + messages.length + ' matches');
        if (messages.length > 0) {
          const lastMessage = __getLastVisibleMessage(messages);
          if (lastMessage) {
            const text = htmlToMarkdown(lastMessage).trim();
            if (text.length > 10) {
              console.log('[Doubao] 使用选择器:', sel, '提取到', text.length, '字符');
              return text;
            }
          }
        }
      } catch(e) {
        debugInfo.push(sel + ' => error: ' + e.message);
      }
    }

    const receiveEls = chatArea.querySelectorAll('[data-testid="receive_message"]');
    debugInfo.push('[data-testid="receive_message"] total: ' + receiveEls.length);
    const lastReceive = __getLastVisibleMessage(receiveEls);
    if (lastReceive) {
      const cleaned = stripRecommendQuestions(lastReceive);
      const text = htmlToMarkdown(cleaned).trim();
      if (text.length > 10) {
        console.log('[Doubao] receive_message清洗后提取到', text.length, '字符');
        return text;
      }
    }

    const allDivs = chatArea.querySelectorAll('[class*="markdown"]');
    debugInfo.push('[class*="markdown"] total: ' + allDivs.length);
    const lastDiv = __getLastVisibleMessage(allDivs);
    if (lastDiv) {
      const text = htmlToMarkdown(lastDiv).trim();
      if (text.length > 20) {
        console.log('[Doubao] 兜底提取到', text.length, '字符');
        return text;
      }
    }

    const chatEls = chatArea.querySelectorAll('[class*="message"] [class*="content"]');
    debugInfo.push('message content elements: ' + chatEls.length);
    const lastChat = __getLastVisibleMessage(chatEls);
    if (lastChat) {
      const cleaned = stripRecommendQuestions(lastChat);
      const text = htmlToMarkdown(cleaned).trim();
      if (text.length > 50) {
        console.log('[Doubao] 文本兜底提取到', text.length, '字符');
        return text;
      }
    }

    console.warn('[Doubao] 所有选择器均未匹配:', debugInfo);
    return '';
  })()`
}

function getQwenLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
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
        const lastMessage = __getLastVisibleMessage(messages);
        if (lastMessage) return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getCopilotLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
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
        const lastMessage = __getLastVisibleMessage(messages);
        if (lastMessage) return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getGLMLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.answer-content-wrap');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getYuanBaoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.agent-chat__list__item__content');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getMiromindLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.report-container');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getGeminiLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
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
        const lastMessage = __getLastVisibleMessage(messages);
        if (lastMessage) return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getChatGPTLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
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
        const lastMessage = __getLastVisibleMessage(messages);
        if (lastMessage) return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}

function getMimoLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.markdown-prose');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getMinimaxLastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const messages = document.querySelectorAll('.message-content');
    const lastMessage = __getLastVisibleMessage(messages);
    if (!lastMessage) return '';
    return htmlToMarkdown(lastMessage);
  })()`
}

function getIMALastMessageScript(): string {
  return `(() => {
    ${htmlToMarkdownHelper}
    ${visibilityHelper}
    const selectors = [
      '[class*="message-content"]',
      '[class*="response-content"]',
      '.markdown-body',
      '[class*="answer"]'
    ];
    for (const sel of selectors) {
      const messages = document.querySelectorAll(sel);
      if (messages.length > 0) {
        const lastMessage = __getLastVisibleMessage(messages);
        if (lastMessage) return htmlToMarkdown(lastMessage);
      }
    }
    return '';
  })()`
}
