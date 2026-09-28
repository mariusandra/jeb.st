// Generated from the Jev repository's demos/games (wordle.py, twenty_questions.py). Do not edit by hand.
export const WORDS = ["about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again", "agent", "agree", "ahead", "alarm", "album", "alert", "alien", "alike", "alive", "allow", "alone", "along", "aloud", "alter", "amber", "angel", "anger", "angle", "angry", "ankle", "apart", "apple", "apply", "apron", "arena", "argue", "arise", "armor", "arrow", "aside", "asset", "avoid", "awake", "award", "aware", "awful", "bacon", "badge", "badly", "baker", "basic", "basin", "batch", "beach", "beard", "beast", "began", "begin", "being", "belly", "below", "bench", "berry", "birth", "black", "blade", "blame", "blank", "blast", "blaze", "bleed", "blend", "bless", "blind", "blink", "block", "blood", "bloom", "blown", "blunt", "board", "boast", "bonus", "boost", "booth", "bound", "brain", "brake", "brand", "brave", "bread", "break", "breed", "brick", "bride", "brief", "bring", "broad", "broke", "brown", "brush", "build", "built", "bunch", "burst", "buyer", "cabin", "cable", "camel", "candy", "cargo", "carry", "carve", "catch", "cause", "cease", "chain", "chair", "chalk", "champ", "chaos", "charm", "chart", "chase", "cheap", "cheat", "check", "cheek", "cheer", "chess", "chest", "chief", "child", "chill", "choir", "chose", "chunk", "cider", "cigar", "civil", "claim", "clash", "class", "clean", "clear", "clerk", "click", "cliff", "climb", "cling", "clock", "close", "cloth", "cloud", "clown", "coach", "coast", "cobra", "color", "comet", "comic", "coral", "couch", "cough", "could", "count", "court", "cover", "crack", "craft", "crane", "crash", "crawl", "crazy", "cream", "creek", "crime", "crisp", "cross", "crowd", "crown", "crude", "cruel", "crush", "curve", "cycle", "daily", "dairy", "dance", "dealt", "death", "debut", "decay", "delay", "dense", "depth", "derby", "devil", "diary", "digit", "dirty", "ditch", "dizzy", "dodge", "doing", "donor", "doubt", "dough", "dozen", "draft", "drain", "drama", "drank", "drawn", "dream", "dress", "dried", "drift", "drill", "drink", "drive", "drove", "drown", "drunk", "dusty", "dwarf", "eager", "eagle", "early", "earth", "eaten", "eight", "elbow", "elder", "elect", "elite", "empty", "enemy", "enjoy", "enter", "entry", "equal", "equip", "error", "essay", "event", "every", "exact", "exile", "exist", "extra", "fable", "faint", "fairy", "faith", "false", "fancy", "fatal", "fault", "favor", "feast", "fence", "ferry", "fever", "fiber", "field", "fifth", "fifty", "fight", "final", "first", "fixed", "flame", "flash", "fleet", "flesh", "float", "flock", "flood", "floor", "flour", "fluid", "flute", "focus", "force", "forge", "forth", "forty", "forum", "found", "frame", "fraud", "fresh", "front", "frost", "fruit", "fully", "funny", "ghost", "giant", "given", "glass", "gleam", "glide", "globe", "gloom", "glory", "glove", "going", "grace", "grade", "grain", "grand", "grant", "grape", "graph", "grasp", "grass", "grave", "gravy", "great", "greed", "green", "greet", "grief", "grill", "grind", "groan", "groom", "group", "grown", "guard", "guess", "guest", "guide", "guilt", "habit", "happy", "harsh", "haste", "haunt", "heart", "heavy", "hedge", "hello", "hence", "hobby", "honey", "honor", "horse", "hotel", "house", "human", "humor", "hurry", "ideal", "image", "imply", "index", "inner", "input", "irony", "issue", "ivory", "jelly", "jewel", "joint", "judge", "juice", "juicy", "jumbo", "kneel", "knife", "knock", "known", "label", "labor", "large", "laser", "later", "laugh", "layer", "learn", "lease", "least", "leave", "legal", "lemon", "level", "light", "limit", "linen", "liver", "local", "lodge", "logic", "loose", "lorry", "loser", "lower", "loyal", "lucky", "lunar", "lunch", "lying", "magic", "major", "maker", "maple", "march", "marry", "match", "maybe", "mayor", "medal", "media", "mercy", "merit", "merry", "metal", "meter", "might", "minor", "minus", "mixed", "model", "moist", "money", "month", "moral", "motor", "mount", "mouse", "mouth", "movie", "music", "naive", "naked", "nasty", "naval", "nerve", "never", "night", "noble", "noise", "noisy", "north", "notch", "novel", "nurse", "occur", "ocean", "offer", "often", "olive", "onion", "onset", "opera", "orbit", "order", "organ", "other", "ought", "ounce", "outer", "owner", "oxide", "ozone", "paint", "panel", "panic", "paper", "party", "pasta", "patch", "pause", "peace", "peach", "pearl", "pedal", "penny", "phase", "phone", "photo", "piano", "piece", "pilot", "pinch", "pitch", "pizza", "place", "plain", "plane", "plant", "plate", "plaza", "plead", "plumb", "point", "polar", "porch", "pound", "power", "press", "price", "pride", "prime", "print", "prior", "prize", "proof", "proud", "prove", "pulse", "punch", "pupil", "puppy", "purse", "queen", "query", "quest", "queue", "quick", "quiet", "quilt", "quite", "quota", "quote", "radar", "radio", "raise", "rally", "ranch", "range", "rapid", "ratio", "raven", "reach", "ready", "realm", "rebel", "refer", "reign", "relax", "relay", "reply", "rider", "ridge", "rifle", "right", "rigid", "rival", "river", "roast", "robin", "robot", "rocky", "rough", "round", "route", "royal", "rugby", "ruler", "rural", "salad", "sauce", "scale", "scare", "scarf", "scene", "scent", "scope", "score", "scout", "screw", "sense", "serve", "seven", "shade", "shaft", "shake", "shall", "shame", "shape", "share", "shark", "sharp", "sheep", "sheet", "shelf", "shell", "shift", "shine", "shiny", "shirt", "shock", "shoot", "shore", "short", "shout", "shown", "shrug", "sight", "since", "sixth", "sixty", "skill", "skirt", "skull", "slate", "slave", "sleep", "slept", "slice", "slide", "slope", "small", "smart", "smell", "smile", "smoke", "snake", "sneak", "solar", "solid", "solve", "sorry", "sound", "south", "space", "spare", "spark", "speak", "speed", "spell", "spend", "spent", "spice", "spicy", "spike", "spine", "spite", "split", "spoke", "spoon", "sport", "spray", "squad", "stack", "staff", "stage", "stain", "stair", "stake", "stale", "stamp", "stand", "stare", "start", "state", "steak", "steal", "steam", "steel", "steep", "steer", "stern", "stick", "stiff", "still", "sting", "stock", "stone", "stood", "stool", "storm", "story", "stove", "strap", "straw", "stray", "strip", "study", "stuff", "style", "sugar", "suite", "sunny", "super", "surge", "swamp", "swear", "sweat", "sweep", "sweet", "swept", "swift", "swing", "sword", "syrup", "table", "taken", "taste", "teach", "tenth", "thank", "theft", "their", "theme", "there", "these", "thick", "thief", "thigh", "thing", "think", "third", "those", "three", "threw", "throw", "thumb", "tiger", "tight", "timer", "tired", "title", "toast", "today", "token", "tooth", "topic", "torch", "total", "touch", "tough", "towel", "tower", "toxic", "trace", "track", "trade", "trail", "train", "trait", "trash", "treat", "trend", "trial", "tribe", "trick", "troop", "truck", "truly", "trunk", "trust", "truth", "tulip", "tumor", "tutor", "twice", "twist", "uncle", "under", "union", "unite", "unity", "until", "upper", "upset", "urban", "usage", "usual", "utter", "vague", "valid", "value", "vapor", "vault", "verse", "video", "villa", "vinyl", "viral", "virus", "visit", "vital", "vivid", "vocal", "voice", "voter", "wagon", "waist", "waste", "watch", "water", "weary", "weave", "wedge", "weigh", "weird", "whale", "wheat", "wheel", "where", "which", "while", "white", "whole", "whose", "widow", "width", "witch", "woman", "world", "worry", "worse", "worst", "worth", "would", "wound", "wrist", "write", "wrong", "wrote", "yacht", "yield", "young", "youth", "zebra"];
export const OPENERS = ["crane", "slate", "trace", "crate", "stare", "raise", "arise", "least", "adieu"];
export const QUESTIONS = {
"mammal": "Is it a mammal?",
"bird": "Is it a bird?",
"reptile_amphibian": "Is it a reptile or an amphibian?",
"fish": "Is it a fish?",
"invertebrate": "Is it an insect or another invertebrate (no backbone)?",
"water": "Does it spend much of its life in water?",
"fly": "Can it fly?",
"wings": "Does it have wings?",
"bigger_than_human": "Is it bigger than an adult human?",
"heavier_than_car": "Is it heavier than a car?",
"smaller_than_cat": "Is it much smaller than a house cat?",
"pet": "Is it commonly kept as a household pet?",
"farm": "Is it a farm animal?",
"eaten": "Do people commonly eat it?",
"carnivore": "Does it eat mainly other animals (meat, fish or insects)?",
"four_legs": "Does it walk on four legs?",
"africa": "Is it thought of as an African animal?",
"polar": "Does it live in the Arctic or Antarctic (ice and snow)?",
"nocturnal": "Is it mainly active at night?",
"horns": "Does it have horns or antlers?",
"striped": "Does it have stripes?",
"cat_family": "Is it a member of the cat family?"
};
export const ANIMALS = {
"dog": [
"carnivore",
"four_legs",
"mammal",
"pet"
],
"cat": [
"carnivore",
"cat_family",
"four_legs",
"mammal",
"pet"
],
"horse": [
"bigger_than_human",
"farm",
"four_legs",
"mammal"
],
"cow": [
"bigger_than_human",
"eaten",
"farm",
"four_legs",
"horns",
"mammal"
],
"pig": [
"bigger_than_human",
"eaten",
"farm",
"four_legs",
"mammal"
],
"sheep": [
"eaten",
"farm",
"four_legs",
"mammal"
],
"goat": [
"eaten",
"farm",
"four_legs",
"horns",
"mammal"
],
"rabbit": [
"four_legs",
"mammal",
"pet"
],
"mouse": [
"four_legs",
"mammal",
"nocturnal",
"smaller_than_cat"
],
"hamster": [
"four_legs",
"mammal",
"nocturnal",
"pet",
"smaller_than_cat"
],
"deer": [
"eaten",
"four_legs",
"horns",
"mammal"
],
"bat": [
"carnivore",
"fly",
"mammal",
"nocturnal",
"smaller_than_cat",
"wings"
],
"elephant": [
"africa",
"bigger_than_human",
"four_legs",
"heavier_than_car",
"mammal"
],
"giraffe": [
"africa",
"bigger_than_human",
"four_legs",
"mammal"
],
"lion": [
"africa",
"bigger_than_human",
"carnivore",
"cat_family",
"four_legs",
"mammal"
],
"tiger": [
"bigger_than_human",
"carnivore",
"cat_family",
"four_legs",
"mammal",
"striped"
],
"cheetah": [
"africa",
"carnivore",
"cat_family",
"four_legs",
"mammal"
],
"zebra": [
"africa",
"bigger_than_human",
"four_legs",
"mammal",
"striped"
],
"hippo": [
"africa",
"bigger_than_human",
"four_legs",
"heavier_than_car",
"mammal",
"water"
],
"rhino": [
"africa",
"bigger_than_human",
"four_legs",
"heavier_than_car",
"horns",
"mammal"
],
"wolf": [
"carnivore",
"four_legs",
"mammal"
],
"polar bear": [
"bigger_than_human",
"carnivore",
"four_legs",
"mammal",
"polar"
],
"gorilla": [
"africa",
"bigger_than_human",
"mammal"
],
"chimpanzee": [
"africa",
"mammal"
],
"dolphin": [
"bigger_than_human",
"carnivore",
"mammal",
"water"
],
"whale": [
"bigger_than_human",
"carnivore",
"heavier_than_car",
"mammal",
"water"
],
"seal": [
"carnivore",
"mammal",
"polar",
"water"
],
"eagle": [
"bird",
"carnivore",
"fly",
"wings"
],
"owl": [
"bird",
"carnivore",
"fly",
"nocturnal",
"wings"
],
"parrot": [
"bird",
"fly",
"pet",
"smaller_than_cat",
"wings"
],
"penguin": [
"bird",
"carnivore",
"polar",
"water",
"wings"
],
"chicken": [
"bird",
"eaten",
"farm",
"wings"
],
"duck": [
"bird",
"eaten",
"farm",
"fly",
"water",
"wings"
],
"ostrich": [
"africa",
"bigger_than_human",
"bird",
"wings"
],
"frog": [
"carnivore",
"four_legs",
"reptile_amphibian",
"smaller_than_cat",
"water"
],
"turtle": [
"four_legs",
"reptile_amphibian",
"water"
],
"snake": [
"carnivore",
"reptile_amphibian"
],
"alligator": [
"bigger_than_human",
"carnivore",
"four_legs",
"reptile_amphibian",
"water"
],
"lizard": [
"carnivore",
"four_legs",
"reptile_amphibian",
"smaller_than_cat"
],
"shark": [
"bigger_than_human",
"carnivore",
"fish",
"water"
],
"salmon": [
"carnivore",
"eaten",
"fish",
"water"
],
"goldfish": [
"fish",
"pet",
"smaller_than_cat",
"water"
],
"octopus": [
"carnivore",
"eaten",
"invertebrate",
"water"
],
"lobster": [
"carnivore",
"eaten",
"invertebrate",
"smaller_than_cat",
"water"
],
"bee": [
"fly",
"invertebrate",
"smaller_than_cat",
"striped",
"wings"
],
"butterfly": [
"fly",
"invertebrate",
"smaller_than_cat",
"wings"
],
"ant": [
"invertebrate",
"smaller_than_cat"
],
"spider": [
"carnivore",
"invertebrate",
"smaller_than_cat"
]
};
