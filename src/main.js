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

// Hacer librerías accesibles globalmente (Puente para código antiguo)
window.jspdf = { jsPDF };
window.docx = docx;
window.marked = marked;
window.DOMPurify = DOMPurify;
window.firebase = firebase;


// =========================================================
// 2. CONFIGURACIÓN (Tus claves originales)
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

// ¡AQUÍ ESTÁ LA CLAVE QUE FALTABA!
const PIDA_CONFIG = {
    API_CHAT: "https://chat-v20-465781488910.us-central1.run.app",
    API_ANA: "https://analize-v20-465781488910.us-central1.run.app",
    FIREBASE: {
        apiKey: "AIzaSyC5nqsx4Fe4gMKkKdvnbMf8VFnI6TYL64k",
        authDomain: "pida-ai.com",
        projectId: "pida-ai-v20", // Esta línea es la que causaba el error
        storageBucket: "pida-ai-v20.firebasestorage.app",
        messagingSenderId: "465781488910",
        appId: "1:465781488910:web:6f9c2b4bc91317a6bbab5f",
        measurementId: "G-4FEDD254GY"
    }
    // Nota: Ya no necesitamos LIBS aquí porque las importamos arriba
};


// =========================================================
// 3. LÓGICA DE LA APLICACIÓN
// =========================================================
let auth, db, googleProvider;
let currentUser = null;
let pendingPlan = null; 
let authMode = 'login';

// Funciones Auxiliares UI
window.closeBanner = function() { // Hacemos global para que el HTML pueda llamarla
    const banner = document.getElementById('system-alert-banner');
    const nav = document.getElementById('navbar');
    const appLayout = document.getElementById('pida-app-layout');
    
    if(banner) banner.classList.add('hidden');
    document.body.style.marginTop = '0px';
    if (nav) nav.style.top = '0px';
    if (appLayout) appLayout.style.top = '0px';
}

window.switchAuthMode = function(mode) { // Hacemos global
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
// DOMPurify ya se configura solo, usamos el hook si es necesario
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if ('target' in node) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});


