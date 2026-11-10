// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { state, ui } from './stores.js';
import { get } from './runtime.js';
import { pause, upperInitial } from './ui.js';
import { at, isLo, lo, ol, possArray } from './utils.js';
import { log } from './game.js';
import * as jsonpatch from './runtime.js';
import { galacticEvents } from './events.js';
import { voidbornScore } from './crisis.js';
import { getTechName, techs } from './techs.js';
import { house } from './houses.js';

export function consolidateScores(games){
    let consolidated = {};
    for(let g of games){
        for(let s of g.scoringInfo.sources){
            if(!consolidated[s.source]){
                consolidated[s.source] = {
                    gameCount: 0,
                    total: [],
                    byCycle: [[], [], []],
                    max: 0,
                    min: Infinity
                };
            }
            consolidated[s.source].total.push(s.total)
            if(s.total > consolidated[s.source].max) consolidated[s.source].max = s.total;
            if(s.total < consolidated[s.source].min) consolidated[s.source].min = s.total;
            consolidated[s.source].gameCount++;
            for(let i = 0; i < s.byCycle.length; i++){
                // scoreEvents grows byCycle past 3 when a game logs a cycle above 3,
                // so make the bucket on demand rather than assuming the three-cycle init.
                let bucket = consolidated[s.source].byCycle[i];
                if(!bucket) bucket = consolidated[s.source].byCycle[i] = []; // ||= is ES2021; rollup 1.x/acorn here can't parse it
                bucket.push(s.byCycle[i]);
            }
        }
    }
    //console.log(consolidated);
    return consolidated;
}

export function consolidateStats(games){
    let consolidated = {};
    for(let k of Object.keys(games)){
        let g = games[k];
        for(let k of Object.keys(g.stats)){
            joinUpStat(consolidated, g.stats, k);
        }
    }
    return consolidated;
}

export function joinUpStat(master, obj, key){
    if(!obj.hasOwnProperty(key)) return;
    if(!master[key]){
        master[key] = jsonpatch.deepClone(obj[key]);
    }else{
        if(Array.isArray(master[key])){
            master[key].push(...obj[key]);
        }else if(typeof master[key] == 'number'){
            master[key] += obj[key];
        }else if(typeof master[key] == 'object'){
            for(let k of Object.keys(master[key])){
                joinUpStat(master[key], obj[key], k);
            }
        }else{
            console.log('Not sure what to do', master, obj, key)
        }
    }
}

function playerTechs(g){
    let baseIDs = [];
    let improvedIDs = [];
    let h = Object.keys(g.stats).find(k => k != 'allPlayers')
    let side = g.sides[h];
    let starterTech = house({house: h}).techs[['A','B'].indexOf(side)];
    baseIDs.push(techs.find(t => t.name == starterTech).id);
     
    for(let k of Object.keys(g.stats[h].techGained)){
        for(let t of g.stats[h].techGained[k]){
            if(!baseIDs.includes(t)) baseIDs.push(t);
        }
    }
    for(let k of Object.keys(g.stats[h].techImproved)){
        for(let t of g.stats[h].techImproved[k]){
            if(!improvedIDs.includes(t)) improvedIDs.push(t);
        }
    }
    improvedIDs = improvedIDs.map(t => getTechName(t));
    baseIDs = baseIDs.map(t => getTechName(t)).filter(b => !improvedIDs.includes(b));
    return [...improvedIDs.map(i => `Improved ${i}`), ...baseIDs];
}

