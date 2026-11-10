// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import {state} from './stores.js';
import {get} from './runtime.js';
import { all, bl, isIn, moveBitTo, resolvePlace } from './utils.js';
import { returnToken, topToken } from './tokens.js';
import { deployedFleet, fleetOwner, moveFleet, sectorFleetsByType } from './fleets.js';
import { doAction, logEvent, ongoingGeneral } from './game.js';
import { tick } from './runtime.js';
import { ask, choose, doActionPause, pause, upperInitial } from './ui.js';
import { hasTech } from './techs.js';

// For future reference (via the redblobgames.com/grids/hexagon site):
// We are using odd-q offset coordinates

export let basicSector = {
    type: 'basic',
    guild_spaces: 3,
    installation_spaces: 3,
    guilds: [],
    installations: [],
    installations_fixed: [],
    installation_layout: [],
    on_invade: undefined,
    voidborn_ship_limit: 1,
    upkeep: {
        guilds: [2],
        installations: [2]
    }
}

let homeSector = {
    type: 'home',
    name: 'Home',
    installations: ['shipyard'],
    installations_fixed: [true],
    guilds: [],
    guild_spaces: 2,
    installation_spaces: 1,
    special: [
        'no_voidborn',
        'no_invasion',
        'no_corruption'
    ],
    upkeep: {
        guilds: [1]
    }
}

