// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import * as jsonpatch from './runtime.js';
import { assembleList, lo, moveBitTo, ol, possArray } from './utils.js';
import { getTier } from './tracks.js';
import { ongoingPlayer } from './game.js';
import { controlledBy, playerSectors } from './sectors.js';
import { setProductionLevels } from './resources.js';
import { choose, pause } from './ui.js';
import { house } from './houses.js';
import { state } from './stores.js';
import { get } from './runtime.js'
import { consolidateFleets } from './fleets.js';
import { isPreferred } from './focus.js';

/*

specific_techs: [
            Done: 'Autonomous Drones', 'Deep Space Missiles', 'Dreadnoughts', 'Trade Nexus', 'Neural Matrix', 'Sentries', 'Terraforming'
            'Decontamination Chambers',  
        ]

*/

let techSchemas = [
    {
        // Done
        name: 'Ark Ships',
        house: 'Nervo',
        ref: 18, // use to generate tech_XX and tech_XX+ and tech_XX_extrainfluence
        basic: {
            ability: {
                type: 'extra_guilds',
                num: 2,
            },
            effect: ['increase_population', 'establish']
        },
        improved: {
            ability: {
                type: 'extra_guilds',
                num: 2
            },
            focusBoost: {
                card: 'Reinforcement',
                action: {
                    verb: 'increase_population',
                    place: 'home'
                }
            },
            effect: ['increase_population', 'establish']
        }
    },
    {
        // Done
        name: 'Carriers',
        house: 'Fenrax',
        ref: 21,
        ship: 'carrier',
        basic: {
            ability: {
                type: 'carriers',
                restriction: 1
            },
            effect: ['activate', {
                verb: 'deploy',
                type: 'carrier',
                place: 'home'
            }]
        },
        improved: {
            ability: {
                type: 'carriers',
                restriction: 3
            },
            effect: ['activate', {
                verb: 'deploy',
                type: 'carrier'
            }]
        }
    },
    {
        // Done
        name: 'Autonomous Drones',
        house: 'Marqualos',
        ref: 25,
        basic: {
            ability: ['trade_for_absorption', 'trade_for_skirmish'],
            effect: ['gain_trade','deploy']
        },
        improved: {
            ability: ['trade_for_absorption', 'win_skirmish'],
            effect: ['gain_trade']
        }
    },
    {
        // Done
        name: 'Central Surveillance',
        house: 'Fenrax',
        ref: 22,
        basic: {
            focusBoost: {
                card: 'Politics',
                cost: {
                    population: 1
                },
                action: ['gain_agenda', 'upgrade_glory']
            },
            effect: 'upgrade_glory'
        },
        improved: {
            focusBoost: {
                card: 'Politics',
                cost: {
                    population: 1
                },
                action: ['gain_agenda', 'upgrade_glory']
            },
            effect: {
                cost: {
                    energy: 2
                },
                action: 'gain_agenda'
            }
        }
    },
    {
        // Done
        name: 'Cloning',
        house: 'Zenor',
        ref: 10,
        basic: {
            reactions: {
                after: 'increase_population',
                action: {
                    either_or: [
                        {
                            verb: 'gain_resource',
                            types: {
                                credits: 1
                            }
                        },
                        'activate'
                    ]
                }
            },
            effect: {
                either_or: [
                    {
                        verb: 'gain_resource',
                        types: {
                            credits: 1
                        }
                    },
                    'activate'
                ]
            }
        },
        improved: {
            reactions: {
                after: 'increase_population',
                action: {
                    either_or: [
                        {
                            verb: 'gain_resource',
                            types: {
                                credits: 1
                            }
                        },
                        'activate'
                    ]
                }
            },
            ongoing: 'free_tier_increase',
            effect: [
                {
                    verb: 'advance_track',
                    lowest: true
                },
                {
                    verb: 'advance_track',
                    lowest: true
                }
            ]
        }
    },
    {
        // Done
        name: 'Cybernetics',
        house: 'Novaris',
        ref: 28,
        basic: {
            reactions: {
                after: {
                    verb: 'establish',
                    playerSector: true
                },
                action: {
                    verb: 'gain_resource',
                    num: 2,
                    restriction: 'matching_resource'
                }
            },
            effect: 'establish'
        },
        improved: {
            reactions: {
                after: {
                    verb: 'establish',
                    playerSector: true
                },
                action: {
                    verb: 'gain_resource',
                    num: 2,
                    restriction: 'matching_resource'
                }
            },
            // Other reaction handled as custom in verb for simplicity
            effect: {
                either_or: ['establish', 'increase_population']
            }
        }
    },
    {
        // Done
        name: 'Combat Replicators',
        house: 'Novaris',
        ref: 27,
        basic: {
            reactions: {
                after: {
                    verb: 'invade',
                    winner: 'invader'
                },
                action: 'gain_bounty'
            },
            effect: 'activate'
        },
        improved: {
            reactions: {
                after: {
                    verb: 'invade',
                    winner: 'invader'
                },
                action: 'gain_bounty'
            },
            // Others handled in combat
        }
    },
    {
        // Done
        name: 'Data Refinery',
        house: 'Belitan',
        ref: 4,
        basic: {
            effect: {
                verb: 'gain_resource',
                types: {
                    credits: 2,
                    science: 2
                }
            }
        },
        improved: {
            // Handled in upkeep
            effect: ['establish', 'build', 'produce']
        }
    },
    {
        // Done?
        name: 'Decontamination Chambers',
        house: 'Shiveus',
        ref: 14,
        basic: {
            effect: 'move_corruption',
            reactions: {
                beforePhase: 'evaluation phase',
                //condition: (p) => p.techs.find(t => t.name == 'Decontamination Chambers').inside && p.techs.find(t => t.name == 'Decontamination Chambers').inside.length > 0,
                action: {
                    verb: 'remove_corruption',
                    place: 'Decontamination Chambers'
                    /*custom: async (p) => {
                        if(ask(`Do you want to remove a [[corruption]] from your Decontamination Chambers?`)){
                            let inside = p.techs.find(t => t.name == 'Decontamination Chambers').inside;
                            await doAction(p, 'remove_corruption', {obj: inside[0], fromSpecific: 'DC'});
                        }
                    }*/
                }
            }
        },
        improved: {
            effect: 'remove_corruption',
            reactions: [
                {
                    beforePhase: 'evaluation phase',
                    //condition: (p) => p.techs.find(t => t.name == 'Decontamination Chambers').inside && p.techs.find(t => t.name == 'Decontamination Chambers').inside.length > 0,
                    action: {
                        verb: 'remove_corruption',
                        place: 'Decontamination Chambers'
                        /*custom: async (p) => {
                            if(ask(`Do you want to remove a [[corruption]] from your Decontamination Chambers?`)){
                                let inside = p.techs.find(t => t.name == 'Decontamination Chambers').inside;
                                await doAction(p, 'remove_corruption', {obj: inside[0], fromSpecific: 'DC'});
                            }
                        }*/
                    }
                },
                {
                    after: {
                        verb: 'remove_corruption',
                    },
                    not: {
                        fromSpecific: 'DC'
                    },
                    //condition: (p, params) => params.fromSpecific != 'DC' && p.techs.find(t => t.name == 'Decontamination Chambers').inside && p.techs.find(t => t.name == 'Decontamination Chambers').inside.length > 0,
                    action: {
                        verb: 'remove_corruption',
                        place: 'Decontamination Chambers'
                        /*custom: async (p) => {
                            if(ask(`Do you want to remove a [[corruption]] from your Decontamination Chambers?`)){
                                let inside = p.techs.find(t => t.name == 'Decontamination Chambers').inside;
                                await doAction(p, 'remove_corruption', {obj: inside[0], fromSpecific: 'DC'});
                            }
                        }*/
                }
            }]
        }
    },
    {
        // Done
        name: 'Destroyers',
        house: 'Zenor',
        ship: 'destroyer',
        ref: 9,
        basic: {
            effect: {
                verb: 'deploy',
                type: 'destroyer',
                place: 'home'
            }
        },
        improved: {
            effect: 'activate'
        }
    },
    {
        // Done
        name: 'Deep Space Missiles',
        house: 'Astoran',
        ref: 19,
        basic: {
            focusBoost: {
                card: 'Prosperity',
                cost: {
                    materials: 1
                },
                action: {
                    verb: 'build',
                    type: 'shipyard'
                }
            },
            effect: [
                {
                    verb: 'gain_resource',
                    type: 'energy',
                    num: 2
                },
                {
                    verb: 'build',
                    type: 'shipyard'
                }
            ]
        },
        improved: {
            focusBoost: {
                card: 'Prosperity',
                cost: {
                    materials: 1
                },
                action: {
                    verb: 'build',
                    type: 'shipyard'
                }
            },
            effect: {
                either_or: [
                    {
                        verb: 'build',
                        type: 'shipyard'
                    },
                    'regroup'
                ]
            }
        }
    },
    {
        // Done
        name: 'Dreadnoughts',
        house: 'Shiveus',
        ship: 'dreadnought',
        ref: 13,
        basic: {
            effect: {
                verb: 'deploy',
                type: 'dreadnought',
                place: 'home'
            }
        },
        improved: {
            effect: [
                'activate',
                {
                    verb: 'deploy',
                    type: 'dreadnought',
                }
            ]
        }
    },
    {
        // Done
        name: 'Energy Cells',
        house: 'Dunlork',
        ref: 6,
        basic: {
            effect: {
                either_or: [
                    {
                        cost: {
                            energy: 2
                        },
                        action: {
                            verb: 'activate',
                            num: 2
                        }
                    },
                    {
                        cost: {
                            energy: 5
                        },
                        action: {
                            verb: 'activate',
                            num: 3
                        }
                    }
                ]
            }
        },
        improved: {
            effect: {
                either_or: [
                    [
                        {
                            verb: 'build',
                            type: 'defense'
                        },
                        {
                            verb: 'build',
                            type: 'defense'
                        },
                    ],
                    'regroup'
                ]
            }
        }
    },
    {
        // Done
        name: 'Hyperdrive',
        house: 'Yarvek',
        ref: 15,
        basic: {
            reactions: {
                before: 'invade',
                action: 'regroup'
            },
            focusBoost: {
                card: 'Conquest',
                action: {
                    verb: 'produce',
                    obj: 'energy'
                }
            },
            effect: {
                verb: 'gain_bounty',
                num: 3
            }
        },
        improved: {
            reactions: {
                before: 'invade',
                action: 'regroup'
            },
            focusBoost: {
                card: 'Conquest',
                action: {
                    verb: 'produce',
                    obj: 'energy'
                }
            },
            effect: {
                verb: 'establish',
                type: 'engineers_guild'
            }
        }
    },
    {
        name: 'Escape Pods',
        house: 'Valnis',
        ref: 2,
        basic: {
            effect: ['gain_trade', 'activate']
        },
        improved: {
            effect: ['gain_trade', 'activate']
        }
    },
    {
        // Done
        name: 'Neural Matrix',
        house: 'Thegwyn',
        ref: 12,
        basic: {
            effect: {
                verb: 'establish',
                type: 'bankers_guild'
            },
            reactions: {
                before: {
                    verb: 'produce',
                    obj: 'credits'
                },
                action: {
                    verb: 'gain_resource',
                    types: {
                        credits: 2
                    }
                }
            }
        },
        improved: {
            focusBoost: [
                {
                    card: 'Production',
                    action: {
                        verb: 'produce',
                        obj: 'credits'
                    }
                   
                },
                {
                    card: 'Innovation',
                    action: {
                        verb: 'gain_influence',
                        num: 1,
                        per: 'bankers_guild',
                        restriction: 'pure'
                    }
                    
                }
            ],
            effect: {
                verb: 'produce',
                obj: 'credits'
            },
            reactions: {
                before: {
                    verb: 'produce',
                    obj: 'credits'
                },
                action: {
                    verb: 'gain_resource',
                    types: {
                        credits: 2
                    }
                }
            }
        }
    },
    {
        // Done
        name: 'Orbital Docks',
        house: 'Dunlork',
        ref: 5,
        basic: {
            effect: [
                {
                    verb: 'build',
                    type: 'shipyard'
                },
                'activate'
            ]
        },
        improved: {
            effect: [
                {
                    verb: 'activate',
                    num: 2
                },
                {
                    verb: 'deploy',
                    deploy_per: 'shipyard'
                }
            ]
        }
    },
    {
        name: 'Robotics',
        house: 'Nervo',
        ref: 17,
        basic: {
            effect: {
                verb: 'gain_resource',
                types: {
                    materials: 2
                }
            }
        },
        improved: {
            // No effect
        }
    },
    {
        // Done
        name: 'Purifier',
        house: 'Kradmor',
        ref: 24,
        basic: {
            focusBoost: {
                card: 'Temptation',
                cost: {
                    science: 1
                },
                action: 'remove_corruption'
            },
            effect: {
                cost: {
                    science: 1
                },
                action: 'remove_corruption'
            }
        },
        improved: {
            focusBoost: {
                card: 'Temptation',
                action: [
                    {
                        cost: {
                            science: 1
                        },
                        action: 'remove_corruption'
                    },
                    {
                        cost: {
                            science: 1
                        },
                        action: 'remove_corruption'
                    }
                ]  
            },
            effect: ['remove_corruption', 'deploy']
        }
    },
    {
        name: 'Salvage Scanner',
        house: 'Kradmor',
        ref: 23,
        basic: {
            reactions: {
                before: {
                    verb: 'invade',
                    defender: 'voidborn'
                },
                action: {
                    verb: 'place_token',
                    type: 'reclaim',
                    restriction: 'same_sector'
                }
            },
            effect: {
                either_or: ['activate', 'deploy']
            }
        },
        improved: {
            reactions: [
                {
                    before: 'invade',
                    before: {
                        verb: 'invade',
                        defender: ['voidborn', 'corrupted'] // !! TODO also corrupted sector
                    },
                    action: {
                        verb: 'place_token',
                        type: 'reclaim',
                        restriction: 'same_sector'
                    }
                },
                {
                    after: {
                        verb: 'invade',
                        winner: 'invader',
                        corruptedSector: true
                    },
                    action: {
                        verb: 'remove_corruption',
                        restriction: 'same_sector'
                    }
                }
            ],
        }
    },
    {
        // Done
        name: 'Sentries',
        house: 'Astoran',
        ship: 'sentry',
        ref: 20,
        basic: {
            effect: [
                {
                    verb: 'build',
                    type: 'defense'
                },
                {
                    verb: 'deploy',
                    type: 'sentry',
                    place: 'home'
                }
            ]
        },
        improved: {
            effect: [
                {
                    verb: 'build',
                    type: 'defense'
                },
                'activate'
            ]
        }
    },
    {
        // Done
        name: 'Starbases',
        house: 'Cortozaar',
        ref: 8,
        basic: {
            // Core abilities handled elsewhere
            effect: {
                verb: 'build',
                type: 'starbase'
            }
        },
        improved: {
            effect: {
                verb: 'build',
                type: 'starbase'
            }
        }
    },
    {
        // Done
        name: 'Shields',
        house: 'Valnis',
        ref: 1,
        basic: {
            effect: {
                verb: 'deploy',
                type: 'corvette',
                place: 'home'
            }
        }
    },
    {
        // Done
        name: 'Tactical Transports',
        house: 'Yarvek',
        ref: 16,
        basic: {
            focusBoost: [
                {
                    card: 'Prosperity',
                    cost: {
                        recall: 1
                    },
                    action: {
                        verb: 'increase_population',
                        restriction: 'same_sector'
                    }
                },
                {
                    card: 'Conquest',
                    cost: {
                        population: 1
                    },
                    action: ['activate',
                                {
                                    verb: 'deploy',
                                    restriction: 'same_sector'
                                }
                            ]
                }
            ],
            effect: {
                either_or: ['increase_population', 'deploy']
            }
        },
        improved: {
            focusBoost: [
                {
                    card: ['Prosperity', 'preferred'],
                    cost: {
                        recall: 1
                    },
                    action: {
                        verb: 'increase_population',
                        restriction: 'same_sector'
                    }
                },
                {
                    card: ['Conquest', 'preferred'],
                    cost: {
                        population: 1
                    },
                    action: ['activate',
                                {
                                    verb: 'deploy',
                                    num: 2,
                                    restriction: 'same_sector'
                                }
                            ]
                },
                /*{
                    card: ['preferred'],
                    action: {
                        either_or: [
                            {
                                cost: {
                                    recall: 1
                                },
                                action: {
                                    verb: 'increase_population',
                                    restriction: 'same_sector'
                                }
                            },
                            {
                                cost: {
                                    population: 1
                                },
                                action: [
                                    'activate',
                                    {
                                        verb: 'deploy',
                                        num: 2,
                                        restriction: 'same_sector'
                                    }
                                ]
                            }
                        ]
                    }
                }*/
            ],
            effect: {
                either_or: ['increase_population', 
                {
                    verb: 'deploy',
                    num: 2
                }
            ]
            }
        }
    },
    {
        // Done
        name: 'Targeting',
        house: 'Belitan',
        ref: 3,
        basic: {
            effect: [
                {
                    verb: 'gain_resource',
                    type: 'energy',
                    num: 2
                },
                {
                    verb: 'deploy',
                    type: 'corvette',
                    place: 'home'
                }
            ]
        },
        improved: {
            effect: [
                {
                    verb: 'gain_agenda',
                    type: 'dominance'
                },
                'regroup'
            ]
        }
    },
    {
        // Done
        name: 'Torpedoes',
        house: 'Cortozaar',
        ref: 7,
        basic: {
            effect: [
                {
                    verb: 'gain_resource',
                    type: 'materials',
                    num: 2
                },
                {
                    verb: 'deploy', 
                    type: 'corvette',
                    place: 'home'
                }
            ]
        },
        improved: {
            effect: [
                {
                    verb: 'gain_glory',
                    type: 3
                },
                {
                    verb: 'deploy', 
                    type: 'corvette',
                    deploy_per: 'shipyard'
                }
            ]
        }
    },
    {
        // Done
        name: 'Terraforming',
        house: 'Thegwyn',
        ref: 11,
        basic: {
            focusBoost: [
                {
                    card: ['Development', 'Prosperity'],
                    cost: {
                        materials: 1
                    },
                    action: 'increase_population'
                }
            ],
            effect: {
                either_or: [
                    'increase_population',
                    {
                        verb: 'gain_resource',
                        type: 'materials',
                        num: 2
                    }
                ]
            }
        },
        improved: {
            focusBoost: {
                card: ['Development', 'Prosperity', 'Innovation'],
                action: 'increase_population'
            },
            effect: {
                verb: 'advance_track',
                obj: 'economy'
            }
        }
    },
    {
        // Done
        name: 'Trade Nexus',
        house: 'Marqualos',
        ref: 26,
        basic: {
            effect: [
                {
                    verb: 'gain_resource',
                    type: 'food', 
                    num: 2
                },
                'gain_trade'
            ]
        },
        improved: {
            effect: {
                either_or: [
                    'gain_trade',
                    'gain_agenda'
                ]
            }
        }
    },
]