export async function exportBGGSummary(g){
    let summary = g.summary;
    let crisisInfo = g.crisisInfo;
    //let summary = gameSummary(state.log);
    let events = [];
    let cycles = [];
    let crises = [];
    let i = 0;

    if(g.mode == 'coop'){
        for(let c of crisisInfo.filter(c => c.type != 'overview').sort((a,b) => {
            if(a.entered.cycle != b.entered.cycle) return a.entered.cycle - b.entered.cycle;
            if(a.entered.round != b.entered.round) return a.entered.round - b.entered.round;
            return 0;
        })){
            if(c.via == 'trigger') crises.push(`[color=green]${lo({id: c.id, lo: 1}).name}[/color]`);
            if(c.via == 'discard_effect') crises.push(`[color=blue]${lo({id: c.id}).name}[/color]`);
            if(c.via == 'action') crises.push(`[i][color=green]${lo({id: c.id}).name}[/color][/i]`);
            if(c.via == 'catastrophe') crises.push(`[color=red]${lo({id: c.id}).name}[/color]`)
            if(c.type != 'overview' && !c.left) crises.push(`[b]${lo({id: c.id}).name}[/b]`)
        }
    }
    

    for(let c of summary){
        i++;
        let e = lo({id: c.event, lo: 1});
        events.push(`${e.ref}. ${c.eventName} (${e.rounds})`);
        let rounds = [];
        
        
        for(let f of c.cards){
            let actions = [];
            for(let a of f.actions){
                if(a.action){
                    actions.push(a.action.split('.').slice(-1)[0]);
                }else if(a.boost){
                    let source = lo({id: a.boost, lo: 1}) || at(a.boost);
                    let alternative = a.name.replace('[[basic_tech]] ', '').replace('[[improved_tech]] ', 'Improved ');
                    let cuts = ['<', '[', ':'];
                    let i = Math.min(...cuts.map(c => alternative.indexOf(c)).filter(i => i > 0));
                    if(i != -1) alternative = alternative.slice(0, i);
                    if(source && source.name) alternative = source.name;
                    let name = a.label || alternative;
                    //actions.push(`${a.name.replace(/\[\]/g, '')} boost`);
                    actions.push(`${name} boost`);
                }else if(a.agenda){
                    actions.push('agenda action')
                }
            }
            rounds.push(`[u]${f.name}${f.agenda ? ` (with agenda ${f.agenda.name})` : ''}${f.usedTrade ? ' + trade token' : ''}[/u]: ${actions.join(', ')}`);
        }
        cycles.push(`[i]Cycle ${i}: ${c.eventName}[/i]\n${rounds.join('\n')}\n${c.objectivesMet ? `${c.objectivesMet.length} objective${c.objectivesMet.length != 1 ? 's' : ''} met` : ''}`);
    }
    
    let bgg = 
`[b]Difficulty level:[/b] ${upperInitial(g.difficulty)}
[b]Events drawn:[/b] ${events.join(', ')}
[b]Score:[/b] ${scoreDelta(g)} (${g.scores[Object.keys(g.scores).find(s => s != 'voidborn')]} - ${g.scores.voidborn})
[b]Techs at game end:[/b] ${playerTechs(g).join(', ')}
${crises.length > 0 ? `[b]Crises:[/b] (resolved by [color=green]trigger[/color], [i][color=green]card action[/color][/i], [color=blue]discard effect[/color], [color=red]Catastrophe[/color], [b]or left unresolved[/b])
${crises.join(', ')}` : ''}

[b]Full breakdown:[/b]
${cycles.join('\n\n')}
`;

 await navigator.clipboard.writeText(bgg);
 alert('BGG summary copied to clipboard!');
}

export function scoreDelta(g){
    let humanHouse = Object.keys(g.scores).find(k => k != 'voidborn');
    return g.scores[humanHouse] - g.scores.voidborn;
}