export let sectorTypes = {
    basic: {
        ...basicSector
    },
    home: {
        ...homeSector
    },
    rift: {
        type: 'rift',
        name: 'Rift',
        installations: ['defense'],
        installations_fixed: [true],
        installation_spaces: 1,
        installation_layout: [1],
        guild_spaces: 0,
        guilds: [],
        voidborn_ship_limit: 3,
        on_invade: {
            type: 'players_may',
            action: {
                either_or: [
                    {
                        verb: 'gain_resource',
                        num: 5
                    },
                    'remove_corruption'
                ]
            }
        }
    },
    genesis: {
        ...basicSector,
        type: 'genesis',
        name: 'Genesis Sector',
        on_invade: {
            verb: 'move_corruption',
            from: 'source'
        },
        special: [
            'genesis_establish'
        ]
    },
    asteroids: {
        ...basicSector,
        type: 'asteroids',
        name: 'Asteroid Belt',
        installations: ['shipyard', 'defense'],
        installation_spaces: 2,
        installations_fixed: [true, true],
        installation_layout: [0, 2],
        guild_spaces: 0,
        fixedPopulation: true,
        population: 0,
        special: [
            'no_voidborn',
            'no_corruption'
        ],
        focusBoost: {
            label: 'Asteroids',
            card: 'Development',
            action: {
                verb: 'deploy',
                num: 2,
                place: 'source'
            }
        },
        productionBoost: {
            energy: 1,
            materials: 1
        }
    },
    wormhole_a: {
        ...basicSector,
        name: 'Wormhole (A)',
        type: 'wormhole_a',
        wormhole: 'A',
        special: [
            'no_invasion',
            'no_voidborn',
            'no_corruption'
        ],
        population: 0,
        fixedPopulation: true,
        guild_spaces: 0,
        installation_spaces: 0
    },
    wormhole_b: {
        ...basicSector,
        name: 'Wormhole (B)',
        type: 'wormhole_b',
        wormhole: 'B',
        special: [
            'no_invasion',
            'no_voidborn',
            'no_corruption'
        ],
        population: 0,
        fixedPopulation: true,
        guild_spaces: 0,
        installation_spaces: 0
    },
    survivors: {
        ...basicSector,
        name: `Survivors' Colony`,
        type: 'survivors',
        installations: ['defense'],
        installations_fixed: [true], // [1?]
        installation_spaces: 3,
        installation_layout: [1],
        guilds: ['farmers_guild'],
        guild_spaces: 3,
        guilds_fixed: [true],
        guild_layout: [2],
        on_invade: [
            {
                verb: 'gain_resource',
                type: 'food',
                num: 2
            },
            'activate'
        ],
        special: ['no_voidborn'],
        upkeep: {
            installations: [2],
            guilds: [2]
        }
    },
    ruins: {
        ...basicSector,
        type: 'ruins',
        name: 'Ancient Ruins',
        installations: ['defense'],
        installation_spaces: 1,
        installations_fixed: [true],
        installation_layout: [1],
        upkeep: {
            ...basicSector.upkeep,
            basic: 2
        },
        population: 0,
        guild_spaces: 0,
        fixedPopulation: true,
        special: ['no_corruption'],
        on_invade: 'gain_tech',
        voidborn_ship_limit: 2,
        ongoing: 'increase_improved_tech_limit',
        focusBoost: {
            label: 'Ancient Ruins',
            card: ['Progress', 'Innovation'],
            cost: {
                science: 1
            },
            action: 'third_action'
        }
    },
    // NB temporary for Dec and Jan: after that, need to revert (and I guess replace with survivors)
    nursery: {
        ...basicSector,
        type: 'nursery', 
        on_invade: {
            verb: 'recall',
            restriction: 'same_sector',
            compulsory: true
        },
        installation_spaces: 0,
        guild_spaces: 0,
        population: 0,
        fixedPopulation: true,
        special: ['no_voidborn', 'no_corruption'],
        reactions: {
            inPhase: 'focus actions',
            maxTimes: 1,
            after: {
                verb: 'gain_tech', 
                type: 'improved'
            },
            action: {
                either_or: [
                    'increase_population',
                    'activate'
                ]
            }
        },
        productionBoost: {
            science: 1
        }
    },
    research: {
        ...basicSector,
        name: 'Research Complex',
        type: 'research',
        installations: ['starbase'],
        installation_spaces: 1,
        installations_fixed: [true],
        installation_layout: [1],
        guilds: ['engineers_guild'],
        guilds_fixed: [true], // Need to handle this better...
        guild_layout: [2],
        upkeep: {
            guilds: [2]
        },
        population: 4,
        fixedPopulation: true,
        ongoing: ['energy_science_conversion']
    },
    megapolis: {
        ...basicSector,
        name: 'Megapolis',
        type: 'megapolis',
        installation_spaces: 2,
        installation_layout: [0, 2],
        guild_spaces: 4,
        guilds: ['bankers_guild', 'bankers_guild'],
        guilds_fixed: [true, true],
        guild_layout: [2, 3],
        population: 6,
        fixedPopulation: true,
        upkeep: {
            basic: 1,
            guilds: [3],
            installations: [1]
        },
        voidborn_ship_limit: 2
    },
    comms: {
        ...basicSector,
        type: 'comms',
        name: 'Comms Relay',
        installations: ['defense', 'defense'],
        installations_fixed: [true, true],
        installation_spaces: 2,
        installation_layout: [0, 2],
        guild_spaces: 2,
        upkeep: {
            guilds: [1],
            basic: 1
        },
        population: 3,
        fixedPopulation: true,
        focusBoost: {
            label: 'Comms Relay',
            card: ['Conquest', 'Development', 'Reinforcement', 'Politics'],
            cost: {
                energy: 1
            },
            action: 'third_action'
        }
    },
    palace: {
        ...basicSector,
        type: 'palace',
        name: 'Novarchon Palace',
        installations: ['defense'],
        installations_fixed: [true],
        installation_spaces: 3, 
        guild_spaces: 2,
        installation_layout: [1],
        upkeep: {
            basic: 1,
            installations: [2],
            guilds: [1]
        },
        on_invade: {
            verb: 'gain_bounty', 
            num: 2
        },
        ongoing: ['advance_boost'],
        voidborn_ship_limit: 2
    },
    paradise: {
        ...basicSector,
        type: 'paradise',
        name: 'Paradise Sector',
        special: ['no_corruption'],
        voidborn_ship_limit: 2,
        installation_spaces: 2,
        installation_layout: [0, 2],
        guild_spaces: 2,
        upkeep: {
            guilds: [1],
            installations: [1]
        },
        productionBoost: {
            food: 2,
            energy: 2,
            materials: 2,
            credits: 2,
            science: 2
        }
    },
    home_astoran: {
        ...homeSector,
        installations: ['shipyard'],
        installations_fixed: [true],
        installation_layout: [1],
        installation_spaces: 3,
        upkeep: {
            guilds: [1],
            installations: [2]
        }
    },
    home_marqualos: {
        ...homeSector,
        guilds: ['bankers_guild'],
        guild_spaces: 3,
        guilds_fixed: [true],
        guild_layout: [2],
        special: [
            'no_voidborn',
            'no_invasion' // but it can be corrupted
        ],
        upkeep: {
            guilds: [2]
        }
    },
    home_novaris: {
        ...homeSector,
        installations: ['shipyard', 'shipyard'],
        installations_fixed: [true, true],
        installation_spaces: 2,
        installation_layout: [0, 2],
        special: [
            'no_voidborn',
            'no_invasion' // but it can be corrupted
        ],
        upkeep: {
            basic: 1,
            guilds: [1]
        }
    },
    home_thegwyn: {
        ...homeSector,
        installations: [],
        installation_spaces: 0,
        installations_fixed: undefined,
        installation_layout: undefined,
        guilds: ['farmers_guild'],
        guild_spaces: 3,
        guilds_fixed: [true],
        guild_layout: [2],
        upkeep: {
            guilds: [2]
        }
    }
}

