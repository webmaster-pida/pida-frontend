// =========================================================
// 1. ZONA DE IMPORTACIONES
// =========================================================
import './style.css'; 

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/analytics';
import 'firebase/compat/remote-config';

import { jsPDF } from "jspdf";
import * as docx from "docx";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Hacer librerías accesibles globalmente
window.jspdf = { jsPDF };
window.docx = docx;
window.marked = marked;
window.DOMPurify = DOMPurify;
window.firebase = firebase;
// Inicialización de Stripe con llave de prueba (Cámbiala por la tuya de Stripe Dashboard)
const stripe = Stripe('pk_test_51RMB12GaDEQrzamxhgBfRodlN2Es6kmTYJIB5XUouHAoGNzj2Fcgcz116sIbY3UeeKRIMESrHkSy4zmb9RSwQ2Ql00mK5e53gD'); 
let cardElement;
let currentInterval = 'monthly';

// =========================================================
// 2. CONFIGURACIÓN
// =========================================================
const STRIPE_PRICES = {
    basico: {
        monthly: {
            USD: { id: 'price_1SqbBOGaDEQrzamxiuEbXIcc', amount: 999, text: '$9.99' },
            MXN: { id: 'price_1SqFSFGgaloBN5L8BMBeRPqb', amount: 19900, text: '$199 MXN' }
        },
        annual: {
            USD: { id: 'price_1SqFSFGgaloBN5L8kxegWZqC', amount: 9999, text: '$99.99' },
            MXN: { id: 'price_1SqFSyGgaloBN5L8rrwrtUau', amount: 199900, text: '$1,999 MXN' }
        }
    },
    avanzado: {
        monthly: {
            USD: { id: 'price_1SqbD8GaDEQrzamxuV9SQbFB', amount: 1999, text: '$19.99' },
            MXN: { id: 'price_1SqFWJGgaloBN5L8roECNay2', amount: 39900, text: '$399 MXN' }
        },
        annual: {
            USD: { id: 'price_1SqFWJGgaloBN5L8VKhkzLRH', amount: 19999, text: '$199.99' },
            MXN: { id: 'price_1SqFWJGgaloBN5L8hKpEvd1v', amount: 399900, text: '$3,999 MXN' }
        }
    },
    premium: {
        monthly: {
            USD: { id: 'price_1SqbDcGaDEQrzamxdcvIy0BG', amount: 2999, text: '$29.99' },
            MXN: { id: 'price_1SqFadGgaloBN5L8AwTUeTSd', amount: 59900, text: '$599 MXN' }
        },
        annual: {
            USD: { id: 'price_1SqFadGgaloBN5L86iwNYm1c', amount: 29999, text: '$299.99' },
            MXN: { id: 'price_1SqFadGgaloBN5L8QFHXe1i9', amount: 599900, text: '$5,999 MXN' }
        }
    }
};

let currentCurrency = 'USD';

const PIDA_CONFIG = {
    API_CHAT: "https://chat-v20-stripe-elements-465781488910.us-central1.run.app",
    API_ANA: "https://analize-v20-465781488910.us-central1.run.app",
    API_PRE: "https://precalifier-v20-465781488910.us-central1.run.app",
    FIREBASE: {
        apiKey: "AIzaSyC5nqsx4Fe4gMKkKdvnbMf8VFnI6TYL64k",
        authDomain: "pida-ai.com",
        projectId: "pida-ai-v20",
        storageBucket: "pida-ai-v20.firebasestorage.app",
        messagingSenderId: "465781488910",
        appId: "1:465781488910:web:6f9c2b4bc91317a6bbab5f",
        measurementId: "G-4FEDD254GY"
    }
};

// --- UTILIDAD DE EXPORTACIÓN UNIFICADA Y PROFESIONAL ---
const Exporter = {
    // Limpia el Markdown para impresión (quita **, ##, __)
    cleanText(text) {
        if (!text) return "";
        return text
            .replace(/\*\*/g, "")      // Negritas
            .replace(/__/g, "")        // Cursivas
            .replace(/^#+\s/gm, "")    // Títulos (## Título)
            .replace(/^\* /gm, "• ")   // Viñetas
            .replace(/\[/g, "(")       // Corchetes
            .replace(/\]/g, ")");
    },

    // Normaliza la entrada (sea Chat array o Analizador string) a un formato común
    normalizeContent(content) {
        if (Array.isArray(content)) {
            return content; // Ya es un chat
        } else {
            // Es el analizador (texto único), lo convertimos a estructura de chat simulado
            return [{ role: 'model', content: content }];
        }
    },

    async downloadPDF(fname, title, rawContent) { 
        const doc = new window.jspdf.jsPDF(); 
        const margin = 15;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const maxWidth = pageWidth - (margin * 2);
        let y = 20;

        // --- ENCABEZADO CORPORATIVO ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(29, 53, 87); // Azul PIDA (#1D3557)
        doc.text("PIDA", margin, y);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text("Plataforma de Investigación y Defensa Avanzada", margin + 25, y);

        y += 10;
        doc.setDrawColor(29, 53, 87);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y); // Línea azul

        y += 10;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(title || "Reporte Generado", margin, y);
        
        y += 6;
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`Fecha: ${new Date().toLocaleString()} | pida-ai.com`, margin, y);
        
        y += 15; // Espacio antes del contenido

        const messages = this.normalizeContent(rawContent);

        // --- CUERPO DEL DOCUMENTO ---
        messages.forEach(msg => {
            // Verificar fin de página para el Título del Rol
            if (y > pageHeight - 25) { doc.addPage(); y = 20; }

            const isPida = msg.role === 'model';
            const roleName = isPida ? "RESPUESTA PIDA" : "CONSULTA INVESTIGADOR";
            
            // Título de Sección
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            if (isPida) doc.setTextColor(29, 53, 87); // Azul
            else doc.setTextColor(80); // Gris
            
            doc.text(roleName, margin, y);
            y += 5;

            // Contenido
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(0); // Negro puro

            const cleanContent = this.cleanText(msg.content);
            const lines = doc.splitTextToSize(cleanContent, maxWidth);

            // Verificar si el bloque cabe, si no, imprimir línea a línea
            if (y + (lines.length * 5) > pageHeight - 15) {
                lines.forEach(line => {
                    if (y > pageHeight - 15) { doc.addPage(); y = 20; }
                    doc.text(line, margin, y);
                    y += 5; 
                });
            } else {
                doc.text(lines, margin, y);
                y += (lines.length * 5);
            }

            y += 10; // Separación entre bloques
        });

        doc.save(fname+".pdf"); 
    },

    async downloadDOCX(fname, title, rawContent) { 
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx; 
        
        const docChildren = [];
        const messages = this.normalizeContent(rawContent);

        // Título Principal
        docChildren.push(
            new Paragraph({
                text: title || "Documento PIDA",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 }
            })
        );

        messages.forEach(msg => {
            const isPida = msg.role === 'model';
            const roleName = isPida ? "PIDA" : "INVESTIGADOR";
            const roleColor = isPida ? "1D3557" : "666666"; 

            // Nombre del Rol
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: roleName,
                            bold: true,
                            color: roleColor,
                            size: 24 // 12pt
                        })
                    ],
                    spacing: { before: 200, after: 100 },
                    border: { bottom: { color: "CCCCCC", space: 1, value: "single", size: 6 } }
                })
            );

            // Contenido Limpio
            const cleanContent = this.cleanText(msg.content);
            const paragraphs = cleanContent.split('\n');
            
            paragraphs.forEach(pText => {
                if(pText.trim()) {
                    docChildren.push(
                        new Paragraph({
                            children: [ new TextRun({ text: pText.trim(), size: 22 }) ], // 11pt
                            spacing: { after: 120 }
                        })
                    );
                }
            });
        });

        const doc = new Document({ sections: [{ children: docChildren }] }); 

        Packer.toBlob(doc).then(b => {
            const u = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = u;
            a.download = fname + ".docx";
            a.click();
        }); 
    },

    downloadTXT(fname, title, rawContent) { 
        let t = (title || "Documento PIDA") + "\n";
        t += "====================================\n\n";
        
        const messages = this.normalizeContent(rawContent);
        
        messages.forEach(c => {
            const role = c.role === 'model' ? "PIDA" : "INVESTIGADOR";
            const cleanContent = this.cleanText(c.content);
            t += `[${role}]:\n${cleanContent}\n\n------------------------------------\n\n`;
        });

        const b = new Blob([t]); 
        const u = URL.createObjectURL(b); 
        const a = document.createElement('a');
        a.href = u;
        a.download = fname + ".txt";
        a.click(); 
    }
};

// --- CONFIRMACIÓN UI ---
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(29, 53, 87, 0.6)';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 16px; width: 90%; max-width: 320px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="font-size: 2rem; margin-bottom: 10px;">🗑️</div>
                <h3 style="color: #1D3557; margin: 0 0 10px 0; font-family: 'Inter', sans-serif;">Confirmar</h3>
                <p style="color: #666; font-size: 0.95rem; margin-bottom: 25px;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="btn-cancel" style="background: white; border: 1px solid #ccc; color: #666; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Cancelar</button>
                    <button id="btn-confirm" style="background: #EF4444; border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('btn-cancel').onclick = () => { document.body.removeChild(overlay); resolve(false); };
        document.getElementById('btn-confirm').onclick = () => { document.body.removeChild(overlay); resolve(true); };
    });
}


// =========================================================
// 3. LÓGICA DE LA APLICACIÓN
// =========================================================
let auth, db, googleProvider;
let currentUser = null;
let pendingPlan = null; 
let authMode = 'login';

// =========================================================
// Funciones Globales
// =========================================================
window.closeBanner = function() {
    const banner = document.getElementById('system-alert-banner');
    if(banner) banner.classList.add('hidden');
    
    // 1. Resetear el body (Landing page)
    document.body.style.marginTop = '0px';
    
    // 2. Resetear el navbar (.nav en tu CSS)
    const nav = document.querySelector('.nav');
    if (nav) nav.style.top = '0px';

    // 3. Resetear el Layout de la App (Logueado)
    // Usamos el ID que definiste en tu CSS con position: fixed
    const appLayout = document.getElementById('pida-app-layout');
    if (appLayout) {
        appLayout.style.top = '0px';
        appLayout.style.height = '100vh'; // Vuelve al alto total
    }
}

