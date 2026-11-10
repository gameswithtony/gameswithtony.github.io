// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { res, resetStores, state, ui } from './stores.js';
import { get } from './runtime.js';
import * as jsonpatch from './runtime.js';
import { actions, holderMaker } from './actions.js';
import { ask, choose, clearSelection, convert, doActionPause, pause, undoableOptions, upperInitial } from './ui.js';
import { getCostInfo, pay } from './costs.js';
import { all, lo, locationFilter, possArray, resolvePlace, at, possScalar, moveBitTo, isIn, ol } from './utils.js';
import { agendaActions, collateThings, countThings, filterThings, testCondition } from './agendas.js';
import { imageURL } from './images.js';
import { focusBoosts, hasTech } from './techs.js';
import { getSectorList, guildSpaces, guilds, isAdjacent, neighbours, playerSectors, sectorSpecial, voidbornFleetSpaces } from './sectors.js';
import { allCrisesOnBoard, canDo, checkTriggeredEffects } from './crisis.js';
import { resMaker } from './resources.js';
import { deleteSave, makeSaveKey } from './turns.js';
import { tick } from './runtime.js';
import { house } from './houses.js';
import { isPreferred } from './focus.js';
import { newInformation, pushUndo } from './undo.js';
import { afterAnimation } from './previewable.js';

export function logEvent(text){
    log(text, -1);
}

export function replaceIDs(d){
    if(Array.isArray(d)){
        for(let i = 0; i < d.length; i++){
            if(d[i].id){
                d[i] = {
                    id: d[i].id
                }
            }else{
                replaceIDs(d[i]);
            }
        }
        return;
    }else if(typeof d == 'object'){
        for(let k of Object.keys(d)){
            if(d[k].id){
                d[k] = {
                    id: d[k].id
                }
            }else{
                replaceIDs(d[k]);
            }
        }
    }
}

export function log(data, p = false){
    if(!p){
        p = get(state).activePlayer;
    }else{
        p = get(state).players.find(pl => pl.house == p.house);
    }
    let entry;

    if(typeof data == 'string'){
        entry = {
            type: 'text',
            text: `${data}. `
        }
    }else{
        //let dataCopy = jsonpatch.deepClone(data);
        // replaceIDs(data); //Only if need be
        entry = {
            ...data
        };
    }


    let focusInfo = {};
    if(get(state).focus && get(state).focus.card){
        focusInfo.currentFocus = get(state).focus.card.id;
        if(get(state).focus.currentAction) focusInfo.currentAction = get(state).focus.currentAction;
    }

    entry = {
        ...entry,
        turn: {
            cycle: get(state).turn.cycle || 0,
            round: get(state).turn.round || 0,
            rawRound: get(state).turnInfo.rawRound || 0,
            activePlayer: get(state).activePlayer
        },
        turnInfo: jsonpatch.deepClone(get(state).turnInfo),
        ...focusInfo
    }

    if(p) entry.p = p.house;

    state.update(s => {
        let i = s.log.length - 1;
        if(i >= 0){
            let l = s.log[i];
            if(l.verb){
                // Reduce to pure text
                let newEntry = jsonpatch.deepClone(l);
                let a = actions.find(a => a.verb == l.verb);
                if(a && a.log){
                    newEntry.text = `${upperInitial(a.log({...l.params}))}.&nbsp;`;
                }
                for(let k of Object.keys(l.params)){
                    if(newEntry.params[k] && newEntry.params[k].id){
                        let id = newEntry.params[k].id;
                        let lo = newEntry.params[k].lo;
                        newEntry.params[k] = {id};
                        if(lo) newEntry.params[k].lo = 1;
                    }/*else{
                        newEntry.params[k] = l.params[k];
                    }*/
                }
                
                s.log[i] = newEntry;
            }
        }
        s.log = [...s.log, entry];
        return s;
    })

    if(get(ui).logElement){
        let e = get(ui).logElement;
        //e.scrollTo({top: e.innerHeight});
        e.scrollTop = e.scrollHeight;
    }
}

let totalSyncs = 0;

