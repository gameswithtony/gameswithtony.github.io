// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { compositeImage, getBGImage, image, imageURL, waitLoaded } from './images.js';
import { ui , prefs, res, state, live } from './stores.js';
import {get, set, update} from './runtime.js';
import { crossfade, fly } from "./runtime.js";
import { tick } from './runtime.js';
import { at, bl, isIn, lo, moveBitTo, possArray, type } from './utils.js';
import { pay } from './costs.js';
import { select, deselect, unhover } from './previewable.js'
import { doAction, log } from './game.js';
import * as jsonpatch from './runtime.js';
import { undo } from './undo.js';
import { getSectorList } from './sectors.js';
//import {crossfade, customFlip} from './crossfade.js';

export let [send, receive] = crossfade({
    duration: 500
});

//export function send(){}
//export function receive(){}

/*/{
    duration: 500,
    fallback(node, params) {
        //return {};
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        return {css: t => `transform: ${transform} scale(${t}); opacity: ${t}`};
        
    }
});
*/
/*
export let [origSend, origReceive] = crossfade({
    duration: 200,
    fallback(node, params) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        return {css: t => `transform: ${transform} scale(${t}); opacity: ${t}`};
    }
});

export function send(node, params){
    console.log('send', params)
    if(!params.animate) return {};
    console.log('send', params)
    return origSend(node, params); 
}

export function receive(node, params){
    console.log('receive', params)
    if(!params.animate) return {};
    console.log('receive', params)
    return origReceive(node, params); 
}*/


export async function waitMillis(millis){
    await tick();
    await new Promise(r => setTimeout(r, millis));
}

export async function doActionPause(canConfirm = true){
    if(get(res).noWaiting) return; // No waiting
    /*if(get(ui).paused) return; // Don't stack – test
    ui.update(ui => {
        ui.paused = true;
        return ui;
    })*/
    await tick();
    if(get(prefs).actionPause == -1 && canConfirm){
        await pause('Press OK to continue');
    }else if(get(prefs).actionPause > 0){
        let amount = get(prefs).actionPause;
        await waitMillis(amount);
    }
    /*ui.update(ui => {
        ui.paused = false;
        return ui;
    })*/
}


export async function scaleBit(id, ref = false){
    // returns size of bit by general scale
    let i;
    if(ref){
        i = compositeImage(ref, id);
    }else{
        i = image(id);
    }
    if(!i) return {};
    if(!i.complete || i.naturalHeight == 0){
        await waitLoaded(i);
    }
        //console.log('sizeB '+id, i.width, get(prefs).viewScale)
    return {
        w: i.width * get(prefs).viewScale,
        h: i.height * get(prefs).viewScale,
    }
}

export async function scaleCSS(id, ref = false){
    let scale = await scaleBit(id, ref);
    return `width: ${scale.w}vmin; height: ${scale.h}vmin;`
}

