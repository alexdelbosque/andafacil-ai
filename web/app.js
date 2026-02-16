// ─── Andafacil AI — Physiotherapist Chatbot ───

let PRODUCTS = [];
const STRIPE_LINKS = {};
let stripeLinksLoaded = false;

// Conversation context — the "brain"
let context = {
    stage: 'greeting', // greeting, assessing, recommending, product_detail, purchasing, address, complete
    forWhom: null,      // 'self' | 'parent' | 'child' | 'partner' | null
    patientAge: null,
    patientWeight: null,
    patientHeight: null,
    canWalk: null,       // 'yes_some' | 'no' | 'with_help'
    condition: null,     // free text about their condition
    useCase: null,       // 'indoor' | 'outdoor' | 'both' | 'travel'
    needsElectric: null, // true/false/null
    budget: null,        // 'low' | 'mid' | 'high' | null
    selectedProduct: null,
    purchaseState: null, // null | 'confirming' | 'paying' | 'addr_name' | 'addr_street' | 'addr_city' | 'addr_zip' | 'addr_phone' | 'addr_notes' | 'complete'
    order: {},
    questionsAsked: 0,
    history: []
};

let isProcessing = false;

// ─── Testimonials ───
const TESTIMONIALS = [
    { name: "Carlos R.", text: "Le ayudó mucho a mi papá a desplazarse en lugares algo complicados y en pendientes es muy segura", stars: 5 },
    { name: "Wen I.", text: "Es justo como lo necesitábamos, a mí mamá le gustó mucho, buen material y flexible al andar", stars: 5 },
    { name: "Ana O.", text: "Se ha vuelto el Andafacil en parte esencial de mi vida", stars: 5 },
    { name: "Roberto H.", text: "Lo compré para mi madre, tuvo un accidente y se fracturó el pie, este artículo es perfecto para su recuperación", stars: 5 },
    { name: "Pam O.", text: "Me ayuda bastante en mi día a día, no pesa, es fácil de cerrar, el material es resistente", stars: 5 },
    { name: "Daniel P.", text: "Es una compañía muy seria y cumple con sus productos que son de buena calidad", stars: 5 }
];

// ─── Init ───
async function init() {
    try {
        const r1 = await fetch('products.json');
        if (r1.ok) PRODUCTS = await r1.json();
    } catch(e) {}
    try {
        const r2 = await fetch('stripe-links.json');
        if (r2.ok) { Object.assign(STRIPE_LINKS, await r2.json()); stripeLinksLoaded = true; }
    } catch(e) {}

    updateClock();
    setInterval(updateClock, 30000);

    const msgs = document.getElementById('messages');

    // Encrypted notice
    const enc = document.createElement('div');
    enc.className = 'encrypted-notice';
    enc.innerHTML = `<svg viewBox="0 0 16 16"><path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z"/></svg> Los mensajes están cifrados de extremo a extremo.`;
    msgs.appendChild(enc);

    // Date
    const dt = document.createElement('div');
    dt.className = 'date-separator';
    dt.textContent = 'HOY';
    msgs.appendChild(dt);

    // Welcome — short and warm
    await delay(600);
    addBot(`¡Hola! 👋 Soy especialista en movilidad de *Andafacil*.\n\n¿Para quién buscas? 😊

<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Para mi mamá/papá')">👨‍👩‍👦 Mi mamá/papá</span>
<span class="quick-action" onclick="sendQuick('Para mí')">🙋 Para mí</span>
<span class="quick-action" onclick="sendQuick('Para mi abuelo/a')">👴 Abuelo/a</span>
<span class="quick-action" onclick="sendQuick('Solo quiero ver productos')">📦 Ver catálogo</span>
</div>`);

    setupTextarea();
}

function updateClock() {
    const el = document.getElementById('phoneTime');
    if (el) el.textContent = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', hour12: false });
}

// ─── Textarea ───
function setupTextarea() {
    const ta = document.getElementById('userInput');
    ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
    });
    ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// ─── Send ───
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

