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
        if (this.exp >= 308.2547) return "Infinity";
        if (this.exp >= 6) return this.mag.toFixed(2) + "e" + Math.floor(this.exp).toLocaleString();
        let val = this.mag * Math.pow(10, this.exp);
        return val < 1000 ? val.toFixed(2) : Math.floor(val).toLocaleString();
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

let stars, generators, sacrificeMult, permanentPower, boostLevel, boostMult, ip = 0, hasInf = false, lastUpdate = Date.now(), overdrive = false;

function initData(isInfReset = false) {
    stars = new BigNum(1, 1);
    sacrificeMult = new BigNum(1, 0);
    // Prestige Power は Infinity リセット時にのみ初期化
    if (isInfReset) permanentPower = new BigNum(1, 0);
    else permanentPower = permanentPower || new BigNum(1, 0);
    
    boostMult = new BigNum(1, 0);
    boostLevel = 0;
    generators = config.map(c => ({
        amount: new BigNum(0, 0),
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    generators[0].amount = new BigNum(1, 0);
    
    if (document.getElementById("gen-list-render")) renderList();
}

function renderList() {
    document.getElementById("gen-list-render").innerHTML = generators.map((_, i) => `
        <div class="gen-row" id="row-${i}">
            <div class="gen-info">
                <span class="key-badge">${i+1}</span><strong>GEN ${i+1}</strong> 
                <span id="mult-${i}" class="gen-mult">x1.00</span><br>
                <small id="amt-${i}">0.00</small>
            </div>
            <button class="buy-btn" id="buy-btn-${i}" onclick="buy(${i})">BUY: <span id="cost-${i}">0</span></button>
        </div>`).join('');
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

function buyBoost() {
    let cost = new BigNum(1, 5 + (boostLevel * 2));
    if (stars.gte(cost)) {
        stars.minus(cost);
        boostLevel++;
        boostMult.times(2.0);
        flashRow('boost');
    }
}

function buyMaxAll() {
    for (let i = 7; i >= 0; i--) while (stars.gte(generators[i].cost)) buy(i);
}

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
    // 指数スケーリング: (指数-30)の20%を新しいPowerの指数にする
    let nextPow = new BigNum(1, (stars.exp - 30) * 0.2);
    if (nextPow.gte(permanentPower)) permanentPower = nextPow;
    initData(false);
}

function infinityReset() {
    if (stars.exp < 308.25) return; // 1.79e308 未満なら無視
    ip += 1;
    hasInf = true;
    initData(true); // 全リセット
    saveGame(true);
}

function gameLoop() {
    let now = Date.now();
    let diff = (now - lastUpdate) / 1000;
    lastUpdate = now;
    if (overdrive) diff *= 1000;

    // オートバイヤー: Infinity到達後のみ作動
    if (hasInf) {
        for (let i = 0; i < 8; i++) {
            if (stars.gte(generators[i].cost)) buy(i);
        }
    }

    let globalMult = BigNum.copy(boostMult).times(permanentPower);

    // 階層生産
    for (let i = 7; i > 0; i--) {
        let p = BigNum.copy(generators[i].amount).times(generators[i].prodMult).times(globalMult);
        if (i === 7) p.times(sacrificeMult);
        generators[i-1].amount.plus(p.times(diff));
    }
    // 星の生産
    let gain = BigNum.copy(generators[0].amount).times(generators[0].prodMult).times(globalMult);
    stars.plus(BigNum.copy(gain).times(diff));

    // Infinity キャップ
    if (stars.exp >= 308.2547) stars = new BigNum(1.7976, 308);

    updateUI(gain);
}

function updateUI(gain) {
    document.getElementById("display").innerText = stars.toString() + (stars.exp >= 308.25 ? "" : " stars");
    document.getElementById("ps-display").innerText = stars.exp >= 308.25 ? "MAXED" : "+" + gain.toString() + "/s";
    document.getElementById("pow-display").innerText = `Power: x${permanentPower.toString()}`;
    if (document.getElementById("ip-display")) document.getElementById("ip-display").innerText = `IP: ${ip}`;
    
    // Infinity ボタンの表示
    const infBtn = document.getElementById("inf-btn");
    if (infBtn) infBtn.style.display = stars.exp >= 308.25 ? "block" : "none";

    // Boost UI
    let bCost = new BigNum(1, 5 + (boostLevel * 2));
    document.getElementById("boost-level").innerText = boostLevel;
    document.getElementById("boost-info").innerText = `Cost: ${bCost.toString()}`;
    document.getElementById("boost-btn").disabled = !stars.gte(bCost);

    // Buttons
    document.getElementById("sac-btn").disabled = generators[0].amount.exp < 10;
    let sacBonus = generators[0].amount.exp < 10 ? "1.00" : new BigNum(Math.pow(generators[0].amount.exp / 10, 2), 0).toString();
    document.getElementById("sac-bonus-text").innerText = generators[0].amount.exp < 10 ? "Require e10 Gen 1" : `Next: x${sacBonus} to Gen 8`;

    document.getElementById("prestige-btn").disabled = stars.exp < 30;
    let pNext = stars.exp < 30 ? new BigNum(1,0) : new BigNum(1, (stars.exp - 30) * 0.2);
    document.getElementById("prestige-info-text").innerText = stars.exp < 30 ? "Require e30 stars" : `Next Power: x${pNext.toString()}`;

    generators.forEach((g, i) => {
        document.getElementById(`amt-${i}`).innerText = g.amount.toString();
        document.getElementById(`cost-${i}`).innerText = g.cost.toString();
        document.getElementById(`mult-${i}`).innerText = "x" + g.prodMult.toString();
        document.getElementById(`buy-btn-${i}`).disabled = !stars.gte(g.cost);
    });
}

function saveGame(show) {
    const data = { p:stars, sm:sacrificeMult, g:generators, pow:permanentPower, bl:boostLevel, bm:boostMult, ip:ip, hi:hasInf };
    localStorage.setItem("star_idle_inf_v7", JSON.stringify(data));
    if(show) { let p=document.getElementById("save-popup"); if(p){p.style.opacity=1; setTimeout(()=>p.style.opacity=0, 1000);}}
}

function loadGame() {
    let s = localStorage.getItem("star_idle_inf_v7");
    if (!s) return;
    try {
        let d = JSON.parse(s);
        stars = new BigNum(d.p.mag, d.p.exp);
        sacrificeMult = new BigNum(d.sm.mag, d.sm.exp);
        permanentPower = new BigNum(d.pow.mag, d.pow.exp);
        boostLevel = d.bl || 0;
        boostMult = new BigNum(d.bm.mag, d.bm.exp);
        ip = d.ip || 0;
        hasInf = d.hi || false;
        d.g.forEach((g, i) => {
            generators[i].amount = new BigNum(g.amount.mag, g.amount.exp);
            generators[i].cost = new BigNum(g.cost.mag, g.cost.exp);
            generators[i].prodMult = new BigNum(g.prodMult.mag, g.prodMult.exp);
        });
    } catch(e) { console.error("Load Error", e); }
}

function flashRow(i) {
    let id = i === 'boost' ? 'boost-btn' : `row-${i}`;
    let el = document.getElementById(id);
    if(el){ el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),150); }
}

function hardReset() { if(confirm("全データを削除してリセットしますか？")){ localStorage.clear(); location.reload(); } }

window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if(k >= "1" && k <= "8") buy(parseInt(k)-1);
    if(k === "m") buyMaxAll();
    if(k === "r") buyBoost();
    if(k === "b") sacrifice();
    if(k === "p") prestige();
    if(k === "i") infinityReset();
    if(k === "s") saveGame(true);
    if(k === "o") overdrive = true;
};
window.onkeyup = e => { if(e.key.toLowerCase() === "o") overdrive = false; };

const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let bgStars = Array.from({length:100}, () => ({x:Math.random(), y:Math.random(), v:Math.random()*0.0006, s:Math.random()*2}));
function draw() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    bgStars.forEach(s => { 
        ctx.fillStyle = `rgba(0, 255, 0, ${Math.random()*0.5 + 0.5})`;
        ctx.fillRect(s.x*canvas.width, s.y*canvas.height, s.s, s.s); 
        s.y = (s.y+s.v)%1; 
    });
    requestAnimationFrame(draw);
}

window.onload = () => {
    initData();
    loadGame();
    draw();
    setInterval(gameLoop, 50);
    setInterval(()=>saveGame(false), 10000);
};
