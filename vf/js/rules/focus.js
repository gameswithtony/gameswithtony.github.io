// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { playerColours } from "./stores.js";
import * as jsonpatch from './runtime.js';
import { lo, ol } from "./utils.js";
import { house } from "./houses.js";

let focus_template = [
    {
        name: 'Conquest',
        effects: [
            {
                name: 'Engage',
                cost: {
                    energy: 2
                },
                action: {
                    either_or: ['invade', 'regroup']
                }
            },
            {
                name: 'Strategize',
                cost: {
                    energy: 1,
                    credits: 1
                },
                action: ['gain_agenda', 'move_corruption']
            },
            {
                name: 'Prepare',
                cost: {
                    materials: 3
                },
                action: [
                    {
                        verb: 'activate',
                        num: 2
                    }
                ]
            }
        ]
    },
    {
        name: 'Development',
        effects: [
            {
                name: 'Grow',
                cost: {
                    materials: 1
                },
                action: {
                    either_or: ['establish', 'build']
                }
            },
            {
                name: 'Settle',
                cost: {
                    recall: 1
                },
                action: [
                    {
                        verb: 'establish',
                        restriction: 'same_sector'
                    },
                    {
                        verb: 'build',
                        restriction: 'same_sector'
                    }
                ]
            },
            {
                name: 'Harmonize',
                cost: {
                    science: 1
                },
                action: {
                    either_or: ['increase_population', 'remove_corruption']
                }
            }
        ]
    },
    {
        name: 'Innovation',
        special: 'discard_cycle_1',
        effects: [
            {
                name: 'Research',
                cost: {
                    food: 2
                },
                action: [
                    {
                        verb: 'produce',
                        obj: ['science', 'credits']
                    },
                    {
                        verb: 'gain_influence',
                        per: ['scientists_guild', 'bankers_guild'],
                        onlyPure: true
                    }
                ]
            },
            {
                name: 'Invent',
                cost: {
                    science: 2
                },
                action: 'gain_tech'
            },
            {
                name: 'Consolidate',
                cost: {
                    food: 1,
                    energy: 1,
                    materials: 1
                },
                action: 'gain_agenda'
            }
        ]
    },
    {
        name: 'Politics',
        effects: [
            {
                name: 'Inspire',
                cost: {
                    science: 1
                },
                action: {
                    verb: 'advance_track',
                    obj: 'statecraft'
                }
            },
            {
                name: 'Prevail',
                cost: {
                    energy: 2,
                    credits: 1
                },
                action: ['upgrade_glory', 'invade']
            },
            {
                name: 'Control',
                cost: {
                    credits: 1
                },
                action: ['gain_trade', 'move_corruption']
            }
        ]
    },
    {
        name: 'Production',
        effects: [
            {
                name: 'Thrive',
                action: {
                    verb: 'advance_track',
                    obj: 'society'
                }
            },
            {
                name: 'Supply',
                action: [
                    {
                        verb: 'produce',
                        obj: ['food', 'energy', 'materials']
                    },
                    {
                        verb: 'gain_influence',
                        onlyPure: true,
                        per: ['farmers_guild', 'miners_guild', 'engineers_guild']
                    }
                ]
            },
            {
                name: 'Optimize',
                cost: {
                    food: 1,
                    energy: 1
                },
                action: ['remove_corruption', 'regroup']
            }
        ]
    },
    {
        name: 'Progress',
        effects: [
            {
                name: 'Experiment',
                action: {
                    either_or: [
                        {
                            verb: 'produce',
                            obj: 'science'
                        },
                        {
                            verb: 'establish',
                            type: 'scientists_guild'
                        }
                    ]
                }
            },
            {
                name: 'Invent',
                cost: {
                    science: 2
                },
                action: 'gain_tech'
            },
            {
                name: 'Restore',
                cost: {
                    recall: 1
                },
                action: [
                    {
                        verb: 'remove_corruption',
                        restriction: 'same_sector'
                    },
                    'regroup'
                ]
            }
        ]
    },
    {
        name: 'Prosperity',
        effects: [
            {
                name: 'Flourish',
                cost: {
                    materials: 1
                },
                action: {
                    verb: 'advance_track',
                    obj: 'economy'
                }
            },
            {
                name: 'Store',
                action: ['produce', {
                    verb: 'gain_resource',
                    num: 2
                }]
            },
            {
                name: 'Organize',
                cost: {
                    deactivate: 1,
                    materials: 1,
                    energy: 1
                },
                action: ['gain_agenda', 'build']
            }
        ]
    },
    {
        name: 'Reinforcement',
        effects: [
            {
                name: 'Accelerate',
                cost: {
                    deactivate: 1
                },
                action: ['advance_track', {
                    verb: 'build',
                    type: 'defense'
                }]
            },
            {
                name: 'Muster',
                cost: {
                    materials: 2
                },
                action: {
                    verb: 'deploy',
                    deploy_per: 'shipyard',
                    // Do I need to do shipyards per sector?
                }
            },
            {
                name: 'Mobilize',
                cost: {
                    energy: 1
                },
                action: ['regroup', {
                    verb: 'build',
                    type: 'defense'
                }]
            }
        ]
    },
    {
        name: 'Temptation',
        effects: [
            {
                name: 'Exploit',
                action: 'preferred_action'
            },
            {
                name: 'Conspire',
                cost: {
                    gain_corruption: 1
                },
                action: ['advance_track', {
                    verb: 'peek',
                    num: 2
                }]
            },
            {
                name: 'Exert',
                cost: {
                    gain_corruption: 1
                },
                action: [
                    {
                        verb: 'activate',
                        num: 1
                    },
                    {
                        verb: 'deploy',
                        num: 1,
                        place: 'home'
                    },
                    {
                        verb: 'produce',
                        num: 2,
                        restriction: 'different'
                    }
                ]
            }
        ]
    }
]

