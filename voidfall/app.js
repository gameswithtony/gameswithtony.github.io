const LOCALSTORAGENAME = "vfgamestate";
const PAGE_STATE = { StartScreen: 0, Technologies: 1, Calculator: 2 };
const FLEET_TYPE = { Corvette: 0, Destroyer: 1, Dreadnaught: 2, Carrier: 3, Sentry: 4, Voidborn: 5, Sector_Defense: 6, Starbase: 7 };
const TECHS = { Sentries: 0, Destroyers: 1, Dreadnaughts: 2, Carriers: 3, DeepSpaceMissiles: 4, EnergyCells: 5, Shields: 6, AutonomousDrones: 7, Targeting: 8, Torpedoes: 9, Starbases: 10, ArkShips: 11, CentralSurveillance: 12, Cloning: 13, Cybernetics: 14, CombatReplicators: 15, DataRefinery: 16, DecontaminationChambers: 17, Hyperdrive: 18, EscapePods: 19, NeuralMatrix: 20, OrbitalDocks: 21, Robotics: 22, Purifier: 23, SalvageScanner: 24, TacticalTransports: 25, Terraforming: 26, TradeNexus: 27
};
const HOUSE_IDS = { NoHouse: 0, Astoran: 1, Belitan: 2, Cortozaar: 3, Dunlork: 4, Fenrax: 5, Kradmor: 6, Marqualos: 7, Nervo: 8, Novaris: 9, Shiveus: 10, Thegwyn: 11, Valnis: 12, Yarvek: 13, Zenor: 14 };
const HOUSE_ORIGINS = { A: 0, B: 1 };
SCENARIO_TYPE = { Solo: 0, Cooperative: 1, Competitive: 2 };

function chooseRandom(min, max, exclude) {
    min = Math.ceil(min);
    max = Math.floor(max);
    let result = Math.floor(Math.random() * (max - min + 1) + min);

    // assumes at most only one excluded value at a time
    if (exclude) {
        if (result === exclude) {
            if (result === 8) {
                result = 1;
            } else {
                result++;
            }
        }
    }

    return result;
}

function getFleetDesc(fleet_type) {
    switch (fleet_type) {
        case FLEET_TYPE.Corvette: return 'Corvette';
        case FLEET_TYPE.Destroyer: return 'Destroyer';
        case FLEET_TYPE.Dreadnaught: return 'Dreadnaught';
        case FLEET_TYPE.Carrier: return 'Carrier';
        case FLEET_TYPE.Sentry: return 'Sentry';
        case FLEET_TYPE.Voidborn: return 'Voidborn';
    }
}

function getHouseDesc(houseid) {
    switch (houseid) {
        case HOUSE_IDS.NoHouse: return '';
        case HOUSE_IDS.Astoran: return 'Astoran';
        case HOUSE_IDS.Belitan: return 'Belitan';
        case HOUSE_IDS.Cortozaar: return 'Cortozaar';
        case HOUSE_IDS.Dunlork: return 'Dunlork';
        case HOUSE_IDS.Fenrax: return 'Fenrax';
        case HOUSE_IDS.Kradmor: return 'Kradmor';
        case HOUSE_IDS.Marqualos: return 'Marqualos';
        case HOUSE_IDS.Nervo: return 'Nervo';
        case HOUSE_IDS.Novaris: return 'Novaris';
        case HOUSE_IDS.Shiveus: return 'Shiveus';
        case HOUSE_IDS.Thegwyn: return 'Thegwyn';
        case HOUSE_IDS.Valnis: return 'Valnis';
        case HOUSE_IDS.Yarvek: return 'Yarvek';
        case HOUSE_IDS.Zenor: return 'Zenor';
    }
}

function getHouseOriginName(originid) {
    switch (originid) {
        case HOUSE_ORIGINS.A: return 'A';
        case HOUSE_ORIGINS.B: return 'B';
    }
}

function getTechName(techid) {
    switch (techid) {
        case TECHS.ArkShips: return 'Ark Ships';
        case TECHS.AutonomousDrones: return 'Autonomous Drones';
        case TECHS.Carriers: return 'Carriers';
        case TECHS.CentralSurveillance: return 'Central Surveillance';
        case TECHS.Cloning: return 'Cloning';
        case TECHS.CombatReplicators: return 'Combat Replicators';
        case TECHS.Cybernetics: return 'Cybernetics';
        case TECHS.DataRefinery: return 'Data Refinery';
        case TECHS.DecontaminationChambers: return 'Decontamination Chambers';
        case TECHS.DeepSpaceMissiles: return 'Deep Space Missiles';
        case TECHS.Destroyers: return 'Destroyers';
        case TECHS.Dreadnaughts: return 'Dreadnaughts';
        case TECHS.EnergyCells: return 'Energy Cells';
        case TECHS.EscapePods: return 'Escape Pods';
        case TECHS.Hyperdrive: return 'Hyperdrive';
        case TECHS.NeuralMatrix: return 'Neural Matrix';
        case TECHS.OrbitalDocks: return 'Orbital Docks';
        case TECHS.Purifier: return 'Purifier';
        case TECHS.Robotics: return 'Robotics';
        case TECHS.SalvageScanner: return 'Salvage Scanner';
        case TECHS.Sentries: return 'Sentries';
        case TECHS.Shields: return 'Shields';
        case TECHS.Starbases: return 'Starbases';
        case TECHS.TacticalTransports: return 'Tactical Transports';
        case TECHS.Targeting: return 'Targeting';
        case TECHS.Terraforming: return 'Terraforming';
        case TECHS.Torpedoes: return 'Torpedoes';
        case TECHS.TradeNexus: return 'Trade Nexus';
    }
}

const { createApp } = Vue

// house data
class HouseOrigin {
    originid;
    techid;

    constructor(originid, techid) {
        this.originid = originid;
        this.techid = techid;
    }
}

class House {
    id;
    name;
    origins = [];
    crackedGlassOnFallenHouse = false;
    constructor(id, name, origins, crackedGlassOnFallenHouse) {
        this.id = id;
        this.name = name;
        this.origins = origins;
        this.crackedGlassOnFallenHouse = crackedGlassOnFallenHouse;
    }

    getStartingTech(originid) {
        let origin = _.find(this.origins, function(o) { o.id === originid });

        if (origin) { return origin.techid; } else {
            alert("Origin not found.");
        }
    }
}

let Houses = [
    new House(HOUSE_IDS.Astoran, getHouseDesc(HOUSE_IDS.Astoran), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.DeepSpaceMissiles),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.Sentries)
    ], true),
    new House(HOUSE_IDS.Belitan, getHouseDesc(HOUSE_IDS.Belitan), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Targeting),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.DataRefinery)
    ], false),
    new House(HOUSE_IDS.Cortozaar, getHouseDesc(HOUSE_IDS.Cortozaar), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Torpedoes),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.Starbases)
    ], false),
    new House(HOUSE_IDS.Dunlork, getHouseDesc(HOUSE_IDS.Dunlork), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.OrbitalDocks),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.EnergyCells)
    ], true),
    new House(HOUSE_IDS.Fenrax, getHouseDesc(HOUSE_IDS.Fenrax), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Carriers),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.CentralSurveillance)
    ], false),
    new House(HOUSE_IDS.Kradmor, getHouseDesc(HOUSE_IDS.Kradmor), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.SalvageScanner),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.Purifier)
    ], false),
    new House(HOUSE_IDS.Marqualos, getHouseDesc(HOUSE_IDS.Marqualos), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.AutonomousDrones),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.TradeNexus)
    ], false),
    new House(HOUSE_IDS.Nervo, getHouseDesc(HOUSE_IDS.Nervo), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Robotics),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.ArkShips)
    ], false),
    new House(HOUSE_IDS.Novaris, getHouseDesc(HOUSE_IDS.Novaris), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.CombatReplicators),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.Cybernetics)
    ], false),
    new House(HOUSE_IDS.Shiveus, getHouseDesc(HOUSE_IDS.Shiveus), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Dreadnaughts),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.DecontaminationChambers)
    ], true),
    new House(HOUSE_IDS.Thegwyn, getHouseDesc(HOUSE_IDS.Thegwyn), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Terraforming),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.NeuralMatrix)
    ], false),
    new House(HOUSE_IDS.Valnis, getHouseDesc(HOUSE_IDS.Valnis), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Shields),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.EscapePods)
    ], false),
    new House(HOUSE_IDS.Yarvek, getHouseDesc(HOUSE_IDS.Yarvek), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Hyperdrive),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.TacticalTransports)
    ], false),
    new House(HOUSE_IDS.Zenor, getHouseDesc(HOUSE_IDS.Zenor), [
        new HouseOrigin(HOUSE_ORIGINS.A, TECHS.Destroyers),
        new HouseOrigin(HOUSE_ORIGINS.B, TECHS.Cloning)
    ], true)
]

function getHouseById(houseid) {
    return _.find(Houses, function(h) { return h.id === houseid; });
}


class HouseWithOrigin {
    id;
    house;
    origin;
    name;
    constructor(house, origin) {
        this.id = `${ house.id }_${ origin.originid}`;
        this.house = house;
        this.origin = origin;
        this.name = `${ house.name } - ${ getHouseOriginName(origin.originid) }`
    }
}
const HousesWithOrigins = [];
for (let house of Houses) {
    for (let origin of house.origins) {
        HousesWithOrigins.push(new HouseWithOrigin(house, origin));
    }
}

function getHouseWithRandomOrigin(houseid, isTutorial) {
    let housesWithOrigin = _.filter(HousesWithOrigins, function(h) { return h.house.id === houseid });

    if (housesWithOrigin.length > 1) {
        if (!isTutorial) return housesWithOrigin[chooseRandom(0, 1)];
        else return housesWithOrigin[0];
    } else {
        return housesWithOrigin[0];
    }
}

// tech data
class Technology {
    id;
    name;
    isImproved;
    is
    constructor(id, name, isImproved) {
        this.id = id;
        this.name = name;
        this.isImproved = isImproved;
    }
}

let Technologies = [
    new Technology(TECHS.AutonomousDrones, "Autonomous Drones", false),
    new Technology(TECHS.Carriers, "Carriers", false),
    new Technology(TECHS.DeepSpaceMissiles, "Deep Space Missiles", false),
    new Technology(TECHS.Destroyers, "Destroyers", false),
    new Technology(TECHS.Dreadnaughts, "Dreadnaughts", false),
    new Technology(TECHS.EnergyCells, "Energy Cells", false),
    new Technology(TECHS.Sentries, "Sentries", false),
    new Technology(TECHS.Shields, "Shields", false),
    new Technology(TECHS.Starbases, "Starbases", false),
    new Technology(TECHS.Targeting, "Targeting", false),
    new Technology(TECHS.Torpedoes, "Torpedoes", false),
]

function getTechById(techid) {
    return _.find(Technologies, function(t) { return t.id === techid; });
}

// tableau tech
class TableauTech {
    tech;
    name;
    hasVPCard;
    hasNonVPCard;
    fallenHouse;
    fallenHouseName;

    constructor(tech, name, hasVPCard, hasNonVPCard, fallenHouse) {
        this.tech = tech;
        this.name = name;
        this.hasVPCard = hasVPCard;
        this.hasNonVPCard = hasNonVPCard;
        this.fallenHouse = fallenHouse;
        this.fallenHouseName = fallenHouse ? fallenHouse.name : '';
    }
}

// scenarios
class Scenario {
    id; // referred to as 'reference no.' in the Compendium
    type;
    name;
    numberOfPlayers;
    aggression;
    complexity;
    fallenHouses = []; // fallen houses define techs, whether chosen during Cooperative play or specified in Competitive scenarios
    recommendedHouses = [];

    constructor(id, type, name, numberOfPlayers, aggression, complexity, fallenHouses, recommendedHouses) {
        this.id = id;
        this.type = type;
        this.name = name;
        this.numberOfPlayers = numberOfPlayers;
        this.aggression = aggression;
        this.complexity = complexity
        this.fallenHouses = fallenHouses;
        this.recommendedHouses = recommendedHouses;
    }
}

