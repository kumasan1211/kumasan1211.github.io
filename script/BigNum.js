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
