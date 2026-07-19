import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// --- CHAT API CONFIG -----------------------------------------------------
// Calls our own serverless proxy (api/chat.js) so the Groq key never ships to the browser.
const CHAT_API_ENDPOINT = '/api/chat';

// --- SCENE SETUP --------------------------------------------------------
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.03);

const CAMERA_FINAL_POS = new THREE.Vector3(0, 1.8, 5);
const CAMERA_INTRO_POS = new THREE.Vector3(0, 3.4, 9.5);
const INTRO_DURATION = 2.4;
let introComplete = false;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.copy(CAMERA_INTRO_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55, // strength
    0.4,  // radius
    0.22  // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 2;
controls.minAzimuthAngle = -Math.PI / 4;
controls.maxAzimuthAngle = Math.PI / 4;

// --- LIGHTING -------------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0x8899bb, 1.2);
mainLight.position.set(3, 5, 3);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
scene.add(mainLight);

const rimLight = new THREE.PointLight(0x6b8cae, 1.1, 12);
rimLight.position.set(-3, 2, -2);
scene.add(rimLight);

const warmLight = new THREE.PointLight(0xffaa66, 0.3, 8);
warmLight.position.set(1, 1.5, 1);
scene.add(warmLight);

// --- FLOOR ----------------------------------------------------------------
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    roughness: 0.85,
    metalness: 0.25
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Soft glowing "data grid" pool beneath the desk — subtle radial glow + fine grid lines
function createFloorGlowTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(107, 140, 174, 0.35)');
    gradient.addColorStop(0.5, 'rgba(107, 140, 174, 0.12)');
    gradient.addColorStop(1, 'rgba(107, 140, 174, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(138, 180, 208, 0.18)';
    ctx.lineWidth = 1;
    const step = size / 16;
    for (let i = 0; i <= 16; i++) {
        const pos = i * step;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(size, pos);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const floorGlowGeo = new THREE.PlaneGeometry(6, 6);
const floorGlowMat = new THREE.MeshBasicMaterial({
    map: createFloorGlowTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const floorGlow = new THREE.Mesh(floorGlowGeo, floorGlowMat);
floorGlow.rotation.x = -Math.PI / 2;
floorGlow.position.y = 0.005;
scene.add(floorGlow);

// --- DESK -------------------------------------------------------------------
function createDesk() {
    const deskGroup = new THREE.Group();

    const topGeo = new THREE.BoxGeometry(2.2, 0.06, 1.2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3, metalness: 0.2 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.75;
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    const legGeo = new THREE.BoxGeometry(0.06, 0.75, 0.06);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.6, roughness: 0.2 });
    const positions = [[-1, 0.375, -0.5], [1, 0.375, -0.5], [-1, 0.375, 0.5], [1, 0.375, 0.5]];
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        deskGroup.add(leg);
    });

    return deskGroup;
}

const desk = createDesk();
scene.add(desk);

// --- LAPTOP -----------------------------------------------------------------
function createLaptop() {
    const laptopGroup = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(0.5, 0.02, 0.35);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    laptopGroup.add(base);

    const screenGeo = new THREE.BoxGeometry(0.5, 0.35, 0.02);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x111118 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.175, -0.175);
    screen.rotation.x = 0.2;
    laptopGroup.add(screen);

    const glowGeo = new THREE.PlaneGeometry(0.46, 0.31);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 0.175, -0.164);
    glow.rotation.x = 0.2;
    laptopGroup.add(glow);

    const screenLight = new THREE.PointLight(0x4ade80, 0.5, 2);
    screenLight.position.set(0, 0.3, 0);
    laptopGroup.add(screenLight);

    return laptopGroup;
}

const laptop = createLaptop();
laptop.position.set(0, 0.79, 0.1);
scene.add(laptop);

