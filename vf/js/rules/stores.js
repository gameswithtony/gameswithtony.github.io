// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import {writable, get} from './runtime.js';
import * as jsonpatch from './runtime.js';

export let playerColours = ['blue', 'yellow', 'green', 'purple'];

export let playerColoursCSS = {
    blue: '#0CA1D8',
    yellow: '#DDBE10',
    green: '#99C47F',
    purple: '#B7385E',
    voidborn: '#C56F44'
}

export function basicHeight(vs){
    return vs * 694;
}

export let state = writable(setupState());
export let ui = writable(setupUI());
export let res = writable(setupRes());
export let live = writable(setupLive());
export let params = writable({
    customScenariosByName: {},
    customScenariosByURL: {},
    openingTab: 0,
    viewGame: false,
    customise: {
        name: '',
        url: '',
        player: {
            use: false,
            choices: []
        },
        side: {
            use: false,
            choices: []
        },
        scenario: {
            use: false,
            choice: false,
            custom: false
        },
        fallen: {
          use: false,
          choices: []
        },
        techs: [],
        agendas: {
          use: false,
          choices: {
            wealth: false,
            support: false,
            might: false,
            dominance: false
          }
        },
        events: {
          use: false,
          choices_1: [],
          choices_2: [],
          choices_3: []
        },
        special_focus: {
            use: false,
            choices: []
        },
        improved_techs: {
            use: false,
            choices: []
        },
        improved_deck: {
            use: false,
            choices: []
        }
      }      
});

export let prefs = writable({
    showHover: true,
    showPreview: true,
     previewScale: 3,
    foregroundScale: 3,
    //basicHeight: 20,
    forceNotTouch: false,
    //viewScale: 1/30,
    //imagePrefix: 'half',
    //viewScale: 1/35, //1/70,
    viewScale: 1/70,
    origViewScale: 1/70,
    baseViewScale: 1/40,
    debugLogs: true,
    actionPause: 0,
    debugSelectAll: true,
    debugSectorKeys: false,
    preloadImages: false, //true, //
    singleClicks: true,
    autoClick: false,
    maxUndos: -1, //20, // -1 = keep all
    compressSave: false,
    announcePhases: false,
    announcementPause: 0,
    bigImagePreviewScale: 0.5,
    undoDiffs: true,
    enableReplay: true,
    viewIDs: false,
    agendaScores: false,
    drags: {
        
    },
    showAllRoutes: false,
    pregenRandomCount: 100,
});

function setupRes(){
    return {
        undos: [],
        redos: [],
        lastState: {},
        version: '1.2.5 (2 Aug 2025)',
        firstState: {},
        everyChoice: []
        //log: [],
    }
}

function setupLive(){
    return {
        // Frequently updated, so minimise reactive statements
        preview: null,
        previewType: null,
        hover: null,
        shouldHideHover: false,
        hoveringFacedown: false
    }
}

export function resetStores(){
    state.update(s => {
        return setupState();
    });
    ui.update(ui => {
        return {
            ...setupUI(),
            noTransitions: ui.oneScreen,
            lookupTable: ui.lookupTable,
            reverseLookup: ui.reverseLookup,
        };
    });
    live.update(live => {
        return setupLive();
    })
    res.update(res => {
        return setupRes();
    })
}

