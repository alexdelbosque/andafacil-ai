// ─── ClawCommerce Dynamic Chatbot ───
// Generic sales agent that adapts to any store's products

let STORE = null;      // Full store data
let PRODUCTS = [];     // Products array
let CATEGORIES = [];   // Unique categories
let STORE_META = {};   // Store metadata (name, favicon, color)

let context = {
    stage: 'greeting',        // greeting, browsing, product_detail, purchasing
    interests: [],             // what user is looking for
    selectedProduct: null,
    selectedCategory: null,
    purchaseState: null,
    order: {},
    history: [],
    shownProducts: new Set(),  // track which products we've shown
};

let isProcessing = false;

// ─── Init ───
async function init() {
    // Get domain from URL path or query param
    const pathParts = window.location.pathname.split('/');
    let domain = pathParts[pathParts.length - 1] || '';
    if (!domain) {
        const params = new URLSearchParams(window.location.search);
        domain = params.get('store') || params.get('domain') || '';
    }

    if (!domain) {
        document.getElementById('loadingOverlay').innerHTML = '<div style="color:#e9edef;text-align:center;padding:20px"><h2>No store specified</h2><p style="color:#8696a0;margin-top:8px">Use /chat/domain or ?store=domain</p></div>';
        return;
    }

    // Fetch store data
    try {
        const r = await fetch(`/api/products/${domain}`);
        if (!r.ok) throw new Error('Store not found');
        STORE = await r.json();
        PRODUCTS = STORE.products || [];
        CATEGORIES = STORE.categories || [];
        STORE_META = STORE.meta || {};
    } catch (e) {
        document.getElementById('loadingOverlay').innerHTML = `<div style="color:#e9edef;text-align:center;padding:20px"><h2>Store not found</h2><p style="color:#8696a0;margin-top:8px">"${domain}" hasn't been crawled yet.<br>Use the landing page to crawl it first.</p></div>`;
        return;
    }

    // Apply store branding
    applyBranding();

    // Hide loading
    document.getElementById('loadingOverlay').classList.add('hidden');
    setTimeout(() => document.getElementById('loadingOverlay').remove(), 500);

    // Init clock
    updateClock();
    setInterval(updateClock, 30000);

    // Setup messages
    const msgs = document.getElementById('messages');

    // Encrypted notice
    const enc = document.createElement('div');
    enc.className = 'encrypted-notice';
    enc.innerHTML = `<svg viewBox="0 0 16 16"><path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z"/></svg> Messages are end-to-end encrypted.`;
    msgs.appendChild(enc);

    const dt = document.createElement('div');
    dt.className = 'date-separator';
    dt.textContent = 'TODAY';
    msgs.appendChild(dt);

    // Welcome message
    await delay(600);
    const name = STORE_META.name || 'our store';
    const catButtons = CATEGORIES.slice(0, 4).map(c => 
        `<span class="quick-action" onclick="sendQuick('Show me ${c}')">${getCategoryEmoji(c)} ${c}</span>`
    ).join('\n');

    addBot(`Hi there! 👋 Welcome to *${name}*!\n\nI'm your AI shopping assistant. I can help you find the perfect product, answer questions, and help you checkout.\n\nWhat are you looking for? 😊

<div class="quick-actions">
${catButtons}
<span class="quick-action" onclick="sendQuick('Show me everything')">🛍️ Browse all</span>
<span class="quick-action" onclick="sendQuick('I need a recommendation')">💡 Help me choose</span>
</div>`);

    setupTextarea();
}

function applyBranding() {
    const name = STORE_META.name || 'Store';
    const color = STORE_META.color || '#8b5cf6';

    document.title = `${name} · AI Sales Agent`;
    document.getElementById('storeName').textContent = name;

    // Set CSS variable for store color
    document.documentElement.style.setProperty('--store-color', color);

    // Avatar
    const avatarEl = document.getElementById('chatAvatar');
    if (STORE_META.favicon) {
        avatarEl.innerHTML = `<img src="${STORE_META.favicon}" alt="${name}" onerror="this.parentElement.innerHTML='<span class=chat-avatar-letter>${name.charAt(0).toUpperCase()}</span>'">`;
    } else {
        document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();
    }
}

