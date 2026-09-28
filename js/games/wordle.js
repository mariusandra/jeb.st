// Wordle: the model picks a guess each turn from the words still consistent with the clues.
import { Game, option } from "./base.js";
import { WORDS, OPENERS } from "./data.js";

const GREEN = "G", YELLOW = "Y", GREY = "X", MAX_GUESSES = 6;
export function feedback(guess, answer) {
  const marks = Array(5).fill(GREY); const left = {};
  for (let i = 0; i < 5; i += 1) { if (guess[i] === answer[i]) marks[i] = GREEN; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < 5; i += 1) { if (marks[i] === GREY && left[guess[i]] > 0) { marks[i] = YELLOW; left[guess[i]] -= 1; } }
  return marks.join("");
}

export class Wordle extends Game {
  static key = "wordle";
  static title = "Wordle";
  static blurb = "Guess the five-letter word in six tries. Each turn the model picks a guess from the words still consistent with the clues.";
  static scoreLabel = "guesses";
  static defaultMaxTurns = MAX_GUESSES;
  static maxTurnsLimit = MAX_GUESSES;
  static OPTIONS = [
    option("max_options", "options shown", "int", 30, { min: 5, max: 60, help: "How many of the consistent candidates are offered as guesses each turn (the most informative first)." }),
    option("show_constraints", "constraints", "bool", true, { help: "The state summarises what is known about each letter." }),
  ];

  constructor(seed, options) {
    super(seed, options);
    this.answer = this.rng.choice(WORDS); this.guesses = []; this.candidates = [...WORDS]; this.solved = false;
  }
  rank(words) {
    const byPos = Array.from({ length: 5 }, () => ({})); const overall = {};
    for (const w of this.candidates) { for (let i = 0; i < 5; i += 1) byPos[i][w[i]] = (byPos[i][w[i]] || 0) + 1; for (const ch of new Set(w)) overall[ch] = (overall[ch] || 0) + 1; }
    const usefulness = w => { const seen = new Set(); let total = 0; for (let i = 0; i < 5; i += 1) { const ch = w[i]; if (seen.has(ch)) continue; seen.add(ch); total += (byPos[i][ch] || 0) + (overall[ch] || 0); } return total; };
    return [...words].sort((a, b) => usefulness(b) - usefulness(a) || (a < b ? -1 : 1));
  }
  offered() {
    if (this.status !== "playing") return [];
    const n = this.options.max_options;
    if (!this.guesses.length) { const top = OPENERS.filter(w => this.candidates.includes(w)); const rest = this.rank(this.candidates).filter(w => !top.includes(w)); return top.concat(rest).slice(0, n); }
    return this.rank(this.candidates).slice(0, n);
  }
  triedLetters() { return new Set(this.guesses.flatMap(([w]) => [...w])); }
  constraints() {
    const placed = {}, present = {}, absent = new Set();
    for (const [word, fb] of this.guesses) for (let i = 0; i < 5; i += 1) { if (fb[i] === GREEN) placed[i] = word[i]; else if (fb[i] === YELLOW) (present[word[i]] = present[word[i]] || new Set()).add(i); }
    const placedLetters = new Set(Object.values(placed));
    for (const [word, fb] of this.guesses) for (let i = 0; i < 5; i += 1) if (fb[i] === GREY && !present[word[i]] && !placedLetters.has(word[i])) absent.add(word[i]);
    const parts = [];
    const placedKeys = Object.keys(placed).map(Number).sort((a, b) => a - b);
    if (placedKeys.length) parts.push("Known in position: " + placedKeys.map(i => `${placed[i].toUpperCase()} at ${i + 1}`).join(", "));
    const elsewhere = Object.entries(present).filter(([ch]) => !placedLetters.has(ch)).sort();
    if (elsewhere.length) parts.push("In the word but elsewhere: " + elsewhere.map(([ch, pos]) => `${ch.toUpperCase()} (not position ${[...pos].sort().map(p => p + 1).join(", ")})`).join("; "));
    if (absent.size) parts.push("Absent: " + [...absent].sort().map(c => c.toUpperCase()).join(", "));
    return parts.join("\n");
  }
  stateText() {
    const legend = { G: "green", Y: "yellow", X: "grey" };
    const lines = ["Wordle. A secret five-letter English word must be guessed in at most six tries. After each guess every letter is marked: green = right letter in the right place, yellow = the letter is in the word but elsewhere, grey = the letter is not in the word (a repeated letter is only marked as many times as it occurs in the word).", `Guess ${this.guesses.length + 1} of ${MAX_GUESSES}.`];
    if (this.guesses.length) { lines.push("Guesses so far:"); for (const [word, fb] of this.guesses) lines.push(`  ${word.toUpperCase()} ${fb} → ${[...word].map((ch, i) => `${ch.toUpperCase()} ${legend[fb[i]]}`).join(", ")}`); }
    else lines.push("No guesses yet.");
    if (this.options.show_constraints && this.guesses.length) { const s = this.constraints(); if (s) lines.push("What is known:\n" + s); }
    lines.push(`Words consistent with every clue so far: ${this.candidates.length}; ${this.offered().length} of them are offered below. Every offered word could be the answer, so pick the one that best separates the remaining words.`);
    return lines.join("\n");
  }
  question() {
    const tried = this.triedLetters(); const criteria = {};
    for (const w of this.offered()) { const fresh = [...new Set(w)].filter(ch => !tried.has(ch)); criteria[w] = fresh.length ? `new letters: ${fresh.join(", ")}` : "all letters tried"; }
    return { move: { type: "choice", instructions: "Which word should be guessed next? Prefer a word that could be the answer and whose letters rule out as many other candidates as possible.", criteria } };
  }
  needsModel() { return this.offered().length >= 2; }
  choose(answer) {
    const offered = this.offered();
    if (!answer) return [offered[0], false];
    if (offered.includes(answer.choice)) return [answer.choice, false];
    const probs = answer.probabilities || {}; return [offered.reduce((a, b) => ((probs[b] || 0) > (probs[a] || 0) ? b : a)), true];
  }
  apply(action) {
    const word = action.trim().toLowerCase(); if (!/^[a-z]{5}$/.test(word)) throw new Error(`${action} is not a five-letter word`);
    this.turn += 1; const fb = feedback(word, this.answer); this.guesses.push([word, fb]); this.candidates = this.candidates.filter(w => feedback(word, w) === fb);
    if (word === this.answer) { this.solved = true; this.status = "win"; this.score = this.guesses.length; return { event: `solved in ${this.guesses.length}` }; }
    if (this.guesses.length >= MAX_GUESSES) { this.status = "loss"; this.score = 0; return { event: `out of guesses: the word was ${this.answer}` }; }
    return { event: "" };
  }
  snapshot() { const over = this.status !== "playing"; return { guesses: this.guesses.map(([word, fb]) => ({ word, feedback: fb })), answer: over ? this.answer : null, candidates_left: this.candidates.length, candidates_shown: this.offered(), solved: this.solved }; }
}
