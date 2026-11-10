// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { get } from "./runtime.js";
import { playerCorruptionSlots } from "./actions.js";
import { testCondition } from "./agendas.js";
import { getCostInfo, pay } from "./costs.js";
import { getReadableDescription, doEffect, executeActions, doAction, playerTrade, log } from "./game.js";
import { controlledBy, fleetCount, isAdjacent, playerSectors, voidbornFleetSpaces, voidbornSectors } from "./sectors.js";
import { state, ui } from "./stores.js";
import { returnToken, topToken } from "./tokens.js";
import { ask, choose, doActionPause, hideExpandable, pause, showExpandable, waitMillis } from "./ui.js";
import { all, lo, moveBitTo, ol } from "./utils.js";
import { undo } from "./undo.js";
import { canDo } from "./crisis.js";
import { moveFleet } from "./fleets.js";

export let galacticEvents = {
    cycle_1: [
        {
            id: '1T',
            name: 'From the Ashes',
            rounds: 3,
            effects: [
                {
                    type: 'players_must', // Possible: players_must, players_may, once, ongoing, delayed
                    action: [
                        {
                            verb: 'discard_focus',
                            obj: ['Conquest', 'Politics', 'Progress', 'Prosperity', 'Temptation']
                        },
                        /*{
                            verb: 'move_corruption',
                            obj: 'house_mat',
                            dest: 'outpost'
                        }*/
                        {
                            custom: async (p) => {
                                console.log('moving corruption')
                                await doActionPause();
                                moveBitTo(p.agendas[3].corrupted, playerSectors(p).find(s => s.special =='outpost'), 'corrupted');
                                //await doActionPause();
                               // moveBitTo(p.fleets.inactive[0], p.fleets.active)
                            },
                            log: 'moved player [[corruption]] to Outpost sector'
                        }
                    ]
                }
            ],
            objectives: {
                either_or: [{
                    condition: {
                        min: 5,
                        per: 'fleets'
                    },
                    effects: ['increase_population', {
                        verb: 'gain_resource',
                        types: {
                            credits: 1,
                            science: 1
                        }
                    }]
                },
                {
                    condition: {
                        min: 5,
                        per: 'guild',
                        restriction: 'pure'
                    },
                    effects: ['deploy', {
                        verb: 'gain_resource',
                        type: 'food',
                        num: 2
                    }]
                }]
            }
        },
        {
            id: '1A',
            name: 'Dawn of Technology',
            rounds: 4,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_multiple',
                        obj: ['defense', 'scientists_guild'],
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            {
                                verb: 'gain_resource',
                                types: {
                                    credits:3
                                }
                            },
                            {
                                cost: {
                                    science: 1
                                },
                                action: {
                                    verb: 'gain_tech',
                                    type: 'basic'
                                }
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 2,
                            per: 'scientists_guild',
                            restriction: 'pure'
                        },
                        effects: [
                            'activate',
                            {
                                verb: 'gain_bounty',
                                num: 2
                            }
                        ]
                    },
                    {
                        condition: {
                            min: 3,
                            per: 'techs'
                        },
                        effects: [
                            'produce',
                            {
                                verb: 'gain_resource',
                                types: {
                                    credits: 1
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            id: '1B',
            name: 'Looming Destiny',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: 
                        {
                            verb: 'place_multiple',
                            obj: ['reclaim', 'defense'],
                            place: 'voidborn',
                            restriction: 'adjacent'
                        }
                },
                {
                    type: 'once',
                    action: {
                        verb: 'place_corruption',
                        place: 'dominance'
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            'activate',
                            {
                                verb: 'deploy',
                                place: 'home'
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 1,
                            per: 'agendas',
                            restriction: 'pure'
                        },
                        effects: 'build'
                    },
                    {
                        condition: {
                            min: 5,
                            per: 'guild',
                            restriction: 'pure'
                        },
                        effects: 'gain_agenda'
                    }
                ]
            }
        },
        {
            id: '1C',
            name: 'Remnants of the Domineum',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_token',
                            type: 'bounty',
                            place: 'voidborn', 
                            restriction: 'adjacent',
                            filter: 'lowest_pop'
                        },
                        {
                            verb: 'place_multiple',
                            obj: ['reclaim', 'defense'],
                            place: 'voidborn',
                            restriction: 'adjacent',
                            filter: 'highest_pop'
                        }
                    ]
                        
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            'establish',
                            'build'
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 6,
                            per: 'fleets',
                        },
                        effects: [
                            'remove_corruption',
                            'move_corruption'
                        ]
                    },
                    {
                        condition: {
                            min: 1,
                            per: 'highest_track_tier',
                            restriction: 'pure'
                        },
                        effects: {
                            either_or: [
                                {
                                    verb: 'gain_resource',
                                    type: 'credits',
                                    num: 2
                                },
                                'gain_trade'
                            ]
                        }
                    }
                ]
            }
        },
        {
            id: '1D',
            name: 'We are the Resistance',
            rounds: 4,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['voidborn', 'glory1'],
                            place: 'voidborn', 
                            restriction: 'adjacent'
                        }
                    ]
                        
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            'activate',
                            'increase_population',
                            {
                                verb: 'establish',
                                type: 'bankers_guild'
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 10,
                            per: 'population',
                            restriction: 'pure'
                        },
                        effects: [
                            'establish',
                            'build'
                        ]
                    },
                    {
                        condition: {
                            min: 3,
                            per: 'bankers_guild',
                            restriction: 'pure'
                        },
                        effects: 'advance_track'
                    }
                ]
            }
        },
        {
            id: '1E',
            name: 'Civilization Reborn',
            rounds: 4,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['bankers_guild', 'voidborn'],
                            place: 'voidborn', 
                            restriction: 'adjacent'
                        }
                    ]
                        
                },
                {
                    type: 'players_may',
                    action: 'advance_track'
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 3,
                            per: 'sector',
                            filter: 'bankers_guild',
                            restriction: 'pure'
                        },
                        effects: 'gain_tech'
                    },
                    {
                        condition: {
                            max: 2,
                            per: 'empty_guilds'
                        },
                        effects: {
                            verb: 'produce',
                            num: 2,
                            restriction: 'different'
                        }
                    }
                ]
            }
        },
        {
            id: '1F',
            name: 'Time of Reckoning',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        either_or: [
                            {
                                verb: 'place_multiple',
                                obj: ['guild', 'voidborn'],
                                place: 'voidborn', 
                                restriction: 'adjacent',
                                filter: 'lowest_pop'
                            },
                            {
                                verb: 'place_multiple',
                                obj: ['glory2', 'defense'],
                                place: 'voidborn', 
                                restriction: 'adjacent',
                                filter: 'highest_pop'
                            },
                        ]
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            {
                                verb: 'deploy',
                                place: 'home'
                            },
                            'upgrade_glory'
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 3,
                            per: 'upkeep',
                            filter: 'sectors'
                        },
                        effects: 'increase_population'
                    },
                    {
                        condition: {
                            min: 3,
                            per: 'glory'
                        },
                        effects: {
                            verb: 'gain_bounty',
                            num: 2,
                        }
                    }
                ]
            }
        },
        {
            id: '1G',
            name: 'In the Face of Evil',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        either_or: [
                            {
                                verb: 'gain_corruption',
                                restriction: 'agendas'
                            },
                            {
                                simple_list: [
                                    {
                                        verb: 'gain_corruption',
                                        restriction: 'tracks'
                                    },
                                    {
                                        verb: 'advance_track',
                                        restriction: 'corrupted_track'
                                    }
                                ]
                            },
                        ]
                    }
                },
            ],
            ongoing: 'keep_corruption',
            objectives: {
                either_or: [
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_resource',
                                    types: {
                                        food: 2,
                                        influence: 1
                                    },
                                    per: 'kept_corruption'
                                },
                                {
                                    custom: async (p) => {
                                        while(p.kept_corruption.length > 0){
                                            await returnToken(p.kept_corruption[0], p);
                                        }
                                    },
                                    description: 'return [[corruption]]'
                                }
                            ]
                        }
                    },
                    {
                        effects: {
                            simple_list: [
                                [
                                    {
                                        verb: 'increase_population',
                                        place: 'scientists_guild',
                                        restriction: 'different_sector'
                                    },
                                    {
                                        verb: 'increase_population',
                                        place: 'scientists_guild',
                                        restriction: 'different_sector'
                                    },
                                    {
                                        verb: 'increase_population',
                                        place: 'scientists_guild',
                                        restriction: 'different_sector'
                                    },
                                ],
                                {
                                    custom: async (p) => {
                                        while(p.kept_corruption.length > 0){
                                            await returnToken(p.kept_corruption[0], p);
                                        }
                                    },
                                    description: 'return [[corruption]]'
                                }
                            ]
                        }   
                    }
                ]
            }
        },
        {
            id: '1H',
            name: 'Straight into Hell',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        either_or: [
                            {
                                cost: {
                                    gain_corruption: 1
                                },
                                action: {
                                    verb: 'gain_glory',
                                    type: 1
                                }
                            },
                            'recall'
                        ]
                    }
                },
            ],
            reactions: {
                after: {
                    verb: 'deploy',
                    count: {
                        min: 1
                    }
                },
                mandatory: true, 
               
                condition: (p, params) => {
                    // To set cache
                    state.update(s => {
                        s.cache.deployCount = params.count;
                        return s;
                    })
                    return true;
                },
                action: {
                    description: 'gain corruption or spend [[materials]]',
                    custom: async (p) => {
                        let count = get(state).cache.deployCount;
                        let choices = [
                            {
                                type: 'text',
                                choice: 'Gain [[corruption]]',
                                disabled: get(state).turnCache && get(state).turnCache.event1h_already_gained_corruption,
                                value: 'corruption'
                            },
                            {
                                type: 'text',
                                choice: `Spend ${count} [[materials]]`,
                                disabled: !getCostInfo(p, {materials: count}),
                                value: 'pay'
                            }
                        ]
                        if(choices.every(c => c.disabled)){
                            await pause('Deploy action impossible because you cannot pay the penalty!');
                            //throw 'cancelled';
                            if(get(ui).undoFunc){
                                await get(ui).undoFunc();
                            }else{
                                await undo();
                            }
                            return 'cancelled';
                        }
                        let chosen = await choose(`Select penalty for deploying Fleet power`, choices, {cancellable: true});
                        if(chosen == 'cancelled'){
                            //throw 'cancelled';
                            console.log(get(ui));
                            if(get(ui).undoFunc){
                                await get(ui).undoFunc();
                            }else{
                                await undo();
                            }
                            return 'cancelled';
                        }else if(chosen == 'corruption'){
                            await doAction(p, 'gain_corruption');
                            state.update(s => {
                                if(!s.turnCache) s.turnCache = {};
                                s.turnCache.event1h_already_gained_corruption = true;
                                return s;
                            })
                        }else{
                            await doAction(p, 'spend_resource', {types: {materials: count}})
                        }
                    }
                }
            },
            objectives: {
                either_or: [
                    {
                        condition: {
                            max: 0,
                            per: 'corruption',
                            filter: 'house_mat'
                        },
                        effects: {
                            either_or: [
                                {
                                    verb: 'gain_glory',
                                    type: 2
                                },
                                'upgrade_glory'
                            ]
                        }
                    },
                    {
                        condition: {
                            min: 2,
                            per: 'sector',
                            restriction: 'pure',
                            filter: {
                                type: 'fleets',
                                min: 2
                            }
                        },
                        effects: 'gain_tech'
                    }
                ]
            }
        },
        {
            id: '1I',
            name: 'Glorious Ascension',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_multiple',
                        obj: ['reclaim', 'defense'],
                        place: 'voidborn', 
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            ['upgrade_glory', 'activate'],
                            'advance_track'
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 1,
                            per: 'highest_track_tier',
                            restriction: 'pure'
                        },
                        effects: {
                            verb: 'activate',
                            per: 'track',
                            restriction: 'pure'
                        }
                    },
                    {
                        condition: {
                            min: 4,
                            per: 'highest_glory'
                        },
                        effects: {
                            verb: 'remove_corruption',
                            restriction: 'sectors'
                        }
                    }
                ]
            }
        },
        {
            id: '1J',
            name: 'Know Your Enemy',
            mode: 'coop',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_token',
                        type: 'voidborn',
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_may',
                    sharedCost: true,
                    cost: {
                        gain_corruption: 2 // How to do split between players?
                    },
                    action: {
                        verb: 'return_token',
                        type: 'harbinger',
                        restriction: 'sectors'
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 4,
                            per: 'sector'
                        },
                        effects: {
                            verb: 'gain_glory',
                            type: 3
                        }
                    },
                    {
                        condition: {
                            min: 1,
                            per: 'resources_store',
                            filter: {
                                min: 10
                            }
                        },
                        effects: 'advance_track'
                    }
                ]
            }
        }
    ],
    cycle_2: [
        {
            id: '2T',
            name: 'Through Enlightenment',
            rounds: 4,
            effects: [
                {
                    type: 'players_must', // Possible: players_in_order, once, ongoing, delayed
                    action: [
                        {
                            verb: 'discard_focus',
                            obj: ['Production', 'Progress', 'Reinforcement', 'Temptation']
                        },
                        
                    ]
                },
                {
                    type: 'players_may',
                    action: ['activate', {
                        verb: 'gain_tech',
                        type: 'basic'
                    }]
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 9,
                            per: 'population',
                            restriction: 'pure'
                        },
                        effects:  ['activate', {
                            verb: 'gain_tech',
                            type: 'basic'
                        }]
                    },
                    {
                        condition: {
                            min: 3,
                            per: 'techs'
                        },
                        effects: ['activate', 'increase_population']
                    }
                ]
            }
        },
        {
            id: '2A',
            name: 'Dark Ages',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['reclaim', 'voidborn'],
                            place: 'voidborn', 
                            restriction: 'adjacent'
                        }
                    ]
                },
                {
                    type: 'once',
                    action: {
                        verb: 'place_corruption',
                        place: 'might'
                    }
                },
                {
                    type: 'players_must',
                    action: {
                        description: 'spend [[science]] for [[credits]]',
                        custom: async (p) => {
                            if(p.resources.science.store == 0) return;
                            let num = await pause(`Choose how much [[science]] to convert to [[credits]]`, {ranges: {science: {min: 0, max: Math.min(6, p.resources.science.store)}}});
                            if(num.science > 0){
                                await doAction(p, 'spend_resource', {types: num});
                                await doAction(p, 'gain_resource', {types: {credits: num.science}})
                            }
                        }
                    } 
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 8,
                            per: 'upkeep',
                            restriction: 'all_satisfied'
                        },
                        effects: ['gain_agenda']
                    },
                    {
                        condition: {
                            min: 8,
                            per: 'installation',
                            restriction: 'pure'
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 8
                        }
                    }
                ]
            }
        },
        {
            id: '2B',
            name: 'Strength in Numbers',
            rounds: 4,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['voidborn', 'bankers_guild'],
                            place: 'voidborn', 
                            restriction: 'adjacent'
                        }
                    ]
                },
                {
                    type: 'once',
                    action: {
                        verb: 'place_corruption',
                        place: 'support'
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            {
                                verb: 'activate',
                                num: 2
                            },
                            {
                                verb: 'deploy',
                                num: 2
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 5,
                            per: ['defense', 'starbase'],
                            restriction: 'pure'
                        },
                        effects:  'gain_trade'
                    },
                    {
                        condition: {
                            max: 4,
                            per: 'upkeep'
                        },
                        effects: [
                            {
                                verb: 'gain_influence',
                                num: 4
                            },
                            'remove_corruption'
                        ]
                    }
                ]
            }
        },
        {
            id: '2C',
            name: 'All-Out Armament',
            rounds: 5,
            effects: [
                {
                    type: 'once',
                    action: {
                        custom: async (p) => {
                            let sec = all('sectors', (s) => controlledBy(s, 'voidborn')).filter(s => s.installations.filter(i => i.value == 'defense').length >= 1);
                            for(let s of sec){
                                await doAction(p, 'place_multiple', {obj: ['bounty', 'glory1'], place: s})
                            }
                        }
                    },
                    
                },
                {
                    type: 'once',
                    action: {
                        verb: 'place_corruption', 
                        place: 'wealth'
                    }
                },
                {
                    type: 'players_may',
                    cost: {
                        population: 1
                    },
                    action: {
                        simple_list: [
                            {
                                verb: 'build',
                                restriction: 'same_sector'
                            },
                            {
                                verb: 'deploy',
                                num: 2,
                                restriction: 'same_sector'
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 3,
                            per: 'sector',
                            filter: {
                                min: 2,
                                type: 'fem_guild'
                            }
                        },
                        effects: {
                            simple_list: [
                                {
                                    either_or: ['remove_corruption', 'activate']
                                },
                                {
                                    either_or: ['remove_corruption', 'activate']
                                }
                            ]
                        }
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            num: 2,
                            per: 'installation',
                            restriction: 'pure'
                        }
                    }
                ]
            }
        },
        {
            id: '2D',
            name: 'Humanity Rising',
            rounds: 5,
            effects: [
                {
                    type: 'once',
                    action: {
                        verb:'place_multiple',
                        obj: ['reclaim', 'bounty', 'voidborn', 'voidborn'], 
                        place: 'voidborn',
                        num: 'all',
                        filter: {
                            type: 'population',
                            min: 4
                        }
                    }
                },
                {
                    type: 'players_must',
                    action: {
                        custom: async (p) => {
                            let poss = playerCorruptionSlots(p, 'tracks');
                            if(poss.length > 0){
                                await doAction(p, 'gain_corruption', {restriction: 'tracks'})
                            }else{
                                await doAction(p, 'gain_corruption')
                            }
                        }
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            {
                                verb: 'gain_resource',
                                types: {
                                    science: 3
                                }
                            },
                            'advance_track'
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 3,
                            per: 'credits_yield'
                        },
                        effects: {
                            verb: 'produce',
                            obj: ['food', 'energy', 'materials']
                        }
                    },
                    {
                        condition: {
                            min: 5,
                            per: 'techs'
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 10
                        }
                    }
                ]
            }
        },
        {
            id: '2E',
            name: 'Rally the Guilds',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        custom: async (p) => {
                            let poss = playerCorruptionSlots(p, 'sectors');
                            if(poss.length > 0){
                                await doAction(p, 'gain_corruption', {restriction: 'sectors'})
                            }else{
                                await doAction(p, 'gain_corruption')
                            }
                        }
                    }
                },
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_multiple',
                        obj: ['reclaim', 'defense'],
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_may',
                    condition: {
                        min: 6,
                        per: 'guild',
                        restriction: 'pure'
                    },
                    action: 'gain_trade'
                },
                {
                    type: 'players_may',
                    condition: {
                        max: 5,
                        per: 'guild',
                        restriction: 'pure'
                    },
                    action: 'gain_bounty'
                },
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            max: 0,
                            per: 'discarded_preferred'
                        },
                        effects: 'advance_track'
                    },
                    {
                        condition: {
                            max: 1,
                            per: 'corruption',
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 8
                        }
                    }
                ]
            }
        },
        {
            id: '2F',
            name: 'Scorched Earth',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_token',
                        type: 'voidborn',
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_must',
                    action: {
                        simple_list: [
                            {
                                either_or: ['unguild', 'unbuild']
                            },
                            {
                                either_or: ['unguild', 'unbuild']
                            }
                        ]
                        
                    }
                }
            ],
            ongoing: 'no_skirmish_or_crisis',
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 2,
                            per: 'sector',
                            filter: {
                                min: 5,
                                type: 'population'
                            }
                        },
                        effects: 'advance_track'
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            num: 5,
                            per: 'resources_store',
                            filter: {
                                min: 8
                            }
                        }
                    }
                ]
            }
        },
        {
            id: '2G',
            name: 'Disruption Within',
            rounds: 4,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        simple_list: [
                            {
                                verb: 'increase_population', // What if this isn't possible? 
                                place: 'not_home',
                                restriction: 'corruptible_sector'
                            },
                            {
                                verb: 'gain_corruption',
                                restriction: 'same_sector',
                                abandonIfNotPossible: true
                            }
                        ]
                    }
                }
            ],
            ongoing: {
                type: 'min_influence_invasion',
                min: 40
            },
            objectives: {
                either_or: [
                    {
                        condition: {
                            num: 4,
                            per: 'glory'
                        },
                        effects: [
                            'gain_bounty',
                            {
                                verb: 'gain_tech',
                                type: 'basic'
                            }
                        ]
                    },
                    {
                        condition: {
                            min: 16,
                            per: 'population',
                            restriction: 'pure'
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 12
                        }
                    }
                ]
            }
        },
        {
            id: '2H',
            name: 'Adapting Darkness',
            rounds: 5,
            effects: [
                {
                    type: 'players_may',
                    action: {
                        verb: 'produce',
                        num: 2,
                        restriction: 'different'
                    }
                }
            ],
            ongoing: 'voidborn_skirmish_improved_tech_salvo_absorption',
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 8,
                            per: 'total_glory'
                        },
                        effects: {
                            either_or: ['remove_corruption', 'gain_agenda']
                        }
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            num: 3,
                            per: 'fleets',
                            filter: 'active'
                        }
                    }
                ]
            }
        },
        {
            id: '2I',
            name: 'Triumph Over All',
            rounds: 4,
            effects: [
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            {
                                verb: 'gain_tech',
                                type: 'basic'
                            },
                            ['activate', 'gain_trade']
                        ]
                    }
                }
            ],
            ongoing: 'upgrade_on_glory',
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 1,
                            per: 'glory',
                            filter: 5
                        },
                        effects: {
                            verb: 'produce', 
                            restriction: 'different',
                            per: 'glory',
                            filter: 5
                        }
                    },
                    {
                        condition: {
                            min: 10,
                            per: 'upkeep',
                            restriction: 'all_satisfied'
                        },
                        effects: {
                            either_or: [
                                {
                                    verb: 'gain_influence',
                                    num: 10
                                },
                                {
                                    verb: 'advance_track',
                                    obj: 'statecraft'
                                }
                            ]
                        }
                    }
                ]
                    
            }
        },
        {
            id: '2J',
            name: 'Growing Menace',
            rounds: 6,
            effects: [
                {
                    type: 'once',
                    action: {
                        verb: 'place_token',
                        type: 'harbinger',
                        place: 'rift'
                    }
                },
                {
                    type: 'once',
                    action: {
                        custom: async (p) => {
                            let adj = voidbornSectors().filter(s => all('sector', (s) => s.type == 'rift').some(sec => isAdjacent(sec, s)));
                            for(let s of adj){
                                await doAction(p, 'place_token', {type: 'reclaim', place: s})
                            }
                        }
                    },
                },
                // TODO add trading resources
                
            ],
            ongoing: 'voidborn_on_harbingers',
            objectives: [
                {
                    effects: {
                        verb: 'gain_bounty',
                        per: 'reclaim'
                    }
                },
                {
                    condition: {
                        max: 0,
                        per: 'catastrophe'
                    },
                    effects: 'remove_corruption'
                }
            ]
        }
    ],
    cycle_3: [
        {
            id: '3T',
            name: 'Redemption Awaits',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',  
                    action: {
                                verb: 'discard_focus',
                                obj: ['Temptation']
                            }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: ['gain_agenda', 'advance_track']
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        condition: {
                            min: 8,
                            per: 'guild',
                            restriction: 'pure'
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 15
                        }
                    },
                    {
                        condition: {
                            min: 2,
                            per: 'highest_track_tier' // Is this the best way to handle this?
                        },
                        effects: {
                            verb: 'gain_influence',
                            num: 15
                        }
                    }
                ]
            }
        },
        {
            id: '3A',
            name: 'Revenge of the Novarchs',
            rounds: 6,
            effects: [
                {
                    type: 'once',
                    action: {
                        custom: async (p) => {
                            let sec = voidbornSectors().filter(s => fleetCount(s) <= 2);
                            for(let s of sec){
                                await doAction(p, 'place_token', {type: 'defense', place: s})
                            }
                        }
                    }
                },
                {
                    type: 'players_must',
                    action: 'unguild'
                },
                {
                    type: 'players_may',
                    action: {
                        verb: 'move_corruption',
                        num: 'any'
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    num: [0, 3, 6, 9, 12],
                                    per: 'society_track_tier'
                                },
                                {
                                    verb: 'gain_influence',
                                    num: [0, 3, 6, 9, 12],
                                    per: 'statecraft_track_tier'
                                },
                                {
                                    verb: 'gain_influence',
                                    num: [0, 3, 6, 9, 12],
                                    per: 'economy_track_tier'
                                },
                            ],
                        },
                    },
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    num: 1,
                                    per: 'fleets',
                                    filter: 'active'
                                },
                                {
                                    verb: 'gain_influence',
                                    num: 2,
                                    per: 'fleets',
                                    restriction: 'pure'
                                }
                            ]
                        }
                    }
                        
                ]
            }
        },
        {
            id: '3B',
            name: 'Total War',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_multiple',
                        obj: ['voidborn', 'glory3', 'defense'],
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                },
                {
                    type: 'players_may',
                    action: [
                        'score_agenda',
                        {
                            verb: 'deploy',
                            num: 1,
                            place: 'shipyard'
                        }
                    ]
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: {
                            verb: 'gain_influence',
                            per: 'total_glory'
                        }
                    },
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    num: 5,
                                    per: 'sector',
                                    restriction: 'pure',
                                    filter: {
                                        min: 3,
                                        type: 'fleets'
                                    }
                                },
                                {
                                    verb: 'gain_influence',
                                    num: 3,
                                    per: 'sector',
                                    filter: {
                                        min: 2,
                                        type: 'upkeep'
                                    }
                                },
                            ]
                            
                            
                        }
                    }
                ]
            }
        },
        {
            id: '3C',
            name: 'Knowledge is Power',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['bounty', 'defense'],
                            place: 'voidborn',
                            restriction: 'adjacent',
                            filter: 'highest_pop'
                        },
                        {
                            custom: async (p) => {
                                if(p.techs.some(t => t.type == 'improved')){
                                    if(Object.keys(p.tracks).some(t => !p.tracks[t].corrupted)){
                                        await doAction(p, 'gain_corruption', {restriction: 'tracks'})
                                    }else{
                                        await doAction(p, 'gain_corruption', {restriction: 'house_mat'})
                                    }
                                    
                                }
                                if(playerTrade(p).length > 0 && await ask(`You may gain 3 [[science]]. Do you want to?`)){
                                    await doAction(p, 'gain_resource', {types: {science: 3}})
                                }
                                if(playerTrade(p).length == 0 && getCostInfo(p, {science: 1}) && await ask(`You may spend a [[science]] to gain a [[trade]] token. Do you want to?`)){
                                    await pay(p, {science: 1});
                                    await doAction(p, 'gain_trade');
                                }
                            }
                        }
                    ]
                },
            ],
            objectives: {
                either_or: [
                    {
                        effects: {
                            verb: 'gain_influence',
                            per: 'resources_store',
                            div: 2
                        }
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            per: 'installation',
                            num: 2,
                            restriction: 'pure'
                        }
                    }
                ]
            }
        },
        {
            id: '3D',
            name: 'The Last Stand',
            rounds: 6,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'gain_corruption',
                            restriction: 'agendas'
                        },
                        {
                            verb: 'gain_corruption',
                            restriction: 'agendas'
                        },
                    ]
                },
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_token',
                            type: 'glory3',
                            place: 'voidborn_fallen'
                        }
                    ]
                },
                {
                    type: 'players_may',
                    action: [
                        'deploy',
                        'establish'
                    ]
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: 'score_agenda'
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            num: 3,
                            per: 'corruption',
                            filter: 'house_mat'
                        }
                    }
                ]
            }
        },
        {
            id: '3E',
            name: 'A Beacon of Hope',
            rounds: 6,
            effects: [
                {
                    type: 'players_must',
                    action: [
                        {
                            verb: 'place_multiple',
                            obj: ['bankers_guild', 'voidborn', 'defense'],
                            place: 'voidborn',
                            restriction: 'adjacent'
                        },
                        {
                            custom: async (p) => { 
                                if(canDo(p, {verb: 'gain_corruption', restriction: 'house_mat'})){
                                    await doAction(p, 'gain_corruption', {restriction: 'house_mat'})
                                }else{
                                    await doAction(p, 'gain_corruption')
                                }
                            }
                        }
                    ]
                },
                {
                    type: 'players_may',
                    cost: {
                        recall: 1
                    },
                    action: {
                        simple_list: [
                            {
                                verb: 'remove_corruption',
                                restriction: 'same_or_adjacent_sector'
                            },
                            {
                                verb: 'gain_influence',
                                num: 6
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: {
                            verb: 'gain_influence',
                            num: 5,
                            per: 'sector',
                            restriction: 'pure',
                            filter: {
                                min: 1,
                                type: 'bankers_guild'
                            }
                        }
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            per: 'population'
                        }
                    }
                ]
            }
        },
        {
            id: '3F',
            name: 'Shadow of the Void',
            rounds: 6,
            effects: [
                {
                    type: 'once',
                    action: {
                        custom: async (p) => {
                            await showExpandable('agendas');
                            await waitMillis(1000);
                            let ab = get(state).agenda_board;
                            for(let a of Object.keys(ab).filter(k => !ab[k].corrupted).map(k => ab[k])){
                                moveBitTo(topToken('corruption'), a, 'corrupted');
                            }
                            await waitMillis(1000);
                            await hideExpandable('agendas');
                            let sectors = all('sectors', (s) => controlledBy(s, 'voidborn') && voidbornFleetSpaces(s) > 0 && s.population >= 4);
                            for(let s of sectors){
                               await moveFleet('voidborn', 'voidborn', s.id, 'place', 'voidborn');
                            }
                        }
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            'remove_corruption',
                            {
                                simple_list: [
                                    {
                                        verb: 'gain_corruption',
                                        restriction: 'agendas'
                                    },
                                    'advance_track'
                                ]
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    per: 'highest_yield'
                                },
                                {
                                    verb: 'gain_influence',
                                    per: 'lowest_yield',
                                    filter: ['food', 'energy', 'materials']
                                }
                            ]
                        }
                        
                    },
                    {
                        condition: [
                            {
                                max: 0,
                                per: 'corruption',
                                filter: 'house_mat'
                            },
                            {
                                min: 5,
                                per: 'techs'
                            }
                        ],
                        effects: {
                            verb: 'gain_influence',
                            num: 20
                        }
                    }
                ]
            }
        },
        {
            id: '3G',
            name: 'Wind of Annihilation', 
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        custom: async (p) => { 
                            if(canDo(p, {verb: 'gain_corruption', restriction: 'house_mat'})){
                                await doAction(p, 'gain_corruption', {restriction: 'house_mat'})
                            }else{
                                await doAction(p, 'gain_corruption')
                            }
                        }
                    }
                },
                {
                    type: 'players_may',
                    action: {
                        either_or: [
                            ['advance_track', 'increase_population'],
                            {
                                verb: 'deploy',
                                num: 3
                            }
                        ]
                    }
                }
            ],
            delayed: {
                verb: 'resolve_skirmish', 
                mods: {
                    voidborn_power: 1
                }
            },
            objectives: {
                either_or: [
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    num: 1,
                                    per: 'sector',
                                    restriction: 'pure',
                                    filter: {
                                        type: 'population',
                                        num: 4,
                                    }
                                },
                                {
                                    verb: 'gain_influence',
                                    num: 3,
                                    per: 'sector',
                                    restriction: 'pure',
                                    filter: {
                                        type: 'population',
                                        num: 5,
                                    }
                                },
                                {
                                    verb: 'gain_influence',
                                    num: 6,
                                    per: 'sector',
                                    restriction: 'pure',
                                    filter: {
                                        type: 'population',
                                        num: 6,
                                    }
                                },
                            ]
                        }
                    },
                    {
                        effects: {
                            custom: async (p) => {
                                let numSectors = playerSectors(p).filter(s => !s.corrupted).length - 4;
                                if(numSectors > 0){
                                    await doAction(p, 'gain_influence',{
                                        num: 5 * numSectors
                                    })
                                }
                            },
                            description: 'Gain 5 influence for each bar 4 of your pure sectors'
                        }
                    }
                ]
            }
        },
        {
            id: '3H',
            name: 'Adapt and Overcome',
            rounds: 6,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        custom: async (p) => { 
                            if(canDo(p, {verb: 'gain_corruption', restriction: 'house_mat'})){
                                await doAction(p, 'gain_corruption', {restriction: 'house_mat'})
                            }else{
                                await doAction(p, 'gain_corruption')
                            }
                        }
                    }
                },
                {
                    type: 'players_must',
                    action: {
                        verb: 'place_token',
                        type: 'reclaim',
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                }
            ],
            ongoing: 'preferred_energy_cost',
            objectives: [
                {
                    effects: {
                            verb: 'gain_influence',
                            num: 2,
                            per: 'sector',
                            restriction: 'pure',
                            filter: {
                            min: 1,
                            type: 'fem_guild'
                            }
                    }
                },
                {
                    effects: {
                        verb: 'gain_influence',
                        num: 6,
                        per: 'track',
                        restriction: 'pure',
                        filter: {
                            min: 1
                        }
                    }
                }
            ]
        },
        {
            id: '3I',
            name: 'Shining Future',
            rounds: 5,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        either_or: [
                            {
                                cost: {credits: 1},
                                action: 'upgrade_glory'
                            },
                            {
                                cost: {glory: 1},
                                action: {
                                    verb: 'gain_resource',
                                    types: {
                                        credits: 3
                                    }
                                }
                            }
                        ]
                    }
                }
            ],
            ongoing: 'preferred_credits_cost',
            objectives: {
                either_or: [
                    {
                        effects: {
                            custom: async (p) => {
                                let totalValue = p.glory.sort((a, b) => b.value - a.value).slice(0, 3).reduce((a, c) => a + c.value, 0);
                                await doAction(p, 'gain_influence', {
                                    num: totalValue * 2
                                })
                            },
                            description: 'Score your three highest Glory twice'
                        }
                    },
                    {
                        effects: {
                            simple_list: [
                                {
                                    verb: 'gain_influence',
                                    per: 'credits_store'
                                },
                                {
                                    verb: 'gain_influence',
                                    num: 2,
                                    per: 'bankers_guild',
                                    restriction: 'pure'
                                }
                            ]
                        }
                    }
                ]
            }
        },
        {
            id: '3J',
            name: 'Final Breath',
            rounds: 6,
            effects: [
                {
                    type: 'players_must',
                    action: {
                        either_or: [
                            {
                                simple_list: [
                                    'discard_crisis',
                                    'take_catastrophe'
                                ]
                            },
                            {
                                verb: 'place_token',
                                type: 'harbinger',
                                place: 'voidborn',
                                restriction: 'adjacent'
                            },
                            {
                                verb: 'gain_corruption',
                                restriction: 'house_mat'
                            }
                        ]
                    }
                }
            ],
            objectives: {
                either_or: [
                    {
                        effects: 'score_agenda'
                    },
                    {
                        effects: {
                            verb: 'gain_influence',
                            per: 'population',
                            restriction: 'pure'
                        }
                    }
                ]
            }
        }
    ]
}

