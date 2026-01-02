import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
import { gsap } from "https://cdn.skypack.dev/gsap@3.12.5";
import { ScrollTrigger } from "https://cdn.skypack.dev/gsap@3.12.5/ScrollTrigger";
import Lenis from 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.mjs';

// --------------------------------------------------------------------------
// CONFIGURATION
// --------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
gsap.registerPlugin(ScrollTrigger);
let app, auth, db;
let user = null; 
let communityUser = null; 

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("FIREBASE: CONNECTED");

    onAuthStateChanged(auth, (u) => {
        user = u; 
        communityUser = u;

        if (user && document.getElementById('admin-dashboard-view')) {
            if(user.email.includes('admin') || user.email.includes('9lives')) {
                const pinView = document.getElementById('pin-view');
                if(pinView && !pinView.classList.contains('hidden')) {
                     document.getElementById('pin-view').classList.add('hidden');
                     document.getElementById('admin-login-view').classList.add('hidden');
                     document.getElementById('admin-dashboard-view').classList.remove('hidden');
                }
            }
        }

        if (communityUser) {
            updateCommunityUI(communityUser);
        }
    });

} catch (e) {
    console.warn("FIREBASE: CONFIG INVALID OR OFFLINE MODE", e);
}

// --------------------------------------------------------------------------
// SMOOTH SCROLL (LENIS)
// --------------------------------------------------------------------------
let lenis;
try {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        direction: 'vertical',
        gestureDirection: 'vertical',
        touchMultiplier: 2,
    });
    
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
} catch (e) {
    console.log("Lenis Init Failed");
}

// --------------------------------------------------------------------------
// 3D HERO ENGINE (THREE.JS)
// --------------------------------------------------------------------------
function initHero3D() {
    const container = document.getElementById('webgl-canvas');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const texture = loader.load('images/art-1.jpg'); 
    const depthMap = loader.load('images/depth-1.jpg'); 

    // Important: Prevent edge repeating artifacts
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    depthMap.minFilter = THREE.LinearFilter;
    depthMap.magFilter = THREE.LinearFilter;
    depthMap.wrapS = THREE.ClampToEdgeWrapping;
    depthMap.wrapT = THREE.ClampToEdgeWrapping;

    // Fixed aspect ratio of the source image
    const imageAspect = 1920 / 1080; // Assuming standard HD image. Adjust if needed.

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: texture },
            uDepth: { value: depthMap },
            uMouse: { value: new THREE.Vector2(0, 0) },
            uVolo: { value: 0.015 }, // Reduced strength for less tearing
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uImageAspect: { value: imageAspect }
        },
        vertexShader: `
            varying vec2 vUv; 
            void main() { 
                vUv = uv; 
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            uniform sampler2D uDepth;
            uniform vec2 uMouse;
            uniform float uVolo;
            uniform float uTime;
            uniform vec2 uResolution;
            uniform float uImageAspect;
            varying vec2 vUv;

            vec2 getCoverUV(vec2 uv, vec2 resolution, float imgAspect) {
                float screenAspect = resolution.x / resolution.y;
                float scale = screenAspect / imgAspect;
                vec2 newUV = uv;

                if (scale > 1.0) {
                    // Screen is wider than image: Fit Width, Crop Height
                    float r = imgAspect / screenAspect;
                    newUV.y = (uv.y - 0.5) * (1.0 / scale) + 0.5;
                } else {
                    // Screen is taller than image: Fit Height, Crop Width
                    newUV.x = (uv.x - 0.5) * scale + 0.5;
                }
                return newUV;
            }

            void main() {
                vec2 coverUV = getCoverUV(vUv, uResolution, uImageAspect);
                vec4 depthDistortion = texture2D(uDepth, coverUV);
                float parallaxMult = depthDistortion.r;
                vec2 parallax = uMouse * parallaxMult * uVolo;
                
                // Subtle RGB Split Glitch
                float r = texture2D(uTexture, coverUV + parallax).r;
                float g = texture2D(uTexture, coverUV + parallax * 0.95).g;
                float b = texture2D(uTexture, coverUV + parallax * 1.05).b;
                
                gl_FragColor = vec4(r, g, b, 1.0);
            }
        `
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const bgMesh = new THREE.Mesh(geometry, material);
    scene.add(bgMesh);

    // STARFIELD
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const posArray = new Float32Array(starCount * 3);
    for(let i=0; i<starCount*3; i++) {
        posArray[i] = (Math.random() - 0.5) * 6;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({size: 0.015, color: 0xffffff, transparent: true, opacity: 0.6}));
    stars.position.z = 1;
    scene.add(stars);

    // MOUSE INTERACTION & MOBILE IDLE ANIMATION
    const mouse = new THREE.Vector2();
    let hasMoved = false;

    const updateMouse = (x, y) => {
        hasMoved = true;
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    });

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        material.uniforms.uTime.value = time;
        
        // Idle Animation for Mobile/Inactive
        if(!hasMoved) {
            mouse.x = Math.sin(time * 0.5) * 0.3;
            mouse.y = Math.cos(time * 0.4) * 0.3;
        }

        // Smoothly interpolate shader values
        gsap.to(material.uniforms.uMouse.value, { x: mouse.x * 0.5, y: mouse.y * 0.5, duration: 1.5 });
        gsap.to(stars.rotation, { x: -mouse.y * 0.1, y: mouse.x * 0.1, duration: 2 });

        if(Math.random() > 0.98) stars.material.opacity = 0.4 + Math.random() * 0.4;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    });
}

