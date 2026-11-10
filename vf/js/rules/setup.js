import {get} from './runtime.js';
import * as jsonpatch from './runtime.js';
import {state,ui,res,prefs,resetStores} from './stores.js';
import {getSectorList,generateDistances,isAdjacent,sectorKey,sectorTypes} from './sectors.js';
import {scenarios} from './scenarios.js';
import {setupTokens,takeToken,topToken} from './tokens.js';
import {shuffle,randomElements,ol,lo,setupSeed,clearList,makeList,moveBitTo} from './utils.js';
import {houses as allHouses,house} from './houses.js';
import {techs} from './techs.js';
import {basic_focus,special_focus,heroic_focus,joint_focus} from './focus.js';
import {galacticEvents} from './events.js';
import {agendas,startingAgendas} from './agendas.js';
import {crisisCards,difficultyLevels,warCards,makeAlertDeck} from './crisis.js';
import {originCards} from './origins.js';
import {getBGImage,setViewScale} from './images.js';
import {logAvailable} from './stats.js';
import {logEvent} from './game.js';
import {moveFleet} from './fleets.js';
import {updateSkirmish} from './combat.js';
import {takeTurns} from './turns.js';
let $state,$ui,$res,$prefs;
state.subscribe(v=>$state=v);ui.subscribe(v=>$ui=v);res.subscribe(v=>$res=v);prefs.subscribe(v=>$prefs=v);
let players=1, houses=allHouses, playerInfo=[], playerHouses=[], chosenHouses=[], fallenHouses=[], chosenDifficulty='easy',techsToUse=[], mode='Co-op', gameSeed='', preselectedFocus=false,strictMode=false, chosenScenario;
const crackedHouses=allHouses.filter(h=>h.cracked),normalHouses=allHouses.filter(h=>!h.cracked);
function getOrigins(h){return originCards.filter(o=>o.house===h)}
    function getHouses(){
        chosenHouses = [];
        let availableCracked = crackedHouses.filter(h => !playerHouses.includes(h));
        let availableNormal = normalHouses.filter(h => !playerHouses.includes(h));
        let availableAll = [...availableCracked, ...availableNormal];
        
        chosenHouses = [...chosenHouses, ...randomElements(availableCracked), ...randomElements(availableNormal)];
        availableAll = availableAll.filter(h => !chosenHouses.includes(h));
        chosenHouses = [...chosenHouses, ...randomElements(availableAll, 2)];
        fallenHouses = chosenHouses;
        shuffle(fallenHouses);

        // Set up techs
        let techsToUse = getTechsFromFH(fallenHouses);
        let improvedTechs = techs.filter(t => t.type == 'improved' && techsToUse.some(tech => tech.name == t.name)).map(t => jsonpatch.deepClone(t))
        return {
          basicTechs: techsToUse.map(t => jsonpatch.deepClone(t)),
          improvedTechs,
          fallenHouses: fallenHouses.map(h => {return {...h, id: `fallen_houses.${h.name}`}})
        }
    }

    function getTechsFromFH(fallenHouses){
      let availableTechs = fallenHouses.flatMap(h => h.techs);
        shuffle(availableTechs);
        let slicing = 3;
        if(players == 2) slicing = 2;
        techsToUse = [];
        if(players < 3 && mode == 'Co-op'){
            let noInfTechs = availableTechs.slice(0, slicing);
            let infTechs = availableTechs.slice(slicing);
            for(let i of infTechs){
              let techCards = techs.filter(t => t.name == i && t.type == 'basic');
              if(players == 1) techCards = techCards.filter(t => t.influence == 4);
              techsToUse = [...techsToUse, ...techCards];
            }
            for(let i of noInfTechs){
              let techCards = techs.filter(t => t.name == i && t.type == 'basic' && t.influence == 0);
              techsToUse = [...techsToUse, ...techCards];
            }
        }else{
          for(let i of availableTechs){
              let techCards = techs.filter(t => t.name == i && t.type == 'basic');
              techsToUse = [...techsToUse, ...techCards];
            }
        }
        return techsToUse;
    }

    function cleanupScenario(scenario){
      let s = {};
      let maxCol = 0;
      let maxRow= 0;
      let fhIndex = 0;
      if(!Array.isArray(scenario.sectors)) return; // Already done... – should I do this differently? e.g. in file itself?
      scenario.sectors = scenario.sectors.filter(s => sectorKey(s));
      for(let sec of scenario.sectors.sort((a,b) => sectorKey(a).localeCompare(sectorKey(b)))){
        sec.key = sectorKey(sec);
        /*if(!sec.key){
          console.log('Non-sector', scenario.sectors);
          continue;
        }*/
        sec.id = `sectors.${sec.key}`;
        s[sec.key] = sec;
        if(sec.column > maxCol) maxCol = sec.column;
        if(sec.row > maxRow) maxRow = sec.row;
        let h = [];
        for(let i = 0; i < sec.harbingers; i++){
          h = [...h, takeToken('harbinger')];
        }
        sec.harbingers = h;
        if(sec.fleets && typeof sec.fleets == 'string'){
          let [owner, num, type] = sec.fleets.split('_');
          if(!type) type = 'corvette';
          sec.fleets = [
            {
              owner,
              type,
              ...takeToken(type),
              num
            }
          ];
        }
        if(sec.glory){
          let glories = [];
          for(let g of sec.glory){
            glories = [...glories, takeToken(`glory${g}`)];
          }
          sec.glory = glories;
        }
        if(sec.bounty){
          let bounties = [];
          for(let i = 0; i < sec.bounty; i++){
            bounties = [...bounties, takeToken('bounty')];
          }
          sec.bounty = bounties;
        }
        if(sec.reclaim){
          let tokens = [];
          for(let i = 0; i < sec.reclaim; i++){
            tokens = [...tokens, takeToken('reclaim')];
          }
          sec.reclaim = tokens;
        }
        if(sec.fleets){
          let newFleets = [];
          for(let f of sec.fleets){
            let n = {
              owner: f.owner,
              type: f.type,
              cubes: [],
              ...takeToken(f.type) // Not a separate ship ID
            };
            for(let _ of Array(f.num)){
              n.cubes.push(takeToken(`fleet_${f.owner}`))
            }
            newFleets.push(n);
          }
          sec.fleets = newFleets;
        }
        if(sec.fallen_house){
          sec.fallen_house = scenario.fallenHouses[fhIndex++];
          sec.population = sec.fallen_house.fallen.pop;
          sec.corrupted = takeToken('corruption');
        }
      }
      s.cols = maxCol+1;
      s.rows = maxRow+1;
      s.voidstorms = scenario.voidstorms;
      s.distances = generateDistances(s);
      s.havens = scenario.havens;
      scenario.sectors = s;
      return scenario;
    }

    function setupTechs(houseInfo){
      // Set up tech market
        // !!TODO still need player tech
        
        if(scenario.type == 'coop'){
          scenario.techs = {
            basic: [...houseInfo.basicTechs.map(t => ol(t))],
            improved: [...houseInfo.improvedTechs.map(t => ol(t))]
          }; // and player one
          if(scenario.players > 1){
            // Add basic tech
          }
        }else if(scenario.specific_techs){
          // specific ones
          let fullList = techs.filter(t => scenario.specific_techs.some(tech => tech.name == t.name));
          scenario.techs = {
            basic: fullList.filter(t => t.type == 'basic').map(t => ol(t)),
            improved: fullList.filter(t => t.type == 'improved').map(t => ol(t)),
          }
        }else{
          scenario.techs = {
            basic: [],
            improved: []
          }; 
          alert('Tech setup needed');
        }
    }

    function setupBoards(scenario){
      // agenda board and galactic board
      
      if(!scenario.events) scenario.events = {};
      
      for(let i = 1; i <= 3; i++){
        if(scenario.events[`cycle_${i}`]){
          $state.events[`cycle_${i}`] = galacticEvents[`cycle_${i}`].filter(e => scenario.events[`cycle_${i}`].some(c => e.id.endsWith(c))).map(c => ol(c));
        }else{
          $state.events[`cycle_${i}`] = galacticEvents[`cycle_${i}`].filter(e => !e.id.endsWith('T')).map(c => ol(c)); // just not Tutorials
        }
        shuffle($state.events[`cycle_${i}`]);
      }

     

      // Galactic board
      shuffle(scenario.techs.improved);
      if(scenario.opening_improved){
        $state.galactic_board.improved_techs = scenario.opening_improved.map(t => scenario.techs.improved.find(tech => tech.name == t)).map(t => [t]);
        //cenario.techs.improved.filter(t => scenario.opening_improved.includes(t.name)).map(t => [t]);
        if(scenario.improved_deck){
          $state.improved_deck = scenario.improved_deck.map(t => scenario.techs.improved.find(tech => tech.name == t));
        }else{
          $state.improved_deck = scenario.techs.improved.filter(t => !scenario.opening_improved.includes(t.name));
        }
        
      }else{
        $state.galactic_board.improved_techs = scenario.techs.improved.slice(0, 4).map(t => [t]);
        $state.improved_deck = scenario.techs.improved.slice(4);
      }
     
      if(scenario.players == 1){
        $state.galactic_board.trade_tokens = [takeToken('trade'), takeToken('trade'), takeToken('trade'), takeToken('trade'), takeToken('trade')];
      }else if(scenario.players == 2){
        $state.galactic_board.trade_tokens = [takeToken('trade'), takeToken('trade'), takeToken('trade'), takeToken('trade'), takeToken('trade'), takeToken('trade')];
      }else if(scenario.players == 3){
        $state.galactic_board.trade_tokens = [[takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')]];
      }else{
        $state.galactic_board.trade_tokens = [[takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')], [takeToken('trade'), takeToken('trade')]];
      }
     
      // Agenda board
      for(let k of Object.keys(agendas)){
        shuffle(agendas[k]);
        if(scenario.opening_agendas){
          let opener = agendas[k].find(a => scenario.opening_agendas.includes(lo(a).ref));
          let rest = agendas[k].filter(a => lo(a).ref != lo(opener).ref);
          agendas[k] = [opener, ...rest];
        }

        agendas[k] = agendas[k].map(t => ol(t));
        $state.agenda_board[k] = {
          ...$state.agenda_board[k],
          offer: agendas[k][0],
          deck: [...agendas[k].slice(1)]
        }
        logAvailable(agendas[k][0]);
      };

      console.log($state.agenda_board)

      if(scenario.type == 'coop'){
        // setup crisis board, alert cards, etc.
        /* crisis_board: {
            current_alert: null,
            current_crisis: null,
            military: [],
            economic: [],
            catastrophes: [],
            crisis_discard: [],
            alert_discard: []
        },
        events: {},
        crisis_decks: {},
        war_deck: [],*/
        $state.difficulty = chosenDifficulty;
        $state.difficultyCard = {
          id: 'difficulty_'+$state.difficulty
        };
        let level = difficultyLevels[$state.difficulty];
        let war = warCards.filter(w => w.ref.includes($state.difficulty));
        shuffle(war);
        $state.war_deck = war;
        let now = level.cycle_1;
        for(let k of Object.keys(crisisCards)){
          $state.crisis_decks[k] = [...crisisCards[k].map(c => ol(c))];
          shuffle($state.crisis_decks[k]);
        }
        
        // Make the draw deck for cycle 1
        $state.crisis_board.alert_deck = makeAlertDeck(1);
        shuffle($state.crisis_board.alert_deck);
        //setupCoopAlertDeck(1);

        
        if(now.setup){
          // Add the setup cards/harbingers
          for(let s of now.setup){
            if(s == 'harbinger'){
              alert('harbinger should not appear in cycle 1 setup!')
            }else{
              //let starter = [...$state.crisis_decks.level_0];
              shuffle($state.crisis_decks.level_0);
              let i = $state.crisis_decks.level_0.findIndex(c => lo(c).type == s || lo(c).type == 'general');
              let c = $state.crisis_decks.level_0[i];
              logEvent({
                type: 'stats',
                crisis: c.id,
                crisis_added: true
              });
              logAvailable(c);
              $state.crisis_decks.level_0.splice(i, 1);
              $state.crisis_board[s].push(c); // Shouldn't cause any problems in setup because there'll be nothing much there
            }
          }
        }

        // Make the heroic/joint deck
        let special = ($state.players.length == 1 ? heroic_focus : joint_focus).map(c => ol(c));
        shuffle(special);
        if(scenario.opening_special_focus){
          $state.galactic_board.special_focus.river = special.filter(s => scenario.opening_special_focus.some(f => lo(s).matches == f)).map(c => [c]);
          $state.galactic_board.special_focus.deck = special.filter(s => !scenario.opening_special_focus.some(f => lo(s).matches == f))
        }else{
          if($state.players.length == 1){
            special = special.filter(c => lo(c).name.endsWith('Leadership') || [...$state.players[0].focus.available, ...$state.players[0].focus.discard].some(f => lo(f).name == lo(c).matches));
          }
          let noInnoSpecial = special.filter(c => !lo(c).name.endsWith('Innovation'));
          let startingThree = noInnoSpecial.slice(0, 3);
          let rest = special.filter(s => !startingThree.some(c => lo(c).name == lo(s).name));
          $state.galactic_board.special_focus.river = startingThree.map(c => [c]);
          $state.galactic_board.special_focus.deck = rest;
          
        }
        

        for(let r of $state.galactic_board.special_focus.river){
          logAvailable(r[0]);
        }
      }
      
      return scenario;
    }

    function makeTechGrid(){
      let grid = [];
      let dict = {};
      for(let t of $state.basic_techs.flatMap(a => a).sort((a,b) => a.name.localeCompare(b.name))){
        if(!dict[t.name]) dict[t.name] = [];
        dict[t.name].push(t);
      }

      for(let k of Object.keys(dict).sort((a,b) => a.localeCompare(b))){
        grid.push(dict[k].sort((a,b) => b.influence - a.influence)); // Put the smallest value one on top
      }
      $state.basic_techs = grid;
    }

    async function fillFleets(p, sector, info){
      let deployed = 0;
      for(let f of info.fleets){
        f.owner = p.colour;
        f.cubes = [];
        deployed += f.num;
        for(let _ of Array(f.num)){
          await moveFleet(p, 'inactive', sector.id, 'setup', f.type);
        }
      }
      return deployed;
    }

    function removeDuplicates(sector, info, key){
      let elements = info[key] || [];
      for(let i of sector[key]){
        let index = elements.findIndex(inst => inst == i.value);
        if(index != -1) elements = [...elements.slice(0, index), ...elements.slice(index+1)];
      }
      return elements;
    }

    async function setupSector(p, sector, info){
      let installations = removeDuplicates(sector, info, 'installations');
      let guilds = removeDuplicates(sector, info, 'guilds');
      for(let i of installations){
        moveBitTo(topToken(i), sector.installations);
      }
      for(let g of guilds){
        moveBitTo(topToken(g), sector.guilds);
      }
      if(info.corrupted){
        moveBitTo(topToken('corruption'), sector, 'corrupted');
      }
      if(info.population) sector.population = info.population;

      await fillFleets(p, sector, info);
    }

    function setFixedHouses(){
      for(let i = 0; i < players; i++){
        if(chosenScenario.fixedHouses.length > i) playerInfo[i].house = chosenScenario.fixedHouses[i];
      }
    }

    async function setupOriginCard(p, side){
      let o = originCards.find(o => o.house == p.house && o.side == side);
      let ownTechs = techs.filter(t => t.name == o.tech);
      p.side = side;
      p.techs = [ownTechs.find(t => t.type == 'basic' && t.influence == 4)];
      p.starterTechName = p.techs[0].name
      p.improved_tech = [ownTechs.find(t => t.type == 'improved')];
      logAvailable(p.improved_tech);
      if(players > 2){
        // Reset market and then add necessary tech
        $state.basic_techs = [...$state.basic_techs, ownTechs.find(t => t.type == 'basic' && t.influence == 0)];
        makeTechGrid();
      }
  
      let home = getSectorList($state.sectors).find(s => s.type == 'home' && s.colour == p.colour);
      let outpost = getSectorList($state.sectors).find(s => s.special == 'outpost' && isAdjacent(s, home));

      

      await setupSector(p, home, o.home);
      await setupSector(p, outpost, o.outpost);   

      for(let _ of Array(o.active_fleet)){
        await moveFleet(p, 'inactive', 'active');
      }

      $state.sectors[home.key] = home;
      $state.sectors[outpost.key] = outpost;

      p.resources = jsonpatch.deepClone(o.resources);
      
      if(o.track_advance){
        for(let t of o.track_advance){
          p.tracks[t].index++;
        }
      }

      p.boosts = o.boosts; // any production boosts
      
      let agenda = startingAgendas.find(a => a.house == p.house && a.type == 'starting' && a.id.toLowerCase().endsWith(p.side.toLowerCase()));
      p.agendas[0].card = agenda;
      p.agendas[1].card = false;
      
      if(p.house == 'Marqualos'){
        let extraAgenda = startingAgendas.find(a => a.house == p.house && a.type == 'extra' && a.id.endsWith(`${p.side.toLowerCase()}2`));
        p.agendas[1].card = extraAgenda;
      }

      if(o.loose_trade){
        if(!p.starting_action) p.starting_action = [];
          p.starting_action = [...p.starting_action, {
            verb: 'gain_trade',
            num: o.loose_trade,
            gain_benefits: false
          }];
      }

      if(o.bounty){
        if(!p.starting_action) p.starting_action = [];
        p.starting_action = [...p.starting_action, {
          verb: 'gain_bounty',
          num: o.bounty
        }];
      }

      if(o.agenda){
        for(let a of o.agenda){
          let agenda = $state.agenda_board[a].deck[0];
          $state.agenda_board[a].deck = $state.agenda_board[a].deck.slice(1);
          p.agenda_hand.push(agenda);
        }
      }

      if(o.starting_action){
        if(!p.starting_action) p.starting_action = [];
        p.starting_action = [...p.starting_action, o.starting_action];
      }
    }

    function setupPlayer(i){
      // Including tech card(s) and origins

      $state.players[i] = {
        ...$state.players[i],
        ...playerInfo[i]
      }

      let p = $state.players[i];

      for(let k of Object.keys(p.tracks)){
        p.tracks[k].id = `tracks.${p.colour}_${k}`; // So corruption can go there
      }
      for(let k of Object.keys(p.agendas)){
        p.agendas[k].id = `agendas.${p.colour}_${k}`; // To select for slotting agendas
      }

      p.techs = techs.filter(t => house(p).techs.includes(t.name) && t.influence == 4).sort((a,b) => originCards.find(o => o.tech == a.name).side.localeCompare(originCards.find(o => o.tech == b.name).side)); // For now, so you can see them

      let agendas = startingAgendas.filter(a => a.house == p.house && a.type == 'starting');
      p.agendas[0].card = agendas[0];
      p.agendas[1].card = agendas[1];

      
      makeTechGrid();

      p.focus.available = jsonpatch.deepClone(basic_focus[p.colour]);
      for(let i = 0; i < p.focus.available.length; i++){
        let f = p.focus.available[i];
        if(special_focus[`${p.house}_${f.name}`]){
          p.focus.available[i] = jsonpatch.deepClone(special_focus[`${p.house}_${f.name}`]);
          f = p.focus.available[i];
        }
        logAvailable(f);
      }
      
      p.focus.discard = p.focus.available.filter(c => c.special == 'discard_cycle_1').map(t => ol(t));
      p.focus.available = p.focus.available.filter(c => c.special != 'discard_cycle_1').map(t => ol(t));

      let home = getSectorList($state.sectors).find(s => s.type == 'home' && !s.colour || s.colour == p.colour);
      let outpost = getSectorList($state.sectors).find(s => s.special == 'outpost' && isAdjacent(s, home));
      let specialHome = sectorTypes[`home_${p.house.toLowerCase()}`];
      if(specialHome){
        // Special home available, so use that
          specialHome.house_home = p.house.toLowerCase()
      }else{
        specialHome = {};
      }
      home = {
        ...home,
        ...specialHome,
        bounty: [],
        reclaim: [],
        glory: [],
        //...o.home,
        colour: p.colour
      };
      outpost = {
        ...outpost,
        bounty: [],
        reclaim: [],
        glory: [],
        //...o.outpost,
      };

      $state.sectors[home.key] = home;
      $state.sectors[outpost.key] = outpost;

      let t;
      p.fleets.inactive = [];
      p.fleets.active = [];
      while(t = takeToken(`fleet_${p.colour}`)){
        p.fleets.inactive.push(t); // All inactive until origin card selected
      }

      p.glory = [takeToken('glory2')];

      for(let a of p.agendas){
        if(a.corrupted) a.corrupted = takeToken('corruption')
      }

      console.log(p)
    }

    function setupFallenHouses(scenario){
      let ret = {};
      if(scenario.fallenHouses){
        ret = {
          fallenHouses: scenario.fallenHouses.map(fh => {return {...allHouses.find(h => h.name == fh), id: `fallen_houses.${fh}`}}),
          
          //allHouses.filter(h => scenario.fallenHouses.includes(h.name)).map(h => {return {...h, id: `fallen_houses.${h.name}`}}),
          basicTechs: techs.filter(t => t.type == 'basic' && scenario.fallenHouses.includes(t.house)).map(t => jsonpatch.deepClone(t)),
          improvedTechs: techs.filter(t => t.type == 'improved' && scenario.fallenHouses.includes(t.house)).map(t => jsonpatch.deepClone(t)),
        }
      }else if(scenario.specific_techs){
        ret = {
          fallenHouses: [], // none in tutorial...
          basicTechs: techs.filter(t => t.type == 'basic' && scenario.specific_techs.includes(t.name)).map(t => jsonpatch.deepClone(t)),
          improvedTechs: techs.filter(t => t.type == 'improved' && scenario.specific_techs.includes(t.name)).map(t => jsonpatch.deepClone(t)),
        }
      }else{
        ret = getHouses();
      }
      if(scenario.no_influence_techs){
          let newBasic = [];
          for(let t of ret.basicTechs){
            if(scenario.no_influence_techs.includes(t.name) && !t.influence){
              newBasic.push(t)
            }else if(!scenario.no_influence_techs.includes(t.name) && t.influence){
              newBasic.push(t);
            }
          }
          ret.basicTechs = newBasic;
        }
        return ret;
    }


   function setup(resetVS = true){

    console.log('setting up');

resetStores();
if(gameSeed) $state.randomSeed = gameSeed;
setupSeed();
if(!gameSeed) gameSeed = $state.randomSeed;
if(preselectedFocus) $state.preselectedFocus = true;
if(strictMode) $state.strictMode = true;

//scenario = jsonpatch.deepClone(scenarios.find(s => s.title == 'First Contact' && s.players == 1));
// @ts-ignore
let scenario = jsonpatch.deepClone(chosenScenario);



playerHouses = houses.filter(h => playerInfo.slice(0, players).some(p => p.house == h.name));

let houseInfo = setupFallenHouses(scenario);
scenario.fallenHouses = houseInfo.fallenHouses;

scenario.techs = {
  basic: houseInfo.basicTechs,
  improved: houseInfo.improvedTechs,
}

for(let t of [...scenario.techs.basic]){ 
  logAvailable(t);
}

$state.basic_techs = [...scenario.techs.basic];

setupTokens(scenario);
scenario = cleanupScenario(scenario);


if(scenario.fixedSide){
  $state.players[0].side = scenario.fixedSide;
  $state.fixedSide = scenario.fixedSide;
}

$state.mode = scenario.type;
$state.scenario = scenario.name;
//$state.scenario = {...scenario, sectors: undefined}; // !! TODO remove and/or simplify to avoid code duplication...
$state.sectors = scenario.sectors;
$state.voidstorms = scenario.voidstorms;
if(scenario.havens) $state.havens = scenario.havens;

for(let i = 0; i < $state.players.length; i++){
  setupPlayer(i);
  $state.spare_cards.push(...getOrigins($state.players[i].house))
}

scenario = setupBoards(scenario); // so everything is ready when we move across

// Convert guilds and installations as necessary 

for(let s of getSectorList($state.sectors)){
  logAvailable(s);
  if(s.guilds){
    let newG = [];
    for(let g of s.guilds){
      newG.push(takeToken(g));
    }
    s.guilds = newG;
  }

  if(s.installations){
    let newI = [];
    for(let i of s.installations){
      newI.push(takeToken(i));
    }
    s.installations = newI;
  }

  if(s.corrupted) s.corrupted = takeToken('corruption');
  $ui.sectorImages[s.id] = getBGImage(s);
}

// Assemble big list of everything. Is this the right place?
console.log($state);
clearList();
makeList(true);
console.log($state);

if(resetVS) setViewScale();

for(let p of $state.players){
  updateSkirmish(p);
}

$state.ready = true;
//$ui.noTransitions = false;
console.log($state);

   }


export async function start(config){
  chosenScenario = scenarios.find(s=>s.name===config.scenario && s.players===1 && ['coop','tutorial'].includes(s.type));
  if(!chosenScenario) throw Error('Unknown solo scenario');
  chosenDifficulty=config.difficulty||'easy'; gameSeed=config.seed; preselectedFocus=!!config.preselected;
  playerInfo=[{name:'You',colour:'blue',house:config.house}];
  setup(false); prefs.update(p=>({...p,actionPause:0,announcePhases:false,announcementPause:0,autoClick:false}));
  $state.playTimes=[{start:0}];
  await setupOriginCard($state.players[0], config.side||'A');
  clearList(); makeList(true); updateSkirmish($state.players[0]);
  $res.lastState=jsonpatch.deepClone($state);
  ui.update(u=>u); state.update(s=>s);
  await takeTurns();
}