window.switchAuthMode = function(mode, showTabs = true) {
    authMode = mode;
    
    // 1. Referencias a la UI
    const tabContainer = document.querySelector('.login-tabs');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const passContainer = document.getElementById('password-field-container');
    const googleBtn = document.getElementById('google-login-btn');
    const divider = document.querySelector('.login-divider');
    const submitBtn = document.getElementById('auth-submit-btn');
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const disclaimer = document.getElementById('register-disclaimer'); 
    const forgotLink = document.getElementById('btn-forgot-password');
    const errMsg = document.getElementById('login-message');
    
    if(errMsg) errMsg.style.display = 'none';

    // 2. Control de pestañas superiores
    if (tabContainer) {
        tabContainer.style.display = showTabs ? 'flex' : 'none';
    }
    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle('active', mode === 'login');
        tabRegister.classList.toggle('active', mode === 'register');
    }

    if (mode === 'reset') {
        title.textContent = 'Recuperar Contraseña';
        desc.textContent = 'Ingresa tu correo para enviarte un enlace de restauración.';
        submitBtn.textContent = 'Enviar enlace de recuperación';
        if(passContainer) passContainer.style.display = 'none';
        if(googleBtn) googleBtn.style.display = 'none';
        if(divider) divider.style.display = 'none';
        if(disclaimer) disclaimer.style.display = 'none';
        if(forgotLink) forgotLink.parentElement.style.display = 'none';
        document.getElementById('login-password').required = false;
    } else {
        if(passContainer) passContainer.style.display = 'block';
        document.getElementById('login-password').required = true;

        if (mode === 'login') {
            title.textContent = 'Bienvenido de nuevo';
            desc.textContent = 'Accede para continuar tu investigación.';
            submitBtn.textContent = 'Ingresar';
            if(disclaimer) disclaimer.style.display = 'none';
            if(googleBtn) googleBtn.style.display = 'flex';
            if(divider) divider.style.display = 'block';
            if(forgotLink) forgotLink.parentElement.style.display = 'block';
        } else {
            title.textContent = 'Crear una cuenta';
            desc.textContent = 'Únete para acceder a PIDA.';
            submitBtn.textContent = 'Registrarme e iniciar prueba gratis';
            if(disclaimer) disclaimer.style.display = 'block';
            if(googleBtn) googleBtn.style.display = 'none';
            if(divider) divider.style.display = 'none';
            if(forgotLink) forgotLink.parentElement.style.display = 'none';
        }

        // --- LÓGICA DE STRIPE ELEMENTS (FIJA EL PROBLEMA DE DESAPARICIÓN) ---
        const authForm = document.getElementById('login-form');
        let cardContainer = document.getElementById('card-element-container');

        if (mode === 'register') {
            if (!cardContainer) {
                cardContainer = document.createElement('div');
                cardContainer.id = 'card-element-container';
                cardContainer.style.margin = "20px 0";
                // Inyectamos el checkbox de términos aquí mismo para asegurar que aparezca
                cardContainer.innerHTML = `
                    <label style="font-weight:600; font-size:0.9rem; color:#1D3557; margin-bottom:8px; display:block;">Datos de la tarjeta</label>
                    <div id="stripe-card-element" style="padding:12px; border:1px solid #ccc; border-radius:8px; background:white;"></div>
                    <div id="card-errors" style="color:#EF4444; font-size:0.8rem; margin-top:5px; display:none;"></div>
                    <div id="terms-container" style="display: flex; align-items: flex-start; gap: 10px; margin-top: 15px; text-align: left;">
                        <input type="checkbox" id="terms-checkbox" style="width: 18px; height: 18px; margin-top: 2px; cursor: pointer;">
                        <label for="terms-checkbox" style="font-size: 0.8rem; color: #4B5563; line-height: 1.4; cursor: pointer;">
                            Acepto los <a href="https://pida-ai.com/terminos" target="_blank" style="color: var(--pida-accent); text-decoration: underline;">términos de uso</a> y la <a href="https://pida-ai.com/privacidad" target="_blank" style="color: var(--pida-accent); text-decoration: underline;">política de privacidad</a>.
                        </label>
                    </div>
                `;
                authForm.insertBefore(cardContainer, document.getElementById('auth-submit-btn'));

                const elements = stripe.elements();
                cardElement = elements.create('card', { 
                    hidePostalCode: true, 
                    style: { base: { fontSize: '15px', fontFamily: '"Inter", sans-serif', color: '#1D3557' } } 
                });
                cardElement.mount('#stripe-card-element');
            }
            cardContainer.style.display = 'block';
        } else {
            if (cardContainer) cardContainer.style.display = 'none';
        }
    }

    // --- LÓGICA DE NAVEGACIÓN INFERIOR (ELIMINA EL TEXTO SOLICITADO) ---
    const footerNav = document.getElementById('auth-footer-nav');
    if (footerNav) {
        if (mode === 'login') {
            footerNav.innerHTML = `¿No tienes cuenta? <a href="#planes" onclick="document.getElementById('pida-login-screen').style.display='none';" style="color: var(--pida-accent); text-decoration: underline; cursor: pointer;">Ver planes de suscripción</a>`;
        } else if (mode === 'register') {
            footerNav.innerHTML = `¿Ya tienes cuenta? <a href="#" onclick="window.switchAuthMode('login', false); return false;" style="color: var(--pida-accent); text-decoration: underline; cursor: pointer;">Inicia sesión aquí</a>`;
        } else {
            // Aquí se elimina la leyenda "Volver al inicio de sesión" para el modo reset u otros
            footerNav.innerHTML = ''; 
        }
    }
}

// Configuración Markdown
marked.use({ gfm: true, breaks: true });
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if ('target' in node) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});

// --- UTILIDAD DE ACTUALIZACIÓN DE PRECIOS ---
function updatePricingUI(currency) {
    currentCurrency = currency;
    localStorage.setItem('pida_currency', currency);

    const plans = ['basico', 'avanzado', 'premium'];
    const periodText = currentInterval === 'monthly' ? '/ mes' : '/ año';

    plans.forEach(plan => {
        const priceEl = document.getElementById(`price-${plan}`);
        if (priceEl && STRIPE_PRICES[plan][currentInterval][currency]) {
            // Actualizar el monto (ej: $199.99 MXN)
            priceEl.textContent = STRIPE_PRICES[plan][currentInterval][currency].text;
            
            // Actualizar el sufijo (/ mes o / año)
            if (priceEl.nextElementSibling) {
                priceEl.nextElementSibling.textContent = periodText;
            }
        }
    });

    console.log(`✅ UI de precios actualizada: ${currency} | ${currentInterval}`);
}

// Función crucial para cumplimiento legal en México
async function detectLocation() {
    // 1. Prioridad 1: Detección por IP (API)
    try {
        // Usamos un timeout para que la web no espere eternamente a la API si falla
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        const data = await response.json();
        clearTimeout(timeoutId);

        if (data.country_code === 'MX') {
            updatePricingUI('MXN');
            return; // Detección exitosa, salimos.
        } else if (data.country_code) {
            updatePricingUI('USD');
            return;
        }
    } catch (e) {
        console.warn("API de IP falló o fue bloqueada por VPN/Adblock.");
    }

    // 2. Prioridad 2: Fallback por Zona Horaria (Si la API falló, esto detecta México el 99% de las veces)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isMexico = /Mexico|Merida|Monterrey|Chihuahua|Hermosillo|Tijuana|Cancun|Mazatlan|Bahia_Banderas/i.test(tz);
    
    if (isMexico) {
        updatePricingUI('MXN');
        return;
    }

    // 3. Prioridad 3: Si todo lo anterior falla, usamos el caché o por defecto USD
    const cached = localStorage.getItem('pida_currency');
    updatePricingUI(cached || 'USD');
}