for(let c of Object.keys(galacticEvents)){
    for(let e of galacticEvents[c]){
        e.ref = e.id;
        e.id =`event_${c.split('_')[1]}_cards.${e.id}`;
        ol(e); // To have it ready for future
    }
}

export function canMeetObjective(p, obj){
    if(!Array.isArray(obj)) obj = [obj];
    let metAll = true;
    for(let o of obj){
        if(!o.condition) continue;
        if(!testCondition(p, o.condition, false)) metAll = false;
    }
    return metAll;
}

export async function resolveGalacticObjectives(p, card){
    if(card.lo) card = lo(card);
    let obj = card.objectives;
    if(obj.either_or){
        let available = [];
        for(let o of obj.either_or){
            if(canMeetObjective(p, o)) available.push({
                type: 'text',
                choice: getReadableDescription(o.effects),
                value: o
            })
        }
        if(available.length == 0){
            log({
                type: 'stats',
                objectivesMet: []
            },
            p)
            await pause('No Galactic Objective met this cycle, so no rewards', {foreground: card});
        }else if(available.length == 1){
            log({
                type: 'stats',
                objectivesMet: [available[0].choice],//[available[0].value],//
                objectiveTaken: available[0].choice//available[0].value //
            },
            p)
            await pause('Only one Galactic Objective met this cycle, so taking that reward', {foreground: card});
            await resolveObjectives(p, available[0].value);
        }else{
            
            let chosen = await choose(`Multiple Galactic Objectives met this cycle: choose your reward`, available, {foreground: card});
            let choice = available.find(a => a.value == chosen)
            log({
                type: 'stats',
                objectivesMet: available.map(a => a.choice),//available.map(a => a.value),//choice),
                objectiveTaken: choice ? choice.choice : 'unknown option' //chosen//choice ? choice.choice : 'unknown option' // rather than choice.choice
            },
            p)
            await resolveObjectives(p, chosen);
        }
    }else{
        log({
            type: 'stats',
            objectivesMet: obj.map(o => getReadableDescription(o.effects)),
            objectiveTaken: obj.map(o => getReadableDescription(o.effects)).join(' and/or ')
            //objectivesMet: [obj],//[getReadableDescription(obj.effects)],
            //objectiveTaken: [obj]//getReadableDescription(obj.effects)
        },
        p)
        await resolveObjectives(p, obj);
    }
}

export async function resolveObjectives(p, obj){
    if(!Array.isArray(obj)) obj = [obj];
    obj = obj.filter(o => !o.condition || testCondition(p, o.condition, false));
    if(obj.length == 0){
        await pause('Objecitve condition not met');
        return;
    }
    let alwaysAsk = false;
    if(obj.length > 1) alwaysAsk = true;
    obj = obj.flatMap(o => o.effects);
    // Now we have them all as a set
    await executeActions(p, obj, {alwaysAsk});
    return;
    for(let o of obj){
        /*if(o.influence){
            let num = o.influence;
            if(o.per){
                // Multiplier
                let count = countThings(p, o);
                if(Array.isArray(o.influence)){
                    // Multiple choice
                    if(count >= o.influence.length) count = o.influence.length - 1; //Round down
                    num = o.influence[count];
                }else{
                    num = count * o.influence;
                }
            }
            await doAction(p, 'gain_influence', {num})
        }*/if(o.condition){
            if(testCondition(p, o.condition, false)) await executeActions(p, o.effects);
        }else{
            await executeActions(p, o.effects);
        }
    }
}