for(let k of Object.keys(sectorTypes)){
    sectorTypes[k].neutralID = sectorTypes[k].type;
}

let directions = [120, 60, 0, -60, -120, 180];

let direction_differences = [
    // even cols 
    [[+1,  0], [+1, -1], [ 0, -1], 
     [-1, -1], [-1,  0], [ 0, +1]],
    // odd cols 
    [[+1, +1], [+1,  0], [ 0, -1], 
     [-1,  0], [-1, +1], [ 0, +1]],
]

export function sectorSpecial(s, t){
    if(!s.special) return false;
    if(s.special == t) return true;
    if(Array.isArray(s.special) && s.special.includes(t)) return true;
    return false;
}

export function playerCode(p){
    if(typeof p != 'string') p = p.colour; // for now anyway..
    return p;
}

export function controlledBy(s, p){
    if(p != 'voidborn') p = playerCode(p);
    //console.log('control', s, p)
    if(s.type == 'home' && s.colour == p) return true;
    if(!s || !s.fleets || s.fleets.length == 0) return false;
    //console.log(p, s.fleets);
    for(let f of s.fleets){
        if(f.owner != p) return false;
    }
    return true;
}

export function playerSectors(p){
    return getSectorList(get(state).sectors).filter(s => controlledBy(s, p));
}

export function guildSpaces(p, s, includeTech = true){
    let basic = s.guild_spaces || 0;
    if(!includeTech) return basic;
    if(hasTech(p, 'Ark Ships') && s.type == 'home') basic += 2;
    if(hasTech(p, 'Ark Ships', 'improved') && s.type == 'home') basic += 2;
    return basic;
}

export function guilds(s){
    let list = s.guilds;
    if(s.ark_ships) list = [...list, ...s.ark_ships];
    return list;
}

export function fleetCount(s, p = false, specific = false){
    let count = 0;
    p = playerCode(p);
    if(!s || !s.fleets || s.fleets.length == 0) return 0;
    for(let f of s.fleets){
        if(p && f.owner != p) continue; // Skip ones we don't own
        if(specific && f.type != specific) continue;
        count += f.cubes.length;
    }
    return count;
}

export function getSectorList(sectors){
    let list = [];
    for(let i = 0; i < sectors.cols; i++){
        for(let j = 0; j < sectors.rows; j++){
            if(sectors[`${i}-${j}`]) list.push(sectors[`${i}-${j}`]);
        }
    }
    return list;
}

