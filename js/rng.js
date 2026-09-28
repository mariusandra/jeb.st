// Seeded PRNG (mulberry32). Same seed, same game, on every machine. Seeds do not match the Python harness's
// random.Random, so a seed here is its own thing.
export class RNG {
  constructor(seed) { this.s = (Number(seed) >>> 0) || 0x9e3779b9; }
  random() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a, b) { return a + (b - a) * this.random(); }
  randint(a, b) { return a + Math.floor(this.random() * (b - a + 1)); }
  choice(arr) { return arr[Math.floor(this.random() * arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(this.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}
