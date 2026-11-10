// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { getTier } from "./tracks.js";
import { controlledBy, fleetCount, getSectorList, guilds, playerCode, playerSectors } from "./sectors.js";
import { state } from "./stores.js";
import { get } from "./runtime.js";
import { is, ol, lo, possArray } from "./utils.js";
import { singleUpkeep, totalUpkeep } from "./resources.js";
import { playerSlottedTrade } from "./actions.js";
import { playerTrade } from "./game.js";
import { house } from "./houses.js";

export let agendaTypes = ['dominance', 'wealth', 'support', 'might'];

export let startingAgendas = [
    {
        id: 'H1-A',
        type: 'starting',
        house: 'Valnis',
        boosts: {
            energy: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector'
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense' // Can be a subobject for minimum/maximum amounts
            },
            {
                influence: 2,
                per: 'sector',
                filter: 'shipyard'
            }
        ]
    },
    {
        id: 'H1-B',
        type: 'starting',
        house: 'Valnis',
        boosts: {
            food: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 5
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 6
                }
            },
            {
                influence: 1,
                per: 'bankers_guild',
            },
            {
                influence: 1,
                per: 'guild'
            }

        ]
    },
    {
        id: 'H3-A',
        type: 'starting',
        house: 'Dunlork',
        boosts: {
            materials: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector'
                
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense' // Can be a subobject for minimum/maximum amounts
            },
            {
                influence: 2,
                per: 'sector',
                filter: 'shipyard'
            }
        ]
    },
    {
        id: 'H3-B',
        type: 'starting',
        house: 'Dunlork',
        boosts: {
            food: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 5
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 6
                }
            },
            {
                influence: 1,
                per: 'bankers_guild'
            },
            {
                influence: 1,
                per: 'guild'
            }

        ]
    },
    {
        id: 'H4-A',
        type: 'starting',
        house: 'Cortozaar',
        boosts: {
            energy: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector'
                
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense' // Can be a subobject for minimum/maximum amounts
            },
            {
                influence: 2,
                per: 'sector',
                filter: 'shipyard'
            }
        ]
    },
    {
        id: 'H4-B',
        type: 'starting',
        house: 'Cortozaar',
        boosts: false,
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 5
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 6
                }
            },
            {
                influence: 1,
                per: 'bankers_guild'
            },
            {
                influence: 1,
                per: 'guild'
            }

        ]
    },
    {
        id: 'H2-A',
        type: 'starting',
        house: 'Belitan',
        boosts: {
            energy: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector'
                
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense' // Can be a subobject for minimum/maximum amounts
            },
            {
                influence: 2,
                per: 'sector',
                filter: 'shipyard'
            }
        ]
    },
    {
        id: 'H2-B',
        type: 'starting',
        house: 'Belitan',
        boosts: {
            food: 1,
            credits: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 5
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 6
                }
            },
            {
                influence: 1,
                per: 'bankers_guild'
            },
            {
                influence: 1,
                per: 'guild'
            }

        ]
    },
    {
        id: 'H12-A',
        type: 'starting',
        house: 'Kradmor',
        boosts: {},
        scoring: [
            {
                influence: 2,
                per: 'upkeep',
            },
            {
                influence: 1,
                per: 'sector',
                filter: {
                    type: 'installations',
                    min: 1
                }
            },
        ]
    },
    {
        id: 'H12-B',
        type: 'starting',
        house: 'Kradmor',
        boosts: {},
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 5
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    type: 'population',
                    num: 6
                }
            },
            {
                influence: [0, 3, 6, 9, 12],
                per: 'economy_track_tier'
            }
        ]
    },
    {
        id: 'H7-A',
        type: 'starting',
        house: 'Shiveus',
        boosts: {},
        scoring: [
            {
                influence: 1,
                per: 'population',
                div: 2
            },
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'shipyard',
                    min: 1
                }
            }
        ]
    },
    {
        id: 'H7-B',
        type: 'starting',
        house: 'Shiveus',
        boosts: {},
        scoring: [
            {
                influence: 2,
                per: 'sector',
            },
            {
                influence: 1,
                per: 'guild',
            }
        ]
    },
    {
        id: 'H10-A',
        type: 'starting',
        house: 'Astoran',
        boosts: {
            materials: 1
        },
        scoring: [
            {
                influence: 4,
                per: 'sector',
                filter: 'shipyard'
            },
            {
                influence: 1,
                per: 'engineers_guild',
            },
            {
                influence: 1,
                per: 'miners_guild',
            },
            {
                influence: -1,
                per: 'corruption',
                filter: 'house_mat'
            }
        ]
    },
    {
        id: 'H10-B',
        type: 'starting',
        house: 'Astoran',
        boosts: {
            food: 1
        },
        scoring: [
            {
                influence: 1,
                per: 'population',
            },
            {
                influence: 2,
                per: 'sector',
                filter: {
                    min: 1,
                    type: 'fleets',
                    specific: 'sentry'
                }
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense'
            },
            {
                influence: -2,
                per: 'corruption',
                filter: 'house_mat'
            }
        ]
    },
    {
        id: 'H5-A',
        type: 'starting',
        house: 'Zenor',
        boosts: {},
        scoring: [
            {
                influence: 1,
                per: 'techs',
                filter: 'basic'
            },
            {
                influence: 3,
                per: 'techs',
                filter: 'improved'
            },
            {
                influence: 3,
                per: 'sector',
            },
        ]
    },
    {
        id: 'H5-B',
        type: 'starting',
        house: 'Zenor',
        boosts: {
            food: 1
        },
        scoring: [
            {
                influence: 2,
                per: 'techs',
                filter: 'basic'
            },
            {
                influence: 4,
                per: 'techs',
                filter: 'improved'
            },
            {
                influence: 1,
                per: 'guild',
            },
        ]
    },
    {
        id: 'H9-A',
        type: 'starting',
        house: 'Nervo',
        boosts: {},
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    max: 0,
                    type: 'empty_guilds'
                }
            },
            {
                influence: 2,
                per: 'sector',
                filter: {
                    min: 3,
                    type: 'installations'
                }
            },
            [{
                influence: [0, 2, 4, 6, 8],
                per: 'society_track_tier',
            },
            {
                influence: [0, 2, 4, 6, 8],
                per: 'statecraft_track_tier',
            },
            {
                influence: [0, 2, 4, 6, 8],
                per: 'economy_track_tier',
            }],
        ]
    },
    {
        id: 'H9-B',
        type: 'starting',
        house: 'Nervo',
        boosts: {
            energy: 1,
            materials: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'resources_store',
                filter: {
                    min: 8
                }
            },
            {
                influence: 5,
                per: 'sector',
                filter: {
                    min: 3,
                    type: 'guilds',
                    restriction: 'different'
                }
            }
        ]
    },
    {
        id: 'H13-A',
        type: 'starting',
        house: 'Marqualos',
        boosts: {
            materials: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector'
            },
            {
                influence: 1,
                per: 'sector',
                filter: 'defense'
            },
            {
                influence: 2,
                per: 'sector',
                filter: 'shipyard'
            }
        ]
    },
    {
        id: 'H13-B',
        type: 'starting',
        house: 'Marqualos',
        boosts: {
            food: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    num: 5,
                    type: 'population'
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    num: 6,
                    type: 'population'
                }
            },
            {
                influence: 1,
                per: 'bankers_guild'
            },
            {
                influence: 1,
                per: 'guild'
            }
        ]
    },
    {
        id: 'H13-A2',
        type: 'extra',
        house: 'Marqualos',
        scoring: [
            {
                influence: 1,
                per: 'bounty',
            },
            {
                influence: 1,
                per: 'fleets',
            }
        ]
    },
    {
        id: 'H13-B2',
        type: 'extra',
        house: 'Marqualos',
        scoring: [
            {
                influence: 1,
                per: 'lowest_store',
            },
            {
                influence: 2,
                per: 'trade',
            }
        ]
    },
    {
        id: 'H8-A',
        type: 'starting',
        house: 'Yarvek',
        boosts: {},
        scoring: [
            {
                influence: 3,
                per: 'sector'
            },
            {
                influence: 1,
                per: 'engineers_guild'
            },
            {
                influence: 1,
                per: 'reclaim'
            },
            {
                influence: 1,
                per: 'bounty',
                div: 2
            },
        ]
    },
    {
        id: 'H8-B',
        type: 'starting',
        house: 'Yarvek',
        boosts: {},
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    min: 2,
                    type: 'fleets'
                }
            },
            {
                influence: 3,
                per: 'sector',
                filter: {
                    min: 4,
                    type: 'population'
                }
            },
            {
                influence: 1,
                per: 'reclaim'
            },
            {
                influence: 1,
                per: 'bounty',
                div: 2
            },
        ]
    },
    {
        id: 'H11-A',
        type: 'starting',
        house: 'Fenrax',
        boosts: {
            credits: 1
        },
        scoring: [
            {
                influence: 2,
                per: 'lowest_store'
            },
            {
                influence: 3,
                per: 'sector',
                filter: {
                    min: 1,
                    type: 'fleets',
                    specific: 'carrier'
                }
            },
            {
                influence: 1,
                per: 'guild'
            }
        ]
    },
    {
        id: 'H11-B',
        type: 'starting',
        house: 'Fenrax',
        boosts: {},
        scoring: [
            {
                influence: 1,
                per: 'total_glory'
            },
            {
                influence: 2,
                per: 'sector',
                filter: ['shipyard', 'starbase']
            },
            {
                influence: 1,
                per: 'fleets',
                div: 3
            }
        ]
    },
    {
        id: 'H14-A',
        type: 'starting',
        house: 'Novaris',
        boosts: {},
        scoring: [
            {
                influence: 4,
                per: 'sector',
                filter: {
                    min: 2,
                    type: 'fleets'
                }
            },
            {
                influence: 3,
                per: 'sector',
                filter: 'shipyard'
            },
            {
                influence: -2,
                per: 'corruption',
                filter: 'house_mat'
            }
        ]
    },
    {
        id: 'H14-B',
        type: 'starting',
        house: 'Novaris',
        boosts: {},
        scoring: [
            {
                influence: 3,
                per: 'sector',
                filter: {
                    min: 4,
                    type: 'population'
                }
            },
            {
                influence: 1,
                per: ['farmers_guild', 'miners_guild', 'engineers_guild']
            },
            {
                influence: -1,
                per: 'corruption',
                filter: 'house_mat'
            }
        ]
    },
    {
        id: 'H6-A',
        type: 'starting',
        house: 'Thegwyn',
        boosts: {},
        scoring: [
            {
                influence: 2,
                per: 'sector',
            },
            {
                influence: 2,
                per: 'farmers_guild'
            }
        ]
    },
    {
        id: 'H6-B',
        type: 'starting',
        house: 'Thegwyn',
        boosts: {
            energy: 1,
            material: 1
        },
        scoring: [
            {
                influence: 3,
                per: 'resources_store',
                filter: {
                    min: 8
                }
            },
            {
                influence: [0, 3, 6, 9, 12],
                per: 'statecraft_track_tier'
            },
            {
                influence: 1,
                per: 'bankers_guild'
            },
            {
                influence: 1,
                per: 'scientists_guild'
            },
        ]
    },
]