function defaultPlayer(num){
    return {
        name: `Player ${num+1}`,
        colour: playerColours[num], 
        house: 'Valnis',
        side: 'A',
        influence: 10,
        tracks: {
            society: {
                index: 0,
                corrupted: false
            },
            statecraft: {
                index: 0,
                corrupted: false
            },
            economy: {
                index: 0,
                corrupted: false
            }
        },
        loose_trade: [],
        kept_corruption: [],
        satisfied_upkeep: 0,
        resources: {
            food: {
                level: 0,
                yield: 0,
                store: 0
            },
            materials: {
                level: 0,
                yield: 0,
                store: 0
            },
            energy: {
                level: 0,
                yield: 0,
                store: 0
            },
            credits: {
                level: 0,
                yield: 0,
                store: 0
            },
            science: {
                level: 0,
                yield: 0,
                store: 0
            }
        },
        agenda_hand: [],
        agendas: [
            {
                incorruptable: true,
                corrupted: false,
                card: false,
                trade: false
            },
            {
                corrupted: false,
                card: false,
                trade: false
            },
            {
                corrupted: false,
                card: false,
                trade: false
            },
            {
                corrupted: true,
                card: false,
                trade: false
            }
        ],
        techs: [],
        tech_limit: 5,
        fallen_claimed: false,
        improved_tech: [],
        fleets: {
            inactive: 14,
            active: 0,
        },
        focus: {
            available: [],
            current: false,
            current_agenda: false,
            current_trade: false,
            discard: []
        },
        bounty: [],
        reclaim: [],
        glory: [],
        turn_order: 0
    };
}

export function setupState(){
    return {
        random: {},
        randomIndex: 0,
        playTimes: [],
        mode: 'coop',
        difficulty: 'medium',
        difficultyCard: {
            id: 'difficulty_medium'
        },
        numPlayers: 1,
        strictMode: false, // Limited undo
        sectors: [],
        ended: false,
        voidstorms: [],
        scenario: false,
        currentPlayer: 0,
        activePlayer: 0,
        turn_order: [0],
        galactic_board: {
            trade_tokens: [],
            improved_techs: [],
            current_event: null,
            special_focus: {
                deck: [],
                discard: [],
                river: []
            },
        },
        improved_deck: [],
        chooseCode: 0,
        foreground: {},
        crisis_board: {
            current_alert: null,
            current_crisis: null,
            military: [],
            economic: [],
            catastrophes: [],
            alert_deck: [],
            consumed_techs: []
        },
        delayedReactions: [],
        havens: [],
        events: {},
        crisis_decks: {},
        war_deck: [],
        crisis_discards: {
            level_0: [],
            level_1: [],
            level_2: [],
            level_3: []
        },
        war_discard: [],
        agenda_board: {
            support: {
                key: 'support',
                id: 'agenda_support',
                deck: [],
                discard: [],
                offer: null,
                corrupted: false
            },
            might: {
                key: 'might',
                id: 'agenda_might',
                deck: [],
                discard: [],
                offer: null,
                corrupted: false
            },
            wealth: {
                key: 'wealth',
                id: 'agenda_wealth',
                deck: [],
                discard: [],
                offer: null,
                corrupted: false
            },
            dominance: {
                key: 'dominance',
                id: 'agenda_dominance',
                deck: [],
                discard: [],
                offer: null,
                corrupted: false
            },
            
            
        },
        spare_tokens: {},
        discard_tokens: {},
        available: {},
        unlimited_tokens: {},
        spare_cards: [],
        recovered_bits: [],
        cache: {},
        log: [],
        basic_techs: [],
        players: [
            jsonpatch.deepClone(defaultPlayer(0))
        ],
        turn: {},
        turnInfo: {},
        bigList: {},
        genericTokens: [],
        focus: {},
        customNum: 400
    }
}

function setupUI(){
    return {
        sectorHighlights: [],
        highlightAdjacent: false,
        tab: 'setup',
        viewing: 0,
        nextSkirmishTarget: [],
        currentSkirmishView: false,
        waiting: [],
        animate: false,
        selection: [],
        selectionNum: 1,
        oneScreen: false ,
        showing: {
            Setup: true
        },
        games: [],        // filtered + sorted, for display
        filteredGames: [], // filtered only – order-independent consumers key off this
        allGames: [],
        lookupTable: {},
        reverseLookup: {},
        reactions: [],
        sectorPreview: {},
        sectorImages: {},
        undoFunc: false,
        announcement: false,
        gameComponent: false,
        foregroundComponent: false,
        logElement: null,
        dragPosition: {
            x: 0,
            y: 0
        },
        random: [],
        rng: false
    }
}