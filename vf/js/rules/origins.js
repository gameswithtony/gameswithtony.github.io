// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import {guildMaker, resMaker, yields } from './resources.js'

export let originCards = [
    {
        house: 'Valnis',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [3, 2],
            materials: [2, 2],
            credits: [0, 3],
            science: [0, 2]
        },
        active_fleet: 2,
        tech: 'Shields',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_2']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Valnis',
        side: 'B',
        resources: {
            food: [3, 5],
            energy: [2, 3],
            materials: [2, 3],
            credits: [0, 4],
            science: [0, 5]
        },
        active_fleet: 3,
        loose_trade: 1,
        track_advance: ['society'],
        tech: 'Escape Pods',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Belitan',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [3, 4],
            materials: [2, 2],
            credits: [0, 3],
            science: [0, 2]
        },
        active_fleet: 2,
        tech: 'Targeting',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_2']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Belitan',
        side: 'B',
        resources: {
            food: [3, 5],
            energy: [2, 3],
            materials: [2, 3],
            credits: [1, 5],
            science: [0, 5]
        },
        active_fleet: 2,
        track_advance: ['society'],
        tech: 'Data Refinery',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Cortozaar',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [3, 2],
            materials: [2, 4],
            credits: [0, 3],
            science: [0, 2]
        },
        active_fleet: 2,
        tech: 'Torpedoes',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_2']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Cortozaar',
        side: 'B',
        resources: {
            food: [2, 5],
            energy: [3, 3],
            materials: [3, 3],
            credits: [0, 4],
            science: [0, 4]
        },
        active_fleet: 2,
        tech: 'Starbases',
        track_advance: ['society'],
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 3,
            installations: ['starbase'],
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Dunlork',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [2, 2],
            materials: [3, 2],
            credits: [0, 3],
            science: [0, 2]
        },
        active_fleet: 4,
        tech: 'Orbital Docks',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Dunlork',
        side: 'B',
        resources: {
            food: [3, 5],
            energy: [2, 1],
            materials: [2, 3],
            credits: [0, 4],
            science: [0, 4]
        },
        active_fleet: 5,
        tech: 'Energy Cells',
        track_advance: ['society', 'statecraft'],
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 2,
            guilds: ['energy', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Astoran',
        side: 'A',
        resources: {
            food: [0, 4],
            energy: [3, 4],
            materials: [1, 2],
            credits: [0, 3],
            science: [0, 2]
        },
        active_fleet: 3,
        tech: 'Deep Space Missiles',
        home: {
            population: 3,
            installations: ['shipyard'],
            guilds: ['energy'],
            fleets: ['corvette_1']
        },
        outpost: {
            population: 2,
            installations: ['shipyard'],
            fleets: ['corvette_2']
        },
    },
    {
        house: 'Astoran',
        side: 'B',
        resources: {
            food: [1, 5],
            energy: [2, 3],
            materials: [3, 3],
            credits: [0, 3],
            science: [0, 3]
        },
        active_fleet: 1,
        tech: 'Sentries',
        home: {
            population: 3,
            installations: ['shipyard'],
            guilds: ['materials'],
            fleets: ['corvette_2'],
        },
        outpost: {
            population: 2,
            installations: ['defense'],
            guilds: ['energy'],
            fleets: ['corvette_1', 'sentry_1']
        }
    },
    {
        house: 'Zenor',
        side: 'A',
        resources: {
            food: [0, 5],
            energy: [0, 3],
            materials: [2, 3],
            credits: [0, 3],
            science: [0, 3]
        },
        active_fleet: 1,
        tech: 'Destroyers',
        track_advance: ['economy'],
        home: {
            population: 2,
            installations: ['shipyard'],
            fleets: ['destroyer_1', 'corvette_3'],
        },
        outpost: {
            corrupted: true,
            population: 2,
            guilds: ['materials'],
            fleets: ['corvette_1']
        }
    },
    {
        house: 'Zenor',
        side: 'B',
        resources: {
            food: [1, 5],
            energy: [0, 3],
            materials: [2, 3],
            credits: [0, 3],
            science: [2, 3]
        },
        active_fleet: 4,
        tech: 'Cloning',
        track_advance: ['society'],
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['materials', 'science'],
            fleets: ['corvette_2'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: [],
            fleets: ['corvette_1']
        }
    },
    {
        house: 'Thegwyn',
        side: 'A',
        resources: {
            food: [4, 4],
            energy: [2, 2],
            materials: [0, 4],
            credits: [0, 3],
            science: [2, 3]
        },
        tech: 'Terraforming',
        active_fleet: 4,
        home: {
            population: 2,
            installations: [],
            guilds: ['food', 'energy'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            corrupted: true,
            guilds: ['food', 'science'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Thegwyn',
        side: 'B',
        tech: 'Neural Matrix',
        resources: {
            food: [2, 5],
            energy: [1, 3],
            materials: [1, 3],
            credits: [2, 3],
            science: [2, 3]
        },
        active_fleet: 2,
        agenda: ['might'],
        home: {
            population: 2,
            installations: [],
            guilds: ['food', 'credits'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['science'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Shiveus',
        side: 'A',
        tech: 'Dreadnoughts',
        resources: {
            food: [0, 4],
            energy: [2, 2],
            materials: [2, 2],
            credits: [0, 3],
            science: [2, 2]
        },
        active_fleet: 2,
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['energy', 'science'],
            fleets: ['corvette_1', 'dreadnought_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Shiveus',
        side: 'B',
        tech: 'Decontamination Chambers',
        resources: {
            food: [2, 5],
            energy: [2, 3],
            materials: [0, 3],
            credits: [0, 3],
            science: [2, 3]
        },
        active_fleet: 2,
        agenda: ['support'],
        starting_action: 'move_corruption',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['energy', 'science'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['food'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Yarvek',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [2, 2],
            materials: [0, 2],
            credits: [0, 2],
            science: [0, 3]
        },
        tech: 'Hyperdrive',
        active_fleet: 4,
        track_advance: ['statecraft'],
        bounty: 3,
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['energy'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['food'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Yarvek',
        side: 'B',
        resources: {
            food: [0, 5],
            energy: [2, 3],
            materials: [3, 3],
            credits: [0, 3],
            science: [0, 3]
        },
        tech: 'Tactical Transports',
        active_fleet: 1,
        track_advance: ['economy'],
        bounty: 1,
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['energy'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: ['materials'],
            fleets: ['corvette_3']
        }
    },
    {
        house: 'Nervo',
        side: 'A',
        resources: {
            food: [0, 4],
            energy: [0, 2],
            materials: [4, 4],
            credits: [0, 5],
            science: [0, 2]
        },
        tech: 'Robotics',
        active_fleet: 3,
        track_advance: ['economy'],
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['materials'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Nervo',
        side: 'B',
        resources: {
            food: [2, 5],
            energy: [0, 3],
            materials: [5, 3],
            credits: [0, 3],
            science: [0, 3]
        },
        tech: 'Ark Ships',
        active_fleet: 2,
        agenda: ['wealth'],
        home: {
            population: 3,
            installations: ['shipyard'],
            guilds: ['materials'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['food', 'materials'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Fenrax',
        side: 'A',
        resources: {
            food: [0, 4],
            energy: [3, 2],
            materials: [2, 2],
            credits: [1, 4],
            science: [0, 2]
        },
        tech: 'Carriers',
        active_fleet: 3,
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['materials'],
            fleets: ['corvette_1', 'carrier_1'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: ['energy'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Fenrax',
        side: 'B',
        resources: {
            food: [0, 5],
            energy: [3, 3],
            materials: [2, 3],
            credits: [0, 4],
            science: [0, 3]
        },
        tech: 'Central Surveillance',
        active_fleet: 2,
        agenda: ['support'],
        starting_action: 'upgrade_glory',
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['materials'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: ['energy'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Kradmor',
        side: 'A',
        resources: {
            food: [2, 4],
            energy: [0, 2],
            materials: [0, 2],
            credits: [1, 3],
            science: [1, 2]
        },
        tech: 'Salvage Scanner',
        active_fleet: 4,
        track_advance: ['statecraft'],
        home: {
            population: 1,
            installations: ['shipyard'],
            guilds: ['credits', 'science'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['food'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Kradmor',
        side: 'B',
        resources: {
            food: [2, 5],
            energy: [0, 5],
            materials: [0, 3],
            credits: [2, 3],
            science: [0, 3]
        },
        tech: 'Purifier',
        active_fleet: 2,
        agenda: ['dominance'],
        track_advance: ['economy'],
        loose_trade: 1,
        starting_action: 'remove_corruption',
        home: {
            population: 1,
            installations: ['shipyard'],
            guilds: [],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['food', 'credits'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Marqualos',
        side: 'A',
        resources: {
            food: [2, 3],
            energy: [2, 2],
            materials: [1, 2],
            credits: [2, 3],
            science: [0, 3]
        },
        tech: 'Autonomous Drones',
        active_fleet: 2,
        track_advance: ['economy'],
        bounty: 1,
        loose_trade: 2,
        home: {
            population: 2,
            installations: ['shipyard'],
            guilds: ['credits', 'food'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            installations: [],
            guilds: ['energy'],
            fleets: ['corvette_3']
        }
    },
    {
        house: 'Marqualos',
        side: 'B',
        resources: {
            food: [1, 7],
            energy: [2, 3],
            materials: [1, 3],
            credits: [1, 3],
            science: [0, 4]
        },
        tech: 'Trade Nexus',
        active_fleet: 2,
        bounty: 1,
        loose_trade: 1,
        home: {
            population: 1,
            installations: ['shipyard'],
            guilds: ['credits', 'materials'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 2,
            corrupted: true,
            installations: [],
            guilds: ['energy'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Novaris',
        side: 'A',
        resources: {
            food: [0, 4],
            energy: [0, 2],
            materials: [0, 2],
            credits: [3, 3],
            science: [3, 2]
        },
        tech: 'Combat Replicators',
        active_fleet: 4,
        home: {
            population: 2,
            installations: ['shipyard', 'shipyard'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: ['credits', 'science'],
            fleets: ['corvette_2']
        }
    },
    {
        house: 'Novaris',
        side: 'B',
        resources: {
            food: [2, 7],
            energy: [3, 3],
            materials: [0, 3],
            credits: [0, 5],
            science: [3, 5]
        },
        tech: 'Cybernetics',
        active_fleet: 2,
        home: {
            population: 2,
            installations: ['shipyard', 'shipyard'],
            corrupted: true,
            guilds: ['food'],
            fleets: ['corvette_1'],
        },
        outpost: {
            population: 3,
            installations: [],
            guilds: ['energy', 'science'],
            fleets: ['corvette_2']
        }
    },
]


for(let o of originCards){
    let basicLevels = {};
    for(let k of ['home', 'outpost']){
        if(o[k].guilds){
            for(let i = 0; i < o[k].guilds.length; i++){
                let g = o[k].guilds[i];
                if(!basicLevels[g]) basicLevels[g] = 0;
                basicLevels[g] += o[k].population;
                if(guildMaker[o[k].guilds[i]]) o[k].guilds[i] = guildMaker[o[k].guilds[i]]; // convert to real names
            }
        }
        if(o[k].fleets){
            let newFleet = [];
            for(let f of o[k].fleets){
                let [type, num] = f.split('_');
                num = parseInt(num);
                if(!num) num = 1;
                newFleet.push({
                    type,
                    num
                });
            }
            o[k].fleets = newFleet;
        }
    }
    o.boosts = {};
    for(let k of Object.keys(o.resources)){
        o.resources[k] = {
            level: o.resources[k][0],
            yield: yields[k][o.resources[k][0]],
            store: o.resources[k][1]
        }
        if(!basicLevels[k]) basicLevels[k] = 0;
        if(basicLevels[k] != o.resources[k].level){
            o.boosts[k] = o.resources[k].level - basicLevels[k]; 
            //if(o.boosts[k] < 0 || o.boosts[k] > 2) alert(`Probable bug with ${o.house} ${o.side}: ${k} boost is ${o.boosts[k]}`);
        }
    }
    o.id = `origins.${o.house}_${o.side}`;
}