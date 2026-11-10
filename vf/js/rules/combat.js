// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import * as jsonpatch from './runtime.js';
import { ask, choose, doActionPause, pause, undoableOptions, upperInitial } from './ui.js';
import { fleetOwner, fleetType, fleetsInSector, moveFleet, playerFleetTypes, sectorFleetsByType } from './fleets.js';
import { abandonSector, clearFleets, clearInstallations, combatRecall, controlledBy, hasRemovableInstallations, isAdjacent, neighbourKeys, playerSectors, sectorSpecial } from './sectors.js';
import { getCostInfo, pay } from './costs.js';
import { cacheSector, doAction, executeActions, expandAction, getReactionChoices, getReactionChoicesUO, getReadableDescription, log, ongoingGeneral, ongoingPlayer, playerIndex, renderCost } from './game.js';
import { resourceTypes, setProductionLevels } from './resources.js';
import { all, moveBitTo, propAdd, randomElements, at, possArray } from './utils.js';
import { get} from './runtime.js';
import { prefs, state, ui} from './stores.js';
import { tradeTokens } from './agendas.js';
import { addToCrisisBoard, canDo, checkTriggeredEffects, getCrisisMilitaryBoost } from './crisis.js';
import { basicTechs, hasTech } from './techs.js';
import { basicSector } from './sectors.js';
import { getBGImage } from './images.js';
import { returnToken } from './tokens.js';
import { newInformation } from './undo.js';
import { equal } from './runtime.js';

let playerTemplate = {
    fleets: {},
    bases: {},
    techs: [],
    cost: {},
    approachDamage: 0,
    approachAbsorption: 0,
    salvoDamage: 0,
    salvoAbsorption: 0,
    initiative: 0
}

let dataTemplate = {
    invader: {...playerTemplate},
    defender: {...playerTemplate},
    sectorID: '',
    salvoRound: 0,
    salvoFirst: false,
    salvoSecond: false,
    noEndCheckYet: true,
    log: '',
    display: [],
    currentDisplay: {invader: {}, defender: {}}
}

export function relevantCombatTileElements(){
    let basic = ['defense', 'corvette'];
    let possibleExtras = [
        'Starbases',
        'Sentries',
        'Destroyers',
        'Dreadnoughts',
        'Carriers'
    ];
    for(let t of possibleExtras){
        if([...basicTechs(get(state)), ...p.techs].some(tech => tech.name == t)) basic.push(t);
    }
    return basic.map(t => `combat/${t}.png`);
}

export function fleetsToList(f){
    let list = [];
    for(let k of Object.keys(f)){
        for(let i = 0; i < f[k]; i++){
            list.push(k);
        }
    }
    return list;
}

function genTechCode(tech){
    if(!tech.name){
        alert('no tech name!')
        console.log(tech);
        return ''
    }
    let core = tech.name.toLowerCase().replaceAll(' ','_');
    if(tech.type == 'improved') core = `${core}.improved`;
    return core;
}

function listToFleets(list){
    let fleets = {};
    for(let l of list){
        if(fleets[l]){
            fleets[l]++;
        }else{
            fleets[l] = 1;
        }
    }
    return fleets;
}

function branch(data, funcs){
    if(!Array.isArray(funcs)) funcs = [funcs];
    let list = [];
    for(let f of funcs){
        list.push(f(data));
    }
    return list;
}

function leaves(b){

    // traverse a stem losting keaves
    let l = [];
    if(b.choices){
        l.push(...b.choices.flatMap(c => leaves(c)));
    }else{
        l.push(b);
    }
    return l;
}

function replaceAtTop(root, func){
    for(let i = 0; i < root.choices.length; i++){
        let c = root.choices[i];
        if(!c.choices){
            // top level, so do the func and pass on
            let newElement = func(c);
            root.interim = c;
            root.choices[i] = newElement;
        }else{
            replaceAtTop(root.choices[i], func);
        }
    }
}

function someBranchRunning(root){
    for(let r of root){
        //if(r.winner == '') //console.log('aargh', r)
        if(!checkEnd(r)) return true;
    }
    return false;
    //
    if(!root.choices){
        return !checkEnd(root);
    }else{
        for(let c of root.choices){
            if(someBranchRunning(c))return true;
            return false;
        }
    }
}

function combineBranches(a, d){
    // a = invader
    // b = defender
    let combined = [];
    if(!Array.isArray(a)) a = [a];
    if(!Array.isArray(d)) d = [d];
    ////console.log(a,d)
    for(let at of a){
        ////console.log(at);
        for(let de of d){
            ////console.log(de)
            ////console.log('log', de.log)
            if(de.log) at.log += de.log;
            combined.push({
                ...at,
                defender: de.defender
            })
        }
    }
    return combined;
    if(d.choices.length == 0) return a;
    if(a.choices.length == 0) return d;
    if(d.choices.length == 1) {
        let newC = [];
        for(let c of a.choices){
            newC.push({...c, defender: d.choices[0].defender})
        }
        a.choices = newC;
        return a;
    }
    if(a.choices.length == 1) {
        let newC = [];
        for(let c of d.choices){
            newC.push({...c, invader: a.choices[0].invader})
        }
        d.choices = newC;
        return d;
    }
    for(let i = 0; i < a.choices.length; i++){
        let newChoice = {
            decider: 'defender',
            choices: []
        }
       /* if(d.choices.length == 1){
            newChoice = {
                ...a.choices[i],
                defender: d.choices[0].defender
            }
        }else{*/
            for(let c of d.choices){
                newChoice.choices.push({
                    ...a.choices[i],
                    defender: c.defender
                })
            }
        //}
        a.choices[i] = newChoice;
    }
    //if(a.choices.length == 1) a = a.choices[0];
    return jsonpatch.deepClone(a);
}

