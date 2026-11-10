// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { totalDeployed } from "./fleets.js";
import { doAction, log, ongoingPlayer, renderCost } from "./game.js";
import { playerSectors } from "./sectors.js";
import { choose, pause } from "./ui.js";
import { moveBitTo } from "./utils.js";
import { playerCorruptionSlots} from './actions.js'
import { hasTech } from "./techs.js";
import { payableUpkeep, singleUpkeep, totalUpkeep } from "./resources.js";
import { get } from './runtime.js';
import { state } from "./stores.js";

//let convertibleCosts = ['food', 'energy', 'materials'];
let basicResources = ['food', 'energy', 'materials', 'credits', 'science', 'influence'];

let wildcardResources = [
    {
        type: 'credits',
        conversions: {
            food: 1,
            energy: 1,
            materials: 1
        }
    }
];

let extraConversions = [
    {
        ongoing: 'energy_science_conversion',
        conversions: [
            {
                type: 'energy',
                conversions: {
                    science: 1
                }
            },
            {
                type: 'science',
                conversions: {
                    energy: 1
                }
            }
        ]
    },
    {
        ongoing: 'nervo_conversion',
        conversions: [
            {
                type: 'materials',
                conversions: {
                    food: 1,
                    energy: 1
                }
            }
        ]
    },
    {
        ongoing: 'yarvek_conversion',
        conversions: [
            {
                type: 'bounty',
                conversions: {
                    credits: 1,
                    science: 1,
                    /*energy: 1,
                    food: 1, 
                    materials: 1*/
                }
            }
        ]
    }
]

function extraPlayerConversions(p){
    if(!p) return [];
    let list = [];
    for(let c of extraConversions){
        if(ongoingPlayer(p).includes(c.ongoing)){
            list = [...list, ...c.conversions];
        }
    }
    return list;
}

let convertibleCosts = [];
for(let w of wildcardResources){
    for(let t of Object.keys(w.conversions)){
        if(!convertibleCosts.includes(t)) convertibleCosts.push(t);
    }
}

function convertible(r){
    let list = [];
    for(let w of r){
        for(let t of Object.keys(w.conversions)){
            if(!list.includes(t)) list.push(t);
        }
    }
    return list;
}

export let costTypes = {
    trade: {
        bank: (p) => p.loose_trade.length + p.agendas.filter(a => a.trade).length, // loose_trade??
        pay: async (p, amount, source) => {
            await doAction(p, 'return_token', {type: 'trade', num: amount, source})
        }
    },
    deactivate: {
        bank: (p) => p.fleets.active.length + totalDeployed(p),
        pay: async (p, amount, source) => {
            await doAction(p, 'deactivate', {num: amount, source})
        }
    },
    recall: {
        bank: (p) => totalDeployed(p),
        pay: async (p, amount, source) => {
            await doAction(p, 'recall', {num: amount, source})
            if(get(state).cache.lastSectors){
                state.update(s => {
                    s.cache.costSectors = [...get(state).cache.lastSectors];
                    return s;
                })
            }
        }
    },
    deploy: {
        bank: (p) => p.fleets.active.length,
        pay: async (p, amount, source) => {
            await doAction(p, 'deploy', {num: amount, source})
        }
    },
    population: {
        bank: (p) => playerSectors(p).filter(s => s.population && s.population > 1 && !s.corrupted && s.type != 'home').reduce((a,c) => a + c.population, 0),
        pay: async (p, num, source) => {
            while(num > 0){ 
                await doAction(p, 'decrease_population', {place: 'not_home', num: 1 , source})
                if(get(state).cache.lastSectors){
                    state.update(s => {
                        s.cache.costSectors = [...get(state).cache.lastSectors];
                        return s;
                    })
                }
                num--;
            }
        }
    },
    gain_corruption: {
        bank: (p) => playerCorruptionSlots(p).length,
        pay: async (p, num, source) => {
            for(let _ of Array(num)){
                await doAction(p, 'gain_corruption', {source});
            }
        }
    },
    track_corruption: {
        bank: (p) => playerCorruptionSlots(p, 'tracks').length,
        pay: async (p, num, source) => {
            for(let _ of Array(num)){
                await doAction(p, 'gain_corruption', {restriction: 'tracks', source});
            }
        }
    },
    glory: {
        bank: (p) => p.glory.length,
        pay: async (p, num, source) => {
            await doAction(p, 'discard_glory', {num, source})
        }
    },
    unbuild: {
        // Guess always not home?
        bank: (p) => playerSectors(p).filter(s => s.type != 'home').flatMap(s => s.installations).length,
        pay: async (p, num, source) => {
            await doAction(p, 'unbuild', {num, source})
            if(get(state).cache.lastSectors){
                state.update(s => {
                    s.cache.costSectors = [...get(state).cache.lastSectors];
                    return s;
                })
            }
        }
    },
    unguild: {
        // Guess always not home?
        bank: (p) => playerSectors(p).filter(s => s.type != 'home').flatMap(s => s.guilds).length,
        pay: async (p, num, source) => {
            await doAction(p, 'unguild', {num, source})
            if(get(state).cache.lastSectors){
                state.update(s => {
                    s.cache.costSectors = [...get(state).cache.lastSectors];
                    return s;
                })
            }
        }
    },
    agenda: {
        bank: (p) => p.agendas.filter(a => a.card && a.card.type != 'starting').length,
        pay: async (p, num, source) => {
            for(let i = 0; i < num; i++){
                /*let chosen = await choose(`Select an agenda to discard`, p.agendas.map(a => a.card).filter(a => a && a.type != 'starting'));
                moveBitTo(chosen, get(state).spare_cards);*/
                await doAction(p, 'discard_agenda', {source, restriction: 'house_mat'});
            }
        }
    },
    bounty: {
        bank: (p) => p.bounty.length,
        pay: async (p, num, source) => {
            await doAction(p, 'return_token', {from: 'house_mat', type: 'bounty', num, source})
            if(get(state).cache.lastSectors){
                state.update(s => {
                    s.cache.costSectors = [...get(state).cache.lastSectors];
                    return s;
                })
            }
        }
    },
    reclaim: {
        bank: (p) => p.reclaim.length,
        pay: async (p, num, source) => {
            await doAction(p, 'return_token', {from: 'house_mat', type: 'reclaim', num, source})
            if(get(state).cache.lastSectors){
                state.update(s => {
                    s.cache.costSectors = [...get(state).cache.lastSectors];
                    return s;
                })
            }
        }
    },
    
};



