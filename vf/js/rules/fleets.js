// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { abandonSector, getSectorList, guilds, playerSectors, voidbornFleetSpaces } from './sectors.js';
import {state, ui} from './stores.js';
import {get} from './runtime.js';
import { advance, ask, choose, clearSectorPreviews, doActionPause, sectorPreview, upperInitial } from './ui.js';
import { all, at, bl, isIn, moveBitTo, possArray, resolveAddress, resolvePlace } from './utils.js';
import { returnToken, topToken } from './tokens.js';
import { doAction, log } from './game.js';
import { hasTech } from './techs.js';
import { getCostInfo, pay } from './costs.js';
import { updateSkirmish } from './combat.js';

export let fleetTypes = ['voidborn', 'corvette', 'destroyer', 'dreadnought', 'carrier', 'sentry', ]

export function deployedList(p){
    let count = {}
    for(let s of getSectorList(get(state).sectors)){
        if(!s.fleets) continue;
        for(let f of s.fleets){
            if(f.owner == p.colour){
                if(!count[f.type]) count[f.type] = 0;
                count[f.type] += f.cubes.length;
            }
        }
    }
    return count;
}


export function deployedFleet(p, sectors = getSectorList(get(state).sectors)){
    let fleet = [];
    for(let s of sectors){
        if(!s.fleets) continue;
        for(let f of s.fleets){
            if(f.owner == p.colour){
                fleet = [...fleet, ...f.cubes]
            }
        }
    }
    return fleet;
}

export function fleetOwner(f){
    // For a fleet cube
    if(f.id.startsWith('fleet_voidborn')) return 'voidborn';
    return get(state).players.find(p => p.colour == fleetShip(f).owner);
}

export function totalDeployed(p){
    let count = 0;
    return deployedFleet(p).length;
    for(let v of Object.values(deployedList(p))){
        count += v;
    }
    return count;
}

export function fleetShip(f){
    return resolveAddress(get(state), bl(f.id).address, 2);
}

function cubeLimit(p, ship){
    if(!p || p == 'voidborn') return 3;
    if(['corvette', 'voidborn', 'sentry', 'destroyer'].includes(ship)) return 3;
    if(['dreadnought', 'carrier'].includes(ship) && p.techs.some(t => t.name == `${upperInitial(ship)}s` && t.type == 'improved')) return 3;
    return 1;
}

export function fleetType(f){
    let fromLoc = resolveAddress(get(state), bl(f.id).address, 2); // ?
    if(!fromLoc || !fromLoc.type) return false;
    let fromType = fromLoc.type;
    return fromType;
}

