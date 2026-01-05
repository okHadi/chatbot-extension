import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from parent directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for screenshots

// Token limit for page content (~6000 tokens ≈ 18000 characters, using ~3 chars/token estimate)
const MAX_PAGE_TOKENS = 6000;
const MAX_PAGE_CHARS = MAX_PAGE_TOKENS * 3; // ~18000 characters

// Helper function to truncate content to max token limit
function truncateToTokenLimit(content, maxChars = MAX_PAGE_CHARS) {
    if (!content || content.length <= maxChars) {
        return content;
    }
    return content.substring(0, maxChars) + '\n\n[... Content truncated due to size limit ...]';
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, context, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Log incoming request
        console.log('\n' + '='.repeat(80));
        console.log('📨 INCOMING REQUEST');
        console.log('='.repeat(80));
        console.log(`⏰ Time: ${new Date().toLocaleString()}`);
        console.log(`🤖 Model: ${model || 'llama-3.3-70b-versatile'}`);
        console.log(`💬 User Prompt: ${message}`);
        console.log('-'.repeat(80));

        // Log full context data
        if (context?.pageContent) {
            console.log('📄 PAGE CONTENT:');
            console.log(`   URL: ${context.pageContent.url}`);
            console.log(`   Title: ${context.pageContent.title}`);
            console.log(`   Description: ${context.pageContent.description || 'N/A'}`);
            if (context.pageContent.headings?.length > 0) {
                console.log('   Headings:');
                context.pageContent.headings.forEach(h => console.log(`     H${h.level}: ${h.text}`));
            }
            console.log('   Main Content:');
            console.log(context.pageContent.mainContent || 'N/A');
            if (context.pageContent.html) {
                console.log('   Full HTML:');
                console.log(context.pageContent.html);
            }
            console.log('-'.repeat(80));
        }

        if (context?.screenshot) {
            console.log('📸 SCREENSHOT: Captured (base64 data present, length: ' + context.screenshot.length + ' chars)');
            console.log('-'.repeat(80));
        }

        if (context?.element) {
            console.log('🎯 SELECTED ELEMENT:');
            console.log(`   Tag: <${context.element.tagName}>`);
            console.log(`   ID: ${context.element.id || 'none'}`);
            console.log(`   Classes: ${context.element.className || 'none'}`);
            console.log('   Text Content:');
            console.log(context.element.textContent || 'empty');
            console.log('   Full HTML:');
            console.log(context.element.outerHTML || 'N/A');
            console.log('-'.repeat(80));
        }

        if (!context?.pageContent && !context?.screenshot && !context?.element) {
            console.log('📎 Context: None');
            console.log('-'.repeat(80));
        }

        // Build system message with context
        let systemContent = `You are a helpful AI assistant embedded in a Chrome extension. You help users understand and interact with web pages.`;

        // Build user message with context
        let userContent = message;

        // Add page content context
        if (context?.pageContent) {
            const page = context.pageContent;
            systemContent += `\n\nThe user is currently viewing a webpage with the following information:
- URL: ${page.url}
- Title: ${page.title}
- Description: ${page.description || 'N/A'}`;

            if (page.headings && page.headings.length > 0) {
                systemContent += `\n- Headings: ${page.headings.map(h => `H${h.level}: ${h.text}`).join(', ')}`;
            }

            if (page.mainContent) {
                // Truncate page content to stay within token limits
                const truncatedContent = truncateToTokenLimit(page.mainContent);
                systemContent += `\n\nPage content:\n${truncatedContent}`;
            }
        }

        // Add selected element context
        if (context?.element) {
            const el = context.element;
            systemContent += `\n\nThe user has selected an HTML element:
- Tag: <${el.tagName}>
- ID: ${el.id || 'none'}
- Classes: ${el.className || 'none'}
- Text content: ${el.textContent || 'empty'}
- Full HTML: ${el.outerHTML || 'N/A'}`;
        }

        // Build messages array
        const messages = [
            { role: 'system', content: systemContent }
        ];

        // Add history
        if (history && Array.isArray(history)) {
            history.slice(-8).forEach(msg => {
                if (msg.role && msg.content) {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        // Check if this is a vision request (scout is the new vision model)
        const isVisionModel = model?.includes('vision') || model?.includes('scout');

        if (isVisionModel && context?.screenshot) {
            // Vision model with screenshot
            // Ensure screenshot is in the correct data URL format for Groq's locally saved images API
            // Format: data:image/{type};base64,{base64_data}
            let imageUrl = context.screenshot;

            // If screenshot is raw base64 (no data: prefix), add the data URL prefix
            if (!imageUrl.startsWith('data:')) {
                imageUrl = `data:image/png;base64,${imageUrl}`;
            }

            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userContent },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageUrl
                        }
                    }
                ]
            });
        } else {
            // Text-only model
            if (context?.screenshot) {
                userContent += '\n\n[Note: A screenshot was captured but the current model does not support vision. Switch to a vision model like "Llama 4 Scout 17B Vision" to analyze images.]';
            }
            messages.push({ role: 'user', content: userContent });
        }

        // Call Groq API
        const completion = await groq.chat.completions.create({
            model: model || 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
        });

        const response = completion.choices[0]?.message?.content || 'No response generated';

        // Log AI response
        console.log('\n' + '-'.repeat(60));
        console.log('🤖 AI RESPONSE');
        console.log('-'.repeat(60));
        console.log(response);
        console.log('-'.repeat(60));
        console.log(`📊 Tokens: ${completion.usage?.total_tokens || 'N/A'} (prompt: ${completion.usage?.prompt_tokens || 'N/A'}, completion: ${completion.usage?.completion_tokens || 'N/A'})`);
        console.log('='.repeat(60) + '\n');

        res.json({
            response,
            model: model || 'llama-3.3-70b-versatile',
            usage: completion.usage
        });

    } catch (error) {
        console.error('Chat error:', error);

        // Handle specific Groq errors
        if (error.message?.includes('API key')) {
            return res.status(401).json({ error: 'Invalid or missing GROQ_API_KEY' });
        }

        if (error.message?.includes('rate limit')) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please wait and try again.' });
        }

        res.status(500).json({
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Available models endpoint
app.get('/api/models', (req, res) => {
    res.json({
        models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', vision: false },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)', vision: false },
            { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 17B', vision: true },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', vision: false }
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);

    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️  Warning: GROQ_API_KEY not found in environment variables');
    } else {
        console.log('✅ GROQ_API_KEY loaded successfully');
    }
});