// ─── THE BRAIN — Physiotherapist Logic ───
async function processInput(text) {
    const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // ── Purchase flow override ──
    if (context.purchaseState) {
        await handlePurchase(text, tl);
        return;
    }

    // ── Purchase intent at any stage ──
    if (context.selectedProduct && (tl.includes('comprar') || tl.includes('la quiero') || tl.includes('lo quiero') || tl.includes('pagar'))) {
        await startPurchase();
        return;
    }

    // ── Greeting / Who is it for ──
    if (context.stage === 'greeting') {
        if (tl.includes('mama') || tl.includes('papa') || tl.includes('padre') || tl.includes('madre')) {
            context.forWhom = 'parent';
            await delay(rand(800,1200));
            addBot(`Para tu mamá/papá 💛 ¿Puede caminar o necesita apoyo?`);
            context.stage = 'assessing';
        } else if (tl.includes('para mi') || tl.includes('para mí') || tl.includes('yo')) {
            context.forWhom = 'self';
            await delay(rand(800,1000));
            addBot(`¡Con gusto! 🙌 ¿Qué dificultad tienes para moverte?`);
            context.stage = 'assessing';
        } else if (tl.includes('abuel')) {
            context.forWhom = 'parent';
            await delay(rand(800,1000));
            addBot(`Para tu abuelito/a 👴 ¿Todavía camina o ya no puede?`);
            context.stage = 'assessing';
        } else if (tl.includes('ver producto') || tl.includes('catalogo') || tl.includes('que tienen')) {
            context.stage = 'recommending';
            await delay(rand(800,1200));
            await showCategories();
        } else {
            // Try to understand
            context.forWhom = 'unknown';
            await delay(rand(600,1000));
            addBot(`¡Con gusto te ayudo! Para darte la mejor recomendación como especialista, me ayudaría saber: ¿es para ti o para un familiar? 😊`);
        }
        return;
    }

    // ── Assessment stage — act like a physiotherapist ──
    if (context.stage === 'assessing') {
        await assessPatient(text, tl);
        return;
    }

    // ── Product detail stage ──
    if (context.stage === 'product_detail') {
        await handleProductQuestions(text, tl);
        return;
    }

    // ── Recommending stage ──
    if (context.stage === 'recommending') {
        await handleRecommendation(text, tl);
        return;
    }

    // ── Fallback — try to be helpful ──
    await delay(rand(800,1200));
    addBot(`Mmm, déjame ver cómo te puedo ayudar mejor. ¿Estás buscando un producto de movilidad? ¿Silla de ruedas, andadera, bastón? Cuéntame y te guío 😊`);
}