export let techs = [];

for(let t of techSchemas){
    let basic = {
        ...t,
        type: 'basic',
        fullName: `Basic ${t.name}`,
        ...t.basic
    };
    delete basic.basic;
    delete basic.improved;
    let improved = {
        ...t,
        type: 'improved',
        fullName: `Improved ${t.name}`,
        ...t.improved
    };
    delete improved.basic;
    delete improved.improved;
    improved.influence = 6;
    improved.id = `techs_improved.tech_${improved.ref}+`
    improved.fullRef = `${improved.ref}+`;
    specificSetup(improved);
    let basic2 = jsonpatch.deepClone(basic);
    basic.influence = 0;
    basic.id =`techs_basic.tech_${basic.ref}b`
    basic.fullRef = `${basic.ref}b`
    specificSetup(basic);
    basic2.influence = 4;
    basic2.id =`techs_basic.tech_${basic.ref}a`
    basic2.fullRef = `${basic.ref}a`
    specificSetup(basic2);
    techs = [...techs, basic, basic2, improved];
}

for(let t of techs){
    ol(t); // To have them available
}

function specificSetup(t){
    if(t.name == 'Decontamination Chambers'){
        t.inside = [];
        for(let i = 0; i < 2; i++){
            t.inside.push({
                id: `dc_${t.fullRef}_${i}`,
                slot: 'corrupted',
                corrupted: false
            })
        }
    }
    if(t.name == 'Escape Pods'){
        t.inside = [{
            id: `ep_${t.fullRef}`,
            slot: 'trade',
            trade: false
        }]
    }
}


