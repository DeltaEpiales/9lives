// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, runTransaction, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/ShaderPass.js';
import { gsap } from "https://cdn.skypack.dev/gsap@3.12.5";
import { ScrollTrigger } from "https://cdn.skypack.dev/gsap@3.12.5/ScrollTrigger";
import Lenis from 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.mjs';

// --- INITIALIZE GSAP ---
gsap.registerPlugin(ScrollTrigger);

// --- MODULE-LEVEL VARIABLES ---
let app, db, auth, userId, productsColRef;
let scene, camera, renderer, composer, lenis;
const clock = new THREE.Clock();
const catSprites = [];
let prevCartCount = 0;

// --- CONFIG & CONSTANTS ---
const appId = 'default-app-id';
const firebaseConfig = {
    apiKey: "your-api-key", authDomain: "your-auth-domain", projectId: "your-project-id",
    storageBucket: "your-storage-bucket", messagingSenderId: "your-sender-id", appId: "your-app-id"
};
const NoiseShader = {
    uniforms: { 'tDiffuse': { value: null }, 'amount': { value: 0.02 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); } void main() { vec4 color = texture2D( tDiffuse, vUv ); float noise = rand(vUv) * amount; gl_FragColor = vec4( color.rgb + noise, color.a ); }`
};


// --- CORE APP LOGIC ---
function startApp() {
    setupScrolling();
    setupCursor();
    
    try {
        if (firebaseConfig.projectId !== "your-project-id") {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            productsColRef = collection(db, `artifacts/${appId}/public/data/products`);
        } else {
            throw new Error("Using placeholder Firebase config. Running in offline mode.");
        }
    } catch (e) {
        console.error("Firebase initialization failed:", e.message);
        runInDemoMode();
        return;
    }

    if (auth) {
        onAuthStateChanged(auth, user => handleAuthState(user));
    } else {
        console.warn("Offline mode: Store and Poll features are disabled.");
        handleAuthState(null);
    }
}

function runInDemoMode() {
    // Show and handle the closable demo bar
    const demoBar = document.getElementById('demo-mode-indicator');
    demoBar.classList.remove('hidden');
    document.getElementById('close-demo-bar').addEventListener('click', () => {
        demoBar.classList.add('hidden');
    });

    // Mock products
    const mockProducts = [
        { id: '1', name: 'Dimensional Drift Tee', price: 48.00, img: 'https://placehold.co/600x800/1a1a1a/f87171?text=Drift+Tee', desc: 'A comfortable tee that seems to phase in and out of reality.' },
        { id: '2', name: '9-Lives Hoodie', price: 50.00, img: 'https://placehold.co/600x800/1a1a1a/60a5fa?text=Glitch+Hoodie', desc: 'Heavyweight hoodie with embroidered glitch patterns.' },
        { id: '3', name: 'Chrono-Cargo Pants', price: 130.00, img: 'https://placehold.co/600x800/1a1a1a/34d399?text=Chrono+Pants', desc: 'Durable cargo pants with enough pockets for your timeline.' }
    ];
    renderProducts(mockProducts);
    
    // Mock votes and render the poll
    const mockVotes = {
        'cyber-pink': 42,
        'toxic-green': 78,
        'glacier-blue': 55,
        'solar-orange': 23
    };
    renderPoll(mockVotes);

    setupStaticAnimations();
    init3DBackground();
    requestAnimationFrame(animate);
}

async function handleAuthState(user) {
    if (user) {
        userId = user.uid;
    } else {
        try {
            if (auth) {
                const anonUser = await signInAnonymously(auth);
                userId = anonUser.user.uid;
            } else {
                throw new Error("Auth not available");
            }
        } catch (error) {
            userId = `guest-${crypto.randomUUID()}`;
        }
    }
    
    document.getElementById('user-id-display').textContent = `UID: ${userId.substring(0, 12)}...`;
    setupDynamicContent(!!auth);
}

function setupDynamicContent(isFirebaseReady) {
    if (isFirebaseReady) {
        seedInitialData();
        setupStore();
        setupCart();
        setupPoll();
        setupAdmin();
    } else {
        document.getElementById('product-list').innerHTML = `<p class="text-center col-span-full text-gray-400">Store offline. Database connection failed.</p>`;
        document.getElementById('poll-options').innerHTML = `<p class="text-center col-span-full text-gray-400">Poll offline. Database connection failed.</p>`;
    }
    setupStaticAnimations();
    init3DBackground();
    requestAnimationFrame(animate);
}

// --- UI & INTERACTIONS ---
function setupCursor() {
    const cursor = document.getElementById('cursor-dot');
    window.addEventListener('mousemove', e => {
        gsap.to(cursor, { duration: 0.2, x: e.clientX, y: e.clientY });
    });

    document.querySelectorAll('a, button, input, .card').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
}

function setupCart() {
    const cartPanel = document.getElementById('cart-panel');
    document.getElementById('cart-button').addEventListener('click', () => cartPanel.classList.remove('translate-x-full'));
    document.getElementById('close-cart-button').addEventListener('click', () => cartPanel.classList.add('translate-x-full'));

    if (!auth) return;
    const cartColRef = collection(db, `artifacts/${appId}/users/${userId}/cart`);
    onSnapshot(cartColRef, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCart(items);
    });
}

function renderCart(items) {
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');
    const cartButton = document.getElementById('cart-button');

    cartItemsEl.innerHTML = items.length === 0 ? '<p class="text-gray-400">Your cart is empty.</p>' : items.map(i => `
        <div class="flex items-center justify-between"><img src="${i.img}" alt="${i.name}" class="w-16 h-20 object-cover rounded-md"><div class="flex-1 mx-4"><p class="font-bold">${i.name}</p><p class="text-sm text-gray-400">$${Number(i.price).toFixed(2)} x ${i.quantity}</p></div><button data-item-id="${i.id}" class="remove-from-cart-btn text-red-500 font-bold text-lg hover:text-red-400 transition-colors">X</button></div>`).join('');

    cartItemsEl.querySelectorAll('.remove-from-cart-btn').forEach(b => {
        b.addEventListener('click', async e => {
            if (!auth) return;
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/cart`, e.target.dataset.itemId));
        });
    });

    const currentCartCount = items.reduce((sum, item) => sum + item.quantity, 0);
    cartCountEl.textContent = currentCartCount;
    cartTotalEl.textContent = `$${items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`;

    if (currentCartCount > prevCartCount) {
        cartButton.classList.add('is-updated');
        setTimeout(() => cartButton.classList.remove('is-updated'), 400);
    }
    prevCartCount = currentCartCount;
}

