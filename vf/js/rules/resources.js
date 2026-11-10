// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { get } from "./runtime.js";
import { state } from './stores.js'
import { doAction, log } from "./game.js";
import { guilds, playerSectors } from "./sectors.js";
import { hasTech } from "./techs.js";
import { choose } from "./ui.js";
import { house } from "./houses.js";
import { canDo, totalHavenCapacity } from "./crisis.js";

export let resourceColours = {
    food: 'rgba(120, 181, 123, 0.6)',//'#D6784B',
    materials: 'rgba(200, 61, 101, 0.6)',//'#C83D65',
    energy: 'rgba(225, 163, 71, 0.6)',//'#E1A347', 
    science: 'rgba(87, 167, 208, 0.6)',//'#57A7D0', 
    credits: 'rgba(150, 118, 83, 0.6)',//'#967653'
}

export let yields = {
    food: [0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 8, 10, 12, 15],
    energy: [0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 8, 10, 12, 15],
    materials: [0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 8, 10, 12, 15],
    credits: [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 8],
    science: [0, 1,1, 2, 3, 3, 4, 4, 5, 6, 8, 10, 12, 15]
}

export let maxStores = {
    food: 15,
    energy: 15,
    materials: 15,
    credits: 15,
    science: 15
}

export let guildMaker = {
    food: 'farmers_guild',
    energy: 'engineers_guild',
    materials: 'miners_guild',
    credits: 'bankers_guild',
    science: 'scientists_guild'
}

export let resMaker = {};

for(let k of Object.keys(guildMaker)){
    resMaker[guildMaker[k]] = k;
}

export let resourceTypes = ['food', 'energy', 'materials', 'credits', 'science']

/*export function adjustYield(p, res, toAdd){
    p.resources[res].level += toAdd;
    if(p.resources[res].level > p.resources[res].yield.length - 1){
        p.resources[res].level = p.resources[res].yield.length - 1; //
    }
    p.resources[res].yield = 
}*/

export function setProductionLevels(p, res = false){
    let level = 0;
    if(!res){
        for(let r of resourceTypes){
            setProductionLevels(p, r);
        }
    }else{
        for(let s of playerSectors(p)){
            if(s.productionBoost && s.productionBoost[res]){
                level += s.productionBoost[res];
            }
            if(res == 'credits' && hasTech(p, 'Orbital Docks', 'improved')){
                level += s.installations.filter(i => i.value == 'shipyard').length * 2;
            }
            if(res == 'science' && hasTech(p, 'Data Refinery')){
                level += guilds(s).filter(i => i.value == 'bankers_guild').length * 2;
            }
            for(let g of guilds(s)){
                if(resMaker[g.value] != res) continue;
                level += s.population;
            }
        }
        if(p.boosts[res]) level += p.boosts[res];
        if(level > yields[res].length - 1) level = yields[res].length - 1;
        p.resources[res].level = level;
        p.resources[res].yield = yields[res][level];
    }  
}

export async function produce(p, res){
    // Async in case of reactions to overproduction
    // !! TODO should this be folded into gain resources somehow?

    let excess = p.resources[res].store + p.resources[res].yield - maxStores[res];
    await doAction(p, 'gain_resource', {type: res, num: p.resources[res].yield}); // In case of triggering other things
    
    if(excess > 0){
        

        if(res == 'credits' && p.house == 'Zenor'){
            log('House Zenor does not overproduce [[credits]]');
    
        }else{
            log(`overproduced [[${res}]]!`, p);
            await doAction(p, 'gain_influence', {num: 3, from: 'overproduction'});

            // Various house-specific stuff could go here
            if(hasTech(p, 'Trade Nexus', 'improved') && !get(state).turnCache.overproduced){
                let t = hasTech(p, 'Trade Nexus', 'improved');
                let choice = await choose(`[[tech]] Trade Nexus: you may gain a [[trade]] (with no bonus) or 3 more [[influence]] for your first overproduction of the turn`, ['[[trade]]', '3 [[influence]]', 'None'])
                if(choice == '[[trade]]'){
                    await doAction(p, 'gain_trade', {gain_benefits: false});
                }else if(choice == '3 [[influence]]'){
                    await doAction(p, 'gain_influence', {num: 3, from: 'overproduction', source: t.id});
                }
            }

            if(res == 'science' && p.house == 'Zenor'){
                log(`House Zenor: gaining ${excess} [[credits]] for excess [[science]]`);
                await doAction(p, 'gain_resource', {types: {credits: excess}});
            }
    
            if(get(state).turnCache.overproduced && get(state).turnCache.overproduced.length > 0 && !get(state).turnCache.safeHavenAdded && canDo(p, 'safe_haven')){
                // You may add to a Safe Haven
                let choice = await choose(`You may build a level of a Safe Haven for overproducing twice or more; do you want to?`, ['Yes', 'No']);
                if(choice == 'Yes'){
                    await doAction(p, 'safe_haven');
                    state.update(s => {
                        s.turnCache.safeHavenAdded = true;
                        return s;
                    })
                }
            }
           
            state.update(s => {
                if(!s.turnCache.overproduced) s.turnCache.overproduced = [];
                s.turnCache.overproduced.push(res); // To limit the Trade Nexus effect, and to build safe haven
                return s;
            })
        }

        
    }
}

export function singleUpkeep(s){
    let upkeep = 0;
    if(!s.upkeep) return 0;
    for(let k of Object.keys(s.upkeep)){
        
        if(k == 'basic'){
            upkeep += s.upkeep[k];
            continue;
        }
        for(let p of s.upkeep[k]){
            if(k == 'insallations') k = 'installations';
            if(s[k].length > p && s[k][p]) upkeep++;
        }
    }
    return upkeep;
}

export function totalUpkeep(p){
    let upkeep = 0;
    if(house(p).baseUpkeep) upkeep = house(p).baseUpkeep;
    for(let a of p.agendas){
        if(a.card && !a.trade) upkeep += 2;
    }
    for(let s of playerSectors(p)){
        upkeep += singleUpkeep(s);
    }
    return upkeep;
}

export function payableUpkeep(p){
    let upkeep = totalUpkeep(p);
    if(hasTech(p, 'Energy Cells', 'improved')){
        // Subtract from the amount to actually pay the amount in your sectors
        let toSubtract = playerSectors(p).reduce((a, s) => a + singleUpkeep(s), 0);
        upkeep -= toSubtract;
    }
    return upkeep;
}