export function isTouchDevice(override = true) {
    if(get(prefs).forceNotTouch && override) return false;
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

export function isSelected(ui, id){
    if(!id || !ui.selection) return false;
    if(ui.selection && ui.selection.some(s => s.id == id)){
        //console.log(`${ui.selection.id} is selected`, ui, id)
        return true;
    }
    return false;
}

export async function toggleExpandable(key){
    ui.update(ui => {
        ui.showing[key] = !ui.showing[key];
        return ui;
    })
    await tick();
}

export async function showExpandable(key){
    ui.update(ui => {
        ui.showing[key] = true;
        return ui;
    })
    await tick();
}

export async function hideExpandable(key){
    ui.update(ui => {
        ui.showing[key] = false;
        return ui;
    })
    await tick();
}

export function scaleUp(){
    prefs.update(p => {
        p.viewScale = p.viewScale + (p.origViewScale / 10);// * 1.1;
        return p;
    })
}

export function scaleDown(){
    prefs.update(p => {
        p.viewScale = p.viewScale - (p.origViewScale / 10); /// 1.1;
        return p;
    })
}

export function shouldDim(ui, id){
    if(!id || !ui) return false;
    if(ui.waiting && ui.waiting.length > 0){
        let w = ui.waiting[0];
        if(w.choices && w.choices.filter(c => c.type != 'text').length > 0){
            if(w.choices.some(c => c.id && c.id == id)) return false;
            if(!w.choices.some(c => c.id && type(c.id) == type(id))) return false; // non-compatible types
            return true;
        }
    }
    return false;
}


export function clearSelection(){
    ui.update(ui => {
        ui.selection = [];
        return ui;
    })
}

export function toggleSelect(c){
   // let cubes = (at(c) && at(c).cubes ? at(c).cubes : null); // !! TODO this is messy. Need separate canSelect and toggleSelect
    //if(!canSelect(c, null, cubes)) return false;
    if(isSelected(get(ui), c)){
        deselect(c);
    }else{
        select(c);
    }
}

export function canSelect(id, _, cubes = false){
    if(!id) return false;
    if(!get(ui).waiting) return false;
    if(get(ui).waiting.length == 0) return false;
    if(!get(ui).waiting[0].choices) return false;
    if(get(ui).waiting[0].choices.some(ch => ch.id == id)) return true;
    if(!cubes) return false;
    //if(cubes) console.log(cubes);
    if(cubes && get(ui).waiting[0].choices.some(ch => cubes.some(c => c.id == ch.id))) return true;
    return false;
}

export function changeView(p){
    ui.update(ui => {
        ui.viewing = p;
        return ui;
    })
}

export async function pause(message, extras = {}){
    return await choose(message, [{type: 'text', choice: 'OK', ok: true}], {...extras, noLog: true});
}

export function convert(text, fullText = false, size = 1.5){
    text = text.replaceAll(/\*([^*]+)\*/g, '<strong>$1</strong>');
    text = text.replaceAll(/\[\[([^\]]+?)(-small)?\]\]/g,  (match, p1, p2, offset, string) => {
        if(p2 == 'small') size = size * .75;
        //console.log(p1, imageURL(p1.toLowerCase()))
        let src = imageURL(p1.toLowerCase());
        if(src){
            return `<img src="${src}" style="height: ${size}em; object-fit: contain; vertical-align: middle;" /> ${fullText ? '<div style="display:inline; background-color: '+bgColor+'; color: black; font-size: 0.8em; border: 1px solid black;">'+p1[0].toUpperCase()+p1.slice(1)+'</div>' : ''}`
        }else{
            return p1;
        }
    });
    //console.log(text)
    return text;
}

export function sectorPreview(id, preview){
    ui.update(ui => {
        ui.sectorPreview[id] = preview;
        return ui;
    })
}

export function clearSectorPreviews(){
    ui.update(ui => {
        ui.sectorPreview = {};
        return ui;
    })
}

export async function mayMany(messageOne, messageMany, options, extras = {}){
    if(options.length == 0) return false;
    if(options.length == 1){
        let choice = await choose(messageOne, [...options, 'ok_OK'], {cancellable: true, cancel: 'None', optional: true, ...extras})
        if(choice == 'cancelled') return false;
        return options[0];
    }else{
        let choice = await choose(messageMany, options, {optional: true, okText: 'OK/None', optional: true, ...extras})
        if(choice == 'cancelled') throw 'cancelled';
        return choice;
    }
}

export async function ask(message, extras){
    let choice = await choose(message, ['Yes', 'No'], extras);
    if(choice == 'Yes') return true;
    return false;
}

