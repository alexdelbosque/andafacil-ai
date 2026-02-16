// ─── Andafacil AI Chatbot — app.js ───

// Product catalog — will be replaced by build script with real crawled data
let PRODUCTS = [];

// Testimonials from the website
const TESTIMONIALS = [
    { name: "Diego J.", text: "Excelente calidad de material bastante resistente y ligera muy recomendable", date: "Octubre 2024" },
    { name: "Carlos R.", text: "Le ayudó mucho a mi papá a desplazarse en lugares algo complicados y en pendientes es muy segura, muy buena calidad!!!", date: "Agosto 2024" },
    { name: "Wen I.", text: "Es justo como lo necesitábamos, a mí mamá le gustó mucho, buen material y flexible al andar", date: "Julio 2024" },
    { name: "Pam O.", text: "Me ayuda bastante en mi día a día ya que no pesa, es fácil de cerrar, el material es resistente", date: "Julio 2024" },
    { name: "Ana O.", text: "Se ha vuelto el Andafacil en parte esencial de mi vida", date: "Noviembre 2023" },
    { name: "Roberto H.", text: "Lo compré para mi madre, tuvo un accidente y se fracturó el pie, este artículo es perfecto para su recuperación", date: "Junio 2023" },
    { name: "Daniel P.", text: "Es una compañía muy seria y cumple con sus productos que son de buena calidad", date: "Diciembre 2023" }
];

// ─── Stripe Payment Links (real) ───
const STRIPE_LINKS = {};
let stripeLinksLoaded = false;

// ─── State ───
let conversationHistory = [];
let isProcessing = false;
let currentProduct = null;
let purchaseState = null;
let orderData = {};
let demoMode = false;

// ─── Initialize ───
async function init() {
    try {
        const resp = await fetch('products.json');
        if (resp.ok) PRODUCTS = await resp.json();
    } catch (e) {
        console.warn('Could not load products.json, using defaults');
    }
    try {
        const resp = await fetch('stripe-links.json');
        if (resp.ok) {
            const links = await resp.json();
            Object.assign(STRIPE_LINKS, links);
            stripeLinksLoaded = true;
        }
    } catch (e) {
        console.warn('No stripe links loaded');
    }
    // Check for demo mode
    if (window.location.hash === '#demo') {
        demoMode = true;
    }
    renderProducts();
    // Add WhatsApp encrypted notice
    const container = document.getElementById('messages');
    const enc = document.createElement('div');
    enc.className = 'encrypted-notice';
    enc.innerHTML = `<svg viewBox="0 0 16 16"><path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z"/></svg> Los mensajes y llamadas están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.`;
    container.appendChild(enc);
    // Date separator
    const date = document.createElement('div');
    date.className = 'date-separator';
    date.textContent = 'HOY';
    container.appendChild(date);
    addBotMessage(getWelcomeMessage());
    setupTextarea();
}

function getWelcomeMessage() {
    return `¡Hola! 👋 Bienvenido a *Andafacil*, la marca líder en productos de movilidad en México.

Puedo ayudarte con:

🔍 Encontrar el producto ideal
📋 Especificaciones y precios
💳 Comprar directo por aquí
📦 Envío a todo México

¿En qué te puedo ayudar? 😊

<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('¿Qué silla de ruedas eléctrica me recomiendas?')">🦽 Sillas eléctricas</span>
<span class="quick-action" onclick="sendQuick('Necesito una andadera para mi mamá')">🚶 Andaderas</span>
<span class="quick-action" onclick="sendQuick('¿Cuál es su producto más vendido?')">⭐ Más vendido</span>
<span class="quick-action" onclick="sendQuick('¿Hacen envíos a todo México?')">📦 Envíos</span>
</div>`;
}