// solo and cooperative scenarios have empty fallen houses, as these are determined during setup
const Scenarios = [
    new Scenario('T', SCENARIO_TYPE.Solo, 'Tutorial', 1, null, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('C011', SCENARIO_TYPE.Solo, 'First Stand', 1, null, 1, []),
    new Scenario('C021', SCENARIO_TYPE.Solo, 'And One For All', 1, null, 2, []),
    new Scenario('C031', SCENARIO_TYPE.Solo, 'Darkest Hour', 1, null, 2, []),
    new Scenario('C041', SCENARIO_TYPE.Solo, 'Ancient Secrets', 1, null, 3, []),
    new Scenario('C051', SCENARIO_TYPE.Solo, 'Devil\'s Triangle', 1, null, 3, []),
    new Scenario('C061', SCENARIO_TYPE.Solo, 'When Darkness Fades', 1, null, 3, []),
    new Scenario('C071', SCENARIO_TYPE.Solo, 'Today Is Not The Day', 1, null, 4, []),
    new Scenario('C081', SCENARIO_TYPE.Solo, 'Fall Of Civilization', 1, null, 4, []),
    new Scenario('T', SCENARIO_TYPE.Cooperative, 'Tutorial', 2, null, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('C012', SCENARIO_TYPE.Cooperative, 'First Stand', 2, null, 1, []),
    new Scenario('C022', SCENARIO_TYPE.Cooperative, 'And One For All', 2, null, 2, []),
    new Scenario('C032', SCENARIO_TYPE.Cooperative, 'Darkest Hour', 2, null, 2, []),
    new Scenario('C042', SCENARIO_TYPE.Cooperative, 'Ancient Secrets', 2, null, 3, []),
    new Scenario('C052', SCENARIO_TYPE.Cooperative, 'Devil\'s Triangle', 2, null, 2, []),
    new Scenario('C062', SCENARIO_TYPE.Cooperative, 'When Darkness Fades', 2, null, 3, []),
    new Scenario('C072', SCENARIO_TYPE.Cooperative, 'Today Is Not The Day', 2, null, 4, []),
    new Scenario('T', SCENARIO_TYPE.Cooperative, 'Tutorial', 3, null, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('C013', SCENARIO_TYPE.Cooperative, 'First Stand', 3, null, 1, []),
    new Scenario('C023', SCENARIO_TYPE.Cooperative, 'And One For All', 3, null, 2, []),
    new Scenario('C033', SCENARIO_TYPE.Cooperative, 'Darkest Hour', 3, null, 3, []),
    new Scenario('C043', SCENARIO_TYPE.Cooperative, 'Ancient Secrets', 3, null, 4, []),
    new Scenario('C053', SCENARIO_TYPE.Cooperative, 'Devil\'s Triangle', 3, null, 3, []),
    new Scenario('C063', SCENARIO_TYPE.Cooperative, 'When Darkness Fades', 3, null, 4, []),
    new Scenario('T', SCENARIO_TYPE.Cooperative, 'Tutorial', 4, null, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('C034', SCENARIO_TYPE.Cooperative, 'Darkest Hour', 4, null, 3, []),
    new Scenario('C044', SCENARIO_TYPE.Cooperative, 'Ancient Secrets', 4, null, 4, []),
    new Scenario('C054', SCENARIO_TYPE.Cooperative, 'Devil\'s Triangle', 4, null, 3, []),
    new Scenario('C064', SCENARIO_TYPE.Cooperative, 'When Darkness Fades', 4, null, 4, []),
    new Scenario('T', SCENARIO_TYPE.Competitive, 'Tutorial', 2, 1, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]), 
    new Scenario('X012', SCENARIO_TYPE.Competitive, 'Second Genesis', 2, 4, 2, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X022', SCENARIO_TYPE.Competitive, 'For Peace and Prosperity', 2, 2, 3, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X032', SCENARIO_TYPE.Competitive, 'Foundations of the Future', 2, 2, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X042', SCENARIO_TYPE.Competitive, 'Novarchon Legacy', 2, 3, 3, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X052', SCENARIO_TYPE.Competitive, 'Art of War', 2, 4, 4, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X062', SCENARIO_TYPE.Competitive, 'Whirling Destinies', 2, 4, 3, [
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Yarvek),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X072', SCENARIO_TYPE.Competitive, 'Through the Altered Space', 2, 3, 4, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X082', SCENARIO_TYPE.Competitive, 'Echoes of the Past', 2, 2, 3, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X092', SCENARIO_TYPE.Competitive, 'Bastion of Resistance', 2, 3, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Shiveus)
    ],
    [
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X102', SCENARIO_TYPE.Competitive, 'Kingdom Come', 2, 1, 2, [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn)
    ]),
    new Scenario('X112', SCENARIO_TYPE.Competitive, 'Fractures of Space', 2, 2, 3, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('T', SCENARIO_TYPE.Competitive, 'Tutorial', 3, 1, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]), 
    new Scenario('X013', SCENARIO_TYPE.Competitive, 'Second Genesis', 3, 4, 2, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X023', SCENARIO_TYPE.Competitive, 'For Peace and Prosperity', 3, 2, 3, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X033', SCENARIO_TYPE.Competitive, 'Foundations of the Future', 3, 3, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X043', SCENARIO_TYPE.Competitive, 'Novarchon Legacy', 3, 4, 3, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X053', SCENARIO_TYPE.Competitive, 'Art of War', 3, 4, 4, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X063', SCENARIO_TYPE.Competitive, 'Whirling Destinies', 3, 4, 3, [
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Yarvek),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X073', SCENARIO_TYPE.Competitive, 'Through the Altered Space', 3, 3, 4, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X083', SCENARIO_TYPE.Competitive, 'Echoes of the Past', 3, 2, 3, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X093', SCENARIO_TYPE.Competitive, 'Bastion of Resistance', 3, 3, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Shiveus)
    ],
    [
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X103', SCENARIO_TYPE.Competitive, 'Kingdom Come', 3, 1, 2, [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn)
    ]),
    new Scenario('X113', SCENARIO_TYPE.Competitive, 'Fractures of Space', 3, 2, 3, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('T', SCENARIO_TYPE.Competitive, 'Tutorial', 4, 1, 1, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Thegwyn)
    ], [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]), 
    new Scenario('X014', SCENARIO_TYPE.Competitive, 'Second Genesis', 4, 3, 2, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ], 
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X024', SCENARIO_TYPE.Competitive, 'For Peace and Prosperity', 4, 2, 3, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X034', SCENARIO_TYPE.Competitive, 'Foundations of the Future', 4, 3, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Thegwyn)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X044', SCENARIO_TYPE.Competitive, 'Novarchon Legacy', 4, 4, 3, [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X054', SCENARIO_TYPE.Competitive, 'Art of War', 4, 4, 4, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ]),
    new Scenario('X064', SCENARIO_TYPE.Competitive, 'Whirling Destinies', 4, 4, 3, [
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Yarvek),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X074', SCENARIO_TYPE.Competitive, 'Through the Altered Space', 4, 3, 4, [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Valnis)
    ],
    [
        getHouseById(HOUSE_IDS.Astoran),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Shiveus),
        getHouseById(HOUSE_IDS.Zenor)
    ]),
    new Scenario('X084', SCENARIO_TYPE.Competitive, 'Echoes of the Past', 4, 3, 3, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Zenor)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X094', SCENARIO_TYPE.Competitive, 'Bastion of Resistance', 4, 3, 3, [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Shiveus)
    ],
    [
        getHouseById(HOUSE_IDS.Marqualos),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Thegwyn),
        getHouseById(HOUSE_IDS.Yarvek)
    ]),
    new Scenario('X104', SCENARIO_TYPE.Competitive, 'Kingdom Come', 4, 1, 2, [
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Cortozaar),
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Thegwyn)
    ]),
    new Scenario('X114', SCENARIO_TYPE.Competitive, 'Fractures of Space', 4, 2, 4, [
        getHouseById(HOUSE_IDS.Dunlork),
        getHouseById(HOUSE_IDS.Fenrax),
        getHouseById(HOUSE_IDS.Novaris),
        getHouseById(HOUSE_IDS.Yarvek)
    ],
    [
        getHouseById(HOUSE_IDS.Belitan),
        getHouseById(HOUSE_IDS.Kradmor),
        getHouseById(HOUSE_IDS.Nervo),
        getHouseById(HOUSE_IDS.Valnis)
    ])
]

// player classes
class Player {
    id = 0;
    name = '';
    techs = [];
    unusedTechs = [];
    houseWithOrigin;
    constructor(id, name, techs, unusedTechs, houseWithOrigin) {
        this.id = id;
        this.name = name;
        this.techs = _.filter(techs, function(t) { return t; }); // fixing possible nulls from old save
        this.unusedTechs = unusedTechs;
        this.houseWithOrigin = houseWithOrigin;
    }

    isHumanPlayer() {
        return this.id > 0 && this.id != 1000;
    }

    isNervo() {
        if (this.houseWithOrigin && this.houseWithOrigin.house) {
            return this.houseWithOrigin.house.id === HOUSE_IDS.Nervo;
        } else return true; // handle old saves
    }
}

class PlayerFleet {
    fleetType;
    name;
    power = 0;
    constructor(fleetType, name, power) {
        this.fleetType = fleetType;
        this.name = name;
        this.power = power;
    }
}

let Fleets = [
    new PlayerFleet(FLEET_TYPE.Corvette, 'Corvettes', 0),
    new PlayerFleet(FLEET_TYPE.Destroyer, 'Destroyers', 0),
    new PlayerFleet(FLEET_TYPE.Dreadnaught, 'Dreadnaughts', 0),
    new PlayerFleet(FLEET_TYPE.Carrier, 'Carriers', 0),
    new PlayerFleet(FLEET_TYPE.Sentry, 'Sentries', 0),
    new PlayerFleet(FLEET_TYPE.Voidborn, 'Voidborn', 0),
    new PlayerFleet(FLEET_TYPE.Sector_Defense, 'Sector Defenses', 0),
    new PlayerFleet(FLEET_TYPE.Starbase, 'Starbases', 0)
];

class PlayerDamageOption {
    fleetType;
    powerLoss;
    constructor(fleetType, powerLoss) {
        this.fleetType = fleetType;
        this.powerLoss = powerLoss;
    }
}

class PlayerState {
    id;
    playerid;
    name;
    isInvader = true;
    fleets = _.clone(Fleets);
    techs = [];
    useBombard = false;
    bombardAbsorption = 0;
    bombardSalvoAbsorption = 0;
    spendTradeTokenToUseAutonomousDrones = false;
    spendEnergyToUseBasicDeepSpaceMissiles = false;
    adjacentSectorsWithShipyards = 0;
    adjacentSectorsWithStarbases = 0;
    plusOneVoidbornApproachAbsorption = false;
    plusOneVoidbornSalvoAbsorption = false;
    plusTwoVoidbornSalvoAbsorption = false;
    plusFiveVoidbornInitiative = false;
    plusXVoidbornSalvoAbsorption = false;
    totalApproachAbsorption = null;
    totalSalvoAbsorption = null;
    
    constructor(id, playerid, name, isInvader, fleets, techs, useBombard, bombardAbsorption, spendTradeTokenToUseAutonomousDrones, spendEnergyToUseBasicDeepSpaceMissiles, adjacentSectorsWithShipyards, adjacentSectorsWithStarbases, plusOneVoidbornApproachAbsorption, plusOneVoidbornSalvoAbsorption, plusTwoVoidbornSalvoAbsorption, plusFiveVoidbornInitiative, bombardSalvoAbsorption, plusXVoidbornSalvoAbsorption) {
        this.id = id;
        this.playerid = playerid;
        this.name = name;
        this.isInvader = isInvader;
        this.fleets = fleets; 
        this.techs = techs;
        this.useBombard = useBombard;
        this.bombardAbsorption = bombardAbsorption;
        this.spendTradeTokenToUseAutonomousDrones = spendTradeTokenToUseAutonomousDrones;
        this.spendEnergyToUseBasicDeepSpaceMissiles = spendEnergyToUseBasicDeepSpaceMissiles;
        this.adjacentSectorsWithShipyards = adjacentSectorsWithShipyards;
        this.adjacentSectorsWithStarbases = adjacentSectorsWithStarbases;
        this.plusOneVoidbornApproachAbsorption = plusOneVoidbornApproachAbsorption;
        this.plusOneVoidbornSalvoAbsorption = plusOneVoidbornSalvoAbsorption;
        this.plusTwoVoidbornSalvoAbsorption = plusTwoVoidbornSalvoAbsorption;
        this.plusFiveVoidbornInitiative = plusFiveVoidbornInitiative;
        this.bombardSalvoAbsorption = bombardSalvoAbsorption ? bombardSalvoAbsorption : 0;
        this.plusXVoidbornSalvoAbsorption = plusXVoidbornSalvoAbsorption ? plusXVoidbornSalvoAbsorption : 0;
        this.totalApproachAbsorption = null;
        this.totalSalvoAbsorption = null;
    }

    getSortableId() {
        if (this.totalVoidbornFleetPower() > 0) {
            return "V" + this.totalVoidbornFleetPower();
        } else {
            let str = "PLYR_";
            str = str + this.totalDreadnaughtFleetPower() + this.totalDestroyerFleetPower() + this.totalSentryFleetPower() + this.totalCarrierFleetPower() + this.totalCorvetteFleetPower();
            return str;
        }
    }

