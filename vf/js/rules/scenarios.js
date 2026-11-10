// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { sectorTypes } from "./sectors.js"
import * as jsonpatch from './runtime.js';

export function getScenarios(mode, numPlayers, topComplexity = Infinity){
    let modes = {
        'Co-op': 'coop',
        'Competitive': 'comp',
        'Tutorial': 'tutorial'
    }
    if(modes[mode]) mode = modes[mode];
    let s = scenarios.filter(s => s.type == mode && numPlayers == s.players && (!s.complexity || s.complexity <= topComplexity));
    if(mode == 'coop'){
        s.unshift(scenarios.find(s => s.type == 'tutorial' && numPlayers == s.players))
    }
    return s;
}

export let scenarios = [
    {
        type: 'tutorial',
        players: 1,
        name: 'Tutorial',
        complexity: 1,
        events: {
            cycle_1: ['1T'],
            cycle_2: ['2T'],
            cycle_3: ['3T']
        },
        fixedHouses: ['Valnis', 'Belitan', 'Cortozaar', 'Dunlork'],
        fixedSide: 'A',
        sectors: [
            {
                ...sectorTypes.basic,
                special: 'outpost',
                column: 0,
                row: 1,
            },
            {
                ...sectorTypes.home,
                column: 1,
                row: 0
            },

            {
                ...sectorTypes.basic,
                column: 1,
                row: 1,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 1
                    }
                ],
                population: 2,
                corrupted: true,
                glory: [1]
            },
            {
                ...sectorTypes.basic,
                column: 2,
                row: 0,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 1
                    }
                ],
                population: 4,
                corrupted: true,
                reclaim: 1,
                installations: ['defense'],
                glory: [3]
            },
            {
                ...sectorTypes.basic,
                column: 2,
                row: 1,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 2
                    }
                ],
                population: 3,
                corrupted: true,
                bounty: 1,
                glory: [2]
            },
            {
                ...sectorTypes.basic,
                column: 3,
                row: 0,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 2
                    }
                ],
                population: 4,
                corrupted: true,
                reclaim: 2,
                installations: ['defense'],
                glory: [4]
            }
        ],
        voidstorms: [
            [
                '2-0',
                '3-0'
            ]
        ],
        specific_techs: [
            'Autonomous Drones', 'Deep Space Missiles', 'Dreadnoughts', 'Trade Nexus', 
            'Neural Matrix', 'Decontamination Chambers', 'Sentries', 'Terraforming'
        ]
    },
    {
        type: 'coop', // or solo?
        players: 1,
        name: 'First Stand',
        complexity: 1, 
        sectors: [
            {
                ...sectorTypes.basic,
                column: 0,
                row: 1,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 1
                    }
                ],
                population: 2,
                corrupted: true,
                glory: [1],
                voidstorm: [1]
            },
            {
                ...sectorTypes.basic,
                special: 'outpost',
                column: 0,
                row: 2
            },
            {
                ...sectorTypes.home,
                column: 0,
                row: 3
            },
            {
                ...sectorTypes.basic,
                installations: ['defense'],
                column: 1,
                row: 0,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 3
                    }
                ],
                population: 4,
                corrupted: true,
                glory: [4],
                harbinger: true,
                reclaim: 2,
                voidstorm: [2]
            },
            {
                ...sectorTypes.basic,
                column: 1,
                row: 1,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 2
                    }
                ],
                population: 3,
                corrupted: true,
                glory: [2],
                harbinger: true,
                bounty: 1,
                voidstorm: [1]
            },
            {
                ...sectorTypes.basic,
                column: 1,
                row: 2,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 2
                    }
                ],
                population: 3,
                corrupted: true,
                glory: [2],
                harbinger: true,
                bounty: 1
            },
            {
                ...sectorTypes.rift,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 3
                    }
                ],
                column: 2,
                row: 0
            },
            {
                ...sectorTypes.basic,
                column: 2,
                row: 1,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 1
                    }
                ],
                population: 2,
                corrupted: true,
                glory: [1],
                harbinger: true
            },
            {
                ...sectorTypes.basic,
                column: 2,
                row: 2,
                fleets: [
                    {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: 1
                    }
                ],
                population: 2,
                corrupted: true,
                glory: [3],
                reclaim: 2,
                installations: ['defense']
            },
            {
                ...sectorTypes.basic,
                column: 2,
                row: 3,
                glory: [1],
                fallen_house: true
            }
        ],
        voidstorms: [
            [
                '0-1',
                '1-0'
            ],
            [
                '1-0',
                '2-1'
            ],
            [
                '1-1',
                '2-1'
            ]
        ],
        havens: [1, 2]
    }
]

let havenCapacities = [
    0,
    2,
    2,
    3,
    4,
    4
]