export function gameSummary(log){
    let focusCards = [];
    let currentFocus;
    let events = [];
    for(let l of log){
        if(l.event){
            events.push({
                ...l
            });
        }
        if(l.focus){
            if(currentFocus) focusCards.push(currentFocus);
            currentFocus = {
                id: l.focus,
                name: l.focusName,
                actions: [],
                turn: l.turn
            }
        }else if(l.objectivesMet){
            let e = events[events.length - 1];
            e.objectivesMet = l.objectivesMet;
            if(l.objectiveTaken){
             e.objectiveTaken = l.objectiveTaken;
            }
        }else if(!currentFocus){
            continue;
        }else if(l.usedTrade){
            currentFocus.usedTrade = l.usedTrade;
        }else if(l.focusAction){
            currentFocus.actions.push({
                action: l.focusAction
            })
        }else if(l.focusBoost){
            currentFocus.actions.push({
                boost: l.focusBoost,
                label: l.boostLabel || 0,
                name: l.boostName
            })
        }else if(l.agendaAction){
            currentFocus.actions.push({
                agenda: l.agendaAction,
                name: l.agendaName
            })
        }else if(l.agendaPlayed){
            currentFocus.agenda = {
                id: l.agendaPlayed,
                name: lo(at(l.agendaPlayed)).name
            }
        }
    }

    if(currentFocus) focusCards.push(currentFocus);
    let cycles = [];
    let currentCycleNum = 0;
    let currentCycle;
    for(let f of focusCards){
        if(f.turn.cycle > currentCycleNum){
            currentCycleNum = f.turn.cycle;
            if(currentCycle) cycles.push(currentCycle);
            currentCycle = {
                num: currentCycleNum,
                cards: [],
                ...events.shift()
            }
            console.log(currentCycle)
        }
        currentCycle.cards.push(f);

        let checkedCards = [];
        
        for(let c of currentCycle.cards){
            // Weed out empty duplicates
            if(c.actions.length == 0 && currentCycle.cards.some(card => card != c && card.id == c.id)) continue;
            checkedCards.push(c);
        }
        currentCycle.cards = checkedCards;
    }
    if(currentCycle) cycles.push(currentCycle);
    console.log(cycles);

    // Counts of foci
    return cycles;
}

export function scoreSummary(log){
    let scoreEvents = log.filter(l => l.verb == 'gain_influence');
    let types = {};
    let sources = {};
    console.log(scoreEvents);
    for(let e of scoreEvents){
        let from = e.params.from || 'unknown';
        if(!types[from]) types[from] = {
            byCycle: [0,0,0],
            total: 0
        }
        types[from].total += e.params.num;
        types[from].byCycle[e.turn.cycle - 1] += e.params.num;
        if(e.params.source){
            if(!sources[e.params.source]) sources[e.params.source] = {
                byCycle: [0, 0, 0],
                total: 0
            }
            sources[e.params.source].total += e.params.num;
            sources[e.params.source].byCycle[e.turn.cycle - 1] += e.params.num;
        }
    }
    return {
        types: Object.keys(types).map(t => { return {type: t, ...types[t]}}),
        sources: Object.keys(sources).map(s => { return {source: s, ...sources[s]}})
    }
}

export function crisisSummary(log){
    let crisisCards = {};
    let rounds = {};
    let viaTypes = {};
    let numPerRound = {};
    let rawRound = 0;
    for(let l of log){
        if(l.alert){
            // Just to get round count – TODO a smoother way to get to this
            if(!rounds[l.turn.cycle]) rounds[l.turn.cycle] = 0;
            if(l.turn.round > rounds[l.turn.cycle]){
                rounds[l.turn.cycle] = l.turn.round;
                rawRound++;
            }
        }
        if(!l.crisis) continue;
        if(l.crisis_added){
            crisisCards[l.crisis] = {
                entered: {
                    cycle: 0,
                    round: 0,
                    ...l.turn,
                    rawRound
                }
            }
        }
        if(l.crisis_removed){
            crisisCards[l.crisis] = {
                ...crisisCards[l.crisis],
                left: {
                    cycle: 0,
                    round: 0,
                    ...l.turn,
                    rawRound
                },
               
                via: l.via
            }
            if(crisisCards[l.crisis].entered) crisisCards[l.crisis].duration = rawRound - crisisCards[l.crisis].entered.rawRound;
            if(!viaTypes[l.via]) viaTypes[l.via] = 0;
            viaTypes[l.via]++;
            if(!numPerRound[`${l.turn.cycle}-${l.turn.round}`]) numPerRound[`${l.turn.cycle}-${l.turn.round}`] = 0;
            numPerRound[`${l.turn.cycle}-${l.turn.round}`]++;
        }
    }
    let ret = [];
    for(let k of Object.keys(crisisCards)){
        ret.push({
            id: k,
            name: lo(at(k)).name,
            ...crisisCards[k]
        });
    }

    let perRound = [];
    for(let k of Object.keys(numPerRound)){
        perRound.push({
            round: k,
            num: numPerRound[k]
        })
    }
    perRound = perRound.sort((a,b) => b.num - a.num)
    ret.push({
        type: 'overview',
        viaTypes,
        perRound,
        unresolved: ret.filter(c => !c.left).length
    })
    //console.log(ret, $state.log.filter(l => l.crisis));
    return ret;
}

