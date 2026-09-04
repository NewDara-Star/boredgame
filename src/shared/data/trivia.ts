export interface TriviaSeed {
  slug: string;
  prompt: string;
  /** The correct answer is always index 0 here; the game shuffles at render time. */
  choices: [string, string, string, string];
  alt_hint: string;
  char_hint: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

export const TRIVIA_SEED: TriviaSeed[] = [
  { slug: "tr-crust", prompt: "Most abundant element in Earth's crust by mass?", choices: ["Oxygen", "Silicon", "Iron", "Aluminium"], alt_hint: "You breathe it, but here it's locked in rock", char_hint: "6 letters", difficulty: "easy", category: "Science" },
  { slug: "tr-catalyst", prompt: "What does a catalyst do to a reaction?", choices: ["Lowers activation energy", "Raises the yield", "Shifts equilibrium right", "Adds energy to the system"], alt_hint: "It finds a cheaper route over the hill", char_hint: "It is not consumed", difficulty: "easy", category: "Science" },
  { slug: "tr-air", prompt: "Which gas makes up about 78% of dry air?", choices: ["Nitrogen", "Oxygen", "Argon", "Carbon dioxide"], alt_hint: "Not the one you need to survive", char_hint: "8 letters", difficulty: "easy", category: "Science" },
  { slug: "tr-light", prompt: "Speed of light in a vacuum is about…", choices: ["3 × 10⁸ m/s", "3 × 10⁶ m/s", "3 × 10¹⁰ m/s", "1 × 10⁸ m/s"], alt_hint: "The metre is defined from it", char_hint: "Around 300 million m/s", difficulty: "easy", category: "Science" },
  { slug: "tr-ke", prompt: "Double a car's speed. Its kinetic energy multiplies by…", choices: ["4", "2", "8", "16"], alt_hint: "Energy scales with the square", char_hint: "A single digit", difficulty: "medium", category: "Science" },
  { slug: "tr-mito", prompt: "Which organelle produces most of a cell's ATP?", choices: ["Mitochondrion", "Ribosome", "Golgi apparatus", "Lysosome"], alt_hint: "It has its own DNA", char_hint: "13 letters", difficulty: "easy", category: "Science" },
  { slug: "tr-dna", prompt: "In DNA, adenine pairs with…", choices: ["Thymine", "Guanine", "Cytosine", "Uracil"], alt_hint: "In RNA a different base takes its place", char_hint: "Starts with T", difficulty: "easy", category: "Science" },
  { slug: "tr-antibiotic", prompt: "Antibiotics are ineffective against…", choices: ["Viruses", "Bacteria", "Some fungi", "Protozoa"], alt_hint: "They hijack your own cells", char_hint: "7 letters", difficulty: "easy", category: "Science" },
  { slug: "tr-crispr", prompt: "CRISPR-Cas9 is primarily a tool for…", choices: ["Editing genes", "Sequencing genomes", "Growing stem cells", "Culturing bacteria"], alt_hint: "Bacteria evolved it as an immune system", char_hint: "Two words", difficulty: "medium", category: "Science" },

  { slug: "tr-pi", prompt: "π to two decimal places?", choices: ["3.14", "3.41", "3.12", "3.16"], alt_hint: "It never repeats and never ends", char_hint: "Starts 3.1", difficulty: "easy", category: "Maths" },
  { slug: "tr-2to10", prompt: "2¹⁰ = ?", choices: ["1024", "512", "2048", "100"], alt_hint: "Why a kilobyte isn't 1000 bytes", char_hint: "4 digits", difficulty: "easy", category: "Maths" },
  { slug: "tr-fib", prompt: "Next in the sequence: 1, 1, 2, 3, 5, 8, …", choices: ["13", "11", "10", "16"], alt_hint: "Add the two before it", char_hint: "2 digits", difficulty: "easy", category: "Maths" },
  { slug: "tr-discount", prompt: "A shirt costs €80 after a 20% discount. What was the original price?", choices: ["€100", "€96", "€104", "€90"], alt_hint: "€80 is 80% of the answer — divide, don't add back", char_hint: "A round number", difficulty: "medium", category: "Maths" },
  { slug: "tr-dice", prompt: "Probability of rolling a sum of 7 with two dice?", choices: ["1/6", "1/12", "1/8", "1/9"], alt_hint: "More combinations make 7 than any other total", char_hint: "Six of the 36 outcomes", difficulty: "medium", category: "Maths" },
  { slug: "tr-sd", prompt: "Standard deviation measures…", choices: ["Spread around the mean", "The middle value", "The most common value", "The total"], alt_hint: "Same average, very different stories", char_hint: "About how scattered the data is", difficulty: "easy", category: "Maths" },

  { slug: "tr-swoosh", prompt: "The Nike logo is called the…", choices: ["Swoosh", "Streak", "Wing", "Arc"], alt_hint: "Designed in 1971 for $35", char_hint: "6 letters", difficulty: "easy", category: "Design" },
  { slug: "tr-fedex", prompt: "The FedEx wordmark hides which shape between the E and the x?", choices: ["An arrow", "A flag", "A box", "A wing"], alt_hint: "It's in the negative space", char_hint: "Points right", difficulty: "easy", category: "Design" },
  { slug: "tr-cmyk", prompt: "Which colour model is used for print?", choices: ["CMYK", "RGB", "HSL", "LAB"], alt_hint: "Subtractive — inks absorb light", char_hint: "4 letters", difficulty: "easy", category: "Design" },
  { slug: "tr-kerning", prompt: "\"Kerning\" adjusts…", choices: ["Space between two specific letters", "Space between all letters", "Space between lines", "Space around a text block"], alt_hint: "It's per-pair, not global", char_hint: "The global one is called tracking", difficulty: "medium", category: "Design" },
  { slug: "tr-helvetica", prompt: "Helvetica was designed in which country?", choices: ["Switzerland", "Germany", "United States", "Netherlands"], alt_hint: "The name is Latin for the country", char_hint: "Released 1957", difficulty: "medium", category: "Design" },
  { slug: "tr-bauhaus", prompt: "The Bauhaus school was founded in…", choices: ["Germany", "Austria", "France", "Switzerland"], alt_hint: "Weimar, 1919", char_hint: "7 letters", difficulty: "medium", category: "Design" },
  { slug: "tr-jakob", prompt: "Jakob's Law in UX says…", choices: ["Users expect your product to work like the others they know", "Simpler designs always win", "Users read in an F-pattern", "Choice slows decisions"], alt_hint: "Familiarity is borrowed usability", char_hint: "About convention", difficulty: "medium", category: "Design" },
  { slug: "tr-leading", prompt: "\"Leading\" controls…", choices: ["Space between lines of text", "Space between words", "The first letter's size", "Paragraph indentation"], alt_hint: "Named after strips of metal", char_hint: "Vertical, not horizontal", difficulty: "easy", category: "Design" },

  { slug: "tr-xg", prompt: "What does xG measure in football?", choices: ["The chance of a shot becoming a goal", "Goals scored above average", "Shot power", "Time spent in the box"], alt_hint: "It measures chance quality, not finishing", char_hint: "Expected something", difficulty: "easy", category: "Sport" },
  { slug: "tr-ucl", prompt: "Which club has won the most European Cups / Champions Leagues?", choices: ["Real Madrid", "AC Milan", "Bayern Munich", "Liverpool"], alt_hint: "They won the first five in a row", char_hint: "Spanish", difficulty: "easy", category: "Sport" },
  { slug: "tr-wc22", prompt: "Who won the 2022 World Cup?", choices: ["Argentina", "France", "Brazil", "Croatia"], alt_hint: "It went to penalties after 3–3", char_hint: "9 letters", difficulty: "easy", category: "Sport" },
  { slug: "tr-gegen", prompt: "\"Gegenpressing\" means…", choices: ["Winning the ball back immediately after losing it", "Pressing only in the final third", "Dropping into a low block", "Man-marking across the pitch"], alt_hint: "Klopp called it the best playmaker", char_hint: "It happens in the seconds after a turnover", difficulty: "medium", category: "Sport" },
  { slug: "tr-eagles", prompt: "Nigeria's national football team is nicknamed the…", choices: ["Super Eagles", "Black Stars", "Indomitable Lions", "Bafana Bafana"], alt_hint: "Ghana are the Black Stars", char_hint: "Two words", difficulty: "easy", category: "Sport" },
  { slug: "tr-ppda", prompt: "In football analytics, PPDA measures…", choices: ["Pressing intensity", "Passing accuracy under pressure", "Defensive line height", "Possession per defender"], alt_hint: "Passes Per Defensive Action — lower is more aggressive", char_hint: "About how hard a team presses", difficulty: "hard", category: "Sport" },
  { slug: "tr-afcon", prompt: "Which nation has won the most AFCON titles?", choices: ["Egypt", "Cameroon", "Ghana", "Nigeria"], alt_hint: "Seven of them", char_hint: "North African", difficulty: "medium", category: "Sport" },

  { slug: "tr-inception", prompt: "Who directed \"Inception\"?", choices: ["Christopher Nolan", "Denis Villeneuve", "David Fincher", "Ridley Scott"], alt_hint: "He also made Interstellar", char_hint: "Surname starts with N", difficulty: "easy", category: "Film & TV" },
  { slug: "tr-fps", prompt: "Standard cinema frame rate?", choices: ["24 fps", "30 fps", "60 fps", "25 fps"], alt_hint: "Set in the late 1920s for sound", char_hint: "2 digits", difficulty: "easy", category: "Film & TV" },
  { slug: "tr-nollywood", prompt: "Which country's film industry is nicknamed Nollywood?", choices: ["Nigeria", "India", "Kenya", "Ghana"], alt_hint: "One of the largest by output in the world", char_hint: "West African", difficulty: "easy", category: "Film & TV" },
  { slug: "tr-parasite", prompt: "Which film won Best Picture in 2020, the first not in English?", choices: ["Parasite", "Roma", "Minari", "Drive My Car"], alt_hint: "Bong Joon-ho directed it", char_hint: "8 letters", difficulty: "easy", category: "Film & TV" },
  { slug: "tr-aang", prompt: "In Avatar: The Last Airbender, Aang comes from which nation?", choices: ["Air Nomads", "Water Tribe", "Earth Kingdom", "Fire Nation"], alt_hint: "The clue is in the show's title", char_hint: "Two words", difficulty: "easy", category: "Film & TV" },
  { slug: "tr-macguffin", prompt: "A MacGuffin is…", choices: ["A plot device that drives the story but doesn't matter itself", "A recurring musical theme", "A cameo by the director", "A twist in the third act"], alt_hint: "Hitchcock's term — the briefcase, the formula", char_hint: "What the characters want", difficulty: "medium", category: "Film & TV" },
  { slug: "tr-180", prompt: "The 180-degree rule in filmmaking says…", choices: ["Keep the camera on one side of the action line", "Never pan more than 180°", "Light from two directions", "Cut on movement"], alt_hint: "Break it and screen direction flips", char_hint: "About camera placement", difficulty: "medium", category: "Film & TV" },

  { slug: "tr-llm", prompt: "At its core, a large language model predicts…", choices: ["The next token", "The user's intent", "A database lookup", "A logical proof"], alt_hint: "Everything else emerges from doing this well", char_hint: "Two words", difficulty: "easy", category: "Tech" },
  { slug: "tr-404", prompt: "HTTP status 404 means…", choices: ["Not found", "Forbidden", "Server error", "Unauthorised"], alt_hint: "4xx means the request was the problem", char_hint: "Two words", difficulty: "easy", category: "Tech" },
  { slug: "tr-hash", prompt: "Which data structure gives O(1) average-case lookup?", choices: ["Hash table", "Linked list", "Binary search tree", "Array searched by value"], alt_hint: "It jumps straight to the bucket", char_hint: "Two words", difficulty: "medium", category: "Tech" },
  { slug: "tr-overfit", prompt: "\"Overfitting\" means a model…", choices: ["Memorises training data and fails to generalise", "Trains too slowly", "Has too few parameters", "Uses too much memory"], alt_hint: "It learned the noise as if it were signal", char_hint: "Held-out data catches it", difficulty: "medium", category: "Tech" },
  { slug: "tr-race", prompt: "A race condition is…", choices: ["Behaviour depending on unpredictable timing", "A CPU overheating", "A slow network request", "A memory leak"], alt_hint: "Two operations interleave in an order you didn't plan for", char_hint: "Hard to reproduce", difficulty: "medium", category: "Tech" },
  { slug: "tr-binary", prompt: "Binary 1010 in decimal?", choices: ["10", "8", "12", "5"], alt_hint: "Place values double leftwards: 8, 4, 2, 1", char_hint: "2 digits", difficulty: "easy", category: "Tech" },

  { slug: "tr-dublin", prompt: "Capital of Ireland?", choices: ["Dublin", "Cork", "Galway", "Belfast"], alt_hint: "Belfast is in the UK", char_hint: "6 letters", difficulty: "easy", category: "World" },
  { slug: "tr-naira", prompt: "Which currency does Nigeria use?", choices: ["Naira", "Cedi", "Shilling", "Rand"], alt_hint: "Ghana uses the cedi", char_hint: "5 letters", difficulty: "easy", category: "World" },
  { slug: "tr-nile", prompt: "Longest river in Africa?", choices: ["The Nile", "The Congo", "The Niger", "The Zambezi"], alt_hint: "About 6,650 km", char_hint: "4 letters", difficulty: "easy", category: "World" },
  { slug: "tr-abuja", prompt: "Which city replaced Lagos as Nigeria's capital?", choices: ["Abuja", "Kano", "Port Harcourt", "Enugu"], alt_hint: "Purpose-built and central, from 1991", char_hint: "5 letters", difficulty: "easy", category: "World" },
  { slug: "tr-ogun", prompt: "Ogun is the Yoruba orisha of…", choices: ["Iron and war", "Thunder", "Rivers", "The harvest"], alt_hint: "Patron of blacksmiths, hunters and drivers", char_hint: "Sango is thunder", difficulty: "medium", category: "World" },
  { slug: "tr-fela", prompt: "Fela Kuti pioneered which genre?", choices: ["Afrobeat", "Highlife", "Juju", "Afrobeats"], alt_hint: "Singular, not plural — they're different things", char_hint: "1970s, long political jams", difficulty: "medium", category: "World" },
  { slug: "tr-kells", prompt: "The Book of Kells is housed at…", choices: ["Trinity College Dublin", "The National Museum", "Dublin Castle", "Cork City Library"], alt_hint: "A university library", char_hint: "In Dublin", difficulty: "easy", category: "World" },
  { slug: "tr-yoruba", prompt: "Yoruba belongs to which language family?", choices: ["Niger-Congo", "Afro-Asiatic", "Nilo-Saharan", "Indo-European"], alt_hint: "The largest family in Africa by number of languages", char_hint: "Hyphenated", difficulty: "medium", category: "World" },
];
