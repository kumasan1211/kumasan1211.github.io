class BigNum {
    constructor(mag, exp) {
        this.mag = isNaN(mag) ? 0 : mag;
        this.exp = isNaN(exp) ? 0 : exp;
        this.normalize();
    }
    normalize() {
        if (this.mag <= 1e-15) {
            this.mag = 0; this.exp = 0; return;
        }
        let log = Math.log10(Math.abs(this.mag));
        this.exp += Math.floor(log);
        this.mag = Math.pow(10, log - Math.floor(log));
    }
    plus(other) {
        let diff = this.exp - other.exp;
        if (diff > 15) return this;
        if (diff < -15) {
            if(other.mag > 0) { this.mag = other.mag; this.exp = other.exp; }
            return this;
        }
        this.mag = this.mag + other.mag * Math.pow(10, -diff);
        this.normalize();
        return this;
    }
    minus(other) {
        if (this.exp > other.exp + 15) return this;
        this.mag -= other.mag * Math.pow(10, other.exp - this.exp);
        if (this.mag < 0) { this.mag = 0; this.exp = 0; }
        this.normalize();
        return this;
    }
    times(num) {
        if (num instanceof BigNum) {
            this.mag *= num.mag;
            this.exp += num.exp;
        } else {
            this.mag *= num;
        }
        this.normalize();
        return this;
    }
    toString() {
        if (this.exp >= 100000000) return "ee" + Math.log10(this.exp).toFixed(6);
        if (this.exp >= 3) return this.mag.toFixed(2) + "e" + Math.floor(this.exp).toLocaleString();
        return (this.mag * Math.pow(10, this.exp)).toFixed(2);
    }
    gte(other) {
        return this.exp > other.exp || (this.exp === other.exp && this.mag >= other.mag - 1e-10);
    }
    static copy(bn) {
        return new BigNum(bn.mag, bn.exp);
    }
}

const config = [
    {base:2,m:2},{base:16,m:4},{base:512,m:8},{base:65536,m:16},
    {base:3.35e7,m:32},{base:6.8e10,m:64},{base:5.6e14,m:128},{base:1.8e19,m:256}
];

let stars, generators, sacrificeMult, permanentPower, lastUpdate = Date.now(), overdrive = false;

function initData() {
    stars = new BigNum(1, 1);
    sacrificeMult = new BigNum(1, 0);
    if (permanentPower === undefined) permanentPower = 1.0;
    generators = config.map((c) => ({
        amount: new BigNum(0, 0),
        bought: 0,
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    generators[0].amount = new BigNum(1, 0);
}
function getTotalBought() {
    // すべてのジェネレーターの bought（購入数）を合計
    return generators.reduce((sum, g) => sum + g.bought, 0);
}

function getSynergyMult() {
    // 2^(合計購入数 / 8) を計算
    return Math.pow(2, getTotalBought() / 8);
}

function buy(i) {
    let g = generators[i];
    if (stars.gte(g.cost)) {
        stars.minus(g.cost);
        g.amount.plus(new BigNum(1, 0));
        g.bought++;
        g.cost.times(g.costMult);
        if (g.bought % 10 === 0) g.prodMult.times(2);
        flashRow(i);
        return true;
    }
    return false;
}

function buyMaxAll() {
    for (let i = 7; i >= 0; i--) {
        let bought = false;
        while (stars.gte(generators[i].cost)) {
            buy(i);
            bought = true;
        }
        if (bought) flashRow(i);
    }
}

function sacrifice() {
    let bonus = getSacBonus();
    if (generators[0].amount.exp < 10) return;
    sacrificeMult = bonus;
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
    // 星が e30 未満なら 1.0 固定
    if (stars.exp < 30) return 1.0;
    
    // 計算式を調整（例: e30で約4.1倍から始まり、緩やかに上昇）
    // 前回の permanentPower を下回らないように Math.max を使用
    let gain = Math.pow(stars.exp / 30, 0.5)*4; 
    return Math.max(permanentPower, gain);
}

function prestige() {
    let gain = getPrestigeGain();
    // 現在の倍率より高い数値が得られる場合のみ Prestige 可能にする
    if (stars.exp < 30 || gain <= permanentPower) return;
    
    permanentPower = gain;
    initData();
}

function getSacBonus() {
    let exp = generators[0].amount.exp;
    return (exp < 10) ? new BigNum(1,0) : new BigNum(Math.pow(exp / 10, 2), 0);
}

window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k >= "1" && k <= "8") buy(parseInt(k)-1);
    if (k === "m") buyMaxAll();
    if (k === "s") saveGame(true);
    if (k === "b") sacrifice();
    if (k === "p") prestige();
    if (k === "o") overdrive = true;
});

