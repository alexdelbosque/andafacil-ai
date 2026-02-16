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

    // Welcome
    await delay(600);
    addBot(`¡Hola! 👋 Soy el asistente de *Andafacil*. Soy especialista en movilidad y puedo ayudarte a encontrar el producto perfecto.\n\n¿Para quién estás buscando? 😊`);
    await delay(300);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Para mi mamá/papá')">👨‍👩‍👦 Mi mamá/papá</span>
<span class="quick-action" onclick="sendQuick('Para mí')">🙋 Para mí</span>
<span class="quick-action" onclick="sendQuick('Para mi abuelo/a')">👴 Abuelo/a</span>
<span class="quick-action" onclick="sendQuick('Solo quiero ver productos')">📦 Ver productos</span>
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
            await delay(rand(800,1400));
            addBot(`Entiendo, es para tu mamá o papá 💛 Es muy bonito que estés buscando opciones para ayudarle.\n\nCuéntame un poco más — ¿qué dificultad tiene actualmente? ¿Puede caminar por sí mismo/a o necesita apoyo?`);
            context.stage = 'assessing';
        } else if (tl.includes('para mi') || tl.includes('para mí') || tl.includes('yo')) {
            context.forWhom = 'self';
            await delay(rand(800,1200));
            addBot(`Perfecto, me da gusto ayudarte directamente 🙌\n\nPara recomendarte lo mejor, necesito entender tu situación. ¿Qué dificultad tienes actualmente para moverte? ¿Puedes caminar distancias cortas o necesitas apoyo constante?`);
            context.stage = 'assessing';
        } else if (tl.includes('abuel')) {
            context.forWhom = 'parent';
            await delay(rand(800,1200));
            addBot(`Para tu abuelito/a 👴 ¡qué lindo detalle!\n\n¿Me puedes contar qué dificultad tiene? ¿Todavía camina con algo de ayuda o ya no puede caminar?`);
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

    // First: understand mobility level
    if (!context.canWalk) {
        await delay(rand(1000,1800));
        addBot(`Gracias por compartirme eso. Para entender mejor la situación de ${pronoun}:\n\n¿Puede caminar distancias cortas (aunque sea con ayuda), o necesita estar en silla de ruedas todo el tiempo?`);
        addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Todavía camina un poco con ayuda')">🚶 Camina con ayuda</span>
<span class="quick-action" onclick="sendQuick('Ya no puede caminar')">🦽 No puede caminar</span>
<span class="quick-action" onclick="sendQuick('Se cansa mucho al caminar')">😮‍💨 Se cansa rápido</span>
</div>`);
        return;
    }

    // Second: where will they use it
    if (!context.useCase) {
        await delay(rand(1000,1600));
        addBot(`Perfecto, eso me ayuda mucho 👍\n\n¿Dónde lo usaría principalmente? Esto es importante porque las calles en México pueden ser irregulares, y no todos los productos funcionan igual en distintos terrenos.`);
        addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Dentro de la casa')">🏠 Casa</span>
<span class="quick-action" onclick="sendQuick('En la calle y exteriores')">🌳 Exteriores</span>
<span class="quick-action" onclick="sendQuick('Ambos, casa y calle')">🏠🌳 Ambos</span>
<span class="quick-action" onclick="sendQuick('Para viajar')">✈️ Viajes</span>
</div>`);
        return;
    }

    // Third: weight (important for capacity)
    if (!context.patientWeight && context.canWalk === 'no') {
        await delay(rand(800,1400));
        addBot(`Una pregunta técnica importante — ¿cuánto pesa ${pronoun} aproximadamente? Esto lo necesito para asegurarme de que el producto soporte su peso correctamente.\n\nNo tiene que ser exacto, un aproximado está bien 😊`);
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
    const pronoun = context.forWhom === 'self' ? 'ti' : 'tu familiar';

    // Logic based on assessment
    if (context.canWalk === 'no') {
        // Needs wheelchair
        if (context.useCase === 'travel') {
            recs = PRODUCTS.filter(p => {
                const n = p.name.toLowerCase();
                return n.includes('easy go') || n.includes('portatil') && n.includes('electrica');
            }).slice(0, 2);
            if (recs.length === 0) recs = PRODUCTS.filter(p => p.name.toLowerCase().includes('electrica')).slice(0, 2);
        } else if (context.useCase === 'outdoor' || context.useCase === 'both') {
            recs = PRODUCTS.filter(p => {
                const n = p.name.toLowerCase();
                return (n.includes('pro') && n.includes('silla') && n.includes('electrica')) || n.includes('todo terreno');
            }).slice(0, 2);
        } else {
            recs = PRODUCTS.filter(p => {
                const n = p.name.toLowerCase();
                return n.includes('silla') && n.includes('electrica');
            }).slice(0, 3);
        }

        // Check weight capacity
        if (context.patientWeight && context.patientWeight > 120) {
            const heavy = PRODUCTS.filter(p => {
                const n = p.name.toLowerCase();
                return n.includes('150kg') || n.includes('extra fuerte') || n.includes('xxl');
            });
            if (heavy.length > 0) recs = [...heavy, ...recs].slice(0, 2);
        }

    } else if (context.canWalk === 'with_help') {
        // Needs walker or electric walker
        if (context.condition && ['paralisis', 'parkinson', 'esclerosis', 'derrame', 'embolia'].includes(context.condition)) {
            recs = PRODUCTS.filter(p => p.name.toLowerCase().includes('andadera') && p.name.toLowerCase().includes('electrica')).slice(0, 1);
            const wheelchairs = PRODUCTS.filter(p => p.name.toLowerCase().includes('silla') && p.name.toLowerCase().includes('electrica')).slice(0, 1);
            recs = [...recs, ...wheelchairs];
        } else {
            recs = PRODUCTS.filter(p => {
                const n = p.name.toLowerCase();
                return n.includes('andadera') && (n.includes('2 en 1') || n.includes('vertical') || n.includes('ruedas'));
            }).slice(0, 3);
        }

    } else if (context.canWalk === 'yes_some') {
        // Needs light support
        recs = PRODUCTS.filter(p => {
            const n = p.name.toLowerCase();
            return (n.includes('andadera') && !n.includes('electrica')) || n.includes('baston') || n.includes('rollator');
        }).slice(0, 3);
    }

    if (recs.length === 0) {
        recs = PRODUCTS.filter(p => p.price).slice(0, 3);
    }

    // Build the recommendation like a real physiotherapist
    let intro = `Basándome en lo que me cuentas, como especialista te recomiendo:\n\n`;

    if (context.canWalk === 'no' && context.useCase === 'both') {
        intro = `Entendido. Si ${pronoun} ya no puede caminar y necesita movilidad tanto en casa como en la calle, lo más importante es una *silla de ruedas eléctrica con llantas todo terreno*. Las calles en México pueden ser complicadas, así que esto es clave.\n\nTe recomiendo:\n\n`;
    } else if (context.canWalk === 'with_help') {
        intro = `Si todavía puede caminar con algo de apoyo, lo mejor es mantener esa movilidad el mayor tiempo posible — una andadera correcta hace toda la diferencia. Le va a dar seguridad y confianza al caminar.\n\nTe recomiendo:\n\n`;
    } else if (context.canWalk === 'no' && context.useCase === 'travel') {
        intro = `Para viajes necesitas algo *ultraligero y plegable* que quepa en un maletero o incluso en avión. Hay opciones excelentes.\n\nTe recomiendo:\n\n`;
    }

    let msg = intro;
    recs.forEach((p, i) => {
        const num = ['1️⃣', '2️⃣', '3️⃣'][i] || `${i+1}.`;
        msg += `${num} *${p.name}*\n`;
        if (p.price) msg += `💰 ${p.price}`;
        if (p.regularPrice) msg += ` (antes ${p.regularPrice})`;
        msg += '\n';
        if (p.specs && p.specs.length > 0) {
            msg += p.specs.slice(0, 3).map(s => `   ✅ ${s}`).join('\n') + '\n';
        }
        msg += '\n';
    });

    // Add personalized tip
    if (context.canWalk === 'no' && context.patientWeight && context.patientWeight > 100) {
        msg += `💡 *Tip:* Con un peso de ~${context.patientWeight}kg, las tres opciones lo soportan bien (capacidad de 100-150kg). La estructura es de aluminio reforzado.\n\n`;
    }
    if (context.useCase === 'both') {
        msg += `💡 *Tip:* Todas estas tienen llantas diseñadas específicamente para las calles de México — banquetas irregulares, topes, etc.\n\n`;
    }

    // Testimonial
    const t = TESTIMONIALS[Math.floor(Math.random() * TESTIMONIALS.length)];
    msg += `💬 _"${t.text}"_ — ${t.name} ⭐⭐⭐⭐⭐\n\n`;
    msg += `¿Cuál te llama más la atención? Te puedo dar más detalles de cualquiera 😊`;

    addBot(msg);

    await delay(400);
    const quickBtns = recs.slice(0, 3).map((p, i) => {
        const short = p.name.replace(/Andafacil\s*/gi, '').substring(0, 25);
        return `<span class="quick-action" onclick="selectProduct(${PRODUCTS.indexOf(p)})">${['1️⃣','2️⃣','3️⃣'][i]} ${short}</span>`;
    }).join('');
    addBot(`<div class="quick-actions">${quickBtns}</div>`);
}