let codedScenarios = {
    'coop_And One for All_1_2': {
        sectors: [
            [null, 'rift.v3','.v2.d.p4.c.h.r2.g4', 'survivors.p3'],
            ['.v2.p5.c.r.b.g4.d.h','.v2.p3.c.b.g2.r','genesis.v3.p3.c.b.g2.h','.f.b.g1'],
            [null, '.v2.p3.c.b.g2.h','.v2.p3.c.b.g2','outpost'],
            [null, 'asteroids.g1', 'home']
        ],
        voidstorms: ['0-1.1-1', '1-0.1-1', '1-1.2-2', '1-2.1-3'],
        havens: [3, 2]
    },
    'coop_Darkest Hour_1_2': {
        sectors: [
            ['rift.v3', '.v1.d.p4.c.h.r.g3.s1', '.v2.d.p4.c.r2.g4'],
            ['palace.v2.p3.c.d.g2.s2', 'genesis.v3.h.p3.c.b.g2.s1.s3', 'asteroids.b.g1'],
            ['.v.d.h.b.r.g3.p4.c', '.v2.p4.c.d.r.g3.s2', '.v2.p3.c.b.g2.s3', 'home'],
            ['rift.v3.h.g3.s4', '.f.g1.s4', 'outpost']
        ],
        havens: [3]//[1, 2]
    },
    'coop_Ancient Secrets_1_3': {
        sectors: [
            [null, 'genesis.v3.p3.c.b.g2','ruins.v2'],
            ['research.p4!.c.v2.g1.b', 'wormhole_a.s1', '.f.g1'],
            ['.v2.p5.c.r.b.g4.d', '.v2.d.p4.c.h.r.b.g3.s1.s2', '.v2.p3.c.b.g2.h', '.v.p2.c.g1'],
            ['.v2.p5.c.r.b.h.g4.d.s2', 'paradise.p4.g3.h.d.v2.s3.s4', 'outpost.s3', 'home'],
            [null, 'rift.v3.s4']
        ],
        havens: [3, 1]
    },
    "coop_Devil's Triangle_1_3": {
        sectors: [
            ['rift.v3', '.v2.d.h2.g4.b.r.p5.c', '.v2.p3.c.g2.b', 'wormhole_a.s1', 'comms.p3!'],
            ['.v2.d.h.b.r2.g4.p4.c', '.v.d.h.g3.r.p4.c', '.f.g1.s1', 'home'],
            [null, '.v2.g2.b.p3.c', '.v2.g2.b.p3.c', 'wormhole_b'],
            [null, 'wormhole_a.s2','outpost.s2'],
            [null, null, 'genesis.v2.d.b.g3.r.p4.c']
        ],
        havens: [3, 2]
    },
    'coop_When Darkness Fades_1_3': {
        sectors: [
            [null, null, 'outpost', 'asteroids.g1.s1', '.v2.d.h.r2.p4.c'],
            ['.f.g1', 'home', '.v.d.g3.r.p4.c.s2', 'megapolis.v3.d.h.b.g5.p6!.c.s1.s2', '.v2.d.h2.g4.b.r.p5.c'],
            [null, '.v.g1.p2.c', '.v2.g2.b.p3.c', 'paradise.v2.d.g3.p4.s3', '.v2.d.h.r2.p4.c.s3']
        ],
        havens: [3, 1]
    },
    'coop_Today Is Not The Day_1_4': {
        sectors: [
            [null, 'outpost', 'home'],
            [null, '.v.p2.c.g1.s1', 'genesis.v2.h.r.g1.p2.c.s1'],
            [null, '.f.g1.s2', '.v2.h.g2.b.p3.c.s2'],
            ['.c2.h.g4.d.r2.p4.c.s3.v2', 'research.v3.g2.g1.b.p4!.c', '.v.d.h.g3.r2.p4.c.s4'],
            ['rift.v3', 'palace.v2.d.b.g2.p3.c.s3', 'megapolis.v3.d.b.g5.p6!.c.s4', 'rift.v3.v1']
        ],
        havens: [3, 2]
    },
    'coop_Fall of Civilization_1_4': {
        sectors: [
            [null, null, null, 'home.s1'],
            [null, null, '.f.g1.s1', 'outpost'],
            [null, 'wormhole_a', '.v.g1.p2.c', '.v.g1.p2.c'],
            ['ruins.v2.s2', '.f.g1.s3.s4', '.v2.h.g2.b.p3.c.s4', 'wormhole_a'],
            [null, 'rift.v3.h.s2.s3', '.v2.d.h.g4.r2.p4.c', '.v.d.h.g3.r.p4.c'],
            [null, 'megapolis.v3.d.g5.p6!.c']
        ],
        havens: [3, 1, 2]
    }
}