let tokenActions = {
    carrier: {
        initiative: (data) => {
            basicInitiative(data, 'carrier');
            return data;
        },
        approach: (data) => {
            if(data.invader.fleets.carrier){
                let p = data.invader.p;
                let clones = [];
                if(!p) return data;
                for(let i = 0; i <= Math.min(data.invader.fleets.carrier, p.fleets.active.length); i++){
                    data.choice = 'invader';
                    data.choiceID = choiceID++;
                    let clone = jsonpatch.deepClone(data);
                    data.branch = 0;
                    clone.branch = 1;
                    clone.invader.deployedCorvettes = i;
                    if(!clone.invader.fleets.corvette) clone.invader.fleets.corvette = 0;
                    clone.invader.fleets.corvette += i;
                    addDisplay(clone, 'invader', 'deploy', 'carrier', i);
                    clones.push(clone);
                }
                return clones;
            }
            return data;
        },
        salvo: (data) => {
            if(data.salvoRound == 1 && data.defender.fleets.carrier) data.defender.salvoAbsorption += data.defender.fleets.carrier;
            return data;
        }
    },
    defense: {
        approach: (data) => {
            if(data.hasThis('defender')) data.invader.approachDamage += data.hasThis('defender');
            //if(data.defender.bases.defense) data.defender.approachDamage += data.defender.bases.defense;
            return data;
        }
    },
    starbase: {
        approach: (data) => {
            if(data.hasThis('defender')) data.invader.approachDamage += data.hasThis('defender')
            return data;
        }
    },
    sentry: {
        approach: (data) => {
            if(data.defender.fleets.sentry) data.invader.approachDamage += data.defender.fleets.sentry;
            return data;
        },
        initiative: (data) =>{
            if(data.invader.fleets.sentry) data.invader.initiative += data.invader.fleets.sentry;
            return data;
        }
    },
    deep_space_missiles: {
        approach: (data) => {
            let res = [data];
            for(let k of ['invader', 'defender']){
                for(let d of [...res]){ // Just in case both sides have it
                    if(data.hasThis('invader') || data.hasThis(k, 'improved')){
                        let p = d[k].p;
                        if(!p) continue;
                        let myAdjacent = playerSectors(p).filter(s => (!data.options.abandonedSectors || !data.options.abandonedSectors.includes(s.id)) && isAdjacent(s, at(d.sectorID)));
                        let count = 0;
                        for(let s of myAdjacent){
                            if(s.installations.some(i => i.value == 'shipyard' || i.value == 'starbase')) count++;
                        }
                        if(data.hasThis(k, 'improved')){
                            // Just do it automatically, no reason not to
                            let other = ['invader','defender'].find(r => r != k);
                            d[other].approachDamage += Math.min(count, 2);
                        }else if(k == 'invader' && count > 0){
                            d.choice = k;
                            d.choiceID = choiceID++;
                            let clone = jsonpatch.deepClone(d);
                            d.branch = 0;
                            clone.branch = 1;   
                            propAdd(clone.invader.cost, 'energy', 1);
                            clone.defender.approachDamage++;
                            if(getCostInfo(p, clone.invader.cost)) res.push(clone);
                        }
                    }
                }
            }
            if(res.length == 1) return res[0];
            return res;
        }
    },
    destroyer: {
        initiative: (data) => {
            basicInitiative(data, 'destroyer');
            if(data.invader.fleets.destroyer) data.invader.initiative++;
            return data;
        },
        approach: (data) => {
            if(data.invader.fleets.destroyer && data.invader.techs.includes('destroyers.improved')){
                data.defender.approachDamage++;
            }
            return data;
        },
        salvo: (data) => {
            if(data.salvoRound == 1){
                if(data.invader.fleets.destroyer) data.defender.salvoDamage += data.invader.fleets.destroyer;
            }
            return data;
        }
    },
    shields: {
        approach: (data) => {
            for(let k of ['invader', 'defender']){
                if(data.hasThis(k, 'improved') && data[k].fleets.corvette) data[k].approachAbsorption++;
            }
            return data;
        },
        salvo: (data) => {
            for(let k of ['invader', 'defender']){
                if(data.hasThis(k) && data[k].fleets.corvette && data.salvoRound == 1) data[k].salvoAbsorption++; 
            }
            return data;
        }
    },
    corvette: {
        initiative: (data) => {
            basicInitiative(data, 'corvette');
            return data;
        },
    },
    voidborn: {
        initiative: (data) => {
            basicInitiative(data, 'voidborn', data.options.voidborn_initiative || 0);
            return data;
        },
        approach: (data) => {
            for(let k of ['invader', 'defender']){
                if(data[k].fleets.voidborn && data.options.voidborn_approachAbsorption && !data[k].approachModAlreadyDone){
                    data[k].approachAbsorption += data.options.voidborn_approachAbsorption;
                    data[k].approachModAlreadyDone = true;
                }
            }
            return data;
        },
        salvo: (data) => {
            for(let k of ['invader', 'defender']){
                if(data[k].fleets.voidborn && (data.options.voidborn_salvoAbsorption || k == 'invader' &&  ongoingGeneral().includes('voidborn_skirmish_improved_tech_salvo_absorption')) && !data[k].salvoModAlreadyDone){
                    if(data.options.voidborn_salvoAbsorption) data[k].salvoAbsorption += data.options.voidborn_salvoAbsorption;
                    if(k == 'invader' && ongoingGeneral().includes('voidborn_skirmish_improved_tech_salvo_absorption')){
                        let p = data.defender.p;
                        if(p && p.techs) data[k].salvoAbsorption += p.techs.filter(t => t.type == 'improved').length;
                    }
                    data[k].salvoModAlreadyDone = true;
                }
            }
            return data;
        }
    },
    autonomous_drones: {
        approach: (data) => {
            let res = [data];
            if(data.hasThis('invader') && data.invader.p && tradeTokens(data.invader.p).length > 0){
                //let newRes = [...res];
                data.choice = 'invader';
                data.choiceID = choiceID++;
                let clone = jsonpatch.deepClone(data);
                data.branch = 0;
                clone.branch = 1;
                propAdd(clone.invader.cost, 'trade', 1);
                clone.invader.approachAbsorption++;
                clone.invader.AD_salvoboost = true;
                //clone[k].salvoAbsorption++;
                //if(data.hasThis(k, 'improved')) clone[k].salvoAbsorption++;
                if(getCostInfo(data.invader.p, clone.invader.cost)) res.push(clone);
                //res = newRes;
            }
            if(res.length == 1) return res[0];
            return res;
        },
        salvo: (data) => {
            if(data.salvoRound != 1) return data;
            for(let k of ['invader', 'defender']){
                if(data.hasThis(k) && data[k].p && data[k].AD_salvoboost){
                    data[k].salvoAbsorption++;
                    if(data.hasThis(k, 'improved')) data[k].salvoAbsorption++;
                }
            }
            return data;
        }
    },
    bombard: {
        approach: (data) => {
            let res = [data];
            if(data.hasThis('invader') && data.invader.p){
                let materialInc = 1;
                data.choiceID = choiceID++;
                let branch = 0;
                data.branch = branch++;
                while(getCostInfo(data.invader.p, {...data.invader.cost, materials: materialInc * 3})){
                    data.choice = 'invader';
                    let clone = jsonpatch.deepClone(data);
                    clone.branch = branch++;
                    propAdd(clone.invader.cost, 'materials', materialInc * 3);
                    clone.invader.approachAbsorption += materialInc;
                    res.push(clone);
                    materialInc++;
                }
            }
            if(res.length == 1) return res[0];
            return res;
        },
        salvo: (data) => {
            let res = [data];
            if(data.hasThis('invader') && data.invader.p){
                let materialInc = 1;
                data.choice = 'invader';
                data.choiceID = choiceID++;
                let branch = 0;
                data.branch = branch++;
                while(getCostInfo(data.invader.p, {...data.invader.cost, materials: (data.invader.cost.materials || 0) + materialInc * 3})){ 
                    let clone = jsonpatch.deepClone(data);
                    clone.branch = branch++;
                    propAdd(clone.invader.cost, 'materials', materialInc * 3);
                    clone.invader.salvoAbsorption += materialInc;
                    res.push(clone);
                    materialInc++;
                }
            }
            if(res.length == 1) return res[0];
            return res;
        }
    },
    dreadnought: {
        initiative: (data) => {
            basicInitiative(data, 'dreadnought', 1);
            return data;
        },
        approach: (data) => {
            if(data.invader.fleets.dreadnought) data.invader.approachAbsorption += data.invader.fleets.dreadnought;
            return data;
        },
        salvo: (data) => {
            if(data.defender.fleets.dreadnought && data.salvoRound == 1) data.defender.salvoAbsorption += data.defender.fleets.dreadnought
            return data;
        }
    },
    
    torpedoes: {
        salvo: (data) => {
            for(let k of ['invader', 'defender']){
                let other = ['invader', 'defender'].find(r => r != k);
                if(data.hasThis(k) && data[k].fleets.corvette){
                    if(data.salvoRound == 1 || data.hasThis(k, 'improved')) data[other].salvoDamage++;
                }
            }
            return data;
        }
    },
    targeting: {
        initiative: (data) => {
            for(let k of ['invader', 'defender']){
                if(data.hasThis(k) && data[k].fleets.corvette) data[k].initiative += 5;
                if(data.hasThis(k, 'improved')) data[k].initiative += 99;
            }
            return data;
        }
    },
    
    
    
    energy_cells: {
        approach: (data) => {
            if(data.hasThis('defender') && data.invader.approachDamage) data.invader.approachDamage++;
            return data;
        }
    }
}

function checkEnd(data){
    let winner = false;
    
    if(data.noEndCheckYet) return false;
    if(data.winner) return data.winner;
    if(Object.keys(data.invader.fleets).length == 0){
        
        data.winner = `defender`;
        winner = 'defender';
    }
    ////console.log(data)
    if(Object.keys(data.defender.fleets).length == 0){
        if(winner){
            data.winner = 'draw';
            data.log += `Mutual destruction: sector abandoned`;
            //console.log('draw')
            return 'draw';
        }
        data.winner = 'invader';
        data.log += `Defender has no fleets left: invader wins!`
        return 'invader';
    }
    if(winner) data.log += `invader has no fleets left: defender wins!`
    return winner;
}

function basicInitiative(data, type, plus = 0){
    for(let k of ['invader', 'defender']){
        if(!data[k].fleets[type]) continue;
        data[k].initiative += data[k].fleets[type] + plus;
    }
    
}

let choiceID = 0;

function resolveDamage(data, who, amount){
    //let fleetList = fleetsToList(data[who].fleets);

    // What the below needs to do  is:
    // - generate all possible combinations of ships to take damage up to that value
    // - weed out duplicates (via a set)
    // - convert to a single list for choices
    let fleetList = fleetsToList(data[who].fleets);
    let fleetsLeft = [fleetList];
    let outcomes = [];
    for(let i = 0; i < amount; i++){
        let newFleetsLeft = [];
        for(let f of fleetsLeft){
            for(let i = 0; i < f.length; i++){
                newFleetsLeft.push([...f.slice(0, i), ...f.slice(i+1)]); // Version without this one in it
            }
        }
        
        fleetsLeft = newFleetsLeft;
    }
    let choices = [];
    if(fleetsLeft.length > 1){
        // Only worth doing if more than one option
        data.choice = who;
        data.choiceID = choiceID++; // To link together later  
    }else{
        // All fleets lost
        data[who].fleets = {};
        propAdd(data[who], 'damageTaken', amount);
        //data[who].takingDamage = {amount};
        data[who].log = `${upperInitial(who)} loses their final fleet(s).`;
        return data;
    }
    let branch = 0;
    ////console.log(fleetsLeft);
    for(let f of possArray(fleetsLeft)){
        // each is now an array
        let c = jsonpatch.deepClone(data);
       // c.branch = branch++;
        propAdd(c[who], 'damageTaken', amount);
        c[who].fleets = listToFleets(f);
        let fleetDiff = {};
        for(let f of Object.keys(data[who].fleets)){
            let diff = data[who].fleets[f] - (c[who].fleets[f] || 0);
            if(diff) fleetDiff[f] = diff;
        }
        c.log += `${upperInitial(who)} chooses to lose ${Object.keys(fleetDiff).map(k => `${fleetDiff[k]} ${k}`).join(', ')}. `
        choices.push({...c, branch: branch++});
    }
    //route++;
    choices = prune(choices);//Array.from(new Set(choices.map(c => JSON.stringify(c)))).map(c => JSON.parse(c));
    ////console.log(choices.map(c => c.log))
    return choices;
    return {
        decider: who,
        choices
    }
}

/*function chainBranches(data, funcs){
    let branches = false;
    for(let f of funcs){
        let newBranches = [];
        if(!branches){
            branches = {
                decider: f.decider,
                choices: f.choices(data)
            };
        }else{

        }
        for(let b of branches){
            newBranches.push(...f(b));
        }
        branches = newBranches;
    }
    return Array.from(new Set(branches)); // To weed out duplicates
}*/

