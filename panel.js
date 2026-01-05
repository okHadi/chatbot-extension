// Injected Panel Script for AI Chatbot Extension
// This creates a sidebar panel that's part of the webpage using Shadow DOM for isolation

// State
let chatHistory = [];
let selectedElement = null;
let isLoading = false;
let isPanelOpen = false;
let shadowRoot = null;

// Server URL
const SERVER_URL = 'http://localhost:3000';

// CSS styles (embedded to avoid style conflicts)
const PANEL_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :host {
    all: initial;
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 380px !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  }

  .panel {
    width: 100%;
    height: 100%;
    background: #0f0f0f;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    font-size: 14px;
    color: #ffffff;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
    transition: transform 0.3s ease;
  }

  .panel.hidden {
    transform: translateX(100%);
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #1a1a1a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    font-size: 22px;
  }

  .logo h1 {
    font-size: 15px;
    font-weight: 600;
    color: #818cf8;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .model-select {
    background: #252525;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .model-select:hover {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .close-btn, .clear-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: #ef4444;
    color: white;
    border-color: #ef4444;
  }

  .clear-btn:hover {
    background: #f59e0b;
    color: white;
    border-color: #f59e0b;
  }

  /* Context Options */
  .context-options {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    background: #1a1a1a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .context-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 6px;
    background: #252525;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #ffffff;
  }

  .context-btn:hover {
    background: #2a2a2a;
    border-color: rgba(99, 102, 241, 0.4);
  }

  .context-btn.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
  }

  .context-btn .icon {
    font-size: 16px;
  }

  .context-btn .label {
    font-size: 10px;
    color: #888;
    font-weight: 500;
  }

  .context-btn.active .label {
    color: #a5b4fc;
  }

  /* Element Preview */
  .element-preview {
    margin: 8px 12px;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    display: none;
  }

  .element-preview.visible {
    display: block;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: #252525;
    font-size: 11px;
    color: #888;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .clear-btn:hover {
    background: #ef4444;
    color: white;
  }

  .preview-content {
    padding: 6px 10px;
    font-size: 10px;
    font-family: 'Monaco', 'Menlo', monospace;
    color: #888;
    max-height: 50px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .messages::-webkit-scrollbar {
    width: 5px;
  }

  .messages::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 3px;
  }

  .welcome {
    text-align: center;
    padding: 30px 16px;
    color: #888;
  }

  .welcome p {
    margin-bottom: 6px;
    font-size: 13px;
  }

  /* Message Bubbles */
  .message {
    max-width: 88%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.45;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message.user {
    align-self: flex-end;
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message.assistant {
    align-self: flex-start;
    background: #1e1e1e;
    color: #e0e0e0;
    border-bottom-left-radius: 4px;
  }

  .message.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #f87171;
  }

  .message-context {
    font-size: 10px;
    margin-bottom: 5px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .context-tag {
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 6px;
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Typing Indicator */
  .typing {
    display: flex;
    gap: 4px;
    padding: 12px 14px;
    background: #1e1e1e;
    border-radius: 12px;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }

  .typing span {
    width: 6px;
    height: 6px;
    background: #555;
    border-radius: 50%;
    animation: typingAnim 1.2s infinite;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes typingAnim {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }

  /* Input Area */
  .input-area {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: #1a1a1a;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .input-field {
    flex: 1;
    background: #252525;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 13px;
    resize: none;
    min-height: 40px;
    max-height: 100px;
    font-family: inherit;
    outline: none;
  }

  .input-field::placeholder {
    color: #555;
  }

  .input-field:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .send-btn {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #6366f1, #818cf8);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .send-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .send-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Status Bar */
  .status {
    font-size: 11px;
    color: #555;
    text-align: center;
    background: #1a1a1a;
    flex-shrink: 0;
    height: 0;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .status.visible {
    padding: 6px 12px;
    height: auto;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status.success {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .status.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .status.warning {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
  }
`;

// Create and inject the panel
function createPanel() {
    // Check if panel already exists
    if (document.getElementById('ai-chatbot-host')) {
        return;
    }

    // Create host element
    const host = document.createElement('div');
    host.id = 'ai-chatbot-host';
    host.style.cssText = 'all: initial !important;';

    // Create shadow root for style isolation
    shadowRoot = host.attachShadow({ mode: 'open' });

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = PANEL_STYLES;
    shadowRoot.appendChild(styleEl);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
    <div class="header">
      <div class="logo">
        <span class="logo-icon">🤖</span>
        <h1>AI Assistant</h1>
      </div>
      <div class="header-actions">
        <select class="model-select" id="model-select">
          <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
          <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
          <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B Vision</option>
          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
        </select>
        <button class="clear-btn" id="clear-btn" title="Clear chat">🗑️</button>
        <button class="close-btn" id="close-btn" title="Close panel">✕</button>
      </div>
    </div>

    <div class="context-options">
      <button class="context-btn" id="btn-page" title="Read page content">
        <span class="icon">📄</span>
        <span class="label">Page</span>
      </button>
      <button class="context-btn" id="btn-screenshot" title="Take screenshot">
        <span class="icon">📸</span>
        <span class="label">Screenshot</span>
      </button>
      <button class="context-btn" id="btn-element" title="Select element">
        <span class="icon">🎯</span>
        <span class="label">Element</span>
      </button>
    </div>

    <div class="element-preview" id="element-preview">
      <div class="preview-header">
        <span>Selected Element</span>
        <button class="clear-btn" id="clear-element">✕</button>
      </div>
      <div class="preview-content" id="element-content"></div>
    </div>

    <div class="messages" id="messages">
      <div class="welcome">
        <p>👋 Hi! I'm your AI assistant.</p>
        <p>Toggle options above to share page context!</p>
      </div>
    </div>

    <div class="input-area">
      <textarea class="input-field" id="input" placeholder="Ask me anything..." rows="1"></textarea>
      <button class="send-btn" id="send-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2"/>
        </svg>
      </button>
    </div>

    <div class="status" id="status"></div>
  `;

    shadowRoot.appendChild(panel);
    document.body.appendChild(host);

    // Setup event listeners
    setupPanelEventListeners();

    // Load saved state
    loadPanelState();
}

// Get element from shadow root
function $(id) {
    return shadowRoot ? shadowRoot.getElementById(id) : null;
}

// Setup event listeners for the panel
function setupPanelEventListeners() {
    const closeBtn = $('close-btn');
    const clearBtn = $('clear-btn');
    const btnPage = $('btn-page');
    const btnScreenshot = $('btn-screenshot');
    const btnElement = $('btn-element');
    const clearElementBtn = $('clear-element');
    const sendBtn = $('send-btn');
    const messageInput = $('input');
    const modelSelect = $('model-select');

    closeBtn.addEventListener('click', togglePanel);
    clearBtn.addEventListener('click', clearChat);
    btnPage.addEventListener('click', () => toggleContextBtn(btnPage));
    btnScreenshot.addEventListener('click', () => toggleContextBtn(btnScreenshot));
    btnElement.addEventListener('click', handleElementSelect);
    clearElementBtn.addEventListener('click', clearSelectedElement);

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
    });

    modelSelect.addEventListener('change', savePanelState);
}

// Clear chat history
function clearChat() {
    chatHistory = [];
    const messagesContainer = $('messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="welcome">
                <p>👋 Hi! I'm your AI assistant.</p>
                <p>Toggle options above to share page context!</p>
            </div>
        `;
    }
    chrome.storage.local.remove('chatHistory');
    showStatus('Chat cleared!', 'success');
    setTimeout(() => clearStatus(), 2000);
}

// Toggle panel visibility
function togglePanel() {
    const host = document.getElementById('ai-chatbot-host');
    if (!host) {
        createPanel();
        isPanelOpen = true;
    } else {
        const panel = shadowRoot.querySelector('.panel');
        isPanelOpen = !isPanelOpen;
        panel.classList.toggle('hidden', !isPanelOpen);
    }

    if (!isPanelOpen && typeof window.disablePicker === 'function') {
        window.disablePicker();
    }
}

// Toggle context button
function toggleContextBtn(btn) {
    btn.classList.toggle('active');
}

// Handle element selection
function handleElementSelect() {
    const btnElement = $('btn-element');
    const isActive = btnElement.classList.contains('active');

    if (isActive) {
        btnElement.classList.remove('active');
        if (typeof window.disablePicker === 'function') {
            window.disablePicker();
        }
    } else {
        btnElement.classList.add('active');
        showStatus('Click on an element to select it...', 'warning');
        if (typeof window.enablePicker === 'function') {
            window.enablePicker();
        }
    }
}

// Handle element selected
function handleElementSelectedForPanel(data) {
    selectedElement = data;

    const elementPreview = $('element-preview');
    const elementContent = $('element-content');
    const btnElement = $('btn-element');

    if (elementPreview && elementContent && btnElement) {
        elementContent.textContent = data.outerHTML.substring(0, 200) + (data.outerHTML.length > 200 ? '...' : '');
        elementPreview.classList.add('visible');
        btnElement.classList.add('active');
        showStatus('Element selected!', 'success');
        setTimeout(() => clearStatus(), 2000);
    }

    chrome.storage.local.set({ selectedElement: data });
}

// Clear selected element
function clearSelectedElement() {
    selectedElement = null;
    const elementPreview = $('element-preview');
    const btnElement = $('btn-element');

    if (elementPreview) elementPreview.classList.remove('visible');
    if (btnElement) btnElement.classList.remove('active');

    chrome.storage.local.remove('selectedElement');
}

// Send message
async function sendMessage() {
    const messageInput = $('input');
    const sendBtn = $('send-btn');
    const modelSelect = $('model-select');

    const text = messageInput.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';

    const context = await gatherContext();

    const userMessage = {
        role: 'user',
        content: text,
        context: context.flags,
        timestamp: Date.now()
    };
    chatHistory.push(userMessage);
    renderMessage(userMessage);

    const welcome = shadowRoot.querySelector('.welcome');
    if (welcome) welcome.remove();

    const typingEl = showTypingIndicator();

    try {
        const response = await fetch(`${SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                model: modelSelect.value,
                context: context.data,
                history: chatHistory.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();

        const assistantMessage = {
            role: 'assistant',
            content: data.response,
            timestamp: Date.now()
        };
        chatHistory.push(assistantMessage);

        typingEl.remove();
        renderMessage(assistantMessage);

    } catch (error) {
        typingEl.remove();
        renderMessage({
            role: 'assistant',
            content: `Error: ${error.message}. Make sure the server is running.`,
            isError: true,
            timestamp: Date.now()
        });
    }

    isLoading = false;
    sendBtn.disabled = false;
    savePanelState();
    scrollToBottom();
}

// Gather context
async function gatherContext() {
    const flags = [];
    const data = {};

    const btnPage = $('btn-page');
    const btnScreenshot = $('btn-screenshot');

    if (btnPage && btnPage.classList.contains('active')) {
        flags.push('page');
        if (typeof window.getPageContent === 'function') {
            data.pageContent = window.getPageContent();
        }
    }

    if (btnScreenshot && btnScreenshot.classList.contains('active')) {
        flags.push('screenshot');
        try {
            const screenshot = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(response);
                });
            });
            if (screenshot && !screenshot.error) data.screenshot = screenshot;
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
        }
    }

    if (selectedElement) {
        flags.push('element');
        data.element = selectedElement;
    }

    return { flags, data };
}

// Render message
function renderMessage(message) {
    const messagesContainer = $('messages');
    if (!messagesContainer) return;

    const msgEl = document.createElement('div');
    msgEl.className = `message ${message.role}${message.isError ? ' error' : ''}`;

    if (message.context && message.context.length > 0) {
        const contextEl = document.createElement('div');
        contextEl.className = 'message-context';
        message.context.forEach(ctx => {
            const tag = document.createElement('span');
            tag.className = 'context-tag';
            tag.textContent = ctx === 'page' ? '📄 Page' : ctx === 'screenshot' ? '📸 Screenshot' : '🎯 Element';
            contextEl.appendChild(tag);
        });
        msgEl.appendChild(contextEl);
    }

    const contentEl = document.createElement('div');
    contentEl.textContent = message.content;
    msgEl.appendChild(contentEl);

    messagesContainer.appendChild(msgEl);
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    const messagesContainer = $('messages');
    const typingEl = document.createElement('div');
    typingEl.className = 'typing';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(typingEl);
    scrollToBottom();
    return typingEl;
}

// Scroll to bottom
function scrollToBottom() {
    const messagesContainer = $('messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Status helpers
function showStatus(message, type = '') {
    const statusBar = $('status');
    if (statusBar) {
        statusBar.textContent = message;
        statusBar.className = `status visible ${type}`;
    }
}

function clearStatus() {
    const statusBar = $('status');
    if (statusBar) {
        statusBar.textContent = '';
        statusBar.className = 'status';
    }
}

// Load state
async function loadPanelState() {
    try {
        const result = await chrome.storage.local.get(['chatHistory', 'selectedModel', 'selectedElement']);

        if (result.chatHistory && result.chatHistory.length > 0) {
            chatHistory = result.chatHistory;
            const welcome = shadowRoot.querySelector('.welcome');
            if (welcome) welcome.remove();
            chatHistory.forEach(msg => renderMessage(msg));
        }

        if (result.selectedModel) {
            const modelSelect = $('model-select');
            if (modelSelect) modelSelect.value = result.selectedModel;
        }

        if (result.selectedElement) {
            selectedElement = result.selectedElement;
            const elementPreview = $('element-preview');
            const elementContent = $('element-content');
            const btnElement = $('btn-element');

            if (elementPreview && elementContent && btnElement) {
                elementContent.textContent = selectedElement.outerHTML.substring(0, 200) + (selectedElement.outerHTML.length > 200 ? '...' : '');
                elementPreview.classList.add('visible');
                btnElement.classList.add('active');
            }
        }
    } catch (error) {
        console.error('Failed to load panel state:', error);
    }
}

// Save state
async function savePanelState() {
    try {
        const modelSelect = $('model-select');
        await chrome.storage.local.set({
            chatHistory: chatHistory.slice(-50),
            selectedModel: modelSelect ? modelSelect.value : 'llama-3.3-70b-versatile'
        });
    } catch (error) {
        console.error('Failed to save panel state:', error);
    }
}

// Export for use by content.js
window.aiChatbotPanel = {
    toggle: togglePanel,
    handleElementSelected: handleElementSelectedForPanel,
    isOpen: () => isPanelOpen
};