export function controllerOf(s){
    if(!s.fleets || s.fleets.length == 0) return -1;
    let owners = [];
    for(let f of s.fleets){
        if(!owners.includes(f.owner)) owners.push(f.owner)
    }
    if(owners.length == 0) return owners[0];
    return -1;
}

export function nextKey(s, direction){
    let [c, r] = [s.column, s.row];
    let parity = c & 1;
    let diff = direction_differences[parity][direction];
    c = c + diff[0];
    r = r + diff[1];
    return `${c}-${r}`;
    return {
        column: c,
        row: r
    }
}

export function toIndex(str){
    let [column, row] = str.split('-').map(e => parseInt(e));
    return {
        column,
        row
    }
}

export function sectorKey(s){
    if(typeof s == 'string') return s;
    if(typeof s.column === 'undefined' || typeof s.row === 'undefined'){
        console.log('Non-element', s);
        return '';
    }
    return `${s.column}-${s.row}`;
}

export function neighbours(s){
    let keys = neighbourKeys(s);
    return keys.map(k => get(state).sectors[k]);
}

export function neighbourKeys(s, map = false, ignoreVoidstorms = false, ignoreWormholes = false, pForEnemies = false){
    let keys = [];
    if(!map) map = get(state).sectors;
    for(let i = 0; i < 6; i++){
        let n = nextKey(s, i);
        if(!ignoreVoidstorms && map.voidstorms && map.voidstorms.some(v => v.includes(sectorKey(s)) && v.includes(n))) continue;
        if(!keys.includes(n)) keys.push(n); // Check first because of wormhole code below
        if(map[n] && map[n].wormhole && !ignoreWormholes){
            // Adjacent to every other sector adjacent to this wormhole and others of the same type
            let wormholes = getSectorList(map).filter(sec => sec.wormhole && sec.wormhole == map[n].wormhole);
            for(let w of wormholes){
                let extras = neighbourKeys(w, map, false, true); // Ignore wormholes so it doesn't snowball
                for(let e of extras){
                    if(!keys.includes(e)) keys.push(e);
                }
            }
        }
    }
    if(map) keys = keys.filter(k => map.hasOwnProperty(k));
    return keys;
}

export function isAdjacent(s, t, ignoreVoidstorms = false){
    return neighbourKeys(s, get(state).sectors, ignoreVoidstorms).includes(sectorKey(t));
}

function oddq_to_axial(hex){
    var q = hex.col
    var r = hex.row - (hex.col - (hex.col&1)) / 2
    return {q, r};
}

function axial_subtract(a, b){
    return {q: a.q - b.q, r: a.r - b.r}
}

function axial_distance(a, b){
    let vec = axial_subtract(a, b)
    return (Math.abs(vec.q)
          + Math.abs(vec.q + vec.r)
          + Math.abs(vec.r)) / 2
}

export function distance(s1, s2){
    s1 = oddq_to_axial(s1);
    s2 = oddq_to_axial(s2);
    return axial_distance(s1, s2);
}

export function generateDistances(map){
    let distances = {
        count: 0
    };
    for(let s of getSectorList(map)){
        distancesFrom(s, distances, map)
    }
    //console.log(distances);
    return distances;
}

export function playerSectorsMap(p){
    // For generating distances based on player sectors alone
    let map = {};
    for(let s of playerSectors(p)){
        console.log(s);
        map[s.key] = s;
    }
    for(let s of getSectorList(get(state).sectors)){
        if(s.wormhole) map[s.key] = s;
    }
    map.cols = get(state).sectors.cols;
    map.rows = get(state).sectors.rows;
    map.voidstorms = get(state).voidstorms;
    return map;
}

export function distancesFrom(s, distances, map){
    if(distances[s.key]) return;
    distances[s.key] = {};
    distances[s.key][s.key] = 0;
    distances.count += addNeighbours(s, distances[s.key], 1, map);
}

function addNeighbours(s, distances, current, map){
    let nbs = neighbourKeys(s, map);
    //console.log(nbs)
   // let addedSome = false
   let count = 0;
    for(let n of nbs){
        //console.log(n, map[n]);
        if(distances.hasOwnProperty(n) && distances[n] <= current) continue;
        distances[n] = current;
        count++;
        addNeighbours(map[n], distances, current + 1, map);
    }
    return count;
}