let combatSequence = [
    {
        name: 'approach_slot',
        func: (d) => {return d;},
        next: 'calcApproachDamage_invader'
    },
    {
        name: 'calcApproachDamage_invader',
        func: (d) => {
            let damageToinvader = Math.max(0, d.invader.approachDamage - d.invader.approachAbsorption);
            d.log += `invader takes ${damageToinvader} approach damage (${d.invader.approachDamage} - ${d.invader.approachAbsorption}).`
            /*let branches = chainBranches(data, [
                {
                    decider: 'invader',
                    choices: (d) => {
                        return resolveDamage(d, 'invader', invaderDamage);
                    }
                },
                {
                    decider: 'defender',
                    choices: (d) => {
                        return resolveDamage(d, 'defender', invaderDamage);
                    }
                },
            ])*/
            let combined;
            let aBranches;
            let dBranches;
            if(damageToinvader){
                d = resolveDamage(d, 'invader', damageToinvader);
            }
            d.noEndCheckYet = true;
            return d;
           
            if(aBranches && dBranches) combined = combineBranches(aBranches, dBranches);
            ////console.log(combined.map(c => c.log))
            return combined;
        },
        next: 'calcApproachDamage_defender'
    },
    {
        name: 'calcApproachDamage_defender',
        func: (d) => {
            let damageToDefender = Math.max(0, d.defender.approachDamage - d.defender.approachAbsorption);
            d.log += `Defender takes ${damageToDefender} approach damage (${d.defender.approachDamage} - ${d.defender.approachAbsorption}). `
            
            delete d.noEndCheckYet;

            if(damageToDefender){
                d = resolveDamage(d, 'defender', damageToDefender);
            }
            for(let data of possArray(d)){
                finishDisplayStep(data, {
                    type: 'approach',
                    timing: 'sim'
                });
            }
            
            
            return d;
        },
        next: 'reset'
    },
    {
        name: 'reset',
        func: (d) => {
            d.invader.approachDamage = 0;
            d.defender.approachDamage = 0;
            d.invader.initiative = 0;
            d.defender.initiative = 0;
            d.invader.salvoDamage = 0;
            d.defender.salvoDamage = 0;
            d.salvoRound++;
            d.salvoFirst = false;
            d.salvoSecond = false;
            delete d.nextSalvoCalc;
            d.log += `Salvo round ${d.salvoRound}. `
            return d;
        },
        next: 'initiative_slot'
    },
    {
        name: 'initiative_slot',
        func: (d) => {return d;},
        next: 'calcInitiative'
    },
    {
        name: 'calcInitiative',
        func: (d) => {
            return d;
        },
        next: (data) => {
            data.log += `invader now has ${data.invader.initiative} total initiative, defender now has ${data.defender.initiative}. `
            if(data.salvoFirst){
                // We have already set this, so it must be the second initiative slot!
                return 'calcSalvo_second'; // was 'salvo_second_slot' but actually everything is in I think!;
            }
            if(data.invader.initiative == data.defender.initiative){
                data.salvoFirst = false;
                data.salvoSecond = false;
                data.nextSalvoCalc = 'calcSalvo_sim';
                data.log = `Simultaneous salvos. `
                return 'salvo_sim_slot';
            }else if(data.invader.initiative > data.defender.initiative){
                data.salvoFirst = 'invader';
                data.salvoSecond = 'defender';
                data.nextSalvoCalc = 'calcSalvo_first';
                data.log = `invader goes first. `
            }else if(data.invader.initiative < data.defender.initiative){
                data.salvoFirst = 'defender';
                data.salvoSecond = 'invader';
                data.nextSalvoCalc = 'calcSalvo_first';
                data.log = `Defender goes first. `
            }

            return 'salvo_first_slot'
        }
    },
    {
        name: 'salvo_first_slot',
        func: (d) => {return d;},
        next: 'calcSalvo_first'
    },
    
    {
        name: 'calcSalvo_first',
        func: (d) => {
            let me = d.salvoFirst;
            let them = d.salvoSecond;
            d.nextSalvoCalc = 'calcSalvo_second';
            if(d[me].initiative == 0) return d; //[d];
            d[them].salvoDamage++;
            addDisplay(d, them, 'damage', 'basic', 1);
            let damageToOther = d[them].salvoDamage - d[them].salvoAbsorption;
            d.log += `${upperInitial(me)} does ${damageToOther} salvo damage (${d[them].salvoDamage} - ${d[them].salvoAbsorption}). `
            if(damageToOther < 0){
                // Spare stuff
                d[them].salvoAbsorption = -damageToOther; // carry forward
                damageToOther = 0;
            }else{
                d[them].salvoAbsorption = 0;
            }
            
            if(damageToOther) d = resolveDamage(d, them, damageToOther);
            for(let data of possArray(d)){
                finishDisplayStep(data, {
                    type: 'salvo',
                    round: data.salvoRound,
                    timing: data.salvoFirst
                });
            }
            return d;
        },
        next: 'reset_initiative' 
    },
    {
        name: 'reset_initiative',
        func: (d) => {
            d.invader.initiative = 0;
            d.defender.initiative = 0;
            return d;
        },
        next: 'initiative_slot'
    },
    {
        name: 'salvo_second_slot',
        func: (d) => {return d;},
        next: 'calcSalvo_second'
    },
    {
        name: 'calcSalvo_second',
        func: (d) => {
            let me = d.salvoSecond;
            let them = d.salvoFirst;
            if(d[me].initiative == 0) return d; //[d];
            d[them].salvoDamage++;
            addDisplay(d, them, 'damage', 'basic', 1);
            let damageToOther = d[them].salvoDamage - d[them].salvoAbsorption;
            d.log += `${upperInitial(me)} does ${damageToOther} salvo damage (${d[them].salvoDamage} - ${d[them].salvoAbsorption}). `
            if(damageToOther < 0){
                // Spare stuff
                d[them].salvoAbsorption = -damageToOther; // carry forward
                damageToOther = 0;
            }else{
                d[them].salvoAbsorption = 0;
            }
            
            if(damageToOther) d = resolveDamage(d, them, damageToOther);
            for(let data of possArray(d)){
                finishDisplayStep(data, {
                    type: 'salvo',
                    round: data.salvoRound,
                    timing: data.salvoSecond
                });
            }
            return d;
        },
        next: 'reset' 
    },
    {
        name: 'salvo_sim_slot',
        func: (d) => {return d;},
        next: 'calcSalvo_sim'
    }, 
    {
        name: 'calcSalvo_sim',
        func: (d) => {
            d.defender.salvoDamage += 1;
            d.invader.salvoDamage += 1;
            //addDisplay(d, 'defender', 'damage', 'basic', 1);
            //addDisplay(d, 'invader', 'damage', 'basic', 1);
            if(d.defender.initiative == 0){
                d.invader.salvoDamage = 0; // No initiative means no damage
            }else{
                addDisplay(d, 'invader', 'damage', 'basic', 1);
            }
            if(d.invader.initiative == 0){
                d.defender.salvoDamage = 0; // No initiative means no damage
            }else{
                addDisplay(d, 'defender', 'damage', 'basic', 1);
            }

            let damageToinvader = d.invader.salvoDamage - d.invader.salvoAbsorption;
            d.log += `invader takes ${damageToinvader} salvo damage (${d.invader.salvoDamage} - ${d.invader.salvoAbsorption}); `
            d.noEndCheckYet = true;
            
            if(damageToinvader < 0){
                // Spare stuff
                d.invader.salvoAbsorption = -damageToinvader; // carry forward
                damageToinvader = 0;
            }else{
                d.invader.salvoAbsorption = 0;
            }
            
            if(damageToinvader){
                d = resolveDamage(d, 'invader', damageToinvader);
            }
            return d;
        },
        next: 'sim_salvo_defender'
    },
    {
        name: 'sim_salvo_defender',
        func: (d) => {
            let damageToDefender = d.defender.salvoDamage - d.defender.salvoAbsorption;
            d.log += `Defender takes ${damageToDefender} salvo damage  (${d.defender.salvoDamage} - ${d.defender.salvoAbsorption});`
            if(damageToDefender < 0){
                // Spare stuff
                d.defender.salvoAbsorption = -damageToDefender; // carry forward
                damageToDefender = 0;
            }else{
                d.defender.salvoAbsorption = 0;
            }
            
            delete d.noEndCheckYet;

            if(damageToDefender){
                d = resolveDamage(d, 'defender', damageToDefender);
            }
            for(let data of possArray(d)){
                finishDisplayStep(data, {
                    type: 'salvo',
                    round: data.salvoRound,
                    timing: 'sim'
                });
            }
            return d;
        },
        next: 'reset'
    }
]

function prune(set){
    let pruned = [];
    //return set;
    if(set.length < 2) return set;
    if(set.some(s => s.invader)){
        // Do the reduced version
        for(let s of set){
            for(let k of ['invader', 'defender']){
                if(pruned.some(p => p.currentStage == s.currentStage && equal(p[k], s[k]))) continue;
                pruned.push(s);
            }
            
        }
        return pruned;
    }
    /*for(let s of set){
        for(let k of Array.from(new Set(...Object.keys(s), ...pruned.map(p => Object.keys(p))))){
            if(!pruned.some(p => p[k] == s[k])) pruned.push(s);
        }
    }
    return s;*/
    for(let s of set){
        if(!pruned.some(p => jsonpatch.compare(p, s).length == 0)) pruned.push(s);
    }
    return pruned;
    return Array.from(new Set(set.map(s => JSON.stringify(s)))).map(s => JSON.parse(s));
}

function makeParent(c){
    let parent = false;
    if(c.hasOwnProperty('choiceID')) return `${c.choiceID}.${c.branch}`;
    return `${c.parent}`;
    //if(c.hasOwnProperty('branch')) return `${c.parent}.${c.branch}`;
    return c.parent;
    //'default';
    for(let r of ['invader', 'defender']){
        let list = []
        for(let k of Object.keys(c[r].fleets).sort((a,b) => a.localeCompare(b))){
            if(c[r].fleets[k]){
                list.push(`${k}=${c[r].fleets[k]}`);
            }
        }
        parent += `:${r}:${list.join('+')}`
    }
    return parent;
}

function makeFunc(actions, a, k, data){
    return (data) => {
        data.hasThis = (role, extra = '') => {
            let b = a;
            if(extra) b = `${a}.${extra}`;
            return (data[role].fleets[b] || data[role].bases[b] || data[role].techs.some(t => t.startsWith(b)));
        };
        let ret = actions[a][k](data);
        delete data.hasThis;
        return ret;
    }
}

let testData = {
    ...dataTemplate,
    invader: {
        ...playerTemplate,
        bases: {},
        fleets: {
            corvette: 2,
            destroyer: 1,
        },
        techs: ['destroyers.improved']
    },
    defender: {
        ...playerTemplate,
        bases: {
            defense: 1,
        },
        fleets: {
            corvette: 2,
        },
        techs: ['dreadnoughts.improved']
    }
}

function fillPlayerCombatData(invader, sector){
    let iCol = 'voidborn';
    if(invader.colour) iCol = invader.colour;
    let data = {
        ...jsonpatch.deepClone(dataTemplate),
        invader: {
            ...jsonpatch.deepClone(playerTemplate)
        },
        defender: {
            ...jsonpatch.deepClone(playerTemplate)
        },
        sectorID: sector.id
    };
    data.invader.colour = iCol;
    for(let f of sector.fleets){
        let key = 'defender';
        if(f.owner == iCol){
            key = 'invader';
        }else{
            data.defender.colour = f.owner;
        }
        if(!data[key].fleets[f.type]) data[key].fleets[f.type] = 0;
        data[key].fleets[f.type] += f.cubes.length;
    }
    for(let i of sector.installations){
        if(!data.defender.bases[i.value]) data.defender.bases[i.value] = 0;
        data.defender.bases[i.value]++;
    }

    let defender = false;
    if(data.defender.colour != 'voidborn') defender = get(state).players.find(p => p.colour == data.defender.colour);
    if(invader.colour){
        data.invader.p = invader;
        for(let t of invader.techs){
            data.invader.techs.push(genTechCode(t));
        }
    }
    if(defender && defender.colour){
        data.defender.p = defender;
        for(let t of defender.techs){
            data.defender.techs.push(genTechCode(t));
        }
    }

    return data;
}