for(let c of basicResources){
    costTypes[c] = {
        bank: (p) => p.resources[c].store,
        pay: async (p, amount, source) => {
            await doAction(p, 'gain_resource', {type: c, num: -amount, source});
        }
    }
}

function sortByWildcard(info, a,b){
    let ai = 0;
    let bi = 0;
    if(info.wildcards.some(w => w.type == a)) ai = -1;
    if(info.wildcards.some(w => w.type == b)) bi = -1;
    if(ai == bi){
        return costTypes[b].bank(info.p) - costTypes[a].bank(info.p);
    }
    return ai - bi;
}

export function getCostElements(info){
    let nonElementKeys = ['p', 'convertible', 'wildcards', 'rendered', 'any', 'any_fem', 'available'];
    return Object.keys(info).filter(k => !nonElementKeys.includes(k))
}

async function doPayment(cost, source){
    for(let e of getCostElements(cost)){
        if(cost[e].raw == 0) continue;
        await costTypes[e].pay(cost.p, cost[e].raw, source); // Not returning because already tested?
    }
    return true;
}

function renderPayInfo(info){
    let elements = [];
    for(let e of getCostElements(info)){
        elements.push(`${info[e].raw} [[${e}]]`);
    }
    return `<span style="font-weight: bold; color: red">${elements.join(', ')}</span>:&nbsp;`;
}

export async function pay(p, cost, options = {}){
    let toPay = getCostInfo(p, cost, options)
    if(!toPay) return false;
    if(Array.isArray(toPay)){
        if(toPay.length == 0) return false;
        let choices = [];
        for(let c of toPay){
            choices.push({
                type: 'text',
                choice: c.rendered,
                value: c
            })
        }
        let route = await choose(`Choose cost to pay${options.purpose ? ` to ${options.purpose}` : ''}`, choices, options);
        toPay = route;
    }
    if(toPay.any){
        // Special case – handle as 'gain_resource' instead
        let amount = toPay.any;
        try{
            let params = {num: -amount};
            if(toPay.available) params.available = toPay.available;
            await doAction(p, 'gain_resource', {...params, source: options.source});
            //delete toPay.any;
            //delete toPay.available;
            //return true;
        }catch(e){
            if(e == 'uncompleted' || e == 'cancelled' || e == 'impossible') return false;
            throw e;
        }
    }
    if(anyConversions(toPay)){
        toPay = await pause(`Paying to ${options.purpose || 'do action'}`, {cost: toPay, ...options});
        if(!toPay || toPay == 'cancelled') return false;
    }
    return await doPayment(toPay, options.source);
}

