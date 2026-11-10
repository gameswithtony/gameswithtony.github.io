// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { prefs, res, resetStores, state, ui} from './stores.js';
import { get } from './runtime.js';
import { pause, choose, changeView, doActionPause, mayMany, ask, announce, waitMillis } from './ui.js';
import { agendaActions, getMatchingAgendas, score_agenda, startingAgendas, tradeTokens } from './agendas.js';
import * as jsonpatch from './runtime.js';
import { actionUndo, addUndo, undoTo } from './undo.js';
import { all, allActivePlayer, at, isIn, moveBitTo, upperInitial, lo, ol, addToList, assembleList, bl, possArray, possFunc, spotNonClonable } from './utils.js';
import { returnToken, bottomTrade, numTradeOnBoard } from './tokens.js';
import { logEvent, resolveEventCard, log,doAction, executeActions, openReactions, checkReactions, ongoingGeneral, activePlayer, getReactionChoicesUO, doEffect, getReadableDescription, doubleCost, renderCost, chooseFocusCard, focusSelection } from './game.js';
import * as pako from './runtime.js';

import { fleetsToList, resolveSkirmish, updateSkirmish } from './combat.js';
import { getCostInfo, pay, payUpkeep } from './costs.js';
import { tick } from './runtime.js';
import { clearSingleFleet, fleetLimit, getSectorList, guilds, playerSectors } from './sectors.js';
import { set, get as IDBget, setMany, del } from './runtime.js';
import { afterAnimation, select } from './previewable.js';
import { payableUpkeep, totalUpkeep } from './resources.js';
import { galacticEvents, resolveGalacticObjectives } from './events.js';
import { canDo, checkTriggeredEffects, handleWar, resolveCrisis, revealAlert, revealCrisis, setupCoopAlertDeck, totalHavenCapacity, transferCurrentCrisis } from './crisis.js';
import { deployedFleet, moveFleet, totalDeployed } from './fleets.js';
import { playerSlottedTrade, playerTradeSlots } from './actions.js';
import { focusBoosts, hasTech, resolveTechGain } from './techs.js';
import { getBGImage, setViewScale } from './images.js';
import { logAvailable } from './stats.js';
import { uid } from './net.js';
import { house } from './houses.js';
import { dex } from './db.js';
import { setupUndo, pushUndo } from './undo.js'
import { isPreferred } from './focus.js';
 
let turnOrder = [2, 1, 3]; //for funsies

// TODO check whether it's better to just do get(state) within actions....