export function choose(message, options, extras = {}){
    // To do: add moved view?
  
    let movedView = false;
    if(extras.player && get(ui).viewing != extras.player){
      movedView = get(ui).viewing;
      changeView(extras.player);
    }

    ui.update(ui => {
        ui.dragPosition = {x:0,y:0};
        /*if(ui.foregroundComponent && ui.foregroundComponent.$destroy && !extras.foreground){
            ui.foregroundComponent.$destroy();
            ui.foregroundComponent = false;
        }*/
        return ui;
    })

    /*if(!extras.noLog){
        log({
            type: 'choice',
            choosingFrom: options.map(o => o.choice),
            message,
            foreground: extras.foreground || null
        })
    }*/
    
  
    if(get(ui).per){
      let per = get(ui).per;
      message = `(${per.num} of ${per.max} times) ${message}`;
    }
    state.update(s => {
        if(!s.chooseCode) s.chooseCode = 0;
        s.chooseCode++;
        return s;
    })
    let code = get(state).chooseCode;

    if(extras.once && get(ui).waiting && get(ui).waiting.some(w => w.once == extras.once)) return; // Don't double-show one-off windows
    
  
    let wait = {
      message,
      choices: options,
      code,
      ...extras
    }

    let sanitisedOptions = [];

    if(!Array.isArray(options)){
        // it's an object of options -> return values, so convert
        for(let k of Object.keys(options)){
            let o = {
                type: 'text',
                choice: k,
                value: options[k]
            }
            sanitisedOptions.push(o);
        }
    }

    for(let o of options){
        if(typeof o == 'string'){
            let ok = false;
            let warn = false;
            if(o.startsWith('ok_')){
                ok = true;
                o = o.slice(3);
            }else if(o.startsWith('warn_')){
                warn = true;
                o = o.slice('warn_'.length);
            }else if(o.startsWith('cancel_')){
                let cancel = o.slice('cancel_'.length);
                wait = {
                    ...wait,
                    cancellable: true,
                    cancel
                };
                continue;
            }
            o = {type: 'text', choice: o, value: o, ok, warn};
        }
        sanitisedOptions.push(o);
    }

    wait.choices = sanitisedOptions;
    
    console.log(wait.choices);

    let foreground = extras.foreground;

    if(extras.foregroundAll || sanitisedOptions.some(s => s.id && isIn(s, 'spare_tokens'))) foreground = sanitisedOptions.filter(s => s.id);

    let expandablePlaces = [{
        loc: 'agenda_board',
        key: 'agendas',
     },
     {
        loc: 'basic_techs',
        key: 'techs'
     } ]

    for(let e of expandablePlaces){
        if(sanitisedOptions.some(s => s.id && isIn(s, e.loc))){
            //console.log('expand', sanitisedOptions, e.loc)
            if(get(ui).showing[e.key]) continue;
            if(!wait.hasOwnProperty('expanded')) wait.expanded = [];
            wait.expanded.push(e.key);
            showExpandable(e.key);
        }
    }
    

    if(extras.number || extras.min || extras.max){
        if(typeof extras.number == 'number'){
            ui.update(ui => {
                ui.selectionNum = extras.number;
                return ui;
            })
            let cond = () => {return true};
            if(wait.condition) cond = wait.condition;
            let newCondition = (ui, state) => {
                if(!cond(ui, state)) return false;
                if(ui.selection.length != extras.number) return false;
                return true;
            }
            wait.condition = newCondition;
        }else if(extras.number == 'any'){
            ui.update(ui => {
                ui.selectionNum = Infinity;
                return ui;
            })
        }
        if(extras.max){
            if(!extras.min) wait.optional = true;
            ui.update(ui => {
                ui.selectionNum = extras.max;
                return ui;
            })
            let cond = () => {return true};
            if(wait.condition) cond = wait.condition;
            let newCondition = (ui,state) => {
                if(!cond(ui, state)) return false;
                if(ui.selection.length > extras.max) return false;
                return true;
            }
            wait.condition = newCondition;
        }
        if(extras.min){
            let cond = () => {return true};
            if(wait.condition) cond = wait.condition;
            let newCondition = (ui,state) => {
                if(!cond(ui, state)) return false;
                if(ui.selection.length < extras.min) return false;
                return true;
            }
            wait.condition = newCondition;
            ui.update(ui => {
                if(!extras.max) ui.selectionNum = Infinity;
                return ui;
            })
        }
        // !!TODO add condition handling
    }else{
        ui.update(ui => {
            ui.selectionNum = 1; // reset
            return ui;
        })
    }

    if(!wait.noAuto && !wait.alwaysAsk && wait.choices.filter(c => c.type != 'text').length == (extras.number || 1)){
        if(extras.number && extras.number != 1){
            for(let c of wait.choices.filter(c => c.type != 'text')){
                select(c.id);
            }
        }else{
            if(get(prefs).autoClick && !extras.optional) return at(wait.choices.filter(c => c.type != 'text')[0].id);
            select(wait.choices.filter(c => c.type != 'text')[0].id);
        }
        
    }

    if(wait.choices.length == 0) return false;

    if(foreground){
        // stuff to bring into foreground
        if(!Array.isArray(foreground)) foreground = [foreground];
        state.update(s => {
            if(!s.foreground[wait.code]) s.foreground[wait.code] = [];
            wait.origLocs = {};
            for(let f of foreground){
                wait.origLocs[f.id] = bl(f.id);
                moveBitTo(f, s.foreground[wait.code]);
                let id = f.id.replaceAll('.', '-')
                if(extras.overlay && extras.overlay[id] && extras.overlay[id].length > 0){
                    if(!s.overlay) s.overlay = {};
                    if(!s.overlay[id]) s.overlay[id] = [];
                    for(let o of extras.overlay[id]){
                        wait.origLocs[o.id] = bl(o.id);
                        moveBitTo(o, s.overlay[id]);
                    }
                }
            }
            
            //s.foreground = extras.foreground.map(f => f.id); // have to be Bits
            return s;
        })
        
    }

  
  let p = new Promise((resolve, reject) => {
    ui.update(ui => {
       //if(movedView) changeView(extras.player);
       ui.selection = [];  
        wait.func = (arg) => {
            /*if(ui.undone){
                _ui.update(ui => {
                    ui.undone = false;
                    return ui;
                });
                throw 'undone';
            }*/
            if(movedView) waitMillis(300).then(() => changeView(movedView));
            /*arg = options.find(o => o.choice == arg)
            if(arg.value){
                arg = arg.value;
            }else{
                arg = arg.choice;
            }*/
            doActionPause(false).then(() => {
               // if(arg == 'cancelled') throw 'cancelled';
                //if(arg == 'undone') throw 'undone';
                resolve(arg);
            });
            /*if(wait.card){
                waitMillis(300).then(() => {
                    resolve(arg);
                });
            }else{
                resolve(arg);
            }*/
        }
        if(!ui.waiting) ui.waiting = [];
        ui.waiting = [wait, ...ui.waiting];
        console.log('added wait', wait)
        return ui;
    })
});
return p;

}