// --- CHAIR -------------------------------------------------------------------
function createChair() {
    const chairGroup = new THREE.Group();

    const seatGeo = new THREE.BoxGeometry(0.6, 0.06, 0.55);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.7 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    chairGroup.add(seat);

    const backGeo = new THREE.BoxGeometry(0.6, 0.6, 0.06);
    const back = new THREE.Mesh(backGeo, seatMat);
    back.position.set(0, 0.75, -0.25);
    back.rotation.x = -0.1;
    back.castShadow = true;
    chairGroup.add(back);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.5 });
    [[-0.25, 0.225, -0.2], [0.25, 0.225, -0.2], [-0.25, 0.225, 0.2], [0.25, 0.225, 0.2]].forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...pos);
        chairGroup.add(leg);
    });

    return chairGroup;
}

const chair = createChair();
chair.position.set(0, 0, -0.4);
scene.add(chair);

// --- STYLIZED AVATAR SILHOUETTE ------------------------------------------------
// Deliberately no facial detail (eyes/nose/mouth) — reads as "a person at a desk"
// from the site's viewing distance without risking an uncanny-valley face.
function createAvatar() {
    const avatarGroup = new THREE.Group();

    // === BODY ===
    const torsoGeo = new THREE.CylinderGeometry(0.16, 0.20, 0.50, 16);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x394152, roughness: 0.55, metalness: 0.1 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.70;
    torso.castShadow = true;
    avatarGroup.add(torso);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.10, 12);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.6 });
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.02;
    avatarGroup.add(neck);

    // === HEAD (smooth, featureless silhouette) ===
    const headGeo = new THREE.SphereGeometry(0.13, 24, 24);
    headGeo.scale(1, 1.15, 0.95);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.18;
    head.castShadow = true;
    avatarGroup.add(head);

    // === HAIR (simple silhouette cap, no strand detail) ===
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2415, roughness: 0.8 });

    const hairTopGeo = new THREE.SphereGeometry(0.148, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.y = 1.205;
    hairTop.rotation.x = -0.05;
    avatarGroup.add(hairTop);

    const hairBackGeo = new THREE.BoxGeometry(0.28, 0.30, 0.10);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 1.02, -0.10);
    hairBack.rotation.x = 0.15;
    avatarGroup.add(hairBack);

    // === ARMS ===
    const armGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.38, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.6 });

    // Left arm (on laptop)
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.26, 0.68, 0.12);
    leftArm.rotation.z = 0.35;
    leftArm.rotation.x = -0.6;
    avatarGroup.add(leftArm);

    // Right arm (on laptop)
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.26, 0.68, 0.12);
    rightArm.rotation.z = -0.35;
    rightArm.rotation.x = -0.6;
    avatarGroup.add(rightArm);

    // === HANDS ===
    const handGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(-0.33, 0.54, 0.24);
    leftHand.scale.set(1, 0.8, 1.2);
    avatarGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(0.33, 0.54, 0.24);
    rightHand.scale.set(1, 0.8, 1.2);
    avatarGroup.add(rightHand);

    // === LEGS (sitting) ===
    const thighGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.35, 8);
    const legPantsMat = new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.6 });

    const leftThigh = new THREE.Mesh(thighGeo, legPantsMat);
    leftThigh.position.set(-0.12, 0.52, 0.15);
    leftThigh.rotation.x = -1.4;
    avatarGroup.add(leftThigh);

    const rightThigh = new THREE.Mesh(thighGeo, legPantsMat);
    rightThigh.position.set(0.12, 0.52, 0.15);
    rightThigh.rotation.x = -1.4;
    avatarGroup.add(rightThigh);

    // Lower legs
    const calfGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.35, 8);

    const leftCalf = new THREE.Mesh(calfGeo, legPantsMat);
    leftCalf.position.set(-0.12, 0.28, 0.32);
    leftCalf.rotation.x = 0.2;
    avatarGroup.add(leftCalf);

    const rightCalf = new THREE.Mesh(calfGeo, legPantsMat);
    rightCalf.position.set(0.12, 0.28, 0.32);
    rightCalf.rotation.x = 0.2;
    avatarGroup.add(rightCalf);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.08, 0.05, 0.15);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });

    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.12, 0.08, 0.38);
    avatarGroup.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.12, 0.08, 0.38);
    avatarGroup.add(rightShoe);

    return avatarGroup;
}

const avatar = createAvatar();
avatar.position.set(0, 0, -0.4);
scene.add(avatar);