export let special_focus = {
    Astoran_Conquest: {
        name: 'Conquest',
        effects: [
            {
                name: 'Besiege',
                cost: {
                    energy: 3
                },
                action: ['invade', 'build']
            },
            {
                name: 'Harvest',
                cost: {
                    credits: 1
                },
                action: [
                    {
                        verb: 'gain_resource',
                        type: 'food',
                        num: 1,
                        per: 'sector',
                        restriction: 'pure'
                    },
                    'move_corruption'
                ]
            },
            {
                name: 'Sustain',
                cost: {
                    science: 1
                },
                action: {
                    verb: 'gain_resource',
                    types: {
                        credits: 1,
                        influence: 1
                    },
                    per: 'sector',
                    restriction: 'pure',
                    filter: 'installations'
                },
            }
        ]
    },
    Astoran_Prosperity: {
        name: 'Prosperity',
        effects: [
            {
                name: 'Bolster',
                cost: {
                    food: 1,
                    recall: 1
                },
                action: [
                    'build',
                    {
                        verb: 'advance_track',
                        obj: 'economy'
                    }
                ]
            },
            {
                name: 'Regulate',
                cost: {
                    recall: 1
                },
                action: {
                    either_or: [
                        {
                            verb: 'gain_agenda',
                            type: 'might'
                        },
                        {
                            verb: 'gain_agenda',
                            type: 'wealth'
                        }
                    ]
                }
            },
            {
                name: 'Reconstruct',
                cost: {
                    unbuild: 1
                },
                action: [
                    {
                        verb: 'establish',
                        restriction: 'same_sector'
                    },
                    'remove_corruption'
                ]
            }
        ]
    },
    Fenrax_Development: {
        name: 'Development',
        effects: [
            {
                name: 'Settle',
                cost: {
                    materials: 1,
                    credits: 1
                },
                action: [
                    {
                        verb: 'establish',
                        restriction: 'same_sector'
                    },
                    {
                        verb: 'build',
                        restriction: 'same_sector'
                    },
                ]
            },
            {
                name: 'Colonize',
                cost: {
                    materials: 1,
                    population: 1
                },
                action: [
                    {
                        verb: 'establish',
                        restriction: 'noncost_sector'
                    },
                    {
                        verb: 'establish',
                        restriction: 'noncost_sector'
                    },
                ]
            },
            {
                name: 'Recruit',
                cost: {
                    food: 1,
                    science: 1
                },
                action: [
                    {
                        verb: 'deploy',
                        restriction: 'same_sector'
                    },
                    {
                        verb: 'increase_population',
                        restriction: 'same_sector'
                    }
                ]
            }
        ]
    },
    Fenrax_Reinforcement: {
        name: 'Dispersal', // NB the key gives the name of the card it replaces, should work
        effects: [
            {
                name: 'Resume',
                cost: {
                    science: 1,
                    unbuild: 1
                },
                action: [
                    {
                        verb: 'build',
                        restriction: 'noncost_sector'
                    },
                    'remove_corruption'
                ]
            },
            {
                name: 'Muster',
                cost: {
                    materials: 1,
                    credits: 1
                },
                action: {
                    verb: 'deploy',
                    deploy_per: 'shipyard'
                }
            },
            {
                name: 'Spread',
                cost: {
                    energy: 1,
                    population: 1
                },
                action: [
                    {
                        verb: 'increase_population',
                        restriction: 'different_sector'
                    },
                    {
                        verb: 'increase_population',
                        restriction: 'different_sector'
                    },
                ]
            }
        ]
    },
    Kradmor_Temptation: {
        name: 'Temptation',
        effects: [
            {
                name: 'Overcome',
                cost: {
                    credits: 1,
                    science: 1
                },
                action: ['increase_population', 'preferred_action']
            },
            {
                name: 'Foresee',
                action: [
                    {
                        verb: 'advance_track',
                        lowest: true
                    },
                    {
                        verb: 'peek',
                        num: 2
                    }
                ]
            },
            {
                name: 'Exert',
                cost: {
                    gain_corruption: 1
                },
                action: ['activate', 
                {
                    verb: 'deploy',
                    place: 'home'
                }
                , 'produce']
            }
        ]
    },
    Kradmor_Production: {
        name: 'Production',
        effects: [
            {
                name: 'Thrust',
                cost: {
                    food: 1,
                    materials: 1 
                },
                action: [
                    'remove_corruption',
                    {
                        verb: 'produce',
                        obj: 'energy'
                    }
                ]
            },
            {
                name: 'Amplify',
                action: {
                    either_or: [
                        {
                            verb: 'produce',
                            obj: ['food', 'materials']
                        },
                        {
                            verb: 'advance_track',
                            obj: 'economy'
                        }
                    ]
                }
            },
            {
                name: 'Burgeon',
                cost: {
                    gain_corruption: 1,
                    energy: 1
                },
                action: [
                    'establish',
                    {
                        verb: 'advance_track',
                        obj: 'society'
                    }
                ]
            }
        ]
    },
    Marqualos_Innovation: {
        name: 'Scheme',
        effects: [
            {
                name: 'Obtain',
                cost: {
                    credits: 1,
                    science: 1
                },
                action: 'gain_tech'
            },
            {
                name: 'Transfer',
                cost: {
                    agenda: 1
                },
                action: [
                    'gain_trade',
                    {
                        verb: 'produce',
                        num: 2,
                        restriction: 'different'
                    }
                ]
            },
            {
                name: 'Direct',
                cost: {
                    recall: 1
                },
                action: ['gain_agenda', 'gain_bounty']
            }
        ]
    },
    Nervo_Production: {
        name: 'Production',
        effects: [
            {
                name: 'Industrialize',
                action: [
                    {
                        verb: 'advance_track',
                        obj: 'economy'
                    },
                    {
                        verb: 'produce',
                        obj: 'materials'
                    }
                ]
            },
            {
                name: 'Mechanize',
                cost: {
                    materials: 2
                },
                action: [
                    {
                        verb: 'advance_track',
                        obj: 'statecraft'
                    },
                    {
                        verb: 'produce',
                        obj: ['food', 'energy']
                    }
                ]
            },
            {
                name: 'Thrive',
                cost: {
                    materials: 1
                },
                action: {
                    verb: 'advance_track',
                    obj: 'society'
                },
            }
        ]
    },
    Nervo_Conquest: {
        name: 'Uplift',
        effects: [
            {
                name: 'Bombard',
                cost: {
                    energy: 2
                },
                action: {
                    verb: 'invade',
                    mods: {
                        bombard: true
                    }
                }
            },
            {
                name: 'Analyze',
                cost: {
                    credits: 1
                },
                action: 'gain_agenda'
            },
            {
                name: 'Regenerate',
                cost: {
                    science: 1
                },
                action: [
                    'remove_corruption',
                    {
                        verb: 'produce',
                        obj: 'credits'
                    }
                ]
            }
        ]
    },
    Novaris_Progress: {
        name: 'Progress',
        effects: [
            {
                name: 'Embrace',
                cost: {
                    gain_corruption: 1
                },
                action: 'gain_tech'
            },
            {
                name: 'Experiment',
                cost: {
                    gain_corruption: 1
                },
                action: 'gain_agenda'
            },
            {
                name: 'Ambush',
                cost: {
                    energy: 2,
                    science: 1
                },
                action: [
                    'regroup',
                    {
                        verb: 'invade',
                        corruptedSector: true
                    }
                ]
            }
        ]
    },
    Novaris_Reinforcement: {
        name: 'Reinforcement',
        effects: [
            {
                name: 'Adapt',
                cost: {
                    food: 1,
                    energy: 1,
                    materials: 1
                },
                action: [
                    'activate',
                    {
                        verb: 'remove_corruption',
                        restriction: 'house_mat'
                    }
                ]
            },
            {
                name: 'Muster',
                cost: {
                    energy: 1,
                    materials: 1
                },
                action: {
                    verb: 'deploy',
                    deploy_per: 'shipyard'
                }
            },
            {
                name: 'Accelerate',
                cost: {
                    energy: 1,
                    materials: 1
                },
                action: ['advance_track', 'regroup']
            }
        ]
    },
    Shiveus_Temptation: {
        name: 'Crusade',
        effects: [
            {
                name: 'Indoctrinate',
                cost: {
                    food: 1,
                    energy: 1,
                    materials: 1
                },
                action: [
                    {
                        verb: 'deploy',
                        deploy_per: 'shipyard'
                    },
                    'increase_population'
                ]
            },
            {
                name: 'Exterminate',
                cost: {
                    energy: 1,
                    credits: 1
                },
                action: {
                    verb: 'invade',
                    corruptedSector: true,
                    scorePerCasualty: 2
                }
            },
            {
                name: 'Enlighten',
                cost: {
                    science: 2,
                    recall: 1
                },
                action: [
                    {
                        verb: 'remove_corruption',
                        restriction: 'same_sector'
                    },
                    'advance_track'
                ]
            }
        ]
    },
    Shiveus_Politics: {
        name: 'Politics',
        effects: [
            {
                name: 'Exalt',
                cost: {
                    food: 2
                },
                action: [
                    {
                        verb: 'advance_track',
                        obj: 'statecraft'
                    },
                    'upgrade_glory'
                ]
            },
            {
                name: 'Retaliate',
                cost: {
                    energy: 2
                },
                action: {
                    verb: 'invade',
                    corruptedSector: true
                }
            },
            {
                name: 'Wield',
                cost: {
                    gain_corruption: 1
                },
                action: ['gain_trade', 'produce']
            }
        ]
    },
    Thegwyn_Production: {
        name: 'Production',
        effects: [
            {
                name: 'Thrive',
                action: {
                    verb: 'advance_track',
                    obj: 'society'
                }
            },
            {
                name: 'Ascend',
                cost: {
                    food: 1,
                    materials: 1
                },
                action: {
                    either_or: [
                        'remove_corruption',
                        {
                            verb: 'advance_track',
                            obj: 'statecraft'
                        }
                    ]
                }
            },
            {
                name: 'Accumulate',
                action: {
                    verb: 'produce',
                    obj: ['food', 'energy', 'materials', 'science']
                }
            }
        ]
    },
    Yarvek_Conquest: {
        name: 'Conquest',
        effects: [
            {
                name: 'Engage',
                cost: {
                    energy: 2
                },
                action: {
                    either_or: ['invade', 'regroup']
                }
            },
            {
                name: 'Rally',
                cost: {
                    bounty: 1,
                    credits: 1
                },
                action: 'gain_agenda'
            },
            {
                name: 'Recycle',
                cost: {
                    reclaim: 1,
                    materials: 2
                },
                action: [
                    {
                        either_or: [
                            {
                                verb: 'remove_corruption',
                                restriction: 'sectors' 
                            },
                            'activate'
                        ]
                    },
                    {
                        either_or: [
                            {
                                verb: 'remove_corruption',
                                restriction: 'sectors' 
                            },
                            'activate'
                        ]
                    }
                ]
            }
        ]
    },
    Yarvek_Innovation: {
        name: 'Raid',
        effects: [
            {
                name: 'Liberate',
                cost: {
                    energy: 2
                },
                action: {
                    verb: 'invade',
                    scorePerPopulation: 1
                }
            },
            {
                name: 'Consult',
                cost: {
                    bounty: 1,
                    science: 1
                },
                action: {
                    verb: 'gain_tech',
                    type: 'basic'
                }
            },
            {
                name: 'Bargain',
                cost: {
                    gain_corruption: 1,
                    credits: 1
                },
                action: ['gain_bounty', 'gain_trade']
            }
        ]
    },
    Zenor_Conquest: {
        name: 'Conquest',
        effects: [
            {
                name: 'Engage',
                cost: {
                    energy: 2
                },
                action: {
                    either_or: ['invade', 'regroup']
                }
            },
            {
                name: 'Invest',
                cost: {
                    credits: 3
                },
                action: ['gain_agenda', 'gain_trade']
            },
            {
                name: 'Experiment',
                cost: {
                    science: 1
                },
                action: [
                    {
                        verb: 'produce',
                        obj: 'science'
                    }, 
                    {
                        verb: 'gain_tech',
                        type: 'basic'
                    }
                ]
            }
        ]
    },
    Zenor_Politics: {
        name: 'Politics',
        effects: [
            {
                name: 'Inspire',
                cost: {
                    science: 2
                },
                action: {
                    verb: 'advance_track',
                    obj: 'statecraft'
                }
            },
            {
                name: 'Divide',
                cost: {
                    energy: 1,
                    materials: 1,
                    science: 1
                },
                action: ['activate', 'invade']
            },
            {
                name: 'Replicate',
                cost: {
                    energy: 1,
                    science: 1
                },
                action: ['move_corruption', 'increase_population']
            }
        ]
    }
}

