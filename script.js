class BigNum {
    constructor(mag, exp) {
        this.mag = isNaN(mag) ? 0 : mag;
        this.exp = isNaN(exp) ? 0 : exp;
        this.normalize();
    }

    normalize() {
        if (this.mag === 0) { this.exp = 0; return; }
        if (Math.abs(this.mag) <= 1e-15) { this.mag = 0; this.exp = 0; return; }
        let log = Math.log10(Math.abs(this.mag));
        let shift = Math.floor(log);
        this.exp += shift;
        this.mag = this.mag / Math.pow(10, shift);
    }

    plus(other) {
        let diff = this.exp - other.exp;
        if (diff > 15) return this;
        if (diff < -15) { this.mag = other.mag; this.exp = other.exp; return this; }
        this.mag = this.mag + other.mag * Math.pow(10, -diff);
        this.normalize();
        return this;
    }

    minus(other) {
        let diff = this.exp - other.exp;
        if (diff > 15) return this;
        if (diff < -15) { this.mag = 0; this.exp = 0; return this; }
        this.mag -= other.mag * Math.pow(10, -diff);
        if (this.mag < 0) { this.mag = 0; this.exp = 0; }
        this.normalize();
        return this;
    }

    times(num) {
        if (num instanceof BigNum) { this.mag *= num.mag; this.exp += num.exp; }
        else { this.mag *= num; }
        this.normalize();
        return this;
    }

    toString() {
        if (this.exp >= 1000000) return "ee" + Math.log10(this.exp).toFixed(6);
        if (this.exp >= 3) return this.mag.toFixed(2) + "e" + Math.floor(this.exp).toLocaleString();
        return (this.mag * Math.pow(10, this.exp)).toFixed(2);
    }

    gte(other) {
        if (this.exp !== other.exp) return this.exp > other.exp;
        return this.mag >= other.mag - 1e-10;
    }

    static copy(bn) { return new BigNum(bn.mag, bn.exp); }
}

const config = [
    {base:2, m:2}, {base:16, m:4}, {base:512, m:8}, {base:65536, m:16},
    {base:3.35e7, m:32}, {base:6.8e10, m:64}, {base:5.6e14, m:128}, {base:1.8e19, m:256}
];

let stars, generators, sacrificeMult, permanentPower, boostLevel, boostMult, lastUpdate = Date.now(), overdrive = false;

function hardReset() {
    if(confirm("進行状況をすべて消去して最初からやり直しますか？")){
        localStorage.clear();
        location.reload();
    }
}

