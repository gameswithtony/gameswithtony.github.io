// Hand corrections applied on top of the generated data. build.js tells you if an
// entry here stops matching anything.
//
// cards:   card code (preferred) or generated name -> fields to set on that entry.
//          A code listed here also forces that card into the counter cards list.
// exclude: card codes or card names to leave out entirely.

module.exports = {
    cards: {
        // Nick Fury's double-sided suit: Stealth collects threat, Assault spends it.
        '50035a': { name: 'Assault / Stealth' },
        // Phoenix's setup puts 4 power counters on Phoenix Force; the counters live there, not on her.
        '34002a': { counter: 4 },
        '34001a': { useCounter: false }
    },
    exclude: [
        // Back of Loki's four Trickster Takeover forms; its 99 hit points stand for "can't be damaged".
        'Fading Figment'
    ]
};