// ─── Assessment — The Physiotherapist Questions ───
async function assessPatient(text, tl) {
    context.questionsAsked++;

    // Extract info from text
    if (!context.canWalk) {
        if (tl.includes('no puede caminar') || tl.includes('no camina') || tl.includes('silla de ruedas') || tl.includes('paralisis') || tl.includes('no se puede mover')) {
            context.canWalk = 'no';
        } else if (tl.includes('con ayuda') || tl.includes('con apoyo') || tl.includes('con baston') || tl.includes('con andadera') || tl.includes('dificultad') || tl.includes('se cansa') || tl.includes('poco')) {
            context.canWalk = 'with_help';
        } else if (tl.includes('si camina') || tl.includes('sí camina') || tl.includes('todavia camina') || tl.includes('algo') || tl.includes('distancias cortas')) {
            context.canWalk = 'yes_some';
        }
    }

    // Extract condition
    if (!context.condition) {
        const conditions = ['fractura', 'artritis', 'artrosis', 'cirugia', 'operacion', 'cadera', 'rodilla', 'derrame', 'embolia',
            'paralisis', 'parkinson', 'esclerosis', 'accidente', 'caida', 'cancer', 'debilidad', 'edad', 'viejo', 'mayor'];
        for (const c of conditions) {
            if (tl.includes(c)) { context.condition = c; break; }
        }
    }

    // Extract weight
    const weightMatch = text.match(/(\d{2,3})\s*(kg|kilos|kilogramos)/i) || text.match(/pesa\s*(\d{2,3})/i);
    if (weightMatch) context.patientWeight = parseInt(weightMatch[1]);

    // Extract age
    const ageMatch = text.match(/(\d{2,3})\s*(años|ano)/i) || text.match(/tiene\s*(\d{2,3})/i);
    if (ageMatch) context.patientAge = parseInt(ageMatch[1]);

    // Extract use case
    if (tl.includes('casa') || tl.includes('interior') || tl.includes('adentro') || tl.includes('hogar')) context.useCase = 'indoor';
    if (tl.includes('calle') || tl.includes('exterior') || tl.includes('afuera') || tl.includes('parque')) context.useCase = context.useCase === 'indoor' ? 'both' : 'outdoor';
    if (tl.includes('viaj') || tl.includes('avion') || tl.includes('vuelo')) context.useCase = 'travel';
    if (tl.includes('todo') || tl.includes('ambos') || (tl.includes('casa') && tl.includes('calle'))) context.useCase = 'both';

    // Decide what to ask next
    const pronoun = context.forWhom === 'self' ? 'tú' : (context.forWhom === 'parent' ? 'tu familiar' : 'la persona');

    // First: mobility level
    if (!context.canWalk) {
        await delay(rand(800,1200));
        addBot(`¿Puede caminar o necesita silla? 👇

<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Camina con ayuda')">🚶 Con ayuda</span>
<span class="quick-action" onclick="sendQuick('Ya no puede caminar')">🦽 No camina</span>
<span class="quick-action" onclick="sendQuick('Se cansa rápido')">😮‍💨 Se cansa</span>
</div>`);
        return;
    }

    // Second: where
    if (!context.useCase) {
        await delay(rand(800,1200));
        addBot(`👍 ¿Dónde lo usaría?

<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('En casa')">🏠 Casa</span>
<span class="quick-action" onclick="sendQuick('En la calle')">🌳 Calle</span>
<span class="quick-action" onclick="sendQuick('Ambos')">🏠🌳 Ambos</span>
<span class="quick-action" onclick="sendQuick('Para viajar')">✈️ Viajes</span>
</div>`);
        return;
    }

    // Third: weight
    if (!context.patientWeight && context.canWalk === 'no') {
        await delay(rand(600,1000));
        addBot(`¿Cuánto pesa aproximadamente? (para capacidad de la silla)`);
        return;
    }

    // We have enough info — make recommendation
    context.stage = 'recommending';
    await makeRecommendation();
}

