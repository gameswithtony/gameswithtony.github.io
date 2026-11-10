// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { state, playerColours } from "./stores.js";
import { get } from './runtime.js';
import { isIn, moveBitTo, randomIndex, shuffle } from "./utils.js";
import { fleetTypes, moveFleet } from "./fleets.js";
import { executeActions, getReadableDescription } from "./game.js";
import { choose, pause } from "./ui.js";
import { hasTech } from "./techs.js";
//import { warCards } from "./crisis.js";
import * as jsonpatch from './runtime.js';

let guilds = ['farmers', 'miners', 'engineers', 'scientists', 'bankers'].map(g => `${g}_guild`)
let installations = ['shipyard', 'defense', 'starbase'];
let gloryTypes = ['glory1', 'glory2', 'glory3', 'glory4', 'glory5']

//export let genericTokens = [];

let bountyTypes = [
    [5, 'bounty_2f1i', 'food_2', 'influence_1'],
    [5, 'bounty_1fe1i', 'food+energy', 'influence_1'],
    [2, 'bounty_1fs1i', 'food+science', 'influence_1'],
    [8, 'bounty_any', 'any'],
    [5, 'bounty_2m1i', 'materials_2', 'influence_1'],
    [5, 'bounty_1fm1i', 'food+materials', 'influence_1'],
    [2, 'bounty_1es1i', 'energy+science', 'influence_1'],
    [4, 'bounty_1si', 'science/influence'],
    [5, 'bounty_2e1i', 'energy_2', 'influence'],
    [5, 'bounty_1me1i', 'energy+materials', 'influence'],
    [2, 'bounty_1ms1i', 'materials+science', 'influence']
]

