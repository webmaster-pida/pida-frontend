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

// =========================================================
// 2. CONFIGURACIÓN
// =========================================================
const STRIPE_PRICES = {
    basic: {
        USD: { id: 'price_1ScEcgGgaloBN5L8BQVnYeFl', text: '$29.99' },
        MXN: { id: 'price_1ScnlrGgaloBN5L8fWzCvIFp', text: '$599 MXN' }
    },
    pro: {
        USD: { id: 'price_1ScEeFGgaloBN5L8psSOfigs', text: '$299.99' },
        MXN: { id: 'price_1ScbTBGgaloBN5L8c0izUGmr', text: '$5,999 MXN' }
    }
};

let currentCurrency = 'USD';

const PIDA_CONFIG = {
    API_CHAT: "https://chat-v20-465781488910.us-central1.run.app",
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

// Funciones Globales
window.closeBanner = function() {
    const banner = document.getElementById('system-alert-banner');
    if(banner) banner.classList.add('hidden');
    document.body.style.marginTop = '0px';
    const nav = document.getElementById('navbar');
    if (nav) nav.style.top = '0px';
}

window.switchAuthMode = function(mode) {
    authMode = mode;
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-register');
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const submitBtn = document.getElementById('auth-submit-btn');
    const googleText = document.getElementById('google-text');
    const errMsg = document.getElementById('login-message');
    
    if(errMsg) errMsg.style.display = 'none';

    if (mode === 'login') {
        if(btnLogin) btnLogin.classList.add('active');
        if(btnReg) btnReg.classList.remove('active');
        if(title) title.textContent = 'Bienvenido de nuevo';
        if(desc) desc.textContent = 'Accede para continuar tu investigación.';
        if(submitBtn) submitBtn.textContent = 'Ingresar';
        if(googleText) googleText.textContent = 'Entrar con Google';
    } else {
        if(btnLogin) btnLogin.classList.remove('active');
        if(btnReg) btnReg.classList.add('active');
        if(title) title.textContent = 'Crear una cuenta';
        if(desc) desc.textContent = 'Únete para acceder a PIDA.';
        if(submitBtn) submitBtn.textContent = 'Registrarse';
        if(googleText) googleText.textContent = 'Registrarse con Google';
    }
}

// Configuración Markdown
marked.use({ gfm: true, breaks: true });
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if ('target' in node) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});