export async function doAction(p, verb, params = {}){

    params  = jsonpatch.deepClone(params);
    
    let newEntry = {
        type: 'action',
        verb,
        params
    };

    let savedState = jsonpatch.deepClone(get(state));
    let savedReactions = jsonpatch.deepClone(get(ui).reactions);
    let compound = false;
    let toDo = false;
    let logged = false;
    let internalReactions = false;
    let doReactions = true;

    if(verb.custom){
        // A custom action
        console.log('doing custom action', p, verb)

        if(verb.log){
            if(!Array.isArray(get(state).workingLog)){
                compound = true;
                openWorkingLog();
            }
            newEntry = {
                type: 'text',
                text: verb.log
            };
            log(newEntry, p)
            logged = true;
        }
        toDo = async () => {await verb.custom(p, params)};
    }else{
        console.log('doing action '+verb, p, params)

        let action = actions.find(a => a.verb == verb);
        if(!action) return false;
        if(action.log){
            if(!Array.isArray(get(state).workingLog)){
                compound = true;
                openWorkingLog();
            }
            log(newEntry, p)
            logged = true;
        }

        if(params.restriction) params = handleRestrictions(p, params); // These should be generic
        if(params.filter) params = handleFilter(p, params);

        for(let k of Object.keys(params)){
            if(params[k] == 'source') params[k] = at(params.source); // Replace pointer to source of action e.g. sector
        }

        //if(params.place) params.place = locationFilter(params.place); // Catch common locations
        

        if(action.hasOwnProperty('impossible') && action.impossible(p, params)){
            console.log('Impossible action!');
            toDo = async () => { await pause(`Action ${getReadableDescription({verb, ...params})} not possible – abandoning`)};
            doReactions = false;
        }else{
            if(params.per){
                // get count
                let count = countThings(p, params);
                if(!params.num) params.num = 1;
                if(Array.isArray(params.num)){
                    // Basically for track tiers
                    if(count >= params.num.length) count = params.num.length - 1; //Round down
                    params.num = params.num[count];
                }else{
                    if(!params.num) params.num = 1;
                    //params.num = params.num * count;
                    params.num *= count;
                }
            }
            
            if(action.defaults){
                for(let k of Object.keys(action.defaults)){
                    if(!params.hasOwnProperty(k)){
                        if(typeof action.defaults[k] == 'function'){
                            try{
                                params[k] = await action.defaults[k](p, params);
                            }catch(e){
                                if(e == 'impossible'){
                                    await pause(`Action not possible – abandoning`);
                                    //throw 'uncompleted';
                                    //if(logged) closeWorkingLog();
                                    return;
                                }else{
                                    throw e;
                                }
                            }
                            
                        }else{
                            params[k] = action.defaults[k];
                        }
                    }
                }
                newEntry.params = params;
            }
    
            
    
            toDo = async () => { return await action.action(p, params) };
        }
        
    }

    

    let result = false; 

   
    try{

        // Add reactions around

        setCaches(p, params); // For pre-triggers – necessary? !! TODO disabled – see if that has a negative effect

        params.verb = verb;

        if(doReactions) openReactions();

        if(doReactions) checkTriggeredEffects(p, params, 'before');

        if(doReactions) await checkReactions(); // Handle these first!

        result = await toDo();

        // Add reactions around

        if(result == 'cancelled'){
            // Possible reaction closing?
            if(compound){
                state.update(s => {
                    console.log('resetting')
                    return savedState;
                })
                if(logged) closeWorkingLog();
            }else{
                state.update(s => {
                    console.log('resetting')
                    return savedState;
                })
                //if(action.log && action.log(params)) removeLastLog();
            }
            return;
        }else if(result == 'failed'){
            // end, which means resetting log
            //closeWorkingLog();
            state.update(s => {
                s.log = savedState.log;
                return s;
            })
        }else{
            setCaches(p, params);
            console.log('checking whether to use internal reactions', get(ui).reactions, doReactions)
            if(get(ui).reactions.length == 0){
                internalReactions = true; // No surrounding frame for action, so handle reactions immediately
                openReactions();
            }
            if(doReactions) checkTriggeredEffects(p, params, 'after');
            if(internalReactions){
                await checkReactions();
            }
        }
        

    }catch(e){ 
        if(e == 'cancelled'){// Action was cancelled
            if(compound){
                console.log('cancelled')
                state.update(s => {
                    console.log('resetting')
                    return savedState;
                })
                if(logged) closeWorkingLog();
                return;
            }else{
                throw 'cancelled';
            }
            
        }else if(e == 'uncompleted'){
            throw 'uncompleted';
            //await pause(`Action not completed – abandoning`);
            //result = 'failed';
        }else if(e == 'impossible'){
            await pause(`Action not possible – abandoning`);
            result = 'failed';
        }else if(e == 'completed'){
            //throw 'completed'; 
            // Should just carry on?
        }else{
            await pause(`Error encountered during action: ${e.message}`);
            console.log('Error type', e);
        }
    }
    if(compound && logged){
        closeWorkingLog();
    }else{
        console.log('updating state');
    }

    console.log('state at end of action', get(state));
    console.log('ui at end of action', get(ui))
    totalSyncs++;
    console.log('Total syncs at this point: '+totalSyncs)
    clearSelection();
    await doActionPause();

    return result;
}

export function cacheSector(sec, noDuplicates = true){
    state.update(s => {
        if(!s.cache.lastSectors) s.cache.lastSectors = [];
        if(sec.id && s.cache.lastSectors[0] != sec.id){
            if(noDuplicates) s.cache.lastSectors = s.cache.lastSectors.filter(s => s != sec.id); // To avoid duplication
            s.cache.lastSectors.unshift(sec.id);
        }
        return s;
    })
}

function setCaches(p, params){
    if(params.place && possArray(params.place).some(p => p.id)){
        for(let p of possArray(params.place)){
            cacheSector(p);
        }
    }
    if(params.type){
        state.update(s => {
            s.cache.lastType = params.type;
            return s;
        }) 
    }
    console.log(`cache updated`, params, get(state).cache);
}

export function handleFilter(p, params){
    // !! TODO not good overlap with scoring/per, rename

    let place = params.place;
    if(place && !Array.isArray(place)){
        // Is this necessary?
        place = resolvePlace(place, p);
    }

    if(params.filter == 'highest_pop'){
        // Weed out any places with lower than this
        
        let max = 0;
        let options = [];
        for(let s of place){
            if(s.population == max){
                options.push(s);
            }else if(s.population > max){
                options = [s];
                max = s.population;
            }
        }
        params.place = possScalar(options);;
    }
    if(params.filter == 'lowest_pop'){
        // Weed out any places with higher than this
        let min = Infinity;
        let options = [];
        for(let s of place){
            if(s.population == min){
                options.push(s);
            }else if(s.population < min){
                options = [s];
                min = s.population;
            }
        }
        params.place = possScalar(options);
    }
    if(params.filter.type && !params.per){ // Exclusion to avoid duplication on gains
        let things = filterThings(p, possArray(place), params.filter);//collateThings(p, params.per || 'sector', params.filter, params.restriction == 'pure');
        params.place = possScalar(things);
    }
    return params;
}