// Get head reference for tracking
const avatarHead = avatar.children[2]; // head is 3rd child

// --- FLOATING PROJECT CARDS --------------------------------------------------
const projects = [
    {
        title: "AI Insurance Fraud Detection",
        subtitle: "End-to-End Pipeline",
        desc: "Built a Python + SQL pipeline to ingest, process, and flag anomalous insurance claims. Improved fraud detection workflow efficiency significantly.",
        tags: ["Python", "SQL", "ETL", "Anomaly Detection"],
        color: 0x4ade80
    },
    {
        title: "AI Trading Platform",
        subtitle: "Multi-Agent System",
        desc: "Full-stack platform using GPT-4 and PostgreSQL. Enabled 40% faster investment decisions through multi-agent conversational analysis workflows.",
        tags: ["GPT-4", "PostgreSQL", "Multi-Agent", "Full-Stack"],
        color: 0x60a5fa
    },
    {
        title: "Enterprise BI Modernization",
        subtitle: "Infosys | Snowflake + dbt",
        desc: "Architected dbt models for 40M+ records, automated data quality tests, cut dashboard runtime from minutes to seconds. Mentored 3 junior analysts.",
        tags: ["Snowflake", "dbt", "Power BI", "ETL"],
        color: 0xf472b6
    },
    {
        title: "Customer Churn Prediction",
        subtitle: "Crewasis AI",
        desc: "Profiled CRM data to surface 3 churn risk drivers, fed directly into retention strategy. Built RAG-powered chatbot for 7 client projects.",
        tags: ["SQL", "RAG", "Python", "CRM Analytics"],
        color: 0xfbbf24
    }
];

const cardMeshes = [];

function createProjectCard(project, index, total) {
    const cardGroup = new THREE.Group();

    const cardGeo = new THREE.BoxGeometry(0.8, 0.5, 0.03);
    const cardMat = new THREE.MeshStandardMaterial({
        color: 0x151520,
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.95,
        emissive: new THREE.Color(project.color),
        emissiveIntensity: 0.06
    });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.castShadow = true;
    cardGroup.add(card);

    const lineGeo = new THREE.BoxGeometry(0.8, 0.02, 0.035);
    const lineMat = new THREE.MeshBasicMaterial({ color: project.color });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.y = 0.22;
    cardGroup.add(line);

    const glowGeo = new THREE.PlaneGeometry(0.9, 0.6);
    const glowMat = new THREE.MeshBasicMaterial({
        color: project.color,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = -0.05;
    cardGroup.add(glow);

    const angle = (index / total) * Math.PI * 2;
    const radius = 2.5;
    cardGroup.position.set(
        Math.cos(angle) * radius,
        1.2 + Math.sin(index * 1.5) * 0.3,
        Math.sin(angle) * radius
    );
    cardGroup.lookAt(0, 1, 0);

    card.userData = { project, index };
    cardMeshes.push(card);

    return cardGroup;
}

const cardsGroup = new THREE.Group();
projects.forEach((project, i) => {
    cardsGroup.add(createProjectCard(project, i, projects.length));
});
scene.add(cardsGroup);

// --- PARTICLES --------------------------------------------------------------
const particleCount = 160;
const particleGeo = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleColors = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);

const particlePalette = [
    new THREE.Color(0x6b8cae),
    new THREE.Color(0x8ab4d0),
    new THREE.Color(0x4ade80)
];

for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 15;
    particlePositions[i * 3 + 1] = Math.random() * 6;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 15;

    const color = particlePalette[Math.floor(Math.random() * particlePalette.length)];
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;

    particleSizes[i] = Math.random() * 0.03 + 0.015;
}

particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
const particleMat = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// --- MOUSE TRACKING ----------------------------------------------------------
const mouse = new THREE.Vector2();
const targetRotation = new THREE.Vector2();

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- RAYCASTER ----------------------------------------------------------------
const raycaster = new THREE.Raycaster();
let hoveredCard = null;

