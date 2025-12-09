// ------------- CONFIGURATION ZONE -------------
const STRIPE_ROLE_PRICES = {
    basic: 'price_1ScEcgGgaloBN5L8BQVnYeFl', 
    pro:   'price_1ScEeFGgaloBN5L8psSOfigs'
};

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
    },
    LIBS: {
        JSPDF: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        DOCX: 'https://unpkg.com/docx@8.2.2/build/index.umd.js'
    }
};
// ----------------------------------------------

// Global variables
let auth, db, googleProvider;
let currentUser = null;
let pendingPlan = null; 
let authMode = 'login'; // 'login' or 'register'

// Helper function for Banner
function closeBanner() {
    const banner = document.getElementById('system-alert-banner');
    const nav = document.getElementById('navbar');
    const appLayout = document.getElementById('pida-app-layout');
    
    banner.classList.add('hidden');
    document.body.style.marginTop = '0px';
    if (nav) nav.style.top = '0px';
    if (appLayout) appLayout.style.top = '0px';
}

// Auth Mode Switcher (Login vs Register)
function switchAuthMode(mode) {
    authMode = mode;
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-register');
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const submitBtn = document.getElementById('auth-submit-btn');
    const googleText = document.getElementById('google-text');
    const errMsg = document.getElementById('login-message');
    
    errMsg.style.display = 'none';

    if (mode === 'login') {
        btnLogin.classList.add('active');
        btnReg.classList.remove('active');
        title.textContent = 'Bienvenido de nuevo';
        desc.textContent = 'Accede para continuar tu investigación.';
        submitBtn.textContent = 'Ingresar';
        googleText.textContent = 'Entrar con Google';
    } else {
        btnLogin.classList.remove('active');
        btnReg.classList.add('active');
        title.textContent = 'Crear una cuenta';
        desc.textContent = 'Únete para acceder a PIDA.';
        submitBtn.textContent = 'Registrarse';
        googleText.textContent = 'Registrarse con Google';
    }
}

