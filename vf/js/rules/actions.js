// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { consolidateFleets, deployPer, deployedFleet, fleetCost, fleetSector, fleetType, fleetsInSector, moveFleet, playerFleetTypes, totalDeployed } from "./fleets.js";
import { addReaction, cacheSector, doAction, doEffect, executeActions, log, ongoingGeneral, ongoingPlayer, playerIndex, playersInTurnOrder, renderCost, thirdFocusAction } from "./game.js";
import { guildMaker, maxStores, produce, resMaker, resourceTypes, setProductionLevels } from "./resources.js";
import { canInvade, controlledBy, distance, generateDistances, guildSpaces, guilds, invadableFleets, isAdjacent, playerSectors, playerSectorsMap, sectorKey, sectorSpecial, voidbornFleetSpaces, whichSectorKey } from "./sectors.js";
import { bottomTrade, returnToken, takeTrade, topToken } from "./tokens.js";
import { choose, doActionPause, showExpandable, upperInitial, pause, hideExpandable, waitMillis, ask, clearSectorPreviews, sectorPreview } from "./ui.js";
import { all, allActivePlayer, allPlayer, bl, isIn, moveBitTo, sectorAt, at, locationFilter, possArray, ol, lo, resolvePlace, possPlural, assembleList, resolveAddress, propAdd, type, possScalar, shuffle } from "./utils.js";
import { state } from "./stores.js";
import { arkSpaces, basicTechs, getTechGrid, hasTech, improvedTechLimit, resolveTechGain, techLimit, techs } from './techs.js';
import { get } from './runtime.js';
import { select } from "./previewable.js";
import { combat, combatPrediction, resolveSkirmish, updateSkirmish } from "./combat.js";
import { tick } from "./runtime.js";
import { getCostInfo, pay } from "./costs.js";
import { getAgendasAndBacks, score_agenda } from "./agendas.js";
import { allCrisesOnBoard, getCrisisHarbingers, totalHavenCapacity } from "./crisis.js";
import * as jsonpatch from './runtime.js';
import { costToRise, getTier } from "./tracks.js";
import { logAvailable } from "./stats.js";
import { house } from "./houses.js";
import { endGame } from "./turns.js";
import { isPreferred } from "./focus.js";
import { newInformation } from "./undo.js";

export let holderMaker = {
    defense: 'installations',
    shipyard: 'installations',
    starbase: 'installations',
    farmers_guild: 'guilds',
    miners_guild: 'guilds',
    engineers_guild: 'guilds',
    scientists_guild: 'guilds',
    bankers_guild: 'guilds',
    bounty: 'bounty',
    reclaim: 'reclaim'
}