/*
{
    "sectors": [
            [".v.g2.g5", null, null, "home.s1"],
            [null, null, ".f.g1.s1", "outpost"],
            [null, "wormhole_a", ".v.g1.p2.c", ".v.g1.p2.c"],
            ["ruins.v2.s2", ".f.g1.s3.s4", ".v2.h.g2.b.p3.c.s4", "wormhole_a"],
            [null, "rift.v3.h.s2.s3", ".v2.d.h.g4.r2.p4.c", ".v.d.h.g3.r.p4.c"],
            [null, "megapolis.v3.d.g5.p6!.c"]
        ],
    "havens": [3, 1, 2]
}
*/

function decode(scenarios){
    let list = []
    for(let k of Object.keys(scenarios)){
        let elements = k.split('_');
        let scenario = scenarios[k];
        let r = {
            type: elements[0],
            name: elements[1],
            players: parseInt(elements[2]),
            complexity: parseInt(elements[3]),
            sectors: [],
            voidstorms: [],
            havens: scenario.havens || []
        };
        let vs = {};
        for(let col = 0; col < scenario.sectors.length; col++){
            for(let row = 0; row < scenario.sectors[col].length; row++){
                let code = scenario.sectors[col][row];
                if(!code) continue; // blank
                
                let elements = code.split('.');
                let type = elements.shift();
                if(!type) type = 'basic';
                
                let template = sectorTypes[type];
                if(type == 'outpost'){
                    template = sectorTypes.basic;
                }
                let s = {
                    ...jsonpatch.deepClone(template),
                    column: col,
                    row: row,
                    glory: []
                };
                if(type == 'outpost'){
                    s.special = 'outpost'; // NB shouldn't clash with anything
                }
                
                while(elements.length > 0){
                    let e = elements.shift();
                    let c = e[0];
                    let n = parseInt(e.substr(1));
                    if(c == 'v'){
                        if(!s.fleets) s.fleets = [];
                        s.fleets = [...s.fleets, {
                            owner: 'voidborn',
                            type: 'voidborn',
                            num: n || 1
                        }]
                    }else if(c == 'g'){
                        s.glory.push(n);
                    }else if(c == 'c'){
                        s.corrupted = true;
                    }else if(c == 'd'){
                        s.installations.push('defense');
                    }else if(c == 'h'){
                        s.harbingers = n || 1;
                    }else if(c == 'p'){
                        s.population = n;
                        if(e.endsWith('!')) s.fixedPopulation = true;
                    }else if(c == 'r'){
                        s.reclaim = n || 1;
                    }else if(c == 'b'){
                        s.bounty = n || 1;
                    }else if(c == 'f'){
                        s.fallen_house = true;
                    }else if(c == 's'){
                        // Voidstorm links
                        // use the same number or code to join each
                        let key = `${col}-${row}`;
                        if(!vs[n]) vs[n] = [];
                        vs[n].push(key);
                        if(vs[n].length == 2){
                            // Add it to the scenario set
                            r.voidstorms.push(vs[n]);
                        }
                    }
                }
                r.sectors.push(s);
            }
        }
        if(scenario.voidstorms){
            for(let v of scenario.voidstorms){
                let elements = v.split('.');
                r.voidstorms.push(elements);
            }
        }
        list.push(r);
    }
    console.log(list);
    return list;
}


scenarios = [...scenarios, ...decode(codedScenarios)];

let soloChallenges = [
    {
        ...scenarios.find(s => s.name == 'Today Is Not The Day' && s.players == 1),
        name: 'December 2023 challenge',
        events: {
            cycle_1: ['1F'],
            cycle_2: ['2A', '2H', '2I'],
            cycle_3: ['3A', '3D', '3G']
        },
        specific_techs: [
            'Torpedoes', 'Starbases', 'Hyperdrive', 'Tactical Transports', 'Carriers', 'Central Surveillance', 
            'Salvage Scanner', 'Purifier'
        ],
        no_influence_techs: ['Starbases', 'Tactical Transports', 'Salvage Scanner'],
        opening_improved: ['Carriers', 'Central Surveillance', 'Hyperdrive', 'Salvage Scanner'],
        fixedHouses: ['Belitan'],
        fixedSide: 'A',
        fallenHouses: ['Yarvek', 'Kradmor', 'Cortozaar', 'Fenrax'],
        opening_agendas: ['D6', 'M8', 'S8', 'W6']
    },
    {
        ...scenarios.find(s => s.name == 'When Darkness Fades' && s.players == 1),
        name: 'January 2024 challenge',
        events: {
            cycle_1: ['1G'],
            cycle_2: ['2C', '2D', '2H'],
            cycle_3: ['3A', '3E', '3F']
        },
        fixedHouses: ['Marqualos'],
        fixedSide: 'B',
        specific_techs: [
            'Terraforming', 'Neural Matrix', 'Hyperdrive', 'Tactical Transports',
            'Robotics', 'Ark Ships', 'Sentries', 'Deep Space Missiles'
        ],
        no_influence_techs: ['Terraforming', 'Ark Ships', 'Sentries'],
        opening_improved: ['Ark Ships', 'Deep Space Missiles', 'Robotics', 'Sentries'],
        fallenHouses: ['Thegwyn', 'Astoran', 'Yarvek', 'Nervo'],
        opening_agendas: ['S5', 'M4', 'W6', 'D1']
    }
];

