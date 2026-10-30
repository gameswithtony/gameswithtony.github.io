const LOCALSTORAGENAME = 'elizagamestate';

const PLAYER_TYPE = { Human: 0, Eliza_AI: 1, Eleanor_AI: 2 };

const PLAYER_COLOR = { Gray: 0, Blue: 1, Red: 2, Yellow: 3 };
const colorMap = {
    0: "gray",
    1: "purple",
    2: "red",
    3: "yellow"
 };

const GAME_STEPS = {
    Setup: 0,
    Round: 1,
    EndOfRound: 2,
    SetupRailEra: 3,
    FinalScore: 4
};

const HUMAN_ACTION = {
    Build: 0,
    Network: 1,
    Sell: 2,
    Develop: 3,
    ScoutOrLoan: 4,
    DoubleNetwork: 5
}
const humanActionStringMap = {
    0: "Build",
    1: "Network",
    2: "Sell",
    3: "Develop",
    4: "Scout Or Loan",
    5: "Double Network"
 };

const AI_ACTION = {
    BuildAndNetwork: 0,
    Sell: 1,
    NetworkCouldntSell: 2,
    Thinking: 3
}
const AIActionStringMap = {
    0: "Build and Network",
    1: "Sell"
};

const ERA = { Canal: 0, Rail: 1 };
const eraStringMap = {
    0: "Canal",
    1: "Rail"
};

const INDUSTRY = { Brewery: 0, Manufacturer: 1, CottonMill: 2, Pottery: 3, CoalMine: 4, IronWorks: 5 };
const industryStringMap = {
    0: "Brewery",
    1: "Manufactured Goods",
    2: "Cotton Mill",
    3: "Pottery",
    4: "Coal Mine",
    5: "Iron Works"
 };

const RESOURCETYPE = { Coal: 0, Iron: 1, Beer: 2 };

const LOCATIONTYPE = { Industries: 0, Merchants: 1 };
const locationTypeMap = {
    0: "Industries",
    1: "Merchants"
};

const BONUSTYPE = { Pounds: 0, VPs: 1, Income: 2, Develop: 3 };
const bonusTypeMap = {
    0: "Pounds",
    1: "VPs",
    2: "Income Levels",
    3: "Develop"
};

const NEEDSCONNECTIONTYPE = { Coal: 0, Merchants: 1, Beer: 2 };
const needsConnectionType = {
    0: "Coal",
    1: "Merchants",
    2: "Beer"
};
const LONGESTCONNECTIONPATHTOSEARCH = 12;

const DIFFICULTY_LEVEL = { Apprentice: 0, Professional: 1, Manager: 2, Titan: 3 };

const CANALERANETWORKCOST = 3;
const RAILERANETWORKCOST = 5;
const RAILERADOUBLENETWORKCOST = 15;

// MERCHANT TILES
function createMerchantTile(id, minPlayers, industryTypes) {
    return {
        id: id,
        minPlayers: minPlayers,
        industryTypes: industryTypes,
        totalBeer: 0,
        isMerchantTile: true
    };
}

const MERCHANT_TILES = [
    createMerchantTile(0, 2, null),
    createMerchantTile(1, 2, null),
    createMerchantTile(2, 2, [INDUSTRY.CottonMill]),
    createMerchantTile(3, 2, [INDUSTRY.Manufacturer]),
    createMerchantTile(4, 2, [INDUSTRY.Manufacturer, INDUSTRY.CottonMill, INDUSTRY.Pottery]),
    createMerchantTile(5, 3, null),
    createMerchantTile(6, 3, [INDUSTRY.Pottery]),
    createMerchantTile(7, 4, [INDUSTRY.Manufacturer]),
    createMerchantTile(8, 4, [INDUSTRY.CottonMill])
];