function nextSkirmish(p){
    // Because it will vary...
    if(get(state).mode == 'coop'){

    }else{
        // Only one!

    }
}

export function combatPrediction(p, sector, fleets, options = {}, params){
    let s = jsonpatch.deepClone(sector);
    for(let f of possArray(fleets)){
        let t = fleetType(f);
        s.fleets.push({
            type: t,
            owner: p.colour,
            cubes: [f]
        })
    }
    let c = calculateCombat(p, s, options);
    //console.log('combat prediction', c)
    //if(c.results.winner == 'draw') return 'mutual destruction';
    if(alwaysSameWinner(c.results.routes)){
        return `${c.results.winner == 'draw' ? 'mutual destruction' : `[[${c.results.winner}]]`}: <div style="display: flex; flex-wrap: wrap; align-items: center;">${c.results.routes.map(r => renderRoute(r)).join('&nbsp;/&nbsp;')}</div>`;
    }else{
        return `<div style="display: flex; flex-wrap: wrap; align-items: center;">${c.results.routes.map(r => `${r.winner == 'draw' ? 'draw' : `[[${r.winner}]]`}: ${renderRoute(r)}`).join('&nbsp;/&nbsp;')}</div>`;
    }
}

function alwaysSameWinner(routes){
    let winners = Array.from(new Set(routes.map(r => r.winner)));
    return winners.length == 1;
}

export function updateSkirmish(p){
    ui.update(ui => {
        if(!ui.nextSkirmishTarget) ui.nextSkirmishTarget = {};
        ui.nextSkirmishTarget[playerIndex(p)] = skirmishData(p, {inEvaluation: true}); // inEvaluation will be overridden by War card if need be
        return ui;
    })
}

export async function showSkirmishData(id, nst){
    if(!nst) return;
    let data = nst.data[id];
    //console.log(data);s
    if(data){
        ui.update(ui => {
            ui.currentSkirmishView = id;
            ui.showing['Skirmish prediction'] = true;
            return ui;
        })
    }
    return;
    if(data) await pause(nst.boostLog.map(l => `<div>${l}</div>`).join('\n'), {combat: data.results.routes, once: true, dragHandleOnly: true, name: 'Skirmish prediction'});
}

function skirmishAssess(s, power, options = {}){
    let score = 0;
    let yourFleet = s.fleets.reduce((a,f) => a + f.cubes.length, 0);
    let c = calculateCombat('voidborn', s, {power, ...options});
    if(c.results.winner == 'invader' || c.results.winner == 'draw'){
        score = 1000 + yourFleet;
    }else{
        // Work out remaining fleet, presuming that you will try to minimise
        /*let smallest = Infinity;
        for(let r of c.results.routes){
            let sum = 0;
            for(let k of Object.keys(r.ending)){
                sum += r.ending[k];
            }
            if(sum < smallest) smallest = sum;
            score += smallest;
        }*/

        let largest = 0;
        for(let r of c.results.routes){
            if(r.defenderDamage > largest) largest = r.defenderDamage;
        }
        score += largest;
    }
    return {
        data: c,
        score
    }
}

function skirmishTiebreak(s){
    // First to least important
    let score = 0;
    if(!s.corrupted) score += .1;
    score += s.population * .01;
    score += s.guilds.length * .01; 
    return score;
}

export function isSkirmishTarget(p, s){
    let targets = skirmishData(p).sectors;
    if(targets.includes(s.id)) return true;
    return false;
}

function skirmishData(p, options = {}){
    options.adaptive = true;
    let power = skirmishPower(p, options);
    
    let eligibleSectors = playerSectors(p).filter(s => !sectorSpecial(s, 'no_voidborn') && (s.edgeHarbinger || all('sectors').some(t => (controlledBy(t, 'voidborn') || t.harbingers.length > 0) && isAdjacent(s, t))));
    let o = ongoingGeneral().find(o => o.type == 'min_influence_invasion');
    if(o && p.influence <= o.min){
        eligibleSectors = []; // Cannot be attacked
    }
    if(eligibleSectors.length == 0){
        return {
            sectors: [],
            power: 0,
            willLoseSector: false,
            willTakeDamage: false
        };
    }
    let scores = {};
    for(let s of eligibleSectors){
        scores[s.id] = {
            ...skirmishAssess(s, power, options)
        }
        scores[s.id].finalScore = scores[s.id].score;
    }
    eligibleSectors = eligibleSectors.sort((a,b) => {
        // Prefer wins or ties
        let aScore = scores[a.id].score;
        let bScore = scores[b.id].score;
        if(aScore != bScore) return bScore - aScore;

        // Tiebreaks
        aScore = skirmishTiebreak(a);
        bScore = skirmishTiebreak(b);
        scores[a.id].finalScore = scores[a.id].score + aScore;
        scores[b.id].finalScore = scores[b.id].score + bScore;
        if(aScore != bScore) return bScore - aScore;

        // Then random
        // Add to ties list first so we know it's new info
        return a.id.localeCompare(b.id); // Stable display order; all rules-tied targets remain eligible.
    });
    let toReturn = [];
    let basicScore = scores[eligibleSectors[0].id].finalScore;
    for(let i = 0; i < eligibleSectors.length && scores[eligibleSectors[i].id].finalScore == basicScore; i++){
        toReturn.push(eligibleSectors[i].id);
    }
    let willLoseSector = false;
    let willTakeDamage = false;
    if(basicScore >= 1000){
        willLoseSector = true;
    }else if(Math.floor(basicScore) > 0){
        willTakeDamage = true;
    }

    let data = {};
    for(let s of toReturn){
        data[s] = scores[s].data;
    }

    let ret = {
        sectors: toReturn,
        willLoseSector,
        willTakeDamage,
        data,
        power,
        boostLog: options.boostLog || []
    }
    console.log(`Skirmish data requested:`, ret, scores);
    return ret;
        //eligibleSectors[0];s
}

export function skirmishPower(p, options = {}){
    // Power of a skirmish against this player
    // Options allows for things like cards altering the value
    let power = 0;
    options.boostLog = [];
    for(let a of p.agendas){
        if(a.corrupted) power++;
    }
    for(let t of Object.keys(p.tracks)){
        if(p.tracks[t].corrupted) power++;
    }

    options.boostLog.push('Base power level due to House Mat corruption: '+power);

    let o = ongoingGeneral().find(o => o.type == 'min_influence_invasion');
    if(o && p.influence < o.min){
        options.boostLog.push('[[galactic_event]]: Player has < 40 [[influence]], so no Skirmish');
        options.noSkirmish = true;
        return 0; // Cannot be invaded
    }
    

    if(get(state).mode == 'coop'){
        if(get(state).crisis_board.current_alert && get(state).crisis_board.current_alert.type == 'war'){
            let mods = get(state).crisis_board.current_alert[`cycle_${get(state).turn.cycle}_mods`];
            if(mods){
                for(let k of Object.keys(mods)){
                    if(options[k] && typeof options[k] == 'number'){
                        options[k] += mods[k];
                    }else{
                        options[k] = mods[k];
                    }
                }
            }
            // Add boost logging for these mods here
        }else if(options.inEvaluation){

            if(get(state).turn.cycle > 1){
                power++; 
                options.boostLog.push('+1 for Evaluation Phase in cycles 2 & 3');
            }
        }
        let militaryBoost = getCrisisMilitaryBoost();
        power += militaryBoost;
        options.boostLog.push(`+${militaryBoost} for unresolved Crisis cards on Military track`);
    }else{
        if(get(state).turn.cycle > 1){
            power++;
            options.boostLog.push('+1 for Evaluation Phase in cycles 2 & 3');
        }
    }

    if(ongoingPlayer(p).includes('extra_skirmish_power')){
        power++; //
        options.boostLog.push('+1 for Shiveus specific House effect');
    }

    if(options.voidborn_power){
        power += options.voidborn_power;
        options.boostLog.push(`${options.voidborn_power > 0 ? '+' : '-'}${Math.abs(options.voidborn_power)} for specific modifiers on War or Event card(s)`);
    }

    return power;
}

export async function resolveSkirmish(p, options = {}){
    //let power = skirmishPower(p, {...options, adaptive: true});
    let data = skirmishData(p, options);
    let targets = data.sectors;
    if(targets.length > 1) await newInformation(); // Tie, so decision is random hence new info
    let s = at(randomElements(targets, 1)[0]);
    let defended = false;
    log({
        type: 'stats',
        skirmishPower: data.power
    }, p)
    if(options.noSkirmish){
        log('No [[skirmish]] takes place at all (this is usually because of the event card [[galactic_event]] Disruption Within');
        return;
    }
    if(!s){
        log('No eligible sector, so no [[skirmish]] Skirmish will take place', p);
        // I _think_ this is still a success?
        defended = true;
        if(options.defender_reward){
            if(typeof options.defender_reward == 'string') options.defender_reward = expandAction(options.defender_reward)
            try{
                await executeActions(p, {...options.defender_reward}, {compulsory: true}); // Always compulsory?
            }catch(e){
                if(e == 'uncompleted' || e == 'impossible'){
                    console.log('Action not able to complete');
                    
                }else{
                    throw e;
                }
            }
            
        }
    }else if(data.power == 0){
        log('Skirmish power is 0, so it is automatically defended successfully', p);
        // I _think_ this is still a success?
        defended = true;
        if(options.defender_reward){
            if(typeof options.defender_reward == 'string') options.defender_reward = expandAction(options.defender_reward)
            try{
                await executeActions(p, {...options.defender_reward, postCombat: s.id}, {compulsory: true}); // Always compulsory?
            }catch(e){
                if(e == 'uncompleted' || e == 'impossible'){
                    console.log('Action not able to complete');
                    
                }else{
                    throw e;
                }
            }
        }
    }else if(get(state).turnInfo.breadcrumbs.includes('evaluation phase') && hasTech(p, 'Autonomous Drones')){
        // Allow option to win
        if(hasTech(p, 'Autonomous Drones', 'improved')){
            await pause('[[improved_tech]] Autonomous Drones: you automatically win [[skirmish]] Skirmishes in the Evaluation Phase');
            defended = true;
        }else if(tradeTokens(p).length > 0){
            let doIt = await choose(`[[basic_tech]] Autonomous Drones: pay 1 [[trade]] token to automatically win the [[skirmish]] Skirmish?`, ['Yes', 'No']);
            if(doIt == 'Yes'){
                await pay(p, {trade: 1});
                defended = true;
            }
        }
    }
    if(!defended){
        // Only do this if not handled above
        try{
            let winner = await combat('voidborn', s, {skirmish: true, power: data.power, ...options});
            if(winner == 'defender'){
                defended = true;
            }
        }catch(e){
            if(e == 'uncompleted' || e == 'impossible'){
                console.log('Action not able to complete');
                
            }else{
                throw e;
            }
        }
    }
    log({
        type: 'stats',
        skirmishDefended: defended
    }, p)
    
    if(defended && ongoingPlayer(p).includes('skirmish_defend_influence')){
        log(`Gaining House reward for successful [[skirmish]] defence`)
        await doAction(p, 'gain_influence', {num: 2, from: 'combat'})
    }
    /*if(defended && options.defender_reward){
        // Get reward for successful Skirmish
        await executeActions(p, options.defender_reward);
    }*/
}