// ─── Make Smart Recommendation ───
async function makeRecommendation() {
    await delay(rand(1500,2500));

    let recs = [];

    // Logic based on assessment
    if (context.canWalk === 'no') {
        if (context.useCase === 'travel') {
            recs = PRODUCTS.filter(p => { const n = p.name.toLowerCase(); return n.includes('easy go') || (n.includes('portatil') && n.includes('electrica')); }).slice(0, 2);
            if (recs.length === 0) recs = PRODUCTS.filter(p => p.name.toLowerCase().includes('electrica')).slice(0, 2);
        } else if (context.useCase === 'outdoor' || context.useCase === 'both') {
            recs = PRODUCTS.filter(p => { const n = p.name.toLowerCase(); return (n.includes('pro') && n.includes('silla') && n.includes('electrica')) || n.includes('todo terreno'); }).slice(0, 2);
        } else {
            recs = PRODUCTS.filter(p => p.name.toLowerCase().includes('silla') && p.name.toLowerCase().includes('electrica')).slice(0, 3);
        }
        if (context.patientWeight && context.patientWeight > 120) {
            const heavy = PRODUCTS.filter(p => p.name.toLowerCase().includes('150kg') || p.name.toLowerCase().includes('xxl'));
            if (heavy.length > 0) recs = [...heavy, ...recs].slice(0, 2);
        }
    } else if (context.canWalk === 'with_help') {
        if (context.condition && ['paralisis','parkinson','esclerosis','derrame','embolia'].includes(context.condition)) {
            recs = PRODUCTS.filter(p => p.name.toLowerCase().includes('andadera') && p.name.toLowerCase().includes('electrica')).slice(0, 1);
            recs = [...recs, ...PRODUCTS.filter(p => p.name.toLowerCase().includes('silla') && p.name.toLowerCase().includes('electrica')).slice(0, 1)];
        } else {
            recs = PRODUCTS.filter(p => { const n = p.name.toLowerCase(); return n.includes('andadera') && (n.includes('2 en 1') || n.includes('vertical') || n.includes('ruedas')); }).slice(0, 3);
        }
    } else if (context.canWalk === 'yes_some') {
        recs = PRODUCTS.filter(p => { const n = p.name.toLowerCase(); return (n.includes('andadera') && !n.includes('electrica')) || n.includes('baston') || n.includes('rollator'); }).slice(0, 3);
    }

    if (recs.length === 0) recs = PRODUCTS.filter(p => p.price).slice(0, 3);

    // Short intro — 1-2 lines max
    let intro = '';
    if (context.canWalk === 'no' && (context.useCase === 'both' || context.useCase === 'outdoor')) {
        intro = `👨‍⚕️ Para su situación necesita una silla eléctrica *todo terreno* — las calles en México son complicadas. Mira estas opciones:`;
    } else if (context.canWalk === 'with_help') {
        intro = `👨‍⚕️ Lo mejor es mantener la movilidad activa. Una buena andadera hace toda la diferencia 💪`;
    } else if (context.canWalk === 'no' && context.useCase === 'travel') {
        intro = `👨‍⚕️ Para viajes necesitas algo *ultraligero y plegable*. Mira:`;
    } else {
        intro = `👨‍⚕️ Basándome en lo que me cuentas, te recomiendo:`;
    }

    addBot(intro);

    // Send each product as a visual card with image
    for (let i = 0; i < Math.min(recs.length, 3); i++) {
        await delay(rand(600, 1200));
        addProductCard(recs[i], i);
    }

    // Short follow-up
    await delay(rand(400, 800));
    const t = TESTIMONIALS[Math.floor(Math.random() * TESTIMONIALS.length)];
    addBot(`💬 _"${t.text}"_ — ${t.name} ⭐⭐⭐⭐⭐\n\n¿Cuál te gusta? Tócala para ver más 👆`);
}