export function getCostInfo(p, costs, options = {}){
    if(Array.isArray(costs)){
        let res = [];
        for(let c of costs){
            let info = getCostInfo(p, c, options);
            if(info) res.push(info);
        }
        if(res.length == 0) return false;
        return res;
    }
    if(costs.hasOwnProperty('any')){
        if(Object.keys(costs).length > 1){
            //alert('mixed any/non-any costs not currently handled!');
            //throw 'unimplemented';
            let restCost = {
                ...costs
            };
            delete restCost.any;
            let restInfo = getCostInfo(p, restCost, options);
            if(!restInfo) return false;
            let total = getCostElements(restInfo).reduce((a, k) => a + restInfo[k].raw, 0);
            let totalRes = Object.keys(p.resources).reduce((a, r) => a + p.resources[r].store, 0);
            if(totalRes < total + costs.any) return false; // Can't afford it all
        }else{
            if(Object.keys(p.resources).map(r => p.resources[r].store).reduce((a,c) => a+c, 0) >= costs.any) return costs;
            return false;
        }
        
    }
    if(costs.hasOwnProperty('any_fem')){
        if(Object.keys(costs).length > 1){
            let restCost = {
                ...costs
            };
            delete restCost.any_fem;
            let restInfo = getCostInfo(p, restCost, options);
            if(!restInfo) return false;
            let total = getCostElements(restInfo).reduce((a, k) => a + restInfo[k].raw, 0);
            let totalRes = Object.keys(p.resources).filter(r => ongoingPlayer(p).includes('energy_science_conversion') || r != 'science').reduce((a, r) => a + p.resources[r].store, 0);
            if(totalRes < total + costs.any) return false; // Can't afford it all
        }else{
            if(Object.keys(p.resources).map(r => p.resources[r].store).reduce((a,c) => a+c, 0) >= costs.any_fem){
                let ret = {};
                ret.any = costs.any_fem;
                ret.available = ['food', 'energy', 'materials']
                return ret;
            }
            return false;
        }
    }
    let wild = [...wildcardResources, ...extraPlayerConversions(p)];
    let info = {
        p,
        // convertedWildcards: {},
        wildcards: options.wildcards || wild,
        convertible: [],
        rendered: renderCost(costs)
    };
    if(costs.any) info.any = costs.any;
    if(costs.any_fem){
        info.any = costs.any_fem;
        info.available = ['food', 'energy', 'materials']
    }
    for(let w of info.wildcards){
        // figure out convertible costs
        for(let k of Object.keys(w.conversions)){
            if(!info.convertible.includes(k) && costs.hasOwnProperty(k)) info.convertible.push(k);
        }
    }
    for(let k of Object.keys(costTypes).filter(c => Object.keys(costs).includes(c) || info.wildcards.some(w => w.type == c && info.convertible.some(con => w.conversions.hasOwnProperty(con))))){
        info[k] = {
            raw: 0,
            origCost: costs[k] || 0,
        }
    }
    for(let c of info.convertible.filter(c => Object.keys(costs).includes(c))){
        info[c] = {
            ...info[c],     
            convertedFrom: {},
        };
        for(let w of info.wildcards){
            if(w.conversions.hasOwnProperty(c)){
                info[c].convertedFrom[w.type] = 0;
                //if(!info[w.type]) info[w.type]
                if(!info[w.type].convertedTo) info[w.type].convertedTo = {};
                info[w.type].convertedTo[c] = 0;
                //console.log(info[w.type]);
            }
        }
    }

    if(!costs) return false;

    let elements = getCostElements(info).sort((a, b) => sortByWildcard(info, a, b));

    for(let k of elements){
        let num = info[k].origCost;
        if(!p || costTypes[k].bank(p) >= num){
            info[k].raw += num;
        }else if(!info.convertible.includes(k)){
            info[k].raw = costTypes[k].bank(p);
            let deficit = num - costTypes[k].bank(p);
            if(!options.onDeficit) return false;
            info[k].realDeficit = deficit;
            info[k].roundedDeficit = deficit;
            info = options.onDeficit(info, k, deficit);
        }else{
            //info[k].raw = costTypes[k].bank(p);
            let deficit = num - costTypes[k].bank(p);
            let wcsUsed = [];
            let amountAlreadyPaid = 0;
            for(let wc of info.wildcards.filter(w => Object.keys(w.conversions).includes(k)).sort((a, b) => sortByWildcard(info, a.type, b.type))){
                let w = wc.type;
                let availableThis = costTypes[w].bank(p) - info[w].raw;
                if(availableThis == 0) continue;
                // Only whatever's left
                let asThis = Math.min(availableThis, Math.ceil(deficit / wc.conversions[k])); //Math.ceil(deficit / wc.conversions[k]) * wc.conversions[k]);
                //let raw = num - asThis;
                //if(raw < 0) raw = 0;
                info[k].convertedFrom[w] = asThis * wc.conversions[k];
                amountAlreadyPaid += info[k].convertedFrom[w];
                //info[k].raw = raw; // or +=?
                //info.convertedWildcards[w] += asThis / wc.conversions[k];
                info[w].raw += asThis; // wc.conversions[k];
                info[w].convertedTo[k] += asThis;
                if(asThis > 0) wcsUsed.push(wc);
                //let asThisConvertedBack = asThis //* wc.conversions[k];
                deficit -= asThis * wc.conversions[k]; // So leftover can be taken up by the next
                //if(info[w].raw + info.converted[w] > costTypes[w].bank(p)) return false; // Can't afford
                // !!! TODO the above doesn't allow for multiple layers of wildcards. 
                if(deficit <= 0) break; // Stop when enough paid
            }
            if(deficit > 0) amountAlreadyPaid += deficit; // So it doesn't result in negative amounts;
            info[k].raw = num - amountAlreadyPaid; // 
            if(deficit > 0){
                if(options.onDeficit){
                    
                    let gap = deficit - Math.floor(deficit)
                    if(gap > 0){
                        // Get back to a round number by finding the relevant wc
                        for(let wc of wcsUsed.reverse()){
                            let w = wc.type;
                            while(gap > 0 && info[w].convertedTo[k] > 0){
                                info[w].raw --
                                info[w].convertedTo[k]--;
                                info[k].convertedFrom[w] -= wc.conversions[k];
                                deficit += wc.conversions[k]
                                gap = deficit - Math.floor(deficit);
                            }
                        }
                    }
                    info[k].realDeficit = deficit;
                    info[k].roundedDeficit = deficit;
                    info = options.onDeficit(info, k, deficit);
                }else{
                    return false; // Cost is unpayable at this point
                } 
            }
            
        }
        
    }
    return info;
}