let reclaimTypes = [
    {
        either_or: [
            'activate',
            {
                verb: 'deploy',
                num: 1,
                restriction: 'same_sector'
            }
        ]
    },
    {
        either_or: [
            {
                verb: 'build',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    },
    {
        either_or: [
            {
                verb: 'establish',
                type: 'scientists_guild',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    },
    [
        {
            verb: 'build',
            type: 'defense',
            restriction: 'same_sector'
        },
        {
            verb: 'gain_influence',
            num: 2,
            from: 'reclaim'
        }
    ],
    {
        either_or: [
            {
                verb: 'establish',
                type: 'farmers_guild',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    },
    {
        either_or: [
            {
                verb: 'establish',
                type: 'miners_guild',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    },
    {
        verb: 'gain_influence',
        num: 4,
        pause: true,
        from: 'reclaim'
    },
    {
        either_or: [
            {
                verb: 'establish',
                type: 'bankers_guild',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    },
    {
        either_or: [
            {
                verb: 'establish',
                type: 'engineers_guild',
                restriction: 'same_sector'
            },
            {
                verb: 'gain_resource',
                num: 1
            }
        ]
    }
]




export function allTokens(s){
    let all = [];
    if(s.bounty) all = [...all, ...s.bounty];
    if(s.reclaim) all = [...all, ...s.reclaim];
    return all;
}

export function setupTokens(scenario){

    // First setup unlimited

    state.update(s => {
        for(let t of [...guilds, ...installations, 'fleet_voidborn', ...gloryTypes, ...fleetTypes, 'corruption', /*'alert_cards.1', 'alert_cards.2', 'alert_cards.3'*/]){
            s.unlimited_tokens[t] = {
                type: t,
                value: t,
                currentInc: 0
            };
            if(s.unlimited_tokens[t].type.startsWith('glory')) s.unlimited_tokens[t].value = parseInt(s.unlimited_tokens[t].type.slice(5));
            if(s.unlimited_tokens[t].type == 'fleet_voidborn') s.unlimited_tokens[t].value = 'voidborn';
            if(s.unlimited_tokens[t].type.startsWith('alert_cards')) s.unlimited_tokens[t].value = parseInt(s.unlimited_tokens[t].type.slice('alert_cards.'.length));
        }
        return s;
    })

    let numHarbingers = 50;
    if(scenario.players == 1  && scenario.type == 'coop'){
        numHarbingers = 7;
    }
    fillTokens('harbinger', numHarbingers, 'harbinger');

    // War cards and alert cards
   /* for(let w of warCards){
        fillTokens(`alert_cards.${w.ref}`, 1, {...w});
    }*/

    
    /* NOT NEEDED NOW UNLIMITED
    let numGlory = 20;
    for(let i = 1; i < 6; i++){
        fillTokens(`glory${i}`, numGlory, i);
    }*/

    // Below temporary for now – distributions later
    /*fillTokens('bounty', 48, {
        energy: 1,
        materials: 3
    })*/

    for(let c of playerColours){
        fillTokens(`fleet_${c}`, 14, c);
    }

    let numTradeTokens = {
        1: 5,
        2: 6,
        3: 10,
        4: 12
    }

     /* NOT NEEDED NOW UNLIMITED
    fillTokens(`fleet_voidborn`, 40, `voidborn`);
    */ 

    /*for(let t of fleetTypes){
        fillTokens(t, 20, t); // !! TODO could restrict to tech types
    }*/
    fillTokens('trade', numTradeTokens[scenario.players], 'trade');
    fillTokens('catastrophe', 3);

    /* NOT NEEDED NOW UNLIMITEDfor(let t of [...guilds, ...installations, 'corruption']){
        console.log(t)
        fillTokens(t, 60, t);
    }*/

    let i = 1;
    for(let r of reclaimTypes){
        let tok = {
            effect: r,
            flipped: false,
            img: `reclaim_${i}`
        };
        fillTokens('reclaim', 3, tok, i, true, true);
        i++;
    }

    i = 1;
    for(let t of jsonpatch.deepClone(bountyTypes)){
        let count = t.shift();
        let img = t.shift();
        let effect = [];
        let tok = {
            effect,
            flipped: false,
            img
        };
        let options = t;
        if(options.length > 1) {
            tok.effect = {};
            tok.effect.either_or = [];
            effect = tok.effect.either_or;
        }
        for(let o of options){
            let num = 1;
            if(o.includes('_')){
                [o, num] = o.split('_');
                num = parseInt(num);
            }
            if(o == 'any'){
                effect.push({
                    verb: 'gain_resource',
                    showSource: true,
                    num
                })
                continue;
            }
            if(o == 'influence'){
                effect.push({
                    verb: 'gain_influence',
                    num,
                    from: 'bounty'
                })
                continue;
            }
            if(o.includes('+')){
                let types = o.split('+');
                let res = {};
                for(let t of types){
                    res[t] = num;
                }
                effect.push({
                    verb: 'gain_resource',
                    types: res
                })
                continue;
            }
            if(o.includes('/')){
                for(let r of o.split('/')){
                    if(r == 'influence'){
                        effect.push({
                            verb: 'gain_influence',
                            type: r,
                            from: 'bounty',
                            num
                        })
                    }else{
                        effect.push({
                            verb: 'gain_resource',
                            type: r,
                            num
                        })
                    }
                    
                }
                continue;
            }
            effect.push({
                verb: 'gain_resource',
                type: o,
                num
            })
        }
        fillTokens('bounty', count, tok, i++, true, true);
    }
}

function fillTokens(type, num, value = false, prefix = null, shuffleEm = false, hasDiscard = false){
    for(let i = 0; i < num; i++){
        genNewToken(type, i, value, true, prefix);
    }
    
    state.update(s => {
        if(shuffleEm) shuffle(s.spare_tokens[type]); 
        if(hasDiscard) s.discard_tokens[type] = [];
        return s;
    })
}

function genNewToken(type, i, value, add, prefix = false){
    let id = `${type}_${i}`;
    if(prefix) id = `${type}_${prefix}-${i}`
    let tok = jsonpatch.deepClone({id, value});
    
    state.update(s => {
        if(!s.spare_tokens[type]) s.spare_tokens[type] = [];
        if(add) s.spare_tokens[type].unshift(tok);
        s.genericTokens.push(`${type}_${i}`);
        return s;
    })
    return tok;
}

export function takeToken(type){
    // NB can only be run before makeList()
    if(get(state).unlimited_tokens[type]){
        let inc = get(state).unlimited_tokens[type].currentInc;
        let newToken = genNewToken(type, inc, get(state).unlimited_tokens[type].value, false);
        state.update(s => {
            s.unlimited_tokens[type].currentInc++;
            return s;
        })
        //console.log('generated token', newToken)
        return newToken;
    }else if(get(state).spare_tokens[type] && get(state).spare_tokens[type].length > 0){
        let len = get(state).spare_tokens[type].length;
        let tok = get(state).spare_tokens[type][len - 1];
        //console.log('found token', tok)
        state.update(s => {
            s.spare_tokens[type] = s.spare_tokens[type].slice(0, -1);
            return s;
        })
        return tok;
    } else if(get(state).discard_tokens.hasOwnProperty(type) && get(state).discard_tokens[type].length > 0){
        state.update(s => {
            shuffle(s.discard_tokens[type]);
            s.spare_tokens[type] = [...s.discard_tokens[type]];
            s.discard_tokens[type] = [];
            return s;
        })
        let len = get(state).spare_tokens[type].length;
        let tok = get(state).spare_tokens[type][len - 1];
        //console.log('found token', tok)
        state.update(s => {
            s.spare_tokens[type] = s.spare_tokens[type].slice(0, -1);
            return s;
        })
        return tok;
    }
    return false;
}

//let finiteTypes = ['trade']

export function topToken(type){
    console.log(get(state).spare_tokens);
    if(get(state).unlimited_tokens[type] && (!get(state).spare_tokens[type] || get(state).spare_tokens[type].length == 0)){
        let inc = get(state).unlimited_tokens[type].currentInc;
        let newToken = genNewToken(type, inc, get(state).unlimited_tokens[type].value, false);
        state.update(s => {
            s.unlimited_tokens[type].currentInc++;
            return s;
        })
        
        moveBitTo(newToken, get(state).spare_tokens[type]);
        return newToken;
    }else if(get(state).spare_tokens[type] && get(state).spare_tokens[type].length > 0){
        let len = get(state).spare_tokens[type].length;
        return get(state).spare_tokens[type][len - 1];
    }else if(get(state).discard_tokens.hasOwnProperty(type) && get(state).discard_tokens[type].length > 0){
        state.update(s => {
            shuffle(get(state).discard_tokens[type]);
            s.spare_tokens[type] = [...s.discard_tokens[type]];
            s.discard_tokens[type] = [];
            return s;
        })
        assembleList(get(state).spare_tokens, get(state), 'spare_tokens', 'state.spare_tokens', true);
        assembleList(get(state).discard_tokens, get(state), 'discard_tokens', 'state.discard_tokens', true);
        let len = get(state).spare_tokens[type].length;
        return get(state).spare_tokens[type][len - 1];
    }
    return false; // Or make more??
}

export function tokenOwner(tok){
    if(!isIn(tok, 'state.players')) return -1;
    let i = parseInt(bl(tok).address.split('.')[2]); // This will be the player number
    return get(state).players[i];
}

export function putTradeOnBoard(tok){
    // Basically get highest index that is empty or not full if array
    let list = get(state).galactic_board.trade_tokens;
    for(let i = 0; i < list.length; i++){
        if(!list[i]){
            moveBitTo(tok, list, i);
            return;
        }
        if(Array.isArray(list[i]) && list[i].length < 2){
            moveBitTo(tok, list[i]);
            return;
        }
    }
    moveBitTo(tok, list); // At end
    //throw 'Nowhere to put trade token!'
}

export async function returnToken(tok, p = null){
    if(tok.value == 'trade' && p){
        putTradeOnBoard(tok);
        //moveBitTo(tok, get(state).galactic_board.trade_tokens, bottomTradeIndex()+1); // TODO for multiplayer
        if(hasTech(p, 'Trade Nexus')){
            await getTradeBenefit(p);
        }
    }else{
        let randomTypes = ['bounty', 'reclaim'];
        let i = 0;
        let type = tok.id.split('_').slice(0, -1).join('_');
        if(get(state).discard_tokens.hasOwnProperty(type)){
            moveBitTo(tok, get(state).discard_tokens[type]);
        }else{
            if(randomTypes.includes(type)) i = randomIndex(get(state).spare_tokens[type]);
            moveBitTo(tok, get(state).spare_tokens[type], i);
        }
    }
}

let tradeBenefits = [
    {
        verb: 'gain_influence',
        num: 3,
        from: 'trade'
    },
    'activate',
    {
        either_or: [
            {
                verb: 'gain_resource',
                type: 'credits',
                num: 2
            },
            {
                verb: 'gain_resource',
                type: 'science',
                num: 2
            },
        ]
    },
    {
        verb: 'gain_resource',
        num: 2,
        available: ['food', 'energy', 'materials']
    },
    'gain_bounty',
    {
        verb: 'gain_resource',
        type: 'science'
    }
]

export async function takeTrade(p, benefits = true){
    let i = bottomTradeIndex();
    if(i == -1){
        await pause('No trade tokens left on board: so no benefit');
        return;
    }
    
    moveBitTo(bottomTrade(), p.loose_trade);
    
    // Then see what abilities are available based on positioning
    if(benefits) await getTradeBenefit(p, i);
}


export async function getTradeBenefit(p, i = -1){
    // 
    if(i == -1) i = bottomTradeIndex(); // 
    let possibleBenefits = tradeBenefits.slice(i);
    let effect = possibleBenefits[0];
    if(possibleBenefits.length > 1){
        effect = {
            either_or: possibleBenefits
        }
    }
    await executeActions(p, effect);
}

export function bottomTradeIndex(){
    let s = get(state);
    let tok;
    let i;
    for(i = s.galactic_board.trade_tokens.length - 1; i >= 0; i--){
        tok = s.galactic_board.trade_tokens[i];
        if(Array.isArray(tok) && tok.length > 0) tok = tok[0];
        if(tok) break;
    }
    if(tok) return i;
    return -1;
}

export function numTradeOnBoard(){
    let count = 0;
    for(let t of get(state).galactic_board.trade_tokens){
        if(Array.isArray(t)){
            count += t.length;
        }else if(t){
            count++;
        }
    }
    return count;
}

export function bottomTrade(){
    // Returns top trade from board
    let s = get(state);
    let tok;
    for(let i = s.galactic_board.trade_tokens.length - 1; i >= 0; i--){
        tok = s.galactic_board.trade_tokens[i];
        if(Array.isArray(tok) && tok.length > 0) tok = tok[0];
        if(tok) break;
    }
    return tok || false;
}