// --- SECTION DATA ---------------------------------------------------------------
const sections = {
    about: {
        title: "Niki Choksi",
        subtitle: "Data Analyst · Denver, CO",
        desc: "Data professional with 4+ years across data analytics, BI, and data quality. I build ETL pipelines, dimensional models, and stakeholder-facing dashboards. Comfortable translating ambiguous business questions into trusted datasets and clear visualizations.",
        tags: ["SQL", "Python", "dbt", "Snowflake", "Power BI", "Tableau"]
    },
    projects: {
        title: "Projects",
        subtitle: "Click a floating card",
        desc: "Hover over the floating cards to explore my work. Each represents a real project with measurable impact.",
        tags: ["Fraud Detection", "AI Trading", "BI Modernization", "Churn Prediction"]
    },
    skills: {
        title: "Technical Skills",
        subtitle: "Modern Data Stack",
        desc: "Strong with SQL, Python, dbt, and cloud data platforms. Experienced in building ETL/ELT pipelines, data validation, and self-serve analytics.",
        tags: ["Snowflake", "Redshift", "BigQuery", "Airflow", "Git", "NoSQL"]
    }
};

let currentSection = 'about';

// --- NAVIGATION ------------------------------------------------------------
document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        currentSection = section;

        document.querySelectorAll('.nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        updatePanel(sections[section]);

        if (section === 'projects') {
            cardsGroup.visible = true;
        } else {
            cardsGroup.visible = false;
        }
    });
});

function updatePanel(data) {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('visible');

    setTimeout(() => {
        document.getElementById('panel-title').textContent = data.title;
        document.getElementById('panel-subtitle').textContent = data.subtitle;
        document.getElementById('panel-desc').textContent = data.desc;
        document.getElementById('panel-tags').innerHTML = data.tags
            .map(t => `<span class="tag">${t}</span>`).join('');
        panel.classList.add('visible');
    }, 300);
}

setTimeout(() => {
    document.getElementById('info-panel').classList.add('visible');
}, 1000);

// --- GEMINI CHAT ---------------------------------------------------------------
let chatHistory = [];

window.toggleChat = function() {
    document.getElementById('chat-panel').classList.toggle('open');
};

window.sendMessage = async function() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const messagesDiv = document.getElementById('chat-messages');

    messagesDiv.innerHTML += `<div class="chat-message user">${escapeHtml(msg)}</div>`;
    input.value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const typingId = 'typing-' + Date.now();
    messagesDiv.innerHTML += `<div class="chat-message agent" id="${typingId}">Thinking...</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const response = await callAssistant(msg);

    document.getElementById(typingId).remove();
    messagesDiv.innerHTML += `<div class="chat-message agent">${escapeHtml(response)}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