export let actions = [
    {
        verb: 'spend_resource',
        defaults: {
            num: 1,
            types: (p, params) => {
                let cost = {};
                let k = 'any';
                if(params.type) k = params.type;
                cost[k] = params.num;
                return cost;
            }
        },
        description: (params) => {
            if(params.types) return renderCost(params.types);
            if(params.type){
                let cost = {};
                cost[params.type] = params.num;
                return renderCost(cost);
            }
            return renderCost({any: params.num})
        },
        impossible: (p, params) => {
            if(params.types) return !getCostInfo(p, params.types, params.options || {});
            if(params.type){
                let cost = {};
                cost[params.type] = params.num;
                return !getCostInfo(p, cost, params.options || {});
            }
            else return !getCostInfo(p, {any: params.num}, params.options || {});
        },
        action: async (p, params) => {
            /*let newParams = jsonpatch.deepClone(params);
            if(newParams.types){
                for(let k of Object.keys(newParams.types)){
                    newParams.types[k] = -newParams.types[k];
                }
            }
            if(newParams.num) newParams.num = -newParams.num;
            await doAction(p, 'gain_resource', newParams);*/
            await pay(p, params.types, params.options || {})
            updateSkirmish(p);
        }
    },
    {
        verb: 'resolve_skirmish',
        description: `[[skirmish]]`,
        defaults: {
            mods: {}
        },
        impossible: (p, params) => {
            let o = ongoingGeneral().find(o => o.type == 'min_influence_invasion');
            if(o && p.influence <= o.min){
                return true;
            }
            return false;
        },
        action: async (p, params) => {
            await resolveSkirmish(p, {...params.mods});
            updateSkirmish(p);
        },
        log: (params) => `resolved [[skirmish]]`
    },
    {
        verb: 'gain_resource',
        description: (params) => {
            if(params.types){
                return Object.keys(params.types).map(k => `${params.types[k] > 0 ? '+' : ''}${params.types[k]} [[${k}]]`).join(', ')
            }
            if(params.type){
                if(Array.isArray(params.type)) return `${params.num > 0 ? '+' : ''}${params.type.map(t => `[[${t}]]`).join('')}`;
                return `${params.num < 0 ? 'spend' : 'gain'} ${typeof params.num == 'number' ? params.num : 1} [[${params.type}]]`;
            }
            if(params.available){
                return `${params.num < 0 ? 'spend' : 'gain'} ${typeof params.num == 'number' ? params.num : 1} ${params.available.map(a => `[[${a}]]`).join('/')}`;
            }
            return `${params.num < 0 ? 'spend' : 'gain'} ${typeof params.num == 'number' ? params.num : 1} [[any_resource]]`;
        },
        defaults: {
            num: 1,
            types: async (p, params) => {
                let res = {};
                if(params.type){
                    let type = params.type;
                    if(!Array.isArray(type)) type = [type];
                    for(let t of type){
                        if(!res[t]) res[t] = 0;
                        res[t] += params.num;
                    }
                    params.generatedTypes = true;
                    return res;
                }
                if(params.num < 0){
                    params.spend = true;
                    params.num = -params.num;
                }
                if(!params.available) params.available = resourceTypes;
                let data = await pause(`Select resources to ${!params.spend ? 'gain' : 'spend'}:`, {foreground: params.showSource ? at(params.source) : false, adjust: {num: params.num, res: {}, available: params.available, spendable: params.spend ? p.resources : false}});
                if(params.spend){
                    for(let k of Object.keys(data.res)){
                        data.res[k] = -data.res[k];
                    }
                }
                params.generatedTypes = true;
                return data.res; // NB maybe ditch spending stuff?
            }
        },
        log: (params) => {
            if(params.types){
                let text = 'gained';
                if(Object.keys(params.types).some(k => params.types[k] < 0)){
                    text = 'spent'; // TODO mixed?
                }
                // Handle...
                for(let k of Object.keys(params.types)){
                    text += ` ${Math.abs(params.types[k] * (params.generatedTypes ? 1 : params.num))} [[${k}]]`
                }
                return text;
            }
            if(Array.isArray(params.type)) return `${params.num > 0 ? 'gained' : 'spent'} ${Math.abs(params.num)} ${params.type.map(t => `[[${t}]]`).join('')}`
            return `${params.num > 0 ? 'gained' : 'spent'} ${Math.abs(params.num)} [[${params.type}]]`
        },
        action: async (p, params) => {
            if(params.types){
                for(let k of Object.keys(params.types)){
                    if(k == 'influence'){
                        if(params.type == 'influence'){
                            await doAction(p, 'gain_influence', {...params}); // in case of response
                        }else{
                            await doAction(p, 'gain_influence', {source: params.source, num: params.num * params.types[k]}); // in case of response
                        }
                        
                        //p.influence += params.types[k];
                    }else{
                        p.resources[k].store += params.types[k] * (params.generatedTypes ? 1 : params.num)
                        if(p.resources[k].store > maxStores[k]) p.resources[k].store = maxStores[k]; // Can't overflow
                        state.update(s => {
                            if(!s.turnCache.gained) s.turnCache.gained = {};
                            if(!s.turnCache.gained[k]) s.turnCache.gained[k] = 0;
                            s.turnCache.gained[k] += params.types[k] * (params.generatedTypes ? 1 : params.num);
                            return s;
                        })
                    }
                    
                }
            }else {
                if(params.type == 'influence'){
                    p.influence += params.num;
                }else{
                    let type = params.type;
                    if(!Array.isArray(type)) type = [type];
                    for(let t of type){
                        p.resources[t].store += params.num;
                        if(p.resources[t].store > maxStores[t]) p.resources[t].store = maxStores[t]; // Can't overflow
                        state.update(s => {
                            if(!s.turnCache.gained) s.turnCache.gained = {};
                            if(!s.turnCache.gained[k]) s.turnCache.gained[k] = 0;
                            s.turnCache.gained[k] += params.num
                            return s;
                        })
                    }
                    
                }
                
            }
            updateSkirmish(p);
        }
    },
    {
        verb: 'gain_influence',
        description: (params) => {
            if(params.per == 'total_glory') return '[[score_glory]]';
            return `gain ${params.num || ''} [[influence]]`
        },
        defaults: {
            num: 1,
            from: (p, params) => params.source ? type(params.source) : false
        },
        action: async (p, params) => {
            p.influence += params.num;
        },
        log: (params) => `gained ${params.num} [[influence]]`
    },
    {
        verb: 'gain_bounty',
        defaults: {
            num: 1,
        },
        description: (params) => `${params.num || 1} [[bounty]]`,
        action: async (p, params) => {
            await newInformation();
            if(params.obj){
                let b = params.obj;
                b.value.flipped = true;
                let id = b;
                if(b.id) id = b.id;
                //await pause('Gained bounty token', {foreground: b});
                await executeActions(p, b.value.effect, {foreground: b, source: id/*, pause: true*/}); // await executeActions(p, b.value.effect, {foreground: b, pause: true, source: '[[bounty]] token'});
                moveBitTo(b, p.bounty);
                return;
            }else{
                for(let i = 0; i < params.num; i++){
                    let b = topToken('bounty');
                    let id = b;
                    if(b.id) id = b.id;
                    b.value.flipped = true;
                    await executeActions(p, b.value.effect, {foreground: b, source: id/*, pause: true*/});
                    moveBitTo(b, p.bounty);
                }
            }
        },
        log: (params) => `gained ${params.num || 'a'} [[bounty]] token(s)`
    },
    {
        verb: 'gain_reclaim',
        defaults: {
            num: 1
        },
        description: (params) => `${params.num || 1} [[reclaim]]`,
        action: async (p, params) => {
            await newInformation();
            if(params.place){
                params.place = resolvePlace(params.place, p);
                if(Array.isArray(params.place)) params.place = await choose(`Select a sector to place the [[reclaim]]`, place, {singleClick: true});
                cacheSector(params.place);
            }
            if(params.obj){
                let b = params.obj;
                b.value.flipped = true;
                await executeActions(p, b.value.effect, {foreground: b, source: b.id});
                moveBitTo(b, p.reclaim);
                return;
            }
            for(let i = 0; i < params.num; i++){
                let b = topToken('reclaim');
                b.value.flipped = true;
                await executeActions(p, b.value.effect, {foreground: b, source: b.id});
                moveBitTo(b, p.reclaim);
            }
        },
        log: (params) => `gained ${params.num || 'a'} [[reclaim]] token(s)`
    },
    {
        verb: 'deactivate',
        description: (params) => `${params.num > 1 ? `${params.num} ` : ''}[[deactivate]]`,
        defaults: {
            num: 1
        },
        impossible: (p, params) => totalDeployed(p) + p.fleets.active.length < (params.num || 1),
        action: async (p, params) => {
            while(p.fleets.active.length < params.num && totalDeployed(p) > 0){
                await doAction(p, 'recall')
            }
            for(let i = 0; i < params.num; i++){
                await moveFleet(p, 'active', 'inactive');
            }
            updateSkirmish(p);
        },
        log: (params) => `deactivated ${params.num} fleet power`
    },
    {
        verb: 'activate',
        description: (params) => `${params.num > 1 ? `${params.num} ` : ''}[[activate]]`,
        defaults: {
            num: 1
        },
        action: async (p, params) => {
            //if(p.fleets.inactive.length < params.num) throw 'cancelled';
            for(let i = 0; i < params.num && p.fleets.inactive.length > 0; i++) moveBitTo(p.fleets.inactive[0], p.fleets.active);
            updateSkirmish(p);
        },
        log: (params) => `activated ${params.num} fleet power`
    },
    {
        verb: 'discard_focus',
        action: async (p, params) => {
            let obj = params.obj || [];
            if(!Array.isArray(obj)) obj = [obj];

            for(let o of obj){
                let focus = p.focus.available.find(f => f.id.includes(`.${o}`));
                if(!focus) continue; // not there
                moveBitTo(focus, p.focus.discard);
                //await tick();
                //await doActionPause();
            }
        }
    },
    {
        verb: 'move_corruption',
        impossible: (p, params) => playerCorruption(p).length < (params.num || 1),
        defaults: {
            num: 1,
            obj: async (p, params) =>  {
                if(params.from) return params.from.corrupted;
                return await choose('Select corruption to move', playerCorruption(p), {number: params.num}, {singleClick: true});
            },
        },
        action: async (p, params) => {
            if(Array.isArray(params.obj)){
                // Do it separately for each
                for(let obj of params.obj){
                    await doAction(p, 'move_corruption', {obj});
                }
                return;
            }
            if(!params.place) params.place = await choose('Select destination for corruption', playerCorruptionSlots(p), {singleClick: true});
            if(typeof params.obj == 'string'){
                params.obj = all('corruption', locationFilter(params.from))
            }
            if(isIn(params.obj, 'sector')) params.from = 'sector';
            if(isIn(params.obj, 'agendas') || isIn(params.obj, 'tracks')) params.from = 'house_mat';
            if(isIn(params.obj, 'tracks')){
                params.fromSpecific = 'tracks';
            }else if(isIn(params.obj, 'agendas')){
                params.fromSpecific = 'agendas';
            }else if(isIn(params.obj, 'sector')){
                params.fromSpecific = 'sector'
            }else if(isIn(params.obj, 'tech_14')){
                params.fromSpecific = 'DC'
            }
            // Need some more!

            if(typeof params.place == 'string'){
                params.place = all('corruption', locationFilter(params.from))
            }
            moveBitTo(at(params.obj.id), at(params.place.id), 'corrupted');
            params.to = corruptionPlace(p, params.place);
            log({
                type: 'stats',
                corruptionOnMat: playerCorruption(p, 'house_mat'),
                corruptionInSectors: playerCorruption(p, 'sectors')
            })
            updateSkirmish(p);
            /*}*/ 
        },
        log: (params) => `moved [[corruption]]${params.fromSpecific ? ` from ${params.fromSpecific}` : ''}${params.to ? ` to ${params.to}` : ''}`
    },
    {
        verb: 'gain_corruption',
        description: (params) => '[[gain_corruption]]',
        impossible: (p, params) => {
            if(playerCorruptionSlots(p, params.restriction).length == 0) return true;
            if(params.place && !playerCorruptionSlots(p, params.restriction).some(s => s.id == params.place.id)) return true;
            return false;
        },
        defaults: {
            place: async (p, params) => await choose('Select destination for corruption', playerCorruptionSlots(p, params.restriction), {singleClick: true})
        },
        action: async (p, params) => {

            if(params.obj){
                moveBitTo(params.obj, at(params.place.id), 'corrupted');
            }else{
                moveBitTo(topToken('corruption'), at(params.place.id), 'corrupted');
            }
            params.to = corruptionPlace(p, params.place)
            if(isIn(params.place, 'tracks')){
                state.update(s => {
                    if(!s.cache) s.cache = {};
                    s.cache.corruptedTrack = params.place.id.split('_')[1];
                    return s;
                })
            }
            log({
                type: 'stats',
                corruptionOnMat: playerCorruption(p, 'house_mat'),
                corruptionInSectors: playerCorruption(p, 'sectors')
            })
            updateSkirmish(p);
        },
        log: (params) => `gained [[corruption]]${params.to ? ` to ${params.to}` : ''}`
    },
    {
        verb: 'place_corruption',
        description: (params) => 'place [[corruption]] on an Agenda spot on the board',
        impossible: (p, params) => {
            if(!params.place) return Object.keys(get(state).agenda_board).every(a => get(state).agenda_board[a].corrupted);
            if(['wealth','dominance','support','might'].includes(params.place)) return get(state).agenda_board[params.place].corrupted;
            return false;
        },
        defaults: {
            place: async (p, params) => {
                let places = Object.keys(get(state).agenda_board).filter(k => !get(state).agenda_board[k].corrupted).map(k => get(state).agenda_board[k])
                //let places = ['wealth','dominance','support','might'].filter(a => !get(state).agenda_board[a].corrupted)
                await showExpandable('agendas');
                await waitMillis(1000);
                let place = await choose(`Choose an agenda type to corrupt`, places)
                return place.key;
            }
            // TODO make nicer!
        },
        action: async (p, params) => {
            
            if(['wealth','dominance','support','might'].includes(params.place)){
                await showExpandable('agendas');
                await waitMillis(1000);
                if(!get(state).agenda_board[params.place].corrupted){
                    moveBitTo(topToken('corruption'), get(state).agenda_board[params.place], 'corrupted');
                }
                await waitMillis(1000);
                await hideExpandable('agendas');
            }else{
                // TODO
            }
        },
        log: (params) => {
            if(['wealth','dominance','support','might'].includes(params.place)) return `placed [[corruption]] on [[agenda_${params.place}]]`
        }
    },
    {
        verb: 'remove_corruption',
        description: 'remove [[corruption]]',
        impossible: (p, params) => {
            if(params.place == 'Decontamination Chambers'){
                let inside = hasTech(p, 'Decontamination Chambers').inside;
                let someThere = false;
                for(let i = inside.length - 1; i >= 0; i--){
                    if(inside[i].corrupted){
                        someThere = true;
                        params.place = inside[i];
                    }
                }
                if(!someThere) return true;
                return false;
            }
            if(params.place){
                if(Array.isArray(params.place)) return params.place.every(s => !s.corrupted);
                return !params.place.corrupted;
            }else{
                return (playerCorruption(p, params.restriction).length == 0);
            }
        },
        defaults: {
            obj: async (p, params) => {

                
                if(params.place == 'Decontamination Chambers'){
                    let inside = hasTech(p, 'Decontamination Chambers').inside;
                    for(let i = inside.length - 1; i >= 0; i--){
                        if(inside[i].corrupted) params.place = inside[i];
                    }
                }
                if(params.place){
                    
                    if(Array.isArray(params.place)){
                        let poss = params.place.filter(s => s.corrupted && controlledBy(s, p));
                        params.place = await choose(`Choose sector to remove corruption from:`, poss, {singleClick: true});
                    }else{
                        if(!params.place.corrupted){
                            await pause('Sector is not corrupted!');
                            return false;
                        }
                    }
                    return params.place.corrupted;
                }
                if(playerCorruption(p, params.restriction).length == 0){
                    return false;
                }
                return await choose(`Select a corruption to remove`, playerCorruption(p, params.restriction), {singleClick: true})
            }
        },
        action: async (p, params) => {
            if(!params.obj){
                log('No corruption to remove');
                return
            }
            if(isIn(params.obj, 'sector')){
                params.from = 'sector';
                params.place = resolveAddress(get(state), bl(params.obj.id).address, 1);
            }
            if(isIn(params.obj, 'agendas') || isIn(params.obj, 'tracks')) params.from = 'house_mat';
            if(isIn(params.obj, 'tracks')){
                params.fromSpecific = 'tracks';
            }else if(isIn(params.obj, 'agendas')){
                params.fromSpecific = 'agendas';
            }else if(isIn(params.obj, 'sector')){
                params.fromSpecific = 'sectors'
            }else if(isIn(params.obj, 'techs')){
                params.fromSpecific = 'DC'
            }
            // Need some more!

            if(ongoingGeneral().includes('keep_corruption')){
                // Save til later!
                moveBitTo(params.obj, p.kept_corruption);
            }else{
                await returnToken(params.obj,p);
            }
            log({
                type: 'stats',
                corruptionOnMat: playerCorruption(p, 'house_mat'),
                corruptionInSectors: playerCorruption(p, 'sectors')
            })
            updateSkirmish(p);
            
        },
        log: (params) => `removed corruption`
    },
    {
        verb: 'invade',
        impossible: (p, params) => all('sectors', (s) => canInvade(p, s)).length == 0,
        defaults: {
            place: async (p, params) => await choose(`Choose sector to invade`, all('sectors', (s) => canInvade(p, s) && (!params.corruptedSector || s.corrupted)), {singleClick: true}),
            invader: (p, params) => p.colour,
            defender: (p, params) => {
                if(params.place.fleets.length == 0){
                    if(params.place.corrupted) return 'corrupted';
                    return false;
                }else{
                    return params.place.fleets[0].owner;
                }
               
            },
            corruptedSector: (p, params) => params.place.corrupted ? true : false
        },
        action: async (p, params) => {
            params.abandonedSectors = [];
            if(!params.fleets) params.fleets = await choose(`Select fleets to invade with`, invadableFleets(p, params.place), {min: 1, noAuto: true, liveInfo: (state, ui) => { 
                // !! TODO handle DSM adjacency when abandoning sector
                let fleets = ui.selection.map(s => at(s.id));
                let secs = Array.from(new Set(fleets.map(f => fleetSector(f))));
                params.abandonedSectors = [];
                for(let s of secs){
                    if(s.fleets.flatMap(f => f.cubes.map(c => c.id)).every(f => fleets.map(fl => fl.id).includes(f)) && s.type != 'home' && (!s.installations || !s.installations.some(i => i.value == 'command_post'))){
                        // Sector will be abandoned
                        params.abandonedSectors.push(s.id);
                    }
                }
                let options = params.mods || {};
                options.abandonedSectors = params.abandonedSectors; // To handle DSM abandonment
                let prediction = combatPrediction(p, params.place, fleets, options)
                if(params.abandonedSectors.length > 0){
                    return `<div>${prediction}</div><div style="color: orange;">&nbsp;Warning: ${params.abandonedSectors.length} sector(s) will be abandoned</div>`;
                }else{
                    return prediction;
                }
            }})
            if(params.place.fallen_house){
                params.fallenSector = true; // for Crisis
            }
            // Count fleet types – for Crisis
            params.fleetTypes = [];
            for(let f of params.fleets){
                if(!params.fleetTypes.includes(fleetType(f))) params.fleetTypes.push(fleetType(f));
            }
            let defender = null;
            if(params.place.fleets && params.place.fleets.length > 0) defender = params.place.fleets[0].owner;
            let numberOfDefenders = fleetsInSector(params.place);
            let fromSectors = [];
            for(let f of params.fleets){
                let s = fleetSector(f);
                if(!fromSectors.some(sec => sec.id == s.id)) fromSectors.push(s);
                await moveFleet(p, f.id, params.place.id, 'invade');
            }
            params.fromSectors = fromSectors.map(s => s.id);
            params.fromPureSectors = fromSectors.filter(s => !s.corrupted).length; // For Purging Storm crisis
            // Now they are all there, let's attack!
            cacheSector(params.place);
            await tick();
            let options = params.mods || {};
            options.abandonedSectors = params.abandonedSectors; // To handle DSM abandonment
            
            params.winner = await combat(p, params.place, options, params);
            if(params.winner == 'invader'){
                if(defender && params.scorePerCasualty){
                    let remainingDefenders = fleetsInSector(params.place, defender);
                    let lost = numberOfDefenders - remainingDefenders;
                    log('Scoring points for number of defending Fleet Power removed');
                    await doAction(p, 'gain_influence', {num: lost * params.scorePerCasualty, from: 'combat'})
                }
                if(params.scorePerPopulation){
                    log('Scoring points for population of sector'),
                    await doAction(p, 'gain_influence', {num: params.place.population * params.scorePerPopulation, from: 'combat'})
                }
                if(params.source && params.source.startsWith('agendas_dominance')){
                    // Log details for Saving Grace Crisis
                    state.update(s => {
                        if(!s.turnCache) s.turnCache = {};
                        s.turnCache.invadedFromDominance = true;
                        s.turnCache.invadedPopulation = params.place.population;
                        return s;
                    })
                }
            }
            
            updateSkirmish(p);
        },
        log: (params) => `invaded`
    },
    {
        verb: 'slot_agenda',
        action: async (p, params) => {
            // Placeholder action
        },
        log: (params) => `slotted ${lo(params.obj).name} [[agenda]] into House Mat`
    },
    {
        verb: 'regroup',
        action: async (p, params) => {
            let count = 0;
            let distances = generateDistances(playerSectorsMap(p));
            while(count < 5){
                let fleets = await choose(`Select fleets to move (${5 - count} moves remaining)`, [...all(`fleet_${p.colour}`, (b) => isIn(b, 'sectors.'))], {max: 5 - count, okText: 'Move/Finish'});
                if(fleets == 'cancelled') throw 'cancelled';
                if(!fleets || fleets.length == 0) break; // Done
                let fSectors = {};
                let sectorFleetCounts = {};
                for(let f of possArray(fleets)){
                    fSectors[f.id] = fleetSector(f);
                    if(!sectorFleetCounts[fSectors[f.id].id]) sectorFleetCounts[fSectors[f.id].id] = 0;
                    sectorFleetCounts[fSectors[f.id].id]++;
                }
                let carryOn = true;
                for(let k of Object.keys(sectorFleetCounts)){
                    if(sectorFleetCounts[k] == fleetsInSector(at(k)) && at(k).type != 'home'){
                        select(k);
                        await pause(`You may not abandon a sector during a [[regroup]] action!`);
                        carryOn = false;
                        break;
                        /*let choice = await choose(`Really move fleets and abandon this sector?`, ['Yes', 'No']);
                        if(choice == 'No'){
                            carryOn = false;
                            break;
                        }*/
                    }
                }
                if(!carryOn) continue;

                let availableSectors = playerSectors(p).filter(s1 => {
                    if(Object.values(fSectors).some(s => s.id == s1.id)) return false;
                    let distanceSum = 0;
                    for(let f of possArray(fleets)){
                        let s2 = fSectors[f.id];
                        //distanceSum += get(state).sectors.distances[s1.key][s2.key];
                        if(!distances[s1.key][s2.key]) return false;
                        distanceSum += distances[s1.key][s2.key];
                    }
                    if(distanceSum <= 5 - count) return true;
                    return false;
                });
                if(availableSectors.length == 0){
                    await pause('You cannot [[regroup]] from this sector: there is no route to any other sector you control');
                    continue;
                }
                
                let sector = await choose(`Select sector to move to`, availableSectors, {singleClick: true, alwaysAsk: true});
                if(!sector) continue;
                for(let f of possArray(fleets)){
                    let s2 = fSectors[f.id];
                    //count += get(state).sectors.distances[sector.key][s2.key];
                    count += distances[sector.key][s2.key];
                    await moveFleet(p, f.id, sector.id);
                }
                params.total = count;
                updateSkirmish(p);
            };
        },
        log: (params) => `regrouped${params.total ? `, spending a total of ${params.total} moves` : ''}`
    },
    {
        verb: 'deploy',
        description: (params) => `${params.num > 1 ? `${params.num} ` : ''}[[deploy]]${params.type ? ` [[${params.type}]]` : ''}${params.deploy_per ? ` per [[${params.deploy_per}]]` : ''}`,
        impossible: (p, params) => {
            if(p.fleets.active.length == 0) return true;
            if(params.type){
                let type = possArray(params.type);
                type = type.filter(a => !fleetCost(a) || getCostInfo(p, fleetCost(a, 1)));
                if(type.length == 0) return true;
            }
            return false;
        },
        defaults: {
            num: 1,
            place: async (p, params) => {
                if(params.deploy_per) return playerSectors(p);
                if(params.num == 1) return await choose(`Choose where to deploy fleet power`, playerSectors(p), {singleClick: true});
                params.bySector = {};
                let sectors = [];
                for(let i = 0; i < params.num; i++){
                    let toEnd = {
                        type: 'text',
                        choice: 'Done',
                        ok: true,
                        value: 'Done'
                    }
                    let place = await choose(`Click a sector to deploy a fleet power there (${i+1} of ${params.num})`, [...playerSectors(p), toEnd], {singleClick: true});
                    if(place == 'cancelled') throw 'cancelled';
                    if(place == 'Done') break;
                    propAdd(params.bySector, place.id, 1);
                    sectorPreview(place.id, params.bySector[place.id]);
                    if(!sectors.some(s => s.id == place.id)) sectors.push(place);
                }
                return sectors;
            },
        },
        //impossible: (p, params) => p.fleets.active.length < params.num,
        action: async (p, params) => {
            // include per, place (= home, so allow for interpretation or sectorAt?)
            clearSectorPreviews();
            if(params.deploy_per){
                await deployPer(p, params);
                return; // Do it this way?
            }
            let place = params.place;
            if(!Array.isArray(place)) place = [place];
            let totalCount = 0;
            let places = [];
            let fleetsByPlace = {};
            params.count = 0;
            if(params.type) params.typeWasSpecified = true;
            for(let loc of place){
                loc = resolvePlace(loc, p);
                if(Array.isArray(loc)) loc = await choose(`Select sector to deploy in`, loc, {singleClick: true});
                places.push(loc);
                let count = params.num;             
                if(params.bySector) count = params.bySector[loc.id];
                sectorPreview(loc.id, '⌖');
                let limited = false;
                let available = playerFleetTypes(p);
                if(Array.isArray(params.type)) available = available.filter(a => params.type.includes(a));
               
                if(count > 0 && !params.noReplace && hasTech(p, 'Purifier', 'improved') && loc.corrupted && await ask(`[[improved_tech]] Purifier: remove a [[corruption]] instead of a deploy?`)){
                    count--;
                    await doAction(p, 'remove_corruption', {place: loc});  
                }

                for(let i = 0; i < count; i++){
                    available = available.filter(a => !fleetCost(a) || getCostInfo(p, fleetCost(a, 1)))
                    let chosen = available[0];
                    if(params.type && params.typeWasSpecified && possArray(params.type).length == 1){
                        chosen = params.type;
                    }else if(available.length > 1){
                        select(loc.id); // So we see it!
                        let choices = available.map(a => { 
                            return {
                                type: 'text',
                                choice: `[[${a}]]`,
                                value: a
                            }
                        })
                        chosen = await choose(`What fleet type do you want to deploy?`, choices);
                        if(!params.type){
                            params.type = chosen;
                        }else if(params.type != chosen){
                            params.type = possArray(params.type);
                            if(!params.type.includes(chosen)) params.type = [...params.type, chosen];
                        }
                        state.update(s => {
                            s.cache.deployedType = params.type;
                            return s;
                        })
                    }
                    if(p.fleets.active.length == 0) break; // No more to deploy – !! TODO need to make this work better!
                    let c = fleetCost(chosen, 1);
                    if(c) await pay(p, c);
                    await moveFleet(p, 'active', loc.id, 'deploy', chosen);
                    params.place = places;
                    await doActionPause();
                }
                if(count > 0){
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
                totalCount += count;
                clearSectorPreviews();
            }
            params.count = totalCount;
            updateSkirmish(p);
        },
        log: (params) => `deployed ${params.count || ''}`
    },
    {
        verb: 'preferred_action',
        impossible: (p, params) => {
            return [...p.focus.available, ...p.focus.discard].filter(f => isPreferred(p, f)).length == 0
        },
        defaults: {
            obj: async (p, params) => {
                let possible = [...p.focus.available, ...p.focus.discard].filter(f => isPreferred(p, f))
                return await choose(`Select Preferred Focus card to take an action on it`, possible, {foregroundAll: true, singleClick: true})
            }
        },
        action: async (p, params) => {
            let f = lo(params.obj);
            let available = [];
            for(let e of f.effects){
                e = jsonpatch.deepClone(e);
            
                if(ongoingGeneral().includes('preferred_energy_cost') && isPreferred(p, f)){
                    if(!e.cost) e.cost = {};
                    if(e.cost.energy){
                        e.cost.energy++;
                    }else{
                        e.cost.energy = 1;
                    }
                    e.showCost = true;
                }
                if(ongoingGeneral().includes('preferred_credits_cost') && isPreferred(p, f)){
                    e.cost = {
                        credits: 1
                    }
                    e.showCost = true;
                }
                if(e.cost && !getCostInfo(p, e.cost)){
                    e.disabled = true;
                    e.choice = `${e.name} 💰`
                }else if(e.showCost){
                    e.choice = `${renderCost(e.cost)}: ${e.name}`;
                }

                available.push({
                    type: 'text',
                    choice: e.name,
                    value: e,
                    ...e
                })
            }
            let effect = await choose(`Choose card effect`, available, {vertical: true, foreground: f});
            await doEffect(effect);
            let a = available.find(a => a.value == effect);
            params.chosen = a.choice;
            params.card = f.name;
        },
        log: (params) => `${params.chosen && params.card ? `took action ${params.chosen} on Preferred Focus card ${params.card}` : 'took action on Preferred Focus card'}`
    },
    {
        verb: 'peek',
        impossible: (p, params) => get(state).turn.cycle == 3,
        action: async (p, params) => {
            let events = get(state).events[`cycle_${get(state).turn.cycle + 1}`].slice(0, 2);
            for(let e of events){
                logAvailable(e);
            }
            let chosen = await choose(`Choose one of the next two Galactic Event cards to place on top of the deck`, events, {foregroundAll: true});
            let bottom = events.find(e => e.id != chosen.id);
            params.chosenName = lo(chosen).name;
            log({
                type: 'stats',
                eventChosen: chosen.id,
                eventRejected: bottom.id
            }, p)
            state.update(s => {
                s.events[`cycle_${s.turn.cycle + 1}`] = [ol(chosen), ...s.events[`cycle_${s.turn.cycle + 1}`].slice(2), ol(bottom)];
                return s;
            })
            
        },
        log: (params) => `peeked at top two Galactic Event cards and chose ${params.chosenName} to put on top`
    },
    {
        verb: 'gain_agenda',
        description: (params) =>  `[[gain_agenda]] Gain${params.type ? ` ${params.type}` : ''} agenda`,
        action: async (p, params) => {
            //await showExpandable('agendas')
            
            let agenda = await choose(`Select an agenda to gain, or click the backs to pick blind`, getAgendasAndBacks(get(state), params.type));
            // Or do we want to foreground it?
            let statsLogToAdd = [];

            
            
            if(agenda.id.endsWith('back')){
                // picking blind!
                await newInformation();
                let type = agenda.id.split('_')[1];

                /*if(get(state).agenda_board[type].deck.length < 2){
                    // Reshuffle
                    shuffle(get(state).agenda_board[type].discard);
                    while(get(state).agenda_board[type].discard.length > 0){
                        moveBitTo(get(state).agenda_board[type].discard[0], get(state).agenda_board[type].deck);
                    }
                }        */

                statsLogToAdd.push({
                    type: 'stats',
                    agendaUntaken: get(state).agenda_board[type].offer.id,
                    tookVisibleAgenda: false,
                    fixedAgendas: true
                });
                
                let blind = get(state).agenda_board[type].deck.slice(0, 2);
                
                for(let b of blind){
                    logAvailable(b);
                }
                agenda = await choose(`Select agenda to take`, blind, {foreground: blind, beforeAdvancing: (a) => {
                    let notTaken = blind.find(b => b.id != a.id);
                    if(notTaken){
                        moveBitTo(notTaken, get(state).agenda_board[type].deck, -1); // Push to end
                        statsLogToAdd.push({
                            type: 'stats',
                            agendaUntaken: notTaken.id,
                            fixedAgendas: true
                        });
                    }
                    moveBitTo(a, p.agenda_hand);
                    statsLogToAdd.push({
                        type: 'stats',
                        agendaTaken: a.id,
                        fixedAgendas: true
                    });
                    agenda = a;
                }});   
            }else{
                await newInformation();
                moveBitTo(agenda, p.agenda_hand);
                statsLogToAdd.push({
                    type: 'stats',
                    agendaTaken: agenda.id,
                    tookVisibleAgenda: true,
                    fixedAgendas: true
                });

                let nextOne = get(state).agenda_board[agenda.type].deck[0];
                if(nextOne){
                    moveBitTo(nextOne, get(state).agenda_board[agenda.type], 'offer');
                    logAvailable(nextOne);
                }
                
            }
            params.typeGained = agenda.type;
            
            
            if(get(state).agenda_board[agenda.type].corrupted){
                // Take the corruption
                params.wasCorrupted = true;
                await doAction(p, 'gain_corruption', {obj: get(state).agenda_board[agenda.type].corrupted});
            }
            await hideExpandable('agendas');

           for(let s of statsLogToAdd){
            log(s, p);
           }

        },
        log: (params) => `gained agenda ${params.obj ? lo(params.obj).name : ''}`
    },
    {
        verb: 'score_agenda',
        description: (params) => {
            return `[[score_agenda]] evaluate agenda`
        },
        defaults: {
            num: 1,
            type: 'non-starting',
            obj: async (p, params) => {
                if(params.num == 'all') return p.agendas.filter(a => !a.corrupted && a.card).map(a => a.card);
                let poss = p.agendas.filter(a => !a.corrupted && a.card).map(a => a.card);
                if(params.type == 'non-starting'){
                    poss = poss.filter(a => lo(a).type != 'starting');
                }else if(params.type){
                    poss = poss.filter(a => lo(a).type == params.type || Array.isArray(params.type) && params.type.includes(lo(a).type));
                }
                return await choose(`Select ${possPlural(params.num, 'agenda')} to score`, poss, {number: params.num, foregroundAll: true, count: poss.map(a => score_agenda(p, lo(a)).elements)})
            }
        },
        action: async (p, params) => {
            let scores = [];
            for(let a of possArray(params.obj)){
                a = lo(a);
                let score = score_agenda(p, a);
                log(`Scoring ${a.name ? `agenda ${a.name}` : 'Starting agenda'} for ${score.total}`);
                await doAction(p, 'gain_influence', {num: score.total, source: a.id, from: 'agenda'})
                scores.push(score);
            }
            let total = scores.reduce((a,c) => a + c.total, 0)
            //await doAction(p, 'gain_influence', {num: total, source: params.obj.id, from: 'agenda'});
            await pause(`Scored agenda${possArray(params.obj).length > 1 ? 's' : ''}: total score ${total} [[influence]]`, {foreground: possArray(params.obj), count: scores.map(s => s.elements)})
        }
    },
    {
        verb: 'gain_tech',
        description: (params) => {
            if(params.type == 'basic' || params.type == 'improved') return `[[gain_tech_${params.type}]]`;
            return `[[gain_tech]]`;
        },
        defaults: {
            type: ['basic', 'improved'],
        },
        impossible: (p, params) => {
            let testingType = params.type;
            if(params.chooseFrom){
                if(p.techs.length >= techLimit(p) || !params.chooseFrom.some(t => basicTechs(get(state)).find(tech => tech.name == t))) return true;
            }
            if(p.techs.length >= techLimit(p)){
                if(params.type == 'basic') return true;
                if(p.techs.every(t => t.type == 'improved')) return true;
                if(Array.isArray(params.type) || !params.type) testingType = 'improved';
                params.type = 'improved'; // Only let them get improved at this point
            }
            if(testingType == 'improved' && p.techs.filter(t => t.type == 'improved').length >= improvedTechLimit(p)) return true;
            if(testingType == 'improved' && get(state).turn.cycle == 1 && p.improved_tech.length == 0) return false; // already taken own
            return false;
        },
        action: async (p, params) => {
            if(!params.obj){
                //type for basic/improved
                let type = params.type;
                let toChoose = [];
                
                if(params.chooseFrom){ // for Fallen Houses
                    toChoose = basicTechs(get(state)).filter(tech => params.chooseFrom.some(t => t == tech.name));
                    // NB for now it doesn't allow for improved techs
                }else{
                    let possible = {};
                    possible.basic = basicTechs(get(state)).filter(t => !p.techs.some(te => te.name == t.name)).map(t => t.lo ? lo(t) : t)
                    let available = p.improved_tech;
                    if(get(state).turn.cycle != 1) available = [...available, ...get(state).galactic_board.improved_techs.flatMap(t => t)];
                    available = available.map(t => t.lo ? lo(t) : t); // Just in case EXCEPT it breaks on repeated games 
                    possible.improved = available.filter(t => p.techs.some(tec => tec.type == 'basic' && tec.name == t.name));
                    if(Array.isArray(type)){
                        if(p.techs.filter(t => t.type == 'improved').length >= improvedTechLimit(p) 
                        || get(state).turn.cycle == 1 && p.improved_tech.length == 0
                        ) type = type.filter(t => t != 'improved');
                        if(p.techs.length >= techLimit(p)) type = type.filter(t => t != 'basic')
                        if(type.length == 0) throw 'impossible';
                        if(type.length > 1){
                            toChoose = [...possible.improved, ...possible.basic];
                        }else{
                            toChoose = [...possible[type[0]]]
                        }
                    }else{
                        if(type == 'basic' && p.techs.length >= techLimit(p)) throw 'impossible';
                        toChoose = [...possible[type]];
                    }
                }
                if(toChoose.length == 0) throw 'impossible';
                //if(toChoose.includes('basic')) await showExpandable('techs');
                let fg = [...toChoose];
                if(!params.chooseFrom) fg = fg.filter(t => t.type == 'improved');
                let tech;
                /*let benefitChoices = [
                    {
                        type: 'text',
                        choice: 'Ignore benefit',
                        value: true,
                        toggle: true,
                        obj: params,
                        key: 'ignoreBenefit'
                    },
                    {
                        type: 'text',
                        choice: 'Include benefit',
                        value: false,
                        toggle: true,
                        obj: params,
                        key: 'ignoreBenefit'
                    },
                ]*/
                //params.ignoreBenefit = false;
                tech =  await choose(`Select a tech to gain`, [...toChoose/*, ...benefitChoices*/], {foreground: fg, noAuto: true, optional: params.optional}); // {foreground: toChoose}
                if(!tech) return 'failed'; // Didn't do it!
                params.obj = tech; //ol(tech);
                
            }
            if(typeof params.obj == 'string') params.obj = at(params.obj);
            
            let tech = params.obj;
            params.type = tech.type; // for e.g. crisis
            

            await resolveTechGain(p, tech);

            if(tech.type == 'basic'){
                moveBitTo(tech, p.techs, -1, true);
            }else{
                
                let index = p.techs.findIndex(t => t.name == tech.name && t.type == 'basic');
                let bt = p.techs[index];

                moveBitTo(bt, get(state).spare_cards, -1, true);
                moveBitTo(tech, p.techs, index, true);

                if(tech.name == 'Escape Pods' || tech.name == 'Decontamination Chambers'){
                    // Need to transfer across
                    for(let i = 0; i < bt.inside.length; i++){
                        let s = bt.inside[i];
                        if(s[s.slot]) moveBitTo(s[s.slot], tech.inside[i], s.slot);
                        //tech.inside[i][s.slot] = s[s.slot];
                    }
                    //tech.inside = bt.inside;
                    
                }  
            }
            if(tech.inside) assembleList(tech.inside, tech, 'inside', `${bl(tech.id).address}.inside`, true);
            setProductionLevels(p); // To make sure things like Data Refinery or Orbital Docks take effect
            if(['Carriers', 'Dreadnoughts'].includes(tech.name) && tech.type == 'improved'){
                for(let s of playerSectors(p)){
                    await consolidateFleets(s); // Make use of it!
                }
            }
            await hideExpandable('techs');
            
            
            let effects = [];

            if(tech.effect){
                let forEffect = techs.find(t => t.id == tech.id);
                effects.push(...possArray(forEffect.effect));
            }

            if(tech.influence && !params.noReward){
                effects.unshift({
                    verb: 'gain_influence',
                    num: tech.influence,
                    from: 'tech',
                    source: tech.id
                })
            }

            /*if(tech.influence && !params.noReward){
                await doAction(p, 'gain_influence', {num: tech.influence, from: 'tech', source: tech.id});
                params.tookInfluence = true;
            }else{
                params.tookInfluence = false;
            }*/
        
            if(effects.length > 0/*tech.effect && !params.ignoreBenefit*/){
                // Some techs (e.g. Shields) don't have an effect
                await executeActions(p, effects, {foreground: tech, source: tech.id, alwaysAsk: true});
            }
            /*if(get(state).log.some(l => l.verb == 'gain_influence' && l.from == 'tech' && l.source == tech.id)){
                params.tookInfluence = true;
            }else{
                params.tookInfluence = false;
            }*/
            state.update(s => {
                return s; // To trigger re-render of cards, in case
            })
            if(tech.type == 'basic'){
                log({
                    type: 'stats',
                    techGained: tech.id,
                }, p)
            }else{
                log({
                    type: 'stats',
                    techImproved: tech.id,
                }, p)
            }
            updateSkirmish(p);
        },
        log: (params) => `gained technology ${params.obj ? lo(params.obj).fullName : ''}`
    },
    {
        verb: 'gain_trade',
        impossible: (params) => bottomTrade() == -1,
        defaults: {
            num: 1,
            gain_benefits: true
        },
        action: async (p, params) => {
            for(let _ of Array(params.num)){
                await takeTrade(p, params.gain_benefits);
            }
            updateSkirmish(p);
        },
        log: (params) => `gained ${params.num > 1 ? params.num : ''} trade token${params.num > 1 ? 's' : ''}`
    },
    {
        verb: 'gain_glory',
        defaults: {
            num: 1,
            type: 1
        },
        action: async (p, params) => {
            if(params.obj){
                moveBitTo(params.obj, p.glory);
                if(ongoingGeneral().includes('upgrade_on_glory') && await ask(`You may upgrade the [[glory]] token you just gained: do you want to?`)){
                    await doAction(p, 'upgrade_glory', {obj: params.obj})
                }
                return;
            }
            for(let _ of Array(params.num)){
                let glory = topToken(`glory${params.type}`)
                moveBitTo(glory, p.glory);
                if(ongoingGeneral().includes('upgrade_on_glory') && await ask(`You may upgrade the [[glory]] token you just gained: do you want to?`)){
                    await doAction(p, 'upgrade_glory', {obj: glory})
                }
            }
        },
        log: (params) => `gained value ${params.type} Glory token`
    },
    {
        verb: 'place_multiple',
        // To place installations/guilds/tokens all in one go
        description: (params) => {
            let list = []
            for(let o of params.obj){
                let desc = `place_${o}`;
                if(params.place && typeof params.place == 'string') desc += `_${params.place}`;
                if(params.restriction) desc += `_${params.restriction}`;
                list.push(`[[${desc}]]`)
            }
            
            return list.join(', ')
        },
        defaults: {
            possibleSectors: (p, params) => {
                let eligible = all('sectors', locationFilter(params.place, p));
                let canFitAll = [];
                for(let s of eligible){
                    let canFit = true;
                    let numGuilds = params.obj.filter(o => o == 'guild' || holderMaker[o] == 'guilds').length;
                    let numInst = params.obj.filter(o => o == 'installation' || holderMaker[o] == 'installations').length;
                    // TODO should the below run?
                    let numVB = params.obj.filter(o => o == 'voidborn').length;
                    if(guildSpaces(p, s) - guilds(s).length < numGuilds) canFit = false;
                    if(s.installation_spaces - s.installations.length < numInst) canFit = false;
                    // TODO should?
                    if(voidbornFleetSpaces(s) < numVB) canFit = false;
                    if(canFit) canFitAll.push(s);
                }
                return canFitAll;
            }
        },
        impossible: (p, params) => {
            let eligible = all('sectors', locationFilter(params.place, p));
            let canFitAll = [];
            for(let s of eligible){
                let canFit = true;
                let numGuilds = params.obj.filter(o => o == 'guild' || holderMaker[o] == 'guilds').length;
                let numInst = params.obj.filter(o => o == 'installation' || holderMaker[o] == 'installations').length;
                // TODO ??
                let numVB = params.obj.filter(o => o == 'voidborn').length;
                if(guildSpaces(p, s) - guilds(s).length < numGuilds) canFit = false;
                if(s.installation_spaces - s.installations.length < numInst) canFit = false;
                // TODO ??
                if(voidbornFleetSpaces(s) < numVB) canFit = false;
                if(canFit) canFitAll.push(s);
            }
            if(canFitAll.length == 0) return true;
        },
        description: (params) => `place ${params.obj ? params.obj.map(o => `[[${o}]]`) : ''}`,
        action: async (p, params) => {
            let place = params.possibleSectors; 
            if(!place){
                await pause('No eligible sectors to place tokens in');
                return;
            }
            if(Array.isArray(place)){
                if(params.obj.some(o => o == 'voidborn')){
                    // Filter by most available
                    let num = params.obj.filter(o => o == 'voidborn').length;
                    let poss;
                    do{
                        poss = place.filter(s => voidbornFleetSpaces(s) >= num);
                        num--;
                    }while(poss.length == 0 && num > 0)
                    place = poss;
                }
                if(params.num != 'all'){
                    place = await choose(`Choose sector to place ${params.obj.map(o => `[[${o}]]`).join(', ')} in`, place, {singleClick: true, number: params.num || 1});
                }
            }
            params.place = place;
            if(!params.place || possArray(params.place).length == 0){
                console.log('Nowhere to place these things!');
                params.abandoned = true;
                return;
            }
            for(let pl of possArray(params.place)){
                for(let o of params.obj){
                    let slot = holderMaker[o];
                    let type = o;
                    if(o == 'guild'){
                        await doAction(p, 'establish', {place: pl, always: true});
                    }else if(type == 'voidborn'){
                        await moveFleet('voidborn', 'active', pl.id, 'place');
                    }else if(type.startsWith('glory')){
                        moveBitTo(topToken(type), pl.glory);
                    }else{
                        moveBitTo(topToken(type), pl[slot]);
                    }
                }
            }
            
        },
        log: (params) => params.abandoned ? 'Did not place anything, because there was no suitable sector' : `placed ${params.obj.map(o => `[[${o}]]`).join(', ')} in sector(s)`
    },
    {
        verb: 'establish', // guild
        impossible: (p, params) => playerSectors(p).filter(s => guilds(s).length < guildSpaces(p, s)).length == 0 || 
                                    (params.place && guilds(params.place) && guilds(params.place).length == guildSpaces(p, params.place)), 
        description: (params) => {
            if(params.type) return `[[${params.type}]]`;
            return `[[establish]]`;
        },
        defaults: {
            place: async (p, params) => {
                if(playerSectors(p).filter(s => guilds(s).length < guildSpaces(p, s)).length == 0) throw 'impossible';
                let place = await choose(`Choose where to establish guild`, playerSectors(p).filter(s => guilds(s).length < guildSpaces(p, s)), {singleClick: true})
                return place;
            },
            type: async (p, params) => {
                
                params.place = resolvePlace(params.place, p, params.always ? all('sectors') : playerSectors(p));
                if(!params.place ){
                    await pause('Nowhere to place [[guild]] - abandoning');
                    return false;
                }
                if(Array.isArray(params.place)) params.place = await choose(`Choose where to establish guild`, params.place.filter(s => guilds(s).length < guildSpaces(p, s)), {singleClick: true});
                if(!params.place || guilds(params.place).length == guildSpaces(p, params.place)) throw 'impossible';
                params.sectorPopulation = params.place.population || 0;
                if(controlledBy(params.place, p)) params.playerSector = true;
                if(params.place.type == 'home' && hasTech(p, 'Ark Ships') && params.place.ark_ships.length < arkSpaces(p)){
                    let where = 'Ark Ships';
                    if(params.place.guilds.length < params.place.guild_spaces) where = await choose(`Do you want to place this guild in your guild spaces, or on your Ark Ships?`, ['Guild spaces', 'Ark Ships']);
                    if(where == 'Ark Ships'){
                        params.ark_ships = true;
                    }else{
                        params.ark_ships = false;
                    }
                }
                let to = params.ark_ships ? params.place.ark_ships : params.place.guilds;
                let tok = await choose(`Choose a guild to establish`, Object.values(guildMaker).map(g => topToken(g)), {singleClick: true, beforeAdvancing: (tok) => {
                    moveBitTo(tok, to)
                    params.built = true;
                }});
                return tok.value;
            }
        },
        action: async (p, params) => {
            // redo production
            
            if(!params.built){
                params.place = resolvePlace(params.place, p, params.always ? all('sectors') : playerSectors(p));
                if(!params.place) throw 'impossible';
                
                if(possArray(params.place).length > 1) params.place = await choose(`Choose where to establish guild`, params.place.filter(s => guilds(s).length < guildSpaces(p, s)), {singleClick: true});
                if(!params.place) throw 'impossible';
                if(controlledBy(params.place, p)) params.playerSector = true;
                params.sectorPopulation = params.place.population || 0;
                if(params.place.type == 'home' && hasTech(p, 'Ark Ships') && params.place.ark_ships.length < arkSpaces(p)){
                    let where = 'Ark Ships';
                    if(params.place.guilds.length < params.place.guild_spaces) where = await choose(`Do you want to place this guild in your guild spaces, or on your Ark Ships?`, ['Guild spaces', 'Ark Ships']);
                    if(where == 'Ark Ships'){
                        params.ark_ships = true;
                    }else{
                        params.ark_ships = false;
                    }
                }
                let to = params.ark_ships ? at(params.place.id).ark_ships : at(params.place.id).guilds;
                moveBitTo(topToken(params.type), to);
            }
            state.update(s => {
                s.cache.lastResourceType = resMaker[params.type];
                return s;
            }) 
            setProductionLevels(p);
            if(sectorSpecial(params.place, 'genesis_establish') && ['farmers_guild', 'miners_guild', 'engineers_guild'].includes(params.type) && params.place.population < 6){
                log('Genesis sector: increasing population');
                await doAction(p, 'increase_population', {place: params.place})
            }
            state.update(s => {
                return s; // To trigger rerender
            })
            updateSkirmish(p);
        },
        log: (params) => `established ${params.obj ? '[[' + params.obj + ']]': 'guild'} in sector`
    },
    {
        verb: 'build', //installation
        impossible: (p, params) => {
            //if(hasTech(p, 'Sentries', 'improved') && p.fleets.active.length > 0) return false; // You can always build a Sentry
            let place = possArray(params.place || playerSectors(p));
            return place.filter(s => s.installations.length < s.installation_spaces).length == 0;
        },
        description: (params) => {
            if(params.type) return `[[${params.type}]]`;
            return `[[build]]`;
        },
        defaults: {
            place: async (p, params) => {
                if(hasTech(p, 'Sentries', 'improved') && p.fleets.active.length > 0){
                    let sentry = await choose(`[[improved_tech]] Sentries: you may deploy a Sentry as well as build in the same sector. Do you want to?`, ['Yes', 'No']);
                    params.doNotAskForSentries = true;
                    if(sentry == 'Yes'){
                        let place = await choose(`Select sector to deploy Sentry`, playerSectors(p).filter(s => s.installations.length < s.installation_spaces));
                        await doAction(p, 'deploy', {num: 1, type: 'sentry', place});
                        params.doNotAskForSentries = true;
                        if(place.installations.length < place.installation_spaces) return place;
                        // NB the above was commented out, but I don't know why! As far as I know it works.
                        // Without it then you get a choice to place a sentry somewhere different from the installation,
                        // which I don't think is correct. But I can revert if it turns out it causes problems elsewhere!
                        return false;
                    }
                }
                if(playerSectors(p).filter(s => s.installations.length < s.installation_spaces).length == 0){
                    await pause(`You cannot [[build]] anywhere – abandoning`);
                    return false;
                }
                return await choose(`Choose where to build installation`, playerSectors(p).filter(s => s.installations.length < s.installation_spaces), {singleClick: true});
            },
            type: async (p, params) => {
                
                params.place = resolvePlace(params.place, p, playerSectors(p));
                if(!params.place) throw 'impossible';
                if(possArray(params.place).length > 1) params.place = await choose(`Choose where to build installation`, params.place.filter(s => s.installations.length < s.installation_spaces), {singleClick: true});
                if(!params.place || params.place.installations.length == params.place.installation_spaces) throw 'impossible';
                if(controlledBy(params.place, p)) params.playerSector = true;
                if(hasTech(p, 'Sentries') && p.fleets.active.length > 0 && !params.doNotAskForSentries){
                    let text = 'instead';
                    if(hasTech(p, 'Sentries', 'improved')) text = 'additionally';
                    let sentry = await choose(`[[${text == 'additionally'? 'improved_' : 'basic_'}tech]] Sentries: you may ${text} deploy a Sentry here. Do you want to?`, ['Yes', 'No']);
                    params.doNotAskForSentries = true;
                    if(sentry == 'Yes'){
                        await doAction(p, 'deploy', {type: 'sentry', place: params.place});
                        if(text == 'instead'){
                            params.built = true;
                            return 'sentry';
                        }
                    }
                }
                let tok = await choose(`Choose an installation to build`, availableInstallations(p, params.place).map(g => topToken(g)), { singleClick: true, beforeAdvancing: (tok) => {
                    moveBitTo(tok, params.place.installations)
                }});
                params.built = true;
                
                return tok.value;
            },
        },
        action: async (p, params) => {
            
            params.place = resolvePlace(params.place, p, playerSectors(p));
            if(!params.place) throw 'impossible';
            if(possArray(params.place).length > 1) params.place = await choose(`Choose where to build installation`, params.place.filter(s => s.installations.length < s.installation_spaces), {singleClick: true});
            if(!params.place) throw 'impossible';
            if(controlledBy(params.place, p)) params.playerSector = true;
            if(hasTech(p, 'Sentries') && !params.doNotAskForSentries && p.fleets.active.length > 0){
                let text = 'instead';
                if(hasTech(p, 'Sentries', 'improved')) text = 'additionally';
                let sentry = await choose(`[[${text == 'additionally'? 'improved_' : 'basic_'}tech]] Sentries: you may ${text} deploy a Sentry here. Do you want to?`, ['Yes', 'No']);
                if(sentry == 'Yes'){
                    await doAction(p, 'deploy', {type: 'sentry', place: params.place});
                    if(text == 'instead'){
                        params.built = true;
                        return 'sentry';
                    }
                }else{
                    params.noSentry = true;
                }
            }



            if(!params.built){
                moveBitTo(topToken(params.type), at(params.place.id).installations);
            }
            // All done by now!
            if(hasTech(p, 'Starbases') && params.type == 'starbase'){
                let tech = p.techs.find(t => t.name == 'Starbases');
                if(!params.place.corrupted){
                    if(await ask(`[[${tech.type}_tech]] Starbases: increase population in sector?`)) await doAction(p, 'increase_population', {place: params.place});
                }else if(tech.type == 'improved'){
                    if(await ask(`[[improved_tech]] Starbases: remove [[corruption]] from sector?`)) await doAction(p, 'remove_corruption', {obj: params.place.corrupted});
                }
            }
            
            if(hasTech(p, 'Orbital Docks', 'improved')) setProductionLevels(p, 'credits');
            updateSkirmish(p);
        },
        log: (params) => `built [[${params.type || 'installation'}]] in sector`
    },
    {
        verb: 'unbuild',
        description: (params) => {
            let ret = `${params.num > 1 ? `${params.num} ` : ''}`;
            if(params.type){
                ret += possArray(params.type).map(t => ['starbase', 'shipyard'].includes(t) ? 'remove '+t : `[[unbuild_${t}]]`).join('/');
            }else{
                ret += '[[unbuild]]';
            }
            return ret;
        },
        impossible: (p, params) => {
            let eligible = playerSectors(p).filter(s => s.type != 'home').flatMap(s => s.installations.filter((b, i) => (!params.type || b.value == params.type || Array.isArray(params.type) && params.type.includes(b.value)) && (!s.installations_fixed || !s.installations_fixed[i])));
            if(eligible.length < (params.num || 1)) return true;
            return false;  
        },
        defaults: {
            num: 1,
            place: 'not_home',
            obj: async (p, params) => {
                let eligible = playerSectors(p).flatMap(s => s.installations.filter((b, i) => (!params.type || b.value == params.type || Array.isArray(params.type) && params.type.includes(b.value)) && (!s.installations_fixed || !s.installations_fixed[i])));
                if(!params.place){
                    return await choose(`Select installation(s) to return`, eligible, {number: params.num, singleClick: params.num == 1});
                }else{
                    let place = possArray(resolvePlace(params.place, p, playerSectors(p)));
                    return await choose(`Select installation(s) to return`, eligible.filter(e => place.some(p => isIn(e, p.id))), {number: params.num, singleClick: params.num == 1});
                }
            }
        },
        action: async (p, params) => {
            for(let o of possArray(params.obj)){
                let place = resolveAddress(get(state), bl(o.id).address, 2);
                cacheSector(place);
                await returnToken(o, p);
            }
            
            updateSkirmish(p);
        },
        log: (params) =>  `returned ${params.num > 1 ? params.num : 'an'} installation(s)`
    },
    {
        verb: 'unguild',
        description: 'destroy a guild',
        impossible: (p, params) => {
            let eligible = playerSectors(p).flatMap(s => guilds(s).filter((b, i) => (!params.type || b.value == params.type || Array.isArray(params.type) && params.type.includes(b.value)) && (!s.guilds_fixed || !s.guilds_fixed[i])));
            if(!params.place) params.place = 'not_home';
            if(params.place){
                let place = possArray(resolvePlace(params.place, p, playerSectors(p)));
                eligible = eligible.filter(e => place.some(p => isIn(e, p.id)));
            }
            if(eligible.length < (params.num || 1)) return true;
            return false;  
        },
        defaults: {
            num: 1,
            place: 'not_home',
            obj: async (p, params) => {
                let eligible = playerSectors(p).flatMap(s => guilds(s).filter((b, i) => (!params.type || b.value == params.type || Array.isArray(params.type) && params.type.includes(b.value)) && (!s.guilds_fixed || !s.guilds_fixed[i])));
                if(!params.place){
                    return await choose(`Select guild(s) to return`, eligible, {number: params.num, singleClick: params.num == 1});
                }else{
                    let place = possArray(resolvePlace(params.place, p, playerSectors(p)));
                    return await choose(`Select guild(s) to return`, eligible.filter(e => place.some(p => isIn(e, p.id))), {number: params.num, singleClick: params.num == 1});
                }
            }
        },
        action: async (p, params) => {
            for(let o of possArray(params.obj)){
                let place = resolveAddress(get(state), bl(o.id).address, 2);
                cacheSector(place);
                await returnToken(o, p);
            }
            setProductionLevels(p); // Because it will have affected production
            updateSkirmish(p);
        },
        log: (params) =>  `returned ${params.num > 1 ? params.num : 'a'} guild(s)`
    },
    {
        verb: 'recall',
        description: (params) => `${params.num > 1 ? `${params.num} ` : ''}[[recall]]`,
        defaults: {
            num: 1,
            obj: async (p, params) => {
                if(!params.place) return await choose(`Select fleet(s) to recall`, all(`fleet_${p.colour}`, (f) => isIn(f, 'sectors')), {number: params.num, singleClick: params.num == 1});
                let place = resolvePlace(params.place, p, playerSectors(p));
                if(Array.isArray(place)){
                    return await choose(`Select fleet(s) to recall`, all(`fleet_${p.colour}`, (f) => params.place.some(s => isIn(f, s.id))), {number: params.num});
                }
                let types = [];
                for(let f of place.fleets){
                    if(f.owner == p.colour && !types.includes(f.type)) types.push(f.type);
                }
                if(types.length == 1){
                    let obj = [];
                    let ships = place.fleets.filter(f => f.owner == p.colour).sort((a,b) => a.cubes.length - b.cubes.length).flatMap(f => f.cubes);
                    for(let i = 0; i < params.num; i++){
                        obj = [...obj, ships[0]];
                        ships = ships.slice(1);
                    }
                    return obj;
                }else{
                    return await choose(`Select fleet(s) to recall`, place.fleets.filter(f => f.owner == p.colour).flatMap(f => f.cubes), {number: params.num})
                }
            }
        },
        impossible: (p, params) => {
            if(totalDeployed(p) < (params.num || 1)) return true;
            if(params.place){
                let place = resolvePlace(params.place, p, playerSectors(p));
                if(Array.isArray(place)){
                    if(all(`fleet_${p.colour}`, (f) => place.some(p => isIn(f, p.id))).length < (params.num || 1)) return true;
                }else{
                    if(all(`fleet_${p.colour}`, (f) => isIn(f, place.id)).length < (params.num || 1)) return true;
                }
                
                return false;
            }
        },
        action: async (p, params) => {
            let obj = possArray(params.obj);
            for(let o of obj){
                cacheSector(fleetSector(o), false); // Duplicates ok here
                await moveFleet(p, o.id, 'active');
                //moveBitTo(o, p.fleets.active);
            }
            updateSkirmish(p);
        },
        log: (params) => `recalled ${params.num} fleet power`
    },
    {
        verb: 'increase_population',
        impossible: (p, params) => {
            let testSectors = playerSectors(p);
            if(params.place) testSectors = resolvePlace(params.place, p, playerSectors(p));
            if(!testSectors) return true;
            testSectors = possArray(testSectors);
            return !testSectors.some(s => !s.corrupted && s.population < 6 && !s.fixedPopulation);
        },
        defaults: {
            num: 1,
            possibleSectors: (p, params) => playerSectors(p).filter(s => !s.corrupted && !s.fixedPopulation && s.population < 6),
            place: async (p, params) => await choose(`Select sector to increase the population in it`, params.possibleSectors, {singleClick: true})
        },
        action: async (p, params) => {
            params.place = resolvePlace(params.place, p, params.possibleSectors);
            if(Array.isArray(params.place)) params.place = await choose(`Choose a sector to increase the population in it`, params.place, {singleClick: true});
            if(params.place.corrupted) throw 'impossible';
            if(!params.place){
                log('No suitable sector to increase population in it');
                throw 'impossible';
            }
            params.place.population = Math.min(params.place.population + 1, 6);
            setProductionLevels(p);
            if(hasTech(p, 'Cybernetics', 'improved') && controlledBy(params.place, p)){
                // offer to gain
                let typesToGain = {};
                for(let g of guilds(params.place)){
                    let r = resMaker[g.value];
                    if(!typesToGain[r]) typesToGain[r] = 0;
                    typesToGain[r] += 2; 
                }
                addReaction(p, '[[improved_tech]] Cybernetics: gain matching resources', p.techs.find(t => t.name == 'Cybernetics').id, async () => {
                    await doAction(p, 'gain_resource', {types: typesToGain, source: p.techs.find(t => t.name == 'Cybernetics').id})
                    
                    /*for(let g of guilds(params.place)){
                        let r = resMaker[g.value];
                        await doAction(p, 'gain_resource', {
                            type: r,
                            num: 2
                        });
                    }*/
                }, 'ic')
            }
            updateSkirmish(p);
        },
        log: (params) => `increased population in sector`
    },
    {
        verb: 'third_action',
        description: '[[third_action]]',
        impossible: (p, params) => !get(state).focus || !get(state).focus.chosen || get(state).focus.actions == 3 || get(state).focus.actionsTaken.length == 3 || get(state).focus.trade,
        action: async (p, params) => {
            await thirdFocusAction(p);
        }
    },
    {
        verb: 'decrease_population',
        impossible: (p, params) => {
            let possible = playerSectors(p);
            if(params.place) possible = resolvePlace(params.place, p);
            if(!possible) return true;
            possible = possArray(possible).filter(s => !s.corrupted && !s.fixedPopulation && s.population > 1);
            //if(params.restriction) possible = possible.filter(s => locationFilter(params.restriction)(s));
            return possible.length == 0;
        },
        defaults: {
            num: 1,
            place: async (p, params) =>{
                let possible = playerSectors(p).filter(s => !s.corrupted && !s.fixedPopulation && s.population > 1);
                //if(params.restriction) possible = possible.filter(s => locationFilter(params.restriction)(s));
                return await choose(`Select sector to decrease population in it`, possible);
            }
        },
        action: async (p, params) => {
            params.place = resolvePlace(params.place, p, playerSectors(p).filter(s => !s.corrupted && !s.fixedPopulation && s.population > 1));
            if(Array.isArray(params.place)) params.place = await choose(`Select sector to decrease population in it`, params.place);
            //let s = params.place;
            params.place.population = Math.max(params.place.population - 1, 1);
            setProductionLevels(p);
            updateSkirmish(p);
        },
        log: (params) => `decreased population in sector`
    },
    {
        verb: 'produce',
        defaults: {
            num: 1,
            produced: () => {return []},
            possible: resourceTypes,
            obj: async (p, params) => {
                let types = [];
                for(let i = 0; i < params.num; i++){
                    let available = params.possible;
                    if(params.restriction == 'different') available = available.filter(a => !types.includes(a));
                    let choices = available.map(a => {
                        return {
                            type: 'text',
                            choice: `[[${a}]] ${upperInitial(a)}`,
                            value: a
                        }
                    })
                    let obj = await choose(`Choose a resource type to produce`, choices);
                    types.push(obj);
                }
                return types;
            }
        },
        action: async (p, params) => {
            let obj = possArray(params.obj);
            for(let o of obj){
                await produce(p, o);
                params.produced.push(o);
                state.update(s => {
                    s.cache.lastResourceType = o; // won't work for multiples but that should be ok;
                    return s;
                }) 
            }
        },
        log: (params) => `produced ${params.produced ? params.produced.map(p => `[[${p}]]`).join(' and ') : ''}`
    },
    {
        verb: 'advance_track',
        description: (params) => {
            if(params.lowest) return `[[advance_lowest]]`;
            if(params.obj) return `[[${params.obj}_track]]`;
            return `[[advance_track]]`
        },
        impossible: (p, params) => {
            if(params.obj){
                if(p.tracks[params.obj].index == house(p).tracks[params.obj].length - 1) return true;
                let cost = costToRise(p, params.obj);
                if(cost && !getCostInfo(p, cost)) return true;
            }else{
                if(Object.keys(p.tracks).every(k => {
                    if(p.tracks[k].index == house(p).tracks[k].length - 1) return true;
                    let cost = costToRise(p, k);
                    if(cost && !getCostInfo(p, cost)) return true;
                })) return true;
            }
            return false;
        },
        defaults: {
            num: 1,
            obj: async (p, params) => {
                let choices = Object.keys(p.tracks).map(t => `[[${t}_track]] ${upperInitial(t)}`);
                let trackIcons = Object.keys(p.tracks).map(k => p.tracks[k]);
                if(params.lowest){
                    // Choose the lowest
                    let min = Infinity;
                    let minTracks = [];
                    for(let k of Object.keys(p.tracks)){
                        if(p.tracks[k].index < min){
                            min = p.tracks[k].index;
                            minTracks = [k];
                        }else if(p.tracks[k].index == min){
                            minTracks.push(k);
                        }
                    }
                    if(minTracks.length == 1){
                        return minTracks[0];
                    }else{
                        choices = minTracks.map(t => `[[${t}_track]] ${upperInitial(t)}`);
                        trackIcons = minTracks.map(k => p.tracks[k]);
                    }
                }
                let choice = await choose(`Click on a track to advance, or select below`, [...choices, ...trackIcons], {singleClick: true});
                if(choice.id) choice = bl(choice.id).key;
                return choice.replaceAll(/[\[\]]/g, '').split('_')[0];
            }
        },
        action: async (p, params) => {
            let cost = costToRise(p, params.obj);
            if(cost) await pay(p, cost, {purpose: `advancing on [[${params.obj}]] track`})
            let rewards = house(p).tracks[params.obj];
            let track = p.tracks[params.obj]
            let prevTier = getTier(p, params.obj)
            let availableActions = [];
            if(track.index < rewards.length - 1){
                track.index++;
                if(!track.corrupted){
                    // Get the reward
                    let reward = rewards[track.index];
                    if(reward){
                        //log('Taking track reward', p);
                        availableActions = possArray(reward);
                        //await executeActions(p, reward, {compulsory: false, source: track.id});
                    }
                }
            }
            if(get(state).mode == 'coop' && getTier(p, params.obj) == 4 && prevTier != 4){
                // You can place 1 fleet power in a Safe Haven
                //if(await ask(`You may add Fleet Power to a Safe Haven for reaching the end of the [[${params.obj}]] track. Do you want to do so?`)) await doAction(p, 'safe_haven');
                availableActions.push('safe_haven');
            }
            if(availableActions.length > 0){
                log(`Taking track reward(s)`);
                await executeActions(p, availableActions, {compulsory: false, alwaysAsk: !availableActions.some(a => a.noCheck), source: track.id})
            }
            if(!params.noBoost && ongoingPlayer(p).includes('advance_boost') && get(state).turnInfo.currentStep == 'focus actions' && !get(state).turnCache.boostedAdvance){
                state.update(s => {
                    s.turnCache.boostedAdvance = true;
                    return s;
                })
                let sec = playerSectors(p).find(s => s.ongoing && s.ongoing.includes('advance_boost'));
                addReaction(p, 'Novarchon Palace: spend a credit to advance on lowest track', false, { // Do we want the sector to be foregrounded? Would that work??
                    cost: {
                        credits: 1
                    },
                    action: {
                        verb: 'advance_track',
                        lowest: true,
                        noBoost: true,
                    }
                }, 'Novarchon Palace')
            }
            state.update(s => {
                if(!s.cache) s.cache = {};
                s.cache.lastTrack = params.obj;
                return s;
            })
        },
        log: (params) => `advanced on [[${params.obj}_track]] ${upperInitial(params.obj)} track`
    },
    {
        verb: 'take_catastrophe',
        description: 'take a [[catastrophe]] token',
        action: async (p, params) => {
            if(get(state).crisis_board.catastrophes.length == 3){
                // End game!
                await pause('Game over: last [[catastrophe]] token taken, so you lose!')
                state.update(s => {
                    s.winner = 'voidborn';
                    s.catastropheLoss = true;
                    return s;
                })
                await endGame();
                return;
            }
            moveBitTo(topToken('catastrophe'), get(state).crisis_board.catastrophes);
            // Mitigations for catastrophe
            for(let p of playersInTurnOrder()){
                let choices = ['Gain any 5 resources']
                if(playerCorruption(p).length > 0){
                    choices.push('Remove a [[corruption]]');
                }
                let choice = choices[0];
                if(choices.length > 1){
                    choice = await choose(`CHoose your mitigation for taking a [[catastrophe]] token`, choices, {p});
                }
                if(choice == 'Gain any 5 resources'){
                    await doAction(p, 'gain_resource', {num: 5})
                }else{
                    await doAction(p, 'remove_corruption');
                }
            }
        },
        log: (params) => `took a [[catastrophe]] token`
    },
    /*{
        verb: 'gain_token',
        action: async (p, params) => {
            await doAction(p, 'gain_glory', {type: parseInt(params.type.slice(-1)[0])})
        }
    },*/
    {
        verb: 'safe_haven',
        impossible: (p, params) => Math.min(totalHavenCapacity(), p.fleets.inactive.length + p.fleets.active.length + totalDeployed(p)) == 0,
        defaults: {
            num: 1,
            message: `Click on a Safe Haven to move one of your fleet power there`
        },
        action: async (p, params) => {
            let amount = Math.min(params.num, totalHavenCapacity(), p.fleets.inactive.length + p.fleets.active.length + totalDeployed(p));
            let text = '';
            for(let i = 0; i < amount; i++){
                let eligible = get(state).havens.filter(h => h.capacity > h.cubes.length);
                if(amount > 1) text = ` (${i+1} of ${amount})`;
                let chosen = eligible[0];
                if(eligible.length > 1 || params.confirm){
                   chosen = await choose(`${params.message}${text}`, [...eligible, 'ok_Finish'], {style: 'top: 30vh;', singleClick: true, alwaysAsk: true});
                   if(chosen == 'Finish') return; // Done!
                }
                if(p.fleets.inactive.length == 0) await doAction(p, 'deactivate'); // Recall if need be
                await moveFleet(p, 'inactive', chosen.id, 'safe_haven');
                params.amount = amount;
                if(chosen.capacity == chosen.cubes.length){
                    // It's completed! Everyone gets a (different) benefit
                    let rewards = [
                        {
                            type: 'text',
                            choice: 'Remove a [[corruption]]',
                            value: 'remove_corruption'
                         },
                         {
                            type: 'text',
                            choice: 'Remove a [[harbinger]]',
                            value: {
                                verb: 'return_token',
                                type: 'harbinger'
                            }
                         },
                         {
                            type: 'text',
                            choice: 'Gain any 3 resources',
                            value: {
                                verb: 'gain_resource',
                                num: 3
                            }
                         },
                         {
                            type: 'text',
                            choice: 'Deploy 2 Fleet Power',
                            value: {
                                verb: 'deploy',
                                num: 2
                            }
                         }
                    ];
                    for(let p of playersInTurnOrder()){
                        try{
                            let chosen = await choose(`Select a reward for completing the Safe Haven`, rewards, {p, cancel:'Choose none'});
                            rewards = rewards.filter(r => r.value != chosen);
                            await executeActions(p, chosen);
                        }catch(e){
                            if(e != 'cancelled') throw e;
                        }
                    }
                }
            }
        },
        log: (params) => `moved ${params.amount || params.num} Fleet Power to a Safe Haven`
    },
    {
        verb: 'upgrade_glory',
        impossible: (p, params) => p.glory.filter(g => g.value < 5).length == 0,
        defaults: {
            obj: async (p, params) => await choose(`Select a Glory token to upgrade`, p.glory.filter(g => g.value < 5), {foregroundAll: true, singleClick: true})
        },
        action: async (p, params) => {
            params.original = params.obj.value;
            params.upgraded = params.obj.value + 1;
            let index = p.glory.findIndex(g => g.id == params.obj.id);
            await returnToken(params.obj, p);
            await tick();
            moveBitTo(topToken(`glory${params.upgraded}`), p.glory, index);
        },
        log: (params) => `upgraded Glory from ${params.original} to ${params.upgraded}`
    },
    {
        verb: 'discard_glory',
        impossible: (p, params) => p.glory.length == 0 || (params.restriction && !p.glory.some(g => g.value >= params.restriction)),
        defaults: {
            num: 1,
            obj: async (p, params) => {
                let text = `a Glory token`;
                if(params.num > 1) text = `${params.num} Glory tokens`
                let poss = p.glory;
                if(params.restriction) poss = poss.filter(g => g.value >= params.restriction)
                return await choose(`Select ${text} to discard`, poss, {foregroundAll: true, number: params.num, singleClick: true});
            }
        },
        action: async (p, params) => {
            let obj = possArray(params.obj);
            for(let o of obj) await returnToken(o, p);
        },
        log: (params) => {
            if(!Array.isArray(params.obj)){
                return `discarded a ${params.obj ? params.obj.value : ''} Glory token`;
            }else{
                return `discarded Glory tokens worth a total of ${params.obj.reduce((a,c) => a + c.value, 0)}`;
            }
        }
    },
    {
        verb: 'discard_agenda',
        impossible: (p, params) => [...p.agenda_hand, ...p.agendas.map(a => a.card).filter(a => a && a.type != 'starting')].length == 0,
        defaults: {
            obj: async (p, params) => {
                let hand = [...p.agenda_hand];
                let mat = [...p.agendas.map(a => a.card).filter(a => a && a.type != 'starting')];
                let toChoose = [...hand, ...mat];
                if(params.restriction == 'hand') toChoose = hand;
                if(params.restriction == 'house_mat') toChoose = mat;
                return await choose(`Select an agenda to discard`, toChoose);
            }
        },
        action: async (p, params) => {
            let possHolder = resolveAddress(get(state), bl(params.obj.id).address, 1);
            if(possHolder && possHolder.trade){
                moveBitTo(possHolder.trade, p.loose_trade);
            }
            moveBitTo(params.obj, get(state).spare_cards)
        },
        log: (params) => `discarded [[agenda]] ${params.obj ? params.obj.name : ''}`
    },
    {
        verb: 'discard_crisis',
        impossible: (p, params) => allCrisesOnBoard(params.type).length == 0,
        defaults: {
            obj: async (p, params) => await choose(`Select a Crisis to discard`, allCrisesOnBoard(params.type))
        },
        action: async (p, params) => {
            log({
                type: 'stats',
                crisis: params.obj.id,
                crisis_removed: true,
                crisisRemovedViaAction: params.obj.id,
                via: 'action',
                source: params.source
            }, p)
            moveBitTo(params.obj, get(state).crisis_discards[`level_${lo(params.obj).level}`]);
            updateSkirmish(p);
        },
        log: (params) => `discarded Crisis card${params.obj ? ' '+lo(params.obj).name : ''}`
    },
    {
        verb: 'place_token',
        description: (params) => {
            let desc = `place_`;
            if(params.type) desc += params.type;
            if(params.place && typeof params.place == 'string') desc += `_${params.place}`;
            if(params.restriction) desc += `_${params.restriction}`;
            return `[[${desc}]]`;
        },
        impossible: (p, params) => {
            if(params.place == 'rift' && !all('sectors').some(s => s.type == 'rift')) return true;
            let poss = all('sectors').filter(s => !playerSectors(p).some(sec => sec.id == s.id));
            if(poss.length == 0) return true;
            if(params.type == 'voidborn'){
                poss = poss.filter(s => voidbornFleetSpaces(s) >= params.num || 1);
                if(poss.length == 0 && !params.vf_fallback) return true;
            }else if(params.type == 'guild' || holderMaker[params.type] == 'guilds'){
                poss = poss.filter(s => guildSpaces(p, s) > guilds(s).length);
            }else if(params.type == 'installation' || holderMaker[params.type] == 'installations'){
                poss = poss.filter(s => s.installation_spaces > s.installations.length);
            }
            if(poss.length == 0) return true;
        },
        defaults: {
            place: async (p, params) => {
                let poss = all('sectors').filter(s => !playerSectors(p).some(sec => sec.id == s.id));
                if(params.type == 'voidborn'){
                    let possFull = poss.filter(s => voidbornFleetSpaces(s) >= params.num || 1);
                    let possPart = poss.filter(s => voidbornFleetSpaces(s) >= 1);
                    if(possFull.length > 0){
                        poss = possFull;
                    }else if(possPart.length > 0){
                        poss = possPart;
                    }
                }
                if(params.num == 'all') return poss;
                return await choose(`Choose a sector to place the [[${params.type}]] token`, poss, {singleClick: true});
            },
            num: 1
        },
        action: async (p, params) => {
            params.place = resolvePlace(params.place, p);
            if(params.type == 'guild' || holderMaker[params.type] == 'guilds'){
                params.place = possArray(params.place).filter(s => guildSpaces(p, s) > guilds(s).length)
            }else if(params.type == 'installation' || holderMaker[params.type] == 'installations'){
                params.place = possArray(params.place).filter(s => s.installation_spaces > s.installations.length);
            }
            if(Array.isArray(params.place)){
                if(params.type == 'voidborn'){
                    // Filter to places where you can put it all if possible
                    let possFull = params.place.filter(s => voidbornFleetSpaces(s) >= params.num);
                    let possPart = params.place.filter(s => voidbornFleetSpaces(s) >= 1);
                    if(possFull.length > 0){
                        params.place = possFull;
                    }else if(possPart.length > 0){
                        params.place = possPart;
                    }
                }
                if(params.place.length > 1){
                    params.place = await choose(`Choose a sector to place the [[${params.type}]] token`, params.place, {singleClick: true});
                }else{
                    params.place = params.place[0];
                }
            }
            if(!params.place || possArray(params.place).length == 0) throw 'impossible'; // Unable to add anything
            for(let i = 0; i < params.num; i++){
                let type = params.type;
                if(params.type == 'guild'){
                    type = await choose(`Choose a guild to establish`, Object.values(guildMaker).map(g => topToken(g)), { singleClick: true, beforeAdvancing: (tok) => {
                    moveBitTo(tok, params.place.guilds)
                   }});
                }else if(Object.keys(holderMaker).includes(type)){
                    moveBitTo(topToken(type), params.place[holderMaker[type]]);
                }else if(type.startsWith('glory')){
                    moveBitTo(topToken(type), params.place.glory);
                }else if(type == 'voidborn'){
                    // Add a fleet there if possible
                    await moveFleet('voidborn', 'voidborn', params.place.id, 'place', 'voidborn');
                }else if(type == 'harbinger'){
                    if(topToken(type)){
                        moveBitTo(topToken(type), params.place.harbingers)
                    }else throw 'impossible';
                }
            }
            updateSkirmish(p);
        }
    },
    {
        verb: 'play_agenda',
        description: `play [[agenda]]`,
        action: async (p, params) => {
            moveBitTo(params.obj, 'state.focus', 'agenda');
            params.type = lo(params.obj).type
        },
        log: (params) => `played [[agenda]] ${lo(params.obj).name}`
    },
    {
        verb: 'consume_tech',
        description: (params) => `[[consume${params.type ? `_${params.type}` : ''}]]`,
        impossible: (p, params) => params.type == 'improved' && get(state).galactic_board.improved_techs.flatMap(t => t).length == 0,
        defaults: {
            type: 'basic',
            obj: async (p, params) => {
                if(params.type == 'improved'){
                    return get(state).galactic_board.improved_techs.flatMap(t => t)[0];
                }else{
                    let inf = basicTechs(get(state)).filter(t => t.influence);
                    let noInf = basicTechs(get(state)).filter(t => !t.influence);
                    if(inf.length > 0) return await choose(`Choose a [[basic_tech]] to be consumed`, inf, {foregroundAll: true});
                    return await choose(`Choose a [[basic_tech]] to be consumed`, noInf, {foregroundAll: true});
                }
            }
        },
        action: (p, params) => {
            moveBitTo(params.obj, get(state).crisis_board.consumed_techs);
        },
        log: (params) => `allowed technology${params.obj ? ' '+params.obj.name: ''} to be consumed by the Voidborn!`
    },
    {
        verb: 'return_token',
        description: (params) => {
            let desc = `return_`;
            if(params.type) desc += params.type;
            //if(params.place && typeof params.place == 'string') desc += `_${params.place}`;
            if(params.restriction) desc += `_${params.restriction}`;
            return `${params.num > 1 ? `${params.num} `: ''}[[${desc}]]`;
        },
        impossible: (p, params) => {
            let poss = all('sectors');
            if(params.place) poss = possArray(resolvePlace(params.place, p));
            if(params.from == 'house_mat') return p[params.type].length < (params.num || 1);
            if(params.type == 'bounty' || params.type == 'reclaim') poss = poss.flatMap(s => s[params.type]);
            if(params.type == 'trade'){
                poss = [...p.loose_trade, ...p.agendas.map(a => a.trade).filter(t => t)];
            }
            if(params.type == 'harbinger'){
                poss = poss.flatMap(s => s.harbingers)
                poss = [...poss, ...getCrisisHarbingers()];
                updateSkirmish(p);
            }
            if(params.type == 'voidborn'){
                poss = all('fleet_voidborn', (f) => isIn(f, 'sectors'))
            }
            if(poss.length < (params.num || 1)) return true;
            return false;
        },
        defaults: {
            num: 1,
            obj: async (p, params) => {
                let poss = all('sectors');
                if(params.place) poss = possArray(resolvePlace(params.place, p));
                if(params.from == 'house_mat') return p[params.type].slice(0, params.num || 1); // No choice because they are all functionally the same...
                if(params.type == 'bounty' || params.type == 'reclaim') poss = poss.flatMap(s => s[params.type]);
                if(params.type == 'trade'){
                    poss = [...p.loose_trade, ...p.agendas.map(a => a.trade).filter(t => t)];
                }
                if(params.type == 'harbinger'){
                    let possSectors = poss.flatMap(s => s.harbingers);
                    let possCrisis = [ ...getCrisisHarbingers()];
                    if(!params.restriction){
                        poss = [...possSectors, ...possCrisis];
                    }else if(params.restriction == 'crisis'){
                        poss = possCrisis;
                    }else if(params.restriction == 'sectors'){
                        poss = possSectors;
                    }
                    //updateSkirmish(p);
                }
                if(params.type == 'voidborn' && params.num == 1){
                    poss = poss.filter(s => s.fleets.length > 0 && s.fleets[0].cubes.length > 0 && s.fleets[0].owner == 'voidborn'); // Just in case
                    let sec = await choose(`Select a sector to return a [[voidborn]] from it`, poss);
                    return sec.fleets[0].cubes[0];
                    poss = poss.flatMap(s => s.fleets).filter(f => f.owner == 'voidborn').flatMap(f => f.cubes)
                    
                    //all('fleet_voidborn', (f) => isIn(f, 'sectors'))
                    //updateSkirmish(p);
                }
                return await choose(`Select ${params.num == 1 ? 'a' : params.num} ${params.type} to return`, poss, {number: params.num});
            },
            type: async (p, params) => {
                if(possArray(params.obj).every(o => o.id) && possArray(params.obj).length > 0){
                    let types = Array.from(new Set(possArray(params.obj).map(o => type(o.id))));
                    if(types.length == 1) types = types[0];
                    return types;
                }
            }
        },
        action: async (p, params) => {
            // Add caching of place?
            let types = [];
            for(let o of possArray(params.obj)){
                if(!types.includes(o.type || type(o.id) || o.value)) types.push(o.type || type(o.id) || o.value);
                if(o.id && o.id.startsWith('fleet_')){
                    if(o.id.includes('voidborn')){
                        await moveFleet(p, o.id, 'voidborn', 'return');
                    }else{
                        await moveFleet(p, o.id, 'active', 'return');
                    }
                }else{
                    await returnToken(o, p);
                }
                
            }      
            params.type = possScalar(types);
            updateSkirmish(p);
        },
        log: (params) => `returned ${params.num == 1 ? 'a' : params.num} ${possArray(params.obj).filter(o => o).map(o => `[[${params.type}]]`)}`
    }
];

export function playerCorruption(p, restriction = false){
    let mat = all('corruption', (b) => isIn(b, `state.players.${playerIndex(p)}`));
   // console.log(all('corruption').map(c => bl(c.id).address))
    let sectors = all('corruption', (b) => playerSectors(p).some(k => k.corrupted == b));
    if(restriction == 'house_mat') return mat;
    if(restriction == 'sectors' || restriction == 'same_sector') return sectors;
    if(hasTech(p, 'Decontamination Chambers')){
        let tech = all('corruption', (b) => isIn(b, `tech_14`));
        return [...mat, ...sectors, ...tech];
    }
    return [...mat, ...sectors]; 
}

export function playerCorruptionSlots(p, rest = null){
    let places = [];
    let banAreas = ['house_mat', 'sectors'];
    if(rest && rest != 'no_DC'){
        banAreas = banAreas.filter(a => a != rest);
    }else{
        banAreas = [];
    }
    if(rest == 'same_sector'){
        if(get(state).cache.lastSectors){
            let sectors = get(state).cache.lastSectors.map(s => at(s)).filter(s => !s.corrupted && !sectorSpecial(s, 'no_corruption') && controlledBy(s, p));
            return sectors;
        }
    }
    if(rest == 'tracks') banAreas = 'sectors';
    if(rest && rest.startsWith('agendas')) banAreas = 'sectors';
    if(!rest && hasTech(p, 'Decontamination Chambers')){ // NB rest == 'no_DC' is the standard for just excluding DC
        let tech = p.techs.find(t => t.name == 'Decontamination Chambers');
        if(tech.lo) tech = lo(tech);
        for(let t of tech.inside){
            if(!t.corrupted) places.push(t);
        }
    }
    if(!banAreas.includes('house_mat')){
        let trackPlaces = [];
        for(let t of Object.keys(p.tracks)){
            if(!p.tracks[t].corrupted) trackPlaces.push(p.tracks[t]);
        }
        if(rest == 'tracks') return trackPlaces.filter(p => p);
        let agendaPlaces = [];
        for(let a of p.agendas){
            if(a.incorruptable) continue;
            if(!a.corrupted){
                if(rest == 'agendas_occupied' && !a.card) continue; // only occupied slots
                agendaPlaces.push(a);
            }
        }
        if(rest && rest.startsWith('agendas')) return agendaPlaces.filter(p => p);
        places = [...places, ...trackPlaces, ...agendaPlaces].filter(p => p);
    }
    if(!banAreas.includes('sectors')){
        for(let s of playerSectors(p)){
            if(!s.corrupted && !sectorSpecial(s, 'no_corruption')) places.push(s);
        }
    }
    /*if(!banAreas.includes('agenda_board')){
        for(let a of Object.keys(get(state).agenda_board)){
            if(!get(state).agenda_board[a].corrupted) places.push(get(state).agenda_board[a]);
        }
    }*/
    
    return places.filter(p => p);
}

function availableInstallations(p, s){
    let list = ['shipyard', 'defense'];
    if(hasTech(p, 'Starbases')){
        let limit = 1;
        if(hasTech(p, 'Starbases', 'improved')) limit = 2;
        if(s.installations.filter(i => i.value == 'starbase').length < limit) list.push('starbase');
    }
    return list;
}

export function playerTokenCount(p, t, pure = false){
    if(t == 'bounty' || t == 'reclaim') return p[t].length;
    let key = holderMaker[t];
    let list = [];
    if(key == 'guilds'){
        list = playerSectors(p).filter(s => !pure || !s.corrupted).flatMap(s => guilds(s));
    }else{
        list = playerSectors(p).filter(s => !pure || !s.corrupted).flatMap(s => s[holderMaker[t]]);
    }
    
    // Could add here for general guild etc.
    console.log('player token count', list, t)
    return list.filter(b => b.value == t).length;
}

export function playerTradeSlots(p){
    let count = p.agendas.filter(a => a.card && !a.trade).length;
    if(hasTech(p, 'Escape Pods')){
        let tech = p.techs.find(t => t.name == 'Escape Pods');
        if(!tech.inside[0].trade) count++;
    }
    return count;
}

export function playerSlottedTrade(p){
    let list = p.agendas.filter(a => a.trade).map(a => a.trade);
    let t = hasTech(p, 'Escape Pods');
    if(t && t.inside[0].trade) list = [...list, t.inside[0].trade];
    return list;
}

export function corruptionPlace(p, place){
    if(isIn(place, 'tracks')){
        return `[[${upperInitial(place.id.split('_')[1])}]] Track`;
    }else if(isIn(place, 'agendas')){
        return `[[agenda]] slot`
    }else if(isIn(place), 'tech_14'){
        // Must be DC
        let t = hasTech(p, 'Decontamination Chambers')
        if(t){
            return `[[${t.type}_tech]] Decontamination Chambers`
        }
        
    }else if(isIn(place), 'sectors'){
        return'sector'
    }
}