async function handleCombatWin(winner, sector){

}

export async function combat(invader, sector, options = {}, params = {}){
    // Split out calculation from execution for things like choosing best skirmish location
    // ... or giving quick predictions/hints etc.

    let {results, data} = calculateCombat(invader, sector, options);
    //console.log('combat info', results, data);
    let type = 'Combat';
    if(options.skirmish) type = `[[skirmish]] Skirmish`
    let text = `${type} in sector ${sector.key}: ${results.winner == 'draw' ? 'mutual destruction': `victory for ${results.winner}`}`
    console.log('Combat info', results, data);
    log(text);
    
    // Make choice and handle it
    let loser = ['invader', 'defender'].find(r => results.winner != r);
    let alreadyPaused = false;
    let chosenRoute = results.routes[0];
    if(results.routes.length > 1 && Array.from(new Set(results.routes.map(r => r.winner))).length > 1){
        // Your choice might make the difference between winning or drawing, so choose:
        let choices = [];
        for(let r of results.routes){
            choices.push({
                type: 'text',
                choice: renderRoute(r),
                value: r
            })
        }
        chosenRoute = await choose(`Multiple results possible: choose your desired outcome`, choices, {p: data.invader.p, combat: results.routes, dragHandleOnly: true, name: 'Combat results'});
        if(chosenRoute == 'cancelled') throw 'cancelled';
        results = {
            winner: chosenRoute.winner,
            routes: [chosenRoute]
        };
        alreadyPaused = true;
        // Now fall through to actually make it happen
    }
    if(results.winner == 'draw'){
        // Clear the sector  
        if(!alreadyPaused) chosenRoute = await pause(text, {combat: results.routes, dragHandleOnly: true, name: 'Combat results'});
        if(chosenRoute == 'cancelled') throw 'cancelled';
        if(Object.keys(chosenRoute.cost).length > 0) await pay(data.invader.p, chosenRoute.cost, {purpose: 'execute combat effects'});
        if(invader.fleets && !sector.fallen_house && hasTech(invader, 'Combat Replicators', 'improved') && await ask('[[improved_tech]] Combat Replicators: do you want to deploy a fleet here to win the combat?', {foreground: invader.techs.find(t => t.name == 'Combat Replicators')})){
            // The result is that this will be the only fleet left in the sector
            
            let fbt = sectorFleetsByType(sector, invader.colour);
            await combatRecall(invader, fbt); // Before deploying so it can't fail
            await doAction(invader, 'deploy', {place: sector});
            await clearFleets(sector, data.defender.colour || 'voidborn', 'combat'); 
                /*
            if(sector.fallen_house){
                // Need special behaviour because otherwise the sector will be abandoned
                
            }else{
                await clearFleets(sector, invader.colour, 'combat');
                await doAction(invader, 'deploy', {place: sector});
                await clearFleets(sector, data.defender.colour || 'voidborn', 'combat'); // Order will hopefully sort out!
            }*/
            
            await combatRewards(invader, sector, data.defender.p, {...options, ...params, winner: 'invader'});
            params.alreadyReacted = true; // Rather nasty but not sure how else to block default action reactions
            return 'invader'; // as the winner
        }else{
            await clearFleets(sector, data.invader.colour || 'voidborn', 'combat'); 
            await clearFleets(sector, data.defender.colour || 'voidborn', 'combat'); 
        }
    }else if(data[results.winner].colour == 'voidborn'){
        if(!alreadyPaused) chosenRoute = await pause(text, {combat: results.routes, dragHandleOnly: true, name: 'Combat results'});
        if(chosenRoute == 'cancelled') throw 'cancelled';
        if(Object.keys(chosenRoute.cost).length > 0) await pay(data.invader.p, chosenRoute.cost, {purpose: 'execute combat effects'});
        if(results.winner == 'invader'){
            // Discard glory boooo
            await clearFleets(sector, data.defender.colour, 'combat');
            // Sector is abandoned
        }else{
            await clearFleets(sector, data.invader.colour, 'combat');
            
            await rationaliseFleets(sector, chosenRoute.ending, 'voidborn'); //right?
            await doActionPause();
        }
    }else{
        // A human player won
        let chosenRoute = results.routes[0];
        if(results.routes.length != 1){
            let choices = [];
            for(let r of results.routes){
                choices.push({
                    type: 'text',
                    choice: renderRoute(r),
                    value: r
                })
            }
            chosenRoute = await choose(`Multiple paths to victory for ${data[results.winner].p.colour}: choose your desired outcome`, choices, {p: data[results.winner].p, combat: results.routes, dragHandleOnly: true, name: 'Combat results'});
            if(chosenRoute == 'cancelled') throw 'cancelled';
        }else{
            if(!alreadyPaused) await pause(text, {combat: chosenRoute, dragHandleOnly: true, name: 'Combat results'});
        }
        
        let fleetsInvadedWith = sumAllKeys(data.invader.fleets);
        
        // Pay cost!
        if(Object.keys(chosenRoute.cost).length > 0) await pay(data[results.winner].p, chosenRoute.cost, {purpose: 'execute combat effects'});
        if(chosenRoute.deployedCorvettes) await doAction(data.invader.p, 'deploy', {type: 'corvette', num: chosenRoute.deployedCorvettes, place: sector, noReplace: true}); // Do it before rationalising
        await rationaliseFleets(sector, chosenRoute.ending, data[results.winner].colour);
        
        // Clear loser's fleets too
        await clearFleets(sector, data[loser].colour || 'voidborn', 'combat');
        await doActionPause();
        /*if(results.routes.length == 1){
            await pause(`Victory for ${data[results.winner].p.colour}! ${renderRoute(chosenRoute)}`)
        }*/
        // Take rewards!
        if(results.winner == 'invader'){
            
            let winP = data[results.winner].p;
            log({
                type: 'stats',
                sectorTaken: sector.type,
                fleetsInvadedWith,
                empireSize: playerSectors(winP).length,
                gloryScoredFromInvasion: winP.glory.reduce((a,g) => a + g.value, 0),
                sectorTypes: Array.from(new Set(playerSectors(winP).map(s => s.type)))
            }, winP)
            if(winP.fleets && winP.fleets.active.length > 0 && hasTech(invader, 'Combat Replicators', 'improved') && await ask('[[improved_tech]] Combat Replicators: do you want to deploy a fleet here?', {foreground: invader.techs.find(t => t.name == 'Combat Replicators')})){
                await doAction(winP, 'deploy', {place: sector});
            }
            // Log general stats about them
            
            await combatRewards(winP, sector, data[loser].p, {...options, ...params, winner: 'invader'})
            params.alreadyReacted = true; // Rather nasty but not sure how else to block default action reactions
        }else if(data[results.winner].p && options.defender_reward){
            if(typeof options.defender_reward == 'string') options.defender_reward = expandAction(options.defender_reward)
            await executeActions(data[results.winner].p, {...options.defender_reward, postCombat: sector.id}, {compulsory: true}); // Always compulsory?
        }
        
    }
    return results.winner;
} 