export function resolvePer(p, params){
    let num = 1;
    if(params.per){
        // get count
        let count = countThings(p, params);
        num = params.num || 1;
        if(Array.isArray(num)){
            // Basically for track tiers
            if(count >= num.length) count = num.length - 1; //Round down
            num = num[count];
        }else{
            num *= count;
        }
    }
    return num;
}

export function handleRestrictions(p, params, individual_rest = false) {
    console.log('handling restrictions', params.restriction, get(state).cache)
    let restriction = individual_rest || params.restriction;
    if(Array.isArray(restriction)){
        for(let r of restriction){
            params = handleRestrictions(p, params, r);
        }
        return params; // Handle each individually then go
    }
    if(restriction == 'same_sector'){
        if(get(state).cache.lastSectors){
            let sectors = get(state).cache.lastSectors;
            params.place = at(get(state).cache.lastSectors[0]);//sectors.map(s =>at(s));//at(get(state).cache.lastSectors[0]);
        }else if(params.abandonIfNotPossible){
            throw 'impossible'; // To abandon it
        }
        // no else because it shouldn't trigger before the first one
    }
    if(restriction == 'same_or_adjacent_sector'){
        if(get(state).cache.lastSectors){
            let sec = at(get(state).cache.lastSectors[0]);
            params.place = [sec, ...neighbours(sec)];
        }else if(params.abandonIfNotPossible){
            throw 'impossible'; // To abandon it
        }
    }
    if(restriction == 'same_resource'){
        if(get(state).cache.lastResourceType){
            params.obj = get(state).cache.lastResourceType;
        }
        // no else because it shouldn't trigger before the first one
    }
    if(restriction == 'same_type'){
        if(get(state).cache.lastType) params.type = get(state).cache.lastType;
    }
    if(restriction == 'matching_resource'){
        let t = get(state).cache.lastType;
        if(t && resMaker[t]) params.type = resMaker[t];
    }
    if(restriction == 'same_track'){
        if(get(state).cache.lastTrack){
            params.obj = get(state).cache.lastTrack;
        }
    }
    if(restriction == 'corrupted_track'){
        if(get(state).cache.corruptedTrack){
            params.obj = get(state).cache.corruptedTrack;
        }
    }
    let places;
    if(params.place){
        places = possArray(resolvePlace(params.place, p));
    }else if(params.possibleSectors){
        if(typeof params.possibleSectors == 'function'){
            places = params.possibleSectors(p, params);
        }else{
            places = params.possibleSectors;
        }
    }else{
        places = playerSectors(p);
    }
    if(restriction == 'adjacent'){
        // Filter to adjacent
        //let pl = params.place || playerSectors(p);
        
        let place = places.filter(s => playerSectors(p).some(t => isAdjacent(t, s)));
        if(params.postCombat){
            // It should be adjacent to the combat sector if possible
            let combatAdjacent = places.filter(s => isAdjacent(at(params.postCombat), s));
            if(combatAdjacent.length > 0){
                place = combatAdjacent;
            }
            if(place.length == 0){
                place = places; // Fall back to any space
            }
        }
        if(params.vf_fallback){
            if(params.type == 'voidborn'){
                if(place.every(s => voidbornFleetSpaces(s) == 0)) place = places.filter(s => voidbornFleetSpaces(s) > 0);
            }else if(params.type == 'guild' || holderMaker[params.type] == 'guilds'){
                place = place.filter(s => guildSpaces(p, s) > guilds(s).length);
                if(place.length == 0) place = places.filter(s => guildSpaces(p, s) > guilds(s).length);
            }else if(params.type == 'installation' || holderMaker[params.type] == 'installations'){
                place = place.filter(s => s.installation_spaces > s.installations.length);
                if(place.length == 0) place = places.filter(s => s.installation_spaces > s.installations.length);
            } 
        }
            
        if(place.length == 0) throw 'uncompleted'; // To stop rest of text being executed?
        params.place = place;
    }
    if(restriction == 'rift_adjacent'){
        let rifts = all('sectors', (s) => s.type == 'rift');
        let place = all('sectors', (s) => rifts.some(r => isAdjacent(s, r)));
        params.place = place;
    }
    if(restriction == 'action_adjacent'){
        if(get(state).cache.lastSectors){
            params.place = places.filter(s => get(state).cache.lastSectors.some(t => isAdjacent(s, at(t))));
        }else{
            params.place = places.filter(s => playerSectors(p).some(t => isAdjacent(t, s)));
        }
    }
    if(restriction == 'pure_sector'){
        params.place = places.filter(s => !s.corrupted);
    }
    if(restriction == 'corruptible_sector'){
        params.place = places.filter(s => !sectorSpecial(s, 'no_corruption'));
    }
    if(restriction == 'different_sector'){
        let s = get(state).cache;
        console.log('cache:', s)
        if(get(state).cache && get(state).cache.lastSectors && get(state).cache.lastSectors.length > 0){
            params.possibleSectors = places.filter(s => !get(state).cache.lastSectors.some(sec => sec == s.id))
        }
    }else if(restriction == 'noncost_sector'){
        if(get(state).cache && get(state).cache.costSectors && get(state).cache.costSectors.length > 0){
            params.place = places.filter(s => !get(state).cache.costSectors.some(sec => sec == s.id))
        }
    }
    return params;
}

export async function doAnytimeEffect(a){
    if(await ask(`${a.text}?`, {foreground: a.source ? at(a.source) : false })){
        a.action();
    }
}