// --------------------------------------------------------------------------
// COMMUNITY
// --------------------------------------------------------------------------
function initCommunity() {
    const googleBtn = document.getElementById('google-login-btn');
    const msgForm = document.getElementById('msg-form');
    
    if(googleBtn) {
        googleBtn.addEventListener('click', async () => {
            if(!auth) return;
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                window.showToast("IDENTITY VERIFIED");
            } catch(e) {
                console.error("Auth Error:", e);
                window.showToast("AUTH FAILED");
            }
        });
    }

    const feed = document.getElementById('chat-feed');
    if(feed && db) {
        try {
            const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
            onSnapshot(q, (snap) => {
                feed.innerHTML = ""; 
                const msgs = [];
                snap.forEach(doc => msgs.push(doc.data()));
                msgs.forEach(data => {
                    const time = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
                    const isAnnouncement = data.type === 'announcement';
                    const containerClass = isAnnouncement ? "announcement-msg bg-red-900/20 p-3 rounded border-l-2 border-[#ff2a2a] mb-4" : "flex gap-3 animate-fade-in mb-4";
                    
                    let innerHTML = '';
                    if (isAnnouncement) {
                        innerHTML = `
                            <div class="${containerClass} w-full">
                                <div class="flex justify-between items-baseline mb-1">
                                    <span class="font-mono text-[10px] text-[#ff2a2a] font-bold tracking-widest">[SYSTEM_BROADCAST]</span>
                                    <span class="font-mono text-[9px] text-gray-500">${time}</span>
                                </div>
                                <p class="font-mono text-sm text-white font-bold leading-relaxed">${escapeHtml(data.text)}</p>
                            </div>`;
                    } else {
                        innerHTML = `
                            <div class="${containerClass}">
                                <img src="${data.photo || 'images/logo.webp'}" class="w-8 h-8 rounded-full border border-gray-700 mt-1 object-cover">
                                <div class="bg-[#111] p-3 rounded-tr-lg rounded-bl-lg rounded-br-lg border border-white/10 max-w-[85%]">
                                    <div class="flex justify-between items-baseline mb-1 gap-4">
                                        <span class="font-mono text-[10px] text-[#ff2a2a] font-bold uppercase">${escapeHtml(data.user)}</span>
                                        <span class="font-mono text-[9px] text-gray-600">${time}</span>
                                    </div>
                                    <p class="font-mono text-xs text-gray-300 break-words leading-relaxed">${escapeHtml(data.text)}</p>
                                </div>
                            </div>`;
                    }
                    feed.innerHTML += innerHTML;
                });
            });
        } catch (e) {
            console.error(e);
        }
    }

    if(msgForm) {
        msgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!communityUser) { window.showToast("LOGIN REQUIRED"); return; }
            const input = document.getElementById('msg-input');
            let text = input.value.trim();
            if(!text) return;

            const badWords = ["scam", "spam", "fake", "hate", "kill"];
            badWords.forEach(w => { text = text.replace(new RegExp(w, "gi"), "***"); });
            if(text.length > 280) text = text.substring(0, 280);

            try {
                await addDoc(collection(db, "messages"), {
                    text: text,
                    user: communityUser.displayName || 'Anonymous',
                    uid: communityUser.uid,
                    photo: communityUser.photoURL,
                    type: 'user',
                    createdAt: serverTimestamp()
                });
                input.value = "";
            } catch(err) {
                window.showToast("TRANSMISSION ERROR");
            }
        });
    }
}

function updateCommunityUI(user) {
    const authContainer = document.getElementById('auth-container');
    const userProfile = document.getElementById('user-profile');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    if(authContainer && userProfile) {
        authContainer.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userAvatar.src = user.photoURL || 'images/logo.webp';
        userName.innerText = user.displayName || 'OPERATIVE';
    }
}

