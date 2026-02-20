class BigNum {
    constructor(mag, exp) { this.mag = isNaN(mag) ? 0 : mag; this.exp = isNaN(exp) ? 0 : exp; this.normalize(); }
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
        this.mag += other.mag * Math.pow(10, -diff);
        this.normalize(); return this;
    }
    minus(other) {
        let diff = this.exp - other.exp;
        if (diff > 15) return this;
        if (diff < -15) { this.mag = 0; this.exp = 0; return this; }
        this.mag -= other.mag * Math.pow(10, -diff);
        if (this.mag < 0) { this.mag = 0; this.exp = 0; }
        this.normalize(); return this;
    }
    times(num) {
        if (num instanceof BigNum) { this.mag *= num.mag; this.exp += num.exp; }
        else { this.mag *= num; }
        this.normalize(); return this;
    }
    toString() {
        if (this.exp >= 1000000) return "ee" + Math.log10(this.exp).toFixed(4);
        if (this.exp >= 3) return this.mag.toFixed(2) + "e" + Math.floor(this.exp).toLocaleString();
        // 1未満の端数を消さないように調整
        let val = this.mag * Math.pow(10, this.exp);
        return val < 1000 ? val.toFixed(2) : val.toExponential(2);
    }
    gte(other) {
        if (this.exp !== other.exp) return this.exp > other.exp;
        return this.mag >= other.mag - 1e-10;
    }
    static copy(bn) { return new BigNum(bn.mag, bn.exp); }
}

const config = [
    {base:2, m:2}, {base:16, m:4}, {base:512, m:8}, {base:65536, m:16},
    {base:3.3e7, m:32}, {base:6.8e10, m:64}, {base:5.6e14, m:128}, {base:1.8e19, m:256}
];

let stars, generators, sacrificeMult, permanentPower = 1.0, boostLevel = 0, boostMult, lastUpdate = Date.now(), overdrive = false;