export async function combatRewards(p, sector, loser, params){

    checkTriggeredEffects(p, params, 'after');

    await undoableOptions(
        async () => {
            let options = [];
            let extras = {};
            let text = `Choose post-combat actions to take, in any order`;

            if(hasRemovableInstallations(sector)){
                options.push(
                    {
                        type: 'text',
                        choice: `Clear sector installations${hasTech(p, 'Combat Replicators') ? ' (optional)' : ''}`,
                        compulsory: !hasTech(p, 'Combat Replicators'),
                        action: async () => await clearInstallations(at(sector.id)),
                    }
                );
            }
            let newInfo = false;

            if(sector.bounty && sector.bounty.length > 0){
                if(!newInfo) await newInformation();
                newInfo = true;
                if(!extras.foreground) extras.foreground = [];
                for(let b of sector.bounty){
                    b.value.flipped = true;
                    extras.foreground.push(b);
                    options.push(
                        {
                            choice: `[[bounty]]: ${getReadableDescription(b.value.effect)}`,
                            compulsory: true,
                            action: async () => {
                                p = get(state).players.find(pl => pl.colour == p.colour);
                                let obj = at(b.id);
                                await doAction(p, 'gain_bounty', {obj});
                            }
                        }
                    )
                }
                /*options.push(
                    {
                        choice: `Gain and resolve [[bounty]] token(s)`,
                        compulsory: true,
                        action: async () => {
                            let s = at(sector.id); // Reload out of closure
                            p = get(state).players.find(pl => pl.colour == p.colour);
                            while(s.bounty.length > 0){
                                await doAction(p, 'gain_bounty', {obj: s.bounty[0]});
                            }
                        }
                    }
                )*/
            }

            if(sector.reclaim && sector.reclaim.length > 0){
                if(!newInfo) await newInformation();
                newInfo = true;
                if(!extras.foreground) extras.foreground = [];
                for(let r of sector.reclaim){
                    r.value.flipped = true;
                    extras.foreground.push(r);
                    options.push(
                        {
                            choice: `[[reclaim]]: ${getReadableDescription(r.value.effect)}`,
                            compulsory: true,
                            action: async () => {
                                p = get(state).players.find(pl => pl.colour == p.colour);
                                let obj = at(r.id);
                                await doAction(p, 'gain_reclaim', {place: sector.id, obj});
                            }
                        }
                    )
                }
                /*options.push(
                    {
                        choice: `Gain and resolve [[reclaim]] token(s)`,
                        compulsory: true,
                        action: async () => {
                            let s = at(sector.id); // Reload out of closure
                            p = get(state).players.find(pl => pl.colour == p.colour);
                            while(s.reclaim.length > 0){
                                await doAction(p, 'gain_reclaim', {obj: s.reclaim[0], place: s});
                            }
                        }
                    }
                )*/
            }

            options.push(
                {
                    choice: `${sector.glory && sector.glory.length > 0 ? 'Gain and s' : 'S'}core Glory token(s)`,
                    compulsory: true,
                    action: async () => {
                        let s = at(sector.id); // Reload out of closure
                        p = get(state).players.find(pl => pl.colour == p.colour); // Reload out of closure  
                        while(s.glory.length > 0){
                            //moveBitTo(g, p.glory);
                            await doAction(p, 'gain_glory', {obj: s.glory[0]});
                        }
                        log('Scoring glory for successful combat');
                        let totalToScore = 0;
                        if(loser && loser != 'voidborn'){
                            loser = get(state).players.find(p => p.colour == loser.colour); // Reload out of closure
                            totalToScore += loser.glory.reduce((a,c) => a + c.value, 0);
                            if(loser.glory.length > 0) await doAction(loser, 'discard_glory');
                        }else{
                            totalToScore += p.glory.reduce((a,c) => a + c.value, 0);
                        }
                        if(totalToScore > 0) await doAction(p, 'gain_influence', {num: totalToScore, from: 'combat'});
                    }
                }
            )

            if(sector.type == 'rift'){
                options.push(
                    {
                        choice: 'Close the Rift',
                        compulsory: true,
                        action: async () => {
                            let sec = at(sector.id);
                            state.update(s => {
                                s.sectors[sec.key] = {
                                    ...s.sectors[sec.key],
                                    ...jsonpatch.deepClone(basicSector),
                                    fleets: [...sec.fleets],
                                    population: 1,
                                    corrupted: false
                                };
                                ui.update(ui => {
                                    ui.sectorImages[sec.id] = getBGImage(s.sectors[sec.key]);
                                    return ui;
                                })
                                return s;
                            })
                        }
                    }
                )
            }

            if(sector.on_invade){
                options.push(
                    {
                        choice: `Sector invasion effect${sector.on_invade.compulsory ? '' : ' (optional)'}: ${getReadableDescription(sector.on_invade)}`,
                        compulsory: sector.on_invade.compulsory,
                        action: async () => await executeActions(p, sector.on_invade, {source: sector.id})
                    }
                )
            }
            if(sector.harbingers && sector.harbingers.length > 0){
                options.push(
                    {
                        choice: `Move [[harbinger]] token(s)`,
                        compulsory: true,
                        action: async () => {
                            let s = at(sector.id);
                            while(s.harbingers.length > 0){
                                // Gain any relevant harbingers
                                let h = s.harbingers[0];
                                //await returnToken(h); // To not trigger Precision Strike
                                //await doAction(p, 'return_token', {obj: h}); // To trigger 'precision strike'
                                let track = await choose(`Which track of the Crisis Board would you like to put this [[harbinger]] on?`, ['military', 'economic'], {foreground: h});
                                await addToCrisisBoard(p, h, '[[harbinger]]', track);
                            }
                        }
                    }
                )
            }

            if(sector.fallen_house){
                p.fallen_claimed = true;
                if(!extras.foreground) extras.foreground = [];
                extras.foreground.push(sector.fallen_house);
                options.push(
                    {
                        choice: `Fallen House tech: [[gain_tech]]`,
                        disabled: !at(sector.id).fallen_house.techs.some(t => !p.techs.some(tech => tech.name == t)),
                        compulsory: false,
                        action: async () => {
                            sector = at(sector.id);
                            p = get(state).players.find(pl => pl.colour == p.colour);
                            log(`Fallen house ${sector.fallen_house.name}: claiming [[gain_tech]] reward!`);
                            let possTechs = sector.fallen_house.techs.filter(t => !p.techs.some(tech => tech.name == t))
                            if(possTechs.length > 0){
                                try{
                                    await doAction(p, 'gain_tech', {chooseFrom: possTechs, optional: true});
                                }catch(e){
                                    if(e != 'cancelled') throw e; // It's optional!
                                }
                            }
                        }
                    }
                )
                options.push(
                    {
                        choice: `Fallen House reward: ${getReadableDescription(sector.fallen_house.fallen.effect)}`,
                        disabled: !canDo(p, sector.fallen_house.fallen.effect),
                        compulsory: false,
                        action: async () => {1
                            sector = at(sector.id);
                            p = get(state).players.find(pl => pl.colour == p.colour);
                            log(`Fallen house ${sector.fallen_house.name} liberated!`);
                            // Set sector for fallen house effect
                            cacheSector(sector);
                            try{
                                await executeActions(p, sector.fallen_house.fallen.effect);
                            }catch(e){
                                if(e != 'cancelled') throw e; // It's optional!
                            }    
                        }
                    }
                )
            }

            return {
                options,
                text,
                extras
            }
        },
        (options) => {
            setProductionLevels(p);
            if(loser && loser != 'voidborn') setProductionLevels(loser); // In case of winning or losing ones that affect production
            return [...options, ...getReactionChoicesUO(p)];
        }
    );

    if(sector.fallen_house){
        moveBitTo(sector.fallen_house, get(state).spare_cards);
    }

    return;

   
}

export function calculateCombat(invader, sector, options = {}){
    // Needs to create a data structure from fleet info

    let data = fillPlayerCombatData(invader, sector); // Separate to make skirmish easier
    data.options = options;
    if(invader == 'voidborn'){
        // i.e. a skirmish
        let defender;
        for(let f of sector.fleets){
            if(f.owner) defender = get(state).players.find(p => p.colour = f.owner);
        }
        data.invader.fleets = {
            voidborn: options.power // || skirmishPower(defender, options)
        };

        // Don't think there's anything else?
    }
    if(options.bombard){
        data.invader.techs = [...data.invader.techs, 'bombard']
    }
    if(sector.fallen_house){
        // add defenses
        data.defender.bases = {defense: 2};
    }
    let results = executeCombat(data);
    //console.log('combat results', results);
    return {
        data,
        results
    };
}

export function renderRoute(r){
    let text = '<div style="display: flex;"><div style="white-space: nowrap;">';
    let fp = [];
    let c = [];
    for(let k of Object.keys(r.ending)){
        fp.push(`${r.ending[k]} [[${k}]]`);
    }
    text += fp.join(', ');
    if(Object.keys(r.cost).length > 0){
        text += '</div><div style="white-space: nowrap;">';
        c.push(renderCost(r.cost));
    }
    if(r.deployedCorvettes){
        text += `</div><div style="white-space: nowrap;">[[deploy]] ${r.deployedCorvettes}`;
    }
    text += c.join(', ')+'</div></div>';
    return text;
}

async function rationaliseFleets(s, finalFleets, colour){
    // Make number of fleets match that listed,
    // prioritising minimum fleet stands

    // Before we do anything else, if
    
    // First, get the previous picture
    let p = colour;
    if(p != 'voidborn') p = get(state).players.find(p => p.colour == colour);
    let prevFleets = {};
    let fleetsByType = sectorFleetsByType(s, colour);
    for(let f of s.fleets){
        if(f.owner == colour){
            if(!prevFleets[f.type]){
                prevFleets[f.type] = 0;
            }
            prevFleets[f.type] += f.cubes.length;
        }
    }
    
    // Now go through and compare. If you have more, lose some 
    for(let k of Array.from(new Set([...Object.keys(prevFleets), ...Object.keys(finalFleets)]))){
        let toLose = 0;
        console.log('comparing', k, finalFleets[k], prevFleets[k])
        if(!finalFleets[k]){
            // None left, so clear all of them!
            toLose = prevFleets[k];
        }else if(!prevFleets[k]){
            // Actually add some!! (probably corvettes due to Carrier ability)
            toLose = -finalFleets[k]
        }else{
            toLose = prevFleets[k] - finalFleets[k];
        }
        if(toLose >= 0){
            fleetsByType[k] = fleetsByType[k].slice(0, toLose);
            /*for(let _ of Array(toLose)){
                await doAction(p, 'recall', {obj: fleetsByType[k][0], reason: 'combat'})
                //await moveFleet(p, fleetsByType[k][0].id, 'active'); // Recall them...
                ////console.log(fleetsByType[k][0]);
            }*/
        }else if(toLose < 0){
            // Actually add some!
            // NB TODO presume checking is done in Carriers
            throw 'adding fleets...!'
            //alert('Apparently due to add more fleets, not lose any: this is a bug!')
            let toAdd = Math.abs(toLose)
            for(let _ of Array(toAdd)){
                await doAction(p, 'deploy', {place: s, type: k})
                //await moveFleet(p, 'active', s.id, 'invade', k);
            }
        }
    }

    console.log('rationalised', prevFleets, fleetsByType)
    // now fleetsByType should be a list of things to recall, so recall in a routine that takes Escape Pods into account
    await combatRecall(p, fleetsByType);
}

function resetCombatSequence(){
    for(let c of combatSequence){
        if(c.origNext){
            c.next = c.origNext;
            delete c.origNext;
        }
    }
}

function finishDisplayStep(data, info){
    data.currentDisplay = {...data.currentDisplay, ...info};
    data.currentDisplay.invader.kept = {...data.invader.fleets};
    data.currentDisplay.defender.kept = {...data.defender.fleets};
   
    data.display.push(jsonpatch.deepClone(data.currentDisplay));
    data.currentDisplay = {invader: {}, defender: {}};
}

function addDisplay(data, role, type, subkey,  amount){
    addSubProp(data.currentDisplay[role], type, subkey, amount);
}