    totalFleetPower() {
        return _.sumBy(_.filter(this.fleets, function(f) {  return f.fleetType !== FLEET_TYPE.Sector_Defense && f.fleetType !== FLEET_TYPE.Starbase; }), function(f) { return f.power });
    }

    totalFleetPowerIsZero() {
        return this.totalFleetPower() === 0;
    }

    isHumanPlayer() {
        return this.playerid > 0 && this.playerid != 1000;
    }

    isVoidborn() {
        return this.playerid == 1000;
    }

    totalCorvetteFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Corvette }).power;
    }

    totalDestroyerFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Destroyer }).power;
    }

    totalDreadnaughtFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Dreadnaught }).power;
    }

    totalCarrierFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Carrier }).power;
    }

    totalSentryFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Sentry }).power;
    }

    totalVoidbornFleetPower() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Voidborn }).power;
    }

    totalSectorDefense() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Sector_Defense }).power;
    }

    totalStarbase() {
        return _.find(this.fleets, function(f) { return f.fleetType === FLEET_TYPE.Starbase }).power;
    }

    getFleet(fleetType) {
        // needs to be a reference to the fleet for later updates
        return _.find(this.fleets, function(f) { return f.fleetType === fleetType });
    }

    hasBasicTargetingTech() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Targeting });

        if (tech) {
            return !tech.isImproved;
        }
        return false;
    }

    hasImprovedTargetingTech() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Targeting });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasDeepSpaceMissiles() {
        return _.find(this.techs, function(t) { return t.id === TECHS.DeepSpaceMissiles });
    }

    hasBasicDeepSpaceMissiles() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.DeepSpaceMissiles });

        if (tech) {
            return !tech.isImproved;
        }
        return false;
    }

    hasImprovedDeepSpaceMissiles() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.DeepSpaceMissiles });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasShields() {
        return _.find(this.techs, function(t) { return t.id === TECHS.Shields });
    }

    hasImprovedShields() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Shields });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasEnergyCellTech() {
        return _.find(this.techs, function(t) { return t.id === TECHS.EnergyCells });
    }

    hasImprovedDestroyers() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Destroyers });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasImprovedDreadnaughts() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Dreadnaughts });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasImprovedCarriers() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Carriers });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasAutonomousDrones() {
        return _.find(this.techs, function(t) { return t.id === TECHS.AutonomousDrones });
    }

    hasBasicAutonomousDrones() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.AutonomousDrones });

        if (tech) {
            return !tech.isImproved;
        }
        return false;
    }

    hasImprovedAutonomousDrones() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.AutonomousDrones });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasTorpedoes() {
        return _.find(this.techs, function(t) { return t.id === TECHS.Torpedoes });
    }

    hasBasicTorpedoes() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Torpedoes });

        if (tech) {
            return !tech.isImproved;
        }
        return false;
    }

    hasImprovedTorpedoes() {
        const tech = _.find(this.techs, function(t) { return t.id === TECHS.Torpedoes });

        if (tech) {
            return tech.isImproved;
        }
        return false;
    }

    hasCorvetteRelatedTech() {
        return this.hasShields() || this.hasTorpedoes();
    }

    initiative() {
        // initiative should be calculated at the beginning of each salvo step
        let totalInitiative = 0;
        const corvetteFleetPower = this.totalCorvetteFleetPower();
        const destroyerFleetPower = this.totalDestroyerFleetPower();
        const dreadnaughtFleetPower = this.totalDreadnaughtFleetPower();
        const carrierFleetPower = this.totalCarrierFleetPower(); 
        const totalVoidbornFleetPower = this.totalVoidbornFleetPower();
        let initialInitiative = corvetteFleetPower + destroyerFleetPower + dreadnaughtFleetPower + carrierFleetPower + totalVoidbornFleetPower;

        totalInitiative = totalInitiative + initialInitiative;

        if (dreadnaughtFleetPower > 0) { 
            totalInitiative = totalInitiative + 1;
        }

        if (this.isInvader && destroyerFleetPower > 0) { 
            totalInitiative = totalInitiative + 1;
        }

        const sentryFleetPower = this.totalSentryFleetPower();
        if (this.isInvader) {
            totalInitiative = totalInitiative + sentryFleetPower;
        }

        if (corvetteFleetPower > 0 && this.hasBasicTargetingTech()) {
            totalInitiative = totalInitiative + 5;
        }

        if (totalInitiative > 0) {
            if (this.hasImprovedTargetingTech()) {
                return 10000;
            }
        }

        if (this.isVoidborn() && this.plusFiveVoidbornInitiative) {
            totalInitiative = totalInitiative + 5;
        }

        return totalInitiative;
    }

    updateAbsorptionUsed(attack, isApproachStep) {
        if (isApproachStep) {
            this.totalApproachAbsorption = this.totalApproachAbsorption - attack;
            if (this.totalApproachAbsorption < 0) { this.totalApproachAbsorption = 0; }
        } else {
            this.totalSalvoAbsorption = this.totalSalvoAbsorption - attack;
            if (this.totalSalvoAbsorption < 0) { this.totalSalvoAbsorption = 0; }
        }
    }

    resetAbsorptionUsed(attack, isApproachStep) {
        if (isApproachStep) {
            this.totalApproachAbsorption = this.totalApproachAbsorption + attack;
        } else {
            this.totalSalvoAbsorption = this.totalSalvoAbsorption + attack;
        }
    }

    absorption(isApproachStep) {
        let totalAbsorption = 0;
        let absDescription = [];

        if ((isApproachStep && this.totalApproachAbsorption === null) || (!isApproachStep && this.totalSalvoAbsorption === null)) {

            // defender approach
            if (!this.isInvader && isApproachStep) {
                if (this.hasImprovedShields() && this.totalCorvetteFleetPower() > 0) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Defender Abs (Improved Shields)');
                }
            }

            // invader approach
            if (this.isInvader && isApproachStep) {
                if (this.hasImprovedShields() && this.totalCorvetteFleetPower() > 0) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (Improved Shields)');
                }

                totalAbsorption = totalAbsorption + this.totalDreadnaughtFleetPower();

                if (this.totalDreadnaughtFleetPower() > 0) {
                    absDescription.push('+' + this.totalDreadnaughtFleetPower() + ' Invader Abs (Dreadnaughts)');
                }

                if (this.hasAutonomousDrones() && this.spendTradeTokenToUseAutonomousDrones) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (Drones)');
                }

                if (this.useBombard && this.bombardAbsorption > 0) {
                    totalAbsorption = totalAbsorption + this.bombardAbsorption;
                    absDescription.push('+' + this.bombardAbsorption + ' Invader Abs (Bombard)');
                }

                if (this.isVoidborn() && this.plusOneVoidbornApproachAbsorption) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (War card)');
                }
            }

            // defender salvo
            // salvo absorption should only be calculated and used ONCE during a combat
            if (!this.isInvader && !isApproachStep) {
                if (this.hasShields() && this.totalCorvetteFleetPower() > 0) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Defender Abs (Shields)');
                }

                totalAbsorption = totalAbsorption + this.totalDreadnaughtFleetPower();

                if (this.totalDreadnaughtFleetPower() > 0) {
                    absDescription.push('+' + this.totalDreadnaughtFleetPower() + ' Defender Abs (Dreadnaught)');
                }

                totalAbsorption = totalAbsorption + this.totalCarrierFleetPower();

                if (this.totalCarrierFleetPower() > 0) {
                    absDescription.push('+' + this.totalCarrierFleetPower() + ' Defender Abs (Carrier)');
                }
            }

            // invader salvo
            // salvo absorption should only be calculated and used ONCE during a combat
            if (this.isInvader && !isApproachStep) {
                if (this.hasShields() && this.totalCorvetteFleetPower() > 0) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (Shields)');
                }

                if (this.hasBasicAutonomousDrones() && this.spendTradeTokenToUseAutonomousDrones) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (Drones)');
                }

                if (this.hasImprovedAutonomousDrones() && this.spendTradeTokenToUseAutonomousDrones) {
                    totalAbsorption = totalAbsorption + 2;
                    absDescription.push('+2 Invader Abs (Improved Drones)');
                }

                if (this.useBombard && this.bombardSalvoAbsorption > 0) {
                    totalAbsorption = totalAbsorption + this.bombardSalvoAbsorption;
                    absDescription.push('+' + this.bombardSalvoAbsorption + ' Invader Abs (Bombard)');
                }

                if (this.isVoidborn() && this.plusOneVoidbornSalvoAbsorption) {
                    totalAbsorption = totalAbsorption + 1;
                    absDescription.push('+1 Invader Abs (War card - Easy)');
                }

                if (this.isVoidborn() && this.plusTwoVoidbornSalvoAbsorption) {
                    totalAbsorption = totalAbsorption + 2;
                    absDescription.push('+2 Invader Abs (War card - Normal/Hard)');
                }

                // Galactic Event H (Cycle 2)
                if (this.isVoidborn() && this.plusXVoidbornSalvoAbsorption) {
                    totalAbsorption = totalAbsorption + this.plusXVoidbornSalvoAbsorption;
                    absDescription.push('+' + this.plusXVoidbornSalvoAbsorption +' Invader Abs (Cycle 2 - Event H)');
                }
            }

            if (isApproachStep) {
                this.totalApproachAbsorption = totalAbsorption;
            } else {
                this.totalSalvoAbsorption = totalAbsorption;
            }
        }

        return [isApproachStep ? this.totalApproachAbsorption : this.totalSalvoAbsorption, absDescription.length > 0 ? _.join(absDescription, ", ") : ''];
    }

    damage(isApproachStep, isFirstSalvoStep) {
        let totalDamage = 0;
        let dmgDescription = [];

        // defender approach
        if (!this.isInvader && isApproachStep) {
            totalDamage = totalDamage + this.totalSectorDefense();
            totalDamage = totalDamage + this.totalStarbase();
            totalDamage = totalDamage + this.totalSentryFleetPower();

            if (this.totalSectorDefense() > 0) {
                dmgDescription.push('+' + this.totalSectorDefense() + ' Defender Dmg (Sector Defenses)');
            }

            if (this.totalStarbase() > 0) {
                dmgDescription.push('+' + this.totalStarbase() + ' Defender Dmg (Starbases)');
            }

            if (this.totalSentryFleetPower() > 0) {
                dmgDescription.push('+' + this.totalSentryFleetPower() + ' Defender Dmg (Sentries)');
            }

            if (this.hasImprovedDeepSpaceMissiles()) {
                totalDamage = Math.min(new Number(this.adjacentSectorsWithStarbases) + new Number(this.adjacentSectorsWithShipyards), 2);

                if (totalDamage > 0)
                dmgDescription.push('+' + totalDamage + ' Defender Dmg (Improved Deep Space Missiles)');
            }

            if (this.hasEnergyCellTech() && totalDamage > 0) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Defender Dmg (Energy Cells)');
            }
        }

        // invader approach
        if (this.isInvader && isApproachStep) {
            if (this.hasImprovedDestroyers() && this.totalDestroyerFleetPower() > 0) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Invader Dmg (Improved Destroyers)');
            }

            if (this.hasBasicDeepSpaceMissiles() && this.spendEnergyToUseBasicDeepSpaceMissiles && (this.adjacentSectorsWithShipyards + this.adjacentSectorsWithStarbases > 0)) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Invader Dmg (Deep Space Missiles)');
            }

            if (this.hasImprovedDeepSpaceMissiles()) {
                totalDamage = Math.min(new Number(this.adjacentSectorsWithStarbases) + new Number(this.adjacentSectorsWithShipyards), 2);

                if (totalDamage > 0)
                dmgDescription.push('+' + totalDamage + ' Invader Dmg (Improved Deep Space Missiles)');
            }
        }

        // defender salvo
        if (!this.isInvader && !isApproachStep) {
            totalDamage = 1; // base damage is always 1
            if (this.hasBasicTorpedoes() && this.totalCorvetteFleetPower() > 0 && isFirstSalvoStep) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Defender Dmg (Torpedoes)');
            }

            if (this.hasImprovedTorpedoes() && this.totalCorvetteFleetPower() > 0) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Defender Dmg (Improved Torpedoes)');
            }
        }

        // invader salvo
        if (this.isInvader && !isApproachStep) {
            totalDamage = 1; // base damage is always 1
            if (this.hasBasicTorpedoes() && this.totalCorvetteFleetPower() > 0 && isFirstSalvoStep) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Invader Dmg (Torpedoes)');
            }

            if (this.hasImprovedTorpedoes() && this.totalCorvetteFleetPower() > 0) {
                totalDamage = totalDamage + 1;
                dmgDescription.push('+1 Invader Dmg (Improved Torpedoes)');
            }

            if (isFirstSalvoStep) {
                totalDamage = totalDamage + this.totalDestroyerFleetPower();

                if (this.totalDestroyerFleetPower() > 0) {
                    dmgDescription.push('+' + this.totalDestroyerFleetPower() + ' Invader Dmg (Destroyers)');
                }
            }
        }

        return [totalDamage, dmgDescription.length > 0 ? _.join(dmgDescription, ", ") : ''];
    }

    calculateDamageCombinations(damageToApply) {
        const allDistributions = [];
        const fleetsWithPower = _.filter(this.fleets, function(f) { return f.power > 0 && f.fleetType !== FLEET_TYPE.Sector_Defense && f.fleetType !== FLEET_TYPE.Starbase });

        if (damageToApply > this.totalFleetPower()) {
            damageToApply = this.totalFleetPower();
        } 
        
        // Initialize a queue with a single empty distribution and remaining damage to apply.
        const queue = [{ distribution: [], remainingDamage: damageToApply }];

        while (queue.length > 0) {
            const { distribution, remainingDamage } = queue.shift();

            const nextIndex = distribution.length;

            if (nextIndex === fleetsWithPower.length) {
                // We've made it through all fleets. Check if we've distributed all damage.
                if (remainingDamage === 0) {
                    allDistributions.push([...distribution]);
                }
                continue;
            }

            // We loop through each possible damage value for the current fleet.
            const maxDamageForThisFleet = Math.min(remainingDamage, fleetsWithPower[nextIndex].power);
            for (let damage = 0; damage <= maxDamageForThisFleet; damage++) {
                queue.push({
                    distribution: [...distribution, { fleetType: fleetsWithPower[nextIndex].fleetType, damage }],
                    remainingDamage: remainingDamage - damage,
                });
            }
        }

        // check if we're not dropping Corvettes when we could
        let totalCorvetteFleetPower = this.totalCorvetteFleetPower();
        let totalSentryFleetPower = this.totalSentryFleetPower();
        let hasCorvetteRelatedTech = this.hasCorvetteRelatedTech();
        let canPrioritizeCorvettes = totalCorvetteFleetPower > 0 && !hasCorvetteRelatedTech && totalSentryFleetPower === 0; // can't prioritize Corvettes at all if there are Sentries, even if the player has no Corvette tech

        for (let distribution of allDistributions) {
            let corvetteUsage = _.filter(distribution, function(d) { return d.fleetType === FLEET_TYPE.Corvette });
            let corvetteUsageSum = _.sumBy(corvetteUsage, 'damage');
            let nonCorvetteUsage = _.filter(distribution, function(d) { return d.fleetType === FLEET_TYPE.Carrier || d.fleetType === FLEET_TYPE.Destroyer || d.fleetType === FLEET_TYPE.Dreadnaught || d.fleetType === FLEET_TYPE.Sentry });
            let nonCorvetteUsageSum = _.sumBy(nonCorvetteUsage, 'damage');
            if (canPrioritizeCorvettes && nonCorvetteUsageSum > 0 && corvetteUsageSum < totalCorvetteFleetPower) {
                distribution.misusingCorvettes = true;
            }
        }

        let distributionsToReturn = [];
        let isMisusingCorvettes = _.filter(allDistributions, function(d) { return d.misusingCorvettes });
        let isNotMisusingCorvettes = _.filter(allDistributions, function(d) { return !d.misusingCorvettes });
        if (canPrioritizeCorvettes && isMisusingCorvettes.length === 0) {
            distributionsToReturn = allDistributions;
        }
        else if (canPrioritizeCorvettes && isNotMisusingCorvettes && isNotMisusingCorvettes.length > 0) {
            distributionsToReturn = isNotMisusingCorvettes;
        }
        else {
            distributionsToReturn = allDistributions;
        }

        return distributionsToReturn;              
    }
}