export function getAnytimeEffects(p, state, type){
    let list = [];
    //if(!state.turnInfo || !state.turnInfo.breadcrumbs || !state.turnInfo.breadcrumbs.includes('player turn')) return list; // Only on your turn
    if(house(p).anytime){
        for(let a of possArray(house(p).anytime)){
            let option = {
                text: a.text || getReadableDescription(a),
                confirm: a.confirm || a.text || getReadableDescription(a),
                button: a.button || a.text || getReadableDescription(a),
                action: () => executeActions(p, a),
                disabled: () => !canDo(p, a) || (!state.turnInfo || !state.turnInfo.breadcrumbs || !state.turnInfo.breadcrumbs.includes('player turn'))
            }
            list = [...list, option];
        }
    }
    for(let c of allCrisesOnBoard()){
        c = lo(c);
        
        if(c.anytime){
            let option = {
                text: `${getReadableDescription(c.anytime)} to resolve the crisis ${c.name}`,
                button: `${getReadableDescription(c.anytime)}: ${convert('[[discard_crisis]]')}`,
                source: c.id,
                action: async () => {
                    try{
                        await executeActions(p, c.anytime, {compulsory: true, source: c.id});
                        await doAction(p, 'discard_crisis', {obj: c});
                    }catch(e){
                        if(e == 'uncompleted') return;
                        if(e == 'impossible') return;
                        if(e != 'cancelled') throw e;
                        
                    }
                },
                disabled: () => !canDo(p, c.anytime)
            }
            list = [...list, option];
        }
    }
    return list;
}

export function openWorkingLog(){
    //savedState = JSON.stringify(get(state));
    state.update(s => {
        s.workingLog = [];
        return s;
    })
    //updateState();
}

export function closeWorkingLog(){
    let wl = get(state).workingLog;
    if(!Array.isArray(wl)) return;
    state.update(s => {
        let first = wl[0];
        if(first){
            if(wl.length > 1){
                first.elements = wl.slice(1);
            }
            //first.newInfo = newInfo;
            state.update(r => {
                s.log = appendLog(s.log, first)
                return s;
            })
        }
        s.workingLog = false;
        //saveIfCan();
        return s;
    })
    //updateState();
}

function appendLog(log, entry){
    // Check for duplicates that could be handled

    let last = log[log.length - 1];
    //if(last && last.elements && last.elements.length > 0) last = last.elements[last.elements.length - 1];
    if(last){
        if(last.verb == 'gain_resource' && entry.type == 'gain_resource' && entry.p == last.p && last.params.type == entry.params.type && !entry.elements){
            last.params.num += entry.params.num;
            if(last.params.num == 0){
                // remove entry!
                return log.slice(0, log.length - 1);
            }
            return log;
        }
    }
    console.log('appending log', log, entry)
    return [...log, entry];
}

export function ongoingPlayer(p){
    let list = [];
    let toCheck = [...playerSectors(p), ...p.techs, house(p)];
    if(get(state).galactic_board.current_event) toCheck.push(lo(get(state).galactic_board.current_event))
    for(let s of toCheck){
        if(!s) continue;
        if(s.ongoing) list = [...list, ...possArray(s.ongoing)];
    }
    return list;
}

export function ongoingGeneral(){
    if(get(state).galactic_board.current_event && lo(get(state).galactic_board.current_event) && lo(get(state).galactic_board.current_event).ongoing){
        return possArray(lo(get(state).galactic_board.current_event).ongoing);
    }
    return [];
}

function normalisedActions(actions){
    let normalised = [];
    for(let a of actions){
        if(typeof a == 'string'){
            normalised.push({
                verb: a
            })
        }else if(Array.isArray(a)){
            normalised.push(normalisedActions(a));
        }else{
            normalised.push(a);
        }
    }
    return normalised;
}

export function renderCost(c){
    let elements = [];
    let negativeCosts = ['gain_corruption', 'deactivate', 'recall', 'unbuild', 'unguild']
    for(let k of Object.keys(c)){
        if(negativeCosts.includes(k)){
            elements.push(`${c[k] != 1 ? c[k] : ''} [[${k}]]`);
        }else{
            elements.push(`-${c[k]} [[${k}]]`);
        }
        
    }
    return `<span style="font-weight: bold; color: orange;">${elements.join(', ')}</span>`;
}

export function playersInTurnOrder(){
    let order = get(state).turn_order;
    let list = [];
    for(let i of order){
        list.push(get(state).players[i]);
    }
    return list;
}

let shorthands = {
    'add_voidborn': {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent'
    }
}

export function expandAction(text){
    if(shorthands.hasOwnProperty(text)) return shorthands[text];
    return {verb: text}
}

export function getReadableDescription(action, giveTotals = true){
    if(!action) return '';
    if(Array.isArray(action)){
        return action.map(a => getReadableDescription(a)).join(' and/or ');
    }else if(action.either_or){
        return action.either_or.map(a => getReadableDescription(a)).join(' OR ');
    }else if(action.simple_list){
        return action.simple_list.map(a => getReadableDescription(a)).join(' and ');
    }else if(action.both_and){
        return action.both_and.map(a => getReadableDescription(a)).join(' and ');
    }
    if(action.cost) return `${renderCost(action.cost)}: ${getReadableDescription(action.action)}`;
    if(action.action) return `${getReadableDescription(action.action)}`;
    if(typeof action == 'string') action = expandAction(action);
    if(action.description) return action.description;
    let a = actions.find(a => a.verb == action.verb);
    if(!a){
        console.log(`Cannot find action!`, action);
        return `Unknown action`
    }
    let desc = '';
    let ret = ''
    if(a.description){
        if(typeof a.description == 'string') return a.description;
        desc = a.description(action);
    }else{
        desc = a.verb;
        if(imageURL(desc)){
            desc = `[[${desc}]] ${upperInitial(desc.replaceAll('_', ' '))}`;
        }else{
            desc = upperInitial(a.verb.replaceAll('_', ' '));
        }
    }
    if(action.per){
        if(giveTotals){
            desc = `${desc} per ${renderPer(action)} (${resolvePer(activePlayer(), action)} total)`;
        }else{
            desc = `${desc} per ${renderPer(action)}`;
        }
        
    }
    return desc;
    
}

