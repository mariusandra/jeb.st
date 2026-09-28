// 20 Questions: the harness thinks of an animal; the model asks yes/no questions and then names its guess.
import { Game, option } from "./base.js";
import { QUESTIONS, ANIMALS } from "./data.js";

const UNIVERSE = Object.keys(ANIMALS).sort(); const MAX_QUESTIONS = 20; const ASK = "ask: ", GUESS = "guess: ";
const has = (animal, attr) => ANIMALS[animal].includes(attr);

export class TwentyQuestions extends Game {
  static key = "twenty_questions";
  static title = "20 Questions";
  static blurb = "The harness thinks of an animal. Each turn the model asks one yes/no question or names its guess.";
  static scoreLabel = "questions";
  static defaultMaxTurns = MAX_QUESTIONS + 1;
  static maxTurnsLimit = MAX_QUESTIONS + 1;
  static OPTIONS = [option("assist", "assist", "select", "none", { values: ["none", "prune"], help: "prune: only animals still consistent with the answers are offered as guesses, only questions that could still split them are offered, and the state counts the candidates." })];

  constructor(seed, options) { super(seed, options); this.secret = this.rng.choice(UNIVERSE); this.history = []; this.guess = null; this.correct = null; }
  consistent() { return UNIVERSE.filter(a => this.history.every(([attr, , ans]) => has(a, attr) === ans)); }
  asked() { return new Set(this.history.map(h => h[0])); }
  mustGuess() { return this.history.length >= MAX_QUESTIONS; }
  offeredQuestions() {
    if (this.status !== "playing" || this.mustGuess()) return [];
    const asked = this.asked(); let keys = Object.keys(QUESTIONS).filter(k => !asked.has(k));
    if (this.options.assist === "prune") { const pool = this.consistent(); keys = keys.filter(k => { const n = pool.filter(a => has(a, k)).length; return n > 0 && n < pool.length; }); }
    return keys;
  }
  offeredGuesses() { if (this.status !== "playing") return []; return this.options.assist === "prune" ? this.consistent() : [...UNIVERSE]; }
  offered() { return this.offeredQuestions().map(k => ASK + QUESTIONS[k]).concat(this.offeredGuesses().map(a => GUESS + a)); }
  stateText() {
    const left = MAX_QUESTIONS - this.history.length;
    const lines = ["20 Questions. I am thinking of one of these animals: " + UNIVERSE.join(", ") + ".", `Ask yes/no questions to narrow it down, then guess. You have ${left} question(s) left. Guess as soon as you are sure; a wrong guess ends the game.`];
    if (this.history.length) { lines.push("Questions so far:"); this.history.forEach(([, text, ans], i) => lines.push(`Q${i + 1}: ${text} — ${ans ? "yes" : "no"}`)); } else lines.push("No questions asked yet.");
    if (this.mustGuess()) lines.push("No questions left: you must guess now.");
    if (this.options.assist === "prune") { const pool = this.consistent(); lines.push(`Candidates consistent with the answers: ${pool.length}` + (pool.length <= 12 ? ` (${pool.join(", ")})` : "")); }
    return lines.join("\n");
  }
  question() {
    const criteria = Object.fromEntries(this.offered().map(n => [n, ""]));
    const instructions = this.mustGuess() ? "No questions remain. Which animal is it? Name your guess." : "Ask the yes/no question that best splits the animals that could still be the answer, or guess the animal once you are sure. Choose exactly one.";
    return { move: { type: "choice", instructions, criteria } };
  }
  choose(answer) { const offered = this.offered(); if (offered.includes(answer.choice)) return [answer.choice, false]; const probs = answer.probabilities || {}; return [offered.reduce((a, b) => ((probs[b] || 0) > (probs[a] || 0) ? b : a)), true]; }
  apply(action) {
    if (action.startsWith(ASK)) {
      const text = action.slice(ASK.length); const attr = Object.keys(QUESTIONS).find(k => QUESTIONS[k] === text);
      if (!attr) throw new Error(`unknown question ${text}`); if (this.asked().has(attr)) throw new Error(`already asked ${text}`); if (this.mustGuess()) throw new Error("no questions left");
      this.turn += 1; const ans = has(this.secret, attr); this.history.push([attr, text, ans]); return { event: ans ? "yes" : "no" };
    }
    if (action.startsWith(GUESS)) {
      const animal = action.slice(GUESS.length); if (!ANIMALS[animal]) throw new Error(`unknown animal ${animal}`);
      this.turn += 1; this.guess = animal; this.correct = animal === this.secret;
      if (this.correct) { this.status = "win"; this.score = this.history.length; return { event: `correct: ${animal}` }; }
      this.status = "loss"; this.score = 0; return { event: `wrong: it was ${this.secret}` };
    }
    throw new Error(`unknown action ${action}`);
  }
  snapshot() { const over = this.status !== "playing"; return { universe: [...UNIVERSE], history: this.history.map(([, question, ans]) => ({ question, answer: ans ? "yes" : "no" })), consistent: this.consistent(), secret: over ? this.secret : null, guess: this.guess, correct: this.correct, questions_asked: this.history.length }; }
}