let turns = {
    stepName: 'cycle',
    iterations: (state) => 3,
    logPhase: () => `<h2 style="color: white;>Cycle ${get(state).turn.cycle}</h2>`,
    announce: true, 
    confirmAtEnd: `Click to continue to next Cycle`,
    subSteps: [
        {
            stepName: 'starting actions',
            condition: (state) => state.turn.cycle == 1,
            turnMarker: true,
            undoCheckpoint: true,
            noTitle: true,
            action: async (_) => {
                state.update(s => {
                    s.noReactions = true;
                    return s;
                })
                let i = 0;
                for(let p of get(state).players){
                    i++;
                    if(p.starting_action){
                        log({
                            type: 'phase',
                            phase: 'starting actions',
                            text: 'Starting Actions for '+p.house,
                            num: i
                        })
                        await executeActions(p, {simple_list: p.starting_action}, {compulsory: true});
                    }
                    await resolveTechGain(p, p.techs[0]); // Make sure starting tech is set up
            
                    // Slot trade you have gained, if you want
                    let num = 1;
                    let total = p.loose_trade.length;
                    let leftUnslotted = 0;
                    while(p.loose_trade.length > leftUnslotted && playerTradeSlots(p) > 0){
                        moveBitTo(p.loose_trade[0], p.agendas.find(a => a.card && !a.trade), 'trade')
                        num++;
                    }
                }


                state.update(s => {
                    delete s.noReactions;
                    return s;
                })
                pushUndo();
            }
        },
        {
            stepName: 'preparation phase',
            minorSteps: true, // no need to log titles for these
            subSteps: [
                {
                    stepName: 'coop refresh', 
                    condition: (state) => state.mode == 'coop' && state.turn.cycle > 1,
                    action: async (_) => {
                        //await pause('cycle start '+state.turn.cycle);

                        // Refresh offers
                        /*console.log('refresh various offers here for coop')
                        ui.update(ui => {
                            ui.animate = true;
                            return ui;
                        })*/
                        for(let f of get(state).galactic_board.special_focus.river.flatMap(c => c).filter(c =>c)){
                            moveBitTo(f, get(state).galactic_board.special_focus.discard);
                            //await doActionPause();
                        }
                        

                        for(let i = 0; i < 3; i++){
                            let c;
                            do{
                                c = get(state).galactic_board.special_focus.deck[0];
                                if(c && get(state).players.length == 1){
                                    // check whether to move it or not
                                    while(c && !lo(c).name.endsWith('Leadership') && ![...get(state).players[0].focus.available, ...get(state).players[0].focus.discard].some(f => lo(f).name == lo(c).matches)){
                                        // Ditch and replace
                                        console.log('Heroic Focus '+lo(c).name+' discarded as unplayable')
                                        moveBitTo(c, get(state).galactic_board.special_focus.discard);
                                        /*if(get(state).galactic_board.special_focus.deck.length == 0){
                                            shuffle(get(state).galactic_board.special_focus.discard);
                                            while(get(state).galactic_board.special_focus.discard.length > 0){
                                                moveBitTo(get(state).galactic_board.special_focus.discard[0], get(state).galactic_board.special_focus.deck);
                                            }
                                        }*/
                                        c = get(state).galactic_board.special_focus.deck[0];
                                        
                                    }
                                }
                            }while(!c && get(state).galactic_board.special_focus.deck.length > 0);
                            if(c){
                                moveBitTo(c, get(state).galactic_board.special_focus.river[i]);
                                logAvailable(c);
                            }else{
                                console.log('Run out of suitable heroic cards!')
                            }
                            
                            //await doActionPause();
                        }

                        state.update(s => {
                            return s; // Just to get those bits set?
                        })

                        await setupCoopAlertDeck(get(state).turn.cycle);
                    }
                },
                {
                    stepName: 'trade and tech',
                    condition: (state) => state.turn.cycle > 1,
                    action: async (_) => {
                        state.update(s => {
                            s.turn.round = 0;
                            return s;
                        })
                        // The below could be a routine for 'takeTrade' in toks (or in game.js), with optional get bonus or not
                        if(numTradeOnBoard() >= 1){
                            logEvent('Removed bottom trade token from Galactic Board')
                            let tok = bottomTrade();
                            if(tok) await returnToken(tok);
                        }

                        if(get(state).turn.cycle == 3){
                            // Get next set of improved techs
                            for(let tech of get(state).galactic_board.improved_techs.flatMap(t => t)){
                                moveBitTo(tech, get(state).spare_cards, -1, true);
                                if(tech.inside) assembleList(tech.inside, tech, 'inside', `${bl(tech.id).address}.inside`, true);
                            }
                            let i = 0;
                            while(get(state).improved_deck.length > 0){
                                let tech = get(state).improved_deck[0];
                                
                                moveBitTo(tech, get(state).galactic_board.improved_techs[i++], -1, true);
                                if(tech.inside) assembleList(tech.inside, tech, 'inside', `${bl(tech.id).address}.inside`, true);
                            }
                        }

                        for(let t of get(state).galactic_board.improved_techs.flatMap(t => t)){
                            logAvailable(t);
                        }
                    }
                },
                {
                    stepName: 'turn order',
                    action: async (state) => {
                        if(state.turn.cycle == 1){
                            state.turn_order = [];
                            for(let i = 0; i < state.players.length; i++){
                                state.turn_order.push(i);
                            }
                        }else{
                            if(state.players.length == 1){
                                state.turn_order = [0];
                            }
                        }
                        
                    } // only make functions that are async async so you can differentiate in nextTurn for speed?
                },
                {
                    stepName: 'galactic event',
                    turnMarker: true,
                    saveBefore: (state) => state.turn.cycle > 1,
                    undoCheckpoint: true,
                    pauseAfter: true,
                    //pauseAtEnd: true,
                    action: async (s) => {
                        let event = s.events[`cycle_${s.turn.cycle}`][0];
                        if(get(ui).specifyEvent && get(ui).nextEvent){
                            event = get(ui).nextEvent;
                        }
                        log({
                            type: 'stats',
                            event: event.id,
                            eventName: lo(event).name
                        })
                        //await pause('test range', {ranges: {food: {min: 2, max: 6}, corvette: {min: 0, max: 5}}}); 
                        if(s.galactic_board.current_event) moveBitTo(s.galactic_board.current_event, s.spare_cards); // !!! NB this wasn't done before! Hence disappearing cards
                        moveBitTo(event, s.galactic_board, 'current_event');
                        await pause(`New galactic event`, {foreground: s.galactic_board.current_event});
                        await resolveEventCard(s.galactic_board.current_event);
                        pushUndo();
                    }
                },
            ]
        },
        {
            stepName: 'focus phase',
            subSteps: [
                {
                    stepName: 'round',
                    logPhase: () => `Round ${get(state).turn.round}`,
                    announce: true, 
                    iterations: (s) => { console.log('galactic event tells us how many iterations: '+ lo(s.galactic_board.current_event).rounds); return lo(s.galactic_board.current_event).rounds},
                    subSteps: [
                        {
                            stepName: 'increment round counter',
                            action: (_) => {
                                state.update(s => {
                                    if(!s.turnInfo.rawRound) s.turnInfo.rawRound = 0;
                                    s.turnInfo.rawRound++;
                                    return s;
                                })
                            }
                        },
                        {
                            stepName: 'preselect focus cards',
                            undoCheckpoint: true,
                            saveBefore: true,
                            condition: (state) => state.preselectedFocus,
                            action: async (_) => {
                                // !! TODO find a way to make simultaneous
                                // !! TODO for future need to handle clashes with co-op and joint focus cards simultaneously
                                for(let p of get(state).players){
                                    let card = await focusSelection(p);
                                    p.selectedFocus = card.id;
                                }
                                pushUndo();
                            }
                        },
                        {
                            stepName: 'reveal alert',
                            pauseAfter: true,
                            condition: (state) => state.mode == 'coop',
                            action: async (_) => await revealAlert()
                        },
                        {
                            stepName: 'player turn',
                            iterations: (state) => state.players.length,
                            turnMarker: true,
                            subSteps: [ 
                                {
                                    stepName: 'set current player for turn',
                                    noTitle: true,
                                    action: (_) => { 
                                        let i = get(state).turn_order.indexOf(get(state).activePlayer);
                                        if(i == get(state).turn_order.length - 1){
                                            // This is the first iteration, so set to first
                                            i = 0;
                                        }else{
                                            // Move on to the next
                                            i++;
                                        }
                                        state.update(s => {
                                            s.activePlayer = get(state).turn_order[i];
                                            return s;
                                        })
                                        let p = get(state).players[get(state).activePlayer];
                                        let playerResources = {};
                                        for(let r of Object.keys(p.resources)){
                                            playerResources['player'+upperInitial(r)] = p.resources[r].store;
                                        }
                                        log({
                                            type: 'stats',
                                            playerScore: p.influence, // To set up for statistical use,
                                            ...playerResources,
                                            playerActiveFleet: p.fleets.active.length,
                                            playerInactiveFleet: p.fleets.inactive.length,
                                            playerDeployedFleet: deployedFleet(p).length,
                                            totalGlory: p.glory.reduce((a,g) => a + g.value, 0)
                                        }, p)
                                        log({
                                            type: 'phase',
                                            phase: 'player turn',
                                            text: `${p.house} turn`,
                                            num: i + 1
                                        });
                                        updateSkirmish(get(state).players[get(state).activePlayer]); // To keep things updated
                                    }
                                },
                                {
                                    stepName: 'reveal crisis',
                                    pauseAfter: true,
                                    condition: (state) => state.mode == 'coop',
                                    action: async (_) => {
                                        await revealCrisis();
                                        //await doActionPause();
                                    }
                                },
                                {
                                    stepName: 'choose focus card',
                                    undoCheckpoint: true,
                                    saveBefore: true,
                                    condition: (state) => !state.preselectedFocus,
                                    action: async (_) => {
                                        await chooseFocusCard(get(state).players[get(state).activePlayer]);
                                    }
                                },
                                {
                                    stepName: 'reveal focus card',
                                    condition: (state) => state.preselectedFocus,
                                    action: async (_) => {
                                        let p = get(state).players[get(state).activePlayer];
                                        let card = at(p.selectedFocus);
                                        delete p.selectedFocus;
                                        await chooseFocusCard(p, card);
                                    }
                                },
                                {
                                    stepName: 'trade token',
                                    undoCheckpoint: true,
                                    condition: (s) => tradeTokens(s.players[s.activePlayer]).length > 0,
                                    action: async (s) => {
                                        let p = s.players[s.activePlayer];
                                        
                                        let use = await choose(`Flip a [[trade]] Trade token to enable you to take all 3 actions?`, ['Yes', 'No']);
                                        pushUndo();
                                        if(use == 'Yes'){
                                            log({
                                                type: 'stats',
                                                usedTrade: true
                                            }, p)
                                            let trade = await choose(`Select a [[trade]] Trade token to flip`, tradeTokens(p));
                                            //let availableTrades = tradeTokens(p);
                                            moveBitTo(trade, 'state.focus', 'trade')
                                            state.update(s => {
                                                s.focus.actions = 3;
                                                return s;
                                            })
                                        }
                                    }
                                },
                                {
                                    stepName: 'agenda selection',
                                    undoCheckpoint: true,
                                    condition: (s) => getMatchingAgendas(s.players[s.activePlayer], s.focus.chosen).length > 0,
                                    action: async (s) => {
                                        let p = s.players[s.activePlayer];
                                        let possAgendas = getMatchingAgendas(p, s.focus.chosen);
                                        let agenda = await mayMany('You may play an agenda alongside your Focus card', `Choose an agenda to play alongside your Focus card`, possAgendas, {foreground: possAgendas});
                                        
                                        pushUndo();
                                        if(agenda){
                                            await doAction(p, 'play_agenda', {obj: agenda});
                                            if(agenda.lo) agenda = lo(agenda);
                                            log({
                                                type: 'stats',
                                                agendaPlayed: agenda.id
                                            }, p)
                                        }
                                    }
                                },
                                {
                                    stepName: 'focus pretriggers',
                                    undoCheckpoint: true,
                                    action: async (_) => {
                                        let f = lo(get(state).focus.chosen);
                                        openReactions();
                                        checkTriggeredEffects(activePlayer(), {verb: f.matches || f.name}, 'beforeFocus');
                                        await checkReactions(); // Handle these first!
                                    }
                                },
                                {
                                    stepName: 'focus actions',
                                    undoCheckpoint: true,
                                    saveBefore: true,
                                    finished: () => get(state).focus.ended,
                                    action: async (_) => {
                                        let f = lo(get(state).focus.chosen);
                                        let trade = get(state).focus.trade;
                                        let agenda = get(state).focus.agenda;
                                        if(agenda) agenda = lo(agenda);
                                        let p = get(state).players[get(state).activePlayer];

                                        let available = [];
                                        if(!f){
                                           if(get(state).preselectedFocus) return 'preselect focus card';
                                           return 'choose focus card';
                                        }
                                        for(let e of jsonpatch.deepClone(f.effects)){ // Duplicating so that we can modify costs
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
                                                };
                                                e.showCost = true;
                                            }
                                            let add = {
                                                type: 'text',
                                                focus: true,
                                                choice: e.name,
                                                cost: e.cost,
                                                showCost: e.showCost,
                                                source: f.id,
                                                effectName: e.name,
                                                value: e,
                                                alreadyDoubled: e.alreadyDoubled || false,
                                                done: get(state).focus.actionsTaken.includes(e.name),
                                                noSpace: get(state).focus.actionsTaken.length == get(state).focus.actions
                                            };
                                            available.push(add);
                                        }

                                        if(agenda){
                                            available.push({
                                                type: 'text',
                                                choice: `[[agenda]]: ${getReadableDescription(agendaActions[agenda.type])}`,
                                                value: agendaActions[agenda.type],
                                                agenda: true,
                                                source: agenda.id,
                                                extra: true,
                                                disabled: get(state).focus.agendaAction
                                            })
                                        }

                                        let overlayList = [];
                                        if(trade) overlayList.push(trade);
                                        let overlay;
                                        if(overlayList.length > 0){
                                            overlay = {};
                                            overlay[f.id.replaceAll('.', '-')] = overlayList;
                                        } 
                                        let foreground = f;
                                        if(agenda) foreground = [agenda, f];
                                        let options = available.map(a => {
                                            return {
                                                ...a,
                                                action: async () => {
                                                    state.update(s => {
                                                        s.focus.currentAction = a.choice;
                                                        return s;
                                                    });
                                                    
                                                    if(!a.extra){
                                                        log({
                                                            type: 'stats',
                                                            focusAction: `${get(state).focus.chosen.id}.${a.choice}`
                                                        }, p);
                                                        state.update(s => {
                                                            if(!a.done) s.focus.actionsTaken.push(a.choice); // (a.done) to avoid Robotics issue
                                                            s.focus.currentAction = a.choice;
                                                            return s;
                                                        });
                                                        p = get(state).players.find(pl => pl.colour == p.colour); // Reset to keep in sync
                                                        let t = hasTech(p, 'Robotics');
                                                        if(a.done){ // Means it's been doubled by Robotics
                                                            state.update(s => {
                                                                s.focus.alreadyDoubledFocusAction = true;
                                                                return s;
                                                            })
                                                        }else if(!get(state).focus.alreadyDoubledFocusAction && t && (f.name.endsWith('Development') || t.type == 'improved' && isPreferred(p, f))){
                                                            let nextEffect = a.value;
                                                            if(!nextEffect.cost || getCostInfo(p, doubleCost(nextEffect.cost))){
                                                                if(await ask(`[[${t.type}_tech]] Robotics: double cost and effect of this action?`)){
                                                                    state.update(s => {
                                                                        s.focus.doubleFocusAction = true;
                                                                        s.focus.alreadyDoubledFocusAction = true;
                                                                        return s;
                                                                    })
                                                                }else{
                                                                    state.update(s => {
                                                                        if(!s.focus.askedAboutDoubling) s.focus.askedAboutDoubling = [];
                                                                        s.focus.askedAboutDoubling.push(a.effectName);
                                                                        return s;
                                                                    })
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if(a.agenda){
                                                        log({
                                                            type: 'stats',
                                                            agendaAction: a.source,
                                                            agendaName: lo(at(a.source)).name
                                                        }, p);
                                                        state.update(s => {
                                                            s.focus.agendaAction = true;
                                                            s.focus.currentAction = a.source;
                                                            return s;
                                                        })
                                                    }
                                                    if(get(state).focus.doubleFocusAction){
                                                        await doEffect(a.value, {double: get(state).focus.doubleFocusAction, source: a.source, specific: a.effectName || null});
                                                    }else{
                                                        await doEffect(a.value, {source: a.source, specific: a.effectName || null});
                                                        
                                                    }
                                                    state.update(s => {
                                                        s.focus.doubleFocusAction = false;
                                                        return s;
                                                    }) 
                                                    
                                                }
                                            }
                                        });
                                        openReactions();
                                        checkTriggeredEffects(activePlayer(), {verb: f.matches || f.name}, 'duringFocus');
                                        for(let e of options.filter(e => e.focus)){
                                            // Disable any impossible ones
                                            if(e.done){
                                                // NB below removed as ruling says you can't do it
                                                /*let t = hasTech(p, 'Robotics');
                                                if(t
                                                    && !get(state).focus.alreadyDoubledFocusAction
                                                    && (!get(state).focus.askedAboutDoubling || !get(state).focus.askedAboutDoubling.includes(e.effectName))
                                                    && (f.name.endsWith('Development') || t.type == 'improved' && house(p).preferred.includes(f.matches || f.name))
                                                    && (!e.cost || getCostInfo(p, e.cost))
                                                ){
                                                    // Can double with Robotics, so keep enabled
                                                    
                                                    let icon = `[[${t.type}_tech]]`;
                                                    if(!e.choice.endsWith(icon)) e.choice = `${e.effectName} ${icon}`;
                                                    if(e.showCost == true) e.choice = `${e.choice} (${renderCost(e.cost)})`;
                                                   // e.alreadyDoubled = true;
                                                }else{*/
                                                    e.choice = `${e.effectName} ✅`;
                                                    e.disabled = true;
                                                //}
                                            }else if(e.showCost == true){
                                                e.choice = `${e.effectName} (${renderCost(e.cost)})`;
                                            }
                                            
                                            if(!e.done && e.cost){
                                                if(!getCostInfo(p, e.cost)){
                                                    e.disabled = true;
                                                    e.choice = `${e.effectName} 💰`
                                                }else if(e.showCost == true){
                                                    e.choice = `${renderCost(e.cost)}: ${e.effectName}`;
                                                }else{
                                                    e.choice = e.effectName;
                                                }
                                            }

                                            if(e.noSpace) e.disabled = true;
                                               // e.disabled = get(state).focus.actionsTaken.includes(e.choice) || !getCostInfo(p, e.cost)
                                        }

                                        for(let t of focusBoosts(f, p)){
                                            // Add any extras
                                            options.push({
                                                type: 'text',
                                                choice: `${t.boostLabel}: ${getReadableDescription(t)}`,
                                                value: t,
                                                extra: true,
                                                boostID: t.boostID,
                                                disabled: get(state).focus.boostsTaken.includes(t.boostID) || (t.cost && !getCostInfo(p, t.cost)) || !canDo(p, t),
                                                source: t.sourceID,
                                                action: async () => {
                                                    log({
                                                        focusBoost: t.sourceID,
                                                        boostLabel: t.boostLabel,
                                                        boostName: `${t.boostLabel}${getReadableDescription(t)}`
                                                    })
                                                    state.update(s => {
                                                        s.focus.boostsTaken.push(t.boostID);
                                                        return s;
                                                    })
                                                    await doEffect(t, {source: t.sourceID});
                                                }
                                            })
                                        }
                                        options.push(...getReactionChoicesUO(p));

                                        if(options.length == 0 || !options.some(o => !o.disabled && !o.reaction)){
                                            if(get(state).focus.actionsTaken.length == 0 && !await ask(`You cannot afford to take any of the Focus actions on this card. Do you really want to continue?`)){
                                                if(get(state).preselectedFocus) return 'preselect focus card';
                                                return 'choose focus card';
                                            }
                                            state.update(s => {
                                                s.focus.ended = true;
                                                return s;
                                            })
                                            await checkReactions();
                                            return;
                                        }

                                        if(options.every(d => d.disabled || !d.compulsory)){
                                            options = [
                                                ...options,
                                                {
                                                    type: 'text',
                                                    action: async () => `end`,
                                                    choice: 'Finish',
                                                    ok: true,
                                                }
                                            ]
                                        }

                                        let actions = options.map(f => f.action);
                                        let toDisplay = options.map((f, i) => {
                                            return {
                                                type: 'text',
                                                ...f,
                                                value: i
                                            };
                                        })

                                        let i = await choose('Select action to perform', toDisplay, {vertical: true, foreground, overlay, cancellable: !get(state).preselectedFocus});
                                        
                                        if(i == 'cancelled' || typeof i != 'number'){
                                           // undoTo('choose focus card');
                                            return 'choose focus card';
                                        }
                                        pushUndo();

                                        let ret = await actions[i]();
                                        if(ret == 'end'){
                                            state.update(s => {
                                                s.focus.ended = true;
                                                return s;
                                            })
                                        }

                                        await checkReactions();
                                    }
                                },
                                {
                                    stepName: 'focus posttriggers',
                                    pauseAfter: true,
                                    action: async (_) => {
                                        let f = lo(get(state).focus.chosen);
                                        openReactions();
                                        checkTriggeredEffects(activePlayer(), {verb: f.matches || f.name}, 'duringFocus');
                                        checkTriggeredEffects(activePlayer(), {verb: f.matches || f.name}, 'afterFocus');
                                        await checkReactions();
                                    }
                                },
                                {
                                    stepName: 'cleanup',
                                    minorSteps: true,
                                    pauseAfter: true,
                                    logPhase: 'Cleanup',
                                    //pauseAtEnd: true,
                                    subSteps: [
                                        {
                                            stepName: 'recall fleets',
                                            
                                            //condition: (state) => { return false;}, // to allow checks as to whether necessary...?
                                            action: async (state) => {
                                                
                                                let p = state.players[state.activePlayer];
                                                for(let s of getSectorList(state.sectors)){
                                                    // handle limits etc.
                                                    if(s.fleets.length > fleetLimit(s)){
                                                        let num = s.fleets.length - fleetLimit(s);
                                                        select(s.id);
                                                        let toRemove = await choose(`Choose ship base(s) to remove from sector so that it is below the limit of ${fleetLimit(s)}`, s.fleets, {number: num, singleClick: num == 1});
                                                        for(let f of possArray(toRemove)){
                                                            await moveFleet(p, f.id, 'active');//doAction(p, 'recall', {obj, ignoreLog: true});
                                                        }
                                                        /*let toRemove = await choose(`Choose ${num} ships to remove from sector so that it is below the limit of ${fleetLimit(s)}`, s.fleets, {number: num});
                                                        for(let f of toRemove){
                                                            await clearSingleFleet(f);
                                                        }*/
                                                        //await doAction(p, 'recall', {place: s, num, ignoreLog: true})
                                                        
                                                    }
                                                }
                                                
                                            }
                                        },
                                        {
                                            stepName: 'discard glory',
            
                                            action: async (state) => {
                                                for(let p of state.players){
                                                    let toDiscard = p.glory.length - 4;
                                                    if(toDiscard > 0){
                                                        let discarding = await choose(`Choose Glory tokens to discard`, p.glory, {number: toDiscard, foregroundAll: true});
                                                        for(let d of possArray(discarding)){
                                                            await doAction(p, 'discard_glory', {obj: d, ignoreLog: true})
                                                        }
                                                        
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            stepName: 'slot agendas',
                                            condition: (_) => get(state).focus.agenda,
                                            action: async (_) => {
                                                let chosen = false;
                                                let a = lo(get(state).focus.agenda);
                                                let choices = [
                                                    {
                                                        type: 'text',
                                                        choice: 'Discard it',
                                                        value: 'discard'
                                                    }
                                                ];
                                                let p = get(state).players[get(state).activePlayer];
                                                if(p.agendas.some(ag => ag.card && lo(ag.card).type == a.type)){
                                                    // Then you'll have to replace the one that's the same
                                                    
                                                    chosen = p.agendas.find(ag => lo(ag.card).type == a.type);
                                                    let choice = await choose(`You must either replace the agenda ${lo(chosen.card).name} with your newly-played agenda ${a.name}, or else discard the new agenda`, [`Keep ${lo(chosen.card).name}`, `Replace with ${a.name}`], {foreground: [chosen.card, a], count: [score_agenda(p, lo(chosen.card)).elements,  score_agenda(p, a).elements]});
                                                    if(!choice || !choice.startsWith('Replace')){
                                                        chosen = 'Discard it';
                                                    }else{
                                                        moveBitTo(chosen.card, get(state).agenda_board[lo(chosen.card).type].deck, -1);
                                                        //moveBitTo(chosen.card, get(state).agenda_board[lo(chosen.card).type].discard);
                                                    }
                                                    
                                                    //await pause(`You have to replace the agenda ${chosen.name} with your newly-played agenda ${a.name}`);
                                                }else{
                                                    chosen = await choose('Choose a slot to place your played agenda into', [...p.agendas.slice(1), 'Discard it'], {singleClick: true, foreground: get(state).focus.agenda});
                                                };
                                                if(chosen == 'Discard it'){
                                                    //moveBitTo(get(state).focus.agenda, get(state).agenda_board[lo(get(state).focus.agenda).type].discard);
                                                    moveBitTo(get(state).focus.agenda, get(state).agenda_board[lo(get(state).focus.agenda).type].deck, -1);
                                                }else{
                                                    if(chosen.card) moveBitTo(chosen.card, get(state).spare_cards);
                                                    await doAction(p, 'slot_agenda', {obj: get(state).focus.agenda, place: chosen})
                                                    moveBitTo(get(state).focus.agenda, chosen, 'card');
                                                   
                                                }
                                                
                                            }
                                        },
                                        {
                                            stepName: 'slot trades',
                                            condition: (_) => get(state).focus.trade || get(state).players[get(state).activePlayer].loose_trade.length > 0 || playerSlottedTrade(activePlayer()).length > 0,
                                            action: async (_) => {
                                                let t = get(state).focus.trade;
                                                let p = get(state).players[get(state).activePlayer]
                                                if(t){
                                                    log('Returning flipped [[trade]] token', p);
                                                    await doAction(p, 'return_token', {obj: t, ignoreLog: true})
                                                }
                                                let possReturn = [...playerSlottedTrade(p), ...p.loose_trade];
                                                let ep = hasTech(p, 'Escape Pods');
                                                if(possReturn.length > 0){
                                                    let toReturn = await choose(`Select any [[trade]] tokens (slotted or loose) if you wish to return them (the rest will be slotted into agendas${ep ? ' and/or Escape Pods' : ''} if they fit)`, [...possReturn, 'Rearrange manually'], {optional: true, number: 'any'});
                                                    if(toReturn == 'Rearrange manually'){
                                                        for(let r of possReturn){
                                                            if(playerSlottedTrade(p).includes(r)) moveBitTo(r, p.loose_trade);
                                                        }
                                                        let place;
                                                        let count = 1;
                                                        let max = possReturn.length
                                                        do{
                                                            let places = [...p.agendas.filter(a => a.card)];
                                                            if(ep && !ep.inside[0].trade) places = [...places, ep.inside[0]]
                                                            place = await choose(`Select a place for [[trade]] token (${count} of ${max})`, [...places, 'ok_Finish'], {singleClick: true});
                                                            count++;
                                                            if(place != 'Finish'){
                                                                let r = possReturn.shift();
                                                                moveBitTo(r, place, 'trade');
                                                            }
                                                        }while(place != 'Finish' && possReturn.length > 0)
                                                    }else if(toReturn && toReturn.length){
                                                        for(let r of toReturn){
                                                            await doAction(p, 'return_token', {obj: r, ignoreLog: true})
                                                        }
                                                    }
                                                    
                                                }
                                                

                                                /*let slotted = playerSlottedTrade(p);
                                                if(slotted.length > 0){
                                                    let toReturn = await choose(`You may optionally select any number of slotted [[trade]] tokens to return them`, slotted, {optional: true, number: 'any'});
                                                    for(let r of toReturn){
                                                        await doAction(p, 'return_token', {obj: r})
                                                    }
                                                }*/

                                                //let num = 1;
                                                
                                                if(p.loose_trade.length > 0 && ep && (!ep.inside[0] || !ep.inside[0].trade)){
                                                    let doIt = true; // By default you have to, to fit
                                                    if(p.loose_trade.length < playerTradeSlots(p)) doIt = await ask(`You may slot one [[trade]] into [[${ep.type}_tech]] Escape Pods instead of placing it on an [[agenda]]. Do you want to?`);
                                                    if(doIt){
                                                        log('Slotted a [[trade]] into Escape Pods', p)
                                                        moveBitTo(p.loose_trade[0], ep.inside[0], 'trade');
                                                    }  
                                                }
                                                // Slot as many others as possible into agendas
                                                if(p.loose_trade.length > 0 && p.agendas.find(a => a.card && !a.trade)) log(`Slotting ${Math.min(p.loose_trade.length, p.agendas.filter(a => a.card && !a.trade).length)} [[trade]] token(s) into [[agenda]]`, p);
                                                while(p.loose_trade.length > 0 && p.agendas.find(a => a.card && !a.trade)){
                                                    log('Slotted a [[trade]] into an [[agenda]] slot', p);
                                                    moveBitTo(p.loose_trade[0], p.agendas.find(a => a.card && !a.trade), 'trade')
                                                }
                                                if(p.loose_trade.length > 0) log(`Returning ${p.loose_trade.length} [[trade]] token(s) as there is nowhere to slot them`, p);
                                                while(p.loose_trade.length > 0){
                                                    await doAction(p, 'return_token', {obj: p.loose_trade[0], ignoreLog: true});
                                                }
                                            }
                                        },
                                        {
                                            stepName: 'discard focus',
                                            action: async (_) => {
                                                let c = get(state).focus.chosen;
                                                if(lo(c).special_focus){
                                                    moveBitTo(c, get(state).galactic_board.special_focus.discard);
                                                }else{
                                                    moveBitTo(c, get(state).players[get(state).activePlayer].focus.discard);
                                                }
                                                
                                                state.update(s => {
                                                    s.focus = {};
                                                    return s;
                                                })
                                            }
                                        },
                                        {
                                            stepName: 'confirm turn end',
                                            condition: (_) => get(state).strictMode && get(state).players.length > 1,
                                            action: async (_) => {
                                                await pause('Click OK to confirm turn end (you will not be able to undo)');
                                            }
                                        }
                                    ]
                                },
                                {
                                    stepName: 'void advances',
                                    minorSteps: true,
                                    saveBefore: true,
                                    pauseAfter: true,
                                    undoCheckpoint: true,
                                    logPhase: 'The Void Advances',
                                    condition: (state) => {if(state.mode != 'coop') return false; console.log('check about Crisis situation'); return true},
                                    subSteps: [
                                        {
                                            stepName: 'handle current situation',
                                            condition: (_) => get(state).crisis_board.current_alert && get(state).crisis_board.current_alert.type == 'situation',
                                            action: async (_) => {
                                                if(await transferCurrentCrisis(get(state).players[get(state).activePlayer])) pushUndo();
                                            }
                                        },
                                        {
                                            stepName: 'handle current war',
                                            condition: (_) => get(state).crisis_board.current_alert && get(state).crisis_board.current_alert.type == 'war',
                                            action: async (_) =>{
                                                await handleWar(get(state).players[get(state).activePlayer]);
                                                pushUndo();
                                            }
                                        }
                                    ]
                                },
                                {
                                    stepName: 'delayed effects',
                                    undoCheckpoint: true,
                                    condition: (state) => lo(state.galactic_board.current_event).delayed && state.turn.round == 1,
                                    action: async (_) => {
                                        let p = get(state).players[get(state).activePlayer];
                                        await executeActions(p, lo(get(state).galactic_board.current_event).delayed);
                                        pushUndo();
                                    }
                                },
                                {
                                    stepName: 'confirm round end',
                                    condition: (_) => get(state).strictMode,
                                    action: async (_) => {
                                        await pause('Click OK to confirm round end (you will not be able to undo)');
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            stepName: 'evaluation phase',
            iterations: (state) => state.players.length,
            turnMarker: true,
            pauseAfter: true,
            logPhase: 'Evaluation Phase',
            subSteps: [
                {
                    stepName: 'set current player for evaluation',
                    noTitle: true,
                    action: async (_) => { 
                        let i = get(state).turn_order.indexOf(get(state).activePlayer);
                        if(i == get(state).turn_order.length - 1){
                            // This is the first iteration, so set to first
                            i = 0;
                        }else{
                            // Move on to the next
                            i++;
                        }
                        state.update(s => {
                            s.activePlayer = get(state).turn_order[i];
                            return s;
                        })
                        // Possible placing of voidborn
                        if(ongoingGeneral().includes('voidborn_on_harbingers')){
                            let sectors = all('sectors', (s) => s.harbingers.length > 0);
                            for(let s of sectors){
                                await doAction(get(state).players[get(state).activePlayer], 'place_token', {place: s, type: 'voidborn'});
                            }
                        }
                    }
                },
                {
                    stepName: 'the voidborn strikes back',
                    minorSteps: 'true',
                    pauseAfter: true,
                    subSteps: [
                        {
                            stepName: 'skirmish',
                            logPhase: 'Skirmish',
                            condition: (state) => state.mode != 'coop' && !ongoingGeneral().includes('no_skirmish_or_crisis'),
                            action: async (s) => await resolveSkirmish(s.players[s.activePlayer], {inEvaluation: true})
                        },
                        {
                            stepName: 'crisis board',
                            logPhase: 'Resolving the Crisis Board',
                            condition: (state) => state.mode == 'coop' && !ongoingGeneral().includes('no_skirmish_or_crisis'), 
                            undoCheckpoint: true,
                            action: async (s) => {
                                await resolveCrisis(s.players[s.activePlayer], {inEvaluation: true});
                                pushUndo();
                            }
                        },
                    ]
                },
                {
                    stepName: 'upkeep',
                    saveBefore: true,
                    pauseAfter: true,
                    logPhase: 'Paying Upkeep',
                    action: async (s) => { 
                        let p = s.players[s.activePlayer];
                        await payUpkeep(p);
                        if(get(state).mode == 'coop'){
                            // Check for safe havens
                            let eligible = playerSectors(p).filter(s => !s.corrupted && s.population == 6 && guilds(s).length >= 3);
                            if(eligible.length > 0){
                                let num = Math.min(p.fleets.inactive.length + p.fleets.active.length + totalDeployed(p), eligible.length, totalHavenCapacity());
                                if(num > 0){
                                    log(`Eligible to add up to ${num} fleet to a Safe Haven`);
                                    await doAction(p, 'safe_haven', {num, message: `Click a [[safe_haven]] to add Inactive Fleet Power to it as a reward for your prosperous sectors`, confirm: true})
                                }
                                /*do{
                                    await choose(`Click a [[safe_haven]] to add Inactive Fleet Power to it as a reward for your prosperous sectors`, )
                                }while(num > 0 && !end)
                                if(num > 0) num = await pause(`You are eligible to add up to ${num} Inactive Fleet Power to a Safe Haven because of your ${eligible.length} sectors with 3 [[guild]] and 6 [[population]]. How much Inactive Fleet Power to commit to Safe Havens?`, {ranges: {safe_haven: {min: 0, max: num}}}); 
                                //num = await choose(`How much Inactive Fleet Power to commit to Safe Havens?`, choices);
                                if(num.safe_haven > 0) await doAction(p, 'safe_haven', {num: num.safe_haven});*/
                            }
                        }
                    }
                },
                {
                    stepName: 'galactic objectives',
                    undoCheckpoint: true,
                    saveBefore: true,
                    pauseAfter: true,
                    logPhase: 'Checking Galactic Objectives',
                    action: async (s) => { 
                        let c = s.galactic_board.current_event;
                        let p = s.players[s.activePlayer];
                        await resolveGalacticObjectives(p, c);
                        pushUndo();
                    }
                },
                {
                    stepName: 'score agendas',
                    logPhase: 'Scoring Agendas',
                    pauseAfter: true,
                    action: async (state) => { 
                        for(let p of state.players){
                            await doAction(p, 'score_agenda', {num: 'all'});
                        }
                    }
                },
                {
                    stepName: 'redraw discarded foci',
                    noTitle: true,
                    action: async (state) => { 
                        for(let p of state.players){
                            while(p.focus.discard.length > 0)
                            moveBitTo(p.focus.discard[0], p.focus.available);
                        }
                    }
                },
            ]
        }
    ]
};


let minorSteps = [];

let stepList = {};

function buildStepList(turns, breadcrumbs = null, parent = null){
    let last = parent;
    for(let t of turns){
        if(stepList[t.stepName]) throw 'exists!'
        stepList[t.stepName] = t;
        if(last != parent){
            console.log('adding next', last.stepName, t.stepName)
            last.next = t;
        }

        t.breadcrumbs = (state) => {
            let base = '';
            if(breadcrumbs) base = breadcrumbs(state);
            let bc = `${base}.${t.stepName}`;
            if(t.iterations) bc += `-${state.turn[t.stepName]}`
            return bc;
        }
        last = t;
        if(t.subSteps){
            buildStepList(t.subSteps, t.breadcrumbs, t);
        }
    }
    if(parent){
        turns[turns.length - 1].next = parent;
        turns[turns.length - 1].nextIsParent = true;
    }
}

buildStepList([turns]);

export async function takeTurns(){
    let t = turns;
    if(get(state).turnInfo && get(state).turnInfo.currentStep){
        t = stepList[get(state).turnInfo.currentStep];
    }else{
        state.update(s => {
            s.turnInfo = {
                currentStep: t.stepName,
                currentIteration: 1,
                maxIterations: {},
                breadcrumbs: ''
            }
            s.turn = {};
            return s;
        })
    }
    //await resetIterations(t, get(state));
    await startStep(t, get(state), true);
    
    for(; t; t = await nextStep(t, get(state))){
        let max = 1;
        let should = true;
        let s = get(state);
        if(t.hasOwnProperty('condition')){
            let shouldPossPromise = t.condition(s);
            if(shouldPossPromise instanceof Promise){
                should = await shouldPossPromise;
            }else{
                should = shouldPossPromise;
            }
        }
        if(!should) continue;
        if(t.undoCheckpoint) setupUndo();//checkUndo(t);

        let logPhase = t.logPhase;
        if(typeof t.logPhase == 'function') logPhase = t.logPhase();
        if(logPhase){
            let lastLog = get(state).log[get(state).log.length - 1];
            
            let logAdd = {
                type: 'phase',
                phase: t.stepName,
                text: logPhase,
                num: get(state).turnInfo.currentIteration
            };
            if(!lastLog || Object.keys(lastLog).some(k => lastLog[k] != logAdd[k])) logEvent(logAdd);
        }
        
        console.log(`In step ${t.stepName}, iteration ${get(state).turnInfo.currentIteration}`)
       
        if(t.announce && get(prefs).announcePhases && get(state).turnInfo.currentIteration < get(state).turnInfo.maxIterations[t.stepName]){
            await announce(`${upperInitial(t.stepName)} ${get(state).turnInfo.currentIteration}`)
        }
        if(t.hasOwnProperty('action')){
            if(possFunc(t.saveBefore, get(state))) {
                try{
                    await save();
                }catch(e){
                    console.log('Unable to save', e.message);
                }
               
            }
            try{
                let result = await t.action(get(state));
                if(result){
                    undoTo(result); // not await so that this ends?
                    return;
                }
            }catch(e){
                if(e == 'end_game'){
                    resetStores();
                    return;
                }else{
                    throw e;
                }
            }
            
            //await doActionPause();
            //console.log('action here!')
            if(t.confirmAtEnd && i == max){
                let message = `Press OK to continue`;
                if(typeof t.confirmAtEnd == 'string') message = t.confirmAtEnd;
                await pause(message); // And should also pause whenever handing over!
            }
            if(t.pauseAfter){
                await doActionPause();
            }
        }

    }
    await endGame();
}

export async function endGame(){
    state.update(s => {
        s.ended = true;
        return s;
    })
    //await pause('', {score: true, once: 'score', showResult: true, name:'Scoresheet', position: 'margin-top: 0;', dragHandleOnly: true,  style: 'z-index: 150;'}); // Show score results
    ui.update(ui => {
        ui.showing.Score = true;
        return ui;
    })
}

async function resetIterations(t, s){
    let num = 1;
    if(t.hasOwnProperty('iterations')){
        if(typeof t.iterations == 'function'){
            num = await t.iterations(s);
        }else{
            num = t.iterations;
        }
    }
    s.turnInfo.maxIterations[t.stepName] = num;
    s.turn[t.stepName] = 0;
}

async function startStep(t, s, reset){
    if(!t) return;
    if(reset) await resetIterations(t, s);
    s.turnInfo.currentStep = t.stepName;
    s.turn[t.stepName]++;
    s.turnInfo.currentIteration = s.turn[t.stepName]
    s.turnInfo.breadcrumbs = t.breadcrumbs(s);
    if(t.turnMarker){
        s.turnCache = {}; // for persistent caches for the whole turn
    }
    s.cache = {}; // No need to carry cache across any steps, I don't think
    if(s.turn[t.stepName] == 1){
        openReactions();
        checkTriggeredEffects('all', {verb: t.stepName}, 'beforePhase');
        await checkReactions();
    }
}

async function nextStep(t, s){
    //if(typeof t.next == 'function') return await t.next(state);
    //console.log('next from '+t.stepName+' '+s.turnInfo.currentIteration)
    //if(!s.turnInfo.maxIterations[t.stepName]) await resetIterations(t, s);
    if(t.subSteps){
        if(s.turnInfo.currentIteration <= s.turnInfo.maxIterations[t.stepName]){
            // move into substeps
            await startStep(t.subSteps[0], s, true);
            return t.subSteps[0];
        }else{
            // Move to next thing
            await startStep(t.next, s, !t.nextIsParent);
            return t.next;
        }
    }else{
        if(s.turnInfo.currentIteration < s.turnInfo.maxIterations[t.stepName] || t.finished && !await t.finished()){
            await startStep(t, s, false);
            return t;
        }else{
            
            await startStep(t.next, s, !t.nextIsParent);
            if(t.nextIsParent){
                if(s.turn[t.next] == s.turnInfo.maxIterations[t.next]){
                    return await nextStep(t.next, s);
                }
            }
            return t.next;
        }
    }
}

function populateMinorSteps(turns, minor = false){
    for(let t of [turns]){
        if(minorSteps.includes(t.stepName)) continue;
        if(minor && !t.hasOwnProperty('iterations') && !t.hasOwnProperty('noTitle')){
            t.noTitle = true;
        }
        if(t.noTitle) minorSteps.push(t.stepName);
        if(t.subSteps) populateMinorSteps(t.subSteps, t.minorSteps);
    }
}

export function diffTurn(t1, t2, listAll){
    if(!t1 || !t2) return false;
    if(JSON.stringify(t1) == JSON.stringify(t2)) return false;
    let diff = {};
    for(let k of Object.keys(t1)){
        if(!listAll && minorSteps.includes(t2)) continue; // Don't list
        if(!t2[k] && !t1[k]) continue; // ignore undefined results
        if(t2[k] != t1[k]){
            diff[k] = t2[k];
        }
    }
    if(Object.keys(diff).length == 0) return false;
    return diff;
}

export function formatTurn(state){
    let out = '';
    if(!state.turnInfo || !state.turnInfo.breadcrumbs) return '';
    for(let t of state.turnInfo.breadcrumbs.split('.')){
        let [step, num] = t.split('-');
        if(minorSteps.includes(step)) continue;
        out += `, ${upperInitial(step)}`;
        if(num) out += ` ${num}`;
    }
    //console.log(out, turns);
    return out.substring(4);
}

populateMinorSteps(turns.subSteps);
//console.log(minorSteps)


let lastSave;

export function sizeInK(obj, json = true){
    let ret;
    if(!json){
        ret = obj.length / 1024;
    }else{
        ret = JSON.stringify(obj).length / 1024;
    }
    if(ret > 1024){
        return `${(ret / 1024).toFixed(1)}MB`;
    }else{
        return `${ret.toFixed(1)}KB`;
    }
}

export async function showSize(size){
    if(!size) return;
    await pause(`<div>Overall size: ${size.all}</div>
    <div>State size: ${size.state}</div>
    <div>Log size: ${size.log} (${size.logEntries} entries)</div>
    <div>Undos size: ${size.undos} (${size.undoEntries} entries)</div>`);
    
}

export function makeSaveKey(state){
   if(uid) return  `${state.playTimes[0].start}-${state.players[0].house}-${uid}`;
   return `${state.playTimes[0].start}-${state.players[0].house}`;
}

export async function save(){
   //let saving = jsonpatch.deepClone(get(state)); // To stop further updates
   let playTimes = jsonpatch.deepClone(get(state).playTimes);
   playTimes.slice(-1)[0].end = Date.now();
   let saving = /*jsonpatch.deepClone({
    ...get(state),
    playTimes
   });*/
   {
    ...get(state),
    playTimes
   }
   
   let resToSave = {...get(res)};
   /*jsonpatch.deepClone({
    ...get(res)
   });*/
   if(get(prefs).maxUndos != -1){
    // Trim to last few
        resToSave.undos = resToSave.undos.slice(0, get(prefs).maxUndos);//slice(0 - get(prefs).maxUndos);
   }
   let compressed = false;
   let undoEntries =  resToSave.undos.length;
   if(get(prefs).compressSave){
     ///
     //let preSize = JSON.stringify(resToSave.undos).length;
     
     compressed = true;
     resToSave.undos = pako.deflate(JSON.stringify(resToSave.undos));
     //let postSize = resToSave.undos.length;
     //console.log(`compressed size ${postSize}, uncompressed ${preSize} (${(postSize/preSize*100).toFixed(1)}%)`);
   }
   let toSave = {
    time: Date.now(),
    state: saving,
    prefs: get(prefs),
    res: resToSave,
    completed: 0,
    compressed
   };

   toSave.saveKey = makeSaveKey(toSave.state)

  

   console.log(toSave);
   /*let sizes = {
    state: sizeInK(toSave.state),
    log: sizeInK(toSave.state.log),
    undos: sizeInK(toSave.res.undos, false),
    logEntries: toSave.state.log.length,
    undoEntries
   };
   sizes.all = Object.keys(sizes).reduce((a, k) => a + parseFloat(sizes[k]), 0).toFixed(0);
   state.update(s => {
    s.sizes = sizes;
    return s;
   })*/
   let turnInfo = `Cycle ${toSave.state.turn.cycle}${toSave.state.turn.round ? `, Round ${toSave.state.turn.round}` : ''} (${totalGameTime(toSave.state).minutes} mins play)`
   let entry = {
        time: toSave.time,
        house: toSave.state.players[0].house,
        scenario: toSave.state.scenario,
        started: toSave.state.playTimes[0].start,
        turnInfo,
        saveKey: toSave.saveKey,
        completed: 0,
        uploaded: 0
   }

   //spotNonClonable(entry, 'entry');
   //spotNonClonable(toSave, 'toSave');

   await dex.games.put(entry);
   await dex.fullGames.put(toSave);
   /*let seq = await getLastSave();//.then((seq) => {
    let rep = seq.findIndex(s => s.saveKey == toSave.saveKey);
    if(rep != -1){
        seq[rep] = entry;
    }else{
        seq.push(entry);
    }
    lastSave = seq;
    await setMany([
        [toSave.saveKey, toSave],
        ['autosave', seq]
    ]);
   // set('autosave', seq);
   //})*/
}

export async function getLastSave(){
    if(lastSave) return lastSave;
    return await getSavedGames();
}

export async function getSavedGames(){
    return dex.games.where({completed: 0});
    /*
    let saved = await IDBget('autosave');
    if(!saved) return [];
    let arr = possArray(saved);
    if(arr.length > 0 && !arr[0].saveKey) arr = await convertToNewSave(arr);
    return arr;*/
}
/*
export async function convertToNewSave(save){
    let newMaster = [];
    let savePairs = [];
    for(let s of save){
        let turnInfo = `Cycle ${s.state.turn.cycle}, ${s.state.turn.round ? `, Round ${s.state.turn.round}` : ''} (${totalGameTime(s.state).minutes} mins play)`
        let add = {
            time: s.time,
            house: s.state.players[0].house,
            turnInfo,
            saveKey: `${s.state.playTimes ? s.state.playTimes[0].start : '0'}-${s.state.players[0].house}`
        };
        newMaster.push(add);
        savePairs.push([add.saveKey, s]);
    }
    savePairs.push(['autosave', newMaster]);
    await setMany(savePairs);
    return newMaster;
}*/

export async function deleteSave(saved, shouldConfirm = true){
    if(shouldConfirm && !confirm('Really delete this save?')) return;

    await dex.games.delete(saved.saveKey);
    await dex.fullGames.delete(saved.saveKey);

    return dex.games.toArray();
    /*

    let seq = await getLastSave();
    let i = seq.findIndex(save => save.saveKey == saved.saveKey); 
    if(i != -1) seq = [...seq.slice(0, i), ...seq.slice(i+1)];
    await del(saved.saveKey);
    await set('autosave', seq);
    return seq;*/
}

export async function load(saved){
   //saved = await IDBget(saved.saveKey);
    saved = await dex.fullGames.get(saved.saveKey);
    state.update(s => {
        s = saved.state;
        if(!s.playTimes) s.playTimes = [];
        s.playTimes.push({
            start: Date.now()
        });
       
        return s;
    })
    console.log(get(state));
    res.update(r => {
        
        r = saved.res;
        if(saved.compressed){
            r.undos = JSON.parse(pako.inflate(r.undos, {to: 'string'}));
        }
        return r;
    })
    console.log(saved.prefs);
    if(saved.prefs){
        prefs.update(p => {
            p = saved.prefs;
            p.noVSReset = true;
            return p;
        })
    }
    beforeResume();
    ui.update(ui => {
        ui.tab = 'play';
        ui.sectorImages = {};
        for(let s of getSectorList(get(state).sectors)){
            ui.sectorImages[s.id] = getBGImage(s);
        }
        
        return ui;
    })
    doActionPause().then(() => takeTurns());
}

export function beforeResume(){
    if(!get(prefs).noVSReset) setViewScale();
    ui.update(ui => {
        ui.sectorImages = {};
        for(let s of getSectorList(get(state).sectors)){
            ui.sectorImages[s.id] = getBGImage(s);
        }
        return ui;
    })

    // !!Cleanup for corrupt map
    state.update(s => {
        if(s.sectors['undefined-undefined']){
            delete s.sectors['undefined-undefined'];
            if(s.bigList) delete s.bigList["sectors.undefined-undefined"];
        }
        return s;
    })
}

export function exitEarly(toStep){
    state.update(s => {
        if(!s.turnInfo) s.turnInfo = {};
        s.turnInfo.exitEarly = toStep;
        return s;
    })
}

export function totalGameTime(s = get(state)){
    let cumulative = 0;
    if(!s.playTimes) return {minutes: 0, seconds: 0}
    for(let p of s.playTimes){
        let end = p.end || Date.now();
        cumulative += (end - p.start) / 1000;
    }
    let breakdown = {
        minutes: Math.floor(cumulative / 60),
        seconds: Math.floor(cumulative % 60)
    }
    return breakdown;
}