export function renderPer(action){
    return possArray(action.per).map(p => {
        let base = `[[${p}]]`;
        if(p == 'sector') base = 'sector';
        if(p == 'fleets') base = 'fleets';
        if(action.filter){
            if(typeof action.filter == 'string') return `${base} with [[${action.filter}]]`;
            let rest = '';
            if(action.restriction) rest = action.restriction+' ';
            if(base == '[[track]]'){
                if(action.restriction == 'pure') base = 'pure track';
                if(action.filter && action.filter.min) base = base+' with level at least '+action.filter.min;
                return base;
            }
            if(p.endsWith('track_tier')) return `[[${p.split('_')[0]}]] track level`;
            return `${base} with ${renderNum(action.filter)} ${rest}[[${action.filter.type}]]`;
        }
        return base;
    }).join('/')
}

export function renderNum(num){
    if(num.num) return num.num;
    if(num.min) return `${num.min}+`;
    if(num.max) return `<=${num.max}`;
}

export async function executeActions(p, actions, options = {}){
    // Options to pass on to choices
    console.log('executing actions', actions, options)

    if(!options.inside){
        openReactions();
    }

    let backupCache;

    if(options.savedCache){
        backupCache = jsonpatch.deepClone(get(state).cache);
        state.update(s => {
            s.cache = options.savedCache;
            return s;
        })
    }
    if(!get(state).turnCache){
        state.update(s => {
            s.turnCache = {};
            return s;
        })
    }

    if(actions.hasOwnProperty('cost') || ['players_must', 'players_may', 'once'].includes(actions.type)){
        // Then it's a cost/action thing
        // !! TODO this feels like a bodge...
        await doEffect(actions, {...options, inside: true});
        return;
    }

    //if(!options.source) throw 'no source!'

    if(Array.isArray(actions) && actions.length == 1 && !options.alwaysAsk) actions = actions[0];
    
    if(!Array.isArray(actions)){
        if(actions.hasOwnProperty('either_or')){
            let choices = [];
            let chosen;
            if(actions.either_or.every(a => !canDo(p, a))){
                await pause('No options possible – abandoning');
                return;
            }
            do{
                // Undoable here

                for(let a of normalisedActions(actions.either_or)){
                    choices.push({
                        type: 'text',
                        choice: () => getReadableDescription(a),
                        disabled: !canDo(p, a),
                        value: a});
                }
                if(!options.compulsory){
                    choices.push('ok_Finish');
                }
                chosen = await choose(`Choose effect to fulfil (you may choose only one)`, [...choices, ...getReactionChoices().map(c => {return {...c, extra: true}})], options);
                if(chosen == 'none'){
                    // throw cancelled?
                    return;
                }
                await executeActions(p, chosen, {...options, pause: false, inside: true});
            }while(chosen.extra);    
        }else if(actions.hasOwnProperty('both_and')){
            let choices = [];
            if(actions.both_and.every(a => !canDo(p, a))){
                await pause('Actions not possible – abandoning');
                return;
            }
            for(let a of normalisedActions(actions.both_and)){
                choices.push({
                    type: 'text',
                    choice: () => getReadableDescription(a),
                    value: a});
            }
            while(choices.some(c => !c.disabled)){

                let chosen = await choose(`Choose effect to fulfil (you must complete all)`, [...choices, ...getReactionChoices()], options);
                await executeActions(p, chosen, {...options, compulsory: true, pause: false, inside: true});
                let toDisable = choices.find(c => c.value == chosen);
                if(toDisable) toDisable.disabled = true;
            }
        }else if(actions.hasOwnProperty('simple_list')){
            // Just work through them in order
            for(let a of normalisedActions(actions.simple_list)){
                await executeActions(p, a, {...options, compulsory: true, pause: false, inside: true});
            }
        }else if(actions.hasOwnProperty('custom')){
            // A custom function!
            await doAction(p, {...actions, source: options.source}); // It should handle this
            console.log('state at end of action', get(state))
            console.log('ui at end of action', get(ui))
        }else{
            //Single action
            if(options.pause || actions.pause){
                // Pause anyway
                await pause(`Completing action`, options)
            }
            if(typeof actions == 'string') actions = expandAction(actions);
            if(actions.place == 'rift'){
                // Do once for every rift
                for(let s of all('sector', (s) => s.type == 'rift')){
                    await doAction(p, actions.verb, {...actions, source: options.source, place: s.id})
                }
            }else{
                await doAction(p, actions.verb, {...actions, source: options.source});

            }
        }
    }else{
        // Various and/or choices
        // Todo allow for a separate line of buttons for 'finish now' type things
        let choices = [];
        for(let a of normalisedActions(actions)){
            choices.push({
                type: 'text',
                choice: () => getReadableDescription(a),
                value: a
            })
        }  

        await undoableOptions(
            async () => {
                return {
                    options: choices.map(o => {
                        return {
                            ...o,
                            //disabled: o.disabled || o.done || !canDo(p, o.value),
                            action: async () => {
                                p = get(state).players.find(pl => pl.colour == p.colour); // To avoid resetting anything p-related
                                await executeActions(p, o.value, {...options, inside: true})
                            }
                        }
                    }),
                    text: `Choose effect to fulfil (you can do all effects)`,
                    extras: {}//{cancellable: true}
                }
            },
            async (toSelect) => {
                let ret =  [
                    ...toSelect
                ]

                for(let r of ret){
                    console.log(r, canDo(p, r.value))
                    if(!r.done && canDo(p, r.value)){
                        r.disabled = false;
                    }else{
                        r.disabled = true;
                    }
                    //if(r.disabled || !canDo(p, r.value)) r.disabled = true;
                }

                ret = [...ret, ...getReactionChoicesUO(p)];
                return ret;
            }
        )

        /*do{
            let chosen = await choose(`Choose effect to fulfil (you can do all effects)`, [...choices, ...getReactionChoices().map(c => {return {...c, extra: true}}), {
                type: 'text',
                choice: 'Finish',
                value: 'finish',
                ok: true
            }], options);
            if(chosen == 'finish') break;
            await executeActions(p, chosen, {...options, inside: true});
            let toDisable = choices.find(c => c.value == chosen)
            if(toDisable) toDisable.disabled = true; // Hope this works!
        }while(choices.some(c => !c.disabled));*/
    }
    if(!options.inside){
        await checkReactions();
        wipeDelayedReactions();
    }
    if(backupCache){
        state.update(s => {
            s.cache = backupCache;
            return s;
        })
    }
}