// left: Novaris, Thegwyn, 

export let mightAgendas = [
    {
        id: 'M1',
        type: 'might',
        name: 'Mining Consortium',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 8,
                    per: 'materials_yield'
                }
            },
            {
                influence: 5,
                per: 'sector',
                filter: {
                    type: 'fleets',
                    min: 2
                }
            }
        ]
    },
    {
        id: 'M2',
        type: 'might',
        name: 'Aggregated Power Sources',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 8,
                    per: 'energy_yield'
                }
            },
            {
                influence: 2,
                per: 'fleets'
            }
        ]
    },
    {
        id: 'M3',
        type: 'might',
        name: 'Intensive Warfare',
        scoring: [
            {
                influence: 6,
                condition: {
                    min: 3,
                    per: ['shipyard', 'starbase']
                }
            },
            {
                influence: 7,
                per: 'sector',
                filter: {
                    type: 'fleets',
                    min: 3
                }
            }
        ]
    },
    {
        id: 'M4',
        type: 'might',  
        name: 'Central Monetary System',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 4,
                    per: 'credits_yield'
                }
            },
            {
                influence: 2,
                per: 'sector',
                filter: ['shipyard', 'starbase']
            }
        ]
    },
    {
        id: 'M5',
        type: 'might',
        name: 'Safeguard Policy',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 3,
                    per: ['defense', 'starbase']
                }
            },
            {
                influence: 2,
                per: 'fleets'
            }
        ]
    },
    {
        id: 'M6',
        type: 'might',
        name: 'Industrial Nourishments',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 8,
                    per: 'food_yield'
                }
            },
            {
                influence: 2,
                per: ['shipyard', 'starbase']
            }
        ]
    },
    {
        id: 'M7',
        type: 'might',
        name: 'Research Archives',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 8,
                    per: 'science_store'
                }
            },
            {
                influence: 6,
                per: 'sector',
                filter: {
                    min: 3,
                    type: 'installations'
                }
            }
        ]
    },
    {
        id: 'M8',
        type: 'might',
        name: 'Comprehensive Education',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 8,
                    per: 'science_yield'
                }
            },
            {
                influence: 3,
                per: 'sector',
                filter: ['defense', 'starbase']
            }
        ]
    },
]

