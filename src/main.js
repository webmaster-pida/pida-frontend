// =========================================================
// 1. ZONA DE IMPORTACIONES (Vite / Módulos Modernos)
// =========================================================
import './style.css'; // Tus estilos CSS

// Importar Firebase (Compatibilidad v9)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/analytics';
import 'firebase/compat/remote-config';

// Importar Librerías de utilidades
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


// --- FUNCIÓN AUXILIAR: CONFIRMACIÓN SUTIL ---
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
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';

        overlay.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 16px; width: 90%; max-width: 320px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); transform: scale(0.9); transition: transform 0.2s ease;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🗑️</div>
                <h3 style="color: #1D3557; margin: 0 0 10px 0; font-family: 'Inter', sans-serif;">¿Eliminar archivo?</h3>
                <p style="color: #666; font-size: 0.95rem; margin-bottom: 25px; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="btn-cancel" style="background: white; border: 1px solid #ccc; color: #666; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-family: inherit;">Cancelar</button>
                    <button id="btn-confirm" style="background: #EF4444; border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-family: inherit; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.3);">Sí, eliminar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.querySelector('div').style.transform = 'scale(1)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            overlay.querySelector('div').style.transform = 'scale(0.9)';
            setTimeout(() => {
                if(document.body.contains(overlay)) document.body.removeChild(overlay);
                resolve(result);
            }, 200);
        };

        const btnC = document.getElementById('btn-cancel');
        const btnO = document.getElementById('btn-confirm');
        if(btnC) btnC.onclick = () => close(false);
        if(btnO) btnO.onclick = () => close(true);
        overlay.onclick = (e) => { if(e.target === overlay) close(false); };
    });
}


// =========================================================
// 3. LÓGICA DE LA APLICACIÓN
// =========================================================
let auth, db, googleProvider;
let currentUser = null;
let pendingPlan = null; 
let authMode = 'login';

