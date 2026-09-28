# jeb street · jeb.st

**JEB** = **JE**v **B**enchmarks. A static playground for Jev-style typed-decision
models: one forward pass per move, a probability on every option, nothing
generated. Drive your own model through the apps, or hop into someone else's
ride and watch how their model did.

Everything runs in the browser. There is no backend: the page posts each
state and typed question straight to a model server's `/v1/systemone`
endpoint, plays the answer, and records the ride in the browser's own
storage. Static hosting is enough.

## Run it locally

```bash
python3 -m http.server 8080          # from this folder, then open http://localhost:8080
```

Any static host works for everything except the TypeSafe hop, which is a
Cloudflare Pages Function (build command empty, output directory `/`). No
build step; plain ES modules.

## The strip

| app | what the model decides |
| --- | --- |
| Snake | straight or a 90° turn, 10×10 text board; harness options for hint, mask and decision rule |
| Connect Four | a column, against a win-or-block opponent or a second car |
| Tetris | one of 8 heuristic-shortlisted placements with their consequences |
| 2048 | a legal slide |
| Flappy Bird | flap or glide, one yes/no per frame |
| Breakout | paddle left, right or hold, per frame |
| Wordle | the next guess among the words consistent with the clues |
| 20 Questions | ask one yes/no question or name the animal |
| Text decisions | your text, your typed questions (choice, score, noul), every ready car side by side |
| App picker | PostHog's "Filter by jev" (pull request 106730): 69 apps as yes/no questions |
| HN triage | every new Hacker News story classified live from the public API, low-confidence calls to a review lane |
| Calibration | reliability diagrams over every ride, bundled and yours |
| Run all | one car through every app, a scorecard, and a ride per game |

The game engines and harnesses are ports of the Python demos in the
[decider](https://github.com/Mapika/decider) repository (`demos/games`), so
the states and questions a model sees here are the same text.

## Cars

A **car** is anything that speaks TypeSafe's `POST /v1/systemone`:
[decider](https://github.com/Mapika/decider) (`decider.serve`), the GGUF
servers in that repo, [JevK5](https://github.com/allebee/jevk5),
[imajev](https://github.com/mohit67890/imajev), or TypeSafe's hosted Jev with
your own API key. Add them in the **Garage**. Names, URLs and keys are kept in
`localStorage` and sent only to the car itself.

**CORS.** The browser talks to the car directly, so the server has to allow
cross-origin requests from the page, and an https page may only reach
`127.0.0.1` when the server also answers Chrome's private-network preflight.
Model servers do neither. Run the relay next to the server and point the car
at the relay:

```bash
python3 tools/jebst-proxy.py --target http://127.0.0.1:8001 --port 8765
```

**TypeSafe** refuses browser calls altogether (no `Access-Control-Allow-Origin`
for outside origins), so the TypeSafe car defaults to `/ts`, a Cloudflare
Pages Function in `functions/ts/` that forwards the request and the caller's
`Authorization` header to `api.typesafe.ai` and stores nothing. It exists only
on the Cloudflare deployment; when you serve the site with `python3 -m
http.server`, run the relay with the key instead and point the car at it:

```bash
python3 tools/jebst-proxy.py --target https://api.typesafe.ai --api-key "$TYPESAFE_API_KEY" --port 8766
```

**PostHog's AI gateway** serves JevK5 (`posthog/hogference/jevk5-fp8-0.2`)
on the same `/v1/systemone` route at `gateway.us.posthog.com` or
`gateway.eu.posthog.com`, with a project secret key (`phs_…`, scope
`llm_gateway:read`) as the bearer. The gateway allows browser calls, so this
car needs no relay. The garage check sends one tiny yes/no question to see
whether the decision route is enabled for the key; PostHog is still rolling
it out, and a 404 there means not yet.

**Someone else's car** is just a public endpoint: paste its URL.

## Rides

Every game you drive is recorded turn by turn: the state text the model saw,
the question and its options, every probability, the move played, the
latency. Rides live in IndexedDB. Each one can be exported as JSON, marked as
shared, deleted, or imported again on another machine. `data/rides/` holds the
bundled rides of decider-4b, decider-35b, imajev, JevK5 and Jev, converted from
the demos' recordings; `index.json` lists them.

**Run all** drives one car through a fixed plan (Snake, Connect Four ×3,
Tetris, 2048, Flappy Bird, Breakout, Wordle ×3, 20 Questions ×3, the eight text
presets, the four app-picker prompts) and produces a scorecard. Runs are saved
in the browser and export with their rides. There is no leaderboard yet; the
export is what a submission will be.

## The banner

`assets/banner.svg` is a hand-drawn scene. To replace it with a rendered
image, generate one from this prompt and save it as `assets/banner.jpg`
(then point the `<img>` in `index.html` at it):

> A wide cinematic view down an empty asphalt road converging to the horizon
> at golden hour: deep blue sky fading to warm orange, a low sun with a soft
> glow, a few flat clouds, distant hills and a small city skyline. On the right
> shoulder a tall aluminium signpost carries two green highway signs with white
> borders and bold white Highway Gothic lettering, "JEB ST" on top and "JEV
> BENCHMARKS" with an arrow below, and a yellow diamond warning sign reading
> "DECISIONS AHEAD". A dashed yellow centre line runs to the vanishing point,
> white edge lines, a single red car far down the road. Photographic, crisp,
> 3:1 aspect ratio, room at the bottom left for a title.

## Layout of the repo

```
index.html         the whole page: views for every app, hash-routed
css/street.css     asphalt, white and yellow road paint, sign green
js/main.js         controller: garage, game view, tools, rides, run all
js/models.js       cars: probing, /v1/systemone calls, answer normalisation
js/runner.js       one turn: state → question → car → harness → frame
js/games/*.js      the eight game engines and harnesses
js/apps/*.js       text decisions, app picker, HN triage, calibration
js/store.js        IndexedDB for rides, asks and runs
data/              presets, the PostHog app catalog, bundled rides
tools/             the CORS relay
functions/ts/      the Cloudflare Pages Function that fronts api.typesafe.ai
```