function getCategoryEmoji(cat) {
    const cl = cat.toLowerCase();
    const map = {
        'clothing': '👕', 'clothes': '👕', 'shirts': '👕', 'tops': '👕', 'apparel': '👕',
        'shoes': '👟', 'footwear': '👟', 'sneakers': '👟', 'boots': '🥾',
        'accessories': '💎', 'jewelry': '💎', 'watches': '⌚', 'bags': '👜', 'hats': '🎩',
        'electronics': '📱', 'tech': '💻', 'gadgets': '🔌', 'phones': '📱',
        'home': '🏠', 'furniture': '🪑', 'decor': '🖼️', 'kitchen': '🍳',
        'beauty': '💄', 'skincare': '🧴', 'health': '💊', 'wellness': '🧘',
        'food': '🍕', 'drinks': '🥤', 'grocery': '🛒',
        'sports': '⚽', 'fitness': '💪', 'outdoor': '🏕️',
        'toys': '🧸', 'games': '🎮', 'kids': '👶',
        'books': '📚', 'music': '🎵', 'art': '🎨',
        'pets': '🐾', 'garden': '🌱', 'tools': '🔧',
        'sale': '🔥', 'new': '✨', 'featured': '⭐',
    };
    for (const [k, v] of Object.entries(map)) {
        if (cl.includes(k)) return v;
    }
    return '📦';
}

function updateClock() {
    const el = document.getElementById('phoneTime');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function setupTextarea() {
    const ta = document.getElementById('userInput');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

// ─── Send ───
function sendQuick(text) {
    document.getElementById('userInput').value = text;
    sendMessage();
}
window.sendQuick = sendQuick;

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text || isProcessing) return;
    input.value = '';
    input.style.height = 'auto';
    addUser(text);
    isProcessing = true;
    document.getElementById('sendBtn').disabled = true;
    context.history.push({ role: 'user', text });
    showTyping();
    await processInput(text);
    hideTyping();
    isProcessing = false;
    document.getElementById('sendBtn').disabled = false;
}

// ─── THE BRAIN ───
async function processInput(text) {
    const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Purchase flow override
    if (context.purchaseState) { await handlePurchase(text, tl); return; }

    // Purchase intent
    if (context.selectedProduct && (tl.includes('buy') || tl.includes('purchase') || tl.includes('want it') || tl.includes('i\'ll take') || tl.includes('add to cart') || tl.includes('comprar') || tl.includes('lo quiero'))) {
        await startPurchase(); return;
    }

    // Back / start over
    if (tl.includes('start over') || tl.includes('back to') || tl.includes('menu') || tl.includes('categories')) {
        context.stage = 'browsing';
        context.selectedProduct = null;
        await delay(rand(600, 1000));
        await showCategories();
        return;
    }

    switch (context.stage) {
        case 'greeting':
            await handleGreeting(text, tl);
            break;
        case 'browsing':
            await handleBrowsing(text, tl);
            break;
        case 'product_detail':
            await handleProductDetail(text, tl);
            break;
        default:
            await handleGreeting(text, tl);
    }
}

