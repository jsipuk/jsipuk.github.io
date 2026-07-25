/* Departures — content used by the games. Kept separate from the game logic
 * so questions and bingo squares can be topped up without touching any code.
 */
window.DeparturesData = (function () {
  'use strict';

  // --------------------------------------------------------- Baggage Match
  var memorySets = {
    travel: {
      label: 'Travel',
      icons: ['✈️', '🧳', '🎫', '🗺️', '🕶️', '🏝️', '🚕', '🛎️', '🧭', '📸', '🎒', '🚂', '🌍', '⛱️', '🚢', '🎠', '🗼', '🏨']
    },
    animals: {
      label: 'Animals',
      icons: ['🦊', '🐢', '🦋', '🐙', '🦒', '🐧', '🐬', '🦉', '🐝', '🐘', '🦩', '🐳', '🦔', '🐨', '🦁', '🐸', '🦜', '🐼']
    },
    snacks: {
      label: 'Snacks',
      icons: ['🍎', '🥨', '🍫', '🧃', '🍪', '🥪', '🍇', '🧀', '🍿', '🥐', '🍓', '🥕', '🍌', '🧁', '🍊', '🥤', '🍩', '🥜']
    }
  };

  // ---------------------------------------------------------- Airport Bingo
  var bingo = {
    airport: {
      label: 'At the airport',
      short: 'Airport',
      emoji: '🛫',
      items: [
        ['🧣', 'Someone wearing a neck pillow'],
        ['🧳', 'A bright pink suitcase'],
        ['🐕', 'A dog in a carrier'],
        ['☕', 'Someone carrying two coffees'],
        ['🏃', 'Somebody running for a gate'],
        ['👶', 'A baby in a pram'],
        ['🕶️', 'Sunglasses worn indoors'],
        ['🎒', 'A backpack bigger than its owner'],
        ['📺', 'A delayed flight on the board'],
        ['🧹', 'A cleaning trolley'],
        ['🚨', 'A high-vis jacket'],
        ['🎩', 'A very silly hat'],
        ['🧸', 'A child carrying a teddy'],
        ['📱', 'Someone asleep holding their phone'],
        ['🛴', 'A scooter or skateboard'],
        ['💐', 'Flowers being carried'],
        ['🥪', 'Someone eating a sandwich'],
        ['👟', 'Matching family trainers'],
        ['🎸', 'A musical instrument'],
        ['🧴', 'A clear bag of liquids'],
        ['🚻', 'A queue for the toilets'],
        ['🪑', 'Somebody lying across seats'],
        ['📚', 'A real paper book'],
        ['🛒', 'A duty-free bag'],
        ['👨‍✈️', 'A pilot or cabin crew walking past'],
        ['🕰️', 'A clock showing another city'],
        ['🐻', 'A shop selling soft toys'],
        ['🚌', 'A bus on the tarmac'],
        ['🌧️', 'Rain on the window'],
        ['🎧', 'Big over-ear headphones'],
        ['🍦', 'Someone eating ice cream'],
        ['🧑‍🤝‍🧑', 'A big family all in a row']
      ]
    },
    plane: {
      label: 'On the plane',
      short: 'Plane',
      emoji: '🛩️',
      items: [
        ['🪟', 'A wing out of the window'],
        ['☁️', 'A cloud shaped like an animal'],
        ['🛎️', 'A call bell that pings'],
        ['🥤', 'The drinks trolley arrives'],
        ['😴', 'Somebody snoring'],
        ['🎬', 'A film playing on a nearby screen'],
        ['🧦', 'Someone with their shoes off'],
        ['📖', 'The safety card being read'],
        ['🥨', 'A snack you have never tried'],
        ['🔔', 'The seatbelt sign switches on'],
        ['👋', 'Cabin crew waving at a child'],
        ['🌍', 'A river or coastline below'],
        ['🚽', 'A queue for the loo'],
        ['🧢', 'Someone wearing a cap indoors'],
        ['📝', 'A landing card being filled in'],
        ['🎧', 'Two people sharing headphones'],
        ['🧃', 'An apple juice with a tiny straw'],
        ['🌅', 'The sky changing colour'],
        ['🏔️', 'Mountains or snow below'],
        ['🛬', 'Another plane out of the window'],
        ['🧊', 'A cup with too much ice'],
        ['👕', 'Someone in a very loud shirt'],
        ['📸', 'A window photo being taken'],
        ['🧸', 'A dropped toy rescued'],
        ['🥱', 'A giant yawn'],
        ['🕹️', 'Someone playing a game'],
        ['🍽️', 'A tray table folded down'],
        ['💡', 'A reading light left on'],
        ['🌙', 'The moon out of the window'],
        ['✏️', 'Someone drawing or colouring']
      ]
    },
    journey: {
      label: 'Getting there',
      short: 'Journey',
      emoji: '🚗',
      items: [
        ['🚚', 'A lorry with a name on it'],
        ['🐄', 'A field of cows'],
        ['🌉', 'A bridge you drive under'],
        ['🚲', 'A bike on the back of a car'],
        ['🟡', 'A yellow car'],
        ['🚜', 'A tractor'],
        ['🏰', 'A church spire or castle'],
        ['⛽', 'A petrol station'],
        ['🐑', 'Sheep'],
        ['🚁', 'A helicopter'],
        ['🛣️', 'A sign with an airport symbol'],
        ['🚕', 'A taxi'],
        ['🌳', 'A tree growing on its own in a field'],
        ['🚦', 'Roadworks'],
        ['🏗️', 'A crane'],
        ['🐦', 'A big flock of birds'],
        ['🚑', 'An emergency vehicle'],
        ['🎡', 'A big wheel or funfair'],
        ['🌈', 'A rainbow'],
        ['🚏', 'Someone waiting at a bus stop'],
        ['🏍️', 'A motorbike'],
        ['💨', 'A wind turbine'],
        ['🚂', 'A train'],
        ['🅿️', 'A full car park'],
        ['🦆', 'Ducks or geese'],
        ['🏠', 'A house with a red door'],
        ['🛴', 'Someone on a scooter'],
        ['🍔', 'A drive-through']
      ]
    }
  };

  // ----------------------------------------------------------------- Quiz
  // q: question, a: answers, c: index of the correct one, f: the bit you
  // read out afterwards.
  var quiz = {
    kids: {
      label: 'Little ones',
      hint: 'Ages 4–7',
      questions: [
        { q: 'How many legs does a spider have?', a: ['Six', 'Eight', 'Ten', 'Four'], c: 1, f: 'Insects have six legs — spiders are not insects.' },
        { q: 'What do bees make?', a: ['Butter', 'Honey', 'Bread', 'Jam'], c: 1, f: 'Bees visit thousands of flowers to make one small jar.' },
        { q: 'Which of these can fly?', a: ['A boat', 'A car', 'An aeroplane', 'A train'], c: 2, f: 'You are sitting in the answer.' },
        { q: 'What is a baby dog called?', a: ['A kitten', 'A puppy', 'A calf', 'A cub'], c: 1, f: 'A baby cat is a kitten and a baby sheep is a lamb.' },
        { q: 'How many days are there in a week?', a: ['Five', 'Six', 'Seven', 'Ten'], c: 2, f: 'Seven — and the weekend is only two of them, sadly.' },
        { q: 'What colour do you get if you mix blue and yellow?', a: ['Green', 'Purple', 'Orange', 'Pink'], c: 0, f: 'Blue and yellow make green. Red and blue make purple.' },
        { q: 'Which animal has a long trunk?', a: ['A giraffe', 'An elephant', 'A zebra', 'A hippo'], c: 1, f: 'An elephant uses its trunk to drink, smell and give itself a shower.' },
        { q: 'What do caterpillars turn into?', a: ['Bees', 'Spiders', 'Butterflies', 'Frogs'], c: 2, f: 'They build a chrysalis first and change inside it.' },
        { q: 'Which bird cannot fly?', a: ['A penguin', 'An owl', 'A robin', 'A duck'], c: 0, f: 'Penguins swim instead — very fast indeed.' },
        { q: 'How many sides does a triangle have?', a: ['Two', 'Three', 'Four', 'Five'], c: 1, f: 'A shape with four sides is a square or a rectangle.' },
        { q: 'What is frozen water called?', a: ['Steam', 'Ice', 'Sand', 'Smoke'], c: 1, f: 'Heat it up again and it melts straight back.' },
        { q: 'Which sea animal has eight arms?', a: ['A shark', 'A dolphin', 'An octopus', 'A crab'], c: 2, f: 'An octopus can squeeze through a hole the size of its eye.' },
        { q: 'How many fingers do you have on two hands?', a: ['Eight', 'Ten', 'Twelve', 'Five'], c: 1, f: 'Ten — count them and check.' },
        { q: 'What do we call the person who flies a plane?', a: ['A driver', 'A pilot', 'A captain of a ship', 'A guard'], c: 1, f: 'The pilot in charge is called the captain.' },
        { q: 'Which animal hops and carries its baby in a pouch?', a: ['A kangaroo', 'A rabbit', 'A frog', 'A monkey'], c: 0, f: 'A baby kangaroo is called a joey.' },
        { q: 'What is the opposite of hot?', a: ['Wet', 'Cold', 'Loud', 'Fast'], c: 1, f: 'Hot and cold are opposites, like big and small.' },
        { q: 'How many months are there in a year?', a: ['Ten', 'Twelve', 'Seven', 'Twenty'], c: 1, f: 'January is first and December is last.' },
        { q: 'Which is the biggest?', a: ['A mouse', 'A cat', 'An elephant', 'A rabbit'], c: 2, f: 'Elephants are the biggest animals that walk on land.' },
        { q: 'What do you pack your clothes in for a holiday?', a: ['A saucepan', 'A suitcase', 'A shoe', 'A bucket'], c: 1, f: 'And you always pack one more jumper than you need.' },
        { q: 'What sound does a duck make?', a: ['Moo', 'Quack', 'Baa', 'Woof'], c: 1, f: 'Cows moo, sheep baa and dogs woof.' },
        { q: 'The sun is actually a…', a: ['Planet', 'Star', 'Moon', 'Cloud'], c: 1, f: 'It is a star — just a very close one.' },
        { q: 'What falls from the sky when it is very cold?', a: ['Snow', 'Sand', 'Leaves', 'Glitter'], c: 0, f: 'Every snowflake has six sides.' },
        { q: 'Which animal is often called the king of the jungle?', a: ['The lion', 'The tiger', 'The bear', 'The wolf'], c: 0, f: 'A group of lions is called a pride.' },
        { q: 'What do plants need to grow?', a: ['Sunlight and water', 'Crisps', 'Music', 'Bubbles'], c: 0, f: 'Leaves use sunlight to make the plant its food.' },
        { q: 'What is a baby frog called?', a: ['A tadpole', 'A cub', 'A chick', 'A foal'], c: 0, f: 'Tadpoles grow legs and lose their tails.' },
        { q: 'How many wheels does a bicycle have?', a: ['One', 'Two', 'Three', 'Four'], c: 1, f: 'A tricycle has three — "tri" means three.' },
        { q: 'Which of these lives in water?', a: ['A fish', 'A camel', 'A chicken', 'A mouse'], c: 0, f: 'Fish breathe underwater using their gills.' },
        { q: 'What season comes after summer?', a: ['Spring', 'Autumn', 'Winter', 'Summer again'], c: 1, f: 'Autumn is when the leaves change colour and fall.' },
        { q: 'Which animal is the fastest on land?', a: ['A cheetah', 'A horse', 'A dog', 'A pig'], c: 0, f: 'A cheetah can run faster than a car in a town centre.' },
        { q: 'What do you look at to see what the weather will do?', a: ['A forecast', 'A postcard', 'A sandwich', 'A sock'], c: 0, f: 'Pilots check the weather before every single flight.' },
        { q: 'Which colour is a ripe banana?', a: ['Blue', 'Yellow', 'Purple', 'Grey'], c: 1, f: 'They start green and go yellow, then brown.' },
        { q: 'What planet do we live on?', a: ['Mars', 'The Moon', 'Earth', 'Jupiter'], c: 2, f: 'Earth is the only planet we know of with life on it.' },
        { q: 'How many colours are usually named in a rainbow?', a: ['Three', 'Five', 'Seven', 'Twelve'], c: 2, f: 'Red, orange, yellow, green, blue, indigo, violet.' },
        { q: 'What grows from an acorn?', a: ['An oak tree', 'A rose', 'A mushroom', 'A carrot'], c: 0, f: 'Squirrels bury acorns and forget where — and trees grow.' },
        { q: 'Where does a bird lay its eggs?', a: ['In a nest', 'In a shoe', 'In the sea', 'Underground'], c: 0, f: 'Some birds build a new nest every single year.' },
        { q: 'Which one is a shape with four equal sides?', a: ['A circle', 'A square', 'A triangle', 'A star'], c: 1, f: 'A square is a rectangle where every side is the same.' }
      ]
    },
    family: {
      label: 'Family',
      hint: 'Ages 8–12 and grown-ups',
      questions: [
        { q: 'What is the capital city of France?', a: ['Lyon', 'Paris', 'Marseille', 'Nice'], c: 1, f: 'The Eiffel Tower was built for the 1889 World Fair.' },
        { q: 'Which is the largest ocean on Earth?', a: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], c: 2, f: 'The Pacific covers more of the planet than all the land put together.' },
        { q: 'How many continents are there?', a: ['Five', 'Six', 'Seven', 'Eight'], c: 2, f: 'Africa, Antarctica, Asia, Australia, Europe, North and South America.' },
        { q: 'Which planet is known as the red planet?', a: ['Venus', 'Mars', 'Mercury', 'Neptune'], c: 1, f: 'Its soil is full of iron oxide — the same stuff as rust.' },
        { q: 'What is the largest animal on Earth?', a: ['African elephant', 'Blue whale', 'Giraffe', 'Great white shark'], c: 1, f: 'A blue whale can be longer than three buses in a row.' },
        { q: 'Which country are kangaroos native to?', a: ['Australia', 'Brazil', 'India', 'Kenya'], c: 0, f: 'Australia is both a country and a continent.' },
        { q: 'Which is the largest planet in our solar system?', a: ['Saturn', 'Earth', 'Jupiter', 'Uranus'], c: 2, f: 'Jupiter has a storm bigger than Earth that has raged for centuries.' },
        { q: 'What is the tallest mountain above sea level?', a: ['K2', 'Mount Everest', 'Mont Blanc', 'Kilimanjaro'], c: 1, f: 'Planes cruise only a little higher than its summit.' },
        { q: 'Which river flows through Egypt?', a: ['The Amazon', 'The Nile', 'The Danube', 'The Ganges'], c: 1, f: 'Almost everyone in Egypt lives close to it.' },
        { q: 'What do you call a group of lions?', a: ['A pack', 'A herd', 'A pride', 'A flock'], c: 2, f: 'Wolves come in packs, birds in flocks.' },
        { q: 'Which gas do plants take in from the air?', a: ['Oxygen', 'Carbon dioxide', 'Helium', 'Nitrogen'], c: 1, f: 'They give out oxygen — which is handy for us.' },
        { q: 'What is the currency of Japan?', a: ['Won', 'Yuan', 'Yen', 'Baht'], c: 2, f: 'Japan has more vending machines per person than almost anywhere.' },
        { q: 'Which language is most widely spoken in Brazil?', a: ['Spanish', 'Portuguese', 'French', 'Italian'], c: 1, f: 'It is the only country in South America where that is true.' },
        { q: 'How many players from one football team are on the pitch at kick-off?', a: ['Nine', 'Ten', 'Eleven', 'Twelve'], c: 2, f: 'Eleven, including the goalkeeper.' },
        { q: 'Which metal is liquid at room temperature?', a: ['Mercury', 'Iron', 'Copper', 'Zinc'], c: 0, f: 'It used to be used in thermometers.' },
        { q: 'Which is the smallest country in the world?', a: ['Monaco', 'Malta', 'Vatican City', 'San Marino'], c: 2, f: 'You can walk right across it in about twenty minutes.' },
        { q: 'What is the chemical formula for water?', a: ['CO2', 'H2O', 'O2', 'NaCl'], c: 1, f: 'Two hydrogen atoms holding on to one oxygen.' },
        { q: 'Which country has the largest population?', a: ['China', 'India', 'United States', 'Indonesia'], c: 1, f: 'India passed China in 2023.' },
        { q: 'The Great Barrier Reef lies off the coast of which country?', a: ['Mexico', 'Australia', 'Thailand', 'South Africa'], c: 1, f: 'It is so big it can be seen from space.' },
        { q: 'Which planet has the most obvious rings?', a: ['Mars', 'Saturn', 'Venus', 'Mercury'], c: 1, f: 'The rings are mostly chunks of ice.' },
        { q: 'Which continent is the Sahara desert in?', a: ['Asia', 'Africa', 'South America', 'Australia'], c: 1, f: 'It is the largest hot desert on Earth.' },
        { q: 'How many bones are in an adult human body?', a: ['106', '206', '306', '406'], c: 1, f: 'Babies are born with about 300 — some fuse together as they grow.' },
        { q: 'What is molten rock called once it reaches the surface?', a: ['Magma', 'Lava', 'Granite', 'Quartz'], c: 1, f: 'Underground it is magma; above ground it is lava.' },
        { q: 'Which shape has eight sides?', a: ['Hexagon', 'Pentagon', 'Octagon', 'Heptagon'], c: 2, f: 'Like an octopus, "oct" means eight.' },
        { q: 'In which city would you find Big Ben?', a: ['London', 'Dublin', 'Edinburgh', 'Manchester'], c: 0, f: 'Big Ben is really the bell — the tower is the Elizabeth Tower.' },
        { q: 'Roughly how long does sunlight take to reach the Earth?', a: ['8 seconds', '8 minutes', '8 hours', '8 days'], c: 1, f: 'So you always see the Sun as it was eight minutes ago.' },
        { q: 'What is the study of stars and planets called?', a: ['Geology', 'Astronomy', 'Biology', 'Ecology'], c: 1, f: 'Astronauts travel; astronomers look.' },
        { q: 'Which country is shaped like a boot?', a: ['Greece', 'Italy', 'Portugal', 'Croatia'], c: 1, f: 'Sicily sits right by the toe.' },
        { q: 'What is the world\'s longest wall?', a: ['Hadrian\'s Wall', 'The Great Wall of China', 'The Berlin Wall', 'The Western Wall'], c: 1, f: 'It was built and rebuilt over roughly two thousand years.' },
        { q: 'Which bird can fly backwards?', a: ['The hummingbird', 'The eagle', 'The swan', 'The crow'], c: 0, f: 'Its wings beat so fast they hum — hence the name.' },
        { q: 'Which is the hottest planet in our solar system?', a: ['Mercury', 'Venus', 'Mars', 'Jupiter'], c: 1, f: 'Venus is further from the Sun than Mercury, but its thick clouds trap the heat.' },
        { q: 'What does a thermometer measure?', a: ['Speed', 'Temperature', 'Weight', 'Sound'], c: 1, f: 'Aircraft outside temperature at cruise is often about −50°C.' },
        { q: 'Which sea creature has three hearts?', a: ['Dolphin', 'Octopus', 'Turtle', 'Seahorse'], c: 1, f: 'Two pump blood to the gills and one to the rest of the body.' },
        { q: 'Which ocean lies between Europe and North America?', a: ['Pacific', 'Indian', 'Atlantic', 'Southern'], c: 2, f: 'Most transatlantic flights cross it in six to eight hours.' },
        { q: 'What is the capital of Japan?', a: ['Osaka', 'Kyoto', 'Tokyo', 'Sapporo'], c: 2, f: 'Kyoto was the capital before Tokyo took over in 1868.' },
        { q: 'What is the fastest animal in the world in a dive?', a: ['Cheetah', 'Peregrine falcon', 'Sailfish', 'Swift'], c: 1, f: 'It dives at more than 300 km/h — faster than most trains.' },
        { q: 'Which instrument has 88 keys?', a: ['Guitar', 'Piano', 'Violin', 'Flute'], c: 1, f: 'Fifty-two white ones and thirty-six black.' },
        { q: 'What is the largest country in the world by area?', a: ['Canada', 'China', 'Russia', 'United States'], c: 2, f: 'It spans eleven time zones.' }
      ]
    },
    grownups: {
      label: 'Grown-ups',
      hint: 'Harder — good for the parents',
      questions: [
        { q: 'Which city is served by Schiphol airport?', a: ['Brussels', 'Amsterdam', 'Copenhagen', 'Hamburg'], c: 1, f: 'Schiphol sits about four metres below sea level.' },
        { q: 'What is the capital of Canada?', a: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], c: 2, f: 'Ottawa was chosen partly as a compromise between rival cities.' },
        { q: 'What is the capital of Australia?', a: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], c: 2, f: 'Canberra was purpose-built to settle the Sydney–Melbourne argument.' },
        { q: 'The Trans-Siberian Railway runs from Moscow to which city?', a: ['Vladivostok', 'Beijing', 'Novosibirsk', 'Irkutsk'], c: 0, f: 'The full journey takes about a week.' },
        { q: 'Which strait separates Spain from Morocco?', a: ['Bosphorus', 'Strait of Gibraltar', 'Strait of Hormuz', 'Bering Strait'], c: 1, f: 'At its narrowest it is only about 13 km across.' },
        { q: 'Machu Picchu is in which country?', a: ['Bolivia', 'Chile', 'Peru', 'Ecuador'], c: 2, f: 'It sits roughly 2,400 metres above sea level.' },
        { q: 'What is the world\'s largest island?', a: ['New Guinea', 'Borneo', 'Madagascar', 'Greenland'], c: 3, f: 'Australia is bigger, but counts as a continent rather than an island.' },
        { q: 'The Suez Canal links the Mediterranean to which sea?', a: ['Black Sea', 'Red Sea', 'Caspian Sea', 'Arabian Sea'], c: 1, f: 'It saves ships the entire trip around Africa.' },
        { q: 'Petra is in which country?', a: ['Egypt', 'Jordan', 'Israel', 'Lebanon'], c: 1, f: 'The city was carved straight into rose-coloured rock.' },
        { q: 'Which mountain range is traditionally taken as the border between Europe and Asia?', a: ['The Alps', 'The Caucasus', 'The Urals', 'The Carpathians'], c: 2, f: 'The Urals run roughly north to south through Russia.' },
        { q: 'What is the capital of New Zealand?', a: ['Auckland', 'Wellington', 'Christchurch', 'Dunedin'], c: 1, f: 'Wellington is the southernmost capital city in the world.' },
        { q: 'Angkor Wat is in which country?', a: ['Thailand', 'Vietnam', 'Cambodia', 'Laos'], c: 2, f: 'It is the largest religious monument in the world.' },
        { q: 'Which country has the most UNESCO World Heritage sites?', a: ['France', 'Italy', 'Spain', 'India'], c: 1, f: 'Italy and China trade the top spot between them.' },
        { q: 'Which US state is the largest by area?', a: ['Texas', 'California', 'Alaska', 'Montana'], c: 2, f: 'Alaska is more than twice the size of Texas.' },
        { q: 'The Danube empties into which sea?', a: ['Adriatic', 'Black Sea', 'Baltic', 'Aegean'], c: 1, f: 'It passes through or touches ten countries on the way.' },
        { q: 'What is the deepest known point in the ocean?', a: ['Puerto Rico Trench', 'Java Trench', 'Mariana Trench', 'Tonga Trench'], c: 2, f: 'Nearly 11 km down — Everest would disappear inside it.' },
        { q: 'What is the line of 0° longitude called?', a: ['The Equator', 'The Prime Meridian', 'The Tropic of Cancer', 'The Date Line'], c: 1, f: 'It runs through Greenwich in London.' },
        { q: 'Which of these countries drives on the left?', a: ['Japan', 'France', 'Brazil', 'Germany'], c: 0, f: 'About a third of the world\'s population drives on the left.' },
        { q: 'What is the largest lake in the world by surface area?', a: ['Lake Superior', 'The Caspian Sea', 'Lake Victoria', 'Lake Baikal'], c: 1, f: 'It is called a sea but has no outlet to the ocean.' },
        { q: 'Which country produces the most coffee?', a: ['Colombia', 'Vietnam', 'Brazil', 'Ethiopia'], c: 2, f: 'Brazil has led production for well over a century.' },
        { q: 'What is the capital of Morocco?', a: ['Casablanca', 'Marrakesh', 'Rabat', 'Fez'], c: 2, f: 'Casablanca is bigger, but Rabat governs.' },
        { q: 'Iceland\'s capital is…', a: ['Reykjavik', 'Akureyri', 'Keflavik', 'Torshavn'], c: 0, f: 'Most of Iceland\'s heating comes from geothermal water.' },
        { q: 'Which element has the chemical symbol Fe?', a: ['Iron', 'Lead', 'Tin', 'Fluorine'], c: 0, f: 'From the Latin "ferrum".' },
        { q: 'Which planet rotates on its side?', a: ['Neptune', 'Uranus', 'Saturn', 'Mars'], c: 1, f: 'Its axis is tipped by about 98 degrees.' },
        { q: 'Who painted The Starry Night?', a: ['Claude Monet', 'Vincent van Gogh', 'Paul Cézanne', 'Edvard Munch'], c: 1, f: 'He painted it from a room in an asylum in 1889.' },
        { q: 'In which year did humans first land on the Moon?', a: ['1965', '1969', '1972', '1961'], c: 1, f: 'Apollo 11 landed in July 1969.' },
        { q: 'The Eurostar runs under which body of water?', a: ['The North Sea', 'The English Channel', 'The Irish Sea', 'The Thames'], c: 1, f: 'The tunnel is just over 50 km long.' },
        { q: 'What is the smallest bone in the human body?', a: ['The stapes', 'The femur', 'The radius', 'The patella'], c: 0, f: 'It sits in the middle ear and is a few millimetres long.' },
        { q: 'Which South American capital sits highest above sea level?', a: ['Bogotá', 'Quito', 'La Paz', 'Lima'], c: 2, f: 'La Paz is above 3,600 metres — many visitors need a day to adjust.' },
        { q: 'Prague is the capital of which country?', a: ['Slovakia', 'Czechia', 'Austria', 'Hungary'], c: 1, f: 'Czechia is the shorter official name for the Czech Republic.' },
        { q: 'What is the tallest building in the world?', a: ['Shanghai Tower', 'Burj Khalifa', 'Merdeka 118', 'One World Trade Center'], c: 1, f: 'The Burj Khalifa in Dubai is about 828 metres tall.' },
        { q: 'Which airport uses the code JFK?', a: ['Los Angeles', 'New York', 'Chicago', 'Boston'], c: 1, f: 'New York has three big airports: JFK, LaGuardia and Newark.' },
        { q: 'What does the "ETA" on a departure board stand for?', a: ['Estimated time of arrival', 'Extra time allowed', 'Expected takeoff altitude', 'End of taxi approach'], c: 0, f: 'ETD is the estimated time of departure.' },
        { q: 'Which country is home to the fjords of Bergen and Tromsø?', a: ['Sweden', 'Norway', 'Finland', 'Denmark'], c: 1, f: 'Norway\'s coastline, with all its fjords, is tens of thousands of kilometres long.' },
        { q: 'The Serengeti is mostly in which country?', a: ['Kenya', 'Tanzania', 'Uganda', 'Zambia'], c: 1, f: 'The wildebeest migration crosses into Kenya\'s Masai Mara.' },
        { q: 'What is the official language of Austria?', a: ['Austrian', 'German', 'Swiss', 'Hungarian'], c: 1, f: 'Austrian German has its own words for lots of food.' },
        { q: 'Which sea is the saltiest of these?', a: ['The Baltic Sea', 'The Dead Sea', 'The North Sea', 'The Black Sea'], c: 1, f: 'It is so salty that you float without trying.' },
        { q: 'Which city has an underground railway nicknamed "the Tube"?', a: ['Paris', 'London', 'New York', 'Berlin'], c: 1, f: 'It opened in 1863 and was the first of its kind.' }
      ]
    }
  };

  return { memorySets: memorySets, bingo: bingo, quiz: quiz };
})();
