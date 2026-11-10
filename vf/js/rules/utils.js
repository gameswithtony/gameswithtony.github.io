// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { seedrandom } from './runtime.js';
import { state, ui } from './stores.js';
import { get } from './runtime.js';
import { playerIndex } from "./game.js";
import { tick } from "./runtime.js";
import { controlledBy, guilds, playerSectors } from "./sectors.js";

let rn = null;

//let lookupTable = {};

export function olAll(tree){
    if(!tree) return tree;
    
    if(Array.isArray(tree)){
        for(let i = 0; i < tree.length; i++){
            tree[i] = olAll(tree[i]);
        }
    }else if(tree.lo){
        return get(ui).reverseLookup[tree.id];
    }else if(tree.id){
        return lo(tree);
    }else if(typeof tree == 'object'){
        for(let k of Object.keys(tree)){
            tree[k] = olAll(tree[k]);
        }
    }
    return tree;
}

export function ol(thing){
    if(thing.lo) return get(ui).reverseLookup[thing.id]; // already it
    if(!get(ui).lookupTable[thing.id]){
        ui.update(ui => {
            ui.lookupTable[thing.id] = thing;
            ui.reverseLookup[thing.id] = {
                id: thing.id,
                lo: 1
            }
            return ui;
        });
    }
    return get(ui).reverseLookup[thing.id];
}


export function setupSeed(){
    if(get(ui).rng) return;
    if(get(state).randomSeed){
        if(!get(state).random || !get(state).random.state){
            let rng = seedrandom(get(state).randomSeed, { state: true });
            /*state.update(s => {
                s.random.seed = s.randomSeed;
                s.random.state = rng.state();
                return s;
            });*/
            ui.update(ui => {
                ui.rng = rng;
                return ui;
            })
        }
        return;
    }
    let seed = Date.now().toString()+Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    let rng = seedrandom(seed, { state: true });
    state.update(s => {
        //s.random.seed = seed;
        //s.random.state = rng.state();
        s.randomSeed = seed;
        return s;
    });
    ui.update(ui => {
        ui.rng = rng;
        return ui;
    })
}

export function prng(){
    if(!get(ui).rng){
        setupSeed();
    }
    if(get(ui).random.length <= get(state).randomIndex){
        // Add more numbers
        let toAdd = [];
        for(let i of Array(50)){
            let num = get(ui).rng.quick();
            toAdd.push(num);
        }
        ui.update(ui => {
            ui.random = [...ui.random, ...toAdd];
            return ui;
        });
    }
    
    let num = get(ui).random[get(state).randomIndex];
    console.log('drew random number from set', get(state).randomSeed)
    state.update(s => {
        s.randomIndex++;
        return s;
    })
    return num;
    /*}else if(get(state) && get(state).random && get(state).random.state){
        rng = seedrandom(get(state).random.seed, {state: get(state).random.state}) // Should be as saved
    }else{
        console.log('Seed not already generated, so setting up', get(state).random, get(state).randomSeed);
        setupSeed();
        //seedrandom(seed, {state: true});
        rng = seedrandom(get(state).random.seed, {state: get(state).random.state}) // Should be as saved
    }
    let num = rng.quick();
    if(get(state).random.state){
            state.update(s => {
            s.random.state = rng.state();
            return s;
        }); // TODO is this right?
        //state.random.state = rng.state();
        console.log('drew random number with state from set', get(state).randomSeed)
    }
    return num;*/
}

export function upperInitial(s){
    if(!s) return ''
    return s[0].toUpperCase()+s.slice(1);
}

export function shuffle(array, random = prng) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function spotNonClonable(s, address){
    if(!s){
        if(typeof s === 'undefined'){
            console.log('Not clonable!', address, s);
        }
        return;
    }
    if(typeof s == 'object' && s.nodeName){
        console.log('Not clonable!', address, s);
    }
    
    if(Array.isArray(s)){
        for(let i = 0; i < s.length; i++){
            spotNonClonable(s[i], `${address}[${i}]`);
        }
        return;
    }
    if(typeof s == 'object'){
        for(let k of Object.keys(s)){
            spotNonClonable(s[k], `${address}.${k}`);
        }
    }
}