// ─── Greeting Stage ───
async function handleGreeting(text, tl) {
    // Check if mentioning a category
    const matchedCat = findCategory(tl);
    if (matchedCat) {
        context.stage = 'browsing';
        context.selectedCategory = matchedCat;
        await delay(rand(800, 1200));
        await showCategoryProducts(matchedCat);
        return;
    }

    // Browse all
    if (tl.includes('everything') || tl.includes('browse') || tl.includes('all') || tl.includes('catalog') || tl.includes('show me')) {
        context.stage = 'browsing';
        await delay(rand(800, 1200));
        if (CATEGORIES.length > 0) await showCategories();
        else await showTopProducts();
        return;
    }

    // Need recommendation
    if (tl.includes('recommend') || tl.includes('help') || tl.includes('suggest') || tl.includes('not sure') || tl.includes('looking for')) {
        context.stage = 'browsing';
        await delay(rand(800, 1200));
        addBot(`Great! Let me help you find the perfect item. 🔍\n\nWhat's the occasion or what are you looking for?`);
        
        // Show categories as suggestions
        if (CATEGORIES.length > 0) {
            const btns = CATEGORIES.slice(0, 5).map(c =>
                `<span class="quick-action" onclick="sendQuick('${c}')">${getCategoryEmoji(c)} ${c}</span>`
            ).join('\n');
            addBot(`<div class="quick-actions">\n${btns}\n</div>`);
        }
        return;
    }

    // Try product search
    const matched = findProduct(text);
    if (matched) {
        context.stage = 'product_detail';
        context.selectedProduct = matched;
        await delay(rand(800, 1200));
        await showProductDetail(matched);
        return;
    }

    // Generic response — guide them
    await delay(rand(600, 1000));
    addBot(`I'd love to help! Let me know what you're interested in and I'll find the best options for you. 😊`);
    if (CATEGORIES.length > 0) {
        await showCategories();
    } else {
        await showTopProducts();
    }
    context.stage = 'browsing';
}