// Product card with image
function addProductCard(p, index) {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'msg bot';
    const idx = PRODUCTS.indexOf(p);
    const shortName = p.name.replace(/Andafacil®?\s*/gi, '').replace(/\s*\|.*/, '');
    const topSpecs = (p.specs || []).slice(0, 2).join(' · ');

    d.innerHTML = `<div class="msg-bubble" style="padding:3px 3px 4px">
        <div class="msg-product-card" onclick="selectProduct(${idx})" style="cursor:pointer">
            ${p.image ? `<img src="${p.image}" alt="${shortName}" onerror="this.style.display='none'">` : ''}
            <div class="msg-product-card-body">
                <h4>${shortName}</h4>
                <span class="price">${p.price || ''}</span>${p.regularPrice ? `<span class="old-price">${p.regularPrice}</span>` : ''}
                ${topSpecs ? `<div class="specs">${topSpecs}</div>` : ''}
            </div>
        </div>
        <span class="msg-time">${getTime()}</span>
    </div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

// Make selectProduct globally accessible
window.selectProduct = function(index) {
    const p = PRODUCTS[index];
    if (p) {
        context.selectedProduct = p;
        context.stage = 'product_detail';
        showProductDetailVisual(p);
    }
};

// ─── Product Detail ───
async function handleProductQuestions(text, tl) {
    const p = context.selectedProduct;

    if (tl.includes('comprar') || tl.includes('la quiero') || tl.includes('lo quiero') || tl.includes('este') || tl.includes('pagar')) {
        await startPurchase();
        return;
    }

    // Find if asking about a different product
    const newP = findProduct(text);
    if (newP && newP !== p) {
        context.selectedProduct = newP;
        await delay(rand(1000,1600));
        await showProductDetail(newP);
        return;
    }

    // Answer specific questions
    if (tl.includes('bateria') || tl.includes('carga') || tl.includes('dura') || tl.includes('autonomia') || tl.includes('kilometr')) {
        await delay(rand(600,1000));
        const batterySpec = (p.specs || []).find(s => s.toLowerCase().includes('batería') || s.toLowerCase().includes('autonomía') || s.toLowerCase().includes('carga'));
        addBot(`🔋 ${batterySpec || '~10-15km por carga'}\n⏰ Se carga por la noche, como un celular\n\n¿Le entramos? 😊`);
        addBot(`<div class="quick-actions"><span class="quick-action" onclick="sendQuick('La quiero')">💳 Sí!</span></div>`);
        return;
    }

    if (tl.includes('peso') || tl.includes('pesa') || tl.includes('pesad') || tl.includes('ligera') || tl.includes('kilo')) {
        await delay(rand(600,1000));
        const weightSpec = (p.specs || []).find(s => s.toLowerCase().includes('peso') || s.toLowerCase().includes('kg'));
        addBot(`⚖️ ${weightSpec || 'Peso varía según modelo'}\n📐 Plegable — cabe en cajuela 🚗`);
        return;
    }

    if (tl.includes('dimension') || tl.includes('tamano') || tl.includes('tamaño') || tl.includes('cabe') || tl.includes('plegable') || tl.includes('plegar')) {
        await delay(rand(600,1000));
        addBot(`📐 Plegable — se compacta para cajuela o clóset\n${context.useCase === 'travel' ? '✈️ Algunas caben como equipaje de mano' : '🏠 Fácil de guardar en casa'}`);
        return;
    }

    // Video request
    if (tl.includes('video') || tl.includes('verlo') || tl.includes('funcionando')) {
        await delay(rand(800,1200));
        if (p.image) {
            const c = document.getElementById('messages');
            const d = document.createElement('div');
            d.className = 'msg bot';
            d.innerHTML = `<div class="msg-bubble" style="padding:3px">
                <span class="msg-sender">Andafacil 🦽</span>
                <div class="msg-video" onclick="window.open('${p.url || 'https://andafacil.com'}','_blank')">
                    <img src="${p.image}" alt="Video">
                    <div class="msg-video-play"></div>
                    <div class="msg-video-duration">0:30</div>
                </div>
                <span class="msg-time">${getTime()}</span>
            </div>`;
            c.appendChild(d);
            c.scrollTop = c.scrollHeight;
        }
        await delay(400);
        addBot(`Ahí puedes ver cómo funciona 👆 ¿Qué te parece?`);
        addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Me encanta, la quiero')">💳 ¡La quiero!</span>
<span class="quick-action" onclick="sendQuick('Tengo otra duda')">❓ Otra duda</span>
</div>`);
        return;
    }

    // Warranty
    if (tl.includes('garantia') || tl.includes('garantía') || tl.includes('devolucion')) {
        await delay(rand(600,1000));
        addBot(`🛡️ *1 año de garantía*\n🔄 30 días de devolución\n📞 Soporte por WhatsApp\n\n¿Le entramos? 😊`);
        addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('La quiero comprar')">💳 Sí, la quiero</span>
</div>`);
        return;
    }

    // Generic follow-up — keep it SHORT
    await delay(rand(800,1200));
    addBot(`¿Qué más quieres saber? 😊`);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('¿Cuánto dura la batería?')">🔋 Batería</span>
<span class="quick-action" onclick="sendQuick('¿Tienen video?')">🎥 Video</span>
<span class="quick-action" onclick="sendQuick('La quiero comprar')">💳 Comprar</span>
</div>`);
}

async function showProductDetail(p) {
    context.selectedProduct = p;
    context.stage = 'product_detail';
    await showProductDetailVisual(p);
}