export async function moveFleet(p, from, to, action = 'move', type = 'corvette'){
    // From is either 'active', 'inactive', a haven id, a sector id, a ship id, or a fleet cube id 
    // First get the relevant fleet
    let cube = false;
    let fromLoc;
    let fromType = false;
    let fromSector = false;
    if(p == 'voidborn' && from == 'active') from = 'voidborn';
    if(['active', 'inactive'].includes(from)){
        cube = p.fleets[from][0];
        fromLoc = p.fleets[from];
    }else if(from == 'voidborn'){
        cube = topToken('fleet_voidborn');
        fromType = 'voidborn';
    }else if(from.startsWith('fleet')){
        // Specific cube
        cube = at(from);
        fromLoc = resolveAddress(get(state), bl(from).address, 2); // ?
        fromType = fromLoc.type;
        fromSector = fleetSector(cube);
    }else if(from.startsWith('haven')){
        let h = get(state).havens.find(h => h.id == from);
        if(!h) throw 'No such haven!';
        cube = h.cubes[0];
        fromLoc = h;
    }else if(from.startsWith('sector')){
        fromSector = at(from);
        let fleets = at(from).fleets;
        if(!fleets || fleets.length == 0) return false;
        if(fleets.length == 1 || Array.from(new Set (fleets.map(f => f.type))).length == 1){
            cube = fleets[0].cubes[0];
            fromLoc = fleets[0];
            fromType = fleets[0].type;
        }else{
            // Need to choose which one!
            let chosen = await choose(`Choose fleet to ${action}`, fleets);
            // Should have the fleet token now
            cube = chosen.cubes[0];
            fromLoc = chosen;
            fromType = chosen.type;
        }
    }else{
        // Presume it's a ship!
        let ship = at(from);
        cube = ship.cubes[0];
        fromLoc = ship;
        fromType = ship.type;
        fromSector = fleetSector(cube);
    }
    if(!cube){
        console.log('No fleet to move!');
        return false;
    }

    if(!fromType) fromType = type;

    if(p == 'voidborn' && to == 'active') to = 'voidborn';

    // Now put in new place
    if(['active', 'inactive'].includes(to)){
        moveBitTo(cube, p.fleets[to]);
    }else if(to.startsWith('haven')){
        let h = get(state).havens.find(h => h.id == to);
        if(!h) throw 'No such haven!';
        moveBitTo(cube, h.cubes);
    }else if(to.startsWith('sectors')){
         // Put it there, making a new fleet if necessary
        let sector = at(to);

        if(from == 'voidborn'){
            // First check we have space!
            if(voidbornFleetSpaces(sector) == 0){
                log(`Not putting Voidborn fleet in sector - there is no space`);
                return;
            }
        }
        let fleets = sector.fleets;
        fleets = fleets.filter(f => f.type == fromType && f.owner == (p.colour || p) && f.cubes.length < cubeLimit(p, fromType));
        if(fleets.length > 0){
            moveBitTo(cube, fleets[0].cubes);
        }else{
            // Make new ship
            let newShip = {
                owner: p.colour || p,
                type: fromType,
                ...topToken(fromType),
                cubes: []
            };
            moveBitTo(newShip, sector.fleets)
            //sector.fleets = [...sector.fleets, newShip];
            moveBitTo(cube, newShip.cubes);
        }
    }else if(to == 'voidborn'){
        await returnToken(cube); // Back to spares
    }else{
        // It's a ship
        let ship = at(to);
        if(ship.cubes.length < cubeLimit(p, ship.type)){
            // Just add it
            moveBitTo(cube, ship.cubes);
        }else{
            // You can't move it here! But rather than return false, make a new ship
            let newShip = {
                owner: p.colour,
                type: fromType,
                ...topToken(fromType),
                cubes: []
            };
            let fleetAddress = bl(to).address;
            let sector = resolveAddress(get(state), fleetAddress, 2);
            moveBitTo(newShip, sector.fleets);
            //sector.fleets = [...sector.fleets, newShip];
            moveBitTo(cube, newShip.cubes);
        }
    }

    console.log('fromLoc', fromLoc)
    // ...and now check whether the old ship needs to go
    if(fromType && fromLoc && fromLoc.cubes && fromLoc.cubes.length == 0){ // If fromType is false then it wasn't a ship anyway
        console.log('returning', fromLoc)
        delete fromLoc.owner;
        await returnToken(fromLoc); // Send it back!
    }

    //... and check for abandoned sectors!
    if(fromSector){
        if(fleetsInSector(fromSector) == 0 && fromSector.type != 'home'){
            if(p != 'voidborn' && fromType != 'voidborn'){
                await doAction(p, 'discard_glory'); // For abandoning
            }else{
                await doActionPause();
            }
            
            await abandonSector(fromSector); // Even when Voidborn leave!
            log({
                type: 'stats',
                sectorAbandoned: fromSector.type,
                empireSize: playerSectors(p).length,
                sectorTypes: Array.from(new Set(playerSectors(p).map(s => s.type)))
            }, p)
        }
        // Possibly consolidate fleets left behind
        await consolidateFleets(fromSector);
    }
    //await tick();
}

export async function consolidateFleets(sector){
    if(fleetsInSector(sector) > 1){
        let spacesInType = {};
        let toReturn = [];
        for(let f of sector.fleets){
            let owner = f.owner;
            if(f.owner != 'voidborn') owner = get(state).players.find(p => p.colour == owner);
            if(spacesInType[f.type] && spacesInType[f.type].length > 0){
                // Move across
                while(spacesInType[f.type].length > 0 && f.cubes.length > 0){
                    moveBitTo(f.cubes[0], spacesInType[f.type][0].spaces);
                    spacesInType[f.type][0].left--;
                    if(spacesInType[f.type][0].left == 0){
                        spacesInType[f.type] = spacesInType[f.type].slice(1);
                    }
                }
                if(f.cubes.length == 0){
                    // Return the empty ship
                    toReturn.push(f);
                    
                    continue;
                }
            }
            if(f.cubes.length < cubeLimit(owner, f.type)){
                // Add to spaces list
                let left = cubeLimit(owner, f.type) - f.cubes.length;
                if(!spacesInType[f.type]) spacesInType[f.type] = [];
                spacesInType[f.type] = [...spacesInType[f.type], {
                    spaces: f.cubes,
                    left
                }]
            }
        }
        while(toReturn.length > 0){
            let f = toReturn.shift();
            delete f.owner;
            await returnToken(f);
        }
    }
}