async function callAssistant(message) {
    try {
        const response = await fetch(CHAT_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        return data.reply;
    } catch (error) {
        console.error('Chat API error:', error);
        return getFallbackResponse(message);
    }
}

function getFallbackResponse(msg) {
    const lower = msg.toLowerCase();

    if (lower.includes('sql') || lower.includes('query')) {
        return "Niki has deep SQL experience across Redshift, Snowflake, PostgreSQL, and SQL Server. At Infosys, she optimized queries that cut dashboard runtime from minutes to seconds. She loves CTEs and window functions.";
    }
    if (lower.includes('python')) {
        return "Python is one of her core tools. She's built ETL pipelines, automated data quality checks, and even shipped a RAG-powered chatbot at Crewasis AI.";
    }
    if (lower.includes('dbt')) {
        return "Niki architected dbt models with source-to-target mappings for 40M+ records at Infosys. She also set up automated data quality tests that eliminated 5 hours of weekly manual QA.";
    }
    if (lower.includes('snowflake')) {
        return "She modeled fact and dimension tables in Snowflake with clustering and partitioning. Dashboard queries went from minutes to seconds.";
    }
    if (lower.includes('power bi') || lower.includes('tableau')) {
        return "She's delivered 15+ Power BI dashboards with drill-through and row-level security, plus Tableau work at Fasttrack Software. She focuses on self-serve analytics.";
    }
    if (lower.includes('project') || lower.includes('work')) {
        return "Her key projects include: AI Insurance Fraud Detection, an AI Trading Platform with GPT-4, Enterprise BI Modernization at Infosys, and Customer Churn Prediction at Crewasis AI. Click the floating cards to learn more!";
    }
    if (lower.includes('contact') || lower.includes('hire') || lower.includes('email')) {
        return "Niki is based in Denver, CO and open to remote opportunities. You can reach her at nikichoksi03@gmail.com or connect on LinkedIn.";
    }
    if (lower.includes('experience') || lower.includes('background')) {
        return "4+ years across data analytics, BI, and data quality. Currently at Rebecca Everlene Trust Company, previously at Crewasis AI, Infosys, and Fasttrack Software. Master's from Northeastern University.";
    }
    return "Great question! Niki has experience across the modern data stack — SQL, Python, dbt, Snowflake, and cloud platforms. Ask me about specific skills, projects, or how to get in touch!";
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.showContact = function() {
    alert("Email: nikichoksi03@gmail.com\nLinkedIn: linkedin.com/in/nikichoksi\nGitHub: github.com/nikichoksi");
};

// --- ANIMATION LOOP ----------------------------------------------------------
const clock = new THREE.Clock();
const _scaleTarget = new THREE.Vector3();

function updateCameraIntro(time) {
    if (introComplete) return;
    if (time >= INTRO_DURATION) {
        camera.position.copy(CAMERA_FINAL_POS);
        introComplete = true;
        return;
    }
    const t = 1 - Math.pow(1 - time / INTRO_DURATION, 3); // ease-out cubic
    camera.position.lerpVectors(CAMERA_INTRO_POS, CAMERA_FINAL_POS, t);
}

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    updateCameraIntro(time);

    // Avatar head tracking (only once the intro has settled)
    if (avatarHead && introComplete) {
        targetRotation.x = mouse.y * 0.15;
        targetRotation.y = mouse.x * 0.2;

        avatarHead.rotation.y += (targetRotation.y - avatarHead.rotation.y) * 0.05;
        avatarHead.rotation.x += (targetRotation.x - avatarHead.rotation.x) * 0.05;
    }

    // Subtle breathing animation
    if (avatar) {
        avatar.position.y = Math.sin(time * 1.5) * 0.003;
    }

    // Card orbit
    cardsGroup.rotation.y = time * 0.1;

    // Card float + hover scale
    cardsGroup.children.forEach((cardGroup, i) => {
        cardGroup.position.y += Math.sin(time * 0.8 + i) * 0.001;
        const isHovered = hoveredCard && hoveredCard.parent === cardGroup;
        const s = isHovered ? 1.08 : 1;
        _scaleTarget.set(s, s, s);
        cardGroup.scale.lerp(_scaleTarget, 0.15);
    });

    // Particles drift
    const positions = particles.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(time * 0.2 + i) * 0.0005;
        if (positions[i] > 6) positions[i] = 0;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // Raycasting for cards
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cardMeshes);

    if (intersects.length > 0) {
        const card = intersects[0].object;
        if (hoveredCard !== card) {
            hoveredCard = card;
            card.material.emissiveIntensity = 0.5;
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (hoveredCard) {
            hoveredCard.material.emissiveIntensity = 0.06;
            hoveredCard = null;
            document.body.style.cursor = 'default';
        }
    }

    controls.update();
    composer.render();
}

// --- RESIZE --------------------------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- CARD CLICK ------------------------------------------------------------------
window.addEventListener('click', (e) => {
    if (hoveredCard && currentSection === 'projects') {
        const project = hoveredCard.userData.project;
        updatePanel({
            title: project.title,
            subtitle: project.subtitle,
            desc: project.desc,
            tags: project.tags
        });
    }
});

// --- INIT --------------------------------------------------------------------------
const loadingFill = document.getElementById('loading-fill');
let loadProgress = 0;
const loadInterval = setInterval(() => {
    loadProgress = Math.min(100, loadProgress + Math.random() * 20 + 12);
    loadingFill.style.width = loadProgress + '%';
    if (loadProgress >= 100) {
        clearInterval(loadInterval);
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 250);
    }
}, 120);

animate();