export let supportAgendas = [
    {
        id: 'S1',
        type: 'support',
        name: 'Salvation Project',
        scoring: [
            {
                influence: 7,
                condition: {
                    per: 'sector',
                    min: 1,
                    num: 'all_pure'
                }
            },
            {
                influence: 4,
                per: 'sector',
                filter: {
                    max: 0,
                    type: 'empty_guilds',
                }
            }
        ]
    },
    {
        id: 'S2',
        type: 'support',
        name: 'Industrial Conglomerate',
        scoring: [
            {
                influence: 6,
                condition: {
                    min: 10,
                    per: 'upkeep'
                }
            },
            {
                influence: 5,
                per: 'sector',
                filter: {
                    min: 3,
                    type: 'guilds',
                    restriction: 'different'
                }
            }
        ]
    },
    {
        id: 'S3',
        type: 'support', 
        name: 'Agricultural Union',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 3,
                    per: 'farmers_guild'
                }
            },
            {
                influence: 4,
                per: 'sector', 
                filter: 'scientists_guild'
            }
        ]
    },
    {
        id: 'S4',
        type: 'support',
        name: 'Hazard Control Institute',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 1,
                    per: 'corrupted_agenda'
                }
            },
            {
                influence: 4,
                per: 'sector',
                filter: {
                    min: 3,
                    type: 'guilds'
                }
            }
        ]
    },
    {
        id: 'S5',
        type: 'support', 
        name: 'Heavy Industry',
        scoring: [
            {
                influence: 6,
                condition: [
                    {
                        min: 2,
                        per: 'engineers_guild'
                    },
                    {
                        min: 2,
                        per: 'miners_guild'
                    }
                ]
            },
            {
                influence: 3,
                per: 'sector',
                filter: 'bankers_guild'
            }
        ]
    },
    {
        id: 'S6',
        type: 'support',
        name: 'Environmental Exploitation',
        scoring: [
            {
                influence: 7,
                condition: {
                    min: 1,
                    per: 'corrupted_track'
                }
            },
            {
                influence: 5,
                per: 'miners_guild',
                div: 2
            }
        ]
    },
    {
        id: 'S7',
        type: 'support',
        name: 'The Wellspring Initiative',
        scoring: [
            {
                influence: 6,
                condition: {
                    max: 1,
                    per: 'corruption'
                }
            },
            {
                influence: 5,
                per: 'farmers_guild',
                div: 2
            }
        ]
    },
    {
        id: 'S8',
        type: 'support', 
        name: 'Optimized Power Supply',
        scoring: [
            {
                influence: 5,
                condition: {
                    max: 6,
                    per: 'upkeep'
                }
            },
            {
                influence: 5,
                per: 'engineers_guild',
                div: 2
            }
        ]
    }
];

