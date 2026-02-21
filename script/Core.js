unction gameLoop() {
    let now = Date.now();
    let diff = (now - player.lastUpdate) / 1000;
    player.lastUpdate = now;

    // 生産計算
    let globalMult = BigNum.copy(player.boostMult).times(player.permanentPower);
    for (let i = 7; i > 0; i--) {
        let p = BigNum.copy(player.generators[i].amount).times(player.generators[i].prodMult).times(globalMult);
        if (i === 7) p.times(player.sacrificeMult);
        player.generators[i-1].amount.plus(p.times(diff));
    }
    
    let starGain = BigNum.copy(player.generators[0].amount).times(player.generators[0].prodMult).times(globalMult);
    player.stars.plus(BigNum.copy(starGain).times(diff));

    if (player.stars.exp >= INFINITY_THRESHOLD) player.stars = new BigNum(1.7976, 308);

    updateUI(starGain);
}

function updateUI(gain) {
    document.getElementById("display").innerText = player.stars.toString() + " stars";
    document.getElementById("ps-display").innerText = player.stars.exp >= INFINITY_THRESHOLD ? "MAXED" : "+" + gain.toString() + "/s";
    document.getElementById("ip-display").innerText = "IP: " + player.ip;
    
    document.getElementById("inf-btn").style.display = player.stars.exp >= INFINITY_THRESHOLD ? "block" : "none";

    player.generators.forEach((g, i) => {
        document.getElementById(`amt-${i}`).innerText = g.amount.toString();
        document.getElementById(`cost-${i}`).innerText = g.cost.toString();
        document.getElementById(`buy-btn-${i}`).disabled = !player.stars.gte(g.cost);
    });
}
function renderGeneratorList() {
    const target = document.getElementById("gen-list-render");
    if (!target) return;
    target.innerHTML = player.generators.map((_, i) => `
        <div class="gen-row" id="row-${i}">
            <div class="gen-info">
                <span class="key-badge">${i+1}</span>
                <strong>GEN ${i+1}</strong> 
                <span id="mult-${i}" class="gen-mult">x1.00</span><br>
                <small id="amt-${i}">0.00</small>
            </div>
            <button class="buy-btn" id="buy-btn-${i}" onclick="buyGenerator(${i})">
                BUY: <span id="cost-${i}">0</span>
            </button>
        </div>`).join('');
}