export function getDirectionAngle(s1, s2){
    let diff = [s2.column - s1.column, s2.row - s1.row];
    let parity = s1.column & 1;
    let index = direction_differences[parity].findIndex((d,i) => {
        return d[0] == diff[0] && d[1] == diff[1]
    });
    if(index == -1) return false;
    return directions[index];
}

export function whichSectorKey(bit){
    if(!isIn(bit, 'sectors')) return false;
    let address = bl(bit.id).address;
    let nextOne = false;
    for(let e of address.split('.')){
        if(nextOne) return e;
        if(e == 'sectors') nextOne = true; // The next link
    }
    return false;
}

export async function abandonSector(s){
    // When a sector is abandoned:
    // All installations disappear unless fixed
    // The sector becomes corrupted, if it wasn't already
    // Two Voidborn fleet take over
    // Place a bounty token
    await clearFleets(s); // Just in case
    await clearInstallations(s);
    if(!s.corrupted && !sectorSpecial(s, 'no_corruption')) moveBitTo(topToken('corruption'), s, 'corrupted');
    if(sectorSpecial(s, 'no_voidborn')) return;
    moveBitTo(topToken('bounty'), s.bounty);
    await moveFleet('voidborn', 'voidborn', s.id, 'abandon', 'voidborn');
    await moveFleet('voidborn', 'voidborn', s.id, 'abandon', 'voidborn');
    logEvent(`Sector ${s.key} abandoned`)
    await doActionPause();
}

export function canInvade(p, s){
    // To be able to invade, it has to be:
    // - not your sector
    // - adjacent to one of your sectors
    if(sectorSpecial(s, 'no_invasion')) return false;
    let ps = playerSectors(p);
    if(ps.some(sec => sec.id == s.id)) return false;
    let o = ongoingGeneral().find(o => o.type == 'min_influence_invasion');
    if(o && !controlledBy(s, 'voidborn')){
        let owner = get(state).players.find(pl => controlledBy(s, pl))
        if(owner && owner.influence && owner.influence < o.min) return false;
    }
    
    if(ps.some(sec => isAdjacent(sec, s))) return true;
    if(hasTech(p, 'Hyperdrive', 'improved')){
        if(ps.some(sec => isAdjacent(sec, s, true))) return true;
        if(ps.some(sec => get(state).sectors.distances[sec.key][s.key] <= 2)) return true;
    }
    return false;
}

export function invadableFleets(p, s){
    let ps = playerSectors(p).filter(sec => isAdjacent(sec, s, false));
    if(hasTech(p, 'Hyperdrive', 'improved')){
        ps.push(...playerSectors(p).filter(sec => isAdjacent(sec, s, true)));
        ps.push(...playerSectors(p).filter(sec => get(state).sectors.distances[sec.key][s.key] <= 2));
    }
    return deployedFleet(p, ps);//  ps.flatMap(s => s.fleets);
}

export async function clearInstallations(s){
    if(s.installations_fixed == true) return;
    while(s.installations.length > 0){
        if(s.installations_fixed && s.installations_fixed.length >= s.installations.length) break;
        await returnToken(s.installations[s.installations.length - 1]);
    }
    /*for(let i = 0; i < s.installations.length; i++){
        if(s.installations[i] && (!s.installations_fixed || !s.installations_fixed[i])) await returnToken(s.installations[i]);
    }*/
}

export function hasRemovableInstallations(s){
    if(!s.installations) return false;
    let hasAny = false;
    for(let i = 0; i < s.installations.length; i++){
        if(s.installations[i] && (!s.installations_fixed || !s.installations_fixed[i])) hasAny = true;
    }
    return hasAny
}

export function voidbornFleetSpaces(s){
    let limit = s.voidborn_ship_limit * 3 || 3;
    let count = s.fleets.filter(f => f.owner == 'voidborn').reduce((a,c) => a + c.cubes.length, 0);
    return limit - count;
}