function generateDisplay(before, after, token){   
    if(Array.isArray(after)){
        for(let c of after) generateDisplay(before, c, token);
        return;
    }
    let disp = after.currentDisplay;
    for(let r of ['invader', 'defender']){
        let damageDiff = (after[r].salvoDamage - before[r].salvoDamage) + (after[r].approachDamage - before[r].approachDamage);
        if(damageDiff) addSubProp(disp[r], 'damage', token, damageDiff);
        let absorptionDiff = (after[r].approachAbsorption - before[r].approachAbsorption);
        if(absorptionDiff) addSubProp(disp[r], 'absorption', token, absorptionDiff);
        if(after[r].salvoAbsorption){
            if(!disp[r].absorption || sumAllKeys(disp[r].absorption) < after[r].salvoAbsorption){
                if(!disp[r].absorption){
                    disp[r].absorption = {};
                    if(before.currentDisplay.absorption && before.salvoRound > 0) disp[r].absorption = jsonpatch.deepClone(before.currentDisplay.absorption);
                }
                let diff = after[r].salvoAbsorption - sumAllKeys(disp[r].absorption);
                if(diff) disp[r].absorption[token] = diff; //salvoAbsorption = addSubProp(disp[r], 'absorption', token, after[r].salvoAbsorption)
            }else if(after.salvoRound > 1 && before.currentDisplay.absorption && sumAllKeys(before.currentDisplay.absorption) > after[r].salvoAbsorption){
                // Take some off, since some was lost from last time
                let diff = sumAllKeys(before.currentDisplay.absorption) - after[r].salvoAbsorption;
                disp[r].absorption = jsonpatch.deepClone(before.currentDisplay.absorption);
                // Then whittle down
                while(diff > 0){
                    let k = Object.keys(disp[r].absorption)[0];
                    if(disp[r].absorption[k] > 0) disp[r].absorption[k]--;
                    if(!disp[r].absorption[k]) delete disp[r].absorption[k];
                    diff--;
                }
            }
        }
        let iniDiff = (after[r].initiative - before[r].initiative)
        if(iniDiff) addSubProp(disp[r], 'initiative', token, iniDiff);
    }
}



function addSubProp(root, key, subkey, num){
    if(!root[key]) root[key] = {};
    if(!root[key][subkey]) root[key][subkey] = 0;
    root[key][subkey] += num;
}

function executeCombat(data){

    data.display = [
        {
            type: 'starting',
            invader: {
                fleets: {...data.invader.fleets},
                bases: {...data.invader.bases}
            },
            defender: {
                fleets: {...data.defender.fleets},
                bases: {...data.defender.bases}
            }
        }
    ];
    data.currentDisplay = {
        invader: {},
        defender: {}
    }
     
    let slots = {
        approach: [],
        initiative: [],
        salvo: []
    }
    let available = [];
    for(let k of ['invader', 'defender']){
        available.push('corvette', ...Object.keys(data[k].bases), ...Object.keys(data[k].fleets), ...data[k].techs.map(t => t.split('.')[0]));
    }
    available = Array.from(new Set(available));
    //console.log('contributors', available);
    for(let a of Object.keys(tokenActions)){
        if(!available.some(av => av == a)) continue;
        for(let k of Object.keys(tokenActions[a])){
            // NB need to order these so techs that trigger off ship things go last. So techs last, ships first
            slots[k].push({
                name: `${a}_${k}`,
                token: a,
                func: makeFunc(tokenActions, a, k, data)
            });
        }
    }
    //console.log('slots', slots);
    slots.salvo_first = slots.salvo;
    slots.salvo_second = slots.salvo;
    slots.salvo_sim = slots.salvo;
    delete slots.salvo;
    let finalSequence = [];
    for(let s of combatSequence){
        if(Object.keys(slots).some(k => s.name.startsWith(k))){
            let k = Object.keys(slots).find(k => s.name.startsWith(k))
            if(slots[k].length > 0){
                if(!slots[k][0].slotsFilled) slots[k][0].slotsFilled = []
                slots[k][0].slotsFilled.push(s.name);
                finalSequence.push(...slots[k]);
            }else{
                finalSequence.push(s); // empty placeholder
            }
            
        }else{
            finalSequence.push(s); 
        }
    }

    let last = finalSequence[finalSequence.length - 1];

    

    for(let i = finalSequence.length - 1; i >= 0; i--){
        let s = finalSequence[i];
        if(!s.next) s.next = last;
        if(typeof s.next == 'string' && s.next.endsWith('_slot')){
           let replacement = finalSequence.find(f => f.slotsFilled && f.slotsFilled.includes(s.next));
           s.origNext = s.next;
           if(replacement) s.next = replacement.name;
        }
        last = s.name;
    }

    //console.log(finalSequence);
    let course = [];
    //let pos = finalSequence[0];
    //data.next = finalSequence[0].name;
    data.next = finalSequence[0].name;
    data.parent = 'root';
    let current = [jsonpatch.deepClone(data)];
    course = [current];
    let beforeStep;
    do{
        let future = [];
        //let route = 0;
        for(let c of current){
            //if(c.choice) //console.log(c);
            //if(c.winner) continue;
            //c.route = route++;
            //let copy = jsonpatch.deepClone(c);
            if(checkEnd(c)) continue; // Skip
            if(c.nextSalvoCalc && typeof c.next == 'string' && c.next.startsWith('calcS')){
                ////console.log('leaping to '+c.nextSalvoCalc);
                c.next = c.nextSalvoCalc;
                delete c.nextSalvoCalc;
            }
            let seq = finalSequence.find(f => f.name == c.next || f.slotsFilled && f.slotsFilled.includes(c.next));
            
            let copy = jsonpatch.deepClone(c);
            copy.currentStage = seq.name;
            copy.log = '';
            delete copy.choice;
            delete copy.choiceID;

            if(seq.token) beforeStep = jsonpatch.deepClone(copy);

            let ret = seq.func(copy);

            if(seq.token) generateDisplay(beforeStep, ret, seq.token)

            //if(copy.winner) //console.log('winner', copy)
            if(!Array.isArray(ret)){
                ret = [ret];
            }
            for(let r of ret){
                if(typeof seq.next == 'function'){
                    r.next = seq.next(r);
                }else{
                    r.next = seq.next;
                }
               ////console.log(r.log);
            }
            ////console.log('before', ret)
            ret = prune(ret);
            ////console.log('after', ret)
            for(let r of ret){
                r.parent = makeParent(c);//JSON.stringify({invader: c.invader.fleets, defender: c.defender.fleets});
            }
            future = [...future, ...ret];
            //future = prune(future);
       }
       future = prune(future);
       ////console.log(course)
       //future = prune(future);
       course.push(future);
       current = future//filter(f => !f.winner); // Only continuing ones
       ////console.log(current);
        /*if(!branches.choices){
            branches = execAndNext(branches, finalSequence.find(f => f.name == branches.next));
        }else{
            replaceAtTop(branches, (b) => execAndNext(b, finalSequence.find(f => f.name == b.next)));
        }
        //console.log('combat ongoing', branches);*/
        ////console.log(course);
    }while(someBranchRunning(current));
   // //console.log(current)
    let results = {};
    let remaining = [];
    let routes = findRoutes(course);//buildRoutes(course);
    let winningRoutes = [];
    let winner = 'draw';
    //console.log('all routes', routes)
    for(let k of ['invader', 'defender']){
        let wr = findWinnableRoutes(routes, k);
        //console.log('winning routes for '+k, wr.map(r => r.filter(s => s.choice)))
        if(wr.length > 0){
            winner = k;
            winningRoutes = wr;
            if(!wr.some(r => r[r.length - 1].winner == k)) winner = 'draw'; // For Combat Replicators
            break; // !! TODO go back over all this code later...
        }
    } 
    if(winningRoutes.length == 0){
        winningRoutes = routes;
    }
    ////console.log('winner is '+winner, winningRoutes);

    resetCombatSequence();
    
    //console.log('combat ended', routes, winner, winningRoutes);
    let sanitised = [];
    //let routesToReturn = winner == 'draw' ? routes : winningRoutes;
    for(let r of winningRoutes){
        let entry = {
            log: '',
            display: {},
            winner: '',
            ending: {},
            cost: {},
            invaderDamage: 0,
            defenderDamage: 0,
        }
        for(let s of r){
            ////console.log(s, s.log);
            entry.log += s.log;
            if(s.winner){
                entry.display = s.display;
                entry.winner = s.winner;
                if(s.winner != 'draw'){
                    entry.ending = s[s.winner].fleets;
                }else{
                    entry.ending = {voidborn: 2}; // Because that's what happens!
                }
                if(!results[s.winner]) results[s.winner] = 0;
                results[s.winner]++;
                if(s.winner != 'draw'){
                    remaining.push(s[s.winner].fleets);
                    //if(s[s.winner].cost) entry.cost = s[s.winner].cost;
                }
                if(s.invader.cost) entry.cost = s.invader.cost; // Only invaders pay for things
                if(s.invader.deployedCorvettes) entry.deployedCorvettes = s.invader.deployedCorvettes;
                entry.invaderDamage = s.invader.damageTaken || 0;
                entry.defenderDamage = s.defender.damageTaken || 0;
            }
        }
        entry.full = r;
        if(!sanitised.some(s => JSON.stringify(s.ending) == JSON.stringify(entry.ending) && JSON.stringify(s.cost) == JSON.stringify(entry.cost))) sanitised.push(entry);
    }
    sanitised = sanitised.sort((a,b) => {
        let totalA = sumAllKeys(a.ending);
        let totalB = sumAllKeys(b.ending);
        if(totalA != totalB) return totalB - totalA;
        let costA = sumAllKeys(a.cost);
        let costB = sumAllKeys(b.cost);
        if(costA != costB) return costA - costB;
        // If same otherwise, prefer the one with fewer corvettes where possible
        return (a.ending.corvette || 0) - (b.ending.corvette || 0);
    });
    if(!get(prefs).showAllRoutes){
        sanitised = sanitised.filter(r => !sanitised.some(route => route != r && allKeysEqualOrGreater(route.ending, r.ending) && allKeysEqualOrGreater(r.cost, route.cost)))
    }
    if(!sanitised.some(s => s.winner == winner)){
        winner = sanitised[0].winner;
    }
    //anitised = prune(sanitised)
    remaining = prune(remaining)
    //console.log('Routes', sanitised, remaining);
    return {
        winner,
        routes: sanitised
    }
}