export function canAdjust(info, resource, wildcard, toAdd){
    let w = info.wildcards.find(w => w.type == wildcard);
    if(!w){
        console.log('Bad wildcard', wildcard)
        return;
        //throw 'Wildcard not found!';
    }
    if(!conversions(info, resource, wildcard)) return false; // None exist
    if(!info[wildcard]) return false; // Not in the set of possibilities
    //if(info[resource].realDeficit && info[resource].realDeficit != info[resource].roundedDeficit) return true;
    if(info[wildcard].raw + toAdd < 0) return false;
    if(toAdd > 0){
        return (costTypes[wildcard].bank(info.p) > info[wildcard].raw/* + info.convertedWildcards[wildcard]*/ && (info[resource].raw + allConverted(info, resource) - info[wildcard].convertedTo[resource]) > 0); // is end right? Or too restrictive? Ok to overpay
    }else{
        
        if(info[resource].realDeficit && info[resource].realDeficit != info[resource].roundedDeficit && info[wildcard].convertedTo[resource] >= Math.abs(toAdd)) return true;
        return (info[wildcard].convertedTo[resource] >= Math.abs(toAdd) && costTypes[resource].bank(info.p) - info[resource].raw - (info[resource].roundedDeficit || 0) >= w.conversions[resource] * Math.abs(toAdd) && info[resource].raw <= info[resource].origCost /*- Math.abs(toAdd)*/);
    }
}

export function anyConversions(info){
    if(!info.convertible || info.convertible.length == 0) return false;
    let types = Object.keys(costTypes).filter(k => info.hasOwnProperty(k));
    for(let t of types){
        if(info.wildcards.some(w => Object.keys(w.conversions).includes(t))) return true;
    }
    return false;
}

export function listConvertibleResources(info){
    let conv = [];
    //if(info.deficit) return conv;
    for(let k of Object.keys(info).filter(k => Object.keys(costTypes).includes(k) && info.convertible.includes(k))){ // Check info.convertible necessary
        //console.log('conversions', info, k, conversions(info, k))
        if(conversions(info, k).length > 0) conv.push(k);
    }
    return conv;
}

