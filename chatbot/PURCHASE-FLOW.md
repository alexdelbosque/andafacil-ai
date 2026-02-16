# Purchase Flow — Stripe Payment Link + Address Collection

## Overview
The chatbot handles the entire purchase funnel inside the conversation:
Product Selection → Payment Link → Address Collection → Order Confirmation

## Step 1: Product Confirmation
```
Customer: "Quiero la Andafacil Pro"
Bot: "¡Excelente elección! 🙌 La Andafacil Pro - Silla de Ruedas Eléctrica:
- Plegable y todo terreno
- Soporta hasta 136kg  
- Batería de ~10km por carga
- Llantas diseñadas para calles mexicanas

El precio es $XX,XXX MXN con envío gratis. ¿Te genero el link de pago?"
```

## Step 2: Stripe Payment Link Generation
When the customer confirms, generate a Stripe Payment Link:

```bash
# Using Stripe API
curl https://api.stripe.com/v1/payment_links \
  -u sk_live_XXXXX: \
  -d "line_items[0][price]=price_XXXXX" \
  -d "line_items[0][quantity]=1" \
  -d "after_completion[type]=redirect" \
  -d "after_completion[redirect][url]=https://andafacil.com/gracias"
```

Bot sends:
```
"Aquí tienes tu link de pago seguro 🔒:
[Pagar $XX,XXX MXN](https://buy.stripe.com/XXXXX)

Es un pago 100% seguro con Stripe. Aceptamos:
💳 Tarjeta de crédito/débito
🏦 OXXO
📱 SPEI

Una vez que completes el pago, te pido tu dirección de envío aquí mismo."
```

## Step 3: Address Collection (Post-Payment)
After payment confirmation, collect shipping info sequentially:

```
Bot: "¡Pago recibido! ✅ Ahora necesito tu dirección de envío.
¿Cuál es el nombre completo de quien recibe?"

Customer: "María García López"

Bot: "Perfecto. ¿La dirección completa? (Calle, número, colonia)"

Customer: "Av. Reforma 123, Col. Centro"

Bot: "¿Ciudad y estado?"

Customer: "Ciudad de México, CDMX"

Bot: "¿Código postal?"

Customer: "06000"

Bot: "¿Un teléfono de contacto para el repartidor?"

Customer: "55 1234 5678"

Bot: "¿Alguna instrucción especial para la entrega? (edificio, piso, entre calles, etc.)"

Customer: "Edificio B, departamento 4A, pedir con el portero"
```

## Step 4: Order Confirmation
```
Bot: "¡Listo! Tu pedido está confirmado 📦

📋 Resumen:
- Producto: Andafacil Pro - Silla de Ruedas Eléctrica
- Precio: $XX,XXX MXN
- Pago: ✅ Completado

📍 Envío a:
María García López
Av. Reforma 123, Col. Centro
Ciudad de México, CDMX, 06000
Tel: 55 1234 5678
Nota: Edificio B, depto 4A, pedir con el portero

🚚 Tiempo estimado: 3-7 días hábiles
📞 Si tienes cualquier duda: WhatsApp +52 XXX XXX XXXX

¡Gracias por confiar en Andafacil! 🙌"
```

## Stripe Setup Requirements
- Stripe account with Mexican Peso (MXN) support
- Products created in Stripe Dashboard matching WooCommerce catalog
- Payment methods enabled: Cards, OXXO, SPEI
- Webhook for payment confirmation (optional for MVP — can check manually)

## For Hackathon Demo (No Stripe Key Yet)
- Generate mock payment links
- Show the full flow with simulated payment confirmation
- The architecture is ready — just plug in the API key