// ─── Browsing ───
async function handleBrowsing(text, tl) {
    // Category match
    const matchedCat = findCategory(tl);
    if (matchedCat) {
        await delay(rand(600, 1000));
        await showCategoryProducts(matchedCat);
        return;
    }

    // Product match
    const matched = findProduct(text);
    if (matched) {
        context.stage = 'product_detail';
        context.selectedProduct = matched;
        await delay(rand(800, 1200));
        await showProductDetail(matched);
        return;
    }

    // Price-related queries
    if (tl.includes('cheap') || tl.includes('affordable') || tl.includes('budget') || tl.includes('under')) {
        const priceMatch = text.match(/\$?(\d+)/);
        const maxPrice = priceMatch ? parseInt(priceMatch[1]) : Infinity;
        const affordable = PRODUCTS.filter(p => p.priceRaw > 0 && p.priceRaw <= maxPrice).sort((a, b) => a.priceRaw - b.priceRaw).slice(0, 4);
        if (affordable.length > 0) {
            await delay(rand(800, 1200));
            addBot(`Here are our most affordable options 💰`);
            for (const p of affordable) { await delay(rand(300, 600)); addProductCard(p); }
            return;
        }
    }

    if (tl.includes('popular') || tl.includes('best') || tl.includes('top') || tl.includes('trending')) {
        await delay(rand(800, 1200));
        await showTopProducts();
        return;
    }

    if (tl.includes('new') || tl.includes('latest') || tl.includes('arrival')) {
        await delay(rand(800, 1200));
        const newest = PRODUCTS.slice(-6).reverse().slice(0, 4);
        addBot(`Here are our latest arrivals ✨`);
        for (const p of newest) { await delay(rand(300, 600)); addProductCard(p); }
        return;
    }

    // Fuzzy keyword search
    const keywords = tl.split(/\s+/).filter(w => w.length > 2);
    if (keywords.length > 0) {
        const results = searchProducts(keywords);
        if (results.length > 0) {
            await delay(rand(800, 1200));
            addBot(`Here's what I found 🔍`);
            for (const p of results.slice(0, 4)) { await delay(rand(300, 600)); addProductCard(p); }
            addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Show me more')">📦 More</span>
<span class="quick-action" onclick="sendQuick('Categories')">📂 Categories</span>
</div>`);
            return;
        }
    }

    await delay(rand(600, 1000));
    addBot(`I couldn't find an exact match. Let me show you what we have:`);
    await showCategories();
}

// ─── Product Detail ───
async function handleProductDetail(text, tl) {
    const p = context.selectedProduct;

    // Buy intent
    if (tl.includes('buy') || tl.includes('purchase') || tl.includes('want') || tl.includes('take it') || tl.includes('order') || tl.includes('comprar')) {
        await startPurchase(); return;
    }

    // See another product
    const newP = findProduct(text);
    if (newP && newP !== p) {
        context.selectedProduct = newP;
        await delay(rand(800, 1200));
        await showProductDetail(newP);
        return;
    }

    // Category browse
    const matchedCat = findCategory(tl);
    if (matchedCat) {
        context.stage = 'browsing';
        await delay(rand(600, 1000));
        await showCategoryProducts(matchedCat);
        return;
    }

    // Similar products
    if (tl.includes('similar') || tl.includes('like this') || tl.includes('alternative') || tl.includes('other')) {
        await delay(rand(800, 1200));
        const similar = PRODUCTS.filter(x => x !== p && x.category === p.category).slice(0, 3);
        if (similar.length > 0) {
            addBot(`Here are similar items from *${p.category}*:`);
            for (const s of similar) { await delay(rand(300, 600)); addProductCard(s); }
        } else {
            addBot(`That's our only one in this category. Want to browse other products?`);
            await showCategories();
        }
        return;
    }

    // Price / shipping
    if (tl.includes('price') || tl.includes('cost') || tl.includes('how much')) {
        await delay(rand(600, 800));
        addBot(`${p.price || 'Price not listed'} ${p.inStock ? '✅ In stock' : '⚠️ Check availability'}\n🚚 Standard shipping available`);
        addQuickBuy();
        return;
    }

    if (tl.includes('ship') || tl.includes('deliver') || tl.includes('arrive')) {
        await delay(rand(600, 800));
        addBot(`🚚 Standard shipping: 3-7 business days\n📦 We ship worldwide!\n💰 Free shipping on select orders`);
        addQuickBuy();
        return;
    }

    if (tl.includes('return') || tl.includes('refund') || tl.includes('warranty') || tl.includes('guarantee')) {
        await delay(rand(600, 800));
        addBot(`🛡️ 30-day return policy\n🔄 Easy refunds\n📞 Customer support available\n\nBuy with confidence! 😊`);
        addQuickBuy();
        return;
    }

    if (tl.includes('detail') || tl.includes('more info') || tl.includes('tell me more') || tl.includes('description')) {
        await delay(rand(600, 1000));
        const desc = p.description || 'No additional details available.';
        addBot(`📝 *${p.name}*\n\n${desc.substring(0, 500)}${desc.length > 500 ? '...' : ''}`);
        addQuickBuy();
        return;
    }

    // Generic follow-up
    await delay(rand(600, 1000));
    addBot(`What would you like to know about *${p.name}*? 😊`);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('I want to buy this')">💳 Buy now</span>
<span class="quick-action" onclick="sendQuick('Show me similar items')">🔄 Similar</span>
<span class="quick-action" onclick="sendQuick('Tell me more details')">📝 Details</span>
<span class="quick-action" onclick="sendQuick('Shipping info')">🚚 Shipping</span>
</div>`);
}

function addQuickBuy() {
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('I want to buy this')">💳 Buy now!</span>
<span class="quick-action" onclick="sendQuick('Show me similar')">🔄 Similar</span>
</div>`);
}

// ─── Purchase Flow ───
async function startPurchase() {
    const p = context.selectedProduct;
    if (!p) { addBot(`Which product would you like to buy?`); return; }
    context.purchaseState = 'confirming';
    context.order = { product: p };
    await delay(rand(1000, 1500));
    addBot(`🙌 *Great choice!*\n\n📦 *${p.name}*\n${p.price ? `💰 *${p.price}*\n` : ''}🚚 Shipping included\n\nReady to proceed? 🔒`);
    await delay(300);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Yes, proceed to checkout')">✅ Yes, checkout</span>
<span class="quick-action" onclick="sendQuick('I have a question first')">❓ Question first</span>
</div>`);
}

async function handlePurchase(text, tl) {
    if (tl.includes('cancel') || tl.includes('no') || tl.includes('question') || tl.includes('nevermind')) {
        context.purchaseState = null;
        context.stage = 'product_detail';
        await delay(800);
        addBot(`No problem! 😊 What would you like to know?`);
        return;
    }

    switch (context.purchaseState) {
        case 'confirming':
            if (tl.includes('yes') || tl.includes('proceed') || tl.includes('checkout') || tl.includes('ok')) {
                context.purchaseState = 'addr_name';
                await delay(rand(800, 1200));
                addBot(`📋 Let's get your details!\n\nWhat's your *full name*?`);
            }
            break;
        case 'addr_name':
            context.order.name = text;
            context.purchaseState = 'addr_email';
            await delay(rand(400, 700));
            addBot(`👍 Your *email address*?`);
            break;
        case 'addr_email':
            context.order.email = text;
            context.purchaseState = 'addr_street';
            await delay(rand(400, 700));
            addBot(`📍 *Shipping address*?\n_(Street, number, apt)_`);
            break;
        case 'addr_street':
            context.order.street = text;
            context.purchaseState = 'addr_city';
            await delay(rand(400, 600));
            addBot(`*City, State/Province, ZIP*?`);
            break;
        case 'addr_city':
            context.order.city = text;
            context.purchaseState = 'addr_phone';
            await delay(rand(400, 600));
            addBot(`📞 *Phone number* for delivery updates?`);
            break;
        case 'addr_phone':
            context.order.phone = text;
            context.purchaseState = 'complete';
            await delay(rand(1500, 2000));
            const p = context.selectedProduct;
            const storeName = STORE_META.name || 'our store';
            addBot(`🎉 *Order confirmed!*\n\n📦 ${p.name}\n${p.price ? `💰 ${p.price}\n` : ''}💳 ✅ Payment link sent to ${context.order.email}`);
            await delay(500);
            addBot(`📍 *Shipping to:*\n\n👤 ${context.order.name}\n🏠 ${context.order.street}\n📍 ${context.order.city}\n📞 ${context.order.phone}\n\n🚚 *Estimated delivery: 3-7 business days*`);
            await delay(500);
            addBot(`Thank you for shopping with *${storeName}*! 🙌💚\n\nNeed anything else?`);
            addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Browse more products')">🛍️ Keep shopping</span>
<span class="quick-action" onclick="sendQuick('No, thanks!')">👋 Done</span>
</div>`);
            context.purchaseState = null;
            context.selectedProduct = null;
            context.stage = 'greeting';
            context.order = {};
            break;
    }
}