// calculation results classes
const STEP_TYPE = { Approach: 0, Salvo: 1 };
const RESULT_TYPE = { Unknown: 0, Tie: 1, Invader: 2, Defender: 3 };
class Result {
    winner;
    steps = [];
    invader;
    defender;
    fleets;
    sortableId = "";
    constructor(winner, steps, invader, defender, invaderFleet, defenderFleet) {
        this.winner = winner;
        this.steps = steps;
        this.invader = invader;
        this.defender = defender;
        this.fleets = {
            invaderFleet: invaderFleet,
            defenderFleet: defenderFleet
        }

        if (this.winner === RESULT_TYPE.Tie) {
            this.sortableId = this.invader.getSortableId() + "_" + this.defender.getSortableId();
        }
        if (this.winner === RESULT_TYPE.Invader) {
            this.sortableId = this.invader.getSortableId();
        }
        if (this.winner === RESULT_TYPE.Defender) {
            this.sortableId = this.defender.getSortableId();
        }
    }
}

class ResultStep {
    stepType;
    salvoNumber = 1;
    details = [];
    desc;
    invader;
    defender;
    constructor(stepType, salvoNumber, details, desc, invader, defender) {
        this.stepType = stepType;
        this.salvoNumber = salvoNumber;
        this.details = details;
        this.desc = desc;
        this.invader = invader;
        this.defender = defender;
    }
}

class ResultDetail {
    invaderInitiative = 0;
    defenderInitiative = 0;
    invaderDamage = 0;
    defenderDamage = 0;
    invaderAbsorption = 0;
    defenderAbsorption = 0;
    desc;
    constructor(invaderInitiative, defenderInitiative, invaderDamage, defenderDamage, invaderAbsorption, defenderAbsorption, desc) {
        this.invaderInitiative = invaderInitiative;
        this.defenderInitiative = defenderInitiative;
        this.invaderDamage = invaderDamage;
        this.defenderDamage = defenderDamage;
        this.invaderAbsorption = invaderAbsorption;
        this.defenderAbsorption = defenderAbsorption;
        this.desc = desc;
    }
}