function initData() {
    stars = new BigNum(1, 1);
    sacrificeMult = new BigNum(1, 0);
    boostMult = new BigNum(1, 0); 
    boostLevel = 0;
    generators = config.map(c => ({
        amount: new BigNum(0, 0),
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    // 初期状態でGen 1を1個付与
    generators[0].amount = new BigNum(1, 0);
    
    renderList();
    updateUI(new BigNum(0,0));
}

function renderList() {
    const renderTarget = document.getElementById("gen-list-render");
    if (!renderTarget) return;
    renderTarget.innerHTML = generators.map((_, i) => `
        <div class="gen-row" id="row-${i}">
            <div class="gen-info">
                <span class="key-badge">${i+1}</span><strong>GEN ${i+1}</strong> 
                <span id="mult-${i}" class="gen-mult">x1.00</span><br>
                <small id="amt-${i}">0.00</small>
            </div>
            <button class="buy-btn" id="buy-btn-${i}" onclick="buy(${i})">Cost: <span id="cost-${i}">0</span></button>
        </div>`).join('');
}

// --- Boostの実装 ---
function buyBoost() {
    let cost = new BigNum(1, 5 + (boostLevel * 2));
    if (stars.gte(cost)) {
        stars.minus(cost);
        boostLevel++;
        boostMult.times(2.0);
        flashRow('boost');
    }
}

function buy(i) {
    let g = generators[i];
    if (stars.gte(g.cost)) {
        stars.minus(g.cost);
        g.amount.plus(new BigNum(1, 0));
        g.cost.times(g.costMult);
        g.prodMult.times(1.091);
        flashRow(i);
    }
}

function buyMaxAll() { for (let i = 7; i >= 0; i--) while (stars.gte(generators[i].cost)) buy(i); }

function sacrifice() {
    if (generators[0].amount.exp < 10) return;
    sacrificeMult = new BigNum(Math.pow(generators[0].amount.exp / 10, 2), 0);
    for (let i = 0; i < 7; i++) {
        generators[i].amount = new BigNum(0,0);
        generators[i].cost = new BigNum(config[i].base,0);
        generators[i].prodMult = new BigNum(1,0);
    }
    generators[0].amount = new BigNum(1,0);
    flashRow(7);
}

function prestige() {
    if (stars.exp < 30) return;
    permanentPower = Math.max(permanentPower, Math.pow(stars.exp / 30, 0.5) * 4);
    // Prestige時、ブーストレベルは維持
    let currentBoostLv = boostLevel;
    let currentBoostMult = BigNum.copy(boostMult);
    initData();
    boostLevel = currentBoostLv;
    boostMult = currentBoostMult;
}

function gameLoop() {
    let now = Date.now();
    let diff = (now - lastUpdate) / 1000;
    lastUpdate = now;
    if (overdrive) diff *= 1000;

    let globalMult = BigNum.copy(boostMult).times(permanentPower);
    
    // 階層生産 (8->7, 7->6...)
    for (let i = 7; i > 0; i--) {
        let p = BigNum.copy(generators[i].amount).times(generators[i].prodMult).times(globalMult);
        if (i === 7) p.times(sacrificeMult);
        generators[i-1].amount.plus(p.times(diff));
    }
    // 星生産
    let gain = BigNum.copy(generators[0].amount).times(generators[0].prodMult).times(globalMult);
    stars.plus(BigNum.copy(gain).times(diff));

    updateUI(gain);
}

function updateUI(gain) {
    document.getElementById("display").innerText = stars.toString() + " stars";
    document.getElementById("ps-display").innerText = "+" + gain.toString() + "/s";
    
    // 全体の合計倍率を表示
    let totalMult = BigNum.copy(boostMult).times(permanentPower);
    document.getElementById("pow-display").innerText = `Total Power: x${totalMult.toString()}`;
    
    // Boost UI 更新
    let bCost = new BigNum(1, 5 + (boostLevel * 2));
    const bBtn = document.getElementById("boost-btn");
    if(bBtn) {
        document.getElementById("boost-info").innerText = `Lv ${boostLevel} | Cost: ${bCost.toString()}`;
        bBtn.disabled = !stars.gte(bCost);
    }

    // Sac / Prestige UI
    document.getElementById("sac-btn").disabled = generators[0].amount.exp < 10;
    let sacVal = generators[0].amount.exp < 10 ? "1.00" : new BigNum(Math.pow(generators[0].amount.exp / 10, 2), 0).toString();
    document.getElementById("sac-bonus-text").innerText = generators[0].amount.exp < 10 ? "Require e10 Gen 1" : `Next: x${sacVal} to Gen 8`;

    document.getElementById("prestige-btn").disabled = stars.exp < 30;
    let pGain = Math.max(permanentPower, Math.pow(stars.exp / 30, 0.5) * 4);
    document.getElementById("prestige-info-text").innerText = stars.exp < 30 ? "Require e30 stars" : `Next: x${pGain.toFixed(2)} Power`;

    generators.forEach((g, i) => {
        document.getElementById(`amt-${i}`).innerText = g.amount.toString();
        document.getElementById(`cost-${i}`).innerText = g.cost.toString();
        document.getElementById(`mult-${i}`).innerText = "x" + g.prodMult.toString();
        document.getElementById(`buy-btn-${i}`).disabled = !stars.gte(g.cost);
    });
}

// --- システム系 ---
function saveGame(show) {
    const data = { p:stars, sm:sacrificeMult, g:generators, pow:permanentPower, bl:boostLevel, bm:boostMult };
    localStorage.setItem("star_final_save", JSON.stringify(data));
    if(show) { let p=document.getElementById("save-popup"); if(p){p.style.opacity=1; setTimeout(()=>p.style.opacity=0, 1000);}}
}

function loadGame() {
    let s = localStorage.getItem("star_final_save");
    if (!s) return;
    let d = JSON.parse(s);
    stars = new BigNum(d.p.mag, d.p.exp);
    sacrificeMult = new BigNum(d.sm.mag, d.sm.exp);
    permanentPower = d.pow || 1;
    boostLevel = d.bl || 0;
    boostMult = new BigNum(d.bm.mag, d.bm.exp);
    d.g.forEach((g, i) => {
        generators[i].amount = new BigNum(g.amount.mag, g.amount.exp);
        generators[i].cost = new BigNum(g.cost.mag, g.cost.exp);
        generators[i].prodMult = new BigNum(g.prodMult.mag, g.prodMult.exp);
    });
}

function flashRow(i) {
    let id = i === 'boost' ? 'boost-btn' : `row-${i}`;
    let el = document.getElementById(id);
    if(el){ el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),150); }
}

function hardReset() { if(confirm("RESET ALL?")){ localStorage.clear(); location.reload(); } }

// キーバインド
window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if(k >= "1" && k <= "8") buy(k-1);
    if(k === "m") buyMaxAll();
    if(k === "r") buyBoost();
    if(k === "b") sacrifice();
    if(k === "p") prestige();
    if(k === "s") saveGame(true);
    if(k === "o") overdrive = true;
};
window.onkeyup = e => { if(e.key.toLowerCase() === "o") overdrive = false; };

// 背景描画
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let bgStars = Array.from({length:100}, () => ({x:Math.random(), y:Math.random(), v:Math.random()*0.0006, s:Math.random()*2}));
function draw() {
    if(!canvas) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    bgStars.forEach(s => { 
        ctx.fillStyle = `rgba(0, 255, 0, ${Math.random()*0.5 + 0.5})`;
        ctx.fillRect(s.x*canvas.width, s.y*canvas.height, s.s, s.s); 
        s.y = (s.y+s.v)%1; 
    });
    requestAnimationFrame(draw);
}

// 実行
window.onload = () => {
    initData();
    loadGame();
    // HTMLにBoostボタンがない場合は自動生成
    if(!document.getElementById("boost-btn")){
        const area = document.querySelector(".action-area");
        area.insertAdjacentHTML('afterbegin', `
            <button class="btn-base boost-btn" id="boost-btn" onclick="buyBoost()" style="background:#033; border:1px solid #0ff; color:#0ff; margin-bottom:10px;">
                <span class="btn-label">STAR BOOST [R]</span>
                <small id="boost-info">Cost: 1.00e5</small>
            </button>
        `);
    }
    draw();
    setInterval(gameLoop, 50);
    setInterval(()=>saveGame(false), 10000);
};
