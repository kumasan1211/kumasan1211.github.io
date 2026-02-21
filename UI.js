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