export function getReactionChoicesUO(p){
    return getReactionChoices().map(c => {
        return {
            ...c, 
            extra: true,
            reaction: true,
            action: async () => {
                log({
                    type: 'stats',
                    reaction: c.source || false,
                    reactionText: c.choice
                }, p)
                await doEffect(c.value, {source: c.source, inside: true})
            }
        }
    })
}

export async function doEffect(effect, options = {}){
   if(!options.inside){
        state.update(s => {
            s.cache = {};
            return s;
        })

        openReactions();
    }
    let type = effect.type || 'active_may';
    let compulsory = (type == 'active_must' || type == 'players_must' || type == 'once');
    

    let actions = effect.action || effect;

    if(effect.source) options = {...options, source: effect.source};
    
    
    if(type == 'active_may' || type == 'once'){
        let cost = effect.cost;
        if(options.double && cost) cost = doubleCost(cost);
        if(effect.hasOwnProperty('condition')){
            console.log('Testing condition first');
            if(!testCondition(get(state).players[get(state).activePlayer], effect.condition, effect.condition.restriction == 'pure')){
                log(`Player not eligible for action: condition not met`);
                return;
            }
        }
        if(cost){
            if(!await pay(get(state).players[get(state).activePlayer], cost, {...options, compulsory, purpose: getReadableDescription(actions)})){
                console.log('Unable to afford!')
                log('unable to afford effect', get(state).players[get(state).activePlayer])
                return false;
            }
        }
        if(options.double){
            if(possArray(actions).some(a => a.restriction && ['same', 'different', 'noncost'].some(b => a.restriction.includes(b)))){
                let savedCache = jsonpatch.deepClone(get(state).cache);
                state.update(s => {    
                    s.cache = jsonpatch.deepClone(savedCache);
                
                    if(s.cache.lastSectors && s.cache.lastSectors.length > 1) s.cache.lastSectors = [s.cache.lastSectors[1]];
                    if(s.cache.costSectors && s.cache.costSectors.length > 1) s.cache.costSectors = [s.cache.costSectors[1]];
                    return s;
                })
                await executeActions(get(state).players[get(state).activePlayer], actions, {...options, compulsory, inside: true});
                state.update(s => {    
                    s.cache = jsonpatch.deepClone(savedCache);
                    if(s.cache.lastSectors && s.cache.lastSectors.length > 1) s.cache.lastSectors = [s.cache.lastSectors[0]];
                    if(s.cache.costSectors && s.cache.costSectors.length > 1) s.cache.costSectors = [s.cache.costSectors[0]];
                    return s;
                })
                await executeActions(get(state).players[get(state).activePlayer], actions, {...options, compulsory, inside: true});
            }else{
                await executeActions(get(state).players[get(state).activePlayer], [...possArray(actions), ...possArray(actions)], {...options, compulsory, inside: true});
            }
        }else{
            await executeActions(get(state).players[get(state).activePlayer], actions, {...options, compulsory, inside: true});
        }
    }else if(type == 'players_must'){
        // Must be ordered
        if(!Array.isArray(actions)) actions = [actions];
        for(let a of actions){
            for(let p of playersInTurnOrder()){
                if(effect.hasOwnProperty('condition')){
                    console.log('Testing condition first');
                    if(!testCondition(get(state).players[get(state).activePlayer], effect.condition, effect.condition.restriction == 'pure')){
                        log(`Player not eligible for action: condition not met`);
                        continue;
                    }
                }
                if(effect.cost){
                    if(!await pay(p, effect.cost, {...options, compulsory, purpose: getReadableDescription(actions)})){
                        console.log('Unable to afford!')
                        log('unable to afford effect', get(state).players[get(state).activePlayer])
                        return false;
                    }
                }
                await executeActions(p, a, {...options, compulsory, inside: true});
            }
        }
    }else if(type == 'players_may'){
        // Do I want this to be ordered? Or should they be able to go in any order?
        for(let p of playersInTurnOrder()){
            if(effect.hasOwnProperty('condition')){
                console.log('Testing condition first');
                if(!testCondition(get(state).players[get(state).activePlayer], effect.condition, effect.condition.restriction == 'pure')){
                    log(`Player not eligible for action: condition not met`);
                    continue;
                }
            }
            if(!Array.isArray(actions) && !actions.either_or){
                let doIt = await choose(`Take optional effect ${getReadableDescription(actions)}?`, ['Yes', 'No'], {...options});
                if(doIt == 'No') continue;
            }
            if(effect.cost){
                if(!await pay(p, effect.cost, {purpose: getReadableDescription(actions), compulsory: false})){
                    console.log('Unable to afford!')
                    log('unable to afford effect', get(state).players[get(state).activePlayer])
                    continue;
                }
            }
            await executeActions(p, actions, {...options, inside: true});
        }
    }else if(type == 'delayed'){
        console.log('Delayed thing');
    }
    if(!options.inside){
        await checkReactions();
        wipeDelayedReactions();
    }
}