export async function advance(param = undefined){
    if(get(ui).waiting.length == 0) return;
    let wait = get(ui).waiting[0];
    let func = wait.func; 

    live.update(live => {
        live.hover = null;
        live.hoveringFacedown = false;
        live.preview = null;
        return live;
    })
    /*res.update(res => {
        res.everyChoice = [...res.everyChoice, param]; // Keeping track of all choices
        return res;
    })*/

    if(get(ui).selectionNum == 1 && Array.isArray(param) && param.length < 2) param = param[0];
    console.log(param);
    

    if(Array.isArray(param)){
        for(let i = 0; i < param.length; i++){
            if(param[i].id) param[i] = at(param[i].id);
            if(param[i].lo) param[i] = at(param[i].lo);
        }
    }else if(param){
        if(param.id) param = at(param.id) || param;
        if(param.lo) param = lo(param); // Resolve to basic thing
    }

    /*if(param){
        log({
            type: 'choice',
            chose: param.id ? {id: param.id} : param
        })
    }*/

    if(wait.hasOwnProperty('beforeAdvancing')){
        wait.beforeAdvancing(param); // e.g. to move stuff before the window disappears
        
    }

    if(wait.expanded){
        for(let e of wait.expanded){
            waitMillis(1000).then(() => hideExpandable(e));
        }
    }

    if(get(state).foreground && get(state).foreground[wait.code] && get(state).foreground[wait.code].length > 0){
        //let fore = get(state).foreground;
        while(get(state).foreground[wait.code].length > 0){
            let f = get(state).foreground[wait.code][0];   
            let id = f.id.replaceAll('.', '-')
            if(get(state).overlay && get(state).overlay[id] && get(state).overlay[id].length > 0){
                while(get(state).overlay[id].length > 0){
                    let o = get(state).overlay[id][0];       
                    if(!wait.origLocs[o.id]){
                        console.log('not moving back because not there', wait, o)
                        state.update(s => {
                            s.overlay[id] = s.overlay[id].slice(1);
                            return s;
                        })
                        continue;
                    }
                    moveBitTo(o, wait.origLocs[o.id].parent, wait.origLocs[o.id].key);
                    delete wait.origLocs[o.id];
                }
                state.update(s => {
                    delete s.overlay[id];
                    return s;
                })
            }    
            if(!wait.origLocs || !wait.origLocs[f.id]){
                console.log('not moving back because not there', wait, f)
                state.update(s => {
                    s.foreground[wait.code] = s.foreground[wait.code].slice(1);
                    if(s.foreground[wait.code].length == 0) delete s.foreground[wait.code];
                    return s;
                })
                continue;
            }
            moveBitTo(f, wait.origLocs[f.id].parent, wait.origLocs[f.id].key);
            delete wait.origLocs[f.id]
        }
        state.update(s => {
            delete s.foreground[wait.code];
            return s;
        })
        
        
        await tick();//doActionPause(); // To sync?
    }

    

    ui.update(ui => {
        ui.waiting = ui.waiting.slice(1);
        return ui;
    })

    //if(param == 'cancelled') throw 'cancelled'; // see if thse work!
    //if(param == 'undone') throw 'undone'; // see if thse work!
 
    /*if(param){
        
    }else{
        func();
    }*/
    
    func(param);
    console.log(get(ui).waiting)
}

export async function advanceAll(param = undefined){
    
    while(get(ui).waiting.length > 0){
        await advance(param);
    }
}


export function upperInitial(s){
    if(!s) return ''
    return s[0].toUpperCase()+s.slice(1);
}