window.addEventListener("keyup", (e) => {
    if (e.key.toLowerCase() === "o") overdrive = false;
});

function gameLoop() {
    const now = Date.now();
    let diff = (now - lastUpdate) / 1000;
    lastUpdate = now;

    if (overdrive) {
        diff *= 1000;
        document.getElementById("overdrive-text").style.display = "block";
    } else {
        document.getElementById("overdrive-text").style.display = "none";
        diff = Math.min(diff, 1);
    }

    let pPower = (permanentPower || 1.0);
    
    for (let i = 7; i > 0; i--) {
        let m = BigNum.copy(generators[i].prodMult).times(pPower);
        if (i === 7) m.times(sacrificeMult);
        generators[i-1].amount.plus(BigNum.copy(generators[i].amount).times(m).times(diff));
    }
    let gain = BigNum.copy(generators[0].amount).times(generators[0].prodMult).times(pPower);
    stars.plus(BigNum.copy(gain).times(diff));
    updateUI(gain, pPower);
}

function updateUI(gain, pPower) {
        document.getElementById("display").innerText = stars.toString() + " stars";
    document.getElementById("ps-display").innerText = "+" + gain.toString() + "/s";
    
    // Prestige倍率とSynergy倍率を合わせた値を表示
    document.getElementById("pow-display").innerText = `Total Power: x${pPower.toFixed(3)}`;
    
    document.getElementById("display").innerText = stars.toString() + " stars";
    document.getElementById("ps-display").innerText = "+" + gain.toString() + "/s";
    document.getElementById("pow-display").innerText = "Power: x" + pPower.toFixed(3);

    let sacB = getSacBonus();
    document.getElementById("sac-bonus-text").innerText = (generators[0].amount.exp < 10) ? "Require e10 Gen 1" : `Next: x${sacB.toString()} to Gen 8`;
    document.getElementById("sac-btn").disabled = (generators[0].amount.exp < 10);

    let pGain = getPrestigeGain();
    document.getElementById("prestige-btn").disabled = (stars.exp < 38);
    document.getElementById("prestige-info-text").innerText = (stars.exp < 38) ? "Require e38 stars" : `Next: x${pGain.toFixed(3)} Power`;

    generators.forEach((gen, i) => {
        document.getElementById(`amt-${i}`).innerText = gen.amount.toString();
        document.getElementById(`cost-${i}`).innerText = gen.cost.toString();
        document.getElementById(`buy-btn-${i}`).disabled = !stars.gte(gen.cost);
    
    });
}

function flashRow(i) {
    const el = document.getElementById(`row-${i}`);
    if(el) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 150);
    }
}

function hardReset() {
    if(confirm("REALLY RESET?")){localStorage.clear(); location.reload();}
}

function saveGame(show) {
    const data = { p:stars, sm:sacrificeMult, g:generators, pow:permanentPower, t:Date.now() };
    localStorage.setItem("starSaveUltimate_v3", JSON.stringify(data));
    if(show){
        const p=document.getElementById("save-popup");
        p.style.opacity=1;
        setTimeout(()=>p.style.opacity=0,1000);
    }
}

function loadGame() {
    const d = JSON.parse(localStorage.getItem("starSaveUltimate_v3"));
    if(!d) return;
    try {
        stars = new BigNum(d.p.mag, d.p.exp);
        sacrificeMult = new BigNum(d.sm.mag, d.sm.exp);
        permanentPower = d.pow || 1.0;
        d.g.forEach((g,i) => {
            generators[i].amount = new BigNum(g.amount.mag, g.amount.exp);
            generators[i].bought = g.bought;
            generators[i].cost = new BigNum(g.cost.mag, g.cost.exp);
            generators[i].prodMult = new BigNum(g.prodMult.mag, g.prodMult.exp);
        });
    } catch(e) {
        initData();
    }
}

// Background Animation
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let bgStars = Array.from({length:80}, () => ({x:Math.random(), y:Math.random(), v:Math.random()*0.0005}));

function draw() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff';
    bgStars.forEach(s=>{
        ctx.fillRect(s.x*canvas.width, s.y*canvas.height, 1, 1);
        s.y=(s.y+s.v)%1;
    });
    requestAnimationFrame(draw);
}

// Start Game
initData();
loadGame();
document.getElementById("gen-list-render").innerHTML = generators.map((_, i) => `
    <div class="gen-row" id="row-${i}">
        <div><span class="key-badge">${i+1}</span><strong>Gen ${i+1}</strong><br><small id="amt-${i}">0</small></div>
        <button class="buy-btn" id="buy-btn-${i}" onclick="buy(${i})">Buy (Cost: <span id="cost-${i}">0</span>)</button>
    </div>
`).join('');

draw();
setInterval(gameLoop, 50);
setInterval(()=>saveGame(false), 10000);