export let wealthAgendas = [
    {
        id: 'W1',
        type: 'wealth',
        name: 'Augmented Armada',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 2,
                    per: 'different_fleets'
                }
            },
            {
                influence: 2,
                per: 'reclaim'
            }
        ]
    },
    {
        id: 'W2',
        type: 'wealth',
        name: 'Quantum Leap',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 2,
                    per: 'techs',
                    filter: 'improved'
                }
            },
            {
                influence: 3,
                per: 'bounty',
                div: 2
            }
        ]
    },
    {
        id: 'W3',
        type: 'wealth',
        name: 'Technological Singularity',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 4,
                    per: 'techs'
                }
            },
            {
                influence: 5,
                per: 'sector',
                div: 2
            }
        ]
    },
    {
        id: 'W4',
        type: 'wealth',
        name: 'Trade Monopoly',
        scoring: [
            {
                influence: 3,
                condition: {
                    min: 2,
                    per: 'trade'
                }
            },
            {
                influence: 3,
                per: 'sector',
                filter: {
                    max: 0,
                    type: 'upkeep'
                }
            }
        ]
    },
    {
        id: 'W5',
        type: 'wealth',
        name: 'The Redemption Directive',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 2,
                    per: 'reclaim'
                }
            },
            {
                influence: 1,
                per: 'total_glory'
            }
        ]
    },
    {
        id: 'W6',
        type: 'wealth',
        name: 'Self-Sustaining Campaign',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 3,
                    per: 'glory'
                }
            },
            {
                influence: 4,
                per: 'credits_store',
                div: 3
            }
        ]
    },
    {
        id: 'W7',
        type: 'wealth',
        name: 'Bleeding Edge',
        scoring: [
            {
                influence: 6,
                condition: {
                    min: 1,
                    per: 'glory',
                    filter: 5
                }
            },
            {
                influence: 4,
                per: 'techs',
                filter: 'improved'
            }
        ]
    },
    {
        id: 'W8',
        type: 'wealth',
        name: 'Intellectual Supremacy',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 4,
                    per: 'sector'
                }
            },
            {
                influence: 2,
                per: 'techs', 
                filter: 'basic'
            },
            {
                influence: 3,
                per: 'techs',
                filter: 'improved'
            }
        ]
    }
]