// GAME BOARD
// ids on industry spots used for reading order
// adjacency listed in clockface order
const INITIAL_BOARD = {
    market: {
        coalInMarket: 13,
        ironInMarket: 8,
        totalPossibleCoal: 14,
        totalPossibleIron: 10
    },
    locations: [
        {
            id: 0,
            type: LOCATIONTYPE.Merchants,
            name: "Warrington",
            bonus: 5,
            bonusType: BONUSTYPE.Pounds,
            spaces: [
                {
                    id: 0,
                    tile: null
                },
                {
                    id: 1,
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 1,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 1,
                    tile: null
                }
            ]
        },
        {
            id: 1,
            type: LOCATIONTYPE.Industries,
            name: "Stoke-On-Trent",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Pottery,
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 0,
                    tile: null
                },
                {
                    toId: 2,
                    tile: null
                },
                {
                    toId: 4,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 0,
                    tile: null
                },
                {
                    toId: 2,
                    tile: null
                },
                {
                    toId: 4,
                    tile: null
                }
            ]
        },
        {
            id: 2,
            type: LOCATIONTYPE.Industries,
            name: "Leek",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 1,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 1,
                    tile: null
                },
                {
                    toId: 3,
                    tile: null
                }
            ]
        },
        {
            id: 3,
            type: LOCATIONTYPE.Industries,
            name: "Belper",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.Pottery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 6,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 2,
                    tile: null
                },
                {
                    toId: 6,
                    tile: null
                }
            ]
        },
        {
            id: 4,
            type: LOCATIONTYPE.Industries,
            name: "Stone",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 1,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 8,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 1,
                    tile: null
                },
                {
                    toId: 5,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 8,
                    tile: null
                }
            ]
        },
        {
            id: 5,
            type: LOCATIONTYPE.Industries,
            name: "Uttoxeter",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
            ],
            edgesRail: [
                {
                    toId: 6,
                    tile: null
                },
                {
                    toId: 4,
                    tile: null
                }
            ]
        },
        {
            id: 6,
            type: LOCATIONTYPE.Industries,
            name: "Derby",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 3,
                    tile: null
                },
                {
                    toId: 7,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 3,
                    tile: null
                },
                {
                    toId: 7,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 5,
                    tile: null
                }
            ]
        },
        {
            id: 7,
            type: LOCATIONTYPE.Merchants,
            name: "Nottingham",
            bonus: 3,
            bonusType: BONUSTYPE.VPs,
            spaces: [
                {
                    id: 0,
                    tile: null
                },
                {
                    id: 1,
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 6,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 6,
                    tile: null
                }
            ]
        },
        {
            id: 8,
            type: LOCATIONTYPE.Industries,
            name: "Stafford",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Pottery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 4,
                    tile: null
                },
                {
                    toId: 11,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 4,
                    tile: null
                },
                {
                    toId: 11,
                    tile: null
                }
            ]
        },
        {
            id: 9,
            type: LOCATIONTYPE.Industries,
            name: "Burton-Upon-Trent",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Brewery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 6,
                    tile: null
                },
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 4,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 6,
                    tile: null
                },
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 11,
                    tile: null
                },
                {
                    toId: 4,
                    tile: null
                }
            ]
        },
        {
            id: 10,
            type: LOCATIONTYPE.Industries,
            name: "Northern Farm Brewery (near Cannock)",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Brewery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 11,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 11,
                    tile: null
                }
            ]
        },
        {
            id: 11,
            type: LOCATIONTYPE.Industries,
            name: "Cannock",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 8,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 10,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 8,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 10,
                    tile: null
                }
            ]
        },
        {
            id: 12,
            type: LOCATIONTYPE.Industries,
            name: "Tamworth",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 17,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 17,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                }
            ]
        },
        {
            id: 13,
            type: LOCATIONTYPE.Merchants,
            name: "Shrewsbury",
            bonus: 4,
            bonusType: BONUSTYPE.VPs,
            spaces: [
                {
                    id: 0,
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 14,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 14,
                    tile: null
                }
            ]
        },
        {
            id: 14,
            type: LOCATIONTYPE.Industries,
            name: "Coalbrookdale",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.IronWorks,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 13,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 13,
                    tile: null
                }
            ]
        },
        {
            id: 15,
            type: LOCATIONTYPE.Industries,
            name: "Wolverhampton",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 11,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                },
                {
                    toId: 14,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 11,
                    tile: null
                },
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                },
                {
                    toId: 14,
                    tile: null
                }
            ]
        },
        {
            id: 16,
            type: LOCATIONTYPE.Industries,
            name: "Walsall",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.IronWorks,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 11,
                    tile: null
                },
                {
                    toId: 9,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 15,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 11,
                    tile: null
                },
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 15,
                    tile: null
                }
            ]
        },
        {
            id: 17,
            type: LOCATIONTYPE.Industries,
            name: "Nuneaton",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.Brewery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 12,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 20,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                }
            ]
        },
        {
            id: 18,
            type: LOCATIONTYPE.Industries,
            name: "Dudley",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 21,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 15,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 21,
                    tile: null
                }
            ]
        },
        {
            id: 19,
            type: LOCATIONTYPE.Industries,
            name: "Birmingham",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                },
                {
                    id: 3,
                    types: [
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 20,
                    tile: null
                },
                {
                    toId: 24,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 16,
                    tile: null
                },
                {
                    toId: 12,
                    tile: null
                },
                {
                    toId: 17,
                    tile: null
                },
                {
                    toId: 20,
                    tile: null
                },
                {
                    toId: 24,
                    tile: null
                },
                {
                    toId: 23,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                }
            ]
        },
        {
            id: 20,
            type: LOCATIONTYPE.Industries,
            name: "Coventry",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Pottery
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 2,
                    types: [
                        INDUSTRY.IronWorks,
                        INDUSTRY.Manufacturer
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 19,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 17,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                }
            ]
        },
        {
            id: 21,
            type: LOCATIONTYPE.Industries,
            name: "Kidderminster",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 14,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                },
                {
                    toId: 22,
                    tile: null,
                    isToSouthernFarm: true
                }
            ],
            edgesRail: [
                {
                    toId: 14,
                    tile: null
                },
                {
                    toId: 18,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                },
                {
                    toId: 22,
                    tile: null,
                    isToSouthernFarm: true
                }
            ]
        },
        {
            id: 22,
            type: LOCATIONTYPE.Industries,
            name: "Southern Farm Brewery (near Kidderminster)",
            isSouthernFarm: true,
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Brewery
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null,
                    isSecondSouthernFarmLink: true
                }
            ],
            edgesRail: [
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null,
                    isSecondSouthernFarmLink: true
                }
            ]
        },
        {
            id: 23,
            type: LOCATIONTYPE.Industries,
            name: "Redditch",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.Manufacturer,
                        INDUSTRY.CoalMine
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.IronWorks
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 24,
                    tile: null
                },
                {
                    toId: 26,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 24,
                    tile: null
                },
                {
                    toId: 26,
                    tile: null
                }
            ]
        },
        {
            id: 24,
            type: LOCATIONTYPE.Merchants,
            name: "Oxford",
            bonus: 2,
            bonusType: BONUSTYPE.Income,
            spaces: [
                {
                    id: 0,
                    tile: null
                },
                {
                    id: 1,
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 23,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 23,
                    tile: null
                }
            ]
        },
        {
            id: 25,
            type: LOCATIONTYPE.Industries,
            name: "Worcester",
            spaces: [
                {
                    id: 0,
                    types: [
                        INDUSTRY.CottonMill
                    ],
                    tile: null
                },
                {
                    id: 1,
                    types: [
                        INDUSTRY.CottonMill
                    ],
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 22,
                    tile: null,
                    isToSouthernFarm: true
                },
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 26,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 22,
                    tile: null,
                    isToSouthernFarm: true
                },
                {
                    toId: 21,
                    tile: null
                },
                {
                    toId: 19,
                    tile: null
                },
                {
                    toId: 26,
                    tile: null
                }
            ]
        },
        {
            id: 26,
            type: LOCATIONTYPE.Merchants,
            name: "Gloucester",
            bonus: 1,
            bonusType: BONUSTYPE.Develop,
            spaces: [
                {
                    id: 0,
                    tile: null
                },
                {
                    id: 1,
                    tile: null
                }
            ],
            edgesCanal: [
                {
                    toId: 23,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                }
            ],
            edgesRail: [
                {
                    toId: 23,
                    tile: null
                },
                {
                    toId: 25,
                    tile: null
                }
            ]
        }
    ]
};