function initData() {
    stars = new BigNum(1, 1);
    sacrificeMult = new BigNum(1, 0);
    permanentPower = permanentPower || 1.0;
    boostLevel = boostLevel || 0;
    boostMult = boostMult || new BigNum(1, 0);
    generators = config.map((c) => ({
        amount: new BigNum(0, 0),
        bought: 0,
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    generators[0].amount = new BigNum(1, 0);
}

// --- Boost Logic ---
function getBoostCost() {
    return new BigNum(1, 5 + (boostLevel * 2));
}

function buyBoost() {
    let cost = getBoostCost();
    if (stars.gte(cost)) {
        stars.minus(cost);
        boostLevel++;
        boostMult.times(2.0); // 1回につき2倍
        flashRow('boost');
    }
}

function buy(i) {
    let g = generators[i];
    if (stars.gte(g.cost)) {
        stars.minus(g.cost);
        g.amount.plus(new BigNum(1, 0));
        g.bought++;
        g.cost.times(g.costMult);
        g.prodMult.times(1.091);
        flashRow(i);
        return true;
    }
    return false;
}

function buyMaxAll() {
    for (let i = 7; i >= 0; i--) {
        while (stars.gte(generators[i].cost)) { buy(i); }
    }
}

function getSacBonus() {
    let exp = generators[0].amount.exp;
    return (exp < 10) ? new BigNum(1, 0) : new BigNum(Math.pow(exp / 10, 2), 0);
}

function sacrifice() {
    if (generators[0].amount.exp < 10) return;
    sacrificeMult = getSacBonus();
    for (let i = 0; i < 7; i++) {
        generators[i].amount = new BigNum(0, 0);
        generators[i].bought = 0;
        generators[i].cost = new BigNum(config[i].base, 0);
        generators[i].prodMult = new BigNum(1, 0);
    }
    generators[0].amount = new BigNum(1, 0);
    flashRow(7);
}

function getPrestigeGain() {
    if (stars.exp < 30) return 1.0;
    let gain = Math.pow(stars.exp / 30, 0.5) * 4;
    return Math.max(permanentPower, gain);
}

function prestige() {
    let gain = getPrestigeGain();
    if (stars.exp < 38 || gain <= permanentPower) return;
    permanentPower = gain;
    // Prestigeリセット時はBoostは維持、GenとStarsを初期化
    initData(); 
}

function gameLoop() {
    const now = Date.now();
    let diff = (now - lastUpdate) / 1000;
    lastUpdate = now;

    if (overdrive) {
        diff *= 1000;
        document.getElementById("overdrive-text").style.display = "block";
    } else {
        document.getElementById("overdrive-text").style.display = "none";
        diff = Math.min(diff, 1.0);
    }

    let globalMult = BigNum.copy(boostMult).times(permanentPower);

    // 1. ジェネレーター階層生産 (8->7->...->1)
    for (let i = 7; i > 0; i--) {
        let genProd = BigNum.copy(generators[i].amount).times(generators[i].prodMult).times(globalMult);
        if (i === 7) genProd.times(sacrificeMult);
        generators[i - 1].amount.plus(genProd.times(diff));
    }

    // 2. 星の生産
    let starGain = BigNum.copy(generators[0].amount).times(generators[0].prodMult).times(globalMult);
    stars.plus(BigNum.copy(starGain).times(diff));

    updateUI(starGain);
}

function updateUI(gain) {
    document.getElementById("display").innerText = stars.toString() + " stars";
    document.getElementById("ps-display").innerText = "+" + gain.toString() + "/s";
    document.getElementById("pow-display").innerText = `Power: x${permanentPower.toFixed(2)} | Boost: x${boostMult.toString()}`;

    // Boost UI
    let bCost = getBoostCost();
    const bBtn = document.getElementById("boost-btn");
    if(bBtn) {
        document.getElementById("boost-level").innerText = boostLevel;
        document.getElementById("boost-cost").innerText = bCost.toString();
        bBtn.disabled = !stars.gte(bCost);
    }

    // Sacrifice & Prestige UI
    let sacB = getSacBonus();
    document.getElementById("sac-bonus-text").innerText = (generators[0].amount.exp < 10) ? "Require e10 Gen 1" : `Next: x${sacB.toString()} to Gen 8`;
    document.getElementById("sac-btn").disabled = (generators[0].amount.exp < 10);

    let pGain = getPrestigeGain();
    document.getElementById("prestige-btn").disabled = (stars.exp < 38);
    document.getElementById("prestige-info-text").innerText = (stars.exp < 38) ? "Require e38 stars" : `Next: x${pGain.toFixed(3)} Power`;

    // Generators UI
    generators.forEach((gen, i) => {
        document.getElementById(`amt-${i}`).innerText = gen.amount.toString();
        document.getElementById(`cost-${i}`).innerText = gen.cost.toString();
        document.getElementById(`mult-${i}`).innerText = "x" + gen.prodMult.toString();
        document.getElementById(`buy-btn-${i}`).disabled = !stars.gte(gen.cost);
    });
}

function saveGame(show) {
    const data = { 
        p: stars, sm: sacrificeMult, g: generators, 
        pow: permanentPower, bl: boostLevel, bm: boostMult, t: Date.now() 
    };
    localStorage.setItem("starSaveUltimate_v4", JSON.stringify(data));
    if (show) {
        const p = document.getElementById("save-popup");
        if(p) { p.style.opacity = 1; setTimeout(() => p.style.opacity = 0, 1000); }
    }
}

function loadGame() {
    const saved = localStorage.getItem("starSaveUltimate_v4");
    if (!saved) return;
    try {
        const d = JSON.parse(saved);
        stars = new BigNum(d.p.mag, d.p.exp);
        sacrificeMult = new BigNum(d.sm.mag, d.sm.exp);
        permanentPower = d.pow || 1.0;
        boostLevel = d.bl || 0;
        boostMult = d.bm ? new BigNum(d.bm.mag, d.bm.exp) : new BigNum(1, 0);
        d.g.forEach((g, i) => {
            generators[i].amount = new BigNum(g.amount.mag, g.amount.exp);
            generators[i].bought = g.bought;
            generators[i].cost = new BigNum(g.cost.mag, g.cost.exp);
            generators[i].prodMult = new BigNum(g.prodMult.mag, g.prodMult.exp);
        });
    } catch (e) { console.error("Load failed", e); initData(); }
}

function flashRow(i) {
    const id = i === 'boost' ? 'boost-container' : `row-${i}`;
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 150);
    }
}

// Input
window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k >= "1" && k <= "8") buy(parseInt(k) - 1);
    if (k === "m") buyMaxAll();
    if (k === "r") buyBoost();
    if (k === "s") saveGame(true);
    if (k === "b") sacrifice();
    if (k === "p") prestige();
    if (k === "o") overdrive = true;
});
window.addEventListener("keyup", (e) => { if (e.key.toLowerCase() === "o") overdrive = false; });

// Draw Starfield
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let bgStars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), v: Math.random() * 0.0005 }));
function draw() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    bgStars.forEach(s => {
        ctx.fillRect(s.x * canvas.width, s.y * canvas.height, 1, 1);
        s.y = (s.y + s.v) % 1;
    });
    requestAnimationFrame(draw);
}

// Initialize UI and Intervals
initData();
loadGame();
document.getElementById("gen-list-render").innerHTML = generators.map((_, i) => `
    <div class="gen-row" id="row-${i}">
        <div>
            <span class="key-badge">${i + 1}</span>
            <strong>Gen ${i + 1}</strong> <span id="mult-${i}" style="color:#0af; font-size:0.8rem;">x1.00</span><br>
            <small id="amt-${i}">0</small>
        </div>
        <button class="buy-btn" id="buy-btn-${i}" onclick="buy(${i})">
            Buy (Cost: <span id="cost-${i}">0</span>)
        </button>
    </div>
`).join('');

draw();
setInterval(gameLoop, 50);
setInterval(() => saveGame(false), 10000);