/*let newTechs = [];
for(let t of techs){
    newTechs.push(ol(t));
}*/

//techs = newTechs;

export function hasTech(p, tech, type = false){
    let found = p.techs.find(t => t.name == tech);
    if(found){
        if(!type || found.type == type) return found;
    }
    return false;
}

export function getTechGrid(stateTechs){
    let techs = stateTechs.sort((a,b) => a.name.localeCompare(b.name));
    let max = {};
    for(let t of techs){
        if(max[t.name] && max[t.name].influence > t.influence) continue;
        max[t.name] = t;
    }
    techs = Object.values(max); // Filter out the lower influence ones
    return techs;
}

export function basicTechs(state){
    return state.basic_techs.filter(t => t.length > 0).map(t => t[0]);
}

export function improvedTechLimit(p){
    let limit = 0;
    for(let t of Object.keys(p.tracks)){
        if(getTier(p, t) >= 1) limit++;
        if(getTier(p, t) >= 2) limit++;
    }
    limit += ongoingPlayer(p).filter(o => o == 'increase_improved_tech_limit').length;
    return limit;
}

export function focusBoosts(focus, p){
    let boosts = [];
    if(focus.lo) focus = lo(focus);
    for(let t of [...p.techs, ...playerSectors(p), house(p)]){
        if(t.lo) t = lo(t);
        if(techs.find(tech => tech.id == t.id)) t = techs.find(tech => tech.id == t.id); // In case of any fixes
        if(!t.focusBoost) continue;
        let fb = t.focusBoost;
        if(!Array.isArray(fb)) fb = [fb];
        let i = 0;
        let cardBoosts = [];
        for(let b of fb){
            let matches = false;
            for(let c of possArray(b.card)){
                if(c == 'any') matches = true;
                if(c == focus.name) matches = true;
                if(c == focus.matches) matches = true;
                if(c == 'preferred' && isPreferred(p, focus)) matches = true;
            }
            if(matches){
                b.sourceID = t.id;
                b.cardType = t.type;
                b.boostID = `${t.id}-${i++}`;
                if(t.id.startsWith('tech')){
                    b.boostLabel = `[[${t.type}_tech]] ${t.name}: `
                }else if(b.label){
                    b.boostLabel = b.label
                }
               
                cardBoosts.push(b);
                // break; // To stop a tech/card matching two different things on a card
            }
        }
        if(cardBoosts.length > 1){
            // Multiple, so need to choose.
            // TODO check this works
            boosts.push({
                sourceID: t.id,
                cardType: t.type,
                boostID: `${t.id}-ALL`,
                boostLabel: cardBoosts[0].boostLabel,
                action: {
                    either_or: cardBoosts
                }
            })
        }else{
            boosts.push(...cardBoosts);
        }
    }
    return boosts;
}