document.addEventListener('DOMContentLoaded', function () {

    // --- LÓGICA UNIFICADA DEL INTERRUPTOR MENSUAL/ANUAL ---
    const intervalToggle = document.getElementById('billing-interval-toggle');
    if (intervalToggle) {
        intervalToggle.addEventListener('change', (e) => {
            // 1. Actualizar estado global
            currentInterval = e.target.checked ? 'annual' : 'monthly';
            
            // 2. Referencias a etiquetas y al badge de ahorro
            const labelM = document.getElementById('label-monthly');
            const labelA = document.getElementById('label-annual');
            const discountBadge = document.querySelector('.discount-badge');

            // 3. Lógica visual: Mostrar/Ocultar y cambiar colores
            if (currentInterval === 'annual') {
                labelM.style.color = '#94a3b8'; // Gris
                labelA.style.color = 'var(--pida-primary)'; // Azul
                if (discountBadge) discountBadge.style.display = 'inline-block'; // APARECE
            } else {
                labelM.style.color = 'var(--pida-primary)'; // Azul
                labelA.style.color = '#94a3b8'; // Gris
                if (discountBadge) discountBadge.style.display = 'none'; // DESAPARECE
            }

            // 4. Persistir y actualizar precios
            sessionStorage.setItem('pida_pending_interval', currentInterval);
            updatePricingUI(currentCurrency);
        });
    }

    // ==========================================
    // LOGICA SELECTOR DE BANDERAS (CORREGIDO CON IMÁGENES)
    // ==========================================
    
    const allCountryWrappers = document.querySelectorAll('.custom-select-wrapper');

    // 1. Datos actualizados con código ISO para las imágenes
    const countriesData = [
        { code: '+54', iso: 'ar', name: 'Argentina' },
        { code: '+591', iso: 'bo', name: 'Bolivia' },
        { code: '+56', iso: 'cl', name: 'Chile' },
        { code: '+57', iso: 'co', name: 'Colombia' },
        { code: '+506', iso: 'cr', name: 'Costa Rica' },
        { code: '+53', iso: 'cu', name: 'Cuba' },
        { code: '+593', iso: 'ec', name: 'Ecuador' },
        { code: '+503', iso: 'sv', name: 'El Salvador' },
        { code: '+502', iso: 'gt', name: 'Guatemala' },
        { code: '+504', iso: 'hn', name: 'Honduras' },
        { code: '+52', iso: 'mx', name: 'México' },
        { code: '+505', iso: 'ni', name: 'Nicaragua' },
        { code: '+507', iso: 'pa', name: 'Panamá' },
        { code: '+595', iso: 'py', name: 'Paraguay' },
        { code: '+51', iso: 'pe', name: 'Perú' },
        { code: '+1', iso: 'do', name: 'Rep. Dom.' },
        { code: '+598', iso: 'uy', name: 'Uruguay' },
        { code: '+58', iso: 've', name: 'Venezuela' },
    ];

    allCountryWrappers.forEach(wrapper => {
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const optionsContainer = wrapper.querySelector('.custom-options');
        const hiddenInput = wrapper.querySelector('input[type="hidden"]'); 
        // Seleccionamos específicamente el span que tiene el texto "Código"
        const displayText = trigger.querySelector('#selected-flag-text'); 

        if (trigger && optionsContainer) {
            // Limpiamos opciones previas por si acaso
            optionsContainer.innerHTML = '';

            countriesData.forEach(country => {
                const div = document.createElement('div');
                div.className = 'custom-option';
                // USAMOS IMAGEN EN LUGAR DE EMOJI
                div.innerHTML = `
                    <img src="https://flagcdn.com/w40/${country.iso}.png" class="flag-img" alt="${country.name}">
                    <strong>${country.code}</strong> 
                    <span style="font-size:0.85em; color:#666; margin-left:5px;">${country.name}</span>
                `;
                
                div.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    
                    // Actualizar el visual del trigger (Bandera + Código)
                    if(displayText) {
                        displayText.innerHTML = `
                            <img src="https://flagcdn.com/w40/${country.iso}.png" class="flag-img-sm"> 
                            ${country.code}
                        `;
                        displayText.style.color = '#333';
                        displayText.style.display = 'flex';
                        displayText.style.alignItems = 'center';
                        displayText.style.gap = '8px';
                    }
                    
                    // Actualizar input oculto
                    if(hiddenInput) hiddenInput.value = country.code;
                    
                    wrapper.classList.remove('open');
                });
                
                optionsContainer.appendChild(div);
            });

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-wrapper').forEach(w => {
                    if (w !== wrapper) w.classList.remove('open');
                });
                wrapper.classList.toggle('open');
            });
        }
    });

    // 3. Cerrar al hacer clic fuera (Global)
    window.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
            w.classList.remove('open');
        });
    });

    const landingRoot = document.getElementById('landing-page-root');
    const loginScreen = document.getElementById('pida-login-screen');
    const appRoot = document.getElementById('pida-app-root');
    const forgotBtn = document.getElementById('btn-forgot-password');
    if(forgotBtn) {
        forgotBtn.onclick = (e) => {
            e.preventDefault();
            window.switchAuthMode('reset', false);
        };
    }

    // ==========================================
    // INICIALIZACIÓN DE FIREBASE (MOVIDO AL INICIO)
    // ==========================================
    try {
        if (!firebase.apps.length) firebase.initializeApp(PIDA_CONFIG.FIREBASE);
        firebase.analytics();
        auth = firebase.auth();
        db = firebase.firestore();
        const remoteConfig = firebase.remoteConfig();
        remoteConfig.defaultConfig = { 'maintenance_mode_enabled': 'false' };

        // 1. Activar Mantenimiento Real
        remoteConfig.fetchAndActivate().then(() => {
            const isMaintenance = remoteConfig.getBoolean('maintenance_mode_enabled');
            const maintenanceDiv = document.getElementById('maintenance-message');
            if (isMaintenance && maintenanceDiv) maintenanceDiv.style.display = 'block';
        });

        // 2. Ejecutar detección de ubicación (Cumplimiento legal MXN)
        detectLocation();
        
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });
    } catch (firebaseError) { 
        console.error("Firebase Initialization Error:", firebaseError); 
    }

    // =========================================================
    // 1. CONTROL DE VERSIÓN (INTELIGENTE)
    // =========================================================
    const APP_VERSION = "2.1.BUILD_PLACEHOLDER"; 

    function checkUpdateBeforeStart() {
        // Ignorar si estamos en desarrollo/local (evita bucles molestos)
        if (APP_VERSION.includes('PLACEHOLDER') || APP_VERSION.includes('dev')) return false;

        const pending = localStorage.getItem('pida_pending_update');
        if (pending && pending !== APP_VERSION) {
            localStorage.removeItem('pida_pending_update');
            window.location.reload(true);
            return true; 
        }
        return false;
    }

    // Escuchador en segundo plano para notificar nueva versión
    db.collection('config').doc('version').onSnapshot((docSnap) => {
        // Ignorar si estamos en desarrollo/local (evita Toast fantasma)
        if (APP_VERSION.includes('PLACEHOLDER') || APP_VERSION.includes('dev')) return;

        if (docSnap.exists) {
            const remoteVersion = docSnap.data().latest;
            if (remoteVersion && remoteVersion !== APP_VERSION) {
                localStorage.setItem('pida_pending_update', remoteVersion);
                
                // Solo mostrar si el usuario está logueado actualmente
                if (firebase.auth().currentUser) {
                    const toast = document.getElementById('update-toast');
                    if (toast) toast.classList.remove('hidden');
                }
            }
        }
    });

    // --- UTILIDADES INTERNAS ---
    const Utils = {
        sanitize(html) { return DOMPurify.sanitize(html); },

        // NUEVA FUNCIÓN: Prepara el texto para que las tablas se rendericen bien
        prepareMarkdown(text) {
            if (!text) return "";
            
            // 1. Detección y corrección de tablas pegadas al texto
            // Si encuentra texto seguido inmediatamente de una barra vertical "|", fuerza doble enter.
            let fixedText = text.replace(/([^\n])\s*(\|.*\|)/g, '$1\n\n$2');

            // 2. Formato de "Fuente:" (lo centralizamos aquí para usarlo en todos lados)
            fixedText = fixedText.replace(/(?:[\n\r\s]*)(?:\*\*|__)?(Fuente:)(?:\*\*|__)?/g, '\n\n<hr>\n\n<strong>$1</strong>');

            return fixedText;
        },

        async getHeaders(user) { 
            try { 
                const t = await user.getIdToken(); 
                return { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }; 
            } catch { return null; } 
        }
    };

    // ==========================================
    // LÓGICA DEL CARRUSEL DE TESTIMONIOS (AUTO-PLAY)
    // ==========================================
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.dot-btn');
    
    if (track && dots.length > 0) {
        let currentIndex = 0;
        let slideInterval;

        // Función para mover el carrusel a una posición específica
        const goToSlide = (index) => {
            currentIndex = index;
            // Mover el track
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            
            // Actualizar puntos
            dots.forEach(d => d.classList.remove('active'));
            if(dots[currentIndex]) dots[currentIndex].classList.add('active');
        };

        // Función para avanzar automáticamente
        const startAutoSlide = () => {
            // Limpiar intervalo previo si existe para evitar duplicados
            if (slideInterval) clearInterval(slideInterval);
            
            slideInterval = setInterval(() => {
                let nextIndex = currentIndex + 1;
                if (nextIndex >= dots.length) {
                    nextIndex = 0; // Volver al inicio
                }
                goToSlide(nextIndex);
            }, 7000); // Cambia cada 7000ms (7 segundos)
        };

        // Configurar los botones manuales
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
                startAutoSlide(); // Reiniciar el temporizador al hacer click manual
            });
        });

        // Iniciar el movimiento automático al cargar
        startAutoSlide();
    }

    // --- INTERACTIVIDAD BÁSICA ---
    const legalBtn = document.getElementById('open-legal-btn');
    const legalModal = document.getElementById('pida-legal-modal');
    if(legalBtn && legalModal) legalBtn.addEventListener('click', (e) => { e.preventDefault(); legalModal.classList.remove('hidden'); });

    // --- STRIPE RETURN ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    if (paymentStatus) {
        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        if(banner && bannerText){
            banner.classList.remove('hidden');
            if (paymentStatus === 'success') {
                banner.style.backgroundColor = '#10B981'; 
                bannerText.innerHTML = "¡Suscripción activada! Bienvenido a PIDA.";
            } else {
                banner.style.backgroundColor = '#EF4444'; 
                bannerText.innerText = "Hubo un problema con el pago.";
            }
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => window.closeBanner(), 8000);
        }
    }

    // ==========================================
    // ALERTAS DEL SISTEMA (YA CON FIREBASE INICIALIZADO)
    // ==========================================
    // --- ESCUCHADOR DE ALERTA GLOBAL DESDE FIRESTORE (NUEVO E INTEGRADO) ---
    db.collection('config').doc('alerts').onSnapshot((docSnap) => {
        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        const nav = document.querySelector('.nav'); // Clase .nav según tu CSS
        const appLayout = document.getElementById('pida-app-layout'); // ID con fixed según tu CSS

        if (docSnap.exists && banner && bannerText) {
            const alertData = docSnap.data();
            
            // Evitamos sobreescribir si Stripe está mostrando un mensaje
            if (!new URLSearchParams(window.location.search).get('payment_status')) {
                if (alertData.active === true && alertData.message) {
                    bannerText.innerHTML = alertData.message;
                    banner.classList.remove('hidden');
                    
                    // Calculamos la altura real de la cinta
                    const h = banner.offsetHeight || 50; 
                    
                    // A. Para la Landing Page (Contenido normal)
                    document.body.style.marginTop = h + 'px';
                    
                    // B. Para el Navbar de la Landing (.nav es fixed top: 0)
                    if (nav) nav.style.top = h + 'px';
                    
                    // C. PARA LA APP LOGUEADA (#pida-app-layout es fixed top: 0)
                    if (appLayout) {
                        // Empujamos el contenedor hacia abajo
                        appLayout.style.top = h + 'px';
                        // Restamos la altura para que el chat no se corte por abajo
                        appLayout.style.height = `calc(100vh - ${h}px)`;
                    }
                } else {
                    window.closeBanner();
                }
            }
        }
    });


    // --- FORMULARIO DE CONTACTO (ENVÍO CON VERIFICACIÓN DE EMAIL) ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const email = document.getElementById('contact-email').value;
            const confirmEmail = document.getElementById('contact-email-confirm').value;
            const btn = document.getElementById('contact-submit-btn');
            const status = document.getElementById('contact-status');
            const originalText = btn.textContent;

            // VERIFICACIÓN: ¿Coinciden los correos?
            if (email !== confirmEmail) {
                status.textContent = '❌ Los correos electrónicos no coinciden.';
                status.style.display = 'block';
                status.style.color = '#EF4444';
                document.getElementById('contact-email-confirm').focus();
                return;
            }
            
            const leadData = {
                name: document.getElementById('contact-name').value,
                company: document.getElementById('contact-company').value,
                email: email,
                phone: (document.getElementById('contact-country-code').value || '') + ' ' + document.getElementById('contact-phone').value,
                message: document.getElementById('contact-message').value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), //
                status: 'nuevo'
            };

            btn.textContent = 'Guardando...'; btn.disabled = true;
            status.style.display = 'none';

            try {
                await db.collection('leads_corporativos').add(leadData); //
                btn.textContent = '¡Enviado!';
                status.textContent = 'Datos recibidos. Te contactaremos pronto.';
                status.style.display = 'block'; status.style.color = '#10B981';
                setTimeout(() => {
                    const modal = document.getElementById('contact-modal');
                    if (modal) modal.classList.add('hidden');
                    contactForm.reset();
                    btn.textContent = originalText; btn.disabled = false; status.style.display = 'none';
                }, 3000);
            } catch (error) {
                btn.textContent = originalText; btn.disabled = false;
                status.textContent = 'Error de conexión.'; status.style.display = 'block'; status.style.color = '#EF4444';
            }
        });
    }

    // --- BOTONES MODAL CONTACTO (APERTURA/CIERRE) ---
    const btnCorp = document.getElementById('btn-corp-contact');
    const contactModal = document.getElementById('contact-modal');
    const btnCloseContact = document.getElementById('close-contact-btn');
    if(btnCorp && contactModal) {
        btnCorp.onclick = (e) => { e.preventDefault(); contactModal.classList.remove('hidden'); };
    }
    if(btnCloseContact && contactModal) {
        btnCloseContact.onclick = () => contactModal.classList.add('hidden');
    }

    // AUTH STATE
    const globalLoader = document.getElementById('pida-global-loader');
    const hideLoader = () => {
        if(globalLoader) {
            globalLoader.classList.add('fade-out');
            setTimeout(() => globalLoader.style.display = 'none', 600); 
        }
    };

    // ==========================================
    // OBSERVADOR DE ESTADO (CAMBIO DE PANTALLAS)
    // ==========================================
        auth.onAuthStateChanged((user) => {
        if (checkUpdateBeforeStart()) return; 

        if (user) {
            // Ocultamos landing y login, pero NO mostramos la App todavía
            if(landingRoot) landingRoot.style.display = 'none'; 
            if(loginScreen) loginScreen.style.display = 'none'; 
            runApp(user); // runApp decidirá si va a Stripe o muestra la App
        } else {
            hideLoader(); 
            if(appRoot) appRoot.style.display = 'none';
            if(landingRoot) landingRoot.style.display = 'block';
            window.closeBanner();
        }
    });

    async function checkAccessAuthorization(user) {
        const headers = await Utils.getHeaders(user);
        if (!headers) return false;
        try {
            const subRef = db.collection('customers').doc(user.uid).collection('subscriptions');
            const snap = await subRef.where('status', 'in', ['active', 'trialing']).get();
            if (!snap.empty) return true;
        } catch (e) { }

        try {
            const res = await fetch(`${PIDA_CONFIG.API_CHAT}/check-vip-access`, { method: 'POST', headers: headers });
            if (res.ok) { const r = await res.json(); if (r.is_vip_user) return true; }
        } catch (e) { }
        return false;
    }

    // LOGIN & CHECKOUT
    // --- BOTÓN HERO: SOLO ENTRAR (OCULTA OPCIÓN DE REGISTRO) ---
    document.querySelectorAll('.trigger-login').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginScreen) { 
                loginScreen.style.display = 'flex'; 
                // Llamamos con false para ocultar las pestañas
                window.switchAuthMode('login', false); 
            }
        });
    });

    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const btn = document.getElementById('auth-submit-btn');
            const errMsg = document.getElementById('login-message');
            
            btn.disabled = true; btn.textContent = "Procesando...";
            if(errMsg) errMsg.style.display = 'none';

            try {
                if (authMode === 'reset') {
                    // Lógica de recuperación (basada en la que ya tienes funcionando en la app)
                    await auth.sendPasswordResetEmail(email);
                    errMsg.innerHTML = "✅ Enlace enviado. Revisa tu correo (incluyendo spam).";
                    errMsg.style.display = 'block';
                    errMsg.style.color = '#10B981';
                    btn.textContent = "Correo Enviado";
                    return; 
                }
                
                if (authMode === 'login') {
                    await auth.signInWithEmailAndPassword(email, pass);
                } else if (authMode === 'register') {
                    // 1. Validar Checkbox de Términos
                    const termsCheckbox = document.getElementById('terms-checkbox');
                    if (termsCheckbox && !termsCheckbox.checked) {
                        btn.disabled = false;
                        btn.textContent = 'Registrarme e iniciar prueba gratis';
                        const errMsg = document.getElementById('login-message');
                        if (errMsg) {
                            errMsg.textContent = "❌ Debes aceptar los términos y condiciones para continuar.";
                            errMsg.style.display = 'block';
                            errMsg.style.color = '#EF4444';
                        }
                        return; 
                    }

                    btn.disabled = true;
                    btn.textContent = "Creando cuenta...";

                    // 2. Crear el usuario en Firebase
                    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                    const user = userCredential.user;

                    btn.textContent = "Iniciando tu prueba de 5 días...";

                    // 3. Obtener monto según plan e intervalo seleccionados
                    const planKey = sessionStorage.getItem('pida_pending_plan') || 'basico';
                    const intervalKey = sessionStorage.getItem('pida_pending_interval') || 'monthly';
                    const planData = STRIPE_PRICES[planKey][intervalKey][currentCurrency];

                    if (!planData || !planData.amount) {
                        throw new Error("No se pudo identificar el plan. Selecciona uno nuevamente.");
                    }

                    // 4. Llamar al Backend del Chat para el Client Secret
                    const headers = await Utils.getHeaders(user);
                    const intentRes = await fetch(`${PIDA_CONFIG.API_CHAT}/create-payment-intent`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ 
                            priceId: planData.id, 
                            currency: currentCurrency.toLowerCase(),
                            plan_key: planKey,
                            trial_period_days: 5
                        })
                    });

                    // --- ESTA ES LA PROTECCIÓN QUE EVITA LA PANTALLA EN BLANCO ---
                    if (!intentRes.ok) {
                        const errorData = await intentRes.json();
                        throw new Error(errorData.detail || "Error en el servidor de pagos (400)");
                    }

                    const data = await intentRes.json();
                    const clientSecret = data.clientSecret;
                    // ------------------------------------------------------------

                    // 5. Confirmar el pago en el navegador
                    const result = await stripe.confirmCardPayment(clientSecret, {
                        payment_method: { card: cardElement }
                    });

                    if (result.error) {
                        throw new Error(result.error.message);
                    } else if (result.paymentIntent.status === 'succeeded') {
                        // --- CAMBIO: ESPERA ACTIVA (POLLING) ---
                        btn.textContent = "Pago exitoso. Activando...";
                        
                        const checkSub = async () => {
                            let attempts = 0;
                            // Intentamos durante 20 segundos (10 intentos de 2s)
                            while (attempts < 10) { 
                                console.log(`Esperando activación... intento ${attempts + 1}`);
                                const subCheck = await db.collection('customers').doc(user.uid).get();
                                // Verificamos si el campo 'status' ya es 'active'
                                if (subCheck.exists && subCheck.data().status === 'active') {
                                    return true;
                                }
                                await new Promise(r => setTimeout(r, 2000));
                                attempts++;
                            }
                            return false;
                        };

                        const isActivated = await checkSub();
                        
                        if (isActivated) {
                            window.location.reload(); 
                        } else {
                            // Fallback de seguridad
                            alert("Pago recibido. Estamos activando tu cuenta, esto puede tardar unos segundos más. Si no accedes en 1 minuto, recarga la página.");
                            window.location.reload();
                        }
                    }

                }

            } catch (error) {
                btn.disabled = false;
                let friendlyMessage = "Ocurrió un error. Intenta de nuevo.";
                
                // UNIFICACIÓN DE GUÍA UX (Diferenciando errores de Firebase)
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
                    friendlyMessage = `Los datos son incorrectos. <br><br> <b>¿Eres nuevo?</b> <a href="#" onclick="switchAuthMode('register'); return false;" style="color:#0056B3; text-decoration:underline;">Regístrate aquí.</a> <br> <b>¿Olvidaste tu clave?</b> <a href="#" onclick="switchAuthMode('reset'); return false;" style="color:#0056B3; text-decoration:underline;">Recupérala aquí.</a>`;
                } else if (error.code === 'auth/email-already-in-use') {
                    friendlyMessage = `Ya tienes una cuenta. <br><br> <a href="#" onclick="switchAuthMode('login'); return false;" style="color:#0056B3; text-decoration:underline;">Haz clic aquí para ingresar</a> e iniciar tus 5 días de prueba gratis.`;
                } else if (error.code === 'auth/wrong-password') {
                    friendlyMessage = `La contraseña es incorrecta. <br><br> <a href="#" onclick="switchAuthMode('reset'); return false;" style="color:#0056B3; text-decoration:underline;">¿Olvidaste tu contraseña? Haz clic aquí.</a>`;
                }

                if (errMsg) {
                    errMsg.innerHTML = friendlyMessage;
                    errMsg.style.display = 'block';
                    errMsg.style.color = '#EF4444';
                }
                btn.textContent = (authMode === 'login') ? 'Ingresar' : 'Registrarme e iniciar prueba gratis';
            }
        });
    }

    // ==========================================
    // LOGIN CON GOOGLE (VERSIÓN FINAL)
    // ==========================================
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const errMsg = document.getElementById('login-message');
            const forgotLink = document.getElementById('btn-forgot-password');
            const btnText = document.getElementById('google-text');
            const loginScreen = document.getElementById('pida-login-screen');
            
            // 1. Limpiar UI
            if (errMsg) errMsg.style.display = 'none';
            const originalText = btnText ? btnText.textContent : "Entrar con Google";
            if (btnText) btnText.textContent = "Conectando...";
            googleBtn.disabled = true;

            try {
                // 2. Intentar Login
                await auth.signInWithPopup(googleProvider);
                
                // 3. ÉXITO: Forzar cierre inmediato del modal
                if (loginScreen) loginScreen.style.display = 'none';
                
                // Restaurar botón (por si acaso se vuelve a usar)
                if (btnText) btnText.textContent = originalText;
                googleBtn.disabled = false;

                // El onAuthStateChanged se encargará de cargar los chats, 
                // pero ya quitamos el bloqueo visual.
                
            } catch (error) {
                console.error("Error Google Auth:", error);
                
                // Restaurar botón
                if (btnText) btnText.textContent = originalText;
                googleBtn.disabled = false;

                let friendlyMessage = "No se pudo iniciar sesión con Google.";

                // Manejo de errores comunes
                if (error.code === 'auth/popup-closed-by-user') {
                    friendlyMessage = "Se cerró la ventana antes de terminar.";
                } else if (error.code === 'auth/popup-blocked') {
                    friendlyMessage = "El navegador bloqueó la ventana emergente.";
                } else if (error.code === 'auth/cancelled-popup-request') {
                    friendlyMessage = "Intento cancelado. Prueba de nuevo.";
                }

                if (errMsg) {
                    errMsg.textContent = friendlyMessage;
                    errMsg.style.display = 'block';
                }
            }
        });
    }

    async function startCheckout(priceId) {
        if (!currentUser) {
            if(loginScreen) loginScreen.style.display = 'flex';
            window.switchAuthMode('register'); 
            return;
        }
        try {
            const baseUrl = window.location.origin + window.location.pathname;
            const docRef = await db.collection('customers').doc(currentUser.uid).collection('checkout_sessions').add({
                price: priceId,
                trial_period_days: 5,
                success_url: `${baseUrl}?payment_status=success`,
                cancel_url: `${baseUrl}?payment_status=canceled`,
                allow_promotion_codes: true,
                metadata: { source: 'web_app_v7' }
            });
            docRef.onSnapshot((snap) => {
                const { error, url } = snap.data();
                if (error) alert(`Error: ${error.message}`);
                if (url) window.location.assign(url);
            });
        } catch (error) { console.error("Checkout Error:", error); }
    }

    // --- NUEVO LISTENER DE BOTONES DE PLANES (STRIPE ELEMENTS) ---
    document.querySelectorAll('.plan-cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // OCULTAR EL MODAL DE BLOQUEO SI EXISTE
            const overlay = document.getElementById('pida-subscription-overlay');
            if (overlay) overlay.classList.add('hidden');

            const planKey = btn.getAttribute('data-plan');
            sessionStorage.setItem('pida_pending_plan', planKey);
            sessionStorage.setItem('pida_pending_interval', currentInterval);

            if (loginScreen) {
                loginScreen.style.display = 'flex';
                window.switchAuthMode('register', false); 
            }
        });
    });

    // =========================================================
    // 4. LÓGICA DE ACCESO Y ARRANQUE DE LA APP (CORREGIDO)
    // =========================================================

    async function checkAccessAuthorization(user) {
        // 1. Obtener headers seguros
        const headers = await Utils.getHeaders(user);
        if (!headers) return false;

        // 2. Opción A: Verificar suscripción en Firestore (Rápido)
        try {
            // A1. Verificar documento PADRE (Donde escribe tu Webhook) <--- ESTO FALTABA
            const userDoc = await db.collection('customers').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().status === 'active') {
                console.log("Acceso autorizado por documento directo.");
                return true;
            }

            // A2. Verificar Subcolección (Stripe Extension estándar)
            const subRef = db.collection('customers').doc(user.uid).collection('subscriptions');
            const snap = await subRef.where('status', 'in', ['active', 'trialing']).limit(1).get();
            if (!snap.empty) return true;
        } catch (e) {
            console.warn("Error verificando suscripción en caché:", e);
        }

        // 3. Opción B: Verificar VIP/Admin vía Backend
        try {
            const res = await fetch(`${PIDA_CONFIG.API_CHAT}/check-vip-access`, { 
                method: 'POST', 
                headers: headers 
            });
            
            if (res.ok) { 
                const r = await res.json(); 
                if (r.is_vip_user === true) return true; 
            }
        } catch (e) { 
            console.error("Error contactando endpoint VIP:", e);
        }

        return false;
    }

    async function runApp(user) {
        console.log("🚀 Iniciando aplicación PIDA para:", user.email);
        currentUser = user;

        // --- SOLUCIÓN PARA EL BOTÓN DE SALIDA EN EL OVERLAY ---
        const btnLogoutOverlay = document.getElementById('logout-from-overlay');
        if (btnLogoutOverlay) {
            btnLogoutOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                auth.signOut().then(() => {
                    window.location.href = window.location.origin + window.location.pathname;
                });
            });
        }

        try {
            // 1. Verificar Permisos
            const hasAccess = await checkAccessAuthorization(user);
            const overlay = document.getElementById('pida-subscription-overlay');

            // 2. Lógica de Enrutamiento Visual
            if (!hasAccess) {
                // CASO A: NO AUTORIZADO (Mostrar Overlay de Pago)
                if (appRoot) appRoot.style.display = 'block'; // Mostramos la app al fondo
                if (overlay) overlay.classList.remove('hidden'); // Ponemos el bloqueo encima
                if (landingRoot) landingRoot.style.display = 'none';
                
                // CRÍTICO: Quitar el loader para que se vea el Overlay de pago
                hideLoader(); 
                return; // Detenemos la carga de chats para ahorrar recursos
            } else {
                // CASO B: AUTORIZADO (VIP o Suscriptor)
                if (overlay) overlay.classList.add('hidden');
                if (appRoot) appRoot.style.display = 'block';
                if (landingRoot) landingRoot.style.display = 'none';
                sessionStorage.removeItem('pida_pending_plan');
                
                // --- CORRECCIÓN CRÍTICA: ELIMINAR EL LOADER EN ÉXITO ---
                hideLoader(); 
                // -------------------------------------------------------
            }

            // 3. Referencias del DOM (Solo se cargan si hay acceso)
            const dom = {
                navInv: document.getElementById('nav-investigador'),
                navAna: document.getElementById('nav-analizador'),
                navPre: document.getElementById('nav-precalificador'),
                viewInv: document.getElementById('view-investigador'),
                viewAna: document.getElementById('view-analizador'),
                viewPre: document.getElementById('view-precalificador'),
                viewAcc: document.getElementById('view-account'),
                chatBox: document.getElementById('pida-chat-box'),
                input: document.getElementById('pida-input'),
                sendBtn: document.getElementById('pida-send-btn'),
                pName: document.getElementById('pida-profile-name'),
                pEmail: document.getElementById('pida-profile-email'),
                pAvatar: document.getElementById('pida-profile-avatar'),
                pLogout: document.getElementById('pida-profile-logout'),
                anaInput: document.getElementById('analyzer-file-upload'),
                anaFiles: document.getElementById('active-files-area'),
                anaBtn: document.getElementById('analyze-btn'),
                anaResBox: document.getElementById('analyzer-results-section'),
                anaLoader: document.getElementById('analyzer-loader-container'),
                anaResTxt: document.getElementById('analyzer-analysis-result'),
                anaControls: document.getElementById('analyzer-download-controls'),
                anaInst: document.getElementById('user-instructions'),
                analyzerClearBtn: document.getElementById('analyzer-clear-btn'),
                preNewBtn: document.getElementById('pre-new-btn'),
                preHistBtn: document.getElementById('pre-history-dropdown-btn'),
                preHistContent: document.getElementById('pre-history-dropdown-content'),
                preHistList: document.getElementById('pre-history-list'),
                preCountry: document.getElementById('pre-input-country'),
                preTitle: document.getElementById('pre-input-title'),
                preFacts: document.getElementById('pre-input-facts'),
                preBtn: document.getElementById('pre-analyze-btn'),
                preClear: document.getElementById('pre-clear-btn'),
                preResultsBox: document.getElementById('pre-results-section'),
                preLoader: document.getElementById('pre-loader-container'),
                preStatus: document.getElementById('pre-status-text'),
                preResponseCont: document.getElementById('pre-response-container'),
                preResultTxt: document.getElementById('pre-analysis-result'),
                preWelcome: document.getElementById('pre-welcome'),
                preControls: document.getElementById('pre-download-controls'),
                accUpdate: document.getElementById('acc-update-btn'),
                accBilling: document.getElementById('acc-billing-btn'),
                accReset: document.getElementById('acc-reset-btn'),
                mobileMenuBtn: document.getElementById('nav-mobile-menu-btn'),
                mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
                mobileMenuProfile: document.getElementById('mobile-nav-profile'),
                mobileMenuLogout: document.getElementById('mobile-nav-logout')
            };

            // --- NUEVO: FUNCIÓN PARA MOSTRAR EL PLAN ---
            async function loadUserPlanBadge() {
                const badge = document.getElementById('user-plan-badge');
                if(!badge) return;

                try {
                    const userDoc = await db.collection('customers').doc(user.uid).get();
                    
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        
                        if (data.status === 'active') {
                            // 1. Identificamos el plan
                            const planKey = data.plan; // 'basico', 'avanzado', 'premium'
                            let displayPlan = "Suscripción"; // Texto por defecto si no hay dato
                            
                            if (planKey) {
                                // Formateo: basico -> Básico
                                displayPlan = planKey.charAt(0).toUpperCase() + planKey.slice(1);
                                if(displayPlan === 'Basico') displayPlan = 'Básico';
                            }

                            // 2. Si es prueba, lo agregamos como SUFIJO, no reemplazo
                            // Así queda: "Plan Básico (Prueba)"
                            if (data.has_trial) {
                                displayPlan += " <span style='font-size:0.85em; opacity:0.8;'>(Prueba)</span>";
                            }

                            badge.innerHTML = `Plan <strong>${displayPlan}</strong>`;
                            badge.classList.remove('hidden');
                        } else {
                            badge.classList.add('hidden');
                        }
                    }
                } catch (e) {
                    console.error("Error cargando badge:", e);
                    badge.classList.add('hidden');
                }
            }

            // EJECUTAR LA CARGA DEL BADGE
            loadUserPlanBadge();

            // Estado Global
            let state = { currentView: 'investigador', conversations: [], currentChat: { id: null, title: '', messages: [] }, anaFiles: [], anaText: "", anaHistory: [], preText: "" };

            // Helper de Nombres
            const getTimestampedName = (prefix) => {
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-').substring(0, 5);
                return `${prefix}_${dateStr}_${timeStr}`;
            };

            // UI del Perfil
            if(dom.pName) dom.pName.textContent = user.displayName || 'Usuario';
            if(dom.pEmail) dom.pEmail.textContent = user.email;
            if(dom.pAvatar) dom.pAvatar.src = user.photoURL || 'img/PIDA_logo-P3-80.png';
            
            const doLogout = () => auth.signOut().then(() => window.location.reload());

            // --- CONTROL DE INACTIVIDAD ---
            function setupInactivityTimer() {
                let inactivityTimer;
                const INACTIVITY_LIMIT = 3 * 60 * 60 * 1000; // 3 Horas

                const resetTimer = () => {
                    clearTimeout(inactivityTimer);
                    inactivityTimer = setTimeout(() => {
                        console.warn("Cerrando sesión por inactividad prolongada.");
                        alert("Tu sesión ha expirado por inactividad. Por seguridad, debes ingresar nuevamente.");
                        doLogout(); 
                    }, INACTIVITY_LIMIT);
                };

                ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
                    window.addEventListener(evt, resetTimer, true);
                });
                resetTimer();
            }
            setupInactivityTimer();

            if(dom.pLogout) dom.pLogout.onclick = doLogout;
            if(dom.mobileMenuLogout) dom.mobileMenuLogout.onclick = doLogout;

            // --- GESTIÓN DE VISTAS ---
            function setView(view) {
                state.currentView = view;
                // Navbar
                if(dom.navInv) dom.navInv.classList.toggle('active', view === 'investigador');
                if(dom.navAna) dom.navAna.classList.toggle('active', view === 'analizador');
                if(dom.navPre) dom.navPre.classList.toggle('active', view === 'precalificador');
                
                // Secciones
                if(dom.viewInv) dom.viewInv.classList.toggle('hidden', view !== 'investigador');
                if(dom.viewAna) dom.viewAna.classList.toggle('hidden', view !== 'analizador');
                if(dom.viewPre) dom.viewPre.classList.toggle('hidden', view !== 'precalificador');
                if(dom.viewAcc) dom.viewAcc.classList.toggle('hidden', view !== 'cuenta');
                
                // Controles del Header
                const chatCtrls = document.getElementById('chat-controls');
                const anaCtrls = document.getElementById('analyzer-controls');
                const preCtrls = document.getElementById('precalifier-controls');
                const accCtrls = document.getElementById('account-controls');
                
                if(chatCtrls) chatCtrls.classList.toggle('hidden', view !== 'investigador');
                if(anaCtrls) anaCtrls.classList.toggle('hidden', view !== 'analizador');
                if(preCtrls) preCtrls.classList.toggle('hidden', view !== 'precalificador');
                if(accCtrls) accCtrls.classList.toggle('hidden', view !== 'cuenta');

                // Lazy Load de historiales
                if (view === 'investigador') loadChatHistory();
                if (view === 'analizador') loadAnaHistory();
                if (view === 'precalificador') loadPreHistory();
            }

            // Listeners de Navegación
            if(dom.navInv) dom.navInv.onclick = () => setView('investigador');
            if(dom.navAna) dom.navAna.onclick = () => setView('analizador');
            if(dom.navPre) dom.navPre.onclick = () => setView('precalificador');
            if(dom.pAvatar) dom.pAvatar.onclick = () => setView('cuenta');
            const userInfoBtn = document.getElementById('sidebar-user-info-click');
            if(userInfoBtn) userInfoBtn.onclick = () => setView('cuenta');

            // Menú Móvil
            if (dom.mobileMenuBtn) dom.mobileMenuBtn.onclick = (e) => { 
                e.stopPropagation(); 
                dom.mobileMenuOverlay.classList.toggle('hidden'); 
            };
            if (dom.mobileMenuOverlay) dom.mobileMenuOverlay.onclick = (e) => { 
                if (e.target === dom.mobileMenuOverlay) dom.mobileMenuOverlay.classList.add('hidden'); 
            };
            if (dom.mobileMenuProfile) dom.mobileMenuProfile.onclick = () => { 
                setView('cuenta'); 
                dom.mobileMenuOverlay.classList.add('hidden'); 
            };

            // --- LÓGICA DE HISTORIALES (MISMA LÓGICA PREVIA, SOLO REFERENCIADA) ---
            
            // 1. ANALIZADOR
            async function loadAnaHistory() {
                const h = await Utils.getHeaders(user);
                const list = document.getElementById('analyzer-history-list');
                if(!list) return;

                try {
                    list.innerHTML = '<div style="padding:15px; text-align:center; color:#666;">Cargando...</div>';
                    const r = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/`, { headers: h });
                    state.anaHistory = await r.json();
                    list.innerHTML = ''; 

                    if (state.anaHistory.length === 0) {
                        list.innerHTML = '<div style="padding:15px; text-align:center; color:#999; font-size:0.9em;">No hay análisis previos.</div>';
                        return;
                    }

                    state.anaHistory.forEach(a => {
                        const item = document.createElement('div');
                        item.className = 'pida-history-item';
                        
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = a.title || "Sin título";
                        titleSpan.style.flex = "1";
                        titleSpan.style.cursor = "pointer";
                        titleSpan.onclick = async (e) => {
                            e.stopPropagation();
                            const r2 = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { headers: h });
                            const d2 = await r2.json();
                            state.anaText = d2.analysis;
                            
                            const titleEl = document.getElementById('analyzer-section-title');
                            if(titleEl) titleEl.style.display = 'block';

                            dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(d2.analysis));
                            dom.anaLoader.style.display = 'none';
                            document.getElementById('analyzer-response-container').style.display = 'block';
                            dom.anaResBox.style.display = 'block';
                            dom.anaControls.style.display = 'flex';
                            
                            const anaHistContent = document.getElementById('analyzer-history-dropdown-content');
                            if(anaHistContent) anaHistContent.classList.remove('show');
                        };
                        
                        const delBtn = document.createElement('button');
                        delBtn.className = 'delete-icon-btn';
                        delBtn.innerHTML = `✕`;
                        delBtn.style.color = '#EF4444'; 
                        delBtn.onclick = async (e) => {
                            e.stopPropagation();
                            const conf = await showCustomConfirm('Se eliminará este análisis.');
                            if(conf) {
                                await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { method: 'DELETE', headers: h });
                                loadAnaHistory(); 
                            }
                        };

                        item.appendChild(titleSpan);
                        item.appendChild(delBtn);
                        list.appendChild(item);
                    });

                } catch(e) { list.innerHTML = '<div style="padding:10px; color:red; font-size:0.8em;">Error cargando historial.</div>'; }
            }

            // 2. CHAT
            async function loadChatHistory() {
                const h = await Utils.getHeaders(user);
                if (!h) return;
                try {
                    const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations`, { headers: h });
                    if (!r.ok) return; 

                    const data = await r.json();
                    if (!Array.isArray(data)) return;
                    state.conversations = data;

                    const list = document.getElementById('pida-history-list');
                    if(list) {
                        list.innerHTML = '';
                        state.conversations.forEach(c => {
                            const item = document.createElement('div');
                            item.className = `pida-history-item ${c.id === state.currentChat.id ? 'active' : ''}`;
                            
                            const titleSpan = document.createElement('span');
                            titleSpan.className = 'pida-history-item-title';
                            titleSpan.textContent = c.title || "Sin título";
                            titleSpan.style.flex = "1";
                            titleSpan.onclick = (e) => { 
                                e.stopPropagation(); 
                                loadChat(c.id); 
                                const histContent = document.getElementById('history-dropdown-content');
                                if(histContent) histContent.classList.remove('show'); 
                            };
                            
                            const delBtn = document.createElement('button');
                            delBtn.className = 'delete-icon-btn';
                            delBtn.innerHTML = '✕';
                            delBtn.onclick = async (e) => {
                                e.stopPropagation();
                                if(await showCustomConfirm('¿Eliminar chat?')) {
                                    await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${c.id}`, { method: 'DELETE', headers: h });
                                    loadChatHistory();
                                }
                            };

                            item.appendChild(titleSpan);
                            item.appendChild(delBtn);
                            list.appendChild(item);
                        });
                    }
                } catch (e) { console.error("Error cargando historial de chat:", e); }
            }

            // 3. PRECALIFICADOR
            async function loadPreHistory() {
                if (!dom.preHistList) return;
                try {
                    dom.preHistList.innerHTML = '<div style="padding:15px; text-align:center; color:#666;">Cargando...</div>';
                    
                    const snapshot = await db.collection('users').doc(user.uid).collection('prequalifications')
                                            .orderBy('created_at', 'desc').limit(20).get();

                    dom.preHistList.innerHTML = '';
                    if (snapshot.empty) {
                        dom.preHistList.innerHTML = '<div style="padding:15px; text-align:center; color:#999; font-size:0.9em;">Sin historial.</div>';
                        return;
                    }

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const displayTitle = data.title || "Sin título"; 
                        
                        const item = document.createElement('div');
                        item.className = 'pida-history-item';
                        
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = displayTitle;
                        titleSpan.style.flex = "1";
                        titleSpan.style.cursor = "pointer";
                        
                        titleSpan.onclick = (e) => {
                            e.stopPropagation();
                            // Load Pre Item
                            if(dom.preTitle) dom.preTitle.value = data.title || "";
                            if(dom.preCountry) dom.preCountry.value = data.country_code || "";
                            if(dom.preFacts) dom.preFacts.value = data.facts || "";

                            dom.preWelcome.style.display = 'none';
                            dom.preResultsBox.style.display = 'block';
                            dom.preLoader.style.display = 'none';
                            dom.preResponseCont.style.display = 'block';
                            dom.preControls.style.display = 'flex';
                            state.preText = data.analysis;
                            dom.preResultTxt.innerHTML = Utils.sanitize(marked.parse(data.analysis));
                            dom.preHistContent.classList.remove('show');
                        };
                        
                        const delBtn = document.createElement('button');
                        delBtn.className = 'delete-icon-btn';
                        delBtn.style.color = '#EF4444'; 
                        delBtn.innerHTML = `✕`;
                        delBtn.onclick = async (e) => {
                            e.stopPropagation();
                            if(await showCustomConfirm('¿Eliminar registro?')) {
                                await doc.ref.delete();
                                loadPreHistory();
                            }
                        };

                        item.appendChild(titleSpan);
                        item.appendChild(delBtn);
                        dom.preHistList.appendChild(item);
                    });
                } catch (error) { console.error(error); }
            }

            // Dropdowns
            const histBtn = document.getElementById('history-dropdown-btn');
            const histContent = document.getElementById('history-dropdown-content');
            const anaHistBtn = document.getElementById('analyzer-history-dropdown-btn');
            const anaHistContent = document.getElementById('analyzer-history-dropdown-content');

            if(histBtn) histBtn.onclick = (e) => { e.stopPropagation(); histContent.classList.toggle('show'); anaHistContent.classList.remove('show'); };
            if(anaHistBtn) anaHistBtn.onclick = async (e) => { 
                e.stopPropagation(); 
                if (!anaHistContent.classList.contains('show')) await loadAnaHistory(); 
                anaHistContent.classList.toggle('show');
                histContent.classList.remove('show'); 
            };
            
            // Dropdown Precalificador
            if (dom.preHistBtn) {
                dom.preHistBtn.onclick = (e) => {
                    e.stopPropagation();
                    histContent.classList.remove('show');
                    anaHistContent.classList.remove('show');
                    if (!dom.preHistContent.classList.contains('show')) loadPreHistory();
                    dom.preHistContent.classList.toggle('show');
                };
            }
            window.onclick = () => { 
                if(histContent) histContent.classList.remove('show'); 
                if(anaHistContent) anaHistContent.classList.remove('show');
                if(dom.preHistContent) dom.preHistContent.classList.remove('show');
            };

            // --- CHAT: RENDER Y LOGICA ---
            function toggleChatButtons(show) {
                ['chat-download-txt-btn', 'chat-download-pdf-btn', 'chat-download-docx-btn'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = show ? 'inline-flex' : 'none';
                });
            }

            function renderChat(msg) {
                const d = document.createElement('div');
                d.className = `pida-bubble ${msg.role === 'user' ? 'user-message-bubble' : 'pida-message-bubble'}`;
                let safeContent = msg.role === 'model' ? Utils.prepareMarkdown(msg.content) : msg.content;
                d.innerHTML = Utils.sanitize(marked.parse(safeContent));
                dom.chatBox.appendChild(d);
                if (msg.role === 'model') renderFollowUpQuestions(d);
                dom.chatBox.parentElement.scrollTop = dom.chatBox.parentElement.scrollHeight;
            }

            function renderFollowUpQuestions(element) {
                const headings = Array.from(element.querySelectorAll("h2, h3"));
                const followUpHeading = headings.find(h => h.textContent.includes("Preguntas de Seguimiento"));
                if (followUpHeading) {
                    const list = followUpHeading.nextElementSibling;
                    if (list && (list.tagName === "UL" || list.tagName === "OL")) {
                        const questions = Array.from(list.querySelectorAll("li"));
                        const card = document.createElement("div");
                        card.className = "follow-up-card";
                        card.innerHTML = "<h3>Preguntas de seguimiento:</h3>";
                        questions.forEach(q => {
                            const btn = document.createElement("button");
                            btn.className = "follow-up-btn";
                            btn.textContent = q.textContent;
                            btn.onclick = () => { dom.input.value = q.textContent; sendChat(); };
                            card.appendChild(btn);
                        });
                        followUpHeading.remove(); list.remove(); element.appendChild(card);
                    }
                }
            }

            async function loadChat(id) {
                const h = await Utils.getHeaders(user);
                const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${id}/messages`, { headers: h });
                const msgs = await r.json();
                const c = state.conversations.find(x => x.id === id);
                state.currentChat = { id, title: c?.title, messages: msgs };
                dom.chatBox.innerHTML = '';
                toggleChatButtons(true);
                msgs.forEach(renderChat);
                loadChatHistory();
            }

            async function startBackendSession() {
                const h = await Utils.getHeaders(user);
                try {
                    const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations`, {
                        method: 'POST', headers: h, body: JSON.stringify({ title: "Nuevo Chat" })
                    });
                    const newConvo = await r.json();
                    state.conversations.unshift(newConvo);
                    state.currentChat.id = newConvo.id;
                    state.currentChat.title = newConvo.title;
                    loadChatHistory();
                    return true;
                } catch (e) { return false; }
            }

            async function sendChat() {
                const txt = dom.input.value.trim();
                if (!txt) return;

                if (!state.currentChat.id) {
                    const success = await startBackendSession();
                    if (!success) { alert("Error de conexión."); return; }
                    toggleChatButtons(true);
                }
                
                renderChat({ role: 'user', content: txt });
                state.currentChat.messages.push({ role: 'user', content: txt });
                dom.input.value = '';

                const botBubble = document.createElement('div');
                botBubble.className = 'pida-bubble pida-message-bubble';
                botBubble.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
                dom.chatBox.appendChild(botBubble);
                dom.chatBox.parentElement.scrollTop = dom.chatBox.parentElement.scrollHeight;

                try {
                    const h = await Utils.getHeaders(user);
                    const r = await fetch(`${PIDA_CONFIG.API_CHAT}/chat-stream/${state.currentChat.id}`, {
                        method: 'POST', headers: h, body: JSON.stringify({ prompt: txt })
                    });
                    const reader = r.body.getReader();
                    const decoder = new TextDecoder();
                    let fullText = "";
                    
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n\n');
                        for (const l of lines) {
                            if (l.startsWith('data:')) {
                                try {
                                    const d = JSON.parse(l.substring(6));
                                    if (d.text) {
                                        if (fullText === "") botBubble.innerHTML = '';
                                        fullText += d.text;
                                        let safeContent = Utils.prepareMarkdown(fullText);
                                        botBubble.innerHTML = Utils.sanitize(marked.parse(safeContent));
                                        dom.chatBox.parentElement.scrollTop = dom.chatBox.parentElement.scrollHeight;
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                    state.currentChat.messages.push({ role: 'model', content: fullText });
                    renderFollowUpQuestions(botBubble);
                    
                    if (state.currentChat.messages.length === 2) {
                        await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${state.currentChat.id}/title`, {
                            method: 'PATCH', headers: h, body: JSON.stringify({ title: txt.substring(0, 30) })
                        });
                        loadChatHistory();
                    }
                } catch (error) {
                    botBubble.innerHTML = "<span style='color:red'>Error de conexión.</span>";
                }
            }

            async function handleNewChat(clearUI = true) {
                if (!dom.chatBox) return;
                if (clearUI) { 
                    dom.chatBox.innerHTML = ''; 
                    if(dom.input) dom.input.value = ''; 
                    state.currentChat = { id: null, title: '', messages: [] };
                    
                    const items = document.querySelectorAll('.pida-history-item');
                    if(items) items.forEach(el => el.classList.remove('active'));

                    toggleChatButtons(false);

                    renderChat({
                        role: 'model',
                        content: "**¡Hola! Soy PIDA, tu asistente experto en Derechos Humanos.**\n\nEstoy listo para apoyarte en investigaciones, análisis de casos y redacción legal.\n\n**¿Qué te gustaría pedirme ahora?**"
                    });
                }
            }

            // Manejadores Chat
            const pidaForm = document.getElementById('pida-form');
            if (pidaForm) pidaForm.onsubmit = (e) => { e.preventDefault(); sendChat(); };

            const onNewChatClick = (e) => { e.preventDefault(); handleNewChat(true); };
            const btnSidebar = document.getElementById('pida-new-chat-btn');
            if (btnSidebar) btnSidebar.onclick = onNewChatClick;
            const btnClear = document.getElementById('chat-clear-btn');
            if(btnClear) btnClear.onclick = onNewChatClick;
            
            if (dom.sendBtn) dom.sendBtn.onclick = (e) => { e.preventDefault(); sendChat(); };
            if (dom.input) dom.input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };

            // Descargas Chat
            document.getElementById('chat-download-txt-btn').onclick = () => {
                const name = getTimestampedName("Experto-PIDA");
                Exporter.downloadTXT(name, "Reporte Experto Jurídico", state.currentChat.messages);
            };
            document.getElementById('chat-download-pdf-btn').onclick = () => {
                const name = getTimestampedName("Experto-PIDA");
                Exporter.downloadPDF(name, "Reporte Experto Jurídico", state.currentChat.messages);
            };
            document.getElementById('chat-download-docx-btn').onclick = () => {
                const name = getTimestampedName("Experto-PIDA");
                Exporter.downloadDOCX(name, "Reporte Experto Jurídico", state.currentChat.messages);
            };

            // --- ANALIZADOR (RESTO DE LA LÓGICA) ---
            const anaUploadBtn = document.getElementById('analyzer-upload-btn');
            if(anaUploadBtn) anaUploadBtn.onclick = () => dom.anaInput.click();
            if(dom.anaInput) dom.anaInput.onchange = (e) => { state.anaFiles.push(...e.target.files); renderFiles(); };

            function renderFiles() {
                dom.anaFiles.innerHTML = '';
                state.anaFiles.forEach((f, i) => {
                    const d = document.createElement('div');
                    d.className = 'active-file-chip';
                    d.innerHTML = `<span>${f.name}</span> <button>×</button>`;
                    d.querySelector('button').onclick = () => { state.anaFiles.splice(i, 1); renderFiles(); };
                    dom.anaFiles.appendChild(d);
                });
            }

            function showAnalyzerWelcome() {
                dom.anaResBox.style.display = 'block'; 
                document.getElementById('analyzer-response-container').style.display = 'block';
                dom.anaControls.style.display = 'none'; 
                dom.anaLoader.style.display = 'none';
                dom.anaResTxt.innerHTML = `
                    <div class="pida-bubble pida-message-bubble">
                        <h3>📑 Analizador de Documentos</h3>
                        <p>Sube tus archivos (PDF, DOCX) y recibe un análisis sistemático.</p>
                    </div>`;
            }
            showAnalyzerWelcome();

            if(dom.anaBtn) {
                dom.anaBtn.onclick = async () => {
                    if (!state.anaFiles.length) { alert("Sube al menos un documento."); return; }
                    
                    dom.anaResBox.style.display = 'block'; 
                    dom.anaLoader.style.display = 'block';
                    document.getElementById('analyzer-response-container').style.display = 'none';
                    dom.anaResTxt.innerHTML = ''; 
                    dom.anaControls.style.display = 'none';
                    
                    const fd = new FormData();
                    state.anaFiles.forEach(f => fd.append('files', f));
                    const instructions = dom.anaInst.value.trim() || "Analiza este documento.";
                    fd.append('instructions', instructions);
                    
                    const token = await user.getIdToken();

                    try {
                        const r = await fetch(`${PIDA_CONFIG.API_ANA}/analyze/`, {
                            method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
                        });
                        
                        const reader = r.body.getReader();
                        const decoder = new TextDecoder();
                        let fullText = "";
                        let started = false;

                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n\n');
                            for (const line of lines) {
                                if (line.startsWith('data:')) {
                                    try {
                                        const data = JSON.parse(line.substring(5).trim());
                                        if (data.text) {
                                            if (!started) { 
                                                dom.anaLoader.style.display = 'none'; 
                                                document.getElementById('analyzer-response-container').style.display = 'block';
                                                const titleEl = document.getElementById('analyzer-section-title');
                                                if(titleEl) titleEl.style.display = 'block';
                                                started = true; 
                                            }
                                            fullText += data.text;
                                            dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(fullText));
                                        }
                                        if (data.done) {
                                            state.anaText = fullText;
                                            dom.anaControls.style.display = 'flex';
                                            loadAnaHistory();
                                        }
                                    } catch (e) {}
                                }
                            }
                        }
                    } catch (e) {
                        dom.anaLoader.style.display = 'none';
                        dom.anaResTxt.innerHTML = `<span style='color:red'>Error: ${e.message}</span>`;
                        document.getElementById('analyzer-response-container').style.display = 'block';
                    }
                };
            }
            
            if (dom.anaInst) { dom.anaInst.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dom.anaBtn.click(); } }; }
            if(dom.analyzerClearBtn) { dom.analyzerClearBtn.onclick = () => { state.anaFiles = []; state.anaText = ""; renderFiles(); dom.anaInst.value = ''; showAnalyzerWelcome(); }; }
            
            // Descargas Analizador
            document.getElementById('analyzer-download-txt-btn').onclick = () => { if(!state.anaText) return; const name = getTimestampedName("Analizador-PIDA"); Exporter.downloadTXT(name, "Reporte Análisis", state.anaText); };
            document.getElementById('analyzer-download-pdf-btn').onclick = () => { if(!state.anaText) return; const name = getTimestampedName("Analizador-PIDA"); Exporter.downloadPDF(name, "Reporte Análisis", state.anaText); };
            document.getElementById('analyzer-download-docx-btn').onclick = () => { if(!state.anaText) return; const name = getTimestampedName("Analizador-PIDA"); Exporter.downloadDOCX(name, "Reporte Análisis", state.anaText); };

            // --- PRECALIFICADOR (Manejadores y Reset) ---
            function resetPrecalifier() {
                if(dom.preFacts) dom.preFacts.value = '';
                if(dom.preCountry) dom.preCountry.value = '';
                if(dom.preTitle) dom.preTitle.value = '';
                
                dom.preWelcome.style.display = 'flex';
                dom.preResultsBox.style.display = 'none';
                dom.preLoader.style.display = 'none';
                dom.preResponseCont.style.display = 'none';
                dom.preControls.style.display = 'none';
                dom.preResultTxt.innerHTML = '';
                state.preText = "";
            }
            if (dom.preNewBtn) dom.preNewBtn.onclick = resetPrecalifier;
            if (dom.preClear) dom.preClear.onclick = resetPrecalifier;

            if (dom.preBtn) {
                dom.preBtn.onclick = async () => {
                    const now = new Date();
                    let title = dom.preTitle.value.trim(); 
                    if (!title) title = `Caso ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
                    const facts = dom.preFacts.value.trim();
                    const country = dom.preCountry.value || null;

                    if (!facts) { alert("Narra los hechos."); return; }

                    dom.preWelcome.style.display = 'none';
                    dom.preResultsBox.style.display = 'block'; 
                    dom.preLoader.style.display = 'block';     
                    dom.preStatus.textContent = "Analizando delitos y DDHH...";
                    dom.preResponseCont.style.display = 'none'; 
                    dom.preResultTxt.innerHTML = '';
                    dom.preControls.style.display = 'none';
                    state.preText = "";
                    dom.preBtn.disabled = true;

                    try {
                        const token = await user.getIdToken();
                        const response = await fetch(`${PIDA_CONFIG.API_PRE}/analyze`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ title, facts, country_code: country })
                        });

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let fullText = "";

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value);
                            const lines = chunk.split("\n\n");
                            for (const line of lines) {
                                if (line.startsWith("data: ")) {
                                    try {
                                        const data = JSON.parse(line.replace("data: ", "").trim());
                                        if (data.event === "status") { dom.preStatus.textContent = data.message; }
                                        else if (data.text) {
                                            if (dom.preLoader.style.display !== 'none') {
                                                dom.preLoader.style.display = 'none';
                                                dom.preResponseCont.style.display = 'block';
                                            }
                                            fullText += data.text;
                                            dom.preResultTxt.innerHTML = Utils.sanitize(marked.parse(fullText));
                                        } else if (data.event === "done") {
                                            state.preText = fullText;
                                            dom.preControls.style.display = 'flex';
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                    } catch (error) {
                        dom.preLoader.style.display = 'none';
                        dom.preResponseCont.style.display = 'block';
                        dom.preResultTxt.innerHTML = `<span style='color:red'>Error: ${error.message}</span>`;
                    } finally {
                        dom.preBtn.disabled = false;
                    }
                };
            }

            // Descargas Precalificador
            document.getElementById('pre-download-txt-btn').onclick = () => { if(!state.preText) return; const name = getTimestampedName("Precalificador-PIDA"); Exporter.downloadTXT(name, "Precalificación de Caso", state.preText); };
            document.getElementById('pre-download-pdf-btn').onclick = () => { if(!state.preText) return; const name = getTimestampedName("Precalificador-PIDA"); Exporter.downloadPDF(name, "Precalificación de Caso", state.preText); };
            document.getElementById('pre-download-docx-btn').onclick = () => { if(!state.preText) return; const name = getTimestampedName("Precalificador-PIDA"); Exporter.downloadDOCX(name, "Precalificación de Caso", state.preText); };

            // --- CUENTA ---
            if(dom.accUpdate) { dom.accUpdate.onclick = async () => { const f = document.getElementById('acc-firstname').value; const l = document.getElementById('acc-lastname').value; if(f || l) { await user.updateProfile({ displayName: `${f} ${l}` }); dom.pName.textContent = `${f} ${l}`; alert('Actualizado'); } }; }
            if(dom.accBilling) { dom.accBilling.onclick = async () => { const fn = firebase.functions().httpsCallable('ext-firestore-stripe-payments-createPortalLink'); const { data } = await fn({ returnUrl: window.location.href }); window.location.assign(data.url); }; }
            if(dom.accReset) { dom.accReset.onclick = () => auth.sendPasswordResetEmail(user.email).then(()=>alert('Correo enviado')); }

            // INICIO
            setView('investigador');
            handleNewChat(true); 
            loadChatHistory();

        } catch (error) {
            console.error("Error crítico en runApp:", error);
            // Si algo falla catastróficamente, al menos quitamos el loader y mostramos el error
            hideLoader();
            alert("Hubo un problema al cargar la aplicación. Por favor, recarga la página.");
        }
    }

    //
    //HANDLE UNSUBSCRIBE
    //
    async function handleUnsubscribePath() {
        const path = window.location.pathname;
        if (!path.includes('unsubscribe')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        const statusEl = document.getElementById('status-msg');
        const emailSpan = document.getElementById('user-email');

        if (email) {
            if(emailSpan) emailSpan.textContent = email;
            try {
                // Buscamos al usuario por su email en la colección 'customers'
                const userQuery = await db.collection('customers').where('email', '==', email).limit(1).get();
                
                if (!userQuery.empty) {
                    const userDoc = userQuery.docs[0];
                    await userDoc.ref.update({
                        marketing_opt_out: true,
                        unsubscribed_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    if(statusEl) {
                        statusEl.classList.remove('loading-dots');
                        statusEl.style.color = '#10B981';
                        statusEl.textContent = '✓ Lista de correos actualizada con éxito.';
                    }
                } else {
                    // Si el usuario no existe en 'customers', el email no es válido
                    if(statusEl) statusEl.textContent = 'Error: No se encontró el registro.';
                }
            } catch (error) {
                if(statusEl) statusEl.textContent = 'Error al procesar la solicitud.';
                console.error("Unsubscribe error:", error);
            }
        } else {
            if(statusEl) statusEl.textContent = 'Error: Falta el parámetro de correo.';
        }
    }

    // Ejecutar al cargar
    handleUnsubscribePath();

});