async function showProductDetailVisual(p) {
    // Send product image first (like sharing a photo)
    if (p.image) {
        const c = document.getElementById('messages');
        const d = document.createElement('div');
        d.className = 'msg bot';
        const shortName = p.name.replace(/Andafacil®?\s*/gi, '');
        d.innerHTML = `<div class="msg-bubble" style="padding:3px">
            <span class="msg-sender">Andafacil 🦽</span>
            <div class="msg-image">
                <img src="${p.image}" alt="${shortName}" onerror="this.parentElement.style.display='none'">
                ${p.price ? `<div class="msg-image-price">${p.price}</div>` : ''}
            </div>
            <div class="msg-image-caption"><strong>${shortName}</strong></div>
            <span class="msg-time">${getTime()}</span>
        </div>`;
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }

    // Short specs message
    await delay(rand(500, 900));
    let specs = '';
    if (p.specs && p.specs.length > 0) {
        specs = p.specs.slice(0, 4).map(s => `✅ ${s}`).join('\n');
    }

    // Personalized one-liner
    let tip = '';
    if (context.canWalk === 'no' && p.name.toLowerCase().includes('electrica')) {
        tip = `\n\n👨‍⚕️ _Se controla con joystick, no requiere esfuerzo. Ideal para su caso._`;
    } else if (context.canWalk === 'with_help' && p.name.toLowerCase().includes('andadera')) {
        tip = `\n\n👨‍⚕️ _Mantener la movilidad es clave. Mejor que dejar de caminar._`;
    }

    addBot(`${specs}${tip}`);

    await delay(400);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('La quiero comprar')">💳 ¡La quiero!</span>
<span class="quick-action" onclick="sendQuick('¿Cuánto dura la batería?')">🔋 Batería</span>
<span class="quick-action" onclick="sendQuick('¿Se pliega?')">📐 Plegado</span>
<span class="quick-action" onclick="sendQuick('¿Tienen video?')">🎥 Video</span>
</div>`);
}

// ─── Handle recommendation stage ───
async function handleRecommendation(text, tl) {
    const matched = findProduct(text);
    if (matched) {
        await delay(rand(1000,1500));
        await showProductDetail(matched);
        return;
    }

    // Check for category browsing
    if (tl.includes('silla') || tl.includes('electrica') || tl.includes('ruedas')) {
        const chairs = PRODUCTS.filter(p => p.name.toLowerCase().includes('silla') && p.name.toLowerCase().includes('electrica')).slice(0, 3);
        await delay(rand(1000,1500));
        let msg = `Estas son nuestras sillas de ruedas eléctricas más populares:\n\n`;
        chairs.forEach((p, i) => {
            msg += `${i+1}. *${p.name}*\n💰 ${p.price || 'Consultar'}\n\n`;
        });
        msg += `¿Cuál te interesa? 😊`;
        addBot(msg);
        return;
    }

    if (tl.includes('andadera') || tl.includes('caminar') || tl.includes('andar')) {
        const walkers = PRODUCTS.filter(p => p.name.toLowerCase().includes('andadera')).slice(0, 3);
        await delay(rand(1000,1500));
        let msg = `Estas son nuestras andaderas más vendidas:\n\n`;
        walkers.forEach((p, i) => {
            msg += `${i+1}. *${p.name}*\n💰 ${p.price || 'Consultar'}\n\n`;
        });
        msg += `¿De cuál te cuento más? 😊`;
        addBot(msg);
        return;
    }

    // Go back to assessment if we don't understand
    await delay(rand(800,1400));
    addBot(`Cuéntame más para poder orientarte mejor — ¿qué tipo de producto buscas?\n\n<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Sillas de ruedas eléctricas')">🦽 Sillas eléctricas</span>
<span class="quick-action" onclick="sendQuick('Andaderas')">🚶 Andaderas</span>
<span class="quick-action" onclick="sendQuick('Bastones')">🦯 Bastones</span>
</div>`);
}

async function showCategories() {
    addBot(`¿Qué buscas? 👇

<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Sillas de ruedas eléctricas')">🦽 Eléctricas</span>
<span class="quick-action" onclick="sendQuick('Andaderas')">🚶 Andaderas</span>
<span class="quick-action" onclick="sendQuick('Bastones')">🦯 Bastones</span>
<span class="quick-action" onclick="sendQuick('Cuéntame la situación y recomiéndame')">👨‍⚕️ Recomiéndame</span>
</div>`);
}

// ─── Purchase Flow ───
async function startPurchase() {
    const p = context.selectedProduct;
    if (!p) {
        addBot(`¿Qué producto te gustaría comprar? Dime cuál y te armo el pedido 😊`);
        return;
    }
    context.purchaseState = 'confirming';
    context.order = { product: p };
    await delay(rand(1000,1500));

    let msg = `¡Excelente elección! 🙌\n\n`;
    msg += `📦 *${p.name}*\n`;
    if (p.price) msg += `💰 *${p.price}*\n`;
    msg += `🚚 Envío a todo México incluido\n`;
    msg += `🛡️ Garantía de 1 año\n`;
    msg += `🔄 30 días de devolución\n\n`;
    msg += `¿Te genero el link de pago seguro? 🔒`;
    addBot(msg);
    await delay(300);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Sí, genérame el link de pago')">✅ Sí, generar link</span>
<span class="quick-action" onclick="sendQuick('Tengo una duda antes')">❓ Tengo una duda</span>
</div>`);
}