export function wipeDelayedReactions(){
    state.update(s => {
        s.delayedReactions = [];
        return s;
    })
}

export function openReactions(){
    ui.update(ui => {
        ui.reactions = [[], ...ui.reactions];
        return ui;
    })
}

export function closeReactions(){
    ui.update(ui => {
        ui.reactions = ui.reactions.slice(1);
        return ui;
    })
}

let subscribed = false;

export function addReaction(p, text, source, action, code, mandatory = false, repeatable = true){
    if(!repeatable && get(ui).reactions[0] && get(ui).reactions.flat(3).some(r => r.code == code)) return; // No duplicates
    ui.update(ui => {
        ui.reactions[0].push({
            type: 'text',
            choice: text,
            p,
            source,
            value: action,
            code,
            mandatory
        })
        return ui;
    })
}

export function getReactionChoices(){
    if(!get(ui).reactions[0]) return [];
    if(get(ui).reactions[0].length > 0){
        console.log(get(ui).reactions[0])
        return get(ui).reactions[0].map(r => {
            return {
                ...r, 
                reaction: true,
                choice: `Reaction: ${r.choice}`,
                value: {
                    verb: {
                        custom: async () => {
                            ui.update(ui => {
                                let i;
                                for(i = 0; i < ui.reactions.length; i++){
                                    if(ui.reactions[i].length != 0 && ui.reactions[i].includes(r)){
                                        break;
                                    }
                                }
                                if(ui.reactions[i].length == 0) return ui;
                                ui.reactions[i] = ui.reactions[i].filter(reaction => reaction != r);
                                return ui;
                            })
                            let savedCache = get(state).cache; // So as not to interrupt anything else happening
                            if(typeof r.value == 'function'){
                                await r.value();
                            }else{
                                await executeActions(r.p, r.value);
                            }
                            state.update(s => {
                                s.cache = savedCache;
                                return s;
                            })
                        }
                    }
                    
                }
            }
        })
    }
    return [];
}

export async function checkReactions(){
    if(get(ui).reactions[0].length == 1){
        // diff behaviour for single and multiple]
        console.log('reactions', get(ui).reactions);
        let r = get(ui).reactions[0][0];
        let doIt = 'Yes';
        
        if(!r.mandatory){
            doIt = await choose(`Reaction triggered: do you want to ${r.choice}?`, ['Yes', 'No'], {foreground: r.source ? at(r.source) : false});
        }else{
            await pause(`Reaction triggered: ${r.choice}`, {foreground: r.source ? at(r.source) : false})
        }
        if(doIt == 'Yes'){
            log(`<i>Reaction triggered: player chose to ${r.choice}<i>`)
            openReactions();
            if(typeof r.value == 'function'){
                await r.value();
            }else{
                await executeActions(r.p, r.value, {source: r.source, inside: true});
            }
            await checkReactions();
        }else{
            log(`<i>Reaction triggered: player could ${r.choice}, but chose not to<i>`)
        }
    }else if(get(ui).reactions[0].length > 1){
        let r = get(ui).reactions[0];
        //openReactions(); // In case these trigger anything new!! Excessive? Or nest inside??
        while(r.length > 0){
            let chosen = await choose(`Multiple reactions triggered by action. Choose which to complete:`, [...r, `ok_Finish`], {foreground: Array.from(new Set(r.map(c => c.source).filter(c => c).map(c => at(c))))});
            if(chosen == 'Finish') break;
            let orig = r.find(entry => entry.value == chosen);
            r = r.filter(re => re != orig);
            if(orig) orig.disabled = true;
            log(`<i>Reaction triggered: player chose to ${orig.choice}<i>`)
            if(typeof chosen == 'function'){
                await chosen();
            }else{
                await executeActions(orig.p, chosen, {source: orig.source, inside: true});
            }
        }
       // await checkReactions();
    }
    closeReactions();
}

export async function focusSelection(p){
    let possible = all('focus', (b) => isIn(b, `players.${playerIndex(p)}.focus.available`));//allActivePlayer('focus', (b) => isIn(b, 'available'))
    let andFocus = ''
    if(get(state).mode == 'coop'){
        // Add Joint/Heroic Focus cards if you can 
        let addSpecial = [];
        for(let c of get(state).galactic_board.special_focus.river.filter(c => c && c.length > 0).map(c => c[0])){
            if(c.lo) c = lo(c);
            if(c.name.endsWith('Leadership') || possible.some(p => lo(p).name == c.matches)){
                // Add in
                addSpecial.push(ol(c));
            }
        }
        if(addSpecial.length > 0){
            if(get(state).players.length == 1){
                andFocus = ` or Heroic Focus`;
            }else{
                andFocus = ' or Joint Focus';
            }
        }
        possible = [...possible, ...addSpecial];
    }

    let card = await choose(`Select Focus${andFocus} card to play`, possible, {style: 'top: 30vh;', alwaysAsk: true}); // Auto-foreground?
    return card;
}