export async function clearSingleFleet(f, reason = false){
    while(f.cubes.length > 0){
        if(f.owner == 'voidborn'){
            await returnToken(f.cubes[0]);
        }else{
            await doAction(get(state).players.find(p => p.colour == f.owner), 'recall', {obj: f.cubes[0], reason});
            //moveBitTo(f.cubes[0], .fleets.active);
        }
        await doActionPause();
    }
    //
    await returnToken(f);
    await doActionPause();
}

export function voidbornSectors(){
    return all('sectors').filter(s => controlledBy(s, 'voidborn'));
}

export function coloursInSector(s){
    let cols = [];
    for(let f of s.fleets){
        if(!cols.includes(f.owner)) cols.push(f.owner);
    }
    return cols;
}

export async function clearFleets(s, colour = false, reason = false){
    let cat = {};
    for(let c of coloursInSector(s)){
        cat[c] = sectorFleetsByType(s, c);
    }
    for(let c of Object.keys(cat)){
        if(colour && c != colour) continue;
        let p = get(state).players.find(p => p.colour == c) || 'voidborn';
        await combatRecall(p, cat[c]);
    }
    /*for(let f of s.fleets){
        let owner = f.owner;
        if(colour && colour != owner) continue;
       await clearSingleFleet(f, reason);
    }*/
}

export async function combatRecall(p, fleetsByType){
    if(p == 'voidborn'){
        for(let k of Object.keys(fleetsByType)){
            for(let f of fleetsByType[k]) await moveFleet('voidborn', f.id, 'voidborn'); //returnToken(f);
        }
        return;
    }

    let toRecall = Object.keys(fleetsByType).flatMap(k => fleetsByType[k]);
    if(toRecall.length == 0) return;
    let toSendHome = [];
    if(hasTech(p, 'Escape Pods', 'improved')){
        let ranges = {};
        for(let k of Object.keys(fleetsByType)){
            if(fleetsByType[k].length > 0){
                ranges[k] = {
                    min: 0,
                    max: fleetsByType[k].length
                }
            }
        }
        let finalRange = await pause(`[[improved_tech]] Escape Pods: select fleets to move home instead of recalling them`, {ranges});
        toRecall = [];
        for(let k of Object.keys(finalRange)){
            toSendHome = [...toSendHome, ...fleetsByType[k].slice(0, finalRange[k])]
            toRecall = [...toRecall, ...fleetsByType[k].slice(finalRange[k])];
        }
    }else if(hasTech(p, 'Escape Pods', 'basic')){
        if(Object.keys(fleetsByType).filter(k => fleetsByType[k].length > 0).length == 1){
            let type = Object.keys(fleetsByType).filter(k => fleetsByType[k].length > 0)[0];
            if(await ask(`[[basic_tech]] Escape Pods: move one [[${type}]] home instead of recalling?`)){
                toSendHome = [...toSendHome, toRecall[0]]
                toRecall = toRecall.slice(1);
            }
        }else{
            let choices = [...Object.keys(fleetsByType).filter(k => fleetsByType[k].length > 0).map(k => {
                return {
                    type: 'text',
                    choice: `[[${k}]] ${upperInitial(k)}`,
                    value: k
                }
            }), 'None'];
            let chosen  = await choose(`[[basic_tech]] Escape Pods: select a fleet to move home instead of recalling`, choices);
            if(chosen != 'None'){
                toSendHome = [...toSendHome, fleetsByType[chosen][0]];
                fleetsByType[chosen] = fleetsByType[chosen].slice(1);
                toRecall = Object.values(fleetsByType).flat(2);
            }
        }
    }
    await doAction(p, 'recall', {obj: toRecall});
    for(let f of toSendHome){
        await moveFleet(p, f.id, resolvePlace('home', p).id);
    }
    
}

export function fleetLimit(s){
    if(controlledBy(s, 'voidborn')) return s.voidborn_ship_limit || 1;
    return 2;
}