// Funciones Auxiliares UI Globales
window.closeBanner = function() {
    const banner = document.getElementById('system-alert-banner');
    const nav = document.getElementById('navbar');
    const appLayout = document.getElementById('pida-app-layout');
    
    if(banner) banner.classList.add('hidden');
    document.body.style.marginTop = '0px';
    if (nav) nav.style.top = '0px';
    if (appLayout) appLayout.style.top = '0px';
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

    // UTILIDADES
    const Utils = {
        sanitize(html) { return DOMPurify.sanitize(html); },
        getTimestampedFilename(title) { const now=new Date(); return `${(title||"Doc").replace(/[^a-zA-Z0-9]/g,"")}_${now.getTime()}`; },
        getRawText(html) { const t=document.createElement('div'); t.innerHTML=html; return t.innerText||""; },
        async getHeaders(user) { 
            try { 
                const t = await user.getIdToken(); 
                return { 
                    'Authorization': 'Bearer ' + t,
                    'Content-Type': 'application/json' 
                }; 
            } catch { return null; } 
        }
    };

    const Exporter = {
        // Función para limpiar símbolos de Markdown (**, ##, etc) para que se lea bien en papel
        cleanText(text) {
            if (!text) return "";
            return text
                .replace(/\*\*/g, "")      // Quitar negritas markdown
                .replace(/__/g, "")        // Quitar cursivas markdown
                .replace(/##/g, "")        // Quitar headers markdown
                .replace(/^\* /gm, "• ")   // Convertir viñetas markdown en puntos
                .replace(/\[/g, "(")       // Cambiar corchetes por paréntesis
                .replace(/\]/g, ")");
        },

        async downloadPDF(fname, title, content) { 
            const doc = new window.jspdf.jsPDF(); 
            const margin = 15;
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const maxWidth = pageWidth - (margin * 2);
            let y = 20; // Posición vertical inicial

            // --- ENCABEZADO ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(29, 53, 87); // Azul PIDA
            doc.text(title || "Documento PIDA", margin, y);
            
            y += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el: ${new Date().toLocaleDateString()} - pida-ai.com`, margin, y);
            
            y += 15; // Espacio antes del contenido
            doc.setDrawColor(200);
            doc.line(margin, y - 5, pageWidth - margin, y - 5); // Línea separadora

            // Preparar mensajes
            let messages = [];
            if(Array.isArray(content)){
                messages = content;
            } else {
                messages = [{ role: 'system', content: content }];
            }

            // --- CUERPO DEL DOCUMENTO ---
            messages.forEach(msg => {
                // 1. Verificar si cabe el Título del Rol, si no, nueva página
                if (y > pageHeight - 30) { doc.addPage(); y = 20; }

                // 2. Escribir Nombre del Rol (PIDA o INVESTIGADOR)
                const isPida = msg.role === 'model';
                const roleName = isPida ? "PIDA" : "INVESTIGADOR";
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                if (isPida) doc.setTextColor(29, 53, 87); // Azul para PIDA
                else doc.setTextColor(50); // Gris oscuro para usuario
                
                doc.text(roleName, margin, y);
                y += 6;

                // 3. Procesar y Escribir el Texto
                doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                doc.setTextColor(0); // Negro

                const cleanContent = this.cleanText(msg.content);
                const lines = doc.splitTextToSize(cleanContent, maxWidth);

                // Verificar espacio para el texto
                // Si el bloque es muy grande, calculamos cuánto cabe
                if (y + (lines.length * 5) > pageHeight - 15) {
                    // Imprimir línea por línea para manejar el salto de página
                    lines.forEach(line => {
                        if (y > pageHeight - 15) { doc.addPage(); y = 20; }
                        doc.text(line, margin, y);
                        y += 5; // Interlineado
                    });
                } else {
                    // Si cabe todo el bloque
                    doc.text(lines, margin, y);
                    y += (lines.length * 5);
                }

                y += 10; // Espacio extra entre mensajes
            });

            doc.save(fname+".pdf"); 
        },

        async downloadDOCX(fname, title, content) { 
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx; 
            
            // Preparar los párrafos
            const docChildren = [];

            // Título Principal
            docChildren.push(
                new Paragraph({
                    text: title || "Reporte PIDA",
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 }
                })
            );

            let messages = Array.isArray(content) ? content : [{ role: 'system', content: content }];

            messages.forEach(msg => {
                const isPida = msg.role === 'model';
                const roleName = isPida ? "PIDA" : "INVESTIGADOR";
                const roleColor = isPida ? "1D3557" : "444444"; // Hex colors

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
                        spacing: { before: 200, after: 100 }
                    })
                );

                // Contenido
                const cleanContent = this.cleanText(msg.content);
                // Dividir por saltos de línea para respetar párrafos
                const paragraphs = cleanContent.split('\n');
                
                paragraphs.forEach(pText => {
                    if(pText.trim()) {
                        docChildren.push(
                            new Paragraph({
                                children: [ new TextRun({ text: pText.trim(), size: 22 }) ], // 11pt
                                spacing: { after: 100 }
                            })
                        );
                    }
                });
            });

            const doc = new Document({
                sections: [{ children: docChildren }]
            }); 

            Packer.toBlob(doc).then(b => {
                const u = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = u;
                a.download = fname + ".docx";
                a.click();
            }); 
        },

        downloadTXT(fname, title, content) { 
            let t = (title || "Documento PIDA") + "\n";
            t += "====================================\n\n";
            
            let messages = Array.isArray(content) ? content : [{ role: 'system', content: content }];
            
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

    // --- INTERACTIVIDAD BÁSICA ---
    const legalBtn = document.getElementById('open-legal-btn');
    const legalModal = document.getElementById('pida-legal-modal');
    if(legalBtn && legalModal){
        legalBtn.addEventListener('click', (e) => { e.preventDefault(); legalModal.classList.remove('hidden'); });
    }

    const track = document.getElementById('carouselTrack');
    if (track) {
        const dotsNav = document.getElementById('carouselDots');
        const dots = Array.from(dotsNav?.children || []);
        let currentSlide = 0;
        const slides = Array.from(track.children);
        function updateSlide(index) {
            track.style.transform = 'translateX(-' + (index * 100) + '%)';
            dots.forEach(d => d.classList.remove('active'));
            if(dots[index]) dots[index].classList.add('active');
            currentSlide = index;
        }
        setInterval(() => {
            let next = currentSlide + 1;
            if (next >= slides.length) next = 0;
            updateSlide(next);
        }, 5000); 
        dots.forEach((dot, index) => { dot.addEventListener('click', () => updateSlide(index)); });
    }

    // --- STRIPE RETURN HANDLER ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    if (paymentStatus) {
        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        if(banner && bannerText){
            if (paymentStatus === 'success') {
                banner.style.backgroundColor = '#10B981'; 
                bannerText.innerHTML = "¡Suscripción activada! Bienvenido a PIDA.";
                banner.classList.remove('hidden');
            } else if (paymentStatus === 'canceled') {
                banner.style.backgroundColor = '#6B7280'; 
                bannerText.innerText = "El proceso de pago fue cancelado.";
                banner.classList.remove('hidden');
            } else if (paymentStatus === 'error') {
                banner.style.backgroundColor = '#EF4444'; 
                bannerText.innerText = "Hubo un problema con el pago. Intenta de nuevo.";
                banner.classList.remove('hidden');
            }
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => window.closeBanner(), 8000);
        }
    }

    // Header Scroll
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) {
            if (window.scrollY > 20) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        }
    });

    // ==========================================
    // INICIALIZACIÓN DE FIREBASE
    // ==========================================
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(PIDA_CONFIG.FIREBASE);
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        const analytics = firebase.analytics();

        const remoteConfig = firebase.remoteConfig();
        remoteConfig.defaultConfig = { 'maintenance_mode_enabled': 'false', 'maintenance_details': '(Servicio no disponible temporalmente)' };
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            remoteConfig.settings.minimumFetchIntervalMillis = 10000; 
        }
        
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        if(banner && banner.classList.contains('hidden')) {
            db.collection('config').doc('alerts').onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.active) {
                        bannerText.textContent = data.message;
                        if(data.type === 'error') banner.style.backgroundColor = '#EF4444';
                        else if(data.type === 'info') banner.style.backgroundColor = '#1D3557';
                        else banner.style.backgroundColor = '#ff9800'; 
                        banner.classList.remove('hidden');
                    } else {
                        window.closeBanner();
                    }
                }
            }, (err) => console.log("Alerts unavailable:", err.code));
        }

        async function checkMaintenanceMode() {
            try {
                await remoteConfig.fetchAndActivate();
                const isMaintenanceEnabled = remoteConfig.getBoolean('maintenance_mode_enabled');
                const details = remoteConfig.getString('maintenance_details');
                
                const maintenanceMsg = document.getElementById('maintenance-message');
                const maintenanceDetails = document.getElementById('maintenance-details');
                const authSubmitBtn = document.getElementById('auth-submit-btn');
                
                if (isMaintenanceEnabled) {
                    if(maintenanceMsg) maintenanceMsg.style.display = 'block';
                    if(maintenanceDetails) maintenanceDetails.textContent = details;
                    if(authSubmitBtn) authSubmitBtn.disabled = true;
                    document.querySelectorAll('.plan-cta').forEach(btn => {
                        btn.disabled = true; btn.textContent = 'Mantenimiento';
                    });
                } else {
                    if(maintenanceMsg) maintenanceMsg.style.display = 'none';
                    if(authSubmitBtn) authSubmitBtn.disabled = false;
                }
            } catch (error) { console.warn("Remote Config Error:", error); }
        }
        checkMaintenanceMode();

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
                    console.error("Error lead:", error);
                    btn.textContent = originalText; btn.disabled = false;
                    status.textContent = 'Error de conexión.'; status.style.display = 'block'; status.style.color = '#EF4444';
                }
            });
        }
        
        const btnCorp = document.getElementById('btn-corp-contact');
        const btnCloseContact = document.getElementById('close-contact-btn');
        const contactModal = document.getElementById('contact-modal');
        if(btnCorp) btnCorp.addEventListener('click', (e)=>{ e.preventDefault(); contactModal.classList.remove('hidden'); });
        if(btnCloseContact) btnCloseContact.addEventListener('click', ()=>{ contactModal.classList.add('hidden'); });


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

    } catch (firebaseError) {
        console.error("Critical Firebase Error:", firebaseError);
    }

    async function checkAccessAuthorization(user) {
        const headers = await Utils.getHeaders(user);
        if (!headers) return false;
        try {
            const subRef = db.collection('customers').doc(user.uid).collection('subscriptions');
            const snap = await subRef.where('status', 'in', ['active', 'trialing']).get();
            if (!snap.empty) return true;
        } catch (e) { console.error("Stripe check error:", e); }

        try {
            const res = await fetch(`${PIDA_CONFIG.API_CHAT}/check-vip-access`, { method: 'POST', headers: headers });
            if (res.ok) {
                const r = await res.json();
                if (r.is_vip_user) return true;
            }
        } catch (e) { console.error("VIP check error:", e); }
        return false;
    }

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
            const msg = document.getElementById('login-message');
            
            msg.style.display = 'none'; btn.disabled = true;
            try {
                if (authMode === 'login') {
                    btn.textContent = 'Verificando...';
                    await auth.signInWithEmailAndPassword(email, pass);
                } else {
                    btn.textContent = 'Creando cuenta...';
                    await auth.createUserWithEmailAndPassword(email, pass);
                }
            } catch (error) {
                btn.disabled = false; msg.style.display = 'block';
                if (authMode === 'login') {
                    btn.textContent = 'Ingresar';
                    msg.textContent = (error.code === 'auth/wrong-password') ? "Contraseña incorrecta." : "Error: " + error.message;
                } else {
                    btn.textContent = 'Registrarse';
                    msg.textContent = error.message;
                }
            }
        });
    }

    const googleBtn = document.getElementById('google-login-btn');
    if(googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try { await auth.signInWithPopup(googleProvider); } 
            catch (error) { alert("Error Google: " + error.message); }
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

    async function detectUserCountry() {
        try {
            const r = await fetch('https://ipapi.co/json/');
            const d = await r.json();
            if (d.country_code === 'MX') {
                currentCurrency = 'MXN'; 
                const m = document.getElementById('price-val-monthly');
                const a = document.getElementById('price-val-annual');
                if (m) m.textContent = STRIPE_PRICES.basic.MXN.text;
                if (a) a.textContent = STRIPE_PRICES.pro.MXN.text;
            }
        } catch (e) { console.log("Ubicación no detectada (default USD)."); }
    }
    detectUserCountry();

    document.querySelectorAll('.plan-cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            const planKey = btn.getAttribute('data-plan');
            const priceId = STRIPE_PRICES[planKey]?.[currentCurrency]?.id;

            if (currentUser && priceId) {
                btn.textContent = "Procesando..."; btn.style.pointerEvents = "none";
                startCheckout(priceId);
                setTimeout(() => { btn.textContent = "Elegir"; btn.style.pointerEvents = "auto"; }, 8000);
            } else {
                pendingPlan = planKey;
                if (loginScreen) { loginScreen.style.display = 'flex'; window.switchAuthMode('register'); }
            }
        });
    });

    // ==========================================
    // APLICACIÓN PRINCIPAL (Chat & Analyzer)
    // ==========================================
    function runApp(user) {
        console.log("🚀 Iniciando aplicación para:", user.email);

        const dom = {
            navInv: document.getElementById('nav-investigador'),
            navAna: document.getElementById('nav-analizador'),
            viewInv: document.getElementById('view-investigador'),
            viewAna: document.getElementById('view-analizador'),
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
            accUpdate: document.getElementById('acc-update-btn'),
            accBilling: document.getElementById('acc-billing-btn'),
            accReset: document.getElementById('acc-reset-btn'),
            mobileMenuBtn: document.getElementById('nav-mobile-menu-btn'),
            mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
            mobileMenuProfile: document.getElementById('mobile-nav-profile'),
            mobileMenuLogout: document.getElementById('mobile-nav-logout')
        };

        // Estado
        let state = { currentView: 'investigador', conversations: [], currentChat: { id: null, title: '', messages: [] }, anaFiles: [], anaText: "", anaHistory: [] };

        // Setup Perfil
        if(dom.pName) dom.pName.textContent = user.displayName || 'Usuario';
        if(dom.pEmail) dom.pEmail.textContent = user.email;
        if(dom.pAvatar) dom.pAvatar.src = user.photoURL || 'img/PIDA_logo-P3-80.png';
        
        // Logout
        const doLogout = () => {
            auth.signOut().then(() => {
                window.location.reload();
            });
        };
        if(dom.pLogout) dom.pLogout.onclick = doLogout;
        if(dom.mobileMenuLogout) dom.mobileMenuLogout.onclick = doLogout;

        // Vistas
        function setView(view) {
            state.currentView = view;
            if(dom.navInv) dom.navInv.classList.toggle('active', view === 'investigador');
            if(dom.navAna) dom.navAna.classList.toggle('active', view === 'analizador');
            if(dom.viewInv) dom.viewInv.classList.toggle('hidden', view !== 'investigador');
            if(dom.viewAna) dom.viewAna.classList.toggle('hidden', view !== 'analizador');
            if(dom.viewAcc) dom.viewAcc.classList.toggle('hidden', view !== 'cuenta');
            
            const chatCtrls = document.getElementById('chat-controls');
            const anaCtrls = document.getElementById('analyzer-controls');
            const accCtrls = document.getElementById('account-controls');
            if(chatCtrls) chatCtrls.classList.toggle('hidden', view !== 'investigador');
            if(anaCtrls) anaCtrls.classList.toggle('hidden', view !== 'analizador');
            if(accCtrls) accCtrls.classList.toggle('hidden', view !== 'cuenta');

            if (view === 'investigador') loadChatHistory();
            if (view === 'analizador') loadAnaHistory();
        }

        if(dom.navInv) dom.navInv.onclick = () => setView('investigador');
        if(dom.navAna) dom.navAna.onclick = () => setView('analizador');
        const userInfoBtn = document.getElementById('sidebar-user-info-click');
        if(userInfoBtn) userInfoBtn.onclick = () => setView('cuenta');
        if(dom.pAvatar) dom.pAvatar.onclick = () => setView('cuenta');
        const homeLink = document.getElementById('app-home-link');
        if(homeLink) homeLink.onclick = (e) => { e.preventDefault(); setView('investigador'); };

        // Menú Móvil
        if (dom.mobileMenuBtn && dom.mobileMenuOverlay) {
            dom.mobileMenuBtn.onclick = (e) => { e.stopPropagation(); dom.mobileMenuOverlay.classList.remove('hidden'); };
            dom.mobileMenuOverlay.onclick = (e) => { if (e.target === dom.mobileMenuOverlay) dom.mobileMenuOverlay.classList.add('hidden'); };
            if (dom.mobileMenuProfile) dom.mobileMenuProfile.onclick = () => { setView('cuenta'); dom.mobileMenuOverlay.classList.add('hidden'); };
        }

        // --- FUNCIÓNES DE CARGA ---
        async function loadAnaHistory() {
            const h = await Utils.getHeaders(user);
            const list = document.getElementById('analyzer-history-list');
            if(!list) return;

            try {
                list.innerHTML = '<div style="padding:15px; text-align:center; color:#666;">Cargando...</div>';
                const r = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/`, { headers: h });
                if (!r.ok) throw new Error("Error API");
                
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
                    delBtn.style.color = '#EF4444'; 
                    delBtn.style.minWidth = '24px';
                    delBtn.style.border = 'none';
                    delBtn.style.background = 'transparent';
                    delBtn.style.cursor = 'pointer';
                    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;
                    
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const confirmado = await showCustomConfirm('Se eliminará este análisis.');
                        if(confirmado) {
                            await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { method: 'DELETE', headers: h });
                            loadAnaHistory(); 
                        }
                    };

                    item.appendChild(titleSpan);
                    item.appendChild(delBtn);
                    list.appendChild(item);
                });

            } catch(e) {
                console.error(e);
                list.innerHTML = '<div style="padding:10px; color:red; font-size:0.8em;">Error al cargar.</div>';
            }
        }

        const histBtn = document.getElementById('history-dropdown-btn');
        const histContent = document.getElementById('history-dropdown-content');
        const anaHistBtn = document.getElementById('analyzer-history-dropdown-btn');
        const anaHistContent = document.getElementById('analyzer-history-dropdown-content');

        if(histBtn && histContent) {
            histBtn.onclick = (e) => { 
                e.stopPropagation(); 
                histContent.classList.toggle('show'); 
                if(anaHistContent) anaHistContent.classList.remove('show');
            };
        }

        if(anaHistBtn && anaHistContent) {
            anaHistBtn.onclick = async (e) => { 
                e.stopPropagation(); 
                const isOpen = anaHistContent.classList.contains('show');
                if (!isOpen) {
                    await loadAnaHistory(); 
                    anaHistContent.classList.add('show');
                } else {
                    anaHistContent.classList.remove('show');
                }
                if(histContent) histContent.classList.remove('show'); 
            };
        }

        window.onclick = () => { 
            if(histContent) histContent.classList.remove('show'); 
            if(anaHistContent) anaHistContent.classList.remove('show'); 
        };

        // --- CHAT LOGIC ---

        function toggleChatButtons(show) {
            const ids = [
                'chat-download-txt-btn', 
                'chat-download-pdf-btn', 
                'chat-download-docx-btn'
                // Removed 'chat-export-actions' as it doesn't exist in HTML
            ];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = show ? 'inline-flex' : 'none';
            });
        }

        function renderChat(msg) {
            const d = document.createElement('div');
            d.className = `pida-bubble ${msg.role === 'user' ? 'user-message-bubble' : 'pida-message-bubble'}`;
            let safeContent = msg.content;
            if (msg.role === 'model') {
                safeContent = safeContent.replace(/(?:[\n\r\s]*)(?:\*\*|__)?(Fuente:)(?:\*\*|__)?/g, '\n\n<hr>\n\n<strong>$1</strong>');
            }
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
                        delBtn.style.cursor = 'pointer';
                        delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;
                        delBtn.onclick = async (e) => {
                            e.stopPropagation();
                            const confirmado = await showCustomConfirm('Esta acción no se puede deshacer.');
                            if(confirmado) {
                                await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${c.id}`, { method: 'DELETE', headers: h });
                                await loadChatHistory(); // Esperar a que recargue
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
                console.log("✅ Sesión creada en backend:", newConvo.id);
                loadChatHistory();
                return true;
            } catch (e) { 
                console.error("Error creando sesión:", e); 
                return false;
            }
        }

        async function sendChat() {
            const txt = dom.input.value.trim();
            if (!txt) return;

            if (!state.currentChat.id) {
                const success = await startBackendSession();
                if (!success) {
                    alert("No se pudo iniciar la conexión.");
                    return;
                }
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
            console.log("🔄 Preparando interfaz visual...");
            
            // Verificación de seguridad
            if (!dom.chatBox) {
                console.error("No se encontró el chatBox");
                return;
            }

            if (clearUI) { 
                dom.chatBox.innerHTML = ''; 
                if(dom.input) dom.input.value = ''; 
                state.currentChat = { id: null, title: '', messages: [] };
                
                const items = document.querySelectorAll('.pida-history-item');
                if(items) items.forEach(el => el.classList.remove('active'));

                toggleChatButtons(false);

                renderChat({
                    role: 'model',
                    content: "👋 **¡Hola! Soy PIDA, tu asistente jurídico.**\n\nEstoy aquí para apoyarte con análisis de casos, búsqueda de jurisprudencia y redacción legal.\n\n**¿Qué te gustaría preguntar hoy?**"
                });
            }
        }

        // --- VINCULACIÓN DE BOTONES (VERSIÓN FINAL SEGURA) ---
        
        // 1. Evitar envío del formulario (SOLUCIÓN CRÍTICA PARA EL BOTÓN ENVIAR)
        const pidaForm = document.getElementById('pida-form');
        if (pidaForm) {
            pidaForm.onsubmit = (e) => {
                e.preventDefault();
                sendChat();
            };
        }

        // 2. Botones de Chat
        const onNewChatClick = (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            console.log("🖱️ Clic en Nuevo Chat");
            handleNewChat(true);
        };

        const btnSidebar = document.getElementById('pida-new-chat-btn');
        if (btnSidebar) btnSidebar.onclick = onNewChatClick;

        const btnMobile = document.getElementById('new-chat-btn');
        if (btnMobile) btnMobile.onclick = onNewChatClick;

        const btnClear = document.getElementById('chat-clear-btn');
        if(btnClear) btnClear.onclick = onNewChatClick;
        
        // 3. Envío de Chat (Click y Enter)
        if (dom.sendBtn) dom.sendBtn.onclick = (e) => { 
            e.preventDefault(); 
            sendChat(); 
        };
        
        if (dom.input) dom.input.onkeydown = (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendChat(); 
            } 
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
                    <p>Sube tus archivos (PDF, DOCX) y escribe una instrucción clara. PIDA leerá el documento por ti.</p>
                    <hr>
                    <strong>Ejemplos de lo que puedes pedir:</strong>
                    <ul style="margin-top: 10px; padding-left: 20px; line-height: 1.6;">
                        <li>"Haz un resumen ejecutivo de este contrato."</li>
                        <li>"Identifica las cláusulas de rescisión y sus penalizaciones."</li>
                        <li>"Extrae una lista cronológica de los hechos en esta sentencia."</li>
                        <li>"¿Existen riesgos legales para mi cliente en este documento?"</li>
                    </ul>
                </div>
            `;
        }

        showAnalyzerWelcome();

        if(dom.anaBtn) {
            dom.anaBtn.onclick = async () => {
                if (!state.anaFiles.length) {
                    alert("Por favor, sube al menos un documento para analizar.");
                    return;
                }
                
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
                        method: 'POST', 
                        headers: { 'Authorization': 'Bearer ' + token }, 
                        body: fd
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
                                        
                                        const scrollContainer = dom.viewAna.querySelector('.pida-view-content');
                                        if(scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
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

        if (dom.anaInst) {
            dom.anaInst.placeholder = "Escribe aquí tu instrucción (Ej: 'Resume este contrato')...";
            dom.anaInst.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); 
                    if (dom.anaBtn) dom.anaBtn.click(); 
                }
            };
        }

        if(dom.analyzerClearBtn) {
            dom.analyzerClearBtn.onclick = () => {
                state.anaFiles = []; 
                state.anaText = ""; 
                renderFiles();
                dom.anaInst.value = ''; 
                showAnalyzerWelcome(); 
            };
        }

        const dlBtn = document.getElementById('chat-download-txt-btn');
        if(dlBtn) dlBtn.onclick = () => {
            Exporter.downloadTXT("Chat_"+Date.now(), "Chat PIDA", state.currentChat.messages);
        };

        const dlPdfBtn = document.getElementById('chat-download-pdf-btn');
        if(dlPdfBtn) dlPdfBtn.onclick = () => {
            Exporter.downloadPDF("Chat_"+Date.now(), "Chat PIDA", state.currentChat.messages);
        };
        
        if(dom.accUpdate) {
            dom.accUpdate.onclick = async () => {
                const f = document.getElementById('acc-firstname').value;
                const l = document.getElementById('acc-lastname').value;
                if(f || l) {
                    await user.updateProfile({ displayName: `${f} ${l}` });
                    dom.pName.textContent = `${f} ${l}`;
                    alert('Actualizado');
                }
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

        // ==========================================
        // INICIALIZACIÓN (AL CARGAR LA PÁGINA)
        // ==========================================
        
        setView('investigador');
        handleNewChat(true); 
        loadChatHistory();
    }

});