export function randomElements(array, howMany = 1, random = prng){
    let chosen = [];
    for(let times = 0; times < howMany; times++){
      let sel = array.filter(a => !chosen.includes(a));
      let max = sel.length;
      let i = Math.floor(random() * max)
      chosen = [...chosen, sel[i]];
    }
    return chosen;
  }


  export function randomIndex(array, random = prng){
    return Math.floor(random() * array.length);
  }
  /*export function pregenRandomNumbers(howMany = get(state).pregenRandomCount){
    if(get(ui) && Array.isArray(get(ui)).random && get(ui).random.length > get(state).randomIndex){
        alert('Error: no need to generate more random numbers (report as a bug)');
        return;
    }
    let nums = [];
    for(let i = 0; i < howMany; i++){
        nums.push(prng());
    }
    ui.update(ui => {
        ui.random.push(nums);
        return ui;
    })
  }*/

  export function plural(s, num){
    if(num == 1) return s.name;
    if(s.plural) return s.plural;
    return s.name+'s';
  }

  //let bigList = {};

  export function addToList(id, self, key, parent, address){
    state.update(s => {
        s.bigList[id] = {
            //self,
            key,
            //parent,
            address,
            id
        }
        return s;
    });
  }

  export function decamel(val){
    if(!val) return val;
    if(typeof val == 'number') val = `${val}`;
    // Makes camel case into space-separated
    // Reverts - and _ too
    // Uppers the first initial
    let res = `${val[0].toUpperCase()}`;
    for(let c of val.slice(1)){
        if(['-', '_'].includes(c)){
            res = `${res} `;
        }else if(c.toLowerCase() == c.toUpperCase()){
            res = `${res}${c}`;
        }else if(c == c.toUpperCase()){
            // space and add
            res = `${res} ${c}`; // to lower or not?
        }else{
            res = `${res}${c}`;
        }
    }
    return res;
}

  export function assembleList(root, parent, key, address, update){
    if(!root) return;
    if(address.includes(`state.log`)){
        console.log('trying to list log!!')
        return;
    }
    if(root.id){
        if(get(state).bigList.hasOwnProperty(root.id) && parent && !update){
            console.log(`Duplicate ID!`, address, root, get(state).bigList);
            throw 'duplicate ID';
        }
        addToList(root.id, root, key, parent, address, update)
    }
    if(Array.isArray(root)){
        for(let i = 0; i < root.length; i++){
            assembleList(root[i], root, i, `${address}.${i}`, update);
        }
    }else if(typeof root == 'object'){
        for(let k of Object.keys(root)){
            if(k == 'bigList') continue; // self-exclude
            if(k == 'log') continue;
            //if(k == 'spare_tokens') continue; // just see
            if(typeof root[k] == 'object'){
                assembleList(root[k], root, k, `${address}.${k}`, update);
            }
        }
    }
  }

  export function makeList(update = false){
    clearList();
    assembleList(get(state), false, false, 'state', update);
    console.log('big list:', get(state).bigList);
    console.log('all sectors', all('sectors'));
    console.log('all agendas', all('agendas'));
    console.log('all techs', all('techs'));
    console.log('all harbingers', all('harbinger'));
    console.log('all focus cards', all('focus'));
  }

  export function clearList(){
    state.update(s => {
        s.bigList = {};
        return s;
    })
  }

  export function all(type, filter = false){
    let noPlural = type;
    if(type.endsWith('s')) noPlural = type.slice(0, -1);
    let base = Object.keys(get(state).bigList).filter(k => k.includes(type) || k.includes(noPlural)); // Hopefully that will capture things...?
    if(filter){
        base = base.filter(b => at(b) && filter(at(b)));
    }
    return base.map(b => at(b));
  }

  export function allActivePlayer(type, filter = false){
    let a = all(type, belongsToCurrentPlayer);
    if(filter) return a.filter(b => filter(b));
    return a;
  }

  export function allPlayer(p, type, filter = false){
    if(typeof p != 'number') p = playerIndex(p);
    let a = all(type, (b) => isIn(b, `state.players.${p}`));
    if(filter) return a.filter(b => filter(b));
    return a;
  }

  export function belongsToCurrentPlayer(obj){
    return get(state).bigList[obj.id].address.includes(`state.players.${get(state).activePlayer}`);
  }

  export function isIn(obj, loc){
    let e = get(state).bigList[obj.id];
    if(!e) return false;
    return e.address.includes(loc);
  }

  export function is(obj, type){
    return obj.id.includes(type);
  }

  function buildAddress(root, object, starter){
    if(!root) return false;
    if(starter == 'state.log') return false; // ignore log
    if(root === object) return starter;
    if(Array.isArray(root)){
        for(let i = 0; i < root.length; i++){
            if(root[i] === object) return `${starter}.${i}`;
            if(Array.isArray(root[i]) || typeof root[i] == 'object'){
                let res = buildAddress(root[i], object, `${starter}.${i}`);
                if(res) return res;
            }
        }
    }else if(typeof root == 'object'){
        for(let k of Object.keys(root)){
            if(root[k] === object) return `${starter}.${k}`;
            if(Array.isArray(root[k]) || typeof root[k] == 'object'){
                let res = buildAddress(root[k], object, `${starter}.${k}`);
                if(res) return res;
            }
        }
    }
  }

  export function resolveAddress(root, address, endpoint = 0){
    let steps = address.split('.').slice(1); // NB presume the root is the first element in the address - TODO is this best??
    let current = root;
    if(steps.length < endpoint) throw 'malformed address!';
    while(steps.length > endpoint){
        let next = steps[0];
        steps = steps.slice(1);
        //if(!isNaN(parseInt(next))) next = parseInt(next);
        if(Array.isArray(current)){
            next = parseInt(next);
        }
        current = current[next];
    }
    return current;
  }

  export function bl(id){
    let entry = get(state).bigList[id];
    if(!entry){
        return false;
       //throw 'no entry!';
    }
    let parent = resolveAddress(get(state), entry.address, 1);
     
    let self = parent[entry.key];
    let ret = {
        ...entry,
        parent,
        self
    };
    if(Array.isArray(parent)) ret.key = parseInt(ret.key);
    return ret;
  }

  export function moveBitTo(obj, location, index = -1, overrideLo = false){
    //console.log('moving', obj, location, index)
    if(typeof obj == 'string') obj = resolveAddress(get(state), get(state).bigList[obj].address); //get(state).bigList[obj].self; // presume ID
    if(!obj) throw 'Nothing to move!';
    let parentToSave, keyToSave;

    if(isLo(obj) && !overrideLo) obj = ol(obj); // Keep it as alias

    //if(get(ui).bitNodes[obj.id]) console.log('before rect', get(ui).bitNodes[obj.id].getBoundingClientRect());

    if(typeof location == 'string'){
        if(get(state).bigList.hasOwnProperty(location)){
            location = resolveAddress(get(state), get(state).bigList[location].address);//.self;
        }else{
            // Presume it's a breadcrumbs address
            //throw 'Not supported yet'
            location = resolveAddress(get(state), location);
        }
    }

    // Remove from its current location
    let res;
    try{
        res = bl(obj.id);
    }catch(e){
        if(e != 'no entry!') throw e;
    }
    if(res){ // If it doesn't exist in the system yet, just don't remove it
        let {parent, key} = res;
        if(Array.isArray(parent)){
            if(typeof key == 'string') key = parseInt(key);
            if(!parent[key] || parent[key].id != obj.id){
                console.log('List in wrong order! Trying to fix');
                if(parent.some(o => o && o.id == obj.id)){
                    key = parent.findIndex(o => o && o.id == obj.id);
                }else{
                    console.log('Structural error in list! Remaking');
                    makeList(true);
                    res = bl(obj.id);
                    parent = res.parent;
                    key = res.key;
                }
            }
            parent.splice(key, 1); // !TODO if this doesn't work with reactivity then try something else
            // renumber list
            for(let i = 0; i < parent.length; i++){
                let a = parent[i];
                let add = bl(a.id).address.split('.').slice(0, -1).join('.');
                //console.log('assembling', a, parent, i, add)
                assembleList(a, parent, i, `${add}.${i}`, true);
                //if(a.id) addToList(a.id, a, i, parent, `${add}.${i}`, true)
            }
        }else{
            parent[key] = false;
            //delete parent[key];
        }
    }
    

    // We should have the place by now then
    if(Array.isArray(location)){
        if(index == -1){
            location.push(obj);
            index = location.length - 1;
        }else{
            location.splice(index, 0, obj);
            //location = [...location.slice(0, index), obj, ...location.slice(index)];
        }
        parentToSave = location;
        keyToSave = index;
        // renumber list
        for(let i = 0; i < location.length; i++){
            if(i == index) continue;
            let a = location[i];
            let add = bl(a.id).address.split('.').slice(0, -1).join('.');
            //console.log('assembling', a, parent, i, add)
            assembleList(a, location, i, `${add}.${i}`, true);
            //if(a.id) addToList(a.id, a, i, location, `${add}.${i}`, true)
        }
    }else{
        if(index != -1){
            // it is a key
            location[index] = obj;
            parentToSave = location;
            keyToSave = index;
        }else if(location.id){
            let {parent, key} = bl(location.id) //get(state).bigList[location.id].parent;
            parent[key] = obj;
            parentToSave = parent;
            keyToSave = key;
        
        }
    }

    // Update the list
    state.update(s => {
        s.bigList[obj.id] = {
            //self: obj,
            //parent: parentToSave,
            key: keyToSave,
            id: obj.id,
            address: buildAddress(get(state), obj, 'state')
        };
        return s;
    });
    
    // Check for internal contents
    let toCheck = obj.lo ? lo(obj) : obj;
    if(toCheck.inside) assembleList(toCheck.inside, toCheck, 'inside', `${bl(toCheck.id).address}.inside`, true);
    //console.log('state at end of move', get(state));
    /*tick().then(() => {
        if(get(ui).bitNodes[obj.id]) console.log('after rect', get(ui).bitNodes[obj.id].getBoundingClientRect());
    })*/
  }

  export function at(id){
    /*if(typeof id == 'object'){
        console.log('finding object..!!')
        return id;
    }*/
    if(!get(state).bigList[id] || !get(state).bigList[id].address){
            return null;
        
    }
    return resolveAddress(get(state), get(state).bigList[id].address);
  }

  export function sectorAt(key){
    return at(`sectors.${key}`);
  }

  

  export function propAdd(obj, key, value){
    if(!obj.hasOwnProperty(key)) obj[key] = 0;
    obj[key] += value;
  }

  export function possArray(o, removeNull = true){
    if(!o && removeNull) return [];
    if(!Array.isArray(o)) o = [o];
    return o;
  }

  export function possScalar(o){
    if(Array.isArray(o) && o.length == 1) return o[0];
    return o;
  }

  export function possFunc(f, args = undefined){
    if(typeof f == 'function') return f(args);
    return f;
  }

  export function resolvePlace(place, p = -1, possible = all(`sectors`)){
    if(!place && p != -1){
        return playerSectors(p);
    }
    /*if(typeof place == 'object' && !Array.isArray(place)){
        if(!possible.some(p => p.id == place.id)) return false; // Filter out to possible sectors
        return at(place.id);
    }*/
    if(Array.isArray(place)){
        let ret = Array.from(new Set(place.flatMap(l => possible.filter(locationFilter(l, p)))));
        if(ret.length == 1) return ret[0];
        return ret;
    }
     
    let res = possible.filter(locationFilter(place, p));
    if(res.length == 1) return res[0];
    if(res.length == 0) return false;
    return res;
  }

  export function locationFilter(loc, player = -1){
    // returns a filter you can use...!
    //if(Array.isArray(loc)) return loc.map(l => locationFilter(l, player))
    if(!loc) return false;
    if(Array.isArray(loc)) return (b) => loc.some(s => s.id == b.id); // We already have a set. TODO maybe handle array strings
    // TODO maybe allow to combine?
    if(typeof loc != 'string') return (b) => b.id == loc.id;
    if(loc == 'house_mat'){
        return (b) => isIn(b, `state.players${player == -1 ? get(state).activePlayer : player}`)
    }else if(loc == 'outpost'){
        return (b) => b.special == 'outpost' && b.colour == player.colour

    }else if(loc == 'home'){
        return (b) => b.type == 'home' && b.colour == player.colour
    }else if(loc == 'same_sector'){
        return (b) => get(state).cache && get(state).cache.lastSectors && get(state).cache.lastSectors[0] && get(state).cache.lastSectors[0] == b.id;
    }else if(loc == 'not_home'){
        return (b) => b.type != 'home'
    }else if(loc == 'voidborn'){
        return (b) => controlledBy(b, 'voidborn')
    }else if(loc == 'voidborn_fallen'){
        return (b) => controlledBy(b, 'voidborn') || b.fallen_house
    }else if(loc == 'player'){
        return (b) => controlledBy(b, player == -1 ? get(state).players[get(state).activePlayer] : player)
    }else if(loc.endsWith('_guild')){
        return (b) => guilds(b).some(g => g.value == loc) && (player == -1 || controlledBy(b, player))
    }else if(['shipyard', 'starbase', 'defense'].includes(loc)){
        return (b) => b.installations.some(i => i.value == loc) && (player == -1 || controlledBy(b, player))
    }else{
        return (b) => b.id == loc; //presume ID
    }
  }

  export function possPlural(num, string, suffix = 's', replacement = false){
    let single = 'a'
    if(['a','e','i','o','u'].some(v => string.startsWith(v))) single = 'an'
    if(num == 1) return `${single} ${string}`;
    if(replacement) return `${num} ${replacement}`;
    return `${num} ${string}${suffix}`
  }

  export function lo(entry){
    if(!entry){
        console.log('Non-existent entry!');
        return {};
    }
    if(!entry.lo && entry.id && get(ui).lookupTable[entry.id]){
        console.log('Looking up a thing without .lo', entry)
    }
    let ret = get(ui).lookupTable[entry.id];
    if(!ret){
        // Table miss (id not in table, or not registered by ol() this session). Expected on
        // stats screens reading server games; a real bug anywhere in game logic – hence the
        // error rather than a log. Falls back to the id as the name so callers doing
        // lo(x).name get a usable string instead of throwing; other props stay undefined.
        console.error('looking up a thing that is not in the table', entry);
        ret = {name: entry.id, ...entry};
    }
    if(entry.inside) ret = {
        ...ret,
        inside: entry.inside // For e.g. techs
    };
    return ret; 
  }

  export function isLo(entry){
    if(entry.id && entry.id.startsWith('tech')) return false;
    if(get(ui).lookupTable[entry.id]) return true;
    return false;
  }

  export function type(a){
    if(!a) return false;
    if(a.startsWith('agenda')) return 'agenda';
    if(a.includes('.')) return a.split('.')[0];
    return a.split('_')[0]; //[.slice(0, -1)].join('_');
}

export function clearAllAnimations(){
    let removed = 0;
    for(let k of Object.keys(get(state).bigList)){
        let divs = document.querySelectorAll(`img[data-id='${k}']`);
        for(let d of divs){
            if(d.style.animation){
                removed++;
                console.log('removed animation on '+k);
                d.style.removeProperty('animation')
            }
        }
    }
    console.log('Removed '+removed+' unnecessary animations');
}