// --- STORE & DATA LOGIC ---
function renderProducts(products) {
    const productList = document.getElementById('product-list');
    if (!products || products.length === 0) {
        productList.innerHTML = `<p class="text-center col-span-full">No products available yet.</p>`; return;
    }
    productList.innerHTML = products.map(p => `
        <div class="card rounded-lg overflow-hidden flex flex-col">
            <div class="relative overflow-hidden aspect-[3/4] img-container">
                <img src="${p.img}" alt="${p.name}" loading="lazy" class="product-image absolute top-0 left-0 w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x800/1a1a1a/f87171?text=Image+Error';">
            </div>
            <div class="p-6 flex-grow flex flex-col">
                <h3 class="text-2xl font-bold">${p.name}</h3>
                <p class="text-gray-400 mt-2">$${Number(p.price).toFixed(2)}</p>
                <p class="text-gray-300 mt-2 flex-grow">${p.desc || ''}</p>
                <button data-product='${JSON.stringify(p)}' class="mt-auto pt-4 btn btn-primary add-to-cart-btn">Add to Cart</button>
            </div>
        </div>`).join('');

    productList.querySelectorAll('.card').forEach(card => {
        const img = card.querySelector('.product-image');
        if (img.complete) {
            img.classList.add('is-loaded');
            card.querySelector('.img-container').style.animation = 'none';
        } else {
            img.onload = () => {
                img.classList.add('is-loaded');
                card.querySelector('.img-container').style.animation = 'none';
            };
        }

        const button = card.querySelector('.add-to-cart-btn');
        button.addEventListener('click', async (e) => {
            if (!auth || button.classList.contains('is-added')) return;
            const product = JSON.parse(e.target.dataset.product);
            const cartDocRef = doc(db, `artifacts/${appId}/users/${userId}/cart`, product.id);
            try {
                await runTransaction(db, async (t) => {
                    const cartDoc = await t.get(cartDocRef);
                    t.set(cartDocRef, { ...product, quantity: (cartDoc.data()?.quantity || 0) + 1 });
                });
                button.classList.add('is-added');
                button.textContent = 'Added ✓';
                setTimeout(() => {
                    button.classList.remove('is-added');
                    button.textContent = 'Add to Cart';
                }, 2000);
            } catch (err) { console.error("Transaction failed: ", err); }
        });
    });
}


