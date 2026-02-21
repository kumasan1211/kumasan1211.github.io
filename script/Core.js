function gameLoop() {
    let now = Date.now();
    let diff = (now - player.lastUpdate) / 1000;
    player.lastUpdate = now;

    // オートバイヤー (Infinity後)
    if (player.hasInf) {
        for (let i = 0; i < 8; i++) {
            if (player.stars.gte(player.generators[i].cost)) buyGenerator(i);
        }
    }

    let globalMult = BigNum.copy(player.boostMult).times(player.permanentPower);

    // 生産計算 (階層構造)
    for (let i = 7; i > 0; i--) {
        let p = BigNum.copy(player.generators[i].amount).times(player.generators[i].prodMult).times(globalMult);
        if (i === 7) p.times(player.sacrificeMult);
        player.generators[i-1].amount.plus(p.times(diff));
    }
    
    let starGain = BigNum.copy(player.generators[0].amount).times(player.generators[0].prodMult).times(globalMult);
    player.stars.plus(BigNum.copy(starGain).times(diff));

    // Infinity キャップ
    if (player.stars.exp >= INFINITY_THRESHOLD) player.stars = new BigNum(1.7976, 308);

    updateUI(starGain);
}