export let dominanceAgendas = [
    {
        id: 'D1',
        type: 'dominance',
        name: 'High Society',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 1,
                    per: 'sector',
                    filter: {
                        type: 'population',
                        num: 6
                    }
                }
                
            },
            {
                influence: [0, 4, 8, 12, 16],
                per: 'society_track_tier'
            }
        ]
    },
    {
        id: 'D2',
        type: 'dominance',
        name: 'Commercial Syndicate',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 4,
                    per: 'sector',
                    filter: {
                        type: 'population',
                        min: 3
                    }
                }
                
            },
            {
                influence: [0, 4, 8, 12, 16],
                per: 'economy_track_tier'
            }
        ]
    },
    {
        id: 'D3',
        type: 'dominance',
        name: 'Federal Authority',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 2,
                    per: 'sector',
                    filter: {
                        type: 'population',
                        min: 5
                    }
                }
                
            },
            {
                influence: [0, 4, 8, 12, 16],
                per: 'statecraft_track_tier'
            }
        ]
    },
    {
        id: 'D4',
        type: 'dominance',
        name: 'Mercantile Governance',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 2,
                    per: 'statecraft_track_tier',
                }
                
            },
            {
                influence: 1,
                per: ['food', 'energy', 'materials'],
                div: 2,
            }
        ]
    },
    {
        id: 'D5',
        type: 'dominance',
        name: 'Sustainable Luxury',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 2,
                    per: 'society_track_tier'
                }
            },
            {
                influence: 5,
                per: 'sector',
                filter: {
                    type: 'upkeep',
                    min: 2
                }
            }
        ]
    },
    {
        id: 'D6',
        type: 'dominance',
        name: 'Progressive Welfare',
        scoring: [
            {
                influence: 5,
                condition: {
                    min: 2,
                    per: 'economy_track_tier'
                }
            },
            {
                influence: 4,
                per: 'sector',
                filter: {
                    type: 'population',
                    min: 4
                }
            }
        ]
    },
    {
        id: 'D7',
        type: 'dominance',
        name: 'Enlightened Nation',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 3,
                    per: 'highest_track_tier'
                }
            },
            {
                influence: 3,
                per: 'sector',
                filter: {
                    type: 'population',
                    min: 3
                }
            }
        ]
    },
    {
        id: 'D8',
        type: 'dominance',
        name: 'Interplanetary Colonization',
        scoring: [
            {
                influence: 4,
                condition: {
                    min: 10,
                    per: 'population'
                }
            },
            [{
                influence: [0, 2, 4, 6, 6],
                per: 'society_track_tier'
            },
            {
                influence: [0, 2, 4, 6, 6],
                per: 'economy_track_tier'
            },
            {
                influence: [0, 2, 4, 6, 6],
                per: 'statecraft_track_tier'
            }],
        ]
    },
    
]

export let agendas = {
    might: mightAgendas,
    wealth: wealthAgendas,
    support: supportAgendas,
    dominance: dominanceAgendas
}

for(let s of startingAgendas){
    s.name = `${s.house} Starting Agenda ${s.id.slice(-1)[0]}`
}

export let allAgendas = [
    ...startingAgendas,
    ...mightAgendas,
    ...wealthAgendas,
    ...supportAgendas,
    ...dominanceAgendas
];

let newAs = [];

for(let a of allAgendas){
    a.ref = a.id;
    if(a.id.split('-').length > 1){
        let [f, b] = a.id.split('-');
        a.id = `${f}${b.toLowerCase()}`;
    }
    a.id = `agendas_${a.type}.${a.id}`;
    newAs.push(ol(a));
}

allAgendas = newAs;


export function testNum(num, thing){
   //console.log('test', num, thing)
    //if(!num) return false;
    //if(num) alert(`test ${thing}, ${typeof thing} ${num.min}, ${num.max}, ${num.num}, ${thing <= num.max}`)
    if(typeof thing != 'number') return false;
    if(typeof num == 'number') return thing == num;
    if(!num) return false;
    if(num.hasOwnProperty('num')) return thing == num.num;
    if(num.hasOwnProperty('min') && thing < num.min) return false;
    if(num.hasOwnProperty('max')) return thing <= num.max;
    return true;
}

let typeKeys = {
    shipyard: 'installations',
    starbase: 'installations',
    defense: 'installations'
} 