// --- ANIMATION & SCROLLING ---
// --- ANIMATION & SCROLLING ---
function setupScrolling() {
    // Check if the device is a touch device (not a mouse)
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    // Only initialize Lenis on non-touch devices
    if (!isTouchDevice) {
        lenis = new Lenis({
            wrapper: document.querySelector('#smooth-wrapper'),
            content: document.querySelector('#smooth-content'),
        });

        lenis.on('scroll', ScrollTrigger.update);

        ScrollTrigger.scrollerProxy("#smooth-wrapper", {
            scrollTop(value) {
                if (arguments.length) {
                    lenis.scrollTo(value, { duration: 0, immediate: true });
                }
                return lenis.actualScroll;
            },
            getBoundingClientRect() {
                return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
            }
        });

        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        gsap.ticker.lagSmoothing(0);
    } else {
        // On touch devices, use the body for ScrollTrigger
        ScrollTrigger.scrollerProxy(document.body, {
            scrollTop(value) {
                if (arguments.length) {
                  document.documentElement.scrollTop = value;
                  document.body.scrollTop = value;
                }
                return Math.max(document.documentElement.scrollTop, document.body.scrollTop);
            },
            getBoundingClientRect() {
                return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight};
            }
        });
    }
}


function animate(time) {
    if (composer) {
        const delta = clock.getDelta();
        const viewBounds = { x: (window.innerWidth / window.innerHeight) * camera.position.z * 0.5, y: camera.position.z * 0.5 };
        catSprites.forEach(cat => {
            cat.position.addScaledVector(cat.velocity, delta);
            if (Math.abs(cat.position.x) > viewBounds.x * 2) cat.velocity.x *= -1;
            if (Math.abs(cat.position.y) > viewBounds.y * 2) cat.velocity.y *= -1;
            if (Math.abs(cat.position.z) > 15) cat.velocity.z *= -1;
        });
        composer.render();
    }
    requestAnimationFrame(animate);
}

function setupStaticAnimations() {
    document.querySelectorAll('.parallax-container').forEach((container) => {
        const content = container.querySelector('.parallax-content');
        const art = container.querySelector('.parallax-art');
        gsap.to(content, { yPercent: -20, ease: "none", scrollTrigger: { trigger: container, scroller: "#smooth-wrapper", scrub: true } });
        if (art) { 
            gsap.to(art, { yPercent: 30, ease: "none", scrollTrigger: { trigger: container, scroller: "#smooth-wrapper", scrub: true } }); 
        }
    });
}