export function makeSelectionFleets(selection){
    // Get the types etc. and build the necessary fleets

    let fleets = [];
    for(let c of selection){
        c = at(c.id);
        let addr = bl(c.id).address
        let f = resolveAddress(get(state), addr, 2);
        let toAdd = fleets.find(fl => fl.type == f.type && fl.cubes.length < cubeLimit(p, f.type));
        if(!toAdd){
            toAdd = {
                ...f,
                ...topToken(f.type),
                cubes: []
            }
            fleets.push(toAdd);
        }
        toAdd.cubes.push(selection);
    }
    console.log('selected fleets', fleets);
    return fleets;
}

export function sectorFleetsByType(s, colour){
    let fleetsByType = {};
    for(let f of s.fleets){
        if(!colour || f.owner == colour){
            if(!fleetsByType[f.type]){
                fleetsByType[f.type] = [];
            }
            fleetsByType[f.type].push(f);
        }
    }

    // Then sort the typed fleet list so that you lose from the smallest stands first
    for(let k of Object.keys(fleetsByType)){
        fleetsByType[k] = fleetsByType[k].sort((a,b) => a.cubes.length - b.cubes.length).flatMap(f => f.cubes);
    }
    return fleetsByType;
}

export function fleetSector(f){
    if(!isIn(f, 'fleets')) return false;
    return resolveAddress(get(state), bl(f.id).address, 4);
}

export function fleetsInSector(s, p = false){
    let total = 0;
    for(let f of s.fleets){
        if(!p || f.owner == p.colour) total += f.cubes.length;
    }
    return total;
}

export function playerFleetTypes(p){
    let types = ['corvette'];
    for(let t of p.techs){
        if(t.ship) types.push(t.ship);
    }
    return types;
}

export function fleetCost(type, num){
    let costs = {
        carrier: {
            food: num
        },
        dreadnought: {
            materials: num
        }
    }
    return costs[type];
}

