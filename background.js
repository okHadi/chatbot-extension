// Background Service Worker for AI Chatbot Extension

// Listen for extension icon click to toggle the panel
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Send message to content script to toggle panel
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
    } catch (error) {
        // Content script not loaded, inject it first
        console.log('Injecting scripts...');
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['panel.css', 'content.css']
            });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['panel.js', 'content.js']
            });
            // Wait a bit then toggle
            setTimeout(async () => {
                await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
            }, 100);
        } catch (injectError) {
            console.error('Failed to inject scripts:', injectError);
        }
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_SCREENSHOT') {
        captureScreenshot()
            .then(dataUrl => sendResponse(dataUrl))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }

    if (message.type === 'ELEMENT_SELECTED') {
        // Forward to content script panel
        if (sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, message);
        }
    }
});

// Capture screenshot of current tab
async function captureScreenshot() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error('No active tab');

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
            quality: 90
        });

        return dataUrl;
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        throw error;
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('AI Chatbot Extension installed!');
    }
});