export function filterThings(p, list, filter){
    if(Array.isArray(filter)){
        let newList = [];
        for(let f of filter){
            let toAdd = filterThings(p, list, f);
            for(let a of toAdd){
                if(!newList.includes(a)) newList.push(a);
            }
        }
        return newList;
    }
    if(typeof filter == 'string') filter = {
        type: filter,
        min: 1
    }
    if(Object.keys(typeKeys).includes(filter.type)){
        list = list.filter(l => testNum(filter, l[typeKeys[filter.type]].filter(e => e.value == filter.type).length));
    }else if(filter.type == 'upkeep'){
        list = list.filter(l => testNum(filter, singleUpkeep(l)));
    }else if(filter.type == 'fleets'){
        list = list.filter(l => testNum(filter, fleetCount(l, p, filter.specific || false)));
    }else if(filter.type == 'empty_guilds'){
        list = list.filter(l => testNum(filter, l.guild_spaces - l.guilds.length));
    }else if(filter.type == 'population'){
        list = list.filter(l => testNum(filter, l.population))
    }else if(filter.type == 'fem_guild'){
        let fem = ['miners', 'farmers', 'engineers'].map(v => `${v}_guild`);
        list = list.filter(l => testNum(filter, guilds(l).filter(x => fem.includes(x.value)).length));
    }else if(typeof filter.type == 'string' && filter.type.endsWith('_guild')){
        //let g = filter.split('_')[0];
        list = list.filter(l => testNum(filter, guilds(l).filter(x => x.value == filter.type).length));
    }else if(filter.type == 'guilds'){
        if(filter.restriction == 'different'){
            list = list.filter(l => l.hasOwnProperty(filter.type) && testNum(filter, Array.from(new Set(guilds(l).filter(t => t).map(t => t.value))).length));
        }else{
            list = list.filter(l => testNum(filter, guilds(l).length));
        }
    }else{
        
        if(filter.restriction == 'different'){
            list = list.filter(l => l.hasOwnProperty(filter.type) && testNum(filter, Array.from(new Set(l[filter.type].filter(t => t).map(t => t.value))).length));
        }else{
            list = list.filter(l => l.hasOwnProperty(filter.type) && testNum(filter, Array.isArray(l[filter.type]) ? l[filter.type].filter(t => t).length : l[filter.type])); // If we can keep like this it'd be great
            // TODO above  may not always work
        }
        
    }
    return list;
}

export function collateThings(p, per, filter, onlyPure = true){
    let s = {per, filter};
    let list = [];

    let perArray = per;
    if(!Array.isArray(perArray)) perArray = [perArray];

    let sectors = playerSectors(p);
    if(onlyPure) sectors = sectors.filter(s => !s.corrupted);

    for(let per of perArray){
        if(per == 'sector'){
            list = [...list, ...sectors];
        }else if(per == 'guild'){
            list = [...list, ...sectors.flatMap(s => guilds(s))];
        }else if(per == 'installation'){
            list = [...list, ...sectors.flatMap(s => s.installations)];
        }else if(per.endsWith('guild')){
            let type = per.split('_')[0];
            list = [...list, ...sectors.flatMap(s => guilds(s)).filter(g => g.value.startsWith(type))];
        }else if(typeKeys.hasOwnProperty(per)){
            list = [...list, ...sectors.flatMap(s => s[typeKeys[per]]).filter(t => t.value == per)];
        }
    }
    
    //list = Array.from(new Set(...list)); // to avoid duplication

    //console.log('basic list', list)

    if(filter) list = filterThings(p, list, filter);
    //console.log('filtered list', list)

    if(onlyPure) list = list.filter(l => !l.corrupted); // Only pure things count!
    return list;
}
let resourceTypes = ['food', 'energy', 'materials', 'credits', 'science', 'influence']