export async function deployPer(p, params){
    let byPlace = {};
    let totalCount = 0;
    let fleetTypesDeployed = {};
    for(let loc of possArray(params.place)){
        if(!loc) return; // Nothing to deploy
        loc = resolvePlace(loc, p);
        let count = params.num;
        count = all(params.deploy_per, (b) => isIn(b, loc.id)).length;
        
        if(hasTech(p, 'Starbases')){
            count += loc.installations.filter(i => i.value == 'starbase').length;
        }
        if(p.house == 'Thegwyn'){
            count += guilds(loc).filter(g => g.value == 'farmers_guild').length;
        }
        if(hasTech(p, 'Carriers') && params.deploy_per == 'shipyard'){
            count += loc.fleets.filter(f => f.type == 'carrier').flatMap(f => f.cubes).length;
        }
        if(hasTech(p, 'Orbital Docks') && params.deploy_per == 'shipyard' && count){
            count += 1;
        }
        
        if(count == 0) continue; // No space here
        byPlace[loc.id] = {
            count: 0,
            max: count,
            min: 0,
            fleets: {}
        }
        totalCount += count;
    }

    let available = playerFleetTypes(p);
    if(params.type) available = possArray(params.type);
    available = available.filter(a => !fleetCost(a) || getCostInfo(p, fleetCost(a, 1)))
    let chosen = available.find(k => k != 'corvette' && (!fleetCost(k) || getCostInfo(p, fleetCost(k, totalCount)))) || 'corvette';
    for(let k of Object.keys(byPlace)){
        let loc = at(k);
        let info = byPlace[k];
        if(info.max > 0 && hasTech(p, 'Purifier', 'improved') && loc.corrupted){
            info.removeCorruption = false;
        }
        for(let a of available){
            info.fleets[a] = {
                min: 0,
                max: info.count,
                initial: 0
            }
        }
    }

    let mode = 'auto'; 

    if(totalCount > p.fleets.active.length) mode = 'manual';
    

    if(mode == 'auto'){
        for(let k of Object.keys(byPlace)){
            sectorPreview(k, byPlace[k].max);
        }
        let fleetChoices = available.map(a => {
            return {
                type: 'text',
                choice: `[[${a}]] ${a}`,
                value: a,
                disabled: fleetCost(a) && !getCostInfo(p, fleetCost(a, totalCount))
            }
        })
       if(fleetChoices.filter(c => !c.disabled).length == 1){
        chosen = fleetChoices.find(c => !c.disabled).value;
        let choice = await choose(`Click Deploy to deploy as suggested, or select 'Manual' for fine-grained control`, [`Manual`, 'ok_Deploy']);
        if(choice == 'Manual') chosen = 'Manual';
       }else{
            chosen = await choose(`Select fleet type to deploy, or select 'Manual' for fine-grained control`, ['Manual', ...fleetChoices], {noAuto: true});
       }
      
       if(chosen == 'Manual'){
            mode = 'manual';
       }else{
            // Do the deploying
            for(let k of Object.keys(byPlace)){
                let count = byPlace[k].max;
                let c = fleetCost(chosen, count);
                if(c) await pay(p, c);
                for(let i = 0; i < count; i++){
                    if(i == 0 && hasTech(p, 'Purifier', 'improved') && at(k).corrupted && await ask(`[[improved_tech]] Purifier: remove a [[corruption]] instead of a deploy?`)){
                        count--;
                        await doAction(p, 'remove_corruption', {place: at(k)});  
                        continue;
                    }
                    await moveFleet(p, 'active', k, 'deploy', chosen);
                    if(!fleetTypesDeployed[chosen || 'corvette']) fleetTypesDeployed[chosen || 'corvette'] = 0;
                    fleetTypesDeployed[chosen || 'corvette']++;
                }
                updateDeployCache(at(k), count);
                await doActionPause();
            }
            params.place = Object.keys(byPlace); // this??
       }
    
    }

    if(mode == 'manual'){
        clearSectorPreviews();
        let sectors = Object.keys(byPlace).map(k => at(k));
        params.place = [];
        totalCount = 0;
        let toggled = {
            chosen: ''
        }
        let fleetChoices = available.map(a => {
            return {
                type: 'text',
                choice: `[[${a}]] ${a}`,
                value: a,
                toggle: true,
                obj: toggled,
                key: 'chosen',
                disabled: fleetCost(a) && !getCostInfo(p, fleetCost(a, 1))
            }
        })
        toggled.chosen = fleetChoices.filter(c => c.value != 'corvette' || fleetChoices.length == 1).find(c => !c.disabled).value;
        await choose(`Manual deployment: click on a sector to deploy the current fleet type to it`, [...fleetChoices, ...sectors, `ok_Finish`], {noAuto: true, singleClick: async (choice) => {
            if(choice.id){
                // A sector!
                let loc = at(choice.id);
                if(hasTech(p, 'Purifier', 'improved') && loc.corrupted && await ask(`[[improved_tech]] Purifier: remove a [[corruption]] instead of a deploy?`)){
                    await doAction(p, 'remove_corruption', {place: loc});  
                    byPlace[choice.id].max--;
                    if(byPlace[choice.id].count == byPlace[choice.id].max){ 
                        // Remove from list now
                        ui.update(ui => {
                            ui.waiting[0].choices = ui.waiting[0].choices.filter(c => c.id != choice.id);
                            return ui;
                        });
                        if(get(ui).waiting[0].choices.filter(c => c.id).length == 0) advance(false);
                    }
                }else{
                    let c = fleetCost(toggled.chosen, 1);
                    if(c) await pay(p, c);
                    await moveFleet(p, 'active', choice.id, 'deploy', toggled.chosen);
                    updateDeployCache(choice, 1);
                    if(!fleetTypesDeployed[toggled.chosen || 'corvette']) fleetTypesDeployed[toggled.chosen || 'corvette'] = 0;
                    fleetTypesDeployed[toggled.chosen || 'corvette']++;
                    if(!params.place.includes(choice.id)) params.place.push(choice.id)
                    byPlace[choice.id].count++;
                    totalCount++;
                    if(byPlace[choice.id].count == byPlace[choice.id].max){ 
                        // Remove from list now
                        ui.update(ui => {
                            ui.waiting[0].choices = ui.waiting[0].choices.filter(c => c.id != choice.id);
                            return ui;
                        });
                        if(get(ui).waiting[0].choices.filter(c => c.id).length == 0) advance(false);
                    }
                    if(fleetCost(toggled.chosen) && !getCostInfo(p, fleetCost(toggled.chosen, 1))){
                        // disable that choice and revert to another
                        fleetChoices.find(c => c.value == toggled.chosen).disabled = true;
                        toggled.chosen = fleetChoices.find(c => !c.disabled);
                    }
                    if(p.fleets.active.length == 0) advance(false);
                }
                
            }else if(choice == 'Finish'){
                // End
                advance(false);
            }
        }})
    }
    params.count = totalCount;
    let fleetInfo = {};
    for(let k of Object.keys(fleetTypesDeployed)){
        fleetInfo['deployed'+upperInitial(k)] = fleetTypesDeployed[k];
    }
    log({
        type: 'stats',
        deployedCount: totalCount,
        ...fleetInfo
    }, p)
    clearSectorPreviews();
    updateSkirmish(p);
    return params;
}

function updateDeployCache(loc, count){
    state.update(s => {
        if(!s.turnCache.deploySectors) s.turnCache.deploySectors = [];
        let sec = s.turnCache.deploySectors.find(sector => sector.id == loc.id);
        if(!sec){
            sec = {
                id: loc.id,
                corrupted: loc.corrupted ? true : false,
                count: 0
            }
            s.turnCache.deploySectors.push(sec);
        }
        sec.count += count;
        return s;
    })
}