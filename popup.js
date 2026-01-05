// Popup Script for AI Chatbot Extension

// State
let chatHistory = [];
let selectedElement = null;
let isLoading = false;

// DOM Elements
const modelSelect = document.getElementById('model-select');
const btnPage = document.getElementById('btn-page');
const btnScreenshot = document.getElementById('btn-screenshot');
const btnElement = document.getElementById('btn-element');
const elementPreview = document.getElementById('element-preview');
const elementContent = document.getElementById('element-content');
const clearElementBtn = document.getElementById('clear-element');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const statusBar = document.getElementById('status-bar');

// Server URL
const SERVER_URL = 'http://localhost:3000';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  setupEventListeners();
});

// Load saved state from storage
async function loadState() {
  try {
    const result = await chrome.storage.local.get(['chatHistory', 'selectedModel', 'selectedElement']);
    if (result.chatHistory) {
      chatHistory = result.chatHistory;
      renderChatHistory();
    }
    if (result.selectedModel) {
      modelSelect.value = result.selectedModel;
    }
    // Load selected element if it exists
    if (result.selectedElement) {
      selectedElement = result.selectedElement;
      elementContent.textContent = selectedElement.outerHTML.substring(0, 200) + (selectedElement.outerHTML.length > 200 ? '...' : '');
      elementPreview.style.display = 'block';
      btnElement.setAttribute('data-active', 'true');
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

// Save state to storage
async function saveState() {
  try {
    await chrome.storage.local.set({
      chatHistory: chatHistory.slice(-50), // Keep last 50 messages
      selectedModel: modelSelect.value
    });
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Context buttons
  btnPage.addEventListener('click', () => toggleContextBtn(btnPage));
  btnScreenshot.addEventListener('click', () => toggleContextBtn(btnScreenshot));
  btnElement.addEventListener('click', handleElementSelect);

  // Clear selected element
  clearElementBtn.addEventListener('click', clearSelectedElement);

  // Send message
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  });

  // Model change
  modelSelect.addEventListener('change', saveState);

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ELEMENT_SELECTED') {
      handleElementSelected(message.data);
    }
  });
}

// Toggle context button
function toggleContextBtn(btn) {
  const isActive = btn.getAttribute('data-active') === 'true';
  btn.setAttribute('data-active', !isActive);
}

// Handle element selection
async function handleElementSelect() {
  const isActive = btnElement.getAttribute('data-active') === 'true';

  if (isActive) {
    // Disable element selection
    btnElement.setAttribute('data-active', 'false');
    try {
      await sendToContentScript({ type: 'DISABLE_PICKER' });
    } catch (e) {
      // Ignore errors when disabling
    }
  } else {
    // Enable element selection
    btnElement.setAttribute('data-active', 'true');
    showStatus('Click on an element to select it...', 'warning');

    try {
      await sendToContentScript({ type: 'ENABLE_PICKER' });
    } catch (error) {
      console.error('Failed to enable picker, trying to inject script:', error);
      // Try to inject content script and retry
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Also inject CSS
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content.css']
          });
          // Wait a bit for script to load
          await new Promise(resolve => setTimeout(resolve, 100));
          await sendToContentScript({ type: 'ENABLE_PICKER' });
          showStatus('Click on an element to select it...', 'warning');
        }
      } catch (retryError) {
        console.error('Failed to inject and enable picker:', retryError);
        showStatus('Failed to enable element picker', 'error');
        btnElement.setAttribute('data-active', 'false');
      }
    }
  }
}

// Handle element selected from content script
async function handleElementSelected(data) {
  selectedElement = data;
  // Save to storage so it persists when popup closes
  try {
    await chrome.storage.local.set({ selectedElement: data });
  } catch (error) {
    console.error('Failed to save selected element:', error);
  }
  elementContent.textContent = data.outerHTML.substring(0, 200) + (data.outerHTML.length > 200 ? '...' : '');
  elementPreview.style.display = 'block';
  btnElement.setAttribute('data-active', 'true');
  showStatus('Element selected!', 'success');
  setTimeout(() => clearStatus(), 2000);
}