// Markdown config
if (typeof marked !== 'undefined') {
    marked.setOptions({ gfm: true, breaks: true, headerIds: false });
}
if (typeof DOMPurify !== 'undefined') {
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
        if ('target' in node) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const landingRoot = document.getElementById('landing-page-root');
    const loginScreen = document.getElementById('pida-login-screen');
    const appRoot = document.getElementById('pida-app-root');

    // ==========================================
    // 1. UTILIDADES (Movido arriba para alcance global)
    // ==========================================
    const Utils = {
        async loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) return resolve();
                const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
            });
        },
        sanitize(html) { return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html; },
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
        async downloadPDF(fname, title, content) { await Utils.loadScript(PIDA_CONFIG.LIBS.JSPDF); const doc=new window.jspdf.jsPDF(); doc.text(title,10,10); doc.save(fname+".pdf"); },
        async downloadDOCX(fname, title, content) { await Utils.loadScript(PIDA_CONFIG.LIBS.DOCX); const {Document,Packer,Paragraph,TextRun}=window.docx; const doc=new Document({sections:[{children:[new Paragraph({children:[new TextRun(title)]}) ]}]}); Packer.toBlob(doc).then(b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fname+".docx";a.click();}); },
        downloadTXT(fname, title, content) { let t=title+"\n"; content.forEach(c=>{t+=`[${c.role}]: ${c.content}\n`}); const b=new Blob([t]); const u=URL.createObjectURL(b); const a=document.createElement('a');a.href=u;a.download=fname+".txt";a.click(); }
    };

    // --- LEGAL MODAL LOGIC ---
    const legalBtn = document.getElementById('open-legal-btn');
    const legalModal = document.getElementById('pida-legal-modal');
    if(legalBtn && legalModal){
        legalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            legalModal.classList.remove('hidden');
        });
    }

    // --- TESTIMONIALS CAROUSEL LOGIC ---
    const track = document.getElementById('carouselTrack');
    if (track) {
        const slides = Array.from(track.children);
        const dotsNav = document.getElementById('carouselDots');
        const dots = Array.from(dotsNav.children);
        let currentSlide = 0;

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

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                updateSlide(index);
            });
        });
    }

    // --- STRIPE RETURN HANDLER ---
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    
    if (paymentStatus) {
        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        
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
        
        requestAnimationFrame(() => {
            const h = banner.offsetHeight;
            document.body.style.marginTop = h + 'px';
            const nav = document.getElementById('navbar');
            if(nav) nav.style.top = h + 'px';
        });
        
        setTimeout(() => closeBanner(), 8000);
    }

    // Header Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (nav) {
            if (window.scrollY > 20) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        }
    });

    // 2. Init Firebase
    try {
        if (!firebase.apps.length) firebase.initializeApp(PIDA_CONFIG.FIREBASE);
        const analytics = firebase.analytics();
        auth = firebase.auth();
        db = firebase.firestore();
        googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });

        // Alert System
        try {
            const banner = document.getElementById('system-alert-banner');
            const bannerText = document.getElementById('system-alert-text');
            const nav = document.getElementById('navbar');
            const appLayout = document.getElementById('pida-app-layout');

            if(banner.classList.contains('hidden')) {
                db.collection('config').doc('alerts').onSnapshot((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.active) {
                            bannerText.textContent = data.message;
                            if(data.type === 'error') banner.style.backgroundColor = '#EF4444';
                            else if(data.type === 'info') banner.style.backgroundColor = '#1D3557';
                            else banner.style.backgroundColor = '#ff9800'; 
                            
                            banner.classList.remove('hidden');
                            requestAnimationFrame(() => {
                                const height = banner.offsetHeight;
                                document.body.style.marginTop = height + 'px'; 
                                if(nav) nav.style.top = height + 'px';
                                if(appLayout) {
                                    appLayout.style.top = height + 'px';
                                    appLayout.style.height = `calc(100vh - ${height}px)`;
                                }
                            });
                        } else {
                            closeBanner();
                        }
                    }
                }, (error) => { console.log("Alerts unavailable:", error.code); });
            }
        } catch (e) { console.warn("Error initiating alerts:", e); }

        // Auth State & Transition Logic
        const globalLoader = document.getElementById('pida-global-loader');
        
        const hideLoader = () => {
            if(globalLoader) {
                globalLoader.classList.add('fade-out');
                setTimeout(() => {
                    globalLoader.style.display = 'none';
                }, 600); 
            }
        };

        auth.onAuthStateChanged(async function (user) {
            currentUser = user;
            
            if (user) {
                loginScreen.style.display = 'none';
                
                // CHECK ACCESS AUTHORIZATION
                const accessGranted = await checkAccessAuthorization(user);

                if (accessGranted) {
                    landingRoot.style.display = 'none';
                    appRoot.style.display = 'block';
                    runApp(user); 
                    requestAnimationFrame(() => hideLoader());

                } else {
                    landingRoot.style.display = 'block';
                    appRoot.style.display = 'none';
                    
                    if (pendingPlan) {
                        startCheckout(STRIPE_ROLE_PRICES[pendingPlan]);
                        pendingPlan = null; 
                    } else {
                        window.location.hash = 'planes';
                    }
                    hideLoader();
                }
            } else {
                landingRoot.style.display = 'block';
                appRoot.style.display = 'none';
                hideLoader();
            }
        });

    } catch (firebaseError) {
        console.error("Critical Firebase Error:", firebaseError);
    }

    // --- ACCESO CHECK FUNCTION ---
    async function checkAccessAuthorization(user) {
        console.log("Verificando acceso para:", user.email);
        // AHORA UTILS ESTÁ DEFINIDO Y FUNCIONARÁ
        const headers = await Utils.getHeaders(user);
        if (!headers) return false;

        // 1. Verificar Suscripción de Pago
        try {
            const subscriptionsRef = db.collection('customers')
                .doc(user.uid)
                .collection('subscriptions');

            const snapshot = await subscriptionsRef
                .where('status', 'in', ['active', 'trialing'])
                .get();

            if (!snapshot.empty) {
                console.log("Acceso Concedido: Suscripción activa encontrada.");
                return true;
            }
        } catch (error) {
            console.error("Error al verificar Stripe:", error);
        }

        // 2. Verificar Acceso VIP/Admin
        try {
            console.log("Verificando acceso VIP/Admin a través de Cloud Run...");

            const response = await fetch(`${PIDA_CONFIG.API_CHAT}/check-vip-access`, {
                method: 'POST', 
                headers: headers
            });

            if (!response.ok) return false;

            const result = await response.json();

            if (result.is_vip_user) {
                console.log("Acceso Concedido: Usuario VIP/Admin detectado por el backend.");
                return true;
            }

        } catch (error) {
            console.error("Error durante la verificación VIP:", error);
            return false;
        }

        console.log("Acceso Denegado: No se encontró suscripción activa ni estatus VIP/Admin.");
        return false;
    }

    // UI Handlers (Login)
    document.querySelectorAll('.trigger-login').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginScreen) loginScreen.style.display = 'flex';
            switchAuthMode('login'); 
        });
    });

    // HANDLE AUTH FORM
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button');
        const msg = document.getElementById('login-message');
        
        msg.style.display = 'none';
        btn.disabled = true;
        
        try {
            if (authMode === 'login') {
                btn.textContent = 'Verificando...';
                await auth.signInWithEmailAndPassword(email, pass);
            } else {
                btn.textContent = 'Creando cuenta...';
                await auth.createUserWithEmailAndPassword(email, pass);
            }
        } catch (error) {
            btn.disabled = false;
            msg.style.display = 'block';
            
            if (authMode === 'login') {
                btn.textContent = 'Ingresar';
                if (error.code === 'auth/wrong-password') {
                    msg.textContent = "Contraseña incorrecta. Intenta de nuevo.";
                } else {
                    switchAuthMode('register');
                    msg.textContent = "¡Bienvenido! No encontramos tu cuenta. Por favor, regístrate.";
                }
            } else {
                btn.textContent = 'Registrarse';
                if (error.code === 'auth/email-already-in-use') {
                    switchAuthMode('login');
                    msg.textContent = "Ya tienes una cuenta registrada. Por favor, ingresa tu contraseña.";
                } else if (error.code === 'auth/weak-password') {
                    msg.textContent = "La contraseña es muy débil (mínimo 6 caracteres).";
                } else {
                    msg.textContent = "Error al crear cuenta: " + error.message;
                }
            }
        }
    });

    document.getElementById('google-login-btn').addEventListener('click', async () => {
        const msg = document.getElementById('login-message');
        msg.style.display = 'none';
        try { await auth.signInWithPopup(googleProvider); } 
        catch (error) { msg.style.display = 'block'; msg.textContent = "Error Google: " + error.message; }
    });

    // CHECKOUT LOGIC
    async function startCheckout(priceId) {
        if (!currentUser) {
            loginScreen.style.display = 'flex';
            switchAuthMode('register'); 
            return;
        }
        
        const banner = document.getElementById('system-alert-banner');
        const bannerText = document.getElementById('system-alert-text');
        
        try {
            const baseUrl = window.location.origin + window.location.pathname;
            const successUrl = `${baseUrl}?payment_status=success`;
            const cancelUrl = `${baseUrl}?payment_status=canceled`;

            const docRef = await db.collection('customers')
                .doc(currentUser.uid)
                .collection('checkout_sessions')
                .add({
                    price: priceId,
                    trial_period_days: 5, // 5 días de prueba gratis
                    success_url: successUrl,
                    cancel_url: cancelUrl,
                    allow_promotion_codes: true,
                    metadata: { source: 'web_app_v7' }
                });

            docRef.onSnapshot((snap) => {
                const { error, url } = snap.data();
                
                if (error) {
                    banner.style.backgroundColor = '#EF4444';
                    bannerText.innerText = `Error de facturación: ${error.message}`;
                    banner.classList.remove('hidden');
                    document.querySelectorAll('.plan-cta').forEach(b => {
                        b.textContent = b.getAttribute('data-original-text') || 'Elegir';
                        b.style.pointerEvents = "auto";
                        b.style.opacity = "1";
                    });
                }
                
                if (url) {
                    window.location.assign(url);
                }
            });
        } catch (error) {
            console.error("Checkout Error:", error);
            banner.style.backgroundColor = '#EF4444';
            bannerText.innerText = "Error de conexión. Verifica tu internet.";
            banner.classList.remove('hidden');
        }
    }

    document.querySelectorAll('.plan-cta').forEach(btn => {
        btn.setAttribute('data-original-text', btn.textContent);
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const planKey = btn.getAttribute('data-plan');

            if (currentUser) {
                if (STRIPE_ROLE_PRICES[planKey]) {
                    btn.textContent = "Iniciando Stripe...";
                    btn.style.opacity = "0.7";
                    btn.style.pointerEvents = "none";
                    
                    startCheckout(STRIPE_ROLE_PRICES[planKey]);
                    
                    setTimeout(() => {
                        btn.textContent = btn.getAttribute('data-original-text');
                        btn.style.opacity = "1";
                        btn.style.pointerEvents = "auto";
                    }, 10000);
                }
            } else {
                pendingPlan = planKey;
                loginScreen.style.display = 'flex';
                switchAuthMode('register');
            }
        });
    });

    // --- MAIN APP RUNNER ---
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
            accBilling: document.getElementById('acc-billing-btn'),
            accUpdate: document.getElementById('acc-update-btn'),
            accFirst: document.getElementById('acc-firstname'),
            accLast: document.getElementById('acc-lastname'),
            accReset: document.getElementById('acc-reset-btn'),
            accNotify: document.getElementById('account-notification-area'),
            chatClearBtn: document.getElementById('chat-clear-btn'),
            newChatBtn: document.getElementById('pida-new-chat-btn'),
            historyList: document.getElementById('pida-history-list'),
            historyBtn: document.getElementById('history-dropdown-btn'),
            historyContent: document.getElementById('history-dropdown-content'),
            anaUpload: document.getElementById('analyzer-upload-btn'),
            anaHistBtn: document.getElementById('analyzer-history-dropdown-btn'),
            anaHistContent: document.getElementById('analyzer-history-dropdown-content'),
            anaHistList: document.getElementById('analyzer-history-list'),
            dlChatPdf: document.getElementById('chat-download-pdf-btn'),
            dlChatDoc: document.getElementById('chat-download-docx-btn'),
            dlChatTxt: document.getElementById('chat-download-txt-btn'),
            dlAnaPdf: document.getElementById('analyzer-download-pdf-btn'),
            dlAnaDoc: document.getElementById('analyzer-download-docx-btn'),
            dlAnaTxt: document.getElementById('analyzer-download-txt-btn'),
            sidebarUser: document.getElementById('sidebar-user-info-click')
        };

        let state = { currentView: 'investigador', conversations: [], currentChat: { id: null, title: '', messages: [] }, anaFiles: [], anaText: "", anaHistory: [] };

        dom.pName.textContent = user.displayName || 'Usuario';
        dom.pEmail.textContent = user.email;
        dom.pAvatar.src = user.photoURL || 'img/PIDA_logo-P3-80.png';
        
        dom.pLogout.onclick = () => {
            auth.signOut().then(() => {
                document.getElementById('pida-app-root').style.display = 'none';
                document.getElementById('landing-page-root').style.display = 'block';
                window.scrollTo(0,0);
                currentUser = null;
            });
        };
        
        document.getElementById('app-home-link').onclick = (e) => { e.preventDefault(); setView('investigador'); };

        function setView(view) {
            state.currentView = view;
            dom.navInv.classList.toggle('active', view === 'investigador');
            dom.navAna.classList.toggle('active', view === 'analizador');
            dom.viewInv.classList.toggle('hidden', view !== 'investigador');
            dom.viewAna.classList.toggle('hidden', view !== 'analizador');
            dom.viewAcc.classList.toggle('hidden', view !== 'cuenta');
            document.getElementById('chat-controls').classList.toggle('hidden', view !== 'investigador');
            document.getElementById('analyzer-controls').classList.toggle('hidden', view !== 'analizador');
            document.getElementById('account-controls').classList.toggle('hidden', view !== 'cuenta');
            if (view === 'investigador') loadChatHistory();
            if (view === 'analizador') loadAnaHistory();
        }

        dom.navInv.onclick = () => setView('investigador');
        dom.navAna.onclick = () => setView('analizador');
        dom.sidebarUser.onclick = () => setView('cuenta');
        dom.pAvatar.onclick = () => setView('cuenta');

        function toggleDrop(content) {
            const show = content.classList.contains('show');
            dom.historyContent.classList.remove('show');
            dom.anaHistContent.classList.remove('show');
            if (!show) content.classList.add('show');
        }
        dom.historyBtn.onclick = (e) => { e.stopPropagation(); toggleDrop(dom.historyContent); };
        dom.anaHistBtn.onclick = (e) => { e.stopPropagation(); toggleDrop(dom.anaHistContent); };
        window.onclick = () => { dom.historyContent.classList.remove('show'); dom.anaHistContent.classList.remove('show'); };

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
            return d;
        }

        function renderFollowUpQuestions(messageElement) {
            const headings = Array.from(messageElement.querySelectorAll("h2, h3"));
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
                    followUpHeading.remove(); list.remove(); messageElement.appendChild(card);
                }
            }
        }

        // --- REAL CHAT LOGIC ---
        async function loadChatHistory() {
            const h = await Utils.getHeaders(user);
            if (!h) return;
            try {
                const r = await fetch(`${PIDA_CONFIG.API_CHAT}/conversations`, { headers: h });
                state.conversations = await r.json();
                dom.historyList.innerHTML = '';
                state.conversations.forEach(c => {
                    const item = document.createElement('div');
                    item.className = `pida-history-item ${c.id === state.currentChat.id ? 'active' : ''}`;
                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'pida-history-item-title';
                    titleSpan.textContent = c.title;
                    titleSpan.style.flex = "1";
                    titleSpan.onclick = (e) => { e.stopPropagation(); loadChat(c.id); toggleDrop(dom.historyContent); };
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-icon-btn';
                    delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${c.id}`, { method: 'DELETE', headers: h });
                        if (state.currentChat.id === c.id) {
                            state.currentChat = { id: null, title: '', messages: [] };
                            dom.chatBox.innerHTML = '';
                        }
                        loadChatHistory();
                    };
                    item.appendChild(titleSpan);
                    item.appendChild(delBtn);
                    dom.historyList.appendChild(item);
                });
                if (!state.currentChat.id && state.conversations.length) loadChat(state.conversations[0].id);
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
                let isFirstChunk = true;
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
                                    if (isFirstChunk) { botBubble.innerHTML = ''; isFirstChunk = false; }
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
                    const t = txt.substring(0, 30);
                    await fetch(`${PIDA_CONFIG.API_CHAT}/conversations/${state.currentChat.id}/title`, {
                        method: 'PATCH', headers: h, body: JSON.stringify({ title: t })
                    });
                    loadChatHistory();
                }
            } catch (error) {
                botBubble.innerHTML = "<span style='color:red'>Error de conexión. Intente nuevamente.</span>";
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
                if (clearUI) {
                    const sysMsg = document.createElement('div');
                    sysMsg.style.textAlign = 'center'; sysMsg.style.color = '#999'; sysMsg.style.margin = '20px 0'; sysMsg.style.fontSize = '0.85rem';
                    sysMsg.innerText = 'Nueva conversación iniciada';
                    dom.chatBox.appendChild(sysMsg);
                }
            } catch (e) { console.error(e); }
        }

        dom.sendBtn.onclick = (e) => { e.preventDefault(); sendChat(); };
        dom.input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };
        dom.newChatBtn.onclick = () => handleNewChat(true);
        dom.chatClearBtn.onclick = () => handleNewChat(true);
        
        // --- REAL ANALYZER LOGIC ---
        dom.anaUpload.onclick = () => dom.anaInput.click();
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

        async function analyze() {
            if (!state.anaFiles.length) return;
            dom.anaResBox.style.display = 'block';
            dom.anaLoader.style.display = 'block';
            document.getElementById('analyzer-response-container').style.display = 'none';
            dom.anaResTxt.innerHTML = ''; 
            dom.anaControls.style.display = 'none';
            const fd = new FormData();
            state.anaFiles.forEach(f => fd.append('files', f));
            fd.append('instructions', dom.anaInst.value);
            const h = await Utils.getHeaders(user, null);
            try {
                const r = await fetch(`${PIDA_CONFIG.API_ANA}/analyze/`, {
                    method: 'POST', headers: { 'Authorization': h['Authorization'] }, body: fd
                });
                if (!r.ok) throw new Error("Error en la petición");
                const reader = r.body.getReader();
                const decoder = new TextDecoder();
                let fullText = "";
                let isFirstChunk = true;
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
                                    if (isFirstChunk) { 
                                        dom.anaLoader.style.display = 'none'; 
                                        document.getElementById('analyzer-response-container').style.display = 'block';
                                        isFirstChunk = false; 
                                    }
                                    fullText += data.text;
                                    dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(fullText));
                                    const scrollContainer = dom.viewAna.querySelector('.pida-view-content');
                                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
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
                document.getElementById('analyzer-response-container').style.display = 'block';
                dom.anaResTxt.innerHTML = `<span style='color:red'>Error al analizar: ${e.message}</span>`;
            }
        }

        dom.anaBtn.onclick = analyze;
        dom.analyzerClearBtn.onclick = () => {
            state.anaFiles = []; state.anaText = ""; renderFiles();
            dom.anaInst.value = ''; dom.anaResBox.style.display = 'none'; dom.anaControls.style.display = 'none';
        };

        async function loadAnaHistory() {
            const h = await Utils.getHeaders(user);
            const r = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/`, { headers: h });
            state.anaHistory = await r.json();
            dom.anaHistList.innerHTML = '';
            state.anaHistory.forEach(a => {
                const item = document.createElement('div');
                item.className = 'pida-history-item';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'pida-history-item-title';
                titleSpan.textContent = a.title;
                titleSpan.style.flex = "1";
                titleSpan.onclick = async (e) => {
                    e.stopPropagation();
                    const r2 = await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { headers: h });
                    const d2 = await r2.json();
                    state.anaText = d2.analysis;
                    dom.anaResTxt.innerHTML = Utils.sanitize(marked.parse(d2.analysis));
                    dom.anaLoader.style.display = 'none';
                    document.getElementById('analyzer-response-container').style.display = 'block';
                    dom.anaResBox.style.display = 'block';
                    dom.anaControls.style.display = 'flex';
                    toggleDrop(dom.anaHistContent);
                };
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-icon-btn';
                delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`;
                delBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await fetch(`${PIDA_CONFIG.API_ANA}/analysis-history/${a.id}`, { method: 'DELETE', headers: h });
                    loadAnaHistory();
                };
                item.appendChild(titleSpan);
                item.appendChild(delBtn);
                dom.anaHistList.appendChild(item);
            });
        }

        //Email Reset Password
        dom.accReset.onclick = () => {
            if (confirm("¿Enviar correo para restablecer contraseña a " + user.email + "?")) {
                auth.sendPasswordResetEmail(user.email)
                    .then(() => { alert("✅ Correo enviado. Revisa tu bandeja de entrada (y spam)."); })
                    .catch((error) => { console.error(error); alert("❌ Error: " + error.message); });
            }
        };

        // DOWNLOAD CHAT (BACKEND)
        async function downloadChatFromBackend(format) {
            if (!state.currentChat || !state.currentChat.messages || state.currentChat.messages.length === 0) {
                return alert("No hay conversación para descargar.");
            }

            const btn = format === 'pdf' ? dom.dlChatPdf : dom.dlChatDoc;
            const originalText = btn.textContent;
            btn.textContent = "Generando...";
            btn.disabled = true;

            try {
                let chatContent = "";
                state.currentChat.messages.forEach(msg => {
                    const role = msg.role === 'user' ? 'Usuario' : 'PIDA';
                    let cleanContent = msg.content || "";
                    chatContent += `**${role}**:\n${cleanContent}\n\n`;
                });

                const title = state.currentChat.title || "Historial de Chat";
                const fd = new FormData();
                fd.append('chat_text', chatContent);
                fd.append('title', title);
                fd.append('file_format', format);

                let token = "";
                if (auth.currentUser) token = await auth.currentUser.getIdToken();

                const response = await fetch(`${PIDA_CONFIG.API_CHAT}/download-chat`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: fd
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Error del servidor: ${errText}`);
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const contentDisp = response.headers.get('Content-Disposition');
                let fileName = `PIDA_Chat_${new Date().getTime()}.${format}`;
                if (contentDisp && contentDisp.includes('filename=')) {
                    fileName = contentDisp.split('filename=')[1].replace(/['"]/g, '');
                }
                
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

            } catch (e) {
                console.error("Error descarga chat:", e);
                alert("Error al generar el documento: " + e.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        dom.dlChatPdf.onclick = () => downloadChatFromBackend('pdf');
        dom.dlChatDoc.onclick = () => downloadChatFromBackend('docx');
        
        dom.dlChatTxt.onclick = () => { 
            const t = state.currentChat.title || "Chat"; 
            Exporter.downloadTXT(Utils.getTimestampedFilename(t), t, state.currentChat.messages); 
        };

        // DOWNLOAD ANALYSIS (BACKEND)
        async function downloadAnalysisFromBackend(format) {
            if (!state.anaText) return alert("No hay análisis para descargar.");
            
            const btn = format === 'pdf' ? dom.dlAnaPdf : dom.dlAnaDoc;
            const originalText = btn.textContent;
            btn.textContent = "Generando...";
            btn.disabled = true;

            try {
                const fd = new FormData();
                fd.append('analysis_text', state.anaText);
                fd.append('instructions', dom.anaInst.value || "Resultados del Análisis");
                fd.append('file_format', format);

                const token = await currentUser.getIdToken();
                
                const response = await fetch(`${PIDA_CONFIG.API_ANA}/download-analysis`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: fd
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Error del servidor: ${errText}`);
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const contentDisp = response.headers.get('Content-Disposition');
                let fileName = `PIDA_Analisis_${new Date().getTime()}.${format}`;
                if (contentDisp && contentDisp.includes('filename=')) {
                    fileName = contentDisp.split('filename=')[1].replace(/['"]/g, '');
                }
                
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

            } catch (e) {
                console.error(e);
                alert("Error al descargar: " + e.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        dom.dlAnaPdf.onclick = () => downloadAnalysisFromBackend('pdf');
        dom.dlAnaDoc.onclick = () => downloadAnalysisFromBackend('docx');

        dom.dlAnaTxt.onclick = () => {
            if (!state.anaText) return;
            const content = `INSTRUCCIONES:\n${dom.anaInst.value}\n\n----------------\nANÁLISIS:\n\n${state.anaText}`;
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = Utils.getTimestampedFilename("Analisis") + ".txt";
            a.click();
        };
        
        // UPDATE NAME
        dom.accUpdate.onclick = async () => {
            const firstName = dom.accFirst.value.trim();
            const lastName = dom.accLast.value.trim();

            const showQuietNotification = (msg, type) => {
                dom.accNotify.innerHTML = `<div class="pida-notification ${type}">${msg}</div>`;
                setTimeout(() => { dom.accNotify.innerHTML = ''; }, 3000);
            };

            if (!firstName && !lastName) {
                showQuietNotification("Ingresa un nombre para actualizar.", "error");
                return;
            }

            const newDisplayName = `${firstName} ${lastName}`.trim();
            const originalText = dom.accUpdate.textContent;
            dom.accUpdate.textContent = "Guardando...";
            dom.accUpdate.disabled = true;

            try {
                await user.updateProfile({ displayName: newDisplayName });
                dom.pName.textContent = newDisplayName;
                showQuietNotification("Nombre actualizado correctamente.", "success");
            } catch (error) {
                console.error("Error:", error);
                showQuietNotification("No se pudo actualizar. Intenta de nuevo.", "error");
            } finally {
                dom.accUpdate.textContent = originalText;
                dom.accUpdate.disabled = false;
            }
        };
        
        // BILLING PORTAL
         dom.accBilling.onclick = async () => {
            dom.accBilling.innerText = "Cargando...";
            try {
                const fn = firebase.functions().httpsCallable('ext-firestore-stripe-payments-createPortalLink');
                const { data } = await fn({ returnUrl: window.location.href });
                window.location.assign(data.url);
            } catch { alert('Error conectando a Stripe'); dom.accBilling.innerText = "Portal de Facturación"; }
        };


        // ==========================================
        // 3. LÓGICA DE CONTACTO (GUARDAR EN FIRESTORE)
        // ==========================================
        const contactModal = document.getElementById('contact-modal');
        const btnCorp = document.getElementById('btn-corp-contact');
        const btnCloseContact = document.getElementById('close-contact-btn');
        const contactForm = document.getElementById('contact-form');
        const contactStatus = document.getElementById('contact-status');

        // Abrir modal
        if(btnCorp) {
            btnCorp.addEventListener('click', (e) => {
                e.preventDefault();
                contactModal.classList.remove('hidden');
                contactModal.style.display = 'flex';
            });
        }

        // Cerrar modal
        if(btnCloseContact) {
            btnCloseContact.addEventListener('click', (e) => {
                e.preventDefault();
                contactModal.classList.add('hidden');
                contactModal.style.display = 'none'; 
            });
        }

        // Guardar en Firestore
        if(contactForm) {
            contactForm.addEventListener('submit', async function(event) {
                event.preventDefault();
                const btn = document.getElementById('contact-submit-btn');
                const originalText = btn.textContent;
            
                // Recolectar datos
                const leadData = {
                    name: document.getElementById('contact-name').value,
                    company: document.getElementById('contact-company').value,
                    email: document.getElementById('contact-email').value,
                    phone: document.getElementById('contact-phone').value,
                    message: document.getElementById('contact-message').value,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Marca de tiempo exacta
                    status: 'nuevo' // Para tu panel de admin futuro
                };

                btn.textContent = 'Guardando...';
                btn.disabled = true;
                contactStatus.style.display = 'none';

                try {
                    // GUARDADO DIRECTO A FIRESTORE
                    // No requiere backend, usa el SDK cliente
                    await db.collection('leads_corporativos').add(leadData);

                    // Éxito visual
                    btn.textContent = '¡Enviado!';
                    contactStatus.textContent = 'Datos recibidos. Te contactaremos pronto.';
                    contactStatus.style.color = '#10B981';
                    contactStatus.style.display = 'block';
                
                    setTimeout(() => {
                        contactModal.classList.add('hidden');
                        contactModal.style.display = 'none'; 
                        contactForm.reset();
                        btn.textContent = originalText;
                        btn.disabled = false;
                        contactStatus.style.display = 'none';
                    }, 3000);

                } catch (error) {
                    console.error("Error al guardar lead:", error);
                    btn.textContent = originalText;
                    btn.disabled = false;
                    contactStatus.textContent = 'Error de conexión. Intenta de nuevo.';
                    contactStatus.style.color = '#EF4444';
                    contactStatus.style.display = 'block';
                }
            });
        }

        
        setView('investigador');
    }
});