// Make selectProduct globally accessible
window.selectProduct = function(index) {
    const p = PRODUCTS[index];
    if (p) {
        document.getElementById('userInput').value = `Cuéntame más sobre ${p.name}`;
        sendMessage();
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
        await delay(rand(800,1400));
        const batterySpec = (p.specs || []).find(s => s.toLowerCase().includes('batería') || s.toLowerCase().includes('autonomía') || s.toLowerCase().includes('carga'));
        if (batterySpec) {
            addBot(`Sobre la batería del *${p.name}*:\n\n🔋 ${batterySpec}\n\nLa batería se carga por la noche mientras no se usa, como cargar un celular. En uso normal dura todo el día sin problemas.\n\n¿Algo más que quieras saber, o le entramos? 😊`);
        } else {
            addBot(`La batería típicamente dura entre 8-15km por carga dependiendo del modelo, y se carga en 6-8 horas. Lo ideal es cargarla por la noche.\n\n¿Te lo llevas? 😊`);
        }
        return;
    }

    if (tl.includes('peso') || tl.includes('pesa') || tl.includes('pesad') || tl.includes('ligera') || tl.includes('kilo')) {
        await delay(rand(800,1200));
        const weightSpec = (p.specs || []).find(s => s.toLowerCase().includes('peso') || s.toLowerCase().includes('kg'));
        addBot(`${weightSpec ? `📏 ${weightSpec}` : 'El peso varía según el modelo.'}\n\nEs importante: ${context.useCase === 'travel' ? 'para viajes necesitas algo ligero y plegable' : 'es una estructura sólida pero manejable'}. ${context.forWhom === 'parent' ? '¿Alguien le va a ayudar a transportarla?' : '¿Necesitas moverla seguido?'}`);
        return;
    }

    if (tl.includes('dimension') || tl.includes('tamaño') || tl.includes('tamano') || tl.includes('cabe') || tl.includes('plegable') || tl.includes('plegar')) {
        await delay(rand(800,1200));
        addBot(`El *${p.name}* es plegable 📐 — se compacta para guardarse en un clóset o en la cajuela del carro.\n\nIdeal para ${context.useCase === 'travel' ? 'viajes — cabe incluso como equipaje de mano en algunos casos' : 'guardar en casa cuando no se usa'}.\n\n¿Algo más? 😊`);
        return;
    }

    // Generic follow-up
    await delay(rand(1000,1500));
    addBot(`¿Qué más te gustaría saber sobre el *${p.name}*? Te puedo hablar de:\n\n• 🔋 Batería y autonomía\n• ⚖️ Peso y dimensiones\n• 🛡️ Garantía\n• 💰 Precio y formas de pago\n• 🚚 Envío\n\nO si ya te convence, dime *"la quiero"* y te armo el pedido 🙌`);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('¿Cuánto dura la batería?')">🔋 Batería</span>
<span class="quick-action" onclick="sendQuick('¿Cuánto pesa?')">⚖️ Peso</span>
<span class="quick-action" onclick="sendQuick('La quiero comprar')">💳 Comprar</span>
</div>`);
}

async function showProductDetail(p) {
    context.selectedProduct = p;
    context.stage = 'product_detail';

    let msg = `*${p.name}*\n\n`;
    if (p.description) {
        msg += p.description.substring(0, 200) + '...\n\n';
    }
    if (p.specs && p.specs.length > 0) {
        msg += `📋 *Especificaciones clave:*\n`;
        p.specs.slice(0, 5).forEach(s => { msg += `• ${s}\n`; });
        msg += '\n';
    }
    if (p.price) {
        msg += `💰 *${p.price}*`;
        if (p.regularPrice) msg += ` ~~${p.regularPrice}~~`;
        msg += '\n\n';
    }

    // Personalized note based on assessment
    if (context.canWalk === 'no' && p.name.toLowerCase().includes('electrica')) {
        msg += `👨‍⚕️ _Como especialista, este modelo es ideal para ${context.forWhom === 'self' ? 'tu situación' : 'la situación de tu familiar'} porque no requiere esfuerzo físico — se controla con un joystick fácil de usar._\n\n`;
    }
    if (context.canWalk === 'with_help' && p.name.toLowerCase().includes('andadera')) {
        msg += `👨‍⚕️ _Excelente opción para mantener la movilidad activa. Usar andadera es mucho mejor que dejar de caminar — los músculos necesitan actividad._\n\n`;
    }

    msg += `¿Quieres saber algo específico o la armamos? 😊`;
    addBot(msg);

    await delay(400);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('La quiero comprar')">💳 ¡La quiero!</span>
<span class="quick-action" onclick="sendQuick('¿Cuánto dura la batería?')">🔋 Batería</span>
<span class="quick-action" onclick="sendQuick('¿Tienen garantía?')">🛡️ Garantía</span>
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
    addBot(`Tenemos varias categorías de productos:\n\n🦽 *Sillas de ruedas eléctricas* — para quienes necesitan movilidad completa\n🚶 *Andaderas* — para quienes caminan con apoyo\n🦯 *Bastones* — apoyo ligero\n🛁 *Sillas de baño* — seguridad en el hogar\n🔧 *Accesorios* — baterías, cargadores, soportes\n\n¿Qué te interesa? O mejor — cuéntame la situación y yo te recomiendo 💪`);
    await delay(300);
    addBot(`<div class="quick-actions">
<span class="quick-action" onclick="sendQuick('Sillas de ruedas eléctricas')">🦽 Eléctricas</span>
<span class="quick-action" onclick="sendQuick('Andaderas')">🚶 Andaderas</span>
<span class="quick-action" onclick="sendQuick('Mi mamá necesita ayuda para caminar')">👩‍⚕️ Que me recomiende</span>
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