// Clear selected element
async function clearSelectedElement() {
  selectedElement = null;
  elementPreview.style.display = 'none';
  btnElement.setAttribute('data-active', 'false');
  // Remove from storage
  try {
    await chrome.storage.local.remove('selectedElement');
  } catch (error) {
    console.error('Failed to clear selected element:', error);
  }
}

// Send message to chat
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isLoading) return;

  isLoading = true;
  sendBtn.disabled = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // Gather context
  const context = await gatherContext();

  // Add user message
  const userMessage = {
    role: 'user',
    content: text,
    context: context.flags,
    timestamp: Date.now()
  };
  chatHistory.push(userMessage);
  renderMessage(userMessage);

  // Remove welcome message
  const welcome = chatContainer.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // Show typing indicator
  const typingEl = showTypingIndicator();

  try {
    // Send to server
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

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // Add assistant message
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

    const errorMessage = {
      role: 'assistant',
      content: `Error: ${error.message}. Make sure the server is running at ${SERVER_URL}`,
      isError: true,
      timestamp: Date.now()
    };
    renderMessage(errorMessage);
  }

  isLoading = false;
  sendBtn.disabled = false;
  saveState();
  scrollToBottom();
}

// Gather context based on active options
async function gatherContext() {
  const flags = [];
  const data = {};

  // Page content
  if (btnPage.getAttribute('data-active') === 'true') {
    flags.push('page');
    try {
      // First try to send to existing content script
      const pageData = await sendToContentScript({ type: 'GET_PAGE_CONTENT' });
      data.pageContent = pageData;
      console.log('Page content gathered:', pageData);
    } catch (error) {
      console.error('Failed to get page content, trying to inject script:', error);
      // Try to inject content script and retry
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Wait a bit for script to load
          await new Promise(resolve => setTimeout(resolve, 100));
          const pageData = await sendToContentScript({ type: 'GET_PAGE_CONTENT' });
          data.pageContent = pageData;
          console.log('Page content gathered after injection:', pageData);
        }
      } catch (retryError) {
        console.error('Failed to inject and get page content:', retryError);
        showStatus('Failed to read page content', 'error');
      }
    }
  }

  // Screenshot
  if (btnScreenshot.getAttribute('data-active') === 'true') {
    flags.push('screenshot');
    try {
      const screenshot = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      if (screenshot && !screenshot.error) {
        data.screenshot = screenshot;
        console.log('Screenshot captured');
      } else {
        console.error('Screenshot error:', screenshot?.error);
        showStatus('Failed to capture screenshot', 'error');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      showStatus('Failed to capture screenshot', 'error');
    }
  }

  // Selected element
  if (selectedElement) {
    flags.push('element');
    data.element = selectedElement;
  }

  console.log('Context gathered:', { flags, hasPageContent: !!data.pageContent, hasScreenshot: !!data.screenshot, hasElement: !!data.element });
  return { flags, data };
}

// Send message to content script
async function sendToContentScript(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab');

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Render chat history
function renderChatHistory() {
  if (chatHistory.length === 0) return;

  // Remove welcome message
  const welcome = chatContainer.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  chatHistory.forEach(msg => renderMessage(msg, false));
  scrollToBottom();
}

// Render single message
function renderMessage(message, animate = true) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${message.role}${message.isError ? ' error' : ''}`;

  if (!animate) {
    msgEl.style.animation = 'none';
  }

  // Context tags
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

  chatContainer.appendChild(msgEl);
  scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  chatContainer.appendChild(typingEl);
  scrollToBottom();
  return typingEl;
}

// Scroll to bottom of chat
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Status bar helpers
function showStatus(message, type = '') {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`;
}

function clearStatus() {
  statusBar.textContent = '';
  statusBar.className = 'status-bar';
}