export async function chooseFocusCard(p, card = false){
    if(!card) card = await focusSelection(p);
    //console.log(possible, allActivePlayer('focus'), state.bigList)
    //cancelled = false;
    state.update(s => {
        s.focus = {
            chosen: null,
            actions: 2,
            agenda: null,
            trade: null,
            actionsTaken: [],
            boostsTaken: [],
            agendaAction: false
        };
        return s;
    });
    //let savedState = jsonpatch.deepClone(get(state));
    moveBitTo(card, 'state.focus', 'chosen');
    log({
        type: 'stats',
        focus: card.id,
        focusName: lo(card).name
    }, p);
    pushUndo();
    await afterAnimation(card.id, 1000);
    if(lo(card).special_focus){
        // Discard the equivalent matching one
        let toDiscard = p.focus.available.find(c => lo(c).name == lo(card).matches)
        if(lo(card).name.endsWith('Leadership')){
            // Choose
            toDiscard = await choose(`Choose card to discard in order to play ${lo(card).name} card`, p.focus.available);
        }
        moveBitTo(toDiscard, p.focus.discard);
    }
}

export async function resolveEventCard(c){
    await newInformation();
    if(c.lo) c = lo(c);

    if(!c.effects){
        console.log('No effects to resolve!');
        return false;
    }

    for(let e of c.effects){
        await doEffect(e, {foreground: c, source: c.id});
    }
}

export function doubleCost(cost){
    let doubled = {};
    if(!cost) return {};
    for(let k of Object.keys(cost)){
        doubled[k] = cost[k] * 2;
    }
    return doubled;
}

export async function exitGame(confirm = true){
    if(confirm){
        ui.update(ui => {
            ui.showing.Exit = true;
            return ui;
        })
        return; // Below old style code
        if(get(res).replaying || get(state).ended){
            if(await ask('Really leave game and return to setup?')){
                if(!get(ui).oneScreen) get(ui).gameComponent.$destroy();
                ui.update(ui => {
                    ui.tab = 'setup';
                    ui.showing.Setup = true;
                    return ui;
                })
            }
            return;
        }
        let choice = await choose(`Really leave game?`, ['cancel_Exit and delete', 'warn_Exit and save', 'ok_Stay in game']);
        if(choice == 'cancelled'){
            let sk = makeSaveKey(get(state));
            console.log(sk)
            await deleteSave({saveKey: makeSaveKey(get(state))}, false);
            
        }else if(choice == 'Stay in game'){
            return; // Don't exit
        }
    }
    if(!get(ui).oneScreen) get(ui).gameComponent.$destroy();
    ui.update(ui => {
        ui.tab = 'setup';
        ui.showing.Setup = true;
        return ui;
    })
    
}

export async function cheat(){
    let verbs = actions.map(a => {
        return {
            type: 'text',
            choice: `${getReadableDescription({verb: a.verb})}`,
            value: a.verb
        }
    });
    
    let choice = await choose(`Choose an action to do`, verbs);
    log({
        type: 'stats',
        cheated: choice
    })
    state.update(s => {
        if(!s.turnCache) s.turnCache = {};
    
        return s;
    })
    openReactions();
    await doAction(activePlayer(), choice, {});
    await checkReactions();
}

export async function thirdFocusAction(p){
    let f = get(state).focus.chosen;
    if(!f){
        await pause(`Can't take third Focus action: no Focus card in play!`);
        return;
    }
    if(get(state).focus.actions == 3){
        await pause(`You can already take 3 Focus actions!`);
        return;
    }
    if(get(state).focus.actionsTaken.length < get(state).focus.actions){
        // Still waiting to take some, so just up count
        state.update(s => {
            s.focus.actions++;
            return s;
        })
        await pause(`You can now take 3 Focus actions!`);
        return;
    }
    if(f.lo) f = lo(f);
    let effect = f.effects.find(e => !get(state).focus.actionsTaken.includes(e.name));
    if(get(state).focus.actionsTaken.length == 3){
        await pause(`Can't take third action: you already have!`);
        return;
    }
    if(!effect) throw `Can't find focus action somehow!`;
    state.update(s => {
        s.focus.actionsTaken.push(effect.name);
        return s;
    }) 
    let e = jsonpatch.deepClone(effect);
    if(ongoingGeneral().includes('preferred_energy_cost') && isPreferred(p, f)){
        if(!e.cost) e.cost = {};
        if(e.cost.energy){
            e.cost.energy++;
        }else{
            e.cost.energy = 1;
        }
    }
    if(ongoingGeneral().includes('preferred_credits_cost') && isPreferred(p, f)){
        e.cost = {
            credits: 1
        };
    }
    let t = hasTech(p, 'Robotics');
    if(!get(state).focus.alreadyDoubledFocusAction && t && (f.name.endsWith('Development') || t.type == 'improved' && isPreferred(p, f))){
        if(!e.cost || getCostInfo(p, doubleCost(e.cost))){
            if(await ask(`[[${t.type}_tech]] Robotics: double cost and effect of this action?`)){
                state.update(s => {
                    s.focus.doubleFocusAction = true;
                    s.focus.alreadyDoubledFocusAction = true;
                    return s;
                })
            }else{
                state.update(s => {
                    if(!s.focus.askedAboutDoubling) s.focus.askedAboutDoubling = [];
                    s.focus.askedAboutDoubling.push(e.name);
                    return s;
                })
            }
        }
    }
    await doEffect(e, {source: f.id, double: get(state).focus.doubleFocusAction});
    checkTriggeredEffects(p, {verb: f.name}, 'duringFocus');
    state.update(s => {
        s.focus.doubleFocusAction = false;
        return s;
    }) 
}

export function activePlayer(){
    return get(state).players[get(state).activePlayer];
}

export function playerIndex(p){
    return get(state).players.findIndex(pl => pl.colour == p.colour);
}

export function playerTrade(p){
    let list =  [...p.loose_trade, ...p.agendas.map(a => a.trade).filter(a => a)];
    if(hasTech(p, 'Escape Pods')) list = [...list, ...hasTech(p, 'Escape Pods').inside.map(i => i.trade).filter(i => i)];
    return list;
}