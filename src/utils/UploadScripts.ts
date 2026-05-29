import { useScriptConfigStore } from '../stores/scriptConfig'
import { useChatStore } from '../stores'
import type { ScriptType, UploadFileData } from '../types'

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
    // Store not available
  }
  return defaultScript
}

function getBase64ToFileCode(file: UploadFileData): string {
  return `
function base64ToFile() {
  var base64 = '${file.base64}';
  var name = '${file.name}';
  var mimeType = '${file.mimeType}';
  var byteChars = atob(base64);
  var bytes = new Uint8Array(byteChars.length);
  for (var i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  var blob = new Blob([bytes], { type: mimeType });
  var file = new File([blob], name, { type: mimeType, lastModified: Date.now() });
  return { file: file, blob: blob };
}`
}

function getInjectToInputCode(): string {
  return `
function injectToInput(fileObj, inputEl) {
  var dt = new DataTransfer();
  dt.items.add(fileObj.file);
  try {
    var nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'files'
    );
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(inputEl, dt.files);
    }
  } catch (e) {
    try { inputEl.files = dt.files; } catch (e2) {}
  }
  try { inputEl.files = dt.files; } catch (e) {}
  ['change', 'input'].forEach(function(evtName) {
    try {
      var evt = new Event(evtName, { bubbles: true });
      Object.defineProperty(evt, 'target', { value: inputEl, writable: false });
      inputEl.dispatchEvent(evt);
    } catch (e) {}
  });
  try {
    var tracker = inputEl._valueTracker;
    if (tracker) tracker.setValue('dummy');
  } catch (e) {}
}`
}

function getDispatchDragDropCode(): string {
  return `
function dispatchDragDrop(target, file) {
  var dt = new DataTransfer();
  dt.items.add(file);
  ['dragenter', 'dragover'].forEach(function(evtName) {
    var evt = new DragEvent(evtName, {
      bubbles: true, cancelable: true, dataTransfer: dt
    });
    target.dispatchEvent(evt);
  });
  var dropEvt = new DragEvent('drop', {
    bubbles: true, cancelable: true, dataTransfer: dt
  });
  target.dispatchEvent(dropEvt);
}`
}

function getChatGPTUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  var fileObj = base64ToFile();
  var uploadBtn = document.querySelector('[data-testid="file-upload-button"]')
    || document.querySelector('button[aria-label*="Upload" i]')
    || document.querySelector('button[aria-label*="Attach" i]');
  if (uploadBtn) uploadBtn.click();
  setTimeout(function() {
    var inputs = document.querySelectorAll('input[type="file"]');
    if (inputs.length > 0) injectToInput(fileObj, inputs[0]);
  }, 800);
  setTimeout(function() {
    var fallback = document.querySelector('input[type="file"]');
    if (fallback) injectToInput(fileObj, fallback);
  }, 1500);
  return 'pending';
})()`
}

function getDeepSeekUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  var fileObj = base64ToFile();
  var textarea = document.querySelector('textarea');
  var inputArea = textarea
    ? textarea.closest('form') || textarea.closest('[class*="chat"]') || textarea.closest('[class*="input"]') || textarea.parentElement.parentElement
    : document.body;
  var allFileInputs = document.querySelectorAll('input[type="file"]');
  if (allFileInputs.length > 0) {
    var target = null;
    for (var j = 0; j < allFileInputs.length; j++) {
      var s = getComputedStyle(allFileInputs[j]);
      if (s.display !== 'none' && s.visibility !== 'hidden') {
        target = allFileInputs[j]; break;
      }
    }
    if (!target) target = allFileInputs[0];
    injectToInput(fileObj, target);
    return { success: true, message: 'Injected into file input' };
  }
  var uploadBtn = document.querySelector(
    'button[class*="upload"], button[class*="attach"], label[for*="upload"], label[for*="file"]'
  );
  if (uploadBtn) {
    uploadBtn.click();
    setTimeout(function() {
      var newInputs = document.querySelectorAll('input[type="file"]');
      for (var k = 0; k < newInputs.length; k++) {
        if (newInputs[k].files.length === 0) {
          injectToInput(fileObj, newInputs[k]); break;
        }
      }
    }, 800);
    return { success: true, message: 'Clicked upload button' };
  }
  return { success: false, message: 'No upload mechanism found' };
})()`
}

function getKimiUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  ${getDispatchDragDropCode()}
  var fileObj = base64ToFile();
  var injectDone = false;
  function tryInject(inputEl) {
    if (injectDone || !inputEl || inputEl.tagName !== 'INPUT' || inputEl.type !== 'file') return false;
    injectToInput(fileObj, inputEl);
    setTimeout(function() {
      if (inputEl.files.length > 0) injectDone = true;
    }, 300);
    return true;
  }
  var chatInput = document.querySelector('[role="textbox"][contenteditable="true"]');
  if (chatInput) {
    var container = chatInput.closest('form, [class*="chat"], [class*="input"], [class*="footer"]')
      || chatInput.parentElement;
    var nearbyInputs = container.querySelectorAll('input[type="file"]');
    if (nearbyInputs.length > 0 && tryInject(nearbyInputs[0])) {
      return { success: true, message: 'Injected via nearby input' };
    }
  }
  var allInputs = document.querySelectorAll('input[type="file"]');
  if (allInputs.length > 0 && tryInject(allInputs[0])) {
    return { success: true, message: 'Injected via global input' };
  }
  var uploadBtn = document.querySelector(
    'button[class*="upload"], button[class*="attach"], label[for*="upload"], [class*="upload-btn"]'
  );
  if (uploadBtn && !injectDone) {
    uploadBtn.click();
    setTimeout(function() {
      var newInputs = document.querySelectorAll('input[type="file"]');
      for (var k = 0; k < newInputs.length; k++) {
        if (newInputs[k].files.length === 0) {
          injectToInput(fileObj, newInputs[k]); injectDone = true; break;
        }
      }
    }, 1000);
    return { success: true, message: 'Clicked upload button' };
  }
  if (!injectDone) {
    var target = chatInput || document.querySelector('[contenteditable="true"]') || document.body;
    try {
      dispatchDragDrop(target, fileObj.file);
      return { success: true, message: 'Drop event dispatched' };
    } catch (e) {}
  }
  return { success: false, message: 'No upload mechanism found' };
})()`
}

function getDouBaoUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  ${getDispatchDragDropCode()}
  var fileObj = base64ToFile();
  var allInputs = document.querySelectorAll('input[type="file"]');
  if (allInputs.length > 0) {
    injectToInput(fileObj, allInputs[0]);
    setTimeout(function() {
      if (allInputs[0].files.length === 0) {
        var chatArea = document.querySelector('[contenteditable="true"]') || document.body;
        dispatchDragDrop(chatArea, fileObj.file);
      }
    }, 500);
    return { success: true, message: 'Injected into file input' };
  }
  var attachBtn = document.querySelector('[class*="attach"]') || document.querySelector('[class*="upload"]');
  if (attachBtn) {
    attachBtn.click();
    setTimeout(function() {
      var newInputs = document.querySelectorAll('input[type="file"]');
      if (newInputs.length > 0) injectToInput(fileObj, newInputs[0]);
    }, 1000);
    return { success: true, message: 'Clicked attach button' };
  }
  var chatArea = document.querySelector('[contenteditable="true"]') || document.body;
  try {
    dispatchDragDrop(chatArea, fileObj.file);
    return { success: true, message: 'Drop event dispatched' };
  } catch (e) {}
  return { success: false, message: 'No upload mechanism found' };
})()`
}

function getYuanBaoUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getDispatchDragDropCode()}
  var fileObj = base64ToFile();
  var editor = document.querySelector('.ql-editor');
  if (editor) {
    try {
      dispatchDragDrop(editor, fileObj.file);
      return { success: true, message: 'Drag/drop on ql-editor' };
    } catch (e) {}
  }
  try {
    dispatchDragDrop(document.body, fileObj.file);
    return { success: true, message: 'Drop on body' };
  } catch (e) {}
  return { success: false, message: 'Drag/drop upload failed' };
})()`
}

function getGLMUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  var fileObj = base64ToFile();
  var allFileInputs = document.querySelectorAll('input[type="file"]');
  if (allFileInputs.length > 0) {
    var target = null;
    for (var j = 0; j < allFileInputs.length; j++) {
      var s = getComputedStyle(allFileInputs[j]);
      if (s.display !== 'none' && s.visibility !== 'hidden') {
        target = allFileInputs[j]; break;
      }
    }
    if (!target) target = allFileInputs[0];
    injectToInput(fileObj, target);
    return { success: true, message: 'Injected into file input' };
  }
  var uploadBtn = document.querySelector(
    'button[class*="upload"], button[class*="attach"], label[for*="upload"], label[for*="file"]'
  );
  if (uploadBtn) {
    uploadBtn.click();
    setTimeout(function() {
      var newInputs = document.querySelectorAll('input[type="file"]');
      for (var k = 0; k < newInputs.length; k++) {
        if (newInputs[k].files.length === 0) {
          injectToInput(fileObj, newInputs[k]); break;
        }
      }
    }, 800);
    return { success: true, message: 'Clicked upload button' };
  }
  return { success: false, message: 'No upload mechanism found' };
})()`
}

function getMimoUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  ${getDispatchDragDropCode()}
  var fileObj = base64ToFile();
  var injectDone = false;
  var textarea = document.querySelector('textarea');
  if (textarea) {
    var inputArea = textarea.closest('form')
      || textarea.closest('[class*="chat"]')
      || textarea.closest('[class*="input"]')
      || textarea.parentElement.parentElement;
    var nearbyInputs = inputArea.querySelectorAll('input[type="file"]');
    if (nearbyInputs.length > 0) {
      injectToInput(fileObj, nearbyInputs[0]);
      injectDone = true;
    }
  }
  if (!injectDone) {
    var allInputs = document.querySelectorAll('input[type="file"]');
    if (allInputs.length > 0) {
      injectToInput(fileObj, allInputs[0]);
      injectDone = true;
    }
  }
  if (!injectDone) {
    var uploadBtn = document.querySelector(
      'button[class*="upload"], button[class*="attach"], label[for*="upload"]'
    );
    if (uploadBtn) {
      uploadBtn.click();
      setTimeout(function() {
        var newInputs = document.querySelectorAll('input[type="file"]');
        for (var k = 0; k < newInputs.length; k++) {
          if (newInputs[k].files.length === 0) {
            injectToInput(fileObj, newInputs[k]); break;
          }
        }
      }, 800);
      return { success: true, message: 'Clicked upload button' };
    }
  }
  if (!injectDone) {
    var target = textarea || document.querySelector('[contenteditable="true"]') || document.body;
    try {
      dispatchDragDrop(target, fileObj.file);
      return { success: true, message: 'Drop event dispatched' };
    } catch (e) {}
  }
  return injectDone
    ? { success: true, message: 'File injected' }
    : { success: false, message: 'No upload mechanism found' };
})()`
}

function getGenericUploadScript(file: UploadFileData): string {
  return `(function() {
  ${getBase64ToFileCode(file)}
  ${getInjectToInputCode()}
  ${getDispatchDragDropCode()}
  var fileObj = base64ToFile();
  var allInputs = document.querySelectorAll('input[type="file"]');
  if (allInputs.length > 0) {
    injectToInput(fileObj, allInputs[0]);
    return { success: true, message: 'Injected into file input' };
  }
  var uploadBtn = document.querySelector(
    'button[class*="upload" i], button[class*="attach" i], button[aria-label*="upload" i], button[aria-label*="attach" i], label[for*="upload"], label[for*="file"]'
  );
  if (uploadBtn) {
    uploadBtn.click();
    setTimeout(function() {
      var newInputs = document.querySelectorAll('input[type="file"]');
      if (newInputs.length > 0) injectToInput(fileObj, newInputs[0]);
    }, 1000);
    return { success: true, message: 'Clicked upload button' };
  }
  var chatInput = document.querySelector('[contenteditable="true"]')
    || document.querySelector('textarea')
    || document.body;
  try {
    dispatchDragDrop(chatInput, fileObj.file);
    return { success: true, message: 'Drop event dispatched' };
  } catch (e) {}
  return { success: false, message: 'No upload mechanism found' };
})()`
}

export function getFileUploadScript(providerId: string, file: UploadFileData): string {
  const scripts: Record<string, string> = {
    chatgpt: getChatGPTUploadScript(file),
    gemini: getGenericUploadScript(file),
    deepseek: getDeepSeekUploadScript(file),
    kimi: getKimiUploadScript(file),
    doubao: getDouBaoUploadScript(file),
    qwen: getGenericUploadScript(file),
    grok: getGenericUploadScript(file),
    yuanbao: getYuanBaoUploadScript(file),
    copilot: getGenericUploadScript(file),
    glm: getGLMUploadScript(file),
    miromind: getGenericUploadScript(file),
    mimo: getMimoUploadScript(file),
    minimax: getGenericUploadScript(file)
  }

  const defaultScript = scripts[providerId] || getGenericUploadScript(file)

  try {
    const chatStore = useChatStore()
    const provider = chatStore.getProvider(providerId)
    if (provider?.isCustom && provider.customConfig?.fileUploadScript) {
      return resolveScript(providerId, 'fileUpload', provider.customConfig.fileUploadScript, {
        name: file.name,
        mimeType: file.mimeType,
        base64: file.base64
      })
    }
  } catch {
    // Store not available
  }

  return resolveScript(providerId, 'fileUpload', defaultScript, {
    name: file.name,
    mimeType: file.mimeType,
    base64: file.base64
  })
}

export function getFileUploadSupportedProviders(): string[] {
  return [
    'chatgpt', 'gemini', 'deepseek', 'kimi', 'doubao', 'qwen',
    'grok', 'yuanbao', 'copilot', 'glm', 'miromind', 'mimo', 'minimax'
  ]
}