// app
createApp({
    data() { return {
        numberOfPlayers: 1,
        pageState: PAGE_STATE.StartScreen,
        players: [
            new Player(1, 'Player 1', [], _.clone(Technologies)),
            new Player(2, 'Player 2', [], _.clone(Technologies)),
            new Player(3, 'Player 3', [], _.clone(Technologies)),
            new Player(4, 'Player 4', [], _.clone(Technologies))
        ],
        scenarioType: SCENARIO_TYPE.Solo,
        chosenScenario: null,
        houses: _.clone(Houses),
        housesWithOrigins: _.clone(HousesWithOrigins),
        technologies: _.clone(Technologies),
        techTableau: [],
        fourFallenHouses: [],
        invaderState: new PlayerState(1, -1, '', true, _.cloneDeep(Fleets), [], false, 0, false, false, 0, 0),
        defenderState: new PlayerState(2, -1, '', false, _.cloneDeep(Fleets), [], false, 0, false, false, 0, 0),
        results: [],
        showResults: false,
        expandAll: true,
        computedUpdater: 1,
        version: "1.68"
    } },
    watch: {
        numberOfPlayers(val) {
            let numberOfPlayers = val;
            let nextPlayerNumber = this.players.length + 1;
    
            while (this.players.length < numberOfPlayers) {
                this.players.push(new Player(nextPlayerNumber, 'Player ' + nextPlayerNumber, [], _.clone(Technologies)));
                nextPlayerNumber = this.players.length + 1;
            }
        }
    },
    mounted: function() {
        this.computedUpdater++;
        if (localStorage.getItem(LOCALSTORAGENAME)) {
            let gameState = JSON.parse(localStorage.getItem(LOCALSTORAGENAME));

            this.pageState = gameState.pageState;
            this.numberOfPlayers = gameState.numberOfPlayers;
 
            for (let i=0; i<gameState.players.length; i++) {
                this.players[i] = new Player(gameState.players[i].id, gameState.players[i].name, gameState.players[i].techs, gameState.players[i].unusedTechs, gameState.players[i].houseWithOrigin);
            }

            if (this.numberOfPlayers < 4) {
                this.players.pop();
            }

            if (this.numberOfPlayers < 3) {
                this.players.pop();
            }

            if (this.numberOfPlayers < 2) {
                this.players.pop();
            }

            this.invaderState = new PlayerState(gameState.invaderState.id, gameState.invaderState.playerid, gameState.invaderState.name, gameState.invaderState.isInvader, gameState.invaderState.fleets, gameState.invaderState.techs, gameState.invaderState.useBombard, gameState.invaderState.bombardAbsorption, gameState.invaderState.spendTradeTokenToUseAutonomousDrones, gameState.invaderState.spendEnergyToUseBasicDeepSpaceMissiles, gameState.invaderState.adjacentSectorsWithShipyards, gameState.invaderState.adjacentSectorsWithStarbases, gameState.invaderState.plusOneVoidbornApproachAbsorption, gameState.invaderState.plusOneVoidbornSalvoAbsorption, gameState.invaderState.plusTwoVoidbornSalvoAbsorption, gameState.invaderState.plusFiveVoidbornInitiative, gameState.invaderState.bombardSalvoAbsorption, gameState.invaderState.plusXVoidbornSalvoAbsorption);

            this.defenderState = new PlayerState(gameState.defenderState.id, gameState.defenderState.playerid, gameState.defenderState.name, gameState.defenderState.isInvader, gameState.defenderState.fleets, gameState.defenderState.techs, gameState.defenderState.useBombard, gameState.defenderState.bombardAbsorption, gameState.defenderState.spendTradeTokenToUseAutonomousDrones, gameState.defenderState.spendEnergyToUseBasicDeepSpaceMissiles, gameState.defenderState.adjacentSectorsWithShipyards, gameState.defenderState.adjacentSectorsWithStarbases, gameState.defenderState.plusOneVoidbornApproachAbsorption, gameState.defenderState.plusOneVoidbornSalvoAbsorption, gameState.defenderState.plusTwoVoidbornSalvoAbsorption, gameState.defenderState.plusFiveVoidbornInitiative, gameState.defenderState.bombardSalvoAbsorption, gameState.defenderState.plusXVoidbornSalvoAbsorption);

            if (gameState.hasOwnProperty("scenarioType")) {
                this.scenarioType = gameState.scenarioType;
            }

            if (gameState.hasOwnProperty("chosenScenario")) {
                this.chosenScenario = gameState.chosenScenario;
            }

            if (gameState.hasOwnProperty("techTableau") && gameState.techTableau) {
                this.techTableau = gameState.techTableau;
            } else {
                this.techTableau = [];
            }

            if (gameState.hasOwnProperty("fourFallenHouses") && gameState.fourFallenHouses) {
                this.fourFallenHouses = gameState.fourFallenHouses;
            } else {
                this.fourFallenHouses = [];
            }

            this.computedUpdater++;
        }
    },
    computed: {
        calculationPlayers: function () {
            return [
                this.invaderState,
                this.defenderState
            ]
        },
        scenariosByTypeAndPlayers: function() {
            let numberOfPlayers = this.numberOfPlayers;
            let scenarioType = this.scenarioType;
            let scenariosByTypeAndPlayers = _.filter(Scenarios, function(s) { return s.numberOfPlayers == numberOfPlayers && s.type == scenarioType });
            return scenariosByTypeAndPlayers;
        }
    },
    methods: {
        setRandomHouses: function() {
            if (this.chosenScenario) {
                let randomHouses = _.cloneDeep(HousesWithOrigins);
                randomHouses = _.shuffle(randomHouses);
                randomHouses = _.uniqWith(randomHouses, function (a,b) {
                    return a.house.id === b.house.id;
                });

                this.players[0].houseWithOrigin = getHouseWithRandomOrigin(randomHouses[0].house.id);

                if (this.numberOfPlayers > 1) {
                    this.players[1].houseWithOrigin = getHouseWithRandomOrigin(randomHouses[1].house.id);
                }

                if (this.numberOfPlayers > 2) {
                    this.players[2].houseWithOrigin = getHouseWithRandomOrigin(randomHouses[2].house.id);
                }

                if (this.numberOfPlayers > 3) {
                    this.players[3].houseWithOrigin = getHouseWithRandomOrigin(randomHouses[3].house.id);
                }
            }

            this.computedUpdater++;
        },
        setRandomRecommendedHouses: function() {
            if (this.chosenScenario) {
                let recommendedHouses = _.cloneDeep(this.chosenScenario.recommendedHouses);
                recommendedHouses = _.shuffle(recommendedHouses);
                let isTutorial = this.chosenScenario.id == 'T' ? true : false;

                this.players[0].houseWithOrigin = getHouseWithRandomOrigin(recommendedHouses[0].id, isTutorial);

                if (this.numberOfPlayers > 1) {
                    this.players[1].houseWithOrigin = getHouseWithRandomOrigin(recommendedHouses[1].id, isTutorial);
                }

                if (this.numberOfPlayers > 2) {
                    this.players[2].houseWithOrigin = getHouseWithRandomOrigin(recommendedHouses[2].id, isTutorial);
                }

                if (this.numberOfPlayers > 3) {
                    this.players[3].houseWithOrigin = getHouseWithRandomOrigin(recommendedHouses[3].id, isTutorial);
                }
            }

            this.computedUpdater++;
        },
        start: function () {
            if (this.players.length === 4) {
                if (this.numberOfPlayers < 4) {
                    this.players.pop();
                }

                if (this.numberOfPlayers < 3) {
                    this.players.pop();
                }

                if (this.numberOfPlayers < 2) {
                    this.players.pop();
                }
            }

            for (let player of this.players) {
                if (!player.name || player.name.trim() == '') {
                    alert("Please enter a name for each player.")
                    return;
                }

                if (this.chosenScenario) {
                    if (!player.houseWithOrigin) {
                        alert("For scenarios, all players must have a chosen house.");
                        return;
                    }
                }
            }

            // setup techs for houses
            for (let i=0; i<this.players.length; i++) {
                if (this.players[i].houseWithOrigin) {
                    let techid = this.players[i].houseWithOrigin.origin.techid;
                    let tech = _.find(this.players[i].unusedTechs, function (t) { return t.id === techid });
                    let unusedTechIndex = _.findIndex(this.players[i].unusedTechs, function (t) { return t.id === techid });

                    if (tech) {
                        this.addTech(i, tech, unusedTechIndex);
                    }
                }
            }

            // setup tech tableau
            if (this.chosenScenario) {

                let allHousesWithoutChosen = _.cloneDeep(Houses);
                let chosenHouses = this.players.map((p) => { return p.houseWithOrigin.house });
                
                for (let house of chosenHouses) {
                    allHousesWithoutChosen = _.remove(allHousesWithoutChosen, function(h) { return h.id !== house.id });
                }

                if (this.chosenScenario.id != 'T' && (this.scenarioType == SCENARIO_TYPE.Solo || this.scenarioType == SCENARIO_TYPE.Cooperative)) {
                    allHousesWithoutChosen = _.shuffle(allHousesWithoutChosen);

                    // draw 4
                    let fourFallenHouses = [];
                    fourFallenHouses.push(allHousesWithoutChosen.shift());
                    fourFallenHouses.push(allHousesWithoutChosen.shift());
                    fourFallenHouses.push(allHousesWithoutChosen.shift());
                    fourFallenHouses.push(allHousesWithoutChosen.shift());

                    let numberOfCrackedGlass = _.filter(fourFallenHouses, function (f) { return f.crackedGlassOnFallenHouse });

                    while (numberOfCrackedGlass < 1 || numberOfCrackedGlass > 3) {
                        if (numberOfCrackedGlass == 0 || numberOfCrackedGlass == 4) {
                            fourFallenHouses.pop();
                            fourFallenHouses.push(allHousesWithoutChosen.shift());
                        }

                        numberOfCrackedGlass = _.filter(fourFallenHouses, function (f) { return f.crackedGlassOnFallenHouse });
                    }

                    for (let fallenHouse of fourFallenHouses) {
                        for (let origin of fallenHouse.origins) {
                            this.techTableau.push(new TableauTech(origin.techid, getTechName(origin.techid), true, true, fallenHouse));
                        }
                    }

                    this.fourFallenHouses = fourFallenHouses;
                }

                if (this.chosenScenario.id == 'T' || this.scenarioType == SCENARIO_TYPE.Competitive) {
                    // setup techs from fallen houses
                    for (let fallenHouse of this.chosenScenario.fallenHouses) {
                        for (let origin of fallenHouse.origins) {
                            this.techTableau.push(new TableauTech(origin.techid, getTechName(origin.techid), true, true, fallenHouse));
                        }
                    }

                    this.fourFallenHouses = this.chosenScenario.fallenHouses;
                }

                // add tech from player houses
                if (this.numberOfPlayers > 2) {
                    for (let player of this.players) {
                        if (player.houseWithOrigin) {
                            this.techTableau.push(new TableauTech(player.houseWithOrigin.origin.techid, getTechName(player.houseWithOrigin.origin.techid), false, true, player.houseWithOrigin.house));
                        }
                    }
                }

                let shuffledTableau = _.shuffle(this.techTableau);

                if (this.scenarioType == SCENARIO_TYPE.Solo || this.scenarioType == SCENARIO_TYPE.Cooperative) {
                    shuffledTableau[0].hasVPCard = false;
                    shuffledTableau[1].hasVPCard = false;

                    if (this.scenarioType == SCENARIO_TYPE.Solo) {
                        shuffledTableau[2].hasVPCard = false;
                        shuffledTableau[3].hasNonVPCard = false;
                        shuffledTableau[4].hasNonVPCard = false;
                        shuffledTableau[5].hasNonVPCard = false;
                        shuffledTableau[6].hasNonVPCard = false;
                        shuffledTableau[7].hasNonVPCard = false;
                    }
                }

                this.techTableau = _.orderBy(shuffledTableau, 'fallenHouseName', 'name');

                // for scenarios, remove 'unused tech' from players that aren't in the tableau
                for (let i=0; i<this.players.length; i++) {
                    let allTechs = _.clone(Technologies);
                    for (let tech of allTechs) {
                        let inTableauIndex = _.findIndex(this.techTableau, function(t) { 
                            return t.tech === tech.id;
                        });

                        if (inTableauIndex == -1) {
                            _.remove(this.players[i].unusedTechs, function(t) {
                                return t.id === tech.id;
                            });
                        }
                    }
                }
            }
            
            this.pageState = PAGE_STATE.Technologies;

            window.scrollTo(0,0);
            this.saveGameState();
        },
        showTech: function (event) {
            this.pageState = PAGE_STATE.Technologies;
            window.scrollTo(0,0);
            event.preventDefault();
            this.saveGameState();
        },
        showCalculator: function (event) {
            this.pageState = PAGE_STATE.Calculator;
            window.scrollTo(0,0);
            event.preventDefault();
            this.saveGameState();
        },
        addTech: function (playerIndex, tech, unusedTechIndex) {
            this.players[playerIndex].techs.push(_.clone(tech));
            this.players[playerIndex].unusedTechs.splice(unusedTechIndex, 1);
            this.players[playerIndex].techs = _.sortBy(this.players[playerIndex].techs, 'name');
            this.saveGameState();
            this.showResults = false;
        },
        playerHasTech: function (index, tech) {
            return !_.find(this.players[index].techs, function(t) { return t.id === tech.id });
        },
        improveTech: function (event, playerIndex, techIndex) {
            this.players[playerIndex].techs[techIndex].isImproved = true;
            event.preventDefault();
            this.saveGameState();
            this.showResults = false;
        },
        demoteTech: function (event, playerIndex, techIndex) {
            this.players[playerIndex].techs[techIndex].isImproved = false;
            event.preventDefault();
            this.saveGameState();
            this.showResults = false;
        },
        removeTech: function (event, playerIndex, techIndex) {
            this.players[playerIndex].techs[techIndex].isImproved = false;
            this.players[playerIndex].unusedTechs.push(_.clone(this.players[playerIndex].techs[techIndex]));
            this.players[playerIndex].techs.splice(techIndex, 1);
            event.preventDefault();
            this.players[playerIndex].unusedTechs = _.sortBy(this.players[playerIndex].unusedTechs, 'name');
            this.saveGameState();
            this.showResults = false;
        },
        showFleet: function(calcPlayerIndex, playerFleetIndex) {
            let showFleet = true;
            let player = this.getPlayerById(this.calculationPlayers[calcPlayerIndex].playerid);

            // destroyers
            if (player && !_.find(player.techs, function(t) { return t.id === TECHS.Destroyers }) && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Destroyer) {
                showFleet = false;
            }

            // dreadnaughts
            if (player && !_.find(player.techs, function(t) { return t.id === TECHS.Dreadnaughts }) && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Dreadnaught) {
                showFleet = false;
            }

            // carriers
            if (player && !_.find(player.techs, function(t) { return t.id === TECHS.Carriers }) && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Carrier) {
                showFleet = false;
            }

            // sentries
            if (player && !_.find(player.techs, function(t) { return t.id === TECHS.Sentries }) && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Sentry) {
                showFleet = false;
            }

            // starbases
            if (player && !_.find(player.techs, function(t) { return t.id === TECHS.Starbases }) && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Starbase) {
                showFleet = false;
            }

            // voidborn
            if (this.calculationPlayers[calcPlayerIndex].playerid != 1000 && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Voidborn) {
                showFleet = false;
            }

            if (this.calculationPlayers[calcPlayerIndex].playerid == 1000 && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType !== FLEET_TYPE.Voidborn && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType !== FLEET_TYPE.Sector_Defense) {
                showFleet = false;
            }

            if (this.calculationPlayers[calcPlayerIndex].isInvader && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].fleetType === FLEET_TYPE.Sector_Defense) {
                showFleet = false;
            }

            // reset power to zero if tech is gone
            if (!showFleet) { this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].power = 0; }

            return showFleet;
        },
        updatePlayerFleet: function(event, calcPlayerIndex, playerFleetIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].power === 0) { return };

            this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].power = this.calculationPlayers[calcPlayerIndex].fleets[playerFleetIndex].power + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updateExpandAll: function(event, val) {
            this.expandAll = val;
            event.preventDefault();
            this.computedUpdater++;
        },
        expandCollapseCombat: function(event, combat) {
            combat.showCombat = !combat.showCombat;
            event.preventDefault();
            this.computedUpdater++;
        },
        shareCalc: function(event) {
            let calc = '';

            // players
            for (let calcPlayer of this.calculationPlayers) {
                calc += calcPlayer.isInvader ? "INVADER" : "DEFENDER";
                calc += "\n";

                if (calcPlayer.playerid != 1000) {
                    const player = this.getPlayerById(calcPlayer.playerid);

                    if (player.techs && player.techs.length > 0) {
                        calc += 'Tech: ';
                        let technames = _.map(player.techs, function (t) { 
                            return t.name + (t.isImproved ? ' (Improved)' : '');
                        });

                        calc += _.join(technames, ', ') + '\n';
                    }
                }

                if (calcPlayer.fleets && calcPlayer.fleets.length > 0) {
                    let fleetsummary = _.map(_.filter(calcPlayer.fleets, function(f) { return f.power > 0 }), function (fleet) { 
                        return fleet.name + ': ' + fleet.power;
                    });
                    calc += '[' + _.join(fleetsummary, ', ') + ']' + '\n';
                }

                if (calcPlayer.isInvader && this.playerHasAutonomousDrones(calcPlayer.playerid)) {
                    calc += 'Returned Trade Token (Drones)?: ' + (calcPlayer.spendTradeTokenToUseAutonomousDrones ? 'Yes' : 'No') + '\n';
                }

                if (calcPlayer.useBombard && calcPlayer.isInvader) {
                    calc += 'Bombard Approach Abs (Nervo): ' + calcPlayer.bombardAbsorption + '\n';
                    calc += 'Bombard Salvo Abs (Nervo): ' + calcPlayer.bombardSalvoAbsorption + '\n';
                }

                if (calcPlayer.isInvader && this.playerHasBasicDeepSpaceMissiles(calcPlayer.playerid)) {
                    calc += 'Spent 1 Energy (Deep Space Missiles)?: ' + (calcPlayer.spendEnergyToUseBasicDeepSpaceMissiles ? 'Yes' : 'No') + '\n';
                }

                if ((!calcPlayer.isInvader && this.playerHasImprovedDeepSpaceMissiles(calcPlayer.playerid)) || ((calcPlayer.isInvader && this.playerHasBasicDeepSpaceMissiles(calcPlayer.playerid) && calcPlayer.spendEnergyToUseBasicDeepSpaceMissiles) || (calcPlayer.isInvader && this.playerHasImprovedDeepSpaceMissiles(calcPlayer.playerid)))) {
                    calc += 'Adjacent Sectors w/ Shipyards: ' + calcPlayer.adjacentSectorsWithShipyards + '\n';
                    calc += 'Adjacent Sectors w/ Starbases: ' + calcPlayer.adjacentSectorsWithStarbases + '\n';
                }

                if (calcPlayer.isVoidborn() && calcPlayer.plusFiveVoidbornInitiative) {
                    calc += '+5 Initiative (War card): Yes\n';
                }

                if (calcPlayer.isVoidborn() && calcPlayer.plusOneVoidbornApproachAbsorption) {
                    calc += '+1 Approach Absorption (War card): Yes\n';
                }

                if (calcPlayer.isVoidborn() && calcPlayer.plusOneVoidbornSalvoAbsorption) {
                    calc += '+1 Salvo Absorption (War card - Easy): Yes\n';
                }

                if (calcPlayer.isVoidborn() && calcPlayer.plusTwoVoidbornSalvoAbsorption) {
                    calc += '+2 Salvo Absorption (War card - Normal/Hard): Yes\n';
                }

                if (calcPlayer.isVoidborn() && calcPlayer.plusXVoidbornSalvoAbsorption) {
                    calc += '+' + calcPlayer.plusXVoidbornSalvoAbsorption + ' Salvo Absorption (Cycle 2 - Event H): Yes\n';
                }

                calc += '\n'
            }

            // outcome
            calc += 'OUTCOMES' + '\n';
            if (this.results.invaderWins) {
                calc += '---\n';
                calc += 'Invader Wins' + '\n';

                let winIndex = 1;
                for (let win of this.results.invaderWins) {
                    calc += 'Final Fleet (v' + winIndex + ') [';
                    calc += _.join(_.map(_.filter(win.winnerFleet, function(f) {
                        return (f.power > 0 && f.fleetType < 6);
                    }), function(fleet) { 
                        return (getFleetDesc(fleet.fleetType) + ': ' + fleet.power);
                    }), ', ');

                    calc += ']\n';
                    for (let combat of win.combats) {
                        if (combat.showCombat) {
                            calc += "\nCombat v" + combat.combatVersion + "\n";
                            for (let step of combat.steps) {
                                calc += (step.stepType === 0 ? 'Approach' : 'Salvo ' + step.salvoNumber) + ': ' + step.desc + (step.stepType === 1 ? ' (' + step.details.invaderInitiative + '/' + step.details.defenderInitiative + ')' : '') + ': ' + step.details.desc + '\n';
                            }
                        }
                    }

                    calc += '\n';
                    winIndex++;
                }
            }

            if (this.results.defenderWins) {
                calc += '---\n';
                calc += 'Defender Wins' + '\n';

                let winIndex = 1;
                for (let win of this.results.defenderWins) {
                    calc += 'Final Fleet (v' + winIndex + ') [';
                    calc += _.join(_.map(_.filter(win.winnerFleet, function(f) {
                        return (f.power > 0 && f.fleetType < 6);
                    }), function(fleet) { 
                        return (getFleetDesc(fleet.fleetType) + ': ' + fleet.power);
                    }), ', ');

                    calc += ']\n';
                    for (let combat of win.combats) {
                        if (combat.showCombat) {
                            calc += "\nCombat v" + combat.combatVersion + "\n";
                            for (let step of combat.steps) {
                                calc += (step.stepType === 0 ? 'Approach' : 'Salvo ' + step.salvoNumber) + ': ' + step.desc + (step.stepType === 1 ? ' (' + step.details.invaderInitiative + '/' + step.details.defenderInitiative + ')' : '') + ': ' + step.details.desc + '\n';
                            }
                        }
                    }

                    calc += '\n';
                    winIndex++;
                }
            }

            if (this.results.ties) {
                calc += '---\n';
                calc += 'Ties' + '\n';

                let winIndex = 1;
                for (let win of this.results.ties) {
                    for (let combat of win.combats) {
                        if (combat.showCombat) {
                            calc += "\nCombat v" + combat.combatVersion + "\n";
                            for (let step of combat.steps) {
                                calc += (step.stepType === 0 ? 'Approach' : 'Salvo ' + step.salvoNumber) + ': ' + step.desc + (step.stepType === 1 ? ' (' + step.details.invaderInitiative + '/' + step.details.defenderInitiative + ')' : '') + ': ' + step.details.desc + '\n';
                            }
                        }
                    }

                    calc += '\n';
                    winIndex++;
                }
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(calc);
            } else {
                document.getElementById("copytextarea").value = calc;
                let a, s, e = document.getElementById("copytextarea");
                navigator.userAgent.match(/ipad|iphone/i) ? (a = document.createRange(),
                a.selectNodeContents(e),
                s = window.getSelection(),
                s.removeAllRanges(),
                s.addRange(a),
                e.setSelectionRange(0, 999999)) : e.select(),
                document.execCommand("copy"),
                e.blur();
            }

            event.preventDefault();
            alert('Combat summary copied to clipboard.');
        },
        playerByIdHasTech: function(playerid, techid) {
            if (playerid <= 0 || playerid == 1000) { return false; }
            let player = this.getPlayerById(playerid);
            if (!player) {
                return false;
            }
            return _.find(player.techs, function(t) { return t.id === techid });
        },
        playerHasAutonomousDrones: function(playerid) {
            return this.playerByIdHasTech(playerid, TECHS.AutonomousDrones);
        },
        playerHasBasicDeepSpaceMissiles: function(playerid) {
            const tech = this.playerByIdHasTech(playerid, TECHS.DeepSpaceMissiles);
            if (tech) {
                return !tech.isImproved;
            }
        },
        playerHasImprovedDeepSpaceMissiles: function(playerid) {
            const tech = this.playerByIdHasTech(playerid, TECHS.DeepSpaceMissiles);
            if (tech) {
                return tech.isImproved;
            }
        },
        playerHasStarbases: function(playerid) {
            return this.playerByIdHasTech(playerid, TECHS.Starbases);
        },
        updateBombardApproachAbsorption: function(event, calcPlayerIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].bombardAbsorption === 0) { return };

            this.calculationPlayers[calcPlayerIndex].bombardAbsorption = this.calculationPlayers[calcPlayerIndex].bombardAbsorption + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updateBombardSalvoAbsorption: function(event, calcPlayerIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].bombardSalvoAbsorption === 0) { return };

            this.calculationPlayers[calcPlayerIndex].bombardSalvoAbsorption = this.calculationPlayers[calcPlayerIndex].bombardSalvoAbsorption + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updatePlusXVoidbornSalvoAbsorption: function(event, calcPlayerIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].plusXVoidbornSalvoAbsorption === 0) { return };

            this.calculationPlayers[calcPlayerIndex].plusXVoidbornSalvoAbsorption = this.calculationPlayers[calcPlayerIndex].plusXVoidbornSalvoAbsorption + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updateAdjacentSectorsWithShipyards: function(event, calcPlayerIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithShipyards === 0) { return };

            this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithShipyards = this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithShipyards + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updateAdjacentSectorsWithStarbases: function(event, calcPlayerIndex, increment) {
            if (increment < 0 && this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithStarbases === 0) { return };

            this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithStarbases = this.calculationPlayers[calcPlayerIndex].adjacentSectorsWithStarbases + increment;

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }

            event.preventDefault();
            this.saveGameState();
        },
        updateCheckbox: function() {
            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }
            this.saveGameState();
        },
        numberOfPlayersChanged: function(numberOfPlayersIndex) {
            if (this.numberOfPlayers == 1) {
                this.scenarioType = SCENARIO_TYPE.Solo;
            } else {
                this.scenarioType = null;
            }
            this.chosenScenario = null;
            this.computedUpdater++;
        },
        scenarioTypeChanged: function(scenarioTypeIndex) {
            this.chosenScenario = null;
            this.computedUpdater++;
        },
        chosenScenarioChanged: function(chosenScenarioIndex) {
            if (this.chosenScenario == "None") this.chosenScenario = null;
            this.computedUpdater++;
        },
        calcPlayerChanged: function(calcPlayerChanged) {
            for (let fleet of this.calculationPlayers[calcPlayerChanged].fleets) {
                fleet.power = 0;
            }
            this.calculationPlayers[calcPlayerChanged].spendTradeTokenToUseAutonomousDrones = false;
            this.calculationPlayers[calcPlayerChanged].useBombard = false;
            this.calculationPlayers[calcPlayerChanged].bombardAbsorption = 0;
            this.calculationPlayers[calcPlayerChanged].bombardSalvoAbsorption = 0;
            this.calculationPlayers[calcPlayerChanged].spendEnergyToUseBasicDeepSpaceMissiles = false;
            this.calculationPlayers[calcPlayerChanged].adjacentSectorsWithShipyards = 0;
            this.calculationPlayers[calcPlayerChanged].adjacentSectorsWithStarbases = 0;
            this.calculationPlayers[calcPlayerChanged].plusFiveVoidbornInitiative = false;
            this.calculationPlayers[calcPlayerChanged].plusOneVoidbornApproachAbsorption = false;
            this.calculationPlayers[calcPlayerChanged].plusOneVoidbornSalvoAbsorption = false;
            this.calculationPlayers[calcPlayerChanged].plusTwoVoidbornSalvoAbsorption = false;
            this.calculationPlayers[calcPlayerChanged].plusXVoidbornSalvoAbsorption = 0;
            this.showResults = false;

            // copy techs
            let player = this.getPlayerById(this.calculationPlayers[calcPlayerChanged].playerid);
            if (player && player.isHumanPlayer()) {
                this.calculationPlayers[calcPlayerChanged].techs = player.techs;
            }
            this.computedUpdater++;
            this.saveGameState();
        },
        getPlayerById: function (id) {
            return _.find(this.players, function(p) { return p.id === id });
        },
        swap: function() {
            let tempPlayer = _.cloneDeep(this.defenderState);
            this.defenderState =  _.cloneDeep(this.invaderState);
            this.defenderState.isInvader = false;
            this.invaderState = _.cloneDeep(tempPlayer);
            this.invaderState.isInvader = true;
            this.computedUpdater++;
            this.saveGameState();

            if (this.showResults) { // if we're already showing results, re-calculate automatically
                this.calculate();
            }
        },
        isNervo(playerid) {
            let player = this.getPlayerById(playerid);

            if (player) {
                return player.isNervo();
            } else return false;
        },
        getHouseById(houseid) {
            return getHouseById(houseid);
        },
        calculate: function () {
            // calculate possible invader/defender outcomes (Voidfall rulebook, page 35)
            let invader = _.cloneDeep(this.invaderState);
            let defender = _.cloneDeep(this.defenderState);

            if (invader.playerid === defender.playerid) {
                alert("ERROR: The invader and defender must be different players!");
                return;
            }

            if (invader.isHumanPlayer()) {
                let player = this.getPlayerById(invader.playerid);
                invader.techs = _.cloneDeep(player.techs);
                invader.name = player.name;
            } else {
                invader.name = 'Voidborn';
            }

            if (defender.isHumanPlayer()) {
                let player = this.getPlayerById(defender.playerid);
                defender.techs = _.cloneDeep(player.techs);
                defender.name = player.name;
            } else {
                defender.name = 'Voidborn';
            }

            let results = [];
            results = _.flattenDeep(this.runCalc(invader, defender, false, 0, [], results));
            let groupedResults = _.groupBy(results, 'winner');
            //console.log(groupedResults);

            // prepare results
            let preparedResults = {};
            preparedResults.multipleOutcomes = false;
            let totalTypesOfWins = 0;
            
            let ties = groupedResults["1"];
            let groupedTies;
            if (ties) {
                totalTypesOfWins++;
                groupedTies = _.groupBy(_.orderBy(ties, ["sortableId"], ["desc"]), "sortableId");
                let preparedTies = [];
                preparedTies.combats = [];
                Object.entries(groupedTies).forEach(([key, value]) => {
                    let combats = [];
                    for (let i=0;i<value.length;i++) {
                        combats.push({ steps: value[i].steps, combatVersion: i+1, showCombat: i===0 ? true : false });
                    }
                    preparedTies.push({ invaderFleet: value[0].fleets.invaderFleet, defenderFleet: value[0].fleets.defenderFleet, combats: combats });
                });
                preparedResults.ties = preparedTies;
            }

            let invaderWins = groupedResults["2"];
            let groupedInvaderWins;
            if (invaderWins) {
                totalTypesOfWins++;
                groupedInvaderWins = _.groupBy(_.orderBy(invaderWins, ["sortableId"], ["desc"]), "sortableId");
                preparedResults.multipleOutcomes = preparedResults.multipleOutcomes || Object.entries(groupedInvaderWins).length > 1;
                let preparedInvaderWins = [];
                Object.entries(groupedInvaderWins).forEach(([key, value]) => {
                    let combats = [];
                    for (let i=0;i<value.length;i++) {
                        combats.push({ steps: value[i].steps, combatVersion: i+1, showCombat: i===0 ? true : false });
                    }
                    preparedInvaderWins.push({ winnerFleet: value[0].fleets.invaderFleet, combats: combats });
                });
                preparedResults.invaderWins = preparedInvaderWins;
                preparedResults.invaderName = invader.name;
            }

            let defenderWins = groupedResults["3"];
            let groupedDefenderWins;
            if (defenderWins) { 
                totalTypesOfWins++;
                groupedDefenderWins = _.groupBy(_.orderBy(defenderWins, "sortableId", ["sortableId"], ["desc"]), "sortableId");
                preparedResults.multipleOutcomes = preparedResults.multipleOutcomes || Object.entries(groupedDefenderWins).length > 1;
                let preparedDefenderWins = [];
                Object.entries(groupedDefenderWins).forEach(([key, value]) => {
                    let combats = [];
                    for (let i=0;i<value.length;i++) {
                        combats.push({ steps: value[i].steps, combatVersion: i+1, showCombat: i===0 ? true : false });
                    }
                    preparedDefenderWins.push({ winnerFleet: value[0].fleets.defenderFleet, combats: combats });
                });
                preparedResults.defenderWins = preparedDefenderWins;
                preparedResults.defenderName = defender.name;
            }

            preparedResults.multipleOutcomes = preparedResults.multipleOutcomes || totalTypesOfWins > 1;

            this.results = preparedResults;
            this.showResults = true;
            this.saveGameState();
        },
        runCalc: function(invader, defender, hasAbsorptionStepRun = false, salvoNumber, steps = [], results = []) {
            // combat ends when one side has no fleet power
            let invaderFleetPower = invader.totalFleetPower();
            let defenderFleetPower = defender.totalFleetPower();

            // approach
            if (!hasAbsorptionStepRun) {
                
                let defenderAbsorption, absDefDescription;
                [defenderAbsorption, absDefDescription] = defender.absorption(true);
                let invaderDamage, dmgInvDescription;
                [invaderDamage, dmgInvDescription] = invader.damage(true, false);
                let invaderDamageToApply =  Math.max(0, invaderDamage - defenderAbsorption);
                let damageCombinations = defender.calculateDamageCombinations(invaderDamageToApply);
                defender.updateAbsorptionUsed(invaderDamage, true);
                if (invaderDamageToApply < 0) { invaderDamageToApply = 0; }
                let wasDamageFullyAbsorbed = invaderDamageToApply === 0;
                if (wasDamageFullyAbsorbed) { invaderDamageToApply = 1; } // temporary for the loop

                let invaderAbsorption, absInvDescription;
                [invaderAbsorption, absInvDescription] = invader.absorption(true);
                let defenderDamage, dmgDefDescription;
                [defenderDamage, dmgDefDescription] = defender.damage(true, false);
                let defenderDamageToApply =  Math.max(0, defenderDamage - invaderAbsorption);
                let damageCombinations2 = invader.calculateDamageCombinations(defenderDamageToApply);
                invader.updateAbsorptionUsed(defenderDamage, true);
                if (defenderDamageToApply < 0) { defenderDamageToApply = 0; }
                let wasDamageFullyAbsorbed2 = defenderDamageToApply === 0;
                if (wasDamageFullyAbsorbed2) { defenderDamageToApply = 1; } // temporary for the loop

                for (let damageCombination of damageCombinations) {
                    let resultDesc = '';
                    let absDmgDetails = [];
                    if (absInvDescription != '') absDmgDetails.push(absInvDescription);
                    if (absDefDescription != '') absDmgDetails.push(absDefDescription);
                    if (dmgInvDescription != '') absDmgDetails.push(dmgInvDescription);
                    if (dmgDefDescription != '') absDmgDetails.push(dmgDefDescription);
                    resultDesc += absDmgDetails.length > 0 ? '[' : '';
                    resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                    resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                    for (let dc of damageCombination) {
                        if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} defender ${getFleetDesc(dc.fleetType)} lost. `;
                    }
                    let newSteps = [...steps];
                    if (!wasDamageFullyAbsorbed) {
                        for (let dc of damageCombination) {
                            let fleet = defender.getFleet(dc.fleetType);
                            fleet.power = fleet.power - dc.damage;
                        }
                    }

                    let tempResultDesc = resultDesc;
                    for (let damageCombination2 of damageCombinations2) {
                        resultDesc = tempResultDesc;
                        for (let dc of damageCombination2) {
                            if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} invader ${getFleetDesc(dc.fleetType)} lost. `;
                        }
                        let newSteps2 = [...newSteps];
                        if (!wasDamageFullyAbsorbed2) {
                            for (let dc of damageCombination2) {
                                let fleet = invader.getFleet(dc.fleetType);
                                fleet.power = fleet.power - dc.damage;
                            }
                        }

                        let resultDetail = null;

                        if (wasDamageFullyAbsorbed || wasDamageFullyAbsorbed2) {
                            let zeroDamageDesc = '';

                            if (wasDamageFullyAbsorbed && invaderDamage > 0) {
                                zeroDamageDesc += `${invaderDamage} Invader dmg fully absorbed by Defender. `
                            }
                            if (wasDamageFullyAbsorbed2 && defenderDamage > 0) {
                                zeroDamageDesc += `${defenderDamage} Defender dmg fully absorbed by Invader. `
                            }
                            if (invaderDamage == 0) {
                                zeroDamageDesc += `Invader has no approach dmg capability. `;
                            }
                            if (defenderDamage == 0) {
                                zeroDamageDesc += `Defender has no approach dmg capability. `;
                            }
                            resultDetail = new ResultDetail(-1, -1, invaderDamage, defenderDamage, invaderAbsorption, defenderAbsorption, `${resultDesc}${zeroDamageDesc} `);
                        }
                        else {

                            resultDetail = new ResultDetail(-1, -1, invaderDamage, defenderDamage, invaderAbsorption, defenderAbsorption, resultDesc);

                        }

                        newSteps2.push(new ResultStep(STEP_TYPE.Approach, salvoNumber, resultDetail, "Invader and Defender hit simultaneously", _.cloneDeep(invader), _.cloneDeep(defender)));

                        if (invader.totalFleetPower() === 0 && defender.totalFleetPower() === 0) {
                            let result = new Result(RESULT_TYPE.Tie, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                            results.push(result);
                        }
            
                        if (invader.totalFleetPower() === 0 && defender.totalFleetPower() > 0) {
                            let result = new Result(RESULT_TYPE.Defender, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                            results.push(result);
                        }
            
                        if (invader.totalFleetPower() > 0 && defender.totalFleetPower() === 0) {
                            let result = new Result(RESULT_TYPE.Invader, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                            results.push(result);
                        }

                        if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                            results.push(this.runCalc(_.cloneDeep(invader), _.cloneDeep(defender), true, salvoNumber, [...newSteps2]));
                        }

                        if (!wasDamageFullyAbsorbed2) {
                            for (let dc of damageCombination2) {
                                let fleet = invader.getFleet(dc.fleetType);
                                fleet.power = fleet.power + dc.damage;
                            }
                        }
                    }

                    if (!wasDamageFullyAbsorbed) {
                        for (let dc of damageCombination) {
                            let fleet = defender.getFleet(dc.fleetType);
                            fleet.power = fleet.power + dc.damage;
                        }
                    }
                }
                return [...results];
            }

            // salvos
            if (hasAbsorptionStepRun) {
                let initiative = this.calculateInitiative(invader, defender);
                salvoNumber = salvoNumber + 1;

                if (initiative.invaderInitiative > initiative.defenderInitiative) {
                    let defenderAbsorption, absDefDescription;
                    [defenderAbsorption, absDefDescription] = defender.absorption(false);
                    let invaderDamage, dmgInvDescription;
                    [invaderDamage, dmgInvDescription] = invader.damage(false, salvoNumber === 1);
                    let invaderDamageToApply = Math.max(0, invaderDamage - defenderAbsorption);
                    let damageCombinations = defender.calculateDamageCombinations(invaderDamageToApply);
                    defender.updateAbsorptionUsed(invaderDamage, false);
                    if (invaderDamageToApply < 0) { invaderDamageToApply = 0; }
                    let wasDamageFullyAbsorbed = invaderDamageToApply === 0;
                    if (wasDamageFullyAbsorbed) { invaderDamageToApply = 1; } // temporary for the loop
                    
                    for (let damageCombination of damageCombinations) {
                        let newSteps = [...steps];
                        let resultDesc = '';
                        let tempInvaderTotalSalvoAbsorption;
                        let absDmgDetails = [];
                        if (absDefDescription != '') absDmgDetails.push(absDefDescription);
                        if (dmgInvDescription != '') absDmgDetails.push(dmgInvDescription);
                        resultDesc += absDmgDetails.length > 0 ? '[' : '';
                        resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                        resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                        for (let dc of damageCombination) {
                            if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} defender ${getFleetDesc(dc.fleetType)} lost. `;
                        }
                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = defender.getFleet(dc.fleetType);
                                fleet.power = fleet.power - dc.damage;
                            }

                            let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, 0, 0, defenderAbsorption, resultDesc);

                            newSteps.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Invader hits first", _.cloneDeep(invader), _.cloneDeep(defender)));

                            // when one goes first, check after each half of the salvo
                            if (invader.totalFleetPower() === 0 && defender.totalFleetPower() === 0) {
                                let result = new Result(RESULT_TYPE.Tie, newSteps, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                
                            if (invader.totalFleetPower() > 0 && defender.totalFleetPower() === 0) {
                                let result = new Result(RESULT_TYPE.Invader, newSteps, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                        } else {
                            let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, 0, 0, defenderAbsorption, `${resultDesc}Defender absorbed all damage. `);

                            newSteps.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Invader hits first", _.cloneDeep(invader), _.cloneDeep(defender)));
                        }

                        let invaderAbsorption, absInvDescription;
                        [invaderAbsorption, absInvDescription] = invader.absorption(false);
                        let defenderDamage, dmgDefDescription;
                        [defenderDamage, dmgDefDescription] = defender.damage(false, salvoNumber === 1);
                        let defenderDamageToApply =  Math.max(0, defenderDamage - invaderAbsorption);
                        let damageCombinations = invader.calculateDamageCombinations(defenderDamageToApply);
                        tempInvaderTotalSalvoAbsorption = invader.totalSalvoAbsorption;
                        invader.updateAbsorptionUsed(defenderDamage, false);
                        if (defenderDamageToApply < 0) { defenderDamageToApply = 0; }
                        let wasDamageFullyAbsorbed2 = defenderDamageToApply === 0;
                        if (wasDamageFullyAbsorbed2) { defenderDamageToApply = 1; } // temporary for the loop
                        if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                            for (let damageCombination of damageCombinations) {
                                let resultDesc = '';
                                let absDmgDetails = [];
                                if (absInvDescription != '') absDmgDetails.push(absInvDescription);
                                if (dmgDefDescription != '') absDmgDetails.push(dmgDefDescription);
                                resultDesc += absDmgDetails.length > 0 ? '[' : '';
                                resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                                resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                                for (let dc of damageCombination) {
                                    if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} invader ${getFleetDesc(dc.fleetType)} lost. `;
                                }
                                let newSteps2 = [...newSteps];
                                if (!wasDamageFullyAbsorbed2) {
                                    for (let dc of damageCombination) {
                                        let fleet = invader.getFleet(dc.fleetType);
                                        fleet.power = fleet.power - dc.damage;
                                    }

                                    let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, 0, defenderDamage, invaderAbsorption, 0, resultDesc);

                                    newSteps2.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Defender hits second", _.cloneDeep(invader), _.cloneDeep(defender)));

                                    // when one goes first, check after each half of the salvo
                                    if (invader.totalFleetPower() === 0 && defenderFleetPower === 0) {
                                        let result = new Result(RESULT_TYPE.Tie, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                        results.push(result);
                                    }
                        
                                    if (invader.totalFleetPower() === 0 && defender.totalFleetPower() > 0) {
                                        let result = new Result(RESULT_TYPE.Defender, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                        results.push(result);
                                    }
                                } else {
                                    let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, 0, defenderDamage, invaderAbsorption, 0, `${resultDesc}Invader absorbed all damage. `);

                                    newSteps2.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Defender hits second", _.cloneDeep(invader), _.cloneDeep(defender)));
                                }

                                if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                                    results.push(this.runCalc(_.cloneDeep(invader), _.cloneDeep(defender), hasAbsorptionStepRun, salvoNumber, [...newSteps2]));
                                }

                                if (!wasDamageFullyAbsorbed2) {
                                    for (let dc of damageCombination) {
                                        let fleet = invader.getFleet(dc.fleetType);
                                        fleet.power = fleet.power + dc.damage;
                                    }
                                }
                            }
                        }

                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = defender.getFleet(dc.fleetType);
                                fleet.power = fleet.power + dc.damage;
                            }
                        }
                        invader.totalSalvoAbsorption = tempInvaderTotalSalvoAbsorption;
                        if (salvoNumber === 1) invader.totalSalvoAbsorption = null;
                    }
                    return [...results];
                }

                if (initiative.invaderInitiative < initiative.defenderInitiative) {

                    let invaderAbsorption, absInvDescription;
                    [invaderAbsorption, absInvDescription] = invader.absorption(false);
                    let defenderDamage, dmgDefDescription;
                    [defenderDamage, dmgDefDescription] = defender.damage(false, salvoNumber === 1);
                    let defenderDamageToApply =  Math.max(0, defenderDamage - invaderAbsorption);
                    let damageCombinations = invader.calculateDamageCombinations(defenderDamageToApply);
                    invader.updateAbsorptionUsed(defenderDamage, false);
                    if (defenderDamageToApply < 0) { defenderDamageToApply = 0; }
                    let wasDamageFullyAbsorbed = defenderDamageToApply === 0;
                    if (wasDamageFullyAbsorbed) { defenderDamageToApply = 1; } // temporary for the loop
                    for (let damageCombination of damageCombinations) {
                        let resultDesc = '';
                        let tempDefenderTotalSalvoAbsorption;
                        let absDmgDetails = [];
                        if (absInvDescription != '') absDmgDetails.push(absInvDescription);
                        if (dmgDefDescription != '') absDmgDetails.push(dmgDefDescription);
                        resultDesc += absDmgDetails.length > 0 ? '[' : '';
                        resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                        resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                        for (let dc of damageCombination) {
                            if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} invader ${getFleetDesc(dc.fleetType)} lost. `;
                        }
                        let newSteps = [...steps];

                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = invader.getFleet(dc.fleetType);
                                fleet.power = fleet.power - dc.damage;
                            }

                            let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, 0, defenderDamage, invaderAbsorption, 0, resultDesc);

                            newSteps.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Defender hits first", _.cloneDeep(invader), _.cloneDeep(defender)));

                            if (invader.totalFleetPower() === 0 && defender.totalFleetPower() === 0) {
                                let result = new Result(RESULT_TYPE.Tie, newSteps, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                
                            if (invader.totalFleetPower() === 0 && defender.totalFleetPower() > 0) {
                                let result = new Result(RESULT_TYPE.Defender, newSteps, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                        } else {
                            let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, 0, defenderDamage, invaderAbsorption, 0, `${resultDesc}Invader absorbed all damage. `);

                            newSteps.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Defender hits first", _.cloneDeep(invader), _.cloneDeep(defender)));
                        }

                        let defenderAbsorption, absDefDescription;
                        [defenderAbsorption, absDefDescription] = defender.absorption(false);
                        let invaderDamage, dmgInvDescription;
                        [invaderDamage, dmgInvDescription] = invader.damage(false, salvoNumber === 1);
                        let invaderDamageToApply =  Math.max(0, invaderDamage - defenderAbsorption);
                        let damageCombinations = defender.calculateDamageCombinations(invaderDamageToApply);
                        tempDefenderTotalSalvoAbsorption = defender.totalSalvoAbsorption;
                        defender.updateAbsorptionUsed(invaderDamage, false);
                        let wasDamageFullyAbsorbed2 = invaderDamageToApply === 0;
                        if (wasDamageFullyAbsorbed2) { invaderDamageToApply = 1; } // temporary for the loop
                        if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                            for (let damageCombination of damageCombinations) {
                                let resultDesc = '';
                                let absDmgDetails = [];
                                if (absDefDescription != '') absDmgDetails.push(absDefDescription);
                                if (dmgInvDescription != '') absDmgDetails.push(dmgInvDescription);
                                resultDesc += absDmgDetails.length > 0 ? '[' : '';
                                resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                                resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                                for (let dc of damageCombination) {
                                    if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} defender ${getFleetDesc(dc.fleetType)} lost. `;
                                }
                                let newSteps2 = [...newSteps];
                                if (!wasDamageFullyAbsorbed2) {
                                    for (let dc of damageCombination) {
                                        let fleet = defender.getFleet(dc.fleetType);
                                        fleet.power = fleet.power - dc.damage;
                                    }

                                    let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, 0, 0, defenderAbsorption, resultDesc);

                                    newSteps2.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Invader hits second", _.cloneDeep(invader), _.cloneDeep(defender)));

                                    // when one goes first, check after each half of the salvo
                                    if (invader.totalFleetPower() === 0 && defender.totalFleetPower() === 0) {
                                        let result = new Result(RESULT_TYPE.Tie, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                        results.push(result);
                                    }
                        
                                    if (invader.totalFleetPower() > 0 && defender.totalFleetPower() === 0) {
                                        let result = new Result(RESULT_TYPE.Invader, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                        results.push(result);
                                    }
                                } else {
                                    let resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, 0, 0, defenderAbsorption, `${resultDesc}Defender absorbed all damage. `);

                                    newSteps2.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Invader hits second", _.cloneDeep(invader), _.cloneDeep(defender)));
                                }

                                if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                                    results.push(this.runCalc(_.cloneDeep(invader), _.cloneDeep(defender), hasAbsorptionStepRun, salvoNumber, [...newSteps2]));
                                }

                                if (!wasDamageFullyAbsorbed2) {
                                    for (let dc of damageCombination) {
                                        let fleet = defender.getFleet(dc.fleetType);
                                        fleet.power = fleet.power + dc.damage;
                                    }
                                }
                            }
                        }

                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = invader.getFleet(dc.fleetType);
                                fleet.power = fleet.power + dc.damage;
                            }
                        }
                        defender.totalSalvoAbsorption = tempDefenderTotalSalvoAbsorption;
                        if (salvoNumber === 1) defender.totalSalvoAbsorption = null;
                    }
                    return [...results];
                }

                if (initiative.invaderInitiative === initiative.defenderInitiative) {

                    let defenderAbsorption, absDefDescription;
                    [defenderAbsorption, absDefDescription] = defender.absorption(false);
                    let invaderDamage, dmgInvDescription;
                    [invaderDamage, dmgInvDescription] = invader.damage(false, salvoNumber === 1);
                    let invaderDamageToApply =  Math.max(0, invaderDamage - defenderAbsorption);
                    let damageCombinations = defender.calculateDamageCombinations(invaderDamageToApply);
                    defender.updateAbsorptionUsed(invaderDamage, false);
                    if (invaderDamageToApply < 0) { invaderDamageToApply = 0; }
                    let wasDamageFullyAbsorbed = invaderDamageToApply === 0;
                    if (wasDamageFullyAbsorbed) { invaderDamageToApply = 1; } // temporary for the loop

                    let invaderAbsorption, absInvDescription;
                    [invaderAbsorption, absInvDescription] = invader.absorption(false);
                    let defenderDamage, dmgDefDescription;
                    [defenderDamage, dmgDefDescription] = defender.damage(false, salvoNumber === 1);
                    let defenderDamageToApply =  Math.max(0, defenderDamage - invaderAbsorption);
                    let damageCombinations2 = invader.calculateDamageCombinations(defenderDamageToApply);
                    invader.updateAbsorptionUsed(defenderDamage, false);
                    if (defenderDamageToApply < 0) { defenderDamageToApply = 0; }
                    let wasDamageFullyAbsorbed2 = defenderDamageToApply === 0;
                    if (wasDamageFullyAbsorbed2) { defenderDamageToApply = 1; } // temporary for the loop

                    for (let damageCombination of damageCombinations) {
                        let resultDesc = '';
                        let absDmgDetails = [];
                        if (absInvDescription != '') absDmgDetails.push(absInvDescription);
                        if (absDefDescription != '') absDmgDetails.push(absDefDescription);
                        if (dmgInvDescription != '') absDmgDetails.push(dmgInvDescription);
                        if (dmgDefDescription != '') absDmgDetails.push(dmgDefDescription);
                        resultDesc += absDmgDetails.length > 0 ? '[' : '';
                        resultDesc = resultDesc + _.join(absDmgDetails, ", ");
                        resultDesc += absDmgDetails.length > 0 ?  '] --- ' : '';
                        for (let dc of damageCombination) {
                            if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} defender ${getFleetDesc(dc.fleetType)} lost. `;
                        }
                        let newSteps = [...steps];
                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = defender.getFleet(dc.fleetType);
                                fleet.power = fleet.power - dc.damage;
                            }
                        }

                        let tempResultDesc = resultDesc;
                        for (let damageCombination2 of damageCombinations2) {
                            resultDesc = tempResultDesc;
                            for (let dc of damageCombination2) {
                                if (dc.damage > 0) resultDesc = resultDesc + `${dc.damage} invader ${getFleetDesc(dc.fleetType)} lost. `;
                            }
                            let newSteps2 = [...newSteps];
                            if (!wasDamageFullyAbsorbed2) {
                                for (let dc of damageCombination2) {
                                    let fleet = invader.getFleet(dc.fleetType);
                                    fleet.power = fleet.power - dc.damage;
                                }
                            }

                            let resultDetail = null;

                            if (wasDamageFullyAbsorbed || wasDamageFullyAbsorbed2) {
                                let zeroDamageDesc = '';

                                if (wasDamageFullyAbsorbed && invaderDamage > 0) {
                                    zeroDamageDesc += `${invaderDamage} Invader dmg fully absorbed by Defender. `
                                }
                                if (wasDamageFullyAbsorbed2 && defenderDamage > 0) {
                                    zeroDamageDesc += `${defenderDamage} Defender dmg fully absorbed by Invader.`
                                }
                                resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, defenderDamage, invaderAbsorption, defenderAbsorption, `${resultDesc}${zeroDamageDesc}`);
                            }
                            else {

                                resultDetail = new ResultDetail(initiative.invaderInitiative, initiative.defenderInitiative, invaderDamage, defenderDamage, invaderAbsorption, defenderAbsorption, resultDesc);

                            }

                            newSteps2.push(new ResultStep(STEP_TYPE.Salvo, salvoNumber, resultDetail, "Invader and Defender hit simultaneously", _.cloneDeep(invader), _.cloneDeep(defender)));

                            if (invader.totalFleetPower() === 0 && defender.totalFleetPower() === 0) {
                                let result = new Result(RESULT_TYPE.Tie, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                
                            if (invader.totalFleetPower() === 0 && defender.totalFleetPower() > 0) {
                                let result = new Result(RESULT_TYPE.Defender, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }
                
                            if (invader.totalFleetPower() > 0 && defender.totalFleetPower() === 0) {
                                let result = new Result(RESULT_TYPE.Invader, newSteps2, _.cloneDeep(invader), _.cloneDeep(defender), _.cloneDeep(invader.fleets), _.cloneDeep(defender.fleets));
                                results.push(result);
                            }

                            if (invader.totalFleetPower() > 0 && defender.totalFleetPower() > 0) {
                                results.push(this.runCalc(_.cloneDeep(invader), _.cloneDeep(defender), hasAbsorptionStepRun, salvoNumber, [...newSteps2]));
                            }

                            if (!wasDamageFullyAbsorbed2) {
                                for (let dc of damageCombination2) {
                                    let fleet = invader.getFleet(dc.fleetType);
                                    fleet.power = fleet.power + dc.damage;
                                }
                            }
                        }

                        if (!wasDamageFullyAbsorbed) {
                            for (let dc of damageCombination) {
                                let fleet = defender.getFleet(dc.fleetType);
                                fleet.power = fleet.power + dc.damage;
                            }
                        }
                    }
                    return [...results];
                }
            }

            return [...results];
        },
        calculateInitiative: function(invader, defender) {
            const invaderInitiative = invader.initiative();
            const defenderInitiative = defender.initiative();
            return {
                invaderInitiative: invaderInitiative,
                defenderInitiative: defenderInitiative
            }
        },
        getFleetDesc(fleetType) {
            return getFleetDesc(fleetType);
        },
        newgame: function (event) {
            if (confirm('Are you sure you want to clear the app and start a new game?')) {
                this.pageState = PAGE_STATE.StartScreen;
                this.numberOfPlayers = 1;
                this.players = [
                    new Player(1, 'Player 1', [], _.clone(Technologies)),
                    new Player(2, 'Player 2', [], _.clone(Technologies)),
                    new Player(3, 'Player 3', [], _.clone(Technologies)),
                    new Player(4, 'Player 4', [], _.clone(Technologies))
                ];
                this.resetPlayerStates();
                this.results = [];
                this.techTableau = [];
                this.fourFallenHouses = [];
                this.scenarioType = SCENARIO_TYPE.Solo;
                this.chosenScenario = null;
                this.showResults = false;
            }
            
            window.scrollTo(0,0);
            event.preventDefault();
            this.saveGameState();
        },
        resetCalc: function() {
            this.resetPlayerStates();
            this.results = [];
            this.saveGameState();
        },
        resetPlayerStates() {
            this.invaderState = new PlayerState(1, -1, '', true, _.cloneDeep(Fleets), [], false, 0, false, false, 0, 0);
            this.defenderState = new PlayerState(2, -1, '', false, _.cloneDeep(Fleets), [], false, 0, false, false, 0, 0);
            this.saveGameState();
        },
        saveGameState: function() {
            let gameState = {};
            gameState.pageState = this.pageState;
            gameState.numberOfPlayers = this.numberOfPlayers;
            gameState.scenarioType = this.scenarioType;
            gameState.chosenScenario = this.chosenScenario;
            gameState.techTableau = this.techTableau;
            gameState.fourFallenHouses = this.fourFallenHouses;
            gameState.players = this.players;
            gameState.invaderState = this.invaderState;
            gameState.defenderState = this.defenderState;

            localStorage.setItem(LOCALSTORAGENAME, JSON.stringify(gameState));

            this.computedUpdater++;
        }
    }
}).mount("#vf");