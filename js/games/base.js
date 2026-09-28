// The interface every game implements, mirroring demos/games/base.py in the Jev repository.
//
// A game owns its state and its harness. Per turn the runner asks for the state text and the question (one Choice
// question with the offered options, or one Noul question when the game declares NOUL), sends both to a model, then
// hands the answer back to the game, which turns it into an action (possibly overriding the model under a harness
// rule) and applies it. Everything the page draws comes from snapshot().
import { RNG } from "../rng.js";

export const option = (key, label, kind, def, extra = {}) => ({ key, label, kind, default: def, ...extra });

export function resolveOptions(spec, given = {}) {
  const out = {};
  for (const o of spec) {
    let v = given[o.key];
    if (v === undefined || v === null || v === "") v = o.default;
    if (o.kind === "bool") v = typeof v === "string" ? ["1", "true", "yes", "on"].includes(v.toLowerCase()) : !!v;
    else if (o.kind === "int") { v = Number(v); if (!Number.isFinite(v)) v = o.default; if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); v = Math.round(v); }
    else if (o.kind === "select" && o.values && !o.values.includes(v)) v = o.default;
    out[o.key] = v;
  }
  return out;
}

export class Game {
  static key = "game";
  static title = "Game";
  static blurb = "";
  static scoreLabel = "score";
  static defaultMaxTurns = 300;
  static maxTurnsLimit = 2000;
  static OPTIONS = [];
  static NOUL = null;        // [yes action, no action]: the question is a Noul instead of a Choice
  static OPPONENT = null;    // e.g. "O": a second car may play the other side
  static REALTIME = false;   // arcade games: play as fast as the model answers by default

  constructor(seed, options) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.options = resolveOptions(this.constructor.OPTIONS, options || {});
    this.turn = 0;
    this.score = 0;
    this.status = "playing";
  }
  static describe() {
    return { key: this.key, title: this.title, blurb: this.blurb, scoreLabel: this.scoreLabel, defaultMaxTurns: this.defaultMaxTurns,
             maxTurnsLimit: this.maxTurnsLimit, options: this.OPTIONS, opponent: this.OPPONENT, realtime: this.REALTIME, noul: this.NOUL };
  }
  needsModel() { return true; }
  actor() { return "model"; }
  setOpponentModel() {}
  stateText() { throw new Error("stateText"); }
  question() { throw new Error("question"); }
  choose(answer) { return [answer.choice, false]; }
  apply() { throw new Error("apply"); }
  snapshot() { return {}; }
  finish(reason = "turn_limit") { if (this.status === "playing") this.status = reason; }
}
