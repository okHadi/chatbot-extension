// Content Script for AI Chatbot Extension
// Handles page content extraction, element selection, and panel toggle

let pickerEnabled = false;
let highlightedElement = null;
let overlay = null;

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'TOGGLE_PANEL':
            if (window.aiChatbotPanel) {
                window.aiChatbotPanel.toggle();
            }
            sendResponse({ success: true });
            break;
        case 'GET_PAGE_CONTENT':
            sendResponse(getPageContent());
            break;
        case 'ENABLE_PICKER':
            enablePicker();
            sendResponse({ success: true });
            break;
        case 'DISABLE_PICKER':
            disablePicker();
            sendResponse({ success: true });
            break;
        case 'ELEMENT_SELECTED':
            // Forward to panel
            if (window.aiChatbotPanel) {
                window.aiChatbotPanel.handleElementSelected(message.data);
            }
            break;
        default:
            sendResponse({ error: 'Unknown message type' });
    }
    return true; // Keep channel open for async response
});

// Get page content
function getPageContent() {
    const content = {
        url: window.location.href,
        title: document.title,
        description: getMetaDescription(),
        headings: getHeadings(),
        mainContent: getMainContent(),
        links: getLinks(),
        html: document.documentElement.outerHTML.substring(0, 50000) // First 50k chars of HTML
    };
    return content;
}

// Get meta description
function getMetaDescription() {
    const meta = document.querySelector('meta[name="description"]');
    return meta ? meta.getAttribute('content') : '';
}

// Get all headings
function getHeadings() {
    const headings = [];
    document.querySelectorAll('h1, h2, h3').forEach(h => {
        headings.push({
            level: parseInt(h.tagName[1]),
            text: h.textContent.trim().substring(0, 200)
        });
    });
    return headings.slice(0, 20); // Limit to 20 headings
}

// Get main text content
function getMainContent() {
    // Try to find main content area
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.article'];
    let mainEl = null;

    for (const selector of mainSelectors) {
        mainEl = document.querySelector(selector);
        if (mainEl) break;
    }

    if (!mainEl) {
        mainEl = document.body;
    }

    // Get text content, removing scripts and styles
    const clone = mainEl.cloneNode(true);
    clone.querySelectorAll('script, style, nav, footer, header, aside, #ai-chatbot-panel').forEach(el => el.remove());

    const text = clone.textContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to 5000 chars

    return text;
}

// Get important links
function getLinks() {
    const links = [];
    document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent.trim();
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            links.push({
                text: text.substring(0, 100),
                href: href
            });
        }
    });
    return links.slice(0, 20); // Limit to 20 links
}

// Enable element picker
function enablePicker() {
    if (pickerEnabled) return;
    pickerEnabled = true;

    // Create overlay for highlighting
    createOverlay();

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    // Change cursor
    document.body.style.cursor = 'crosshair';
}

// Disable element picker
function disablePicker() {
    if (!pickerEnabled) return;
    pickerEnabled = false;

    // Remove overlay
    if (overlay) {
        overlay.remove();
        overlay = null;
    }

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    // Reset cursor
    document.body.style.cursor = '';

    // Clear highlight
    highlightedElement = null;
}

// Create highlight overlay
function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'ai-chatbot-picker-overlay';
    overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    border: 2px solid #6366f1;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 4px;
    transition: all 0.1s ease;
    display: none;
  `;
    document.body.appendChild(overlay);
}

// Handle mouse move for highlighting
function handleMouseMove(e) {
    if (!pickerEnabled) return;

    const element = document.elementFromPoint(e.clientX, e.clientY);
    // Don't highlight the panel or overlay elements
    if (!element || element === overlay || element.closest('#ai-chatbot-panel')) return;

    highlightedElement = element;

    // Update overlay position
    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
}

// Handle click to select element
function handleClick(e) {
    if (!pickerEnabled || !highlightedElement) return;

    // Don't select panel elements
    if (e.target.closest('#ai-chatbot-panel')) return;

    e.preventDefault();
    e.stopPropagation();

    // Get element info - NO TRUNCATION, send full data
    const elementInfo = {
        tagName: highlightedElement.tagName.toLowerCase(),
        id: highlightedElement.id,
        className: highlightedElement.className,
        textContent: highlightedElement.textContent.trim(),
        outerHTML: highlightedElement.outerHTML,
        attributes: getElementAttributes(highlightedElement),
        computedStyles: getComputedStylesSubset(highlightedElement)
    };

    // Notify panel directly
    if (window.aiChatbotPanel) {
        window.aiChatbotPanel.handleElementSelected(elementInfo);
    }

    // Disable picker
    disablePicker();
}

// Handle escape key to cancel
function handleKeyDown(e) {
    if (e.key === 'Escape' && pickerEnabled) {
        disablePicker();
    }
}

// Get element attributes
function getElementAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
        attrs[attr.name] = attr.value.substring(0, 200);
    }
    return attrs;
}

// Get subset of computed styles
function getComputedStylesSubset(element) {
    const computed = window.getComputedStyle(element);
    return {
        display: computed.display,
        position: computed.position,
        width: computed.width,
        height: computed.height,
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily
    };
}

// Make functions available globally for panel.js
window.getPageContent = getPageContent;
window.enablePicker = enablePicker;
window.disablePicker = disablePicker;