function init3DBackground() {
    const canvas = document.querySelector('.hero-canvas');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.6, 0.2);
    composer.addPass(bloomPass);
    const noisePass = new ShaderPass(NoiseShader);
    noisePass.renderToScreen = true;
    composer.addPass(noisePass);

    const starVertices = [];
    for (let i = 0; i < 15000; i++) {
        starVertices.push(THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200));
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.1 }));
    scene.add(stars);

    const textureLoader = new THREE.TextureLoader();
    const catTexture1 = textureLoader.load('images/cat1.png');
    const catTexture2 = textureLoader.load('images/cat2.png');

    for (let i = 0; i < 8; i++) {
        const randomTexture = i % 2 === 0 ? catTexture1 : catTexture2;
        
        const catMaterial = new THREE.SpriteMaterial({
            map: randomTexture,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: THREE.MathUtils.randFloat(0.5, 1.0),
            color: new THREE.Color().setHSL(Math.random(), 0.9, 0.7)
        });

        const cat = new THREE.Sprite(catMaterial);
        cat.position.set(THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(10));
        cat.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.5));
        cat.velocity = new THREE.Vector3(THREE.MathUtils.randFloat(-0.5, 0.5), THREE.MathUtils.randFloat(-0.5, 0.5), THREE.MathUtils.randFloat(-0.5, 0.5));
        catSprites.push(cat);
        scene.add(cat);
    }

    gsap.to(camera.rotation, { y: Math.PI / 2, x: -Math.PI / 8, scrollTrigger: { scroller: "#smooth-wrapper", scrub: 1 } });
    gsap.to(stars.rotation, { y: 2, x: 1, scrollTrigger: { scroller: "#smooth-wrapper", scrub: 1 } });

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    if (!camera || !renderer || !composer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function setupAdmin() {
    const loginModal = document.getElementById('login-modal');
    const adminPanel = document.getElementById('admin-panel');
    const productForm = document.getElementById('product-form');
    let logoClicks = 0;
    document.getElementById('logo').addEventListener('click', () => {
        logoClicks++;
        if (logoClicks >= 5) { loginModal.classList.remove('hidden'); logoClicks = 0; }
        setTimeout(() => logoClicks = 0, 2000);
    });
    loginModal.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.classList.add('hidden'); });
    document.getElementById('logout-btn').addEventListener('click', () => { adminPanel.classList.add('hidden'); });
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.username.value === 'admin' && e.target.password.value === 'password123') {
            loginModal.classList.add('hidden'); adminPanel.classList.remove('hidden'); e.target.reset();
            document.getElementById('login-error').textContent = '';
        } else { document.getElementById('login-error').textContent = 'Invalid credentials.'; }
    });
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!auth) return;
        const id = document.getElementById('product-id').value;
        const productData = { name: document.getElementById('product-name').value, price: parseFloat(document.getElementById('product-price').value), img: document.getElementById('product-img').value, desc: document.getElementById('product-desc').value };
        try {
            if (id) { await updateDoc(doc(db, `artifacts/${appId}/public/data/products`, id), productData); } 
            else { await addDoc(productsColRef, productData); }
            resetProductForm();
        } catch (error) { console.error("Error saving product:", error); }
    });
    document.getElementById('cancel-edit-btn').addEventListener('click', resetProductForm);
}
function renderAdminProductList(products) {
    const listEl = document.getElementById('admin-product-list'); if (!auth) return;
    listEl.innerHTML = products.map(p => `<div class="bg-gray-800 p-4 rounded-lg flex items-center justify-between"><div class="flex items-center"><img src="${p.img}" class="w-12 h-12 object-cover rounded-md mr-4"><span class="font-bold">${p.name}</span></div><div class="space-x-2"><button data-product-id='${p.id}' class="edit-btn btn btn-secondary py-2 px-4 text-sm">Edit</button><button data-product-id="${p.id}" class="delete-btn bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-red-500 transition-colors">Delete</button></div></div>`).join('');
    listEl.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async e => { if (confirm('Are you sure?')) { await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, e.target.dataset.productId)); } }));
    listEl.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', e => {
        const product = products.find(p => p.id === e.target.dataset.productId); if (!product) return;
        document.getElementById('form-title').textContent = 'Edit Product'; document.getElementById('product-id').value = product.id; document.getElementById('product-name').value = product.name; document.getElementById('product-price').value = product.price; document.getElementById('product-img').value = product.img; document.getElementById('product-desc').value = product.desc || ''; document.getElementById('cancel-edit-btn').classList.remove('hidden');
        adminPanel.scrollIntoView({ behavior: 'smooth' });
    }));
}
function resetProductForm() { document.getElementById('form-title').textContent = 'Add New Product'; document.getElementById('product-form').reset(); document.getElementById('product-id').value = ''; document.getElementById('cancel-edit-btn').classList.add('hidden'); }
async function setupPoll() {
    if (!auth) return; const pollId = 'next-colorway';
    const pollDocRef = doc(db, `artifacts/${appId}/public/data/polls`, pollId);
    if (!(await getDoc(pollDocRef)).exists()) {
        const initialVotes = {};
        [{id:'cyber-pink'},{id:'toxic-green'},{id:'glacier-blue'},{id:'solar-orange'}].forEach(o=>initialVotes[o.id]=0);
        await setDoc(pollDocRef, { votes: initialVotes });
    }
    onSnapshot(pollDocRef, (doc) => { if (doc.data()?.votes) renderPoll(doc.data().votes); });
}
function renderPoll(votes) {
    const pollOptions = [ { id: 'cyber-pink', name: 'Cyber Pink', color: 'bg-pink-500' }, { id: 'toxic-green', name: 'Toxic Green', color: 'bg-lime-400' }, { id: 'glacier-blue', name: 'Glacier Blue', color: 'bg-sky-400' }, { id: 'solar-orange', name: 'Solar Orange', color: 'bg-orange-500' }];
    const container = document.getElementById('poll-options'); const totalVotes = Object.values(votes).reduce((s, c) => s + c, 0);
    container.innerHTML = pollOptions.map(option => {
        const voteCount = votes[option.id] || 0; const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
        return `<div class="poll-option border border-gray-700 p-4 rounded-lg"><div class="flex justify-between items-center mb-2"><div class="flex items-center"><div class="w-6 h-6 rounded-md ${option.color} mr-4 border-2 border-gray-600"></div><span class="font-bold">${option.name}</span></div><button data-poll-option="${option.id}" class="vote-btn border border-red-400 text-red-400 px-4 py-1 rounded-full text-sm hover:bg-red-400 hover:text-black transition">Vote</button></div><div class="w-full bg-gray-700 rounded-full h-2.5"><div class="${option.color} h-2.5 rounded-full" style="width: ${percentage}%"></div></div><span class="text-xs text-gray-400 text-left block mt-1">${voteCount} votes</span></div>`;
    }).join('');
    container.querySelectorAll('.vote-btn').forEach(b => b.addEventListener('click', async (e) => {
        if (!auth) return;
        const pollDocRef = doc(db, `artifacts/${appId}/public/data/polls`, 'next-colorway');
        try { await runTransaction(db, async t => { const pollDoc = await t.get(pollDocRef); const newVotes = pollDoc.data().votes; newVotes[e.target.dataset.pollOption]++; t.update(pollDocRef, { votes: newVotes }); });
        } catch (err) { console.error("Poll vote failed: ", err); }
    }));
}
async function seedInitialData() {
    if (!db) return; const snapshot = await getDocs(productsColRef);
    if (snapshot.empty) {
        const batch = writeBatch(db); const placeholderProducts = [{ name: 'Dimensional Drift Tee', price: 48.00, img: 'https://placehold.co/600x800/1a1a1a/f87171?text=Drift+Tee', desc: 'A comfortable tee that seems to phase in and out of reality.' },{ name: '9-Lives Hoodie', price: 50.00, img: 'https://placehold.co/600x800/1a1a1a/60a5fa?text=Glitch+Hoodie', desc: 'Heavyweight hoodie with embroidered glitch patterns.' },{ name: 'Chrono-Cargo Pants', price: 130.00, img: 'https://placehold.co/600x800/1a1a1a/34d399?text=Chrono+Pants', desc: 'Durable cargo pants with enough pockets for your timeline.' }];
        placeholderProducts.forEach(p => { const docRef = doc(productsColRef); batch.set(docRef, p); });
        await batch.commit(); console.log("Initial product data seeded.");
    }
}
// --- START THE APP ---
document.addEventListener('DOMContentLoaded', startApp);