scenarios = [...scenarios, ...soloChallenges];

for(let s of scenarios){
    for(let c of s.sectors){
        if(!c.glory) c.glory = [];
        if(!c.bounty) c.bounty = [];
        if(!c.reclaim) c.reclaim = [];
        if(!c.fleets) c.fleets = [];
        if(c.harbinger){
            c.harbingers = 1;
        }else if(!c.harbingers){
            c.harbingers = 0;
        }
        delete c.harbinger;
    }
    if(s.havens){
        let newHavens = [];
        for(let h of s.havens){
            newHavens.push({
                id: `haven_${h}`,
                capacity: havenCapacities[h],
                cubes: []
            })
        }
        s.havens = newHavens;
    }
}
console.log(scenarios)

export function createCustomScenario(custom){
    let rendered = cleanupScenario(custom);
    return {
        type: 'coop', // or solo?
        players: 1,
        name: 'Custom Scenario',
        complexity: 4,
        sectors: [],
        voidstorms: [],
        havens: [],
        ...rendered 
    }
}

function decodeIndividual(scenario){
    let vs = {};
    let r = {
        type: 'coop', // or solo?
        players: 1,
        name: 'Custom Scenario',
        complexity: 4,
        sectors: [],
        voidstorms: [],
        havens: [],
        ...jsonpatch.deepClone(scenario)
    };
    for(let col = 0; col < scenario.sectors.length; col++){
        for(let row = 0; row < scenario.sectors[col].length; row++){
            let code = scenario.sectors[col][row];
            if(!code) continue; // blank
            
            let elements = code.split('.');
            let type = elements.shift();
            if(!type) type = 'basic';
            
            let template = sectorTypes[type];
            if(type == 'outpost'){
                template = sectorTypes.basic;
            }
            let s = {
                ...jsonpatch.deepClone(template),
                column: col,
                row: row,
                glory: []
            };
            if(type == 'outpost'){
                s.special = 'outpost'; // NB shouldn't clash with anything
            }
            
            while(elements.length > 0){
                let e = elements.shift();
                let c = e[0];
                let n = parseInt(e.substr(1));
                if(c == 'v'){
                    if(!s.fleets) s.fleets = [];
                    s.fleets = [...s.fleets, {
                        owner: 'voidborn',
                        type: 'voidborn',
                        num: n || 1
                    }]
                }else if(c == 'g'){
                    s.glory.push(n);
                }else if(c == 'c'){
                    s.corrupted = true;
                }else if(c == 'd'){
                    s.installations.push('defense');
                }else if(c == 'h'){
                    s.harbingers = n || 1;
                }else if(c == 'p'){
                    s.population = n;
                    if(e.endsWith('!')) s.fixedPopulation = true;
                }else if(c == 'r'){
                    s.reclaim = n || 1;
                }else if(c == 'b'){
                    s.bounty = n || 1;
                }else if(c == 'f'){
                    s.fallen_house = true;
                }else if(c == 's'){
                    // Voidstorm links
                    // use the same number or code to join each
                    let key = `${col}-${row}`;
                    if(!vs[n]) vs[n] = [];
                    vs[n].push(key);
                    if(vs[n].length == 2){
                        // Add it to the scenario set
                        r.voidstorms.push(vs[n]);
                    }
                }
            }
            console.log(s);
            r.sectors.push(s);
        }
    }
    return r;
}

export function cleanupScenario(s){
    s = decodeIndividual(s);
    for(let c of s.sectors){
        if(!c.glory) c.glory = [];
        if(!c.bounty) c.bounty = [];
        if(!c.reclaim) c.reclaim = [];
        if(!c.fleets) c.fleets = [];
        if(c.harbinger){
            c.harbingers = 1;
        }else if(!c.harbingers){
            c.harbingers = 0;
        }
        delete c.harbinger;
    }
    if(s.havens){
        let newHavens = [];
        for(let h of s.havens){
            newHavens.push({
                id: `haven_${h}`,
                capacity: havenCapacities[h],
                cubes: []
            })
        }
        s.havens = newHavens;
    }
    console.log(s);
    return s;
}

