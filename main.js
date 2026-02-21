/**
 * 1. BigNum Engine
 */
class BigNum {
    constructor(mag, exp) {
        this.mag = isNaN(mag) ? 0 : mag;
        this.exp = isNaN(exp) ? 0 : exp;
        this.normalize();
    }
    normalize() {
        if (this.mag === 0) { this.exp = 0; return; }
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

/**
 * 2. Constants & Player State
 */
const GEN_CONFIG = [
    { base: 2, m: 2 }, { base: 16, m: 4 }, { base: 512, m: 8 }, { base: 65536, m: 16 },
    { base: 3.3e7, m: 32 }, { base: 6.8e10, m: 64 }, { base: 5.6e14, m: 128 }, { base: 1.8e19, m: 256 }
];
const INF_LIMIT = 308.2547;

let player = {
    stars: new BigNum(1, 1),
    generators: [],
    sacrificeMult: new BigNum(1, 0),
    permanentPower: new BigNum(1, 0),
    boostLevel: 0,
    boostMult: new BigNum(1, 0),
    ip: 0,
    hasInf: false,
    lastUpdate: Date.now(),
    overdrive: false
};

/**
 * 3. Initializer & UI Render
 */
function initPlayer(isInfReset = false) {
    player.stars = new BigNum(1, 1);
    player.sacrificeMult = new BigNum(1, 0);
    player.boostLevel = 0;
    player.boostMult = new BigNum(1, 0);
    if (isInfReset) player.permanentPower = new BigNum(1, 0);
    else player.permanentPower = player.permanentPower || new BigNum(1, 0);

    player.generators = GEN_CONFIG.map(c => ({
        amount: new BigNum(0, 0),
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    player.generators[0].amount = new BigNum(1, 0);

    renderGeneratorList();
}

function renderGeneratorList() {
    const target = document.getElementById("gen-list-render");
    if (!target) return;
    target.innerHTML = player.generators.map((_, i) => `
        <div class="gen-row" id="row-${i}">
            <div class="gen-info">
                <span class="key-badge">${i+1}</span><strong>GEN ${i+1}</strong> 
                <span id="mult-${i}" class="gen-mult">x1.00</span><br>
                <small id="amt-${i}">0.00</small>
            </div>
            <button class="buy-btn" id="buy-btn-${i}" onclick="buyGenerator(${i})">BUY: <span id="cost-${i}">0</span></button>
        </div>`).join('');
}

/**
 * 4. Core Logic
 */
function buyGenerator(i) {
    let g = player.generators[i];
    if (player.stars.gte(g.cost)) {
        player.stars.minus(g.cost);
        g.amount.plus(new BigNum(1, 0));
        g.cost.times(g.costMult);
        g.prodMult.times(1.091);
        flashEffect(i);
    }
}

function buyBoost() {
    let cost = new BigNum(1, 5 + (player.boostLevel * 2));
    if (player.stars.gte(cost)) {
        player.stars.minus(cost);
        player.boostLevel++;
        player.boostMult.times(2.0);
        flashEffect('boost');
    }
}

function prestige() {
    if (player.stars.exp < 30) return;
    let nextPow = new BigNum(1, (player.stars.exp - 30) * 0.2);
    if (nextPow.gte(player.permanentPower)) player.permanentPower = nextPow;
    initPlayer(false);
}

function infinityReset() {
    if (player.stars.exp < INF_LIMIT) return;
    player.ip += 1;
    player.hasInf = true;
    initPlayer(true);
    saveGame(true);
}

function sacrifice() {
    if (player.generators[0].amount.exp < 10) return;
    player.sacrificeMult = new BigNum(Math.pow(player.generators[0].amount.exp / 10, 2), 0);
    for (let i = 0; i < 7; i++) {
        player.generators[i].amount = new BigNum(0,0);
        player.generators[i].cost = new BigNum(GEN_CONFIG[i].base, 0);
        player.generators[i].prodMult = new BigNum(1,0);
    }
    player.generators[0].amount = new BigNum(1,0);
    flashEffect(7);
}

/**
 * 5. Loop & UI
 */
function gameLoop() {
    let now = Date.now();
    let diff = (now - player.lastUpdate) / 1000;
    player.lastUpdate = now;
    if (player.overdrive) diff *= 1000;

    if (player.hasInf) {
        for (let i = 0; i < 8; i++) if (player.stars.gte(player.generators[i].cost)) buyGenerator(i);
    }

    let globalMult = BigNum.copy(player.boostMult).times(player.permanentPower);
    for (let i = 7; i > 0; i--) {
        let p = BigNum.copy(player.generators[i].amount).times(player.generators[i].prodMult).times(globalMult);
        if (i === 7) p.times(player.sacrificeMult);
        player.generators[i-1].amount.plus(p.times(diff));
    }
    let gain = BigNum.copy(player.generators[0].amount).times(player.generators[0].prodMult).times(globalMult);
    player.stars.plus(BigNum.copy(gain).times(diff));

    if (player.stars.exp >= INF_LIMIT) player.stars = new BigNum(1.7976, 308);
    updateUI(gain);
}

function updateUI(gain) {
    const isInf = player.stars.exp >= INF_LIMIT;
    document.getElementById("display").innerText = player.stars.toString() + (isInf ? "" : " stars");
    document.getElementById("ps-display").innerText = isInf ? "MAXED" : "+" + gain.toString() + "/s";
    document.getElementById("pow-display").innerText = `Power: x${player.permanentPower.toString()}`;
    document.getElementById("ip-display").innerText = `IP: ${player.ip}`;
    document.getElementById("overdrive-text").style.display = player.overdrive ? "block" : "none";
    document.getElementById("inf-btn").style.display = isInf ? "block" : "none";

    let bCost = new BigNum(1, 5 + (player.boostLevel * 2));
    document.getElementById("boost-level").innerText = player.boostLevel;
    document.getElementById("boost-info").innerText = `Cost: ${bCost.toString()}`;
    document.getElementById("boost-btn").disabled = !player.stars.gte(bCost);

    document.getElementById("sac-btn").disabled = player.generators[0].amount.exp < 10;
    document.getElementById("prestige-btn").disabled = player.stars.exp < 30;

    player.generators.forEach((g, i) => {
        const amtEl = document.getElementById(`amt-${i}`);
        const costEl = document.getElementById(`cost-${i}`);
        const btnEl = document.getElementById(`buy-btn-${i}`);
        const multEl = document.getElementById(`mult-${i}`);
        if (amtEl) amtEl.innerText = g.amount.toString();
        if (costEl) costEl.innerText = g.cost.toString();
        if (multEl) multEl.innerText = "x" + g.prodMult.toString();
        if (btnEl) btnEl.disabled = !player.stars.gte(g.cost);
    });
}

function saveGame(show) {
    localStorage.setItem("star_v7_save", JSON.stringify(player));
    if(show) { let p=document.getElementById("save-popup"); p.style.opacity=1; setTimeout(()=>p.style.opacity=0,1000); }
}

function loadGame() {
    let s = localStorage.getItem("star_v7_save");
    if (!s) return;
    let d = JSON.parse(s);
    player.stars = new BigNum(d.stars.mag, d.stars.exp);
    player.sacrificeMult = new BigNum(d.sacrificeMult.mag, d.sacrificeMult.exp);
    player.permanentPower = new BigNum(d.permanentPower.mag, d.permanentPower.exp);
    player.boostLevel = d.boostLevel || 0;
    player.boostMult = new BigNum(d.boostMult.mag, d.boostMult.exp);
    player.ip = d.ip || 0;
    player.hasInf = d.hasInf || false;
    d.generators.forEach((g, i) => {
        player.generators[i].amount = new BigNum(g.amount.mag, g.amount.exp);
        player.generators[i].cost = new BigNum(g.cost.mag, g.cost.exp);
        player.generators[i].prodMult = new BigNum(g.prodMult.mag, g.prodMult.exp);
    });
}

function flashEffect(i) {
    let id = i === 'boost' ? 'boost-btn' : `row-${i}`;
    let el = document.getElementById(id);
    if(el){ el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),150); }
}

function hardReset() { if(confirm("RESET ALL?")){ localStorage.clear(); location.reload(); } }

window.onkeydown = e => {
    let k = e.key.toLowerCase();
    if(k >= "1" && k <= "8") buyGenerator(parseInt(k)-1);
    if(k === "m") { for (let i = 7; i >= 0; i--) while (player.stars.gte(player.generators[i].cost)) buyGenerator(i); }
    if(k === "r") buyBoost();
    if(k === "b") sacrifice();
    if(k === "p") prestige();
    if(k === "i") infinityReset();
    if(k === "s") saveGame(true);
    if(k === "o") player.overdrive = true;
};
window.onkeyup = e => { if(e.key.toLowerCase() === "o") player.overdrive = false; };

window.onload = () => {
    initPlayer();
    loadGame();
    setInterval(gameLoop, 50);
    setInterval(() => saveGame(false), 10000);
};