// ─── Display Functions ───

async function showCategories() {
    if (CATEGORIES.length === 0) { await showTopProducts(); return; }
    const btns = CATEGORIES.slice(0, 8).map(c => {
        const count = PRODUCTS.filter(p => p.category === c).length;
        return `<span class="quick-action" onclick="sendQuick('${c}')">${getCategoryEmoji(c)} ${c} (${count})</span>`;
    }).join('\n');
    addBot(`Browse by category 📂\n\n<div class="quick-actions">\n${btns}\n<span class="quick-action" onclick="sendQuick('Show me everything')">🛍️ All ${PRODUCTS.length} products</span>\n</div>`);
}

async function showCategoryProducts(category) {
    const catProducts = PRODUCTS.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
    if (catProducts.length === 0) {
        addBot(`No products found in "${category}". Let me show you our categories:`);
        await showCategories();
        return;
    }
    addBot(`${getCategoryEmoji(category)} *${category}* — ${catProducts.length} products`);
    const toShow = catProducts.slice(0, 5);
    for (const p of toShow) { await delay(rand(300, 600)); addProductCard(p); }
    if (catProducts.length > 5) {
        addBot(`<div class="quick-actions"><span class="quick-action" onclick="sendQuick('Show more ${category}')">📦 Show ${catProducts.length - 5} more</span><span class="quick-action" onclick="sendQuick('Categories')">📂 Other categories</span></div>`);
    }
}