// CARDS
const CARD_TYPES = {
    Location: 0,
    Industry: 1
};

function createCard(id, locationid, industrytype, name, minPlayers, type) {
    return {
        id: id,
        locationid: locationid,
        industrytype: industrytype,
        name: name,
        minPlayers: minPlayers,
        type: type
    };
}

const CARDS = [
    createCard(0, 3, null, 'Belper', 4, CARD_TYPES.Location),
    createCard(1, 6, null, 'Derby', 4, CARD_TYPES.Location),
    createCard(2, 2, null, 'Leek', 3, CARD_TYPES.Location),
    createCard(3, 1, null, 'Stoke-On-Trent', 3, CARD_TYPES.Location),
    createCard(4, 4, null, 'Stone', 3, CARD_TYPES.Location),
    createCard(5, 5, null, 'Uttoxeter', 3, CARD_TYPES.Location),
    createCard(6, 8, null, 'Stafford', 2, CARD_TYPES.Location),
    createCard(7, 9, null, 'Burton-On-Trent', 2, CARD_TYPES.Location),
    createCard(8, 11, null, 'Cannock', 2, CARD_TYPES.Location),
    createCard(9, 12, null, 'Tamworth', 2, CARD_TYPES.Location),
    createCard(10, 16, null, 'Walsall', 2, CARD_TYPES.Location),
    createCard(11, 14, null, 'Coalbrookdale', 2, CARD_TYPES.Location),
    createCard(12, 18, null, 'Dudley', 2, CARD_TYPES.Location),
    createCard(13, 21, null, 'Kidderminster', 2, CARD_TYPES.Location),
    createCard(14, 15, null, 'Wolverhampton', 2, CARD_TYPES.Location),
    createCard(15, 25, null, 'Worcester', 2, CARD_TYPES.Location),
    createCard(16, 19, null, 'Birmingham', 2, CARD_TYPES.Location),
    createCard(17, 20, null, 'Coventry', 2, CARD_TYPES.Location),
    createCard(18, 17, null, 'Nuneaton', 2, CARD_TYPES.Location),
    createCard(19, 23, null, 'Redditch', 2, CARD_TYPES.Location),
    createCard(20, null, INDUSTRY.IronWorks, 'Iron Works', 2, CARD_TYPES.Industry),
    createCard(21, null, INDUSTRY.CoalMine, 'Coal Mine', 2, CARD_TYPES.Industry),
    createCard(22, null, INDUSTRY.Manufacturer, 'Man Goods / Cotton Mill', 2, CARD_TYPES.Industry),
    createCard(23, null, INDUSTRY.Pottery, 'Pottery', 2, CARD_TYPES.Industry),
    createCard(24, null, INDUSTRY.Brewery, 'Brewery', 2, CARD_TYPES.Industry),
];