// --------------------------------------------------------------------------
// ADMIN SYSTEM
// --------------------------------------------------------------------------
function initAdminSystem() {
    const adminTrigger = document.getElementById('admin-trigger');
    const adminModal = document.getElementById('admin-modal');
    const closeAdmin = document.getElementById('close-admin');
    const pinForm = document.getElementById('pin-form');
    const loginForm = document.getElementById('login-form');
    const SECRET_PIN = "01012026"; 

    if(adminTrigger) {
        adminTrigger.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            document.getElementById('pin-view').classList.remove('hidden');
            document.getElementById('admin-login-view').classList.add('hidden');
            document.getElementById('admin-dashboard-view').classList.add('hidden');
            document.getElementById('admin-pin').value = '';
        });
    }

    if(pinForm) {
        pinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = document.getElementById('admin-pin').value;
            if(val === SECRET_PIN) {
                document.getElementById('pin-view').classList.add('hidden');
                document.getElementById('admin-login-view').classList.remove('hidden');
            } else {
                const err = document.getElementById('pin-error');
                err.classList.remove('hidden');
                setTimeout(() => err.classList.add('hidden'), 2000);
            }
        });
    }

    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const pass = document.getElementById('admin-pass').value;
            signInWithEmailAndPassword(auth, email, pass)
                .then(() => {
                    document.getElementById('admin-login-view').classList.add('hidden');
                    document.getElementById('admin-dashboard-view').classList.remove('hidden');
                    window.showToast("ACCESS GRANTED");
                })
                .catch(() => {
                    document.getElementById('auth-error').classList.remove('hidden');
                });
        });
    }

    if(closeAdmin) closeAdmin.addEventListener('click', () => adminModal.classList.add('hidden'));
    document.getElementById('admin-logout')?.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));

    const addProdForm = document.getElementById('add-product-form');
    if(addProdForm) {
        addProdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-prod-name').value;
            const price = Number(document.getElementById('new-prod-price').value);
            const img = document.getElementById('new-prod-img').value;
            try {
                await addDoc(collection(db, 'products'), { name, price, img, createdAt: serverTimestamp() });
                window.showToast("PRODUCT DEPLOYED");
                addProdForm.reset();
            } catch(err) { window.showToast("DEPLOY ERROR"); }
        });
    }

    const broadcastBtn = document.getElementById('btn-broadcast');
    if(broadcastBtn) {
        broadcastBtn.addEventListener('click', async () => {
            const txt = document.getElementById('announcement-text').value.trim();
            if(!txt) return;
            try {
                await addDoc(collection(db, 'messages'), {
                    text: txt, user: 'SYSTEM', type: 'announcement', createdAt: serverTimestamp()
                });
                window.showToast("BROADCAST SENT");
                document.getElementById('announcement-text').value = '';
            } catch(e) { window.showToast("BROADCAST FAILED"); }
        });
    }
}

// --------------------------------------------------------------------------
// STORE & CART
// --------------------------------------------------------------------------
function renderStore() {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    if(!db) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 border border-dashed border-gray-800"><p class="font-mono text-gray-500">OFFLINE MODE</p></div>`;
        return;
    }
    onSnapshot(collection(db, "products"), (snap) => {
        grid.innerHTML = "";
        if(snap.empty) { grid.innerHTML = `<div class="col-span-full text-center font-mono text-gray-500">NO DROPS ACTIVE</div>`; return; }
        snap.forEach(doc => {
            const data = doc.data();
            const el = document.createElement('div');
            el.className = "group relative bg-[#0a0a0a] border border-white/10 hover:border-[#ff2a2a] transition-all duration-300";
            el.innerHTML = `
                <div class="aspect-[3/4] overflow-hidden relative cursor-pointer">
                    <img src="${data.img}" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500">
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onclick="window.addToCart('${doc.id}', '${escapeHtml(data.name)}', ${data.price})" class="bg-white text-black px-6 py-2 font-mono font-bold hover:bg-[#ff2a2a] hover:text-white uppercase transition-colors">Add to Cart</button>
                    </div>
                </div>
                <div class="p-4 border-t border-white/10 flex justify-between items-start">
                    <div><h3 class="font-graffiti text-2xl">${escapeHtml(data.name)}</h3><p class="font-mono text-[10px] text-gray-500">LIMITED_EDITION</p></div>
                    <span class="font-mono text-[#ff2a2a] font-bold">$${data.price}</span>
                </div>
            `;
            grid.appendChild(el);
        });
    });
}