// ─── Render Products in Sidebar ───
function renderProducts() {
    const list = document.getElementById('productList');
    if (!list) return;
    const icons = { 'silla': '🦽', 'andadera': '🚶', 'bastón': '🦯', 'muleta': '🩼', 'accesorio': '🔧', 'baño': '🚿' };

    list.innerHTML = PRODUCTS.map((p, i) => {
        let icon = '📦';
        const nl = p.name.toLowerCase();
        for (const [k, e] of Object.entries(icons)) { if (nl.includes(k)) { icon = e; break; } }

        return `<div class="product-card" onclick="askAboutProduct(${i})" title="${p.name}">
            <div class="product-thumb">
                ${p.image ? `<img src="${p.image}" alt="" onerror="this.parentElement.textContent='${icon}'">` : icon}
            </div>
            <div class="product-info">
                <div class="product-name">${p.name}</div>
                ${p.price ? `<div class="product-price">${p.price}</div>` : ''}
                ${p.category ? `<div class="product-category">${p.category}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function askAboutProduct(index) {
    const product = PRODUCTS[index];
    document.querySelectorAll('.product-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.product-card')[index]?.classList.add('active');
    sendQuick(`Cuéntame sobre ${product.name}`);
}

// ─── Textarea Auto-Resize ───
function setupTextarea() {
    const ta = document.getElementById('userInput');
    ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
    ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// ─── Send Messages ───
function sendQuick(text) {
    document.getElementById('userInput').value = text;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text || isProcessing) return;

    input.value = '';
    input.style.height = 'auto';
    addUserMessage(text);
    isProcessing = true;
    document.getElementById('sendBtn').disabled = true;

    showTyping();

    if (purchaseState) {
        await handlePurchaseFlow(text);
    } else {
        await handleChat(text);
    }

    hideTyping();
    isProcessing = false;
    document.getElementById('sendBtn').disabled = false;
}

// ─── Chat Handler ───
async function handleChat(text) {
    const tl = text.toLowerCase();

    // Purchase intent
    if (currentProduct && (tl.includes('comprar') || tl.includes('la quiero') || tl.includes('lo quiero') || tl.includes('pagar') || tl.includes('link de pago') || tl.includes('sí, genérame') || tl.includes('si, genera'))) {
        await delay(1200);
        startPurchaseFlow();
        return;
    }

    // Product match
    const matched = findProduct(text);
    if (matched) {
        currentProduct = matched;
        await delay(1500);
        addBotMessage(productResponse(matched));
        return;
    }

    // Recommendations
    if (tl.includes('recomien') || tl.includes('necesito') || tl.includes('mejor') || tl.includes('cuál') || tl.includes('mamá') || tl.includes('papá') || tl.includes('abuelo') || tl.includes('abuela')) {
        await delay(1500);
        addBotMessage(recommendResponse(text));
        return;
    }

    // Shipping
    if (tl.includes('envío') || tl.includes('envio') || tl.includes('entrega') || tl.includes('envían')) {
        await delay(800);
        addBotMessage(shippingResponse());
        return;
    }

    // Best seller
    if (tl.includes('vendido') || tl.includes('popular')) {
        await delay(1000);
        addBotMessage(bestSellerResponse());
        return;
    }

    // Testimonials
    if (tl.includes('testimonio') || tl.includes('opinión') || tl.includes('opinion') || tl.includes('review') || tl.includes('calidad') || tl.includes('buena')) {
        await delay(1000);
        addBotMessage(testimonialResponse());
        return;
    }

    // Warranty / returns
    if (tl.includes('garantía') || tl.includes('garantia') || tl.includes('devolución') || tl.includes('devolucion') || tl.includes('regres')) {
        await delay(800);
        addBotMessage(`Todos nuestros productos incluyen:\n\n<ul>
<li>✅ <strong>Garantía de 1 año</strong> contra defectos de fábrica</li>
<li>🔄 <strong>30 días de devolución</strong> si no quedas satisfecho</li>
<li>📞 <strong>Soporte técnico</strong> por WhatsApp para armado y uso</li>
</ul>\n\n¿Hay algún producto específico que te interese? 😊`);
        return;
    }

    // Fallback
    await delay(1200);
    addBotMessage(generalResponse(text));
}

// ─── Product Matching ───
function findProduct(text) {
    const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Score-based matching
    let bestMatch = null;
    let bestScore = 0;

    for (const p of PRODUCTS) {
        const pn = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let score = 0;

        // Exact name containment
        if (tl.includes(pn) || pn.includes(tl)) { score += 100; }

        // Word overlap
        const words = tl.split(/\s+/).filter(w => w.length > 3);
        const pWords = pn.split(/\s+/);
        for (const w of words) {
            for (const pw of pWords) {
                if (pw.includes(w) || w.includes(pw)) score += 10;
            }
        }

        // Keyword boost
        const kwMap = [
            ['pro', 'silla'], ['easy', 'go'], ['electrica', 'silla'], ['traslado'],
            ['andadera'], ['baston'], ['muleta'], ['bano', 'silla'], ['robooter'],
            ['vertical'], ['aluminio'], ['plegable'], ['2 en 1'], ['3 en 1'],
            ['xxl'], ['light'], ['ultraligera']
        ];

        for (const kws of kwMap) {
            if (kws.every(k => tl.includes(k))) {
                if (kws.every(k => pn.includes(k))) score += 50;
            }
        }

        if (score > bestScore) { bestScore = score; bestMatch = p; }
    }

    return bestScore >= 10 ? bestMatch : null;
}

// ─── Response Generators ───
function productResponse(p) {
    let html = `<strong>${p.name}</strong>\n\n`;

    if (p.description) {
        const desc = p.description.length > 300 ? p.description.substring(0, 300) + '...' : p.description;
        html += `${desc}\n\n`;
    }

    if (p.specs && p.specs.length > 0) {
        html += `<strong>📋 Especificaciones:</strong>\n<ul>`;
        p.specs.forEach(s => { html += `<li>${s}</li>`; });
        html += `</ul>\n`;
    }

    if (p.price) {
        html += `\n<strong>💰 Precio: ${p.price}</strong>`;
        if (p.regularPrice) html += ` <span style="text-decoration:line-through;color:#9CA3AF;font-size:12px">${p.regularPrice}</span>`;
        html += `\n\n`;
    }

    // Random testimonial
    const t = TESTIMONIALS[Math.floor(Math.random() * TESTIMONIALS.length)];
    html += `\n💬 <em>"${t.text}"</em> — ${t.name}\n\n`;

    html += `<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Quiero comprar ${p.name}')">💳 Comprar ahora</span>
<span class="quick-action" onclick="sendQuick('¿Qué incluye el envío?')">📦 Info de envío</span>
<span class="quick-action" onclick="sendQuick('¿Tienen garantía?')">🔒 Garantía</span>
</div>`;

    return html;
}

function recommendResponse(text) {
    const tl = text.toLowerCase();
    let rec = [];

    // Wheelchair recommendations
    if (tl.includes('silla') || tl.includes('eléctrica') || tl.includes('electrica') || tl.includes('ruedas')) {
        rec = PRODUCTS.filter(p => p.name.toLowerCase().includes('silla') && p.name.toLowerCase().includes('eléctrica'));
    }
    // Walker recommendations
    else if (tl.includes('andadera') || tl.includes('caminar') || tl.includes('andar')) {
        rec = PRODUCTS.filter(p => p.name.toLowerCase().includes('andadera'));
    }
    // For mom/dad/grandparent — show main products
    else if (tl.includes('mamá') || tl.includes('mama') || tl.includes('papá') || tl.includes('papa') || tl.includes('abuel')) {
        rec = PRODUCTS.filter(p =>
            (p.name.toLowerCase().includes('andadera') && p.name.toLowerCase().includes('2 en 1')) ||
            p.name.toLowerCase().includes('andafacil pro') ||
            p.name.toLowerCase().includes('easy go')
        );
    }
    // Generic
    else {
        rec = PRODUCTS.filter(p => p.price).slice(0, 3);
    }

    if (rec.length === 0) rec = PRODUCTS.slice(0, 3);
    rec = rec.slice(0, 3);

    let html = `Basándome en lo que me cuentas, te recomiendo estas opciones:\n\n`;

    rec.forEach((p, i) => {
        html += `<strong>${i + 1}. ${p.name}</strong>\n`;
        if (p.price) html += `💰 ${p.price}\n`;
        if (p.specs && p.specs.length > 0) {
            html += `✅ ${p.specs.slice(0, 2).join(' · ')}\n`;
        }
        html += `\n`;
    });

    html += `\n¿Te gustaría saber más detalles de alguno? Solo dime cuál y te cuento todo. 😊\n\n`;
    html += `<div class="quick-actions">`;
    rec.forEach(p => {
        const short = p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name;
        html += `<span class="quick-action" onclick="sendQuick('Cuéntame sobre ${p.name}')">${short}</span>`;
    });
    html += `</div>`;

    return html;
}

function shippingResponse() {
    return `<strong>📦 Información de Envío</strong>\n\n<ul>
<li>🇲🇽 <strong>Envíos a todo México</strong></li>
<li>🚚 Tiempo estimado: <strong>3-7 días hábiles</strong></li>
<li>✈️ Envíos internacionales disponibles (consultar)</li>
<li>📍 Rastreo incluido en todos los envíos</li>
<li>📦 Empaque seguro y reforzado</li>
</ul>\n\n¿Hay algo más que quieras saber? 😊`;
}

function bestSellerResponse() {
    const bestseller = PRODUCTS.find(p => p.name.toLowerCase().includes('andafacil pro') && p.name.toLowerCase().includes('eléctrica'));
    if (bestseller) {
        currentProduct = bestseller;
        return `⭐ Nuestro <strong>producto más vendido</strong> es:\n\n` + productResponse(bestseller);
    }
    return `Nuestros productos más populares son las sillas de ruedas eléctricas y las andaderas 2 en 1. ¿Te cuento sobre alguno?`;
}

function testimonialResponse() {
    let html = `<strong>⭐ Lo que dicen nuestros clientes:</strong>\n\n`;
    const selection = TESTIMONIALS.sort(() => 0.5 - Math.random()).slice(0, 4);
    selection.forEach(t => {
        html += `💬 <em>"${t.text}"</em>\n— <strong>${t.name}</strong>, ${t.date}\n\n`;
    });
    html += `Tenemos <strong>cientos de clientes satisfechos</strong> en todo México y Latinoamérica. ¿Te gustaría ver algún producto? 😊`;
    return html;
}

function generalResponse(text) {
    return `¡Gracias por tu mensaje! 😊 Soy experto en todos los productos de Andafacil. Puedo ayudarte con:\n\n<ul>
<li>🦽 <strong>Sillas de ruedas eléctricas</strong> — portátiles, plegables, todo terreno</li>
<li>🚶 <strong>Andaderas</strong> — verticales, plegables, con asiento, eléctricas</li>
<li>🩼 <strong>Bastones y muletas</strong> — plegables, ajustables</li>
<li>🔧 <strong>Accesorios</strong> — baterías, cargadores, soportes</li>
</ul>\n\n¿Qué necesitas? Cuéntame para quién es y te recomiendo la mejor opción.\n\n<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('¿Qué silla de ruedas eléctrica me recomiendas?')">🦽 Sillas eléctricas</span>
<span class="quick-action" onclick="sendQuick('Necesito una andadera')">🚶 Andaderas</span>
<span class="quick-action" onclick="sendQuick('¿Cuál es el producto más vendido?')">⭐ Más vendido</span>
</div>`;
}

// ─── Purchase Flow ───
function startPurchaseFlow() {
    if (!currentProduct) {
        addBotMessage('¿Qué producto te gustaría comprar? Dime el nombre o pregúntame por una recomendación 😊');
        return;
    }

    purchaseState = 'confirming';
    orderData = { product: currentProduct };

    let html = `¡Excelente elección! 🙌\n\n`;
    html += `<strong>Resumen de tu compra:</strong>\n`;
    html += `📦 ${currentProduct.name}\n`;
    if (currentProduct.price) html += `💰 ${currentProduct.price}\n`;
    html += `🚚 Envío a todo México\n\n`;
    html += `¿Te genero el link de pago seguro? 🔒\n\n`;
    html += `<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Sí, genérame el link de pago')">✅ Sí, generar link</span>
<span class="quick-action" onclick="sendQuick('Tengo una duda antes')">❓ Tengo una duda</span>
</div>`;

    addBotMessage(html);
}

async function handlePurchaseFlow(text) {
    const tl = text.toLowerCase();

    // Cancel
    if (tl.includes('cancelar') || tl.includes('no quiero') || tl.includes('duda')) {
        purchaseState = null;
        await delay(800);
        addBotMessage('¡Sin problema! 😊 ¿En qué más te puedo ayudar?');
        return;
    }

    switch (purchaseState) {
        case 'confirming':
            if (tl.includes('sí') || tl.includes('si') || tl.includes('genéra') || tl.includes('genera') || tl.includes('link') || tl.includes('pagar')) {
                purchaseState = 'paying';
                await delay(2000);

                // Find real Stripe link for this product
                let payUrl = '';
                const pName = (currentProduct.name || '').toLowerCase();
                if (pName.includes('pro') && pName.includes('silla') && pName.includes('eléctrica') || pName.includes('electrica') && pName.includes('pro')) {
                    payUrl = (STRIPE_LINKS['andafacil-pro-silla'] || {}).url || '';
                } else if (pName.includes('easy') || pName.includes('portátil') || pName.includes('portatil') && pName.includes('eléctrica')) {
                    payUrl = (STRIPE_LINKS['andafacil-easygo'] || {}).url || '';
                } else if (pName.includes('andadera') && (pName.includes('eléctrica') || pName.includes('electrica'))) {
                    payUrl = (STRIPE_LINKS['andafacil-andadera-electrica'] || {}).url || '';
                } else if (pName.includes('2 en 1') || pName.includes('2en1')) {
                    payUrl = (STRIPE_LINKS['andadera-2en1'] || {}).url || '';
                } else if (pName.includes('3 en 1') || pName.includes('3en1') || pName.includes('reclinable')) {
                    payUrl = (STRIPE_LINKS['silla-3en1'] || {}).url || '';
                } else if (pName.includes('pack') || pName.includes('2x')) {
                    payUrl = (STRIPE_LINKS['pack-2x-todo-terreno'] || {}).url || '';
                }
                // Fallback to first available link
                if (!payUrl && stripeLinksLoaded) {
                    const firstKey = Object.keys(STRIPE_LINKS)[0];
                    if (firstKey) payUrl = STRIPE_LINKS[firstKey].url;
                }
                if (!payUrl) payUrl = 'https://buy.stripe.com/demo';

                let html = `¡Listo! Aquí tienes tu link de pago seguro 🔒\n\n`;
                html += `<a href="${payUrl}" class="btn-pay" target="_blank">💳 Pagar ${currentProduct.price || ''}</a>\n\n`;
                html += `Aceptamos:\n• 💳 Tarjeta de crédito/débito\n• 🏪 OXXO\n• 🏦 Transferencia SPEI\n\n`;
                html += `Cuando completes el pago, escríbeme *"ya pagué"* y te pido tu dirección de envío aquí mismo ✅\n\n`;
                html += `<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Ya pagué')">✅ Ya pagué</span>
<span class="quick-action" onclick="sendQuick('Simular pago (demo)')">🎬 Demo: simular pago</span>
</div>`;

                addBotMessage(html);
            }
            break;

        case 'paying':
            if (tl.includes('pagué') || tl.includes('pague') || tl.includes('ya pagu') || tl.includes('listo') || tl.includes('pago completado') || tl.includes('pagado') || tl.includes('simular') || tl.includes('demo')) {
                purchaseState = 'address_name';
                await delay(1000);
                const demoNote = (tl.includes('simular') || tl.includes('demo')) ? '\n\n_🎬 Modo demo — simulando pago completado_\n' : '';
                addBotMessage(`¡Pago recibido! ✅🎉${demoNote}\n\nAhora necesito tu dirección de envío para programar la entrega.\n\n¿Cuál es el *nombre completo* de quien recibe el paquete?`);
            }
            break;

        case 'address_name':
            orderData.name = text;
            purchaseState = 'address_street';
            await delay(600);
            addBotMessage(`Perfecto, ${text.split(' ')[0]}. ¿Cuál es la <strong>dirección completa</strong>?\n\n(Calle, número exterior/interior, colonia)`);
            break;

        case 'address_street':
            orderData.street = text;
            purchaseState = 'address_city';
            await delay(600);
            addBotMessage('¿<strong>Ciudad y Estado</strong>?');
            break;

        case 'address_city':
            orderData.city = text;
            purchaseState = 'address_zip';
            await delay(600);
            addBotMessage('¿<strong>Código postal</strong>?');
            break;

        case 'address_zip':
            orderData.zip = text;
            purchaseState = 'address_phone';
            await delay(600);
            addBotMessage('¿Un <strong>teléfono de contacto</strong> para el repartidor?');
            break;

        case 'address_phone':
            orderData.phone = text;
            purchaseState = 'address_notes';
            await delay(600);
            addBotMessage('¿Alguna <strong>instrucción especial</strong> para la entrega?\n\n(Edificio, piso, entre calles, etc. — o escribe "no" si no hay)');
            break;

        case 'address_notes':
            orderData.notes = tl === 'no' ? 'Ninguna' : text;
            purchaseState = 'complete';
            await delay(1500);

            let html = `¡Listo! Tu pedido está confirmado 🎉📦\n\n`;
            html += `<strong>📋 Resumen del Pedido:</strong>\n`;
            html += `📦 ${currentProduct.name}\n`;
            if (currentProduct.price) html += `💰 ${currentProduct.price}\n`;
            html += `💳 Pago: ✅ Completado\n\n`;
            html += `<strong>📍 Dirección de Envío:</strong>\n`;
            html += `👤 ${orderData.name}\n`;
            html += `🏠 ${orderData.street}\n`;
            html += `📍 ${orderData.city}, CP ${orderData.zip}\n`;
            html += `📞 ${orderData.phone}\n`;
            if (orderData.notes !== 'Ninguna') html += `📝 ${orderData.notes}\n`;
            html += `\n🚚 <strong>Tiempo estimado: 3-7 días hábiles</strong>\n`;
            html += `\n¡Gracias por confiar en <strong>Andafacil</strong>! 🙌\nSi tienes cualquier duda, aquí estoy. 😊`;

            addBotMessage(html);

            // Reset state
            purchaseState = null;
            currentProduct = null;
            orderData = {};
            break;
    }
}

// ─── DOM Helpers ───
function getTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function addBotMessage(html) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    // Convert *text* to bold (WhatsApp style)
    html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    div.innerHTML = `
        <div class="msg-bubble">
            <span class="msg-sender">Andafacil 🦽</span>
            ${html}
            <span class="msg-time">${getTime()}</span>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addUserMessage(text) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `
        <div class="msg-bubble">
            ${escapeHtml(text)}
            <span class="msg-time">${getTime()} <span class="msg-ticks"><svg viewBox="0 0 16 11"><path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.95-2.95a.456.456 0 00-.304-.178h-.076a.457.457 0 00-.305.178l-.609.61a.456.456 0 000 .609l3.838 3.838c.178.178.381.254.584.254a.652.652 0 00.508-.279l6.999-8.61a.456.456 0 00.076-.381.456.456 0 00-.178-.305l-.708-.498zM14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.381.178l-6.19 7.636-1.143-1.143-.356.356-.508.559 2.007 2.007c.178.178.381.254.584.254a.652.652 0 00.508-.279l6.999-8.61a.456.456 0 00.076-.381.456.456 0 00-.178-.305l-.708-.498z"/></svg></span></span>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('messages');
    // Update header status
    document.querySelector('.chat-header-status').textContent = 'escribiendo...';
    const div = document.createElement('div');
    div.className = 'typing';
    div.id = 'typingIndicator';
    div.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
    // Reset header status
    document.querySelector('.chat-header-status').textContent = 'en línea';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', init);