async function handlePurchase(text, tl) {
    if (tl.includes('cancelar') || tl.includes('no quiero') || tl.includes('duda')) {
        context.purchaseState = null;
        context.stage = 'product_detail';
        await delay(800);
        addBot(`¡Sin problema! 😊 ¿Qué duda tienes? Estoy para ayudarte.`);
        return;
    }

    switch (context.purchaseState) {
        case 'confirming':
            if (tl.includes('si') || tl.includes('sí') || tl.includes('genera') || tl.includes('link') || tl.includes('pagar')) {
                context.purchaseState = 'paying';
                await delay(rand(1500,2500));
                const payUrl = findStripeLink(context.selectedProduct);
                let msg = `Aquí tienes tu link de pago seguro 🔒\n\n`;
                msg += `<a href="${payUrl}" class="btn-pay" target="_blank">💳 Pagar ${context.selectedProduct.price || ''}</a>\n\n`;
                msg += `Aceptamos:\n• 💳 Tarjeta de crédito/débito\n• 🏪 Pago en OXXO\n• 🏦 Transferencia SPEI\n\n`;
                msg += `Cuando completes el pago, escríbeme *"ya pagué"* ✅`;
                addBot(msg);
                await delay(300);
                addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Ya pagué')">✅ Ya pagué</span>
<span class="quick-action" onclick="sendQuick('Simular pago (demo)')">🎬 Demo: simular pago</span>
</div>`);
            }
            break;

        case 'paying':
            if (tl.includes('pague') || tl.includes('pagué') || tl.includes('listo') || tl.includes('pagado') || tl.includes('simular') || tl.includes('demo')) {
                context.purchaseState = 'addr_name';
                const isDemo = tl.includes('simular') || tl.includes('demo');
                await delay(1000);
                addBot(`${isDemo ? '_🎬 Modo demo — simulando pago completado_\n\n' : ''}¡Pago recibido! ✅🎉\n\nAhora necesito los datos de envío. ¿Cuál es el *nombre completo* de quien recibe?`);
            }
            break;

        case 'addr_name':
            context.order.name = text;
            context.purchaseState = 'addr_street';
            await delay(rand(500,800));
            addBot(`Perfecto, ${text.split(' ')[0]} 👍 ¿*Dirección completa*?\n\n_(Calle, número, colonia)_`);
            break;

        case 'addr_street':
            context.order.street = text;
            context.purchaseState = 'addr_city';
            await delay(rand(500,700));
            addBot(`¿*Ciudad y Estado*?`);
            break;

        case 'addr_city':
            context.order.city = text;
            context.purchaseState = 'addr_zip';
            await delay(rand(500,700));
            addBot(`¿*Código postal*?`);
            break;

        case 'addr_zip':
            context.order.zip = text;
            context.purchaseState = 'addr_phone';
            await delay(rand(500,700));
            addBot(`¿*Teléfono* de contacto para el repartidor? 📞`);
            break;

        case 'addr_phone':
            context.order.phone = text;
            context.purchaseState = 'addr_notes';
            await delay(rand(500,800));
            addBot(`¿Alguna *instrucción especial* para la entrega?\n\n_(Edificio, piso, entre calles, o "no" si no hay)_`);
            break;

        case 'addr_notes':
            context.order.notes = tl === 'no' ? 'Ninguna' : text;
            context.purchaseState = 'complete';
            await delay(rand(1500,2000));

            const p = context.selectedProduct;
            let msg = `¡Tu pedido está confirmado! 🎉📦\n\n`;
            msg += `*📋 Resumen:*\n`;
            msg += `📦 ${p.name}\n`;
            if (p.price) msg += `💰 ${p.price}\n`;
            msg += `💳 Pago: ✅ Completado\n\n`;
            msg += `*📍 Envío a:*\n`;
            msg += `👤 ${context.order.name}\n`;
            msg += `🏠 ${context.order.street}\n`;
            msg += `📍 ${context.order.city}, CP ${context.order.zip}\n`;
            msg += `📞 ${context.order.phone}\n`;
            if (context.order.notes !== 'Ninguna') msg += `📝 ${context.order.notes}\n`;
            msg += `\n🚚 *Tiempo estimado: 3-7 días hábiles*\n\n`;
            msg += `¡Gracias por confiar en *Andafacil*! 🙌 Si tienes cualquier duda sobre el armado o uso del producto, escríbeme aquí. ¡Estamos para ti! 💚`;
            addBot(msg);

            // Reset
            context.purchaseState = null;
            context.selectedProduct = null;
            context.stage = 'greeting';
            context.order = {};
            break;
    }
}

function findStripeLink(product) {
    if (!stripeLinksLoaded) return 'https://buy.stripe.com/demo';
    const n = (product.name || '').toLowerCase();
    if (n.includes('pro') && n.includes('silla') && n.includes('electrica')) return (STRIPE_LINKS['andafacil-pro-silla'] || {}).url || '';
    if (n.includes('easy')) return (STRIPE_LINKS['andafacil-easygo'] || {}).url || '';
    if (n.includes('andadera') && n.includes('electrica')) return (STRIPE_LINKS['andafacil-andadera-electrica'] || {}).url || '';
    if (n.includes('2 en 1') || n.includes('2en1')) return (STRIPE_LINKS['andadera-2en1'] || {}).url || '';
    if (n.includes('3 en 1') || n.includes('reclinable')) return (STRIPE_LINKS['silla-3en1'] || {}).url || '';
    if (n.includes('pack') || n.includes('2x')) return (STRIPE_LINKS['pack-2x-todo-terreno'] || {}).url || '';
    const first = Object.values(STRIPE_LINKS)[0];
    return first ? first.url : 'https://buy.stripe.com/demo';
}

// ─── Product Search ───
function findProduct(text) {
    const tl = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let best = null, bestScore = 0;
    for (const p of PRODUCTS) {
        const pn = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let score = 0;
        const words = tl.split(/\s+/).filter(w => w.length > 3);
        const pWords = pn.split(/\s+/);
        for (const w of words) {
            for (const pw of pWords) {
                if (pw.includes(w) || w.includes(pw)) score += 10;
            }
        }
        if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 20 ? best : null;
}

// ─── DOM ───
function getTime() {
    return new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', hour12: false });
}

function addBot(html) {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'msg bot';
    html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    d.innerHTML = `<div class="msg-bubble"><span class="msg-sender">Andafacil 🦽</span>${html}<span class="msg-time">${getTime()}</span></div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

function addUser(text) {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'msg user';
    d.innerHTML = `<div class="msg-bubble">${esc(text)}<span class="msg-time">${getTime()} <span class="msg-ticks"><svg viewBox="0 0 16 11"><path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.95-2.95a.456.456 0 00-.304-.178h-.076a.457.457 0 00-.305.178l-.609.61a.456.456 0 000 .609l3.838 3.838c.178.178.381.254.584.254a.652.652 0 00.508-.279l6.999-8.61a.456.456 0 00.076-.381.456.456 0 00-.178-.305l-.708-.498zM14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.381.178l-6.19 7.636-1.143-1.143-.356.356-.508.559 2.007 2.007c.178.178.381.254.584.254a.652.652 0 00.508-.279l6.999-8.61a.456.456 0 00.076-.381.456.456 0 00-.178-.305l-.708-.498z"/></svg></span></span></div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

function showTyping() {
    document.getElementById('headerStatus').textContent = 'escribiendo...';
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'typing'; d.id = 'typingIndicator';
    d.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
}

function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
    document.getElementById('headerStatus').textContent = 'en línea';
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

document.addEventListener('DOMContentLoaded', init);