const AI_DECK_TYPES = { Balanced: 0, MarketDriven: 1 };
function getAIDeck(type, numberOfPlayers) {
    // Balanced
    if (type == AI_DECK_TYPES.Balanced && numberOfPlayers == '2') {
        return [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 24];
    }

    if (type == AI_DECK_TYPES.Balanced && numberOfPlayers == '3') {
        // removes Cannock, Tamworth, and Dudley
        return [3, 4, 5, 6, 7, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    }

    // Market-driven
    if (type == AI_DECK_TYPES.MarketDriven && numberOfPlayers == '2') {
        return [11, 15, 19, 10, 12, 11, 15, 19, 16, 16, 11, 15, 19, 16, 16, 20, 21, 22, 23, 24];
    }

    if (type == AI_DECK_TYPES.MarketDriven && numberOfPlayers == '3') {
        return [3, 4, 19, 6, 8, 3, 11, 16, 3, 15, 16, 16, 15, 19, 20, 21, 22, 23];
    }
}

const TOTAL_ROUNDS_2PLAYER = 10;
const TOTAL_ROUNDS_3PLAYER = 9;
const ROUNDS_LEFT_START_GUARANTEED_SALE = 3;

// INDUSTRY TILES
function createIndustryTile(id, industrytype, canalOnly, level, poundsCost, coalCost, ironCost, beerCost, VPs, LinkVPs, income, availableCoal, availableIron, availableBeer) {
    return {
        id: id,
        industrytype: industrytype,
        canalOnly: canalOnly,
        level: level,
        poundsCost: poundsCost,
        coalCost: coalCost,
        ironCost: ironCost,
        beerCost: beerCost,
        VPs: VPs,
        LinkVPs: LinkVPs,
        income: income,
        availableCoal: availableCoal,
        availableIron: availableIron,
        availableBeer: availableBeer,
        color: null,
        flipped: false,
        tileToString: function () {
            return industryStringMap[this.industrytype] + ' (Level ' + romanize(this.level) + ')';
        }
    };
}

const INDUSTRY_TILES = [
    // coal mines
    createIndustryTile(0, INDUSTRY.CoalMine, true, 1, 5, 0, 0, null, 1, 2, 4, 2, 0, 0),
    createIndustryTile(1, INDUSTRY.CoalMine, false, 2, 7, 0, 0, null, 2, 1, 7, 3, 0, 0),
    createIndustryTile(2, INDUSTRY.CoalMine, false, 2, 7, 0, 0, null, 2, 1, 7, 3, 0, 0),
    createIndustryTile(3, INDUSTRY.CoalMine, false, 3, 8, 0, 1, null, 3, 1, 6, 4, 0, 0),
    createIndustryTile(4, INDUSTRY.CoalMine, false, 3, 8, 0, 1, null, 3, 1, 6, 4, 0, 0),
    createIndustryTile(5, INDUSTRY.CoalMine, false, 4, 10, 0, 1, null, 4, 1, 5, 5, 0, 0),
    createIndustryTile(6, INDUSTRY.CoalMine, false, 4, 10, 0, 1, null, 4, 1, 5, 5, 0, 0),

    // iron works
    createIndustryTile(7, INDUSTRY.IronWorks, true, 1, 5, 1, 0, null, 3, 1, 3, 0, 4, 0),
    createIndustryTile(8, INDUSTRY.IronWorks, false, 2, 7, 1, 0, null, 5, 1, 3, 0, 4, 0),
    createIndustryTile(9, INDUSTRY.IronWorks, false, 3, 9, 1, 0, null, 7, 1, 2, 0, 5, 0),
    createIndustryTile(10, INDUSTRY.IronWorks, false, 4, 12, 1, 0, null, 9, 1, 1, 0, 6, 0),

    // potteries
    createIndustryTile(11, INDUSTRY.Pottery, false, 1, 17, 0, 1, 1, 10, 1, 5, 0, 0, 0),
    createIndustryTile(12, INDUSTRY.Pottery, false, 2, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0),
    createIndustryTile(13, INDUSTRY.Pottery, false, 3, 22, 2, 0, 2, 11, 1, 5, 0, 0, 0),
    createIndustryTile(14, INDUSTRY.Pottery, false, 4, 0, 1, 0, 1, 1, 1, 5, 0, 0, 0),
    createIndustryTile(15, INDUSTRY.Pottery, false, 5, 24, 2, 0, 2, 20, 1, 5, 0, 0, 0),

    // breweries
    createIndustryTile(16, INDUSTRY.Brewery, true, 1, 5, 0, 1, null, 4, 2, 4, 0, 0, 1),
    createIndustryTile(17, INDUSTRY.Brewery, true, 1, 5, 0, 1, null, 4, 2, 4, 0, 0, 1),
    createIndustryTile(18, INDUSTRY.Brewery, false, 2, 7, 0, 1, null, 5, 2, 5, 0, 0, 1),
    createIndustryTile(19, INDUSTRY.Brewery, false, 2, 7, 0, 1, null, 5, 2, 5, 0, 0, 1),
    createIndustryTile(20, INDUSTRY.Brewery, false, 3, 9, 0, 1, null, 7, 2, 5, 0, 0, 1),
    createIndustryTile(21, INDUSTRY.Brewery, false, 3, 9, 0, 1, null, 7, 2, 5, 0, 0, 1),
    createIndustryTile(22, INDUSTRY.Brewery, false, 4, 9, 0, 1, null, 10, 2, 5, 0, 0, 1),

    // cotton mills
    createIndustryTile(23, INDUSTRY.CottonMill, true, 1, 12, 0, 0, 1, 5, 1, 5, 0, 0, 0),
    createIndustryTile(24, INDUSTRY.CottonMill, true, 1, 12, 0, 0, 1, 5, 1, 5, 0, 0, 0),
    createIndustryTile(25, INDUSTRY.CottonMill, true, 1, 12, 0, 0, 1, 5, 1, 5, 0, 0, 0),
    createIndustryTile(26, INDUSTRY.CottonMill, false, 2, 14, 1, 0, 1, 5, 2, 4, 0, 0, 0),
    createIndustryTile(27, INDUSTRY.CottonMill, false, 2, 14, 1, 0, 1, 5, 2, 4, 0, 0, 0),
    createIndustryTile(28, INDUSTRY.CottonMill, false, 3, 16, 1, 1, 1, 9, 1, 3, 0, 0, 0),
    createIndustryTile(29, INDUSTRY.CottonMill, false, 3, 16, 1, 1, 1, 9, 1, 3, 0, 0, 0),
    createIndustryTile(30, INDUSTRY.CottonMill, false, 3, 16, 1, 1, 1, 9, 1, 3, 0, 0, 0),
    createIndustryTile(31, INDUSTRY.CottonMill, false, 4, 18, 1, 1, 1, 12, 1, 2, 0, 0, 0),
    createIndustryTile(32, INDUSTRY.CottonMill, false, 4, 18, 1, 1, 1, 12, 1, 2, 0, 0, 0),
    createIndustryTile(33, INDUSTRY.CottonMill, false, 4, 18, 1, 1, 1, 12, 1, 2, 0, 0, 0),

    // manufactured goods
    createIndustryTile(34, INDUSTRY.Manufacturer, true, 1, 8, 1, 0, 1, 3, 2, 5, 0, 0, 0),
    createIndustryTile(35, INDUSTRY.Manufacturer, false, 2, 10, 0, 1, 1, 5, 1, 1, 0, 0, 0),
    createIndustryTile(36, INDUSTRY.Manufacturer, false, 2, 10, 0, 1, 1, 5, 1, 1, 0, 0, 0),
    createIndustryTile(37, INDUSTRY.Manufacturer, false, 3, 12, 2, 0, 0, 4, 0, 4, 0, 0, 0),
    createIndustryTile(38, INDUSTRY.Manufacturer, false, 4, 8, 0, 1, 1, 3, 1, 6, 0, 0, 0),
    createIndustryTile(39, INDUSTRY.Manufacturer, false, 5, 16, 1, 0, 2, 8, 2, 2, 0, 0, 0),
    createIndustryTile(40, INDUSTRY.Manufacturer, false, 5, 16, 1, 0, 2, 8, 2, 2, 0, 0, 0),
    createIndustryTile(41, INDUSTRY.Manufacturer, false, 6, 20, 0, 0, 1, 7, 1, 6, 0, 0, 0),
    createIndustryTile(42, INDUSTRY.Manufacturer, false, 7, 16, 1, 1, 0, 9, 0, 4, 0, 0, 0),
    createIndustryTile(43, INDUSTRY.Manufacturer, false, 8, 20, 0, 2, 1, 11, 1, 1, 0, 0, 0),
    createIndustryTile(44, INDUSTRY.Manufacturer, false, 8, 20, 0, 2, 1, 11, 1, 1, 0, 0, 0)
];

INDUSTRY_TILES[11].cannotDevelop = true;
INDUSTRY_TILES[13].cannotDevelop = true;

// LINK TILES
function createLinkTile(id) {
    return {
        id: id,
        color: null,
        toId1: null,
        toId2: null
    };
}
const LINK_TILE = createLinkTile(0);