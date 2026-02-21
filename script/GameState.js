let player = {
    stars: new BigNum(1, 1),
    generators: [],
    sacrificeMult: new BigNum(1, 0),
    permanentPower: new BigNum(1, 0),
    boostLevel: 0,
    boostMult: new BigNum(1, 0),
    ip: 0,
    hasInf: false,
    lastUpdate: Date.now()
};

function initPlayer(isInfReset = false) {
    player.stars = new BigNum(1, 1);
    player.sacrificeMult = new BigNum(1, 0);
    player.boostLevel = 0;
    player.boostMult = new BigNum(1, 0);
    if (isInfReset) player.permanentPower = new BigNum(1, 0);
    
    player.generators = GEN_CONFIG.map(c => ({
        amount: new BigNum(0, 0),
        cost: new BigNum(c.base, 0),
        costMult: new BigNum(c.m, 0),
        prodMult: new BigNum(1, 0)
    }));
    player.generators.amount = new BigNum(1, 0);
}

function save() {
    localStorage.setItem("star_save", JSON.stringify(player));
}