for(let k of Object.keys(special_focus)){
    special_focus[k].id = `focus_replacements.${k.split('_')[0]}_${special_focus[k].name}`;
    ol(special_focus[k]);
}


/*
{
        name: 'Conquest',
        effects: [
            {
                name: 'Engage',
                cost: {
                    energy: 2
                },
                action: {
                    either_or: ['invade', 'regroup']
                }
            },
            {
                name: 'Strategize',
                cost: {
                    energy: 1,
                    credits: 1
                },
                action: ['gain_agenda', 'move_corruption']
            },
            {
                name: 'Prepare',
                cost: {
                    materials: 3
                },
                action: [
                    {
                        verb: 'activate',
                        num: 2
                    }
                ]
            }
        ]
    },
*/
export let heroic_focus = [
    {
        name: 'Conquest',
        effects: [
            {
                name: 'Annihilate',
                cost: {
                    food: 1,
                    energy: 2
                },
                action: [
                    'invade',
                    {
                        verb: 'remove_corruption',
                        restriction: 'same_sector',
                        abandonIfNotPossible: true
                    }
                ]
            },
            {
                name: 'Strategize',
                cost: {
                    energy: 1,
                    credits: 1
                },
                action: ['regroup', 'gain_agenda']
            },
            {
                name: 'Prepare',
                cost: {
                    recall: 1
                },
                action: [
                    {
                        verb: 'activate',
                        num: 2
                    },
                    'upgrade_glory'
                ]
            }
        ]
    },
    {
        name: 'Development',
        effects: [
            {
                name: 'Bloom',
                cost: {
                    materials: 2
                },
                action: [
                    {
                        verb: 'establish',
                        restriction: 'same_sector'
                    },
                    {
                        verb: 'increase_population',
                        restriction: 'same_sector'
                    }
                ]
            },
            {
                name: 'Grow',
                cost: {
                    any: 3
                },
                action: ['establish', {
                    verb: 'gain_resource',
                    num: 4
                }]
            },
            {
                name: 'Harmonize',
                cost: {
                    science: 1
                },
                action: [
                    {
                        verb: 'remove_corruption',
                        restriction: 'same_sector'
                    },
                    {
                        verb: 'build',
                        restriction: 'same_sector'
                    }
                ]
            }
        ]
    },
    {
        name: 'Innovation',
        // Should already be unplayable cycle one because of the match rule
        effects: [
            {
                name: 'Research',
                cost: {
                    any: 4
                },
                action: [
                    {
                        verb: 'gain_tech',
                        type: 'basic'
                    },
                    {
                        verb: 'produce',
                        obj: ['science', 'credits']
                    }
                ]
            },
            {
                name: 'Experiment',
                action: [
                    {
                        verb: 'gain_tech',
                        type: 'improved'
                    },
                    {
                        verb: 'return_token',
                        type: 'voidborn',
                        place: 'voidborn',
                        restriction: 'adjacent'
                    }
                ]
            },
            {
                name: 'Consolidate',
                cost: {
                    any: 2
                },
                action: ['gain_agenda', 'discard_crisis']
            }
        ]
    },
    {
        name: 'Leadership',
        effects: [
            {
                name: 'Rise',
                cost: {
                    any: 4
                },
                action: {
                    either_or: [
                        'safe_haven', 
                        {
                            verb: 'gain_influence',
                            per: 'total_glory'
                        }
                    ]
                }
            },
            {
                name: 'Utilize',
                cost: {
                    glory: 1
                },
                action: ['remove_corruption', 'preferred_action']
            },
            {
                name: 'Repel',
                cost: {
                    any: 1
                },
                action: {
                    either_or: [
                        {
                            verb: 'return_token',
                            type: 'harbinger'
                        },
                        {
                            verb: 'discard_crisis'
                        }
                    ]
                }
            }
        ]
    },
    {
        name: 'Politics',
        effects: [
            {
                name: 'Inspire',
                cost: {
                    credits: 2,
                    science: 1
                },
                action: [
                    {
                        verb: 'advance_track',
                        obj: 'statecraft'
                    },
                    'gain_trade'
                ]
            },
            {
                name: 'Prevail',
                cost: {
                    energy: 2,
                    science: 1
                },
                action: [
                    {
                        verb: 'return_token',
                        type: 'voidborn',
                        place: 'voidborn',
                        restriction: 'adjacent'
                    },
                    'invade'
                ]
            },
            {
                name: 'Overthrow',
                cost: {
                    unbuild: 1
                },
                action: [
                    {
                        verb: 'remove_corruption',
                        restriction: 'sectors'
                    },
                    {
                        verb: 'return_token',
                        type: 'harbinger'
                    }
                ]
            }
        ]
    },
    {
        name: 'Production',
        effects: [
            {
                name: 'Thrive',
                cost: {
                    trade: 1
                },
                action: [
                    {
                        verb: 'gain_influence',
                        num: 3,
                        per: 'guild',
                        restriction: 'pure'
                    },
                    {
                        verb: 'return_token',
                        type: 'harbinger'
                    }
                ]
            },
            {
                name: 'Supply',
                action: {
                    either_or: [
                        {
                            verb: 'produce',
                            obj: ['food', 'energy', 'materials']
                        },
                        ['increase_population', 'increase_population']
                    ]
                }
            },
            {
                name: 'Optimize',
                cost: {
                    recall: 1
                },
                action: [
                    'remove_corruption',
                    {
                        verb: 'advance_track',
                        obj: 'society'
                    }
                ]
            }
        ]
    },
    {
        name: 'Progress',
        effects: [
            {
                name: 'Experiment',
                action: [
                    {
                        verb: 'establish',
                        type: 'scientists_guild'
                    },
                    {
                        verb: 'produce',
                        obj: 'science'
                    }
                ]
            },
            {
                name: 'Invent',
                cost: {
                    food: 1,
                    deactivate: 1
                },
                action: ['gain_tech', 'remove_corruption']
            },
            {
                name: 'Restore',
                cost: {
                    glory: 1
                },
                action: ['deploy', 'regroup', 
                    {
                        verb: 'discard_crisis',
                        type: ['general', 'economic']
                    }
                ]
            }
        ]
    },
    {
        name: 'Prosperity',
        effects: [
            {
                name: 'Flourish',
                cost: {
                    any: 2
                },
                action: [
                    {
                        verb: 'advance_track',
                        obj: 'economy'
                    },
                    {
                        verb: 'gain_resource',
                        num: 4
                    }
                ]
            },
            {
                name: 'Revolt',
                cost: {
                    unguild: 1
                },
                action: [
                    'gain_trade',
                    {
                        verb: 'return_token',
                        type: 'harbinger'
                    }
                ]
            },
            {
                name: 'Organize',
                action: {
                    either_or: ['gain_agenda', 'build']
                }
            }
        ]
    },
    {
        name: 'Reinforcement',
        effects: [
            {
                name: 'Accelerate',
                cost: {
                    any: 4
                },
                action: [
                    'regroup',
                    {
                        verb: 'gain_resource',
                        num: 4
                    },
                    {
                        verb: 'advance_track',
                        lowest: true
                    }
                ]
            },
            {
                name: 'Muster',
                cost: {
                    materials: 4
                },
                action: [
                    'activate',
                    {
                        verb: 'deploy',
                        deploy_per: 'shipyard'
                    }
                ]
            },
            {
                name: 'Withstand',
                cost: {
                    gain_corruption: 1
                },
                action: {
                    either_or: [
                        ['build', 'build'],
                        {
                            verb: 'discard_crisis',
                            type: ['general', 'military']
                        }
                    ]
                }
            }
        ]
    },
    {
        name: 'Temptation',
        effects: [
            {
                name: 'Exploit',
                cost: {
                    any: 4
                },
                action: [
                    'preferred_action',
                    {
                        verb: 'gain_resource',
                        num: 4
                    }
                ]
            },
            {
                name: 'Commit',
                cost: {
                    track_corruption: 1
                },
                action: [
                    {
                        verb: 'advance_track',
                        restriction: 'corrupted_track'
                    },
                    {
                        verb: 'advance_track',
                    }
                ]
            },
            {
                name: 'Exert',
                cost: {
                    agenda: 1
                },
                action: [
                    'activate',
                    {
                        verb: 'deploy',
                        place: 'home'
                    },
                    {
                        verb: 'produce',
                        num: 2,
                        restriction: 'different'
                    }
                ]
            },
        ]
    },
]

for(let h of heroic_focus){
    h.type = 'heroic';
    h.special_focus = true;
    h.id = `focus_heroic.${h.name}`;
    h.matches = h.name;
    h.name = `Heroic ${h.name}`;
    ol(h);
}

export let joint_focus = [];

export let basic_focus = {};

for(let c of playerColours){
    let set = jsonpatch.deepClone(focus_template);
    for(let f of set){
        f.id = `focus_${c}.${f.name}`;
        f.neutralID = `focus.${f.name}`;
        ol(f);
    }
    basic_focus[c] = set;
}

export function isPreferred(p, f){
    if(!f) return false;
    if(f.lo) f = lo(f);
    return house(p).preferred.includes(f.matches || f.name);
}