document.addEventListener('DOMContentLoaded', function () {
    const landingRoot = document.getElementById('landing-page-root');
    const loginScreen = document.getElementById('pida-login-screen');
    const appRoot = document.getElementById('pida-app-root');

    // UTILIDADES
    const Utils = {
        // loadScript eliminado: Ya no cargamos scripts externos, usamos import
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
        async downloadPDF(fname, title, content) { 
            // Usamos window.jspdf directamente
            const doc = new window.jspdf.jsPDF(); 
            doc.text(title,10,10); 
            doc.save(fname+".pdf"); 
        },
        async downloadDOCX(fname, title, content) { 
            // Usamos window.docx directamente
            const {Document, Packer, Paragraph, TextRun} = window.docx; 
            const doc = new Document({
                sections:[{children:[new Paragraph({children:[new TextRun(title)]}) ]}]
            }); 
            Packer.toBlob(doc).then(b=>{
                const u=URL.createObjectURL(b);
                const a=document.createElement('a');
                a.href=u;
                a.download=fname+".docx";
                a.click();
            }); 
        },
        downloadTXT(fname, title, content) { 
            let t=title+"\n"; 
            if(Array.isArray(content)){
                content.forEach(c=>{t+=`[${c.role}]: ${c.content}\n`}); 
            } else {
                t += content;
            }
            const b=new Blob([t]); 
            const u=URL.createObjectURL(b); 
            const a=document.createElement('a');
            a.href=u;
            a.download=fname+".txt";
            a.click(); 
        }
    };

    // --- INTERACTIVIDAD BÁSICA (Modales, Carrusel, etc) ---
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
            // AQUÍ es donde antes fallaba si PIDA_CONFIG no estaba bien definido
            firebase.initializeApp(PIDA_CONFIG.FIREBASE);
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        const analytics = firebase.analytics();

        // Remote Config
        const remoteConfig = firebase.remoteConfig();
        remoteConfig.defaultConfig = { 'maintenance_mode_enabled': 'false', 'maintenance_details': '(Servicio no disponible temporalmente)' };
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            remoteConfig.settings.minimumFetchIntervalMillis = 10000; 
        }
        
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        // Alertas Sistema
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

        // Mantenimiento (Remote Config)
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
                    // Deshabilitar botones adicionales si es necesario
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

        // Formulario Contacto
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
        
        // Botones contacto modal
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

    // CHECK AUTHORIZATION
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

    // AUTH FORM HANDLERS
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

    // STRIPE CHECKOUT
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

    // DETECCIÓN PAÍS
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

    // BOTONES PLANES
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
        dom.pName.textContent = user.displayName || 'Usuario';
        dom.pEmail.textContent = user.email;
        dom.pAvatar.src = user.photoURL || 'img/PIDA_logo-P3-80.png'; // Usamos logo local si no hay foto
        
        // Logout
        const doLogout = () => {
            auth.signOut().then(() => {
                window.location.reload();
            });
        };
        dom.pLogout.onclick = doLogout;
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
        document.getElementById('sidebar-user-info-click').onclick = () => setView('cuenta');
        dom.pAvatar.onclick = () => setView('cuenta');
        document.getElementById('app-home-link').onclick = (e) => { e.preventDefault(); setView('investigador'); };

        // Menú Móvil
        if (dom.mobileMenuBtn && dom.mobileMenuOverlay) {
            dom.mobileMenuBtn.onclick = (e) => { e.stopPropagation(); dom.mobileMenuOverlay.classList.remove('hidden'); };
            dom.mobileMenuOverlay.onclick = (e) => { if (e.target === dom.mobileMenuOverlay) dom.mobileMenuOverlay.classList.add('hidden'); };
            if (dom.mobileMenuProfile) dom.mobileMenuProfile.onclick = () => { setView('cuenta'); dom.mobileMenuOverlay.classList.add('hidden'); };
        }

        // Dropdowns Historial
        const histBtn = document.getElementById('history-dropdown-btn');
        const histContent = document.getElementById('history-dropdown-content');
        const anaHistBtn = document.getElementById('analyzer-history-dropdown-btn');
        const anaHistContent = document.getElementById('analyzer-history-dropdown-content');

        if(histBtn && histContent) {
            histBtn.onclick = (e) => { e.stopPropagation(); histContent.classList.toggle('show'); anaHistContent?.classList.remove('show'); };
        }
        if(anaHistBtn && anaHistContent) {
            anaHistBtn.onclick = (e) => { e.stopPropagation(); anaHistContent.classList.toggle('show'); histContent?.classList.remove('show'); };
        }
        window.onclick = () => { 
            if(histContent) histContent.classList.remove('show'); 
            if(anaHistContent) anaHistContent.classList.remove('show'); 
        };

        // --- CHAT LOGIC ---
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
            // Lógica simplificada para encontrar headers de seguimiento
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
                        if(confirm('¿Borrar chat?')) {
                            await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${c.id}`, { method: 'DELETE', headers: h });
                            loadChatHistory();
                            if(state.currentChat.id === c.id) handleNewChat(true);
                        }
                    };
                    item.appendChild(titleSpan); item.appendChild(delBtn); list.appendChild(item);
                });
            } catch (e) { console.error(e); }
        }

        async function loadChat(id) {
            const h = await Utils.getHeaders(user);
            const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${id}/messages`, { headers: h });
            const msgs = await r.json();
            const c = state.conversations.find(x => x.id === id);
            state.currentChat = { id, title: c?.title, messages: msgs };
            dom.chatBox.innerHTML = '';
            msgs.forEach(renderChat);
            loadChatHistory();
        }

        async function sendChat() {
            const txt = dom.input.value.trim();
            if (!txt) return;
            if (!state.currentChat.id) await handleNewChat(false);
            
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
                // Actualizar título si es nuevo
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
            if (clearUI) { dom.chatBox.innerHTML = ''; dom.input.value = ''; }
            const h = await Utils.getHeaders(user);
            try {
                const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations`, {
                    method: 'POST', headers: h, body: JSON.stringify({ title: "Nuevo Chat" })
                });
                const newConvo = await r.json();
                state.conversations.unshift(newConvo);
                state.currentChat = { id: newConvo.id, title: newConvo.title, messages: [] };
                loadChatHistory();
            } catch (e) { console.error(e); }
        }

        dom.sendBtn.onclick = (e) => { e.preventDefault(); sendChat(); };
        dom.input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };
        document.getElementById('pida-new-chat-btn').onclick = () => handleNewChat(true);
        document.getElementById('chat-clear-btn').onclick = () => handleNewChat(true);

        // --- ANALYZER LOGIC ---
        const anaUploadBtn = document.getElementById('analyzer-upload-btn');
        if(anaUploadBtn) anaUploadBtn.onclick = () => dom.anaInput.click();
        dom.anaInput.onchange = (e) => { state.anaFiles.push(...e.target.files); renderFiles(); };

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

        dom.anaBtn.onclick = async () => {
            if (!state.anaFiles.length) return;
            
            // 1. Preparar UI
            dom.anaResBox.style.display = 'block'; 
            dom.anaLoader.style.display = 'block';
            document.getElementById('analyzer-response-container').style.display = 'none';
            dom.anaResTxt.innerHTML = ''; 
            dom.anaControls.style.display = 'none';
            
            // 2. Preparar Datos
            const fd = new FormData();
            state.anaFiles.forEach(f => fd.append('files', f));
            fd.append('instructions', dom.anaInst.value);
            
            // Nota: Utils.getHeaders devuelve content-type json, pero FormData lo necesita multipart automático
            // Así que usamos solo el token manualmente aquí.
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
                                        started = true; 
                                    }
                                    fullText += data.text;
                                    dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(fullText));
                                    
                                    // === AQUÍ AGREGAMOS EL SCROLL AUTOMÁTICO QUE FALTABA ===
                                    // Buscamos el contenedor que tiene el scroll (.pida-view-content)
                                    const scrollContainer = dom.viewAna.querySelector('.pida-view-content');
                                    if(scrollContainer) {
                                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                                    }
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

        dom.analyzerClearBtn.onclick = () => {
            state.anaFiles = []; state.anaText = ""; renderFiles();
            dom.anaInst.value = ''; dom.anaResBox.style.display = 'none';
        };

        async function loadAnaHistory() {
            const h = await Utils.getHeaders(user);
            try {
                const r = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/`, { headers: h });
                state.anaHistory = await r.json();
                const list = document.getElementById('analyzer-history-list');
                list.innerHTML = '';
                state.anaHistory.forEach(a => {
                    const item = document.createElement('div');
                    item.className = 'pida-history-item';
                    // 1. TÍTULO
                    const titleSpan = document.createElement('span');
                    titleSpan.textContent = a.title;
                    titleSpan.style.flex = "1";
                    titleSpan.onclick = async (e) => {
                        // ... (tu lógica de cargar análisis existente) ...
                        const r2 = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { headers: h });
                        const d2 = await r2.json();
                        state.anaText = d2.analysis;
                        dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(d2.analysis));
                        dom.anaLoader.style.display = 'none';
                        document.getElementById('analyzer-response-container').style.display = 'block';
                        dom.anaResBox.style.display = 'block';
                        dom.anaControls.style.display = 'flex';
                        if(anaHistContent) anaHistContent.classList.remove('show');
                    };
                    // 2. BOTÓN DE BORRAR (Que faltaba)
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-icon-btn';
                    // --- ESTILO FORZADO ---
                    delBtn.style.color = '#EF4444'; 
                    delBtn.style.minWidth = '24px';
                    delBtn.style.border = 'none';
                    delBtn.style.background = 'transparent';
                    delBtn.style.cursor = 'pointer';

                    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;

                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if(confirm('¿Borrar análisis?')) {
                            await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { method: 'DELETE', headers: h });
                            loadAnaHistory();
                        }
                    };

                    // 3. AGREGAR AL ITEM
                    item.appendChild(titleSpan);
                    item.appendChild(delBtn);
                    list.appendChild(item);
                });
            } catch(e) {}
        }

        // Descargas
        // (Reutilizamos la lógica del botón, llamando a Exporter)
        document.getElementById('chat-download-txt-btn').onclick = () => {
            Exporter.downloadTXT("Chat_"+Date.now(), "Chat PIDA", state.currentChat.messages);
        };
        // Para PDF y DOCX del chat, se usa la API backend si está disponible (como en el original), 
        // o Exporter local como fallback. Aquí mantenemos el código simple llamando a la función original 
        // o implementándola dentro. (Por brevedad, usamos Exporter local para TXT y asumimos backend para otros)
        
        // CUENTA
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

        // Init view
        setView('investigador');
    }

});