function allKeysEqual(a,b){
    for(let k of Object.keys(a)){
        if(b[k] != a[k]) return false;
    }
    for(let k of Object.keys(b)){
        if(b[k] != a[k]) return false;
    }
    return true;
}

function allKeysEqualOrGreater(a, b){
    for(let k of Object.keys(a)){
        if(b[k] && b[k] > a[k]) return false;
    }
    for(let k of Object.keys(b)){
        if(!a[k]) return false;
    }
    return true;
}

function sumAllKeys(obj){
    return Object.keys(obj).reduce((a, k) => a + obj[k], 0) || 0;
}

function winnable(root, invader){
    // Work from the top back
    let winnableRoutes = [];
    for(let i = root.length - 1; i >= 0; i--){
        
    }
}

function isParent(p, c){
    return c.parent == makeParent(p);
}

function endResult(route){
    return route[route.length - 1].winner;
}

function findWinningParallels(routes, who, fromStep, drawFor){
    //let fromStepParentCode = makeParent(fromStep);
    let parallels = [];
    for(let route of routes){
        if(endResult(route) != who && (who != drawFor || endResult(route) != 'draw')) continue;
        let hasSharedStep = false;
        for(let step of route){
            if(step.choice != who) continue;
            //let otherStepParentCode = makeParent(step);
            //if(otherStepParentCode != fromStepParentCode) continue;
            if(step.parent != fromStep.parent) continue;
            if(step.branch == fromStep.branch) continue; // So that a place that didn't branch from this specific decision isn't counted
            hasSharedStep = true;
        }
        if(hasSharedStep) parallels.push(route);
    }
    return parallels;
}

function canNeverWin(who, r, i, routes, drawFor = 'no-one', level = 0){
    let roles = ['invader', 'defender'];
    let other = roles.find(r => r != who);
    let s = r[i];

    if(s.invader.p && s.invader.p != 'voidborn' && hasTech(s.invader.p, 'Combat Replicators', 'improved') /*&& s.invader.p.fleets.active.length > 0*/){ // Commented out the active bit, because at a draw you would have lost some FP to put back
        drawFor = 'invader'; // Because you can make it a win
    }
    
    let parallelsTheyWin = findWinningParallels(routes, who, s, drawFor);//routes.filter(route => route.some(step => step.choice == who && /*step.parent*/makeParent(step) == makeParent(s))).filter(p => p[p.length - 1].winner == who || who == drawFor && p[p.length - 1].winner == 'draw');
    //if(parallelsTheyWin.length > 0) //console.log('checking whether '+who+` can ever win${drawFor == who ? ' or draw' : ''} in ${parallelsTheyWin.length} subroutes, position ${i + 1}, level ${level}`, r, parallelsTheyWin);
    if(parallelsTheyWin.length >= 1){
        for(let p of parallelsTheyWin){
            let currentIndex = p.findIndex(step => step.choice == who && step.parent == s.parent);
            ////console.log(p.filter(step => step.choice == who && step.parent == makeParent(s)))
            for(let j = currentIndex /*+ 1*/; j < p.length; j++){
                ////console.log(`i:${i}, currentINdex:${currentIndex}, j:${j}`)
                if(p[j].choice != other) continue;
                if(canNeverWin(other, p, j, routes.filter(ro => ro != r && ro != p), drawFor, level + 1)){
                    p[j].cannotWin = other;
                    return false;
                }
                // Otherwise route is avoidable by other
                ////console.log(`Choices of ${other} on this route can win them the route, so carrying on`, endResult(p), p)
            }
        
        }
    }
    
    r[i].cannotWin = who;
    ////console.log(`Every alternative route that would lead to victory for ${who} is avoidable by ${other}'s choices: so from this starting point the game is unwinnable for them`, i)
    return true;
}

function otherRole(role){
    return ['invader', 'defender'].find(r => r != role);
}

function winForUs(route, role){
    return endResult(route) != role && (endResult(route) != 'draw' || role == 'invader')
}

function processWinningRoutes(routes){
     
    let excludedRoutes = [];
    let routeCopies = jsonpatch.deepClone(routes);

    while(routeCopies.length > 0 && routeCopies.some(r => r.length > 0)){
        let route = routeCopies[0];
        let step = route[0];
        if(step.choice){
            let allMatches = routeCopies.filter(r => r.some(s => s.parent == step.parent));
            if(allMatches.every(r => winForUs(r, step.choice))){
                // We are now unbeatable
                return {
                    winner: step.choice,
                    routes: routes.filter(r => r.some(s => s.parent == step.parent))
                }
            }else if(allMatches.every(r => winForUs(r, otherRole(step.choice)))){
                // We now cannot win
                return {
                    winner: otherRole(step.choice),
                    routes: routes.filter(r => r.some(s => s.parent == step.parent))
                }
            }else{
                // Some win, some lose, so filter and carry on
                // So now we need to filter out any that definitely lose?
                for(let m of allMatches){

                }
            }
        }
    }
}

function findWinnableRoutes(routes, me){//current, root, i, me){
    let roles = ['invader', 'defender'];
    let them = roles.find(r => r != me);
    let winnable = [];
    for(let r of routes){
        if(r[r.length - 1].winner == 'draw'){
            let p = r[r.length - 1].invader.p;
            if(p && p != 'voidborn' && hasTech(p, 'Combat Replicators', 'improved') && p.fleets.active.length > 0){
                // Carry on!
            }else{
                continue;
            }
        }else if(r[r.length - 1].winner != me){
            continue; // Weed those bad boys out
        }
        let theyCannotWin = true;
        for(let j = 0; j < r.length; j++){
            let s = r[j];
            if(s.choice != them) continue; // Just looking for the ones where they make a choice
            if(!canNeverWin(them, r, j, routes, them)) theyCannotWin = false; //winnable.push(r);
            continue;
            let otherParallels = routes.filter(route => route.some(step => step.choice == them && step.parent == makeParent(s))).filter(p => p[p.length - 1].winner != me);
            if(otherParallels.length > 0){
                //console.log(them+' can force this route by making a different choice at '+makeParent(s), r, otherParallels);
                theyCannotWin = false;
            }
        }
        if(theyCannotWin) winnable.push(r);
    }
    return winnable;
    // Starts at a specific location and works out the routes from this to a winning strategy for the given player
    let path;
    if(current.winner == me) return current;
    
    if(current.winner == them || current.winner == 'draw') return false;
    let next = root[i + 1].filter(r => r.parent == makeParent(current)); // Only the connected routes
    ////console.log('next level...');
    if(next.length == 1){
        // Only one, so return it if it leads somewhere good
        let ret = findWinnableRoutes(next[0], root, i + 1, me);
        if(ret) return ret;
        return false;
    }
    //console.log(`looking at ${next.length} possible choices for this route`)
    // Recurse
   // let winnable = [];
    for(let n of next){
        if(n.choice == me || !findWinnableRoutes(n, root, i + 1, them)){
            let ret = findWinnableRoutes(n, root, i + 1, me);
            if(ret){
                path.push(n); // Some are winnable
                /*
                if(!Array.isArray(ret)){
                    path.push(ret);
                }else{
                    // Split path to multiple routes
                    let newPaths = [];
                    for(let r of ret){
                        newPaths.push(...path, r);
                    }
                    //console.log(newPaths)
                    path = newPaths;
                }*/
            }else{
                //console.log('leads to unwinnable situ')
            }
        }else{
            //console.log('No winnable route from here', n, root, i, them, path)
           /* let ret = findWinnableRoutes(n, root, i + 1, them);
            if(!ret){
                // No route here leads to a win for them, so add them all
            }*/
        }
    }
    if(path.length == 0) return false;
    return path;
}

function findRoutes(root, who){
    let routes = [];
    for(let i = root.length - 1; i >= 0; i--){
        let eligible = root[i].filter(r => r.winner); // Only completed routes
        for(let e of eligible){
            let parent = e.parent;
            let route = [e];
            for(let j = i - 1; j >= 0; j--){
                let p = root[j].find(p => makeParent(p) == parent);
                if(!p){
                    //console.log('aargh unable to find!', i, j, parent);
                    break;
                }
                route = [p, ...route];
                parent = p.parent;
            }
            // By here we should have one complete, assembled route, so push it to routes
            routes = [route, ...routes];
        }
        // And now work back a level and find more
    }
    return routes;
}

function buildRoutes(root, route = 'empty', start = 0){
    //console.log('building roots', start)
    let current = root[start].filter(r => r.parent == route);
    if(root.length == start + 1){
        // last one, so just return
        //console.log('last');
        return [current]; // ???
    }
    if(current.length == 0){
        //console.log('aargh missing end')
        return [];
    }
    ////console.log('ok')
    let connections = [];
    //console.log(current);
    for(let c of current){
        if(c.winner){
            // Finished!
            //console.log('finished', c);
            connections.push([c]);
        }else{
            let next = buildRoutes(root, makeParent(c), start + 1); // JSON.stringify({invader: c.invader.fleets, defender: c.defender.fleets})
            for(let n of next){
                connections.push([c, ...n]);
            }
        }
        
    }
    ////console.log('proper');
    return connections;
    current = root[start];
    for(let i = 0; i < current.length; i++){
        let r = current[i].route;
        if(root.length > start + 1){
            let nextLevel = root[start + 1].filter(c => c.parent == r);
            let connections = [];
            for(let n of nextLevel){
                connections.push(current[i], n);
            }
        }else{}
    }
}

function execAndNext(d, pos) {
    let b = pos.func(d);
    let n = '';
    
    if(b.choices){
        for(let c of b.choices){
            if(typeof pos.next == 'function'){
                c.next = pos.next(c);
            }else{
                c.next = pos.next;
            }
        }
    }else{
        if(typeof pos.next == 'function'){
            b.next = pos.next(b);
        }else{
            b.next = pos.next;
        }
    }
    return b;
}

/*let ad = resolveDamage(testData, 'invader', 4);
let dd = resolveDamage(testData, 'defender', 3);
let bd = combineBranches(ad, dd);
//console.log(ad, dd, bd);*/