window.addToCart = (id, name, price) => {
    const cart = JSON.parse(localStorage.getItem('9lives_cart') || '[]');
    cart.push({ id, name, price, addedAt: Date.now() });
    localStorage.setItem('9lives_cart', JSON.stringify(cart));
    updateCartUI();
    document.getElementById('cart-sidebar').classList.remove('translate-x-full');
    window.showToast(`ADDED: ${name}`);
};

function updateCartUI() {
    const cart = JSON.parse(localStorage.getItem('9lives_cart') || '[]');
    const container = document.getElementById('cart-items');
    document.getElementById('cart-count').innerText = cart.length;
    document.getElementById('cart-total').innerText = `$${cart.reduce((s,i)=>s+i.price,0).toFixed(2)}`;
    container.innerHTML = cart.length ? '' : '<p class="font-mono text-gray-600 text-center mt-10">CART IS EMPTY</p>';
    cart.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center border-b border-gray-800 pb-3 mb-3 animate-fade-in";
        row.innerHTML = `<div><p class="font-mono font-bold text-sm">${escapeHtml(item.name)}</p><p class="text-xs text-gray-500">$${item.price}</p></div><button onclick="window.removeCartItem(${i})" class="text-[#ff2a2a] text-xs hover:text-white font-mono">[REMOVE]</button>`;
        container.appendChild(row);
    });
}
window.removeCartItem = (i) => {
    const cart = JSON.parse(localStorage.getItem('9lives_cart') || '[]');
    cart.splice(i, 1);
    localStorage.setItem('9lives_cart', JSON.stringify(cart));
    updateCartUI();
};

async function initPolls() {
    const pollContainer = document.getElementById('poll-container');
    if(!pollContainer || !db) return;
    const pollRef = doc(db, "polls", "active");
    try {
        const docSnap = await getDoc(pollRef);
        if(!docSnap.exists()) await setDoc(pollRef, { options: ["CYBER_PINK_HOODIE", "VOID_BLACK_CARGO", "ACID_WASH_TEE"] });
    } catch(e) {}
    onSnapshot(pollRef, (docSnap) => {
        if(!docSnap.exists()) return;
        const data = docSnap.data();
        const options = data.options || [];
        let total = 0;
        options.forEach((_, i) => total += (data[`votes_${i}`] || 0));
        if(total === 0) total = 1;
        let html = '<div class="space-y-4">';
        options.forEach((opt, i) => {
            const votes = data[`votes_${i}`] || 0;
            const percent = Math.round((votes / total) * 100);
            html += `<div class="cursor-pointer group relative" onclick="window.votePoll(${i})"><div class="flex justify-between font-mono text-xs mb-1 text-gray-400 group-hover:text-[#ff2a2a]"><span>${opt}</span><span>${percent}% (${votes})</span></div><div class="h-8 bg-[#111] border border-gray-800 relative overflow-hidden group-hover:border-[#ff2a2a]"><div class="absolute top-0 left-0 h-full bg-[#ff2a2a] opacity-50 transition-all duration-1000" style="width: ${percent}%"></div></div></div>`;
        });
        html += '</div><p class="font-mono text-[10px] text-center mt-4 text-gray-600">CLICK TO VOTE // REGISTERED ON CHAIN</p>';
        pollContainer.innerHTML = html;
    });
}
window.votePoll = async (idx) => {
    if(!db) { window.showToast("OFFLINE MODE"); return; }
    try { await updateDoc(doc(db, "polls", "active"), { [`votes_${idx}`]: increment(1) }); window.showToast("VOTE REGISTERED"); } catch(e) { window.showToast("VOTE FAILED"); }
};

function escapeHtml(text) { if(!text) return text; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
window.showToast = (msg) => {
    const box = document.createElement('div');
    box.className = "toast-message fixed top-4 right-4 bg-black border border-[#ff2a2a] text-white px-6 py-3 font-mono text-sm z-[99999]";
    box.innerHTML = `<span class="text-[#ff2a2a] mr-2">›</span> ${msg}`;
    document.body.appendChild(box);
    setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 300); }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    initHero3D();
    renderStore();
    updateCartUI();
    initAdminSystem();
    initCommunity();
    initPolls();
    document.getElementById('cart-btn')?.addEventListener('click', () => document.getElementById('cart-sidebar').classList.remove('translate-x-full'));
    document.getElementById('close-cart')?.addEventListener('click', () => document.getElementById('cart-sidebar').classList.add('translate-x-full'));
    const dot = document.getElementById('cursor-dot');
    const outline = document.getElementById('cursor-outline');
    if(dot && outline) {
        window.addEventListener('mousemove', (e) => {
            dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`;
            outline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: "forwards" });
        });
        document.querySelectorAll('a, button, .cursor-pointer').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });
    }
});