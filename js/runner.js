// Plays a game with a car, one forward pass per turn, and records every frame the way the Jev demos did.
import { REGISTRY } from "./games/index.js";
import { ask, normaliseAnswer } from "./models.js";

export const newRideId = (game) => `${game}-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15)}-${Math.random().toString(36).slice(2, 8)}`;

export function createRide({ game, seed, maxTurns, options, car, opponent = null }) {
  const cls = REGISTRY[game];
  const g = new cls(seed, options);
  if (opponent && cls.OPPONENT) g.setOpponentModel(true);
  const ride = {
    id: newRideId(game), game, game_title: cls.title, seed, max_turns: Math.min(maxTurns || cls.defaultMaxTurns, cls.maxTurnsLimit), options: { ...g.options },
    model: car.name, model_id: car.id, model_name: car.modelName || car.name, device: car.device || (car.kind === "typesafe" ? "cloud" : "?"),
    opponent: opponent ? opponent.name : null, score_label: cls.scoreLabel, status: g.status, turns: 0, score: g.score, overrides: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source: "you", shared: false, latencies: [],
    frames: [{ turn: g.turn, score: g.score, status: g.status, action: null, model_choice: null, overridden: false, probabilities: {}, latency_ms: 0, event: "", state_text: g.status === "playing" ? g.stateText() : "", ...g.snapshot() }],
  };
  return { ride, game: g, car, opponent };
}

export function summary(ride) {
  const lat = ride.latencies.length > 1 ? ride.latencies.slice(1) : ride.latencies;
  const sorted = [...lat].sort((a, b) => a - b);
  return { ...ride, frames: undefined, median_decision_ms: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100 : null, live: ride.status === "playing" };
}

// One turn. Returns {done, frame}. Throws on model or harness errors (the ride stays playable).
export async function step(session, { signal } = {}) {
  const { ride, game: g, car, opponent } = session;
  if (g.status !== "playing" || g.turn >= ride.max_turns) { if (g.status === "playing") { g.finish("turn_limit"); ride.frames[ride.frames.length - 1].status = g.status; } ride.status = g.status; return { done: true, frame: ride.frames[ride.frames.length - 1] }; }
  const stateText = g.stateText(); const question = g.question(); const actor = g.actor();
  const driver = actor === "opponent" && opponent ? opponent : car;
  let answer = null, latency = 0;
  if (g.needsModel()) {
    const result = await ask(driver, stateText, question, { signal });
    latency = result.latencyMs;
    answer = normaliseAnswer(result.answers.move, g.constructor.NOUL);
  }
  const [action, overridden] = g.choose(answer);
  const outcome = g.apply(action);
  if (g.status === "playing" && g.turn >= ride.max_turns) g.finish("turn_limit");
  const offered = question.move.criteria ? Object.keys(question.move.criteria) : (g.constructor.NOUL || []);
  const frame = { turn: g.turn, score: g.score, status: g.status, action, actor, server: answer ? driver.name : null,
    model_choice: answer ? answer.choice : action, overridden, probabilities: answer ? answer.probabilities : {},
    confidence: answer ? answer.confidence ?? null : null, certainty: answer ? answer.certainty ?? null : null, x_p_max: answer ? answer.x_p_max ?? null : null,
    latency_ms: Math.round(latency * 100) / 100, event: outcome.event || "", state_text: stateText, question: question.move, options_offered: offered, ...g.snapshot() };
  ride.frames.push(frame); if (answer) ride.latencies.push(latency);
  ride.turns = g.turn; ride.score = g.score; ride.status = g.status; ride.overrides += overridden ? 1 : 0; ride.updated_at = new Date().toISOString();
  return { done: g.status !== "playing", frame };
}