export function conversions(info, type, wildcard = false){
    if(wildcard){
       let w = info.wildcards.find(w => w.type == wildcard);
       if(!w) return [];
       return w.conversions[type]; // and undefined if not
    }
    // Otherwise return an array of possible ones
    let conv = [];
    for(let w of info.wildcards){
        if(w.conversions[type]) conv.push({
            wildcard: w.type,
            conversionRate: w.conversions[type]
        })
    }
    return conv;
}

function allConverted(info, r){
    let convertedFrom = Object.keys(info[r].convertedFrom).reduce((a,c) => a + info[r].convertedFrom[c], 0);
    let convertedTo = info[r].convertedTo ? Object.keys(info[r].convertedTo).reduce((a,c) => a + info[r].convertedTo[c], 0) : 0;
    return convertedFrom - convertedTo;
}

export function adjust(info, resource, wildcard, toAdd){
    let w = info.wildcards.find(w => w.type == wildcard);
    if(!w){
        console.log('Bad wildcard', wildcard);
        return;
        //throw 'Wildcard not found!';
    }
    if(!canAdjust(info, resource, wildcard, toAdd)) return info;
    while(toAdd > 0 && info[resource].raw < toAdd){
        // Take back some from another conversion
        //let diff = toAdd - info[resource].raw;
        // !! NOTE won't work for fractional or in cases of toAdd < 0 (which should be triaged out anyway, but hey-ho)
        let availableToTake = Object.keys(info[resource].convertedFrom).filter(k => k != wildcard).find(k => info[resource].convertedFrom[k] > 0);
        //info = adjust(info, resource, availableToTake, -1, true); // Ignore limits just for this
        let w2 = info.wildcards.find(w => w.type == availableToTake);
        info[resource].convertedFrom[availableToTake] -= w2.conversions[resource];
        info[availableToTake].convertedTo[resource]--;
        info[availableToTake].raw--;
        info[resource].raw += w2.conversions[resource];
        info[resource].realDeficit += w2.conversions[resource];
    }
    info[resource].convertedFrom[wildcard] += toAdd * w.conversions[resource];
    info[wildcard].convertedTo[resource] += toAdd;
    info[resource].raw -= toAdd * w.conversions[resource];
    if(info[resource].raw < 0) info[resource].raw = 0;
    if(info[resource].raw + allConverted(info, resource) != info[resource].origCost){
        let diff = info[resource].origCost - (info[resource].raw + allConverted(info, resource)) - (info[resource].roundedDeficit || 0);
        console.log(diff);
        if(info)
        info[resource].raw += diff; // To pay back the surplus
        if(info[resource].raw < 0) info[resource].raw = 0;
        // for Voidfall but might for other games. Keep an eye on it..>!
    }
    if(info[resource].realDeficit){
        // Adjust real def
        info[resource].realDeficit -= toAdd * w.conversions[resource];
    }
    //info.convertedWildcards[wildcard] += toAdd;
    info[wildcard].raw += toAdd; // Actual amount there
    console.log('cost adjusted', info)
    return info;
}

export async function payUpkeep(p){
    let upkeep = payableUpkeep(p);
    let alreadyPaid = totalUpkeep(p) - payableUpkeep(p); // For any that's already sorted by e.g. a tech
    let upkeepWildcards = ['energy', 'materials'].map(r => {
        return {
            type: r,
            conversions: {
                food: 0.5
            }
        }
    })
    if(hasTech(p, 'Data Refinery', 'improved')){
        upkeepWildcards.push(
            {
                type: 'credits',
                conversions: {
                    food: 2
                }
            }
        )
    }
    p.satisfied_upkeep = alreadyPaid + upkeep;
    
    await pay(p, {food: upkeep}, {
        purpose: 'satisfy [[upkeep]]',
        wildcards: upkeepWildcards,
        onDeficit: (info, res, def) => {
            // We know it'll be food that is short
            // !!TODO could this be done by simple conversion rules with influence the fallback??
            // Probably not because it shouldn't be optional...
            log({
                type: 'stats',
                unSatisfiedUpkeep: def
            }, p)
            

            log(`Paying ${def * 3} [[influence]] for being unable to satisfy ${upkeep} [[upkeep]]`);
            if(!info.influence){
                info.influence = {
                    raw: 0,
                    origCost: 0
                }
            }
            info.influence.raw += def * 3;
            info.p.satisfied_upkeep -= def;
            return info;
        }
    })
    log({
        type: 'stats',
        satisfiedUpkeep: p.satisfied_upkeep
    }, p)
}

export function hasFractions(cost){
    for(let e of getCostElements(cost)){
        if(Math.floor(cost[e].raw) != cost[e].raw) return true;
    }
    return false;
}