document.addEventListener('DOMContentLoaded', function () {
    const landingRoot = document.getElementById('landing-page-root');
    const loginScreen = document.getElementById('pida-login-screen');
    const appRoot = document.getElementById('pida-app-root');

    // --- UTILIDADES INTERNAS ---
    const Utils = {
        sanitize(html) { return DOMPurify.sanitize(html); },
        async getHeaders(user) { 
            try { 
                const t = await user.getIdToken(); 
                return { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }; 
            } catch { return null; } 
        }
    };

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
    // INICIALIZACIÓN DE FIREBASE
    // ==========================================
    try {
        if (!firebase.apps.length) firebase.initializeApp(PIDA_CONFIG.FIREBASE);
        auth = firebase.auth();
        db = firebase.firestore();
        const remoteConfig = firebase.remoteConfig();
        remoteConfig.defaultConfig = { 'maintenance_mode_enabled': 'false' };
        
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        // --- FORMULARIO DE CONTACTO (ENVÍO) ---
        const contactForm = document.getElementById('contact-form');
        if(contactForm) {
            contactForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                const btn = document.getElementById('contact-submit-btn');
                const status = document.getElementById('contact-status');
                const originalText = btn.textContent;
                
                const leadData = {
                    name: document.getElementById('contact-name').value,
                    company: document.getElementById('contact-company').value,
                    email: document.getElementById('contact-email').value,
                    phone: (document.getElementById('contact-country-code').value || '') + ' ' + document.getElementById('contact-phone').value,
                    message: document.getElementById('contact-message').value,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'nuevo'
                };

                btn.textContent = 'Guardando...'; btn.disabled = true;
                try {
                    await db.collection('leads_corporativos').add(leadData);
                    btn.textContent = '¡Enviado!';
                    status.textContent = 'Datos recibidos. Te contactaremos pronto.';
                    status.style.display = 'block'; status.style.color = '#10B981';
                    setTimeout(() => {
                        const modal = document.getElementById('contact-modal');
                        if(modal) modal.classList.add('hidden');
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
        // AQUÍ ESTÁ LA CORRECCIÓN:
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

        auth.onAuthStateChanged(async function (user) {
            currentUser = user;
            if (user) {
                if(loginScreen) loginScreen.style.display = 'none';
                const accessGranted = await checkAccessAuthorization(user);

                if (accessGranted) {
                    if(landingRoot) landingRoot.style.display = 'none';
                    if(appRoot) appRoot.style.display = 'block';
                    runApp(user); 
                    requestAnimationFrame(() => hideLoader());
                } else {
                    if(landingRoot) landingRoot.style.display = 'block';
                    if(appRoot) appRoot.style.display = 'none';
                    if (pendingPlan) {
                        startCheckout(STRIPE_PRICES[pendingPlan][currentCurrency].id);
                        pendingPlan = null; 
                    } else {
                        window.location.hash = 'planes';
                    }
                    hideLoader();
                }
            } else {
                if(landingRoot) landingRoot.style.display = 'block';
                if(appRoot) appRoot.style.display = 'none';
                hideLoader();
            }
        });

    } catch (firebaseError) { console.error("Firebase Error:", firebaseError); }

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
    document.querySelectorAll('.trigger-login').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginScreen) { loginScreen.style.display = 'flex'; window.switchAuthMode('login'); }
        });
    });

    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const btn = document.getElementById('auth-submit-btn');
            
            btn.disabled = true; btn.textContent = "Procesando...";
            try {
                if (authMode === 'login') await auth.signInWithEmailAndPassword(email, pass);
                else await auth.createUserWithEmailAndPassword(email, pass);
            } catch (error) {
                btn.disabled = false; btn.textContent = "Intentar de nuevo";
                alert(error.message);
            }
        });
    }

    const googleBtn = document.getElementById('google-login-btn');
    if(googleBtn) googleBtn.addEventListener('click', async () => {
        try { await auth.signInWithPopup(googleProvider); } catch (error) { alert(error.message); }
    });

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

    document.querySelectorAll('.plan-cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            const planKey = btn.getAttribute('data-plan');
            const priceId = STRIPE_PRICES[planKey]?.['USD']?.id; // Default USD por simplicidad
            
            if (currentUser && priceId) {
                btn.textContent = "Procesando...";
                startCheckout(priceId);
            } else {
                pendingPlan = planKey;
                if (loginScreen) { loginScreen.style.display = 'flex'; window.switchAuthMode('register'); }
            }
        });
    });

    // ==========================================
    // APLICACIÓN PRINCIPAL (RUNAPP)
    // ==========================================
    function runApp(user) {
        console.log("🚀 Iniciando aplicación PIDA para:", user.email);

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
            preCountry: document.getElementById('pre-input-country'),
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

        // Estado
        let state = { currentView: 'investigador', conversations: [], currentChat: { id: null, title: '', messages: [] }, anaFiles: [], anaText: "", anaHistory: [], preText: "" };

        // HELPER PARA NOMBRES DE ARCHIVO CON FECHA
        const getTimestampedName = (prefix) => {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-').substring(0, 5); // HH-MM
            return `${prefix}_${dateStr}_${timeStr}`;
        };

        // Perfil UI
        if(dom.pName) dom.pName.textContent = user.displayName || 'Usuario';
        if(dom.pEmail) dom.pEmail.textContent = user.email;
        if(dom.pAvatar) dom.pAvatar.src = user.photoURL || 'img/PIDA_logo-P3-80.png';
        
        const doLogout = () => auth.signOut().then(() => window.location.reload());
        if(dom.pLogout) dom.pLogout.onclick = doLogout;
        if(dom.mobileMenuLogout) dom.mobileMenuLogout.onclick = doLogout;

        // Vistas
        function setView(view) {
            state.currentView = view;
            if(dom.navInv) dom.navInv.classList.toggle('active', view === 'investigador');
            if(dom.navAna) dom.navAna.classList.toggle('active', view === 'analizador');
            if(dom.navPre) dom.navPre.classList.toggle('active', view === 'precalificador');
            if(dom.viewInv) dom.viewInv.classList.toggle('hidden', view !== 'investigador');
            if(dom.viewAna) dom.viewAna.classList.toggle('hidden', view !== 'analizador');
            if(dom.viewPre) dom.viewPre.classList.toggle('hidden', view !== 'precalificador');
            if(dom.viewAcc) dom.viewAcc.classList.toggle('hidden', view !== 'cuenta');
            
            const chatCtrls = document.getElementById('chat-controls');
            const anaCtrls = document.getElementById('analyzer-controls');
            const preCtrls = document.getElementById('precalifier-controls');
            const accCtrls = document.getElementById('account-controls');
            if(chatCtrls) chatCtrls.classList.toggle('hidden', view !== 'investigador');
            if(anaCtrls) anaCtrls.classList.toggle('hidden', view !== 'analizador');
            if(preCtrls) preCtrls.classList.toggle('hidden', view !== 'precalificador');
            if(accCtrls) accCtrls.classList.toggle('hidden', view !== 'cuenta');

            if (view === 'investigador') loadChatHistory();
            if (view === 'analizador') loadAnaHistory();
        }

        if(dom.navInv) dom.navInv.onclick = () => setView('investigador');
        if(dom.navAna) dom.navAna.onclick = () => setView('analizador');
        if(dom.navPre) dom.navPre.onclick = () => setView('precalificador');
        if(dom.pAvatar) dom.pAvatar.onclick = () => setView('cuenta');
        const userInfoBtn = document.getElementById('sidebar-user-info-click');
        if(userInfoBtn) userInfoBtn.onclick = () => setView('cuenta');

        // Menú Móvil (CORREGIDO: TOGGLE)
        if (dom.mobileMenuBtn) dom.mobileMenuBtn.onclick = (e) => { 
            e.stopPropagation(); 
            dom.mobileMenuOverlay.classList.toggle('hidden'); 
        };
        if (dom.mobileMenuOverlay) dom.mobileMenuOverlay.onclick = (e) => { if (e.target === dom.mobileMenuOverlay) dom.mobileMenuOverlay.classList.add('hidden'); };
        if (dom.mobileMenuProfile) dom.mobileMenuProfile.onclick = () => { setView('cuenta'); dom.mobileMenuOverlay.classList.add('hidden'); };

        // --- HISTORIAL ANALIZADOR ---
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
                        state.anaText = d2.analysis; // GUARDAMOS EL TEXTO PARA EXPORTAR
                        
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
                    delBtn.style.color = '#EF4444'; 
                    delBtn.style.minWidth = '24px';
                    delBtn.style.border = 'none';
                    delBtn.style.background = 'transparent';
                    delBtn.innerHTML = `✕`;
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

            } catch(e) { list.innerHTML = '<div style="padding:10px; color:red; font-size:0.8em;">Error.</div>'; }
        }

        // Dropdowns de Historial
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
        window.onclick = () => { if(histContent) histContent.classList.remove('show'); if(anaHistContent) anaHistContent.classList.remove('show'); };

        // --- CHAT LOGIC ---

        function toggleChatButtons(show) {
            const ids = ['chat-download-txt-btn', 'chat-download-pdf-btn', 'chat-download-docx-btn'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = show ? 'inline-flex' : 'none';
            });
        }

        function renderChat(msg) {
            const d = document.createElement('div');
            d.className = `pida-bubble ${msg.role === 'user' ? 'user-message-bubble' : 'pida-message-bubble'}`;
            let safeContent = msg.content;
            if (msg.role === 'model') safeContent = safeContent.replace(/(?:[\n\r\s]*)(?:\*\*|__)?(Fuente:)(?:\*\*|__)?/g, '\n\n<hr>\n\n<strong>$1</strong>');
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

        async function loadChatHistory() {
            const h = await Utils.getHeaders(user);
            if (!h) return;
            try {
                const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations`, { headers: h });
                state.conversations = await r.json();
                const list = document.getElementById('pida-history-list');
                if(list) {
                    list.innerHTML = '';
                    state.conversations.forEach(c => {
                        const item = document.createElement('div');
                        item.className = `pida-history-item ${c.id === state.currentChat.id ? 'active' : ''}`;
                        
                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'pida-history-item-title';
                        titleSpan.textContent = c.title;
                        titleSpan.style.flex = "1";
                        titleSpan.onclick = (e) => { e.stopPropagation(); loadChat(c.id); if(histContent) histContent.classList.remove('show'); };
                        
                        const delBtn = document.createElement('button');
                        delBtn.className = 'delete-icon-btn';
                        delBtn.style.color = '#EF4444'; 
                        delBtn.style.minWidth = '24px';
                        delBtn.style.border = 'none';
                        delBtn.style.background = 'transparent';
                        delBtn.innerHTML = `✕`;
                        delBtn.onclick = async (e) => {
                            e.stopPropagation();
                            const conf = await showCustomConfirm('Esta acción no se puede deshacer.');
                            if(conf) {
                                await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${c.id}`, { method: 'DELETE', headers: h });
                                await loadChatHistory(); 
                                if(state.currentChat.id === c.id) handleNewChat(true);
                            }
                        };
                        item.appendChild(titleSpan); item.appendChild(delBtn); list.appendChild(item);
                    });
                }
            } catch (e) { console.error(e); }
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
                                    let safeContent = fullText.replace(/(?:[\n\r\s]*)(?:\*\*|__)?(Fuente:)(?:\*\*|__)?/g, '\n\n<hr>\n\n<strong>$1</strong>');
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
                    content: "**¡Hola! Soy PIDA, tu asistente experto en Derechos Humanos y temas afines.**\n\nEstoy para apoyarte y responder cualquier pregunta que me hagas, incluyendo investigaciones, análisis de casos, búsqueda de jurisprudencia y redacción legal de todo tipo de documentos, cartas, informes, elaboración de proyectos y seguimiento y monitoreo.\n\n**¿Qué te gustaría pedirme ahora?**"
                });
            }
        }

        // --- MANEJADORES DE CHAT ---
        const pidaForm = document.getElementById('pida-form');
        if (pidaForm) pidaForm.onsubmit = (e) => { e.preventDefault(); sendChat(); };

        const onNewChatClick = (e) => { e.preventDefault(); handleNewChat(true); };
        const btnSidebar = document.getElementById('pida-new-chat-btn');
        if (btnSidebar) btnSidebar.onclick = onNewChatClick;
        const btnMobile = document.getElementById('new-chat-btn');
        if (btnMobile) btnMobile.onclick = onNewChatClick;
        const btnClear = document.getElementById('chat-clear-btn');
        if(btnClear) btnClear.onclick = onNewChatClick;
        
        if (dom.sendBtn) dom.sendBtn.onclick = (e) => { e.preventDefault(); sendChat(); };
        if (dom.input) dom.input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };

        // --- BOTONES DE DESCARGA CHAT ---
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

        // --- ANALYZER LOGIC ---
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
                    <p>Sube tus archivos (PDF, DOCX) y escribe una instrucción clara. PIDA leerá, resumirá y sitematizará el documento por ti.</p>
                    <hr>
                    <strong>Ejemplos de lo que puedes pedir:</strong>
                    <ul style="margin-top: 10px; padding-left: 20px; line-height: 1.6;">
                        <li>"Haz un resumen ejecutivo de este documento (contrato, sentencia, tesis, etc)."</li>
                        <li>"Identifica las cláusulas de rescisión y sus penalizaciones."</li>
                        <li>"Extrae una lista cronológica de los hechos en esta sentencia y prepara un borrador de recurso de impugnación confirme a la legislación del país que se trate."</li>
                        <li>"¿Existen riesgos legales para mi cliente en este documento?"</li>
                    </ul>

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
                const instructions = dom.anaInst.value.trim() || "Analiza este documento y resume sus puntos clave.";
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
                                        // Scroll auto
                                        const scrollContainer = dom.viewAna.querySelector('.pida-view-content');
                                        if(scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
                                    }
                                    if (data.done) {
                                        state.anaText = fullText; // GUARDAR TEXTO PARA EXPORTAR
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

        if (dom.anaInst) {
            dom.anaInst.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dom.anaBtn.click(); } };
        }
        if(dom.analyzerClearBtn) {
            dom.analyzerClearBtn.onclick = () => {
                state.anaFiles = []; state.anaText = ""; renderFiles();
                dom.anaInst.value = ''; showAnalyzerWelcome(); 
            };
        }

        // --- BOTONES DE DESCARGA ANALIZADOR ---
        document.getElementById('analyzer-download-txt-btn').onclick = () => {
            if(!state.anaText) return alert("No hay análisis para descargar.");
            const name = getTimestampedName("Analizador-PIDA");
            Exporter.downloadTXT(name, "Reporte Análisis Documental", state.anaText);
        };
        document.getElementById('analyzer-download-pdf-btn').onclick = () => {
            if(!state.anaText) return alert("No hay análisis para descargar.");
            const name = getTimestampedName("Analizador-PIDA");
            Exporter.downloadPDF(name, "Reporte Análisis Documental", state.anaText);
        };
        document.getElementById('analyzer-download-docx-btn').onclick = () => {
            if(!state.anaText) return alert("No hay análisis para descargar.");
            const name = getTimestampedName("Analizador-PIDA");
            Exporter.downloadDOCX(name, "Reporte Análisis Documental", state.anaText);
        };