export function techLimit(p){
    let base = p.tech_limit;
    base += ongoingPlayer(p).filter(o => o == 'increase_tech_limit').length;
    if(p.fallen_claimed) base++;
    return base;
}

export async function resolveTechGain(p, tech){
    //specificSetup(tech);
    if(tech.fullName == 'Improved Central Surveillance'){
        let i = p.agendas.length;
        p.agendas = [...p.agendas,
            {
                id: `agendas.${p.colour}_${i}`,
                corrupted: false,
                card: null,
                trade: false
            }
        ]; // Extra agenda slot
        assembleList(p.agendas, p, 'agendas', `state.players.${get(state).players.findIndex(pl => pl.house == p.house)}.agendas`, true);
        await pause(`Extra Agenda slot added (to right of player mat)`)
    }
    
    if(tech.name == 'Ark Ships'){
        let home = playerSectors(p).find(s => s.type == 'home');
        if(!home.ark_ships) home.ark_ships = [];
        let space = 2;
        if(tech.type == 'improved') space = 4;
        space = space - home.ark_ships.length;
        if(space > 0 && home.upkeep && home.upkeep.guilds && home.upkeep.guilds.some((i) => home.guilds[i])){
            let toMove = await choose(`You may rearrange your Guilds to reduce upkeep. Select any you wish to move across to your Ark Ships`, home.guilds, {optional: true, max: Math.min(home.guilds.length, space)});
            for(let m of toMove){
                moveBitTo(m, home.ark_ships);
            }
        }
    }
    if(tech.name == 'Robotics'){
        // You can repeat the current action
        /*(f.name.endsWith('Development') || t.type == 'improved' && house(p).preferred.includes(f.matches || f.name))){
            let nextEffect = a.value;
            if(!nextEffect.cost || getCostInfo(p, doubleCost(nextEffect.cost))){
                if(await ask(`[[${t.type}_tech]] Robotics: double cost and effect of this action?`)){
                    
                    state.update(s => {
                        s.focus.doubleFocusAction = true;
                        s.focus.alreadyDoubledFocusAction = true;
                        return s;
                    })
                }
            }*/
    }
    if(tech.name == 'Decontamination Chambers' || tech.name == 'Escape Pods'){
        if(!tech.inside) tech.inside = [];
        if(tech.name == 'Decontamination Chambers'){
            let spaces = 2;
            if(tech.type == 'improved') spaces = 3;
            for(let i = tech.inside.length; i < spaces; i++){
                tech.inside.push({
                    id: `dc_${tech.fullRef}_${i}`,
                    slot: 'corrupted',
                    corrupted: false
                })
            }
        }else if(tech.name == 'Escape Pods'){
            tech.inside = [
                {
                    id: `ep_${tech.fullRef}`,
                    slot: 'trade',
                    trade: false
                }
            ];
        }
    }

    
}

export function arkSpaces(p){
    if(hasTech(p, 'Ark Ships', 'improved')) return 4;
    if(hasTech(p, 'Ark Ships', 'basic')) return 2;
    return 0;
}

export function dcSpaces(p){
    if(hasTech(p, 'Decontamination Chambers', 'improved')) return 3;
    if(hasTech(p, 'Decontamination Chambers', 'basic')) return 2;
    return 0;
}

export function techsForHouses(houses){
    let ret = [];
    for(let h of houses){
        if(!h) continue;
        ret.push(...techs.filter(t => t.influence && h.techs.includes(t.name)));
    }
    return ret;
}

export function getTechName(id){
    let ref = id.split('_')[2].slice(0, -1);
    let tech = techs.find(t => t.ref == ref);
    let techName = tech.name;
    return techName;
}