export function countThings(p, s, onlyPure = true){
    let count = 0;
    let {filter, mult, div} = s;
    let pers = s.per;
    if(s.restriction && (s.restriction == 'pure' || Array.isArray(s.restriction) && s.restriction.includes('pure'))) onlyPure = true;
    if(!Array.isArray(pers)) pers = [pers];
    for(let per of pers){
        if(per == 'track'){
            let tracks = Object.keys(p.tracks);
            if(onlyPure) tracks = tracks.filter(t => !p.tracks[t].corrupted);
            if(filter){
                tracks = tracks.filter(t => testNum(filter, getTier(p, t)));
            }
            count = tracks.length;
        }
        if(per.endsWith('track_tier')){
            let track = per.split('_')[0];
            if(track == 'highest'){
                let max = 0;
                for(let t of Object.keys(p.tracks)){
                    if(onlyPure && p.tracks[t].corrupted) continue;
                    if(getTier(p, t) > max) max = getTier(p, t);
                }
                count = max;
            }else if(track){
                if(onlyPure && p.tracks[track].corrupted){
                    count += 0;
                }else{
                    count += getTier(p, track);
                }
            }else{
                // All tracks
                for(let t of Object.keys(p.tracks)){
                    if(onlyPure && p.tracks[t].corrupted){
                        count += 0;
                    }else{
                        count += getTier(p, t);
                    }
                }
            }
            
        }else if(['yield','level','store'].some(x => per.endsWith(`_${x}`))){
            let [res, key] = per.split('_');
            if(res == 'resources'){
                if(filter){
                    for(let r of Object.keys(p.resources)){
                        if(testNum(filter, p.resources[r][key])) count++;
                    }
                }else{
                    for(let r of Object.keys(p.resources)){
                        count += p.resources[r][key];
                    }
                }
               
            }else if(res == 'lowest'){
                let lowest = Infinity;
                let available = Object.keys(p.resources);
                if(filter) available = available.filter(r => filter.includes(r));
                for(let r of available){
                    if(p.resources[r][key] < lowest) lowest = p.resources[r][key];
                }
                count = lowest;
            }else if(res == 'highest'){
                let highest = 0;
                let available = Object.keys(p.resources);
                if(filter) available = available.filter(r => filter.includes(r));
                for(let r of available){
                    if(p.resources[r][key] > highest) highest = p.resources[r][key];
                }
                count = highest;
            }else{
                count += p.resources[res][key]
            }
            
        }else if(resourceTypes.includes(per)){
            count += p.resources[per].store;
        }else if(per == 'population'){
            let list = collateThings(p, 'sector', filter, onlyPure);
            for(let l of list){
                if(onlyPure && l.corrupted) continue;
                if(l.population) count += l.population;
            }
        }else if(per == 'fleets'){
            if(filter == 'active'){
                count += p.fleets.active.length;
            }else if(filter == 'inactive'){
                count += p.fleets.inactive.length;
            }else{
                let list = collateThings(p, 'sector', filter, onlyPure);
                for(let l of list){
                    if(onlyPure && l.corrupted) continue;
                    let num = fleetCount(l, p);
                    if(num) count += num;
                }
            }
        }else if(per == 'trade'){
            count += playerTrade(p).length;
        }/*else if(per == 'pure_track'){
            count += Object.keys(p.tracks).filter(t => !p.tracks[t].corrupted).length;
        }*/else if(per == 'highest_glory'){
            if(p.glory.length > 0) count += p.glory.sort((a, b) => b.value - a.value)[0].value;
        }else if(per == 'discarded_preferred'){
            let disc_p = p.focus.discard.filter(c => house(p).preferred.includes(lo(c).name))
            //alert(`Discarded preferred cards: ${disc_p.map(c => lo(c).name).join(', ')} (${disc_p.length})`);
            count += disc_p.length;
        }else if(per == 'empty_guilds'){
            let list = collateThings(p, 'sector', filter, onlyPure);
            for(let l of list){
                if(onlyPure && l.corrupted) continue;
                count += l.guild_spaces - l.guilds.length;
            }
        }else if(per == 'different_fleets'){
            let list = collateThings(p, 'sector', filter, onlyPure);
            let differentTypes = [];
            for(let l of list){
                if(onlyPure && l.corrupted) continue;
                if(!l.fleets) continue;
                for(let f of l.fleets){
                    if(f.owner != playerCode(p)) continue;
                    if(!differentTypes.includes(f.type)) differentTypes.push(f.type);
                }
            }
            count += differentTypes.length;
        }else if(per == 'upkeep'){
            let toAdd = 0;
            if(filter == 'satisfied'){
                toAdd = p.satisfied_upkeep;
            }else if(filter == 'sectors'){
                toAdd = playerSectors(p).reduce((a, s) => a + singleUpkeep(s), 0);
            }else{
                toAdd = totalUpkeep(p);
            }
            if(s.restriction == 'all_satisfied'){
                if(p.satisfied_upkeep < totalUpkeep(p)){
                    toAdd = 0;
                }
            }
            count += toAdd;
        }else if(per == 'corrupted_agenda'){
            count += p.agendas.filter(a => a.corrupted).length;
        }else if(per == 'catastrophe'){
            count += get(state).crisis_board.catastrophes.length;
        }else if(per == 'corrupted_track'){
            count += Object.keys(p.tracks).filter(k => p.tracks[k].corrupted).length;
        }else if(per == 'corruption'){
            if(filter == 'house_mat'){
                count += houseMatCorruption(p);
            }else if(filter == 'sectors'){
                count += playerSectors(p).filter(s => s.corrupted).length;
            }else{
                count += totalCorruption(p);
            }
        }else if(per == 'total_glory'){
            count += p.glory.reduce((a,c) => a + c.value, 0);
        }else if(per == 'techs'){
            let list = p.techs;
            if(filter) list = list.filter(l => l.type == filter);
            count += list.length;
        }else if(per == 'agendas'){
            let list = p.agendas.filter(a => a.card && a.card.type != 'starting' && (!onlyPure || !a.corrupted));
            count += list.length;
        }else if(per == 'trade'){
            count += tradeTokens(p).length;
        }else if(p.hasOwnProperty(per)){
            if(Array.isArray(p[per])){
                if(filter){
                    count += p[per].filter(x => x.value == filter).length;
                }else{
                    count += p[per].length;
                }    
            }else{
                count += p[per];
            }
        }else{
            count += collateThings(p, per, filter, onlyPure).length;
        }
    }
    if(mult) count *= mult;
    if(div) count = Math.floor(count / div);
    /*if(s.num == 'all_pure'){
        let possCorrupted = countThings(p, s, false);
        if(count != possCorrupted) count = 0;
    }*/
    return count;
}