export async function scoreStats(p){
    let scoreEvents = get(state).log.filter(l => l.verb == 'gain_influence' && l.p == p.house);
    let withSources = scoreEvents.filter(e => e.source);
    let sources = Array.from(new Set(withSources.map(e => e.source)));
    let specificEffects = Array.from(new Set(withSources.filter(e => e.effectName).map(e => e.effectName)));
    let breakdown = {
        sources: {},
        specificEffects: {}
    }
    for(let s of sources){
        let name;
        if(lo({lo: s})){
            name = lo({lo: s}).name;
        }
        if(!name){
            console.log('No name found for '+s);
            name = s;
        }
        breakdown.sources[name] = withSources.filter(e => e.source == s).reduce((a, c) => a + c.num, 0);
        // !!! TODO Do by cycle soon
    }
    for(let s of specificEffects){
        breakdown.specificEffects[s] = withSources.filter(e => e.effectName == s).reduce((a, c) => a + c.num, 0);
    }
    console.log('Score breakdown', get(state).log, breakdown);
    //await pause('', {score: true, once: 'score', showResult: false, name:'Scoresheet', position: 'margin-top: 0;', dragHandleOnly: true, style: 'z-index: 150;'}); // Show score results
    ui.update(ui => {
        ui.showing.Score = true;
        return ui;
    })
}

export function totalRounds(g){
    let total = 0;
    for(let i = 0; i < g.summary.length; i++){
        let event = lo({id: g.summary[i].event, lo: 1});
        total += event.rounds;
    }
    return total;
}

export function logAvailable(obj){
    if(!obj) return;
    if(Array.isArray(obj)){
        obj.flatMap(o => logAvailable(o));
        return;
    }
    //if(obj.lo) obj = lo(obj);
    if(obj.id && isLo(obj)) obj = ol(obj);
    if(get(state).available[obj.neutralID || obj.id]) return;
    state.update(s => {
        s.available[obj.neutralID || obj.id] = s.turnInfo.rawRound || 0;
        return s;
    })
}

export function compileStats(log){
    let compiled = {
        allPlayers: {}
    };
    let exclude = ['type', 'turn', 'turnInfo', 'currentAction', 'currentFocus', 'p']
    for(let l of log){
        if(l.type != 'stats') continue;
        let places = ['allPlayers'];
        if(l.p && l.p != -1) places.push(l.p);
        for(let loc  of places){
            if(!compiled[loc]) compiled[loc] = {};
            let toAdd = compiled[loc];
            for(let k of Object.keys(l).filter(k => !exclude.includes(k))){
                if(!toAdd[k]) toAdd[k] = {
                    all: []/*,
                    byCycle: [[], [], []],
                    byRawRound: []*/
                }
                toAdd[k].all.push(...possArray(l[k], false));
                let cycle = l.turn.cycle || 1;
                if(!toAdd[k][`cycle_${cycle}`]) toAdd[k][`cycle_${cycle}`] = [];
                toAdd[k][`cycle_${cycle}`].push(...possArray(l[k], false))
                //toAdd[k].byCycle[cycle - 1].push(...possArray(l[k]));
                let rawRound = l.turnInfo.rawRound || 0;
                if(!toAdd[k][`round_${rawRound}`]) toAdd[k][`round_${rawRound}`] = [];
                toAdd[k][`round_${rawRound}`].push(...possArray(l[k], false));
                /*if(!toAdd[k].byRawRound[rawRound]) toAdd[k].byRawRound[rawRound] = [];
                toAdd[k].byRawRound[rawRound].push(...possArray(l[k]));*/
            }
        }
        
    }
    console.log('Compiled stats', compiled);
    return compiled;
}