export function renderSlots(slots, i = -1, unit="%", adjust = 0){
    let string = 'position: absolute; ';
    for(let k of Object.keys(slots)){
        if(Array.isArray(slots[k]) && i != -1){
            string += ` ${k}: ${slots[k][i] + adjust}${unit};`
        }else{
            string += ` ${k}: ${slots[k] + adjust}${unit};`
        }
        
    }
    return string;
}

export function flash(element) {
    requestAnimationFrame(() => {
        element.style.transition = 'none';
        element.style.color = 'yellow';
        element.style.backgroundColor = 'grey';

        setTimeout(() => {
            element.style.transition = 'color 1s, background 1s';
            element.style.color = '';
            element.style.backgroundColor = '';
        });
    });
}

export function getIDProps(id){
    // anything that might be useful to format an ID in the foreground
    if(id.startsWith('bounty') && at(id).value.flipped){
        return {
            generic: true,
            shape: 'circle',
        }
    }
    if(id.startsWith('reclaim') && at(id).value.flipped){
        return {
            generic: true,
            shape: 'hex'
        }
    }
}

export async function undoableOptions(start, each = false, maxNum = 'all'){
    let {options, text, extras} = await start();
    //let done = [];
    let prev = [];
    let numDone = 0;
    let prevUndo = get(ui).undoFunc;
    console.log(prevUndo);
    while(options){
        let fullList = [...options];
        if(each) fullList = await each([...fullList]); // So that basic list gets updated each time
        if(fullList.length == 0 || !fullList.some(o => !o.disabled && !o.reaction)) break;

        if(fullList.every(d => d.disabled || !d.compulsory)){
            fullList = [
                ...fullList,
                {
                    type: 'text',
                    action: async () => `end`,
                    choice: 'Finish',
                    ok: true,
                }
            ]
        }
        let actions = fullList.map(f => f.action);
        let toDisplay = fullList.map((f, i) => {
            return {
                type: 'text',
                ...f,
                value: i
            };
        })

        let prevOptions = [];
        for(let o of options){
            let copyOptions = {...o};
            prevOptions.push(copyOptions);
        }
        let prevState = {
            state: jsonpatch.deepClone(get(state)),
            options: prevOptions,
            prevWaiting: [...get(ui).waiting],
            prevReactions: [...get(ui).reactions.map(r => [...r])],
            prevDone: numDone
        }

        let d = await new Promise((resolve, reject) => {

            let newUndo = async () => {
                resolve('undone');
            }

            if(prev.length > 0){
                ui.update(ui => {
                    ui.undoFunc = newUndo;
                    return ui;
                });
            }
            

            choose(text, toDisplay, extras).then((i) => {
                if(i == 'cancelled' || typeof i != 'number'){
                    resolve('cancelled');
                    return;
                }

                prev.push(prevState);

                if(maxNum != 'all' && !toDisplay[i].extra){
                    numDone++;
                    let max = maxNum;
                    if(typeof maxNum == 'function') max = maxNum();
                    if(numDone >= max){
                        for(let o of options){
                            if(!o.ok && !o.extra){
                                o.disabled = true; // Done as many as you can
                                o.noSpace = true;
                            }
                        }
                    }
                }
                actions[i]().then((ret) => {
                    fullList[i].disabled = true;
                    fullList[i].done = true;
                    resolve(ret);
                });    
            });
            
        });
        if(d == 'undone'){
            let top = prev.pop();
            state.update(s => {
                return top.state;
            })
            options = top.options;
            numDone = top.prevDone;
            /*res.update(res => {
                res.everyChoice = [...res.everyChoice, -1];
                return res;
            })*/
            ui.update(ui => {
                ui.waiting = top.prevWaiting;
                ui.reactions = top.prevReactions;
                return ui;
            })
            if(prev.length == 0){
                ui.update(ui => {
                    ui.undoFunc = prevUndo;
                    return ui;
                })
            }
            await doActionPause();
            continue; // Try again
        }
        if(d == 'end') break; // The end
        if(d == 'cancelled') return 'cancelled';
        
        
        /*if(i == 'back'){
            // Revert
            
        }*/
        
        //done.push(d);
        
    }
    ui.update(ui => {
        ui.undoFunc = prevUndo;
        return ui;
    });
}

export async function announce(message){
    ui.update(ui => {
        ui.announcement = message;
        return ui;
    })
    await waitMillis(get(prefs).announcementPause);
    ui.update(ui => {
        ui.announcement = false;
        return ui;
    })
}

export function resetSectorImages(){
    ui.update(ui => {
        ui.sectorImages = {};
        for(let s of getSectorList(get(state).sectors)){
            ui.sectorImages[s.id] = getBGImage(s);
        }
        return ui;
    })
}