import { Snake } from "./snake.js";
import { ConnectFour } from "./connect_four.js";
import { Tetris } from "./tetris.js";
import { Game2048 } from "./game2048.js";
import { Flappy } from "./flappy.js";
import { Breakout } from "./breakout.js";
import { Wordle } from "./wordle.js";
import { TwentyQuestions } from "./twenty_questions.js";

export const GAMES = [Snake, ConnectFour, Tetris, Game2048, Flappy, Breakout, Wordle, TwentyQuestions];
export const REGISTRY = Object.fromEntries(GAMES.map(g => [g.key, g]));
export const describe = key => REGISTRY[key].describe();