async function showTopProducts() {
    const top = PRODUCTS.filter(p => p.price).slice(0, 5);
    if (top.length === 0 && PRODUCTS.length > 0) {
        const any = PRODUCTS.slice(0, 5);
        addBot(`Here are our products 🛍️`);
        for (const p of any) { await delay(rand(300, 600)); addProductCard(p); }
        return;
    }
    addBot(`Our most popular items 🔥`);
    for (const p of top) { await delay(rand(300, 600)); addProductCard(p); }
    if (PRODUCTS.length > 5) {
        addBot(`<div class="quick-actions"><span class="quick-action" onclick="sendQuick('Show me more')">📦 Show more</span><span class="quick-action" onclick="sendQuick('Categories')">📂 Categories</span></div>`);
    }
}

async function showProductDetail(p) {
    context.selectedProduct = p;
    context.stage = 'product_detail';

    // Image card
    if (p.image) {
        const c = document.getElementById('messages');
        const d = document.createElement('div');
        d.className = 'msg bot';
        d.innerHTML = `<div class="msg-bubble" style="padding:3px">
            <span class="msg-sender">${STORE_META.name || 'Store'}</span>
            <div class="msg-image" style="position:relative">
                <img src="${p.image}" alt="${esc(p.name)}" onerror="this.parentElement.style.display='none'">
                ${p.price ? `<div class="msg-image-price">${p.price}</div>` : ''}
            </div>
            <div class="msg-image-caption"><strong>${esc(p.name)}</strong></div>
            <span class="msg-time">${getTime()}</span>
        </div>`;
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }

    await delay(rand(400, 800));
    let info = '';
    if (p.price) info += `💰 *${p.price}*\n`;
    if (p.category && p.category !== 'General') info += `📂 ${p.category}\n`;
    if (p.inStock) info += `✅ In stock\n`;
    if (p.description) info += `\n${p.description.substring(0, 200)}${p.description.length > 200 ? '...' : ''}`;

    addBot(info || p.name);

    await delay(300);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('I want to buy this')">💳 Buy now!</span>
<span class="quick-action" onclick="sendQuick('Tell me more details')">📝 More details</span>
<span class="quick-action" onclick="sendQuick('Show similar items')">🔄 Similar</span>
<span class="quick-action" onclick="sendQuick('Shipping and returns')">🚚 Shipping</span>
</div>`);
}

function addProductCard(p) {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'msg bot';
    const idx = PRODUCTS.indexOf(p);
    const shortName = p.name.length > 60 ? p.name.substring(0, 57) + '...' : p.name;

    d.innerHTML = `<div class="msg-bubble" style="padding:3px 3px 4px">
        <div class="msg-product-card" onclick="selectProduct(${idx})" style="cursor:pointer">
            ${p.image ? `<img src="${p.image}" alt="${esc(shortName)}" onerror="this.style.display='none'" loading="lazy">` : ''}
            <div class="msg-product-card-body">
                <h4>${esc(shortName)}</h4>
                ${p.price ? `<span class="price">${p.price}</span>` : ''}
                ${p.category && p.category !== 'General' ? `<span class="category-tag">${p.category}</span>` : ''}
                ${p.description ? `<div class="desc">${esc(p.description.substring(0, 100))}</div>` : ''}
            </div>
        </div>
        <span class="msg-time">${getTime()}</span>
    </div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

window.selectProduct = function(index) {
    const p = PRODUCTS[index];
    if (p) {
        context.selectedProduct = p;
        context.stage = 'product_detail';
        showProductDetail(p);
    }
};

// ─── Search ───

function findProduct(text) {
    const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let best = null, bestScore = 0;
    for (const p of PRODUCTS) {
        const pn = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let score = 0;
        const words = tl.split(/\s+/).filter(w => w.length > 2 &&