export function tradeTokens(p){
    let list = playerSlottedTrade(p);
    list = [...list, ...p.loose_trade];
    return list
}

export function houseMatCorruption(p){
    let sum = 0;
    for(let a of p.agendas){
        if(a.corrupted) sum++;
    }
    for(let k of Object.keys(p.tracks)){
        if(p.tracks[k].corrupted) sum++;
    }
    return sum;
}

export function totalCorruption(p){
    return houseMatCorruption(p) + playerSectors(p).filter(s => s.corrupted).length;
}

export function testCondition(p, condition, onlyPure = true){
    let conds = condition;
    if(!Array.isArray(conds)) conds = [conds];
    let should = true;
    // If it's an array then we must match every part of condition
    for(let c of conds){
        let count = countThings(p, c, onlyPure);
        //if(!testNum(c, count)) should = false;
        if(c.num == 'all_pure'){
            let possCorrupted = countThings(p, c, false);
            if(count != possCorrupted) should = false;
        }else{
            if(!testNum(c, count)) should = false;
        }
    }
    return should;
}

export function score_agenda(p, agenda){
    let score = {
        total: 0,
        elements: []
    }
    if(!agenda) return score;
    for(let sc of agenda.scoring){
        let singleScore = 0;
        for(let s of possArray(sc)){
            if(s.per){
                // Multiplier
                let count = countThings(p, s);
                if(Array.isArray(s.influence)){
                    // Multiple choice
                    if(count >= s.influence.length) count = s.influence.length - 1; //Round down
                    singleScore += s.influence[count];
                }else{
                    singleScore += count * s.influence;
                }
            }else if(s.condition){
                // Conditional = means num of X
                if(testCondition(p, s.condition))  singleScore += s.influence;        
            }
        }
        
        //console.log('cumulative: '+score);
        score.total += singleScore;
        score.elements.push(singleScore);
    }
    return score;
}

export function getAgendas(state, type = false){
    let agendas = [];
    if(type) type = possArray(type);
    for(let k of Object.keys(state.agenda_board)){
        if(type && !type.includes(k)) continue;
        agendas.push(state.agenda_board[k].offer);
    }
    return agendas;
}

export function getAgendasAndBacks(state, type = false){
    let agendas = getAgendas(state, type);
    if(type) type = possArray(type);
    for(let k of Object.keys(state.agenda_board)){
        if(type && !type.includes(k)) continue;
        if(state.agenda_board[k].deck.length == 0) continue;
        agendas.push({type: k, id: `agenda_${k}_back`});
    }
    return agendas;
}

export let agendaActions = {
    dominance: {
        focusMatches: ['Temptation', 'Innovation'],
        action: ['invade']
    },
    might: {
        focusMatches: ['Prosperity', 'Progress'],
        action: {
            either_or: [
                {
                    verb: 'advance_track',
                    lowest: true
                }, 
                'gain_trade'
            ]
        }
    },
    support: {
        focusMatches: ['Conquest', 'Reinforcement'],
        action: ['activate', 'build']
    },
    wealth: {
        focusMatches: ['Development', 'Production'],
        action: [
            {
                verb:  'establish',
                restriction: 'same_resource'
            },
            {
                verb: 'produce',
                restriction: 'same_resource'
            }
        ]
    }
}

export function getMatchingAgendas(p, focus){
    let available = [];
    if(focus.lo) focus = lo(focus);
    for(let a of p.agenda_hand){
        if(a.lo) a = lo(a);
        if(agendaActions[a.type].focusMatches.some(f => focus.name == f || focus.matches == f || focus.matches == 'Leadership')){
            available.push(a);
        }
    }
    return available;
}