// =========================================================
        // LÓGICA PRECALIFICADOR (ACTUALIZADA SIN TÍTULO MANUAL)
        // =========================================================
        
        function resetPrecalifier() {
            // Ya no hay preTitle que limpiar
            if(dom.preFacts) dom.preFacts.value = '';
            if(dom.preCountry) dom.preCountry.value = '';
            
            dom.preWelcome.style.display = 'flex';
            dom.preResultsBox.style.display = 'none';
            dom.preLoader.style.display = 'none';
            dom.preResponseCont.style.display = 'none';
            dom.preControls.style.display = 'none';
            dom.preResultTxt.innerHTML = '';
            state.preText = "";
        }

        if (dom.preClear) dom.preClear.onclick = resetPrecalifier;

        if (dom.preBtn) {
            dom.preBtn.onclick = async () => {
                // GENERACIÓN AUTOMÁTICA DE TÍTULO
                const now = new Date();
                const title = `Consulta Rápida - ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
                
                const facts = dom.preFacts.value.trim();
                const country = dom.preCountry.value || null;

                // Validación: Solo requerimos hechos
                if (!facts) {
                    alert("Por favor, narra los hechos del caso.");
                    return;
                }

                // UI Setup
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
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ title, facts, country_code: country })
                    });

                    // ... (El resto del código de lectura del stream se mantiene IGUAL) ...
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
                                    if (data.event === "status") {
                                        dom.preStatus.textContent = data.message;
                                    } else if (data.text) {
                                        if (dom.preLoader.style.display !== 'none') {
                                            dom.preLoader.style.display = 'none';
                                            dom.preResponseCont.style.display = 'block';
                                        }
                                        fullText += data.text;
                                        dom.preResultTxt.innerHTML = Utils.sanitize(marked.parse(fullText));
                                        const scrollCont = dom.viewPre.querySelector('.pida-view-content');
                                        if(scrollCont) scrollCont.scrollTop = scrollCont.scrollHeight;
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

        // Descargas del Precalificador
        document.getElementById('pre-download-txt-btn').onclick = () => {
            if(!state.preText) return alert("No hay resultado para descargar.");
            const name = getTimestampedName("Precalificador-PIDA");
            Exporter.downloadTXT(name, "Precalificación de Caso", state.preText);
        };
        document.getElementById('pre-download-pdf-btn').onclick = () => {
            if(!state.preText) return alert("No hay resultado para descargar.");
            const name = getTimestampedName("Precalificador-PIDA");
            Exporter.downloadPDF(name, "Precalificación de Caso", state.preText);
        };
        document.getElementById('pre-download-docx-btn').onclick = () => {
            if(!state.preText) return alert("No hay resultado para descargar.");
            const name = getTimestampedName("Precalificador-PIDA");
            Exporter.downloadDOCX(name, "Precalificación de Caso", state.preText);
        };

        // --- CUENTA ---
        if(dom.accUpdate) {
            dom.accUpdate.onclick = async () => {
                const f = document.getElementById('acc-firstname').value;
                const l = document.getElementById('acc-lastname').value;
                if(f || l) { await user.updateProfile({ displayName: `${f} ${l}` }); dom.pName.textContent = `${f} ${l}`; alert('Actualizado'); }
            };
        }
        if(dom.accBilling) {
            dom.accBilling.onclick = async () => {
                const fn = firebase.functions().httpsCallable('ext-firestore-stripe-payments-createPortalLink');
                const { data } = await fn({ returnUrl: window.location.href });
                window.location.assign(data.url);
            };
        }
        if(dom.accReset) {
            dom.accReset.onclick = () => auth.sendPasswordResetEmail(user.email).then(()=>alert('Correo enviado'));
        }

        // INICIO
        setView('investigador');
        handleNewChat(true); 
        loadChatHistory();
    }
});