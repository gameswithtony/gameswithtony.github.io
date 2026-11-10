// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { actions, playerTokenCount } from "./actions.js";
import { activePlayer, addReaction, doAction, executeActions, expandAction, getReadableDescription, log, logEvent, playerTrade, renderCost } from "./game.js";
import { get } from './runtime.js';
import { state, ui } from "./stores.js";
import * as jsonpatch from './runtime.js';
import { all, assembleList, isIn, lo, moveBitTo, ol, possArray, randomElements, shuffle, upperInitial, at, type} from "./utils.js";
import { choose, doActionPause, pause } from "./ui.js";
import { returnToken, topToken } from "./tokens.js";
import { controlledBy, fleetCount, getSectorList, guilds, neighbourKeys, neighbours, playerSectors } from "./sectors.js";
import { resolveSkirmish, updateSkirmish } from "./combat.js";
import { getCostInfo, pay } from "./costs.js";
import { getTier } from "./tracks.js";
import { deployedFleet } from "./fleets.js";
import { testNum } from "./agendas.js";
import { singleUpkeep } from "./resources.js";
import { house } from "./houses.js";
import { logAvailable } from "./stats.js";
import { techs } from "./techs.js";
import { isPreferred } from "./focus.js";
import { newInformation } from "./undo.js";

export let difficultyLevels = {
  easy: {
    baseScore: 60,
    cycle_1: {
      alert_1: 6
    },
    cycle_2: {
      alert_1: 3,
      alert_2: 2,
      war: 1
    },
    cycle_3: {
      alert_2: 4,
      war: 1
    },
    
  },
  medium: {
    baseScore: 100,
    cycle_1: {
      war: 1,
      setup: ['economic', 'military'],
      alert_1: 4,
      alert_2: 1,
    },
    cycle_2: {
      war: 1,
      alert_1: 1,
      alert_2: 3,
      alert_3: 1,
    },
    cycle_3: {
      setup: ['harbinger'],
      alert_2: 3,
      alert_3: 1,
      war: 1
    },
  },
  hard: {
    baseScore: 140,
    cycle_1: {
      setup: ['economic', 'military'],
      alert_1: 2,
      alert_2: 3,
      war: 1
    },
    cycle_2: {
      setup: ['harbinger'],
      alert_2: 2,
      alert_3: 2,
      war: 2
    },
    cycle_3: {
      alert_2: 2,
      alert_3: 2,
      war: 1
    },
  },
} 

export let scoreWeights = {
  base_score: 1,
  rifts: 30,
  empty_safe_havens: 20,
  catastrophes: 20,
  sector_harbingers: 10,
  consumed_techs: 5,
  crises: 5,
  fallen_houses: 3,
  corruption: 2,
  voidborn_population: 1
}

export async function showScoreBreakdown(score){
  let text = `<div>
  ${Object.keys(score.elements).map(e => `<div>${e.split('_').map(t => upperInitial(t)).join(' ')}: ${score.elements[e] * scoreWeights[e] } (${score.elements[e]} x ${scoreWeights[e]})</div>`).join('</div><div>')}
  </div>`;
  //text += await showDifficultyInfo()
  await pause(`Score breakdown: ${text}`);
}

export function allCrisesOnBoard(filter = false){
  let list = [get(state).crisis_board.current_crisis, ...get(state).crisis_board.military, ...get(state).crisis_board.economic].filter(c => c && !c.id.startsWith('harbinger'));
  if(filter){
    filter = possArray(filter);
    list = list.filter(c => filter.includes(lo(c).type));
  }
  return list;
}

export function voidbornScore(s){
  if(get(state).mode != 'coop') return {
    score: 0,
    elements: []
  }
  // s is state
  let scoreElements = {
    base_score: difficultyLevels[s.difficulty].baseScore,
    rifts: getSectorList(s.sectors).filter(sec => sec.type == 'rift').length,
    empty_safe_havens: s.havens.filter(h => h.cubes.length < h.capacity).length,
    catastrophes: s.crisis_board.catastrophes.length,
    sector_harbingers: getSectorList(s.sectors).flatMap(sec => sec.harbingers).length,
    consumed_techs: s.crisis_board.consumed_techs.length,
    crises: [...s.crisis_board.military, ...s.crisis_board.economic].filter(c => !c.id.startsWith('harbinger')).length,
    fallen_houses: getSectorList(s.sectors).filter(sec => sec.fallen_house).length,
    corruption: all('corruption', (c) => isIn(c, 'corrupted')).length, // !! TODO does this work?
    voidborn_population: getSectorList(s.sectors).filter(sec => controlledBy(sec, 'voidborn')).reduce((a,c) => a + (c.population || 0), 0)
  }

  let score = Object.keys(scoreElements).map(e => scoreElements[e] * (scoreWeights[e] || 1)).reduce((a, c) => a + c, 0);

  return {
    score,
    elements: scoreElements
  }
}


export let boardCosts = {
  military: [0, 1, 2, 3, 4],
  economic: [
    {},
    {materials: 1, energy: 1},
    {materials: 1, energy: 1, science: 1},
    {materials: 2, energy: 2, science: 1},
    {materials: 2, energy: 2, science: 2},
  ]
}

// 'easy_war1','easy_war2','easy_medium_war1','easy_medium_war2','medium_hard_war1','medium_hard_war2','hard_war1','hard_war2']

export let warCards = [
  {
    ref: 'easy_war1',
    cycle_1_mods: {
      voidborn_power: -1
    },
    cycle_2_mods: {
      defender_reward: 'gain_bounty'
    },
    cycle_3_mods: {
      voidborn_salvoAbsorption: 1
    }
  },
  {
    ref: 'easy_war2',
    cycle_1_mods: {
      defender_reward: 'upgrade_glory'
    },
    cycle_2_mods: {
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_3_mods: {
      defender_reward: {
        verb: 'place_token',
        type: 'defense',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    }
  },
  {
    ref: 'easy_medium_war1',
    cycle_1_mods: {
      voidborn_power: -1
    },
    cycle_2_mods: {
      defender_reward: {
        verb: 'place_token',
        type: 'defense',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_3_mods: {
      voidborn_power: 1
    }
  },
  {
    ref: 'easy_medium_war2',
    cycle_1_mods: {
      defender_reward: {
        verb: 'gain_influence',
        num: 2,
        from: 'combat'
      }
    },
    cycle_2_mods: {
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_3_mods: {
      defender_reward: 'gain_corruption'
    }
  },
  {
    ref: 'medium_hard_war1',
    
    cycle_1_mods: {
      defender_reward: 'gain_bounty'
    },
    cycle_2_mods: {
      voidborn_power: 1,
      defender_reward: 'upgrade_glory'
    },
    cycle_3_mods: {
      voidborn_approachAbsorption: 1,
      defender_reward: {
        verb: 'place_token',
        type: 'defense',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    }
  },
  {
    ref: 'medium_hard_war2',
    cycle_1_mods: {
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_2_mods: {
      voidborn_power: 1,
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_3_mods: {
      voidborn_salvoAbsorption: 2,
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    }
  },
  {
    ref: 'hard_war1',
    cycle_1_mods: {
      voidborn_power: 1,
      defender_reward: 'gain_bounty'
    },
    cycle_2_mods: {
      voidborn_power: 1,
      defender_reward: {
        verb: 'place_token',
        type: 'defense',
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    },
    cycle_3_mods: {
      voidborn_power: 1,
      defender_reward: 'gain_corruption'
    }
  },
  {
    ref: 'hard_war2',
    cycle_1_mods: {
      
    },
    cycle_2_mods: {
      defender_reward: 'gain_corruption'
    },
    cycle_3_mods: {
      voidborn_initiative: 5,
      defender_reward: {
        verb: 'place_token',
        type: 'voidborn',
        num: 2,
        place: 'voidborn',
        restriction: 'adjacent',
        vf_fallback: true
      }
    }
  },
]

for(let w of warCards){
  w.id = `alert_cards.${w.ref}`;
  w.type = 'war';
}

export let crisisCards = {
    level_0: [
      {
        name: 'Head of the Spear',
        type: 'general',
        ref: 'S1',
        after: {
          verb: 'gain_tech',
        },
        condition: (p, params) => {
          let gained = at(params.obj.id);
          if(!gained) return false;
          return gained.type == 'improved' && gained.name == p.starterTechName;
        }
      },
      {
        name: 'Destiny Awaits',
        type: 'general',
        ref: 'S2',
        whenever: (p) => p.glory.reduce((a,c) => a + c.value, 0) >= 8 // whenever are checked at every step change? Or at end of action? or turn?
      },
      {
        name: 'Persevering Population',
        type: 'general',
        ref: 'S3',
        whenever: (p) => playerSectors(p).filter(s => !s.corrupted && s.population >= 4).length >= 2
      },
      {
        name: 'Golden Age',
        type: 'general',
        ref: 'S4',
        whenever: (p) => Object.keys(p.resources).reduce((a, c) => a + p.resources[c].yield, 0) >= 20
      },
      {
        name: 'Base of Operations',
        type: 'general',
        ref: 'S5',
        whenever: (p) => playerSectors(p).filter(s => !s.corrupted).length >= 3 && deployedFleet(p, playerSectors(p).filter(s => !s.corrupted)).length >= 8
      }
      ],
    level_1: [
      {
        name: 'Price of Greatness',
        type: 'economic',
        ref: 1,
        after: {
          verb: 'play_agenda',
        },
        must: {
          verb: 'spend_resource',
          num: 1,
        },
        discard: {
          either_or: ['recall',
                      {
                        verb: 'place_token',
                        type: 'voidborn',
                        place: 'rift'
                      }
            ]
        }
      },
      {
        name: 'Study the Voidborn',
        ref: 2,
        type: 'economic',
        after: {
          verb: 'establish',
          type: 'scientists_guild',
        },
        must: {
            verb: 'recall',
            restriction: 'same_sector'
        },
        discard: {
          verb: 'place_token',
          type: 'voidborn',
          place: 'rift'
        }
      },
      {
        name: 'Stagnating Markets',
        ref: 3,
        type: 'economic',
        before: 'advance_track',
         must: {
            verb: 'spend_resource',
            type: 'credits',
            num: 2
          },
        discard: {
          verb: 'return_token', // return token?
          type: 'bounty',
          num: 2
        }
      },
      {
        name: 'Gates of Sanctuary',
        ref: 4,
        type: 'economic',
        after: 'increase_population',
        condition: (p, params) => (params.place.type == 'home' && params.place.population >= 4),
        discard: {
          verb: 'return_token',
          type: 'reclaim',
        }
      },
      {
        name: 'All That Glitters',
        ref: 5,
        type: 'general',
        before: {
          verb: 'establish',
          type: 'bankers_guild'
        },
        condition: (p, params) => playerTokenCount(p, 'bankers_guild') > (params.built ? 1 : 0),
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            defender_reward: {
              verb: 'gain_influence',
              num: 2,
              from: 'combat'
            }
          }
        }
      },
      {
        name: 'For Tomorrow',
        ref: 6,
        type: 'general',
        duringFocus: 'Prosperity',
        condition: (p, params) => playerTokenCount(p, 'scientists_guild')  > 0,
        discard: {
          verb: 'consume_tech',
          type: 'basic'
        }
      },
      {
        name: 'Imprecise Research',
        ref: 7,
        type: 'general',
        before: {
          verb: 'gain_tech',
        },
        condition: (p, params) => !params.type || params.type == 'basic' || params.type.includes('basic'),
        setParams: {
          type: 'basic',
          noReward: true
        },
        discard: {
          verb: 'spend_resource',
          type: 'science',
          num: 2
        }
      },
      {
        name: 'Evolving Enemy',
        ref: 8,
        type: 'general',
        after: 'gain_tech',
        must: {
          verb: 'place_token',
          type: 'voidborn',
          place: 'voidborn',
          restriction: 'adjacent'
        },
        discard: {
          either_or: [
            'recall',
            {
              verb: 'place_token',
              type: 'voidborn',
              place: 'rift'
            }
          ]
        }
      },
      {
        name: 'Depleting Reserves',
        ref: 9,
        type: 'general',
        duringFocus: 'Production',
        must: {
          verb: 'return_token',
          type: 'bounty',
          num: 2
        },
        discard: {
          verb: 'spend_resource',
          types: {
            food: 1,
            energy: 1,
            materials: 1
          }
        }
      },
      {
        name: 'Cleansing Fire',
        ref: 10,
        type: 'general',
        after: [
          {
            verb: 'remove_corruption',
            fromSpecific: 'tracks',
          },
          {
            verb: 'move_corruption',
            fromSpecific: 'tracks'
          }
        ],
        discard: 'gain_corruption'
      },
      {
        name: 'Reactive Forces',
        ref: 11,
        type: 'general',
        after: 'deploy',
        must: {
          verb: 'place_token',
          type: 'defense',
          place: 'voidborn',
          restriction: 'action_adjacent'
        },
        discard: {
          verb: 'consume_tech',
          type: 'basic'
        }
      },
      {
        name: 'Attrition of War',
        ref: 12,
        type: 'general',
        after: 'gain_trade',
        must: {
          verb: 'spend_resource',
          types: {
            credits: 1
          }
        },
        discard: 'unguild'
      },
      {
        name: 'Tooth and Nail',
        ref: 13,
        type: 'general',
        after: 'build',
        condition: (p, params) =>  !params.place.corrupted,
        must: {
          verb: 'decrease_population',
          restriction: 'same_sector'
        },
        discard: 'deactivate'
      },
      {
        name: 'Power Leak',
        ref: 14,
        type: 'military',
        after: {
          verb: 'build',
          type: 'defense'
        },
        must: {
          verb: 'spend_resource',
          types: {
            energy: 1
          },
          options: {
            wildcards: []
          }
        },
        discard: 'add_voidborn'
      },
      {
        name: 'Compromised Trade Lines',
        ref: 15,
        type: 'military',
        after: {
          verb: 'return_token',
          type: 'trade'
        },
        must: {
          verb: 'place_token',
          type: 'voidborn',
          place: 'rift'
        },
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            defender_reward: 'gain_bounty'
          }
        }
      },
      {
        name: 'Corrupted but not Broken',
        ref: 16,
        type: 'military',
        whenever: (p) => {
          if(!get(state).turnCache || !get(state).turnCache.deploySectors) return false;
          let count = 0;
          for(let s of get(state).turnCache.deploySectors){
            if(s.corrupted) count += s.count;
          }
          if(count >= 2) return true;
        },
        discard: {
          verb: 'place_corruption',
          place: 'might'
        }
      },
      {
        name: 'Without Fear',
        ref: 17,
        type: 'military',
        before: 'invade',
        condition: (p, params) => params.place.installations.filter(i => i.value == 'defense').length > 0 || params.place.fallen_house,
        discard: {
          verb: 'return_token',
          type: 'trade'
        }
      },
      {
        name: 'Burning Bridges',
        ref: 18,
        type: 'military',
        after: 'establish',
        must: [
            {
              verb: 'return_token',
              type: 'bounty'
            },
            {
              verb: 'return_token',
              type: 'reclaim'
            },
        ],
        discard: {
          either_or: [
            {
              verb: 'unbuild',
              type: 'shipyard'
            },
            {
              verb: 'unbuild',
              type: 'starbase'
            }
          ]
        }
      },
      {
        name: 'Imperial March',
        type: 'military',
        ref: 19,
        before: 'gain_glory',
        condition: (p, params) => {
          return p.glory.reduce((a,c) => a + c.value, 0) >= 5;
        },
        discard: {
          verb: 'consume_tech',
          type: 'basic'
        }
      }
      ],
    level_2: [
      {
        name: 'Progress by the Shadow',
        ref: 25,
        type: 'economic',
        before: 'advance_track',
        condition: (p, params) =>  p.tracks[params.obj].corrupted, // Will the track already be known?? Only if defaults are set – check this is the case
        discard: {
          verb: 'spend_resource',
          type: 'any',
          num: 4
        }
      },
      {
        name: 'Disharmony in Leadership',
        ref: 26,
        type: 'economic',
        afterFocus: 'any',
        condition: (p, params) => get(state).focus && get(state).focus.agenda && !get(state).focus.agendaAction,
        discard: 'resolve_skirmish'
      },
      {
        name: 'Stronghold of Humanity',
        ref: 27,
        type: 'economic',
        before: 'increase_population',
        condition: (p, params) => playerSectors(p).some(s => !s.corrupted && s.population >= 5),
        discard: {
          verb: 'gain_corruption',
          restriction: 'sectors'
        }
      },
      {
        name: 'Debts Come Due',
        ref: 28,
        type: 'economic',
        before: {
          verb: 'return_token',
          type: 'trade'
        },
        must: {
          verb: 'spend_resource',
          types: {
            credits: 2
          }
        },
        discard: {
          both_and: [
            'deactivate',
            {
              verb: 'place_token',
              type: 'voidborn',
              place: 'rift'
            }
          ]
        }
      },
      {
        name: 'Investing in People',
        ref: 29,
        type: 'economic',
        before: {
          verb: 'advance_track',
          obj: 'society'
        },
        must: {
          either_or: [
            {
              verb: 'spend_resource',
              types: {
                science: 2
              }
            },
            {
              verb: 'spend_resource',
              types: {
                credits: 2
              }
            },
          ]
        },
        discard: {
          verb: 'spend_resource',
          types: {
            energy: 4
          }
        }
      },
      {
        name: 'Heart of a New Domineum',
        ref: 30,
        type: 'economic',
        after: 'increase_population',
        condition: (p, params) => params.place.population == 6,
        discard: 'recall'
      },
      {
        name: 'Scientific Breakthrough',
        ref: 31,
        type: 'economic',
        duringFocus: 'Progress',
        condition: (p, params) => get(state).turnCache.overproduced && get(state).turnCache.overproduced.includes('science'),
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            voidborn_power: 1,
            defender_reward: {
              verb: 'place_token',
              type: 'defense',
              place: 'voidborn',
              restriction: 'adjacent' // = adjacent to combat in this situation
            }
          }
        }
      },
      {
        name: 'Centralized Workforce',
        ref: 32,
        type: 'economic',
        after: 'establish',
        condition: (p, params) => params.place && params.sectorPopulation >= 5,
        discard: {
          both_and: [
            {
              verb: 'place_corruption',
              place: 'wealth'
            },
            {
              verb: 'spend_resource',
              types: {
                materials: 2
              }
            }
          ]
        }
      },
      {
        name: 'Secrets of the Novarchs',
        ref: 33,
        type: 'general',
        after: {
          verb: 'gain_influence',
          from: 'tech'
        },
        must: {
          verb: 'gain_corruption',
          restriction: 'agendas'
        },
        discard: {
          both_and: [
            {
              verb: 'place_corruption',
              place: 'dominance'
            },
            {
              verb: 'spend_resource',
              types: {
                science: 1
              }
            }
          ]
        }
      },
      {
        name: 'Forward Planning',
        ref: 34,
        type: 'general',
        before: 'gain_agenda',
        condition: (p, params) => p.agenda_hand.length > 0,
        discard: {
          verb: 'unbuild',
          type: 'defense',
          num: 2 
        }
      },
      {
        name: 'Another Step Forward',
        ref: 35,
        type: 'general',
        after: {
          verb: 'gain_tech',
          type: 'basic'
        },
        condition: (p, params) => p.techs.filter(t => t.type == 'improved').length > 0,
        discard: 'resolve_skirmish'
      },
      {
        name: 'Fatal Experiment',
        ref: 36,
        type: 'general',
        afterFocus: 'Innovation',
        must: {
          verb: 'unguild',
          type: 'scientists_guild'
        },
        discard: {
          verb: 'consume_tech',
          type: 'improved'
        }
      },
      {
        name: 'Panic in the Fleet',
        ref: 37,
        type: 'general',
        afterFocus: 'Conquest',
        must: {
          verb: 'recall',
          num: 2
        },
        discard: {
          verb: 'unbuild',
          num: 2
        }
      },
      {
        name: 'This is the Way',
        ref: 38,
        type: 'general',
        whenever: (p) => get(state).focus && get(state).focus.actionsTaken && get(state).focus.actionsTaken.length == 3 && isPreferred(p, get(state).focus.chosen),
        discard: {
          verb: 'decrease_population',
          place: 'not_home'
        }
      },
      {
        name: 'Lost Cargo',
        ref: 39,
        type: 'general',
        after: 'deploy',
        must: {
          verb: 'spend_resource',
          types: {
            any_fem: 5
          }
        },
        discard: {
          verb: 'return_token',
          type: 'trade'
        }
      },
      {
        name: 'Toxic Bargain',
        ref: 40,
        type: 'general',
        after: 'gain_trade',
        must: 'place_corruption',
        discard: {
          both_and: [
            'unbuild',
            'unguild' // Check this is not both_and
          ]
        }
      },
      {
        name: 'Precision Strike',
        ref: 41,
        type: 'general',
        after: {
          verb: 'return_token',
          type: 'harbinger'
        },
        discard: {
          verb: 'consume_tech',
          type: 'basic'
        }
      },
      {
        name: 'Purging Storm',
        ref: 42,
        type: 'military',
        after: 'invade',
        condition: (p, params) => params.fromPureSectors >= 2,//params.fromSectors.map(s => at(s)).filter(s => !s.corrupted).length >= 2,
        discard: {
          verb: 'deactivate',
          num: 2
        }
      },
      {
        name: 'Extended Conscription',
        ref: 43,
        type: 'military',
        whenever: (p) => get(state).focus && get(state).focus.agendaAction && get(state).focus.agenda && lo(get(state).focus.agenda).type == 'support' && p.fleets.active.length >= 2,
        discard: {
          verb: 'gain_corruption',
          restriction: 'agendas'
        }
      },
      {
        name: 'Band of the Brave',
        ref: 44,
        type: 'military',
        after: 'regroup',
        canDelay: true,
        condition: (p, params) => {
          let harbSecs = all('sectors', (b) => b.harbingers.length > 0);
          for(let h of harbSecs){
            let count = 0;
            for(let s of neighbours(h)){
              count += fleetCount(s, p);
            }
            if(count >= 5) return true;
          }
          return false;
        },
        discard: {
          verb: 'unbuild',
          type: 'defense',
          num: 2
        }
      },
      {
        name: 'Internal Unrest',
        ref: 45,
        type: 'military',
        anytime: {
          text: 'Recall to resolve Internal Unrest',
          verb: 'recall',
          place: 'home',
          num: 2
        },
        discard: {
          verb: 'spend_resource',
          types: {
            food: 3
          }
        }
      },
      {
        name: 'No Mercy',
        ref: 46,
        type: 'military',
        after: 'invade',
        condition: (p, params) => {
          return params.fleets.length >= 5;
        },
        discard: {
          verb: 'gain_corruption',
          restriction: 'tracks'
        }
      },
      {
        name: 'This Is Our World',
        ref: 47,
        type: 'military',
        after: 'invade',
        canDelay: true,
        condition: (p, params) => playerSectors(p).some(s => !s.corrupted && fleetCount(s, p) >= 3),
        discard: {
          both_and: [
            {
              verb: 'place_corruption',
              place: 'support'
            },
            {
              verb: 'spend_resource',
              types: {
                energy: 2
              }
            }
          ]
        }
      }
          
      ],
    level_3: [
      {
        name: 'Professional Diversity',
        ref: 48,
        type: 'economic',
        afterFocus: 'Development',
        condition: (p) => {
          let eligible = ['farmers_guild', 'engineers_guild', 'miners_guild'];
          for(let s of playerSectors(p).filter(s => !s.corrupted)){
            let diffGuilds = [];
            for(let g of guilds(s)){
              if(eligible.includes(g.value) && !diffGuilds.includes(g.value)) diffGuilds.push(g.value);
            }
            if(diffGuilds.length >= 3) return true;
          }
          return false;
        },
        discard: {
          both_and: [
            {
              verb: 'unbuild',
              type: ['shipyard', 'starbase'],
              place: 'not_home'
            },
            {
              verb: 'unbuild',
              type: 'defense',
              place: 'not_home'
            }
            ]
        }
      },
      {
        name: 'Full Capacity',
        ref: 49,
        type: 'economic',
        duringFocus: 'Production',
        condition: (p, params) => get(state).turnCache && get(state).turnCache.overproduced && Array.from(new Set(get(state).turnCache.overproduced)).length > 1,
        discard: {
          both_and: [
            'recall',
            'deactivate'
          ]
        }
      },
      {
        name: 'Reap What You Sow',
        ref: 50,
        type: 'economic',
        whenever: (p, params) => get(state).turnCache && get(state).turnCache.gained && get(state).turnCache.gained.food >= 12,
        discard: {
          verb: 'gain_corruption',
          restriction: 'agendas_occupied'
        }
      },
      {
        name: 'Nation of Steel',
        ref: 51,
        type: 'economic',
        afterFocus: 'Development',
        condition: (p, params) => p.resources.materials.store >= 10 || playerTokenCount(p, 'miners_guild', true) >= 4,
        discard: {
          both_and: [
            'unbuild',
            'recall'
          ]
        }
      },
      {
        name: 'Dark Prophets',
        ref: 52,
        type: 'economic',
        beforeFocus: 'Prosperity',
        condition: (p, params) => playerSectors(p).some(s => !s.corrupted && s.population >= 5),
        must: {
          description: 'Gain corruption onto a sector with 5 or more Population',
          custom: async (p) => {
            let eligible = playerSectors(p).filter(s => !s.corrupted && s.population >= 5);
            let s = await choose(`Choose a sector to gain [[corruption]]`, eligible, {singleClick: true});
            await doAction(p, 'gain_corruption', {place: s})
          }
        },
        discard: 'discard_agenda'
      },
      {
        name: 'Hidden Novarchon Riches',
        ref: 53,
        type: 'economic',
        before: {
          verb: 'produce',
          obj: 'credits'
        },
        must: {
          verb: 'unguild',
          type: 'bankers_guild'
        },
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            voidborn_power: 1,
            defender_reward: {
              verb: 'place_token',
              type: 'defense',
              place: 'voidborn',
              restriction: 'adjacent'
            }
          }
        }
      },
      {
        name: 'Rust and Decay',
        ref: 54,
        type: 'economic',
        after: 'gain_corruption',
        must: {
          verb: 'spend_resource',
          types: {
            any_fem: 12
          }
        },
        discard: {
          both_and: [
            {
              verb: 'consume_tech',
              type: 'improved'
            },
            {
              verb: 'consume_tech',
              type: 'basic'
            }
          ]
        }
      },
      {
        name: 'Trade Control',
        ref: 55,
        type: 'economic',
        before: 'gain_trade',
        condition: (p, params) => {
          let numTrade = playerTrade(p).length;
          if(get(state).focus && get(state).focus.trade) numTrade++;
          return numTrade >= 2;
        },
        discard: {
          both_and: [
            {
              verb: 'return_token',
              type: 'trade'
            },
            {
              verb: 'spend_resource',
              types: {
                any: 3
              }
            }
          ]
        }
      },
      {
        name: 'Justified Means',
        ref: 56,
        type: 'general',
        after: {
          verb: 'gain_tech',
          type: 'improved'
        },
        must: {
          both_and: [
            {
              verb: 'decrease_population',
              place: 'not_home'
            },
            {
              verb: 'decrease_population',
              place: 'not_home',
              restriction: 'different'
            }
          ]
        },
        discard: {
          both_and: [
            'consume_tech',
            {
              verb: 'spend_resource',
              types: {
                science: 2
              }
            }
          ]
        },
        
      },
      {
        name: 'Show of Force',
        ref: 57,
        type: 'general',
        before: {
          verb: 'advance_track',
          obj: 'statecraft'
        },
        condition: (p, params) => p.fleets.active.length >= 5,
        discard: ['unguild', 'unguild']
      },
      {
        name: 'Tainted Knowledge',
        ref: 58,
        type: 'general',
        after: {
          verb: 'gain_tech',
          type: 'improved'
        },
        must: {
          verb: 'discard_glory',
          restriction: 3
        },
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            voidborn_approachAbsorption: 2
          }
        }
      },
      {
        name: 'Whispers in the Dark',
        ref: 59,
        type: 'general',
        after: {
          verb: 'gain_agenda',
          wasCorrupted: true
        },
        discard: {
          both_and: [
            'place_corruption',
            'place_corruption'
          ]
        }
      },
      {
        name: 'Slow But Steady',
        ref: 60,
        type: 'military',
        afterFocus: 'Reinforcement',
        condition: (p, params) => Object.keys(p.tracks).every(t => getTier(p, t) >= 1),
        discard: {
          both_and: ['consume_tech', 'consume_tech']
        }
      },
      {
        name: 'Rise Against',
        ref: 61,
        type: 'military',
        after: {
          verb: 'gain_tech',
          type: 'improved'
        },
        canDelay: true,
        condition: (p, params) => {
          let harbSecs = all('sectors', (b) => b.harbingers.length > 0);
          for(let h of harbSecs){
            let count = 0;
            for(let s of neighbours(h)){
              if(!s.corrupted && controlledBy(s, p)) count += s.population;
            }
            if(count >= 9) return true;
          }
          return false;
        },
        discard: {
          both_and: [
            'unguild',
            {
              verb: 'recall',
              num: 2
            }
          ]
        }
      },
      {
        name: 'Hold Your Ground',
        ref: 62,
        type: 'military',
        duringFocus: 'Politics',
        condition: (p, params) => {
          let harbSecs = all('sectors', (b) => b.harbingers.length > 0);
          for(let h of harbSecs){
            let count = 0;
            for(let s of neighbours(h)){
              count += s.installations.length;
            }
            if(count >= 6) return true;
          }
          return false;
        },
        discard: {
          both_and: [
            {
              verb: 'place_token',
              type: 'harbinger',
              place: 'voidborn',
              restriction: 'adjacent'
            },
            'resolve_skirmish'
          ]
        }
      },
      {
        name: 'Marvels of War',
        ref: 63,
        type: 'military',
        afterFocus: 'Conquest',
        condition: (p, params) => p.resources.energy.store >= 10,
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            voidborn_power: 1
          }
        }
      },
      {
        name: 'Call of the Banners',
        ref: 64,
        type: 'military',
        duringFocus: 'Reinforcement',
        condition: (p, params) => get(state).turnCache && get(state).turnCache.deploySectors && get(state).turnCache.deploySectors.filter(s => !s.corrupted).length >= 3,
        discard: {
          either_or: [
            {
              both_and: [
                'unguild',
                'unguild',
                {
                  verb: 'decrease_population',
                  place: 'not_home'
                }
              ]
            },
            {
              verb: 'spend_resource',
              types: {
                materials: 6
              }
            }
          ]
        }
      },
      {
        name: 'Saving Grace',
        ref: 65,
        type: 'military',
        after: 'slot_agenda',
        condition: (p, params) => get(state).turnCache && get(state).turnCache.invadedFromDominance && get(state).turnCache.invadedPopulation >= 5,
        discard: {
          both_and: [
            {
              verb: 'place_token',
              type: 'harbinger',
              place: 'voidborn',
              restriction: 'adjacent'
            },
            'resolve_skirmish'
          ]
        }
      },
      {
        name: 'Pillars of Power',
        ref: 66,
        type: 'military',
        after: 'gain_agenda',
        canDelay: true,
        condition: (p, params) => playerSectors(p).filter(s => !s.corrupted).reduce((a,s) => a + singleUpkeep(s), 0) >= 4,
        discard: {
          simple_list: [
            'gain_corruption',
            'gain_corruption'
          ]
        }
      },
      {
        name: 'War Never Changes',
        ref: 67,
        type: 'military',
        after: 'gain_tech',
        condition: (p, params) => {
          let poss = ['Shields', 'Targeting', 'Torpedoes', 'Dreadnoughts', 'Destroyers', 'Carriers', 'Sentries'];
          let o = params.obj;
          if(!o) return false;
          if(o.lo) o = lo(o);
          if(o.type == 'improved' && poss.includes(o.name)) return true;
          return false;
        },
        discard: {
          verb: 'resolve_skirmish',
          mods: {
            voidborn_approachAbsorption: 2
          }
        }
      },
      {
        name: 'For the Greater Good',
        ref: 68,
        type: 'military',
        after: 'invade',
        condition: (p, params) => params.fallenSector && params.fleetTypes.length >= 2,
        discard: 'discard_agenda'
      }
      ]
  }

  for(let k of Object.keys(crisisCards)){
    for(let c of crisisCards[k]){
      let level = k.split('_')[1];
        c.id = `crisis_${level}_cards.${c.ref}`;
        c.level = parseInt(level);
        if(!c.type) c.type = 'general';
        ol(c);
    }
  }

  function times(num, base, id = false){
    let list = [];
    for(let i = 0; i < num; i++){
      let clone = jsonpatch.deepClone(base);
      if(id) clone.id = `${id}_${i}`;
      list.push(clone);
    }
    return list;
  }

  /* Reminder:
  crisis_board: {
            current_situation: null,
            current_crisis: null,
            war_crises: [],
            economic_crises: [],
            catastrophes: []
        },
    */

  export function canDo(p, task){
    if(typeof task == 'string') task = expandAction(task);
    if(task.custom) return true; // Presume
    if(task.cost && !getCostInfo(p, task.cost)) return false; 
    if(task.action) task = task.action;
    if(task.either_or){
      let canDoOne = false;
      for(let t of task.either_or){
        if(canDo(p, t)) canDoOne = true;
      }
      return canDoOne;
    }
    if(Array.isArray(task)){
      let canDoOne = false;
      for(let t of task){
        if(canDo(p, t)) canDoOne = true;
      }
      return canDoOne;
    }
    if(task.both_and){
      for(let t of task.both_and){
        if(!canDo(p, t)) return false;
      }
      return true;
    }
    if(task.simple_list){
      for(let t of task.simple_list){
        if(!canDo(p, t)) return false;
      }
      return true;
    }
    let action = actions.find(a => a.verb == (task.verb || task));
    if(!action) return false;
    if(action.impossible && action.impossible(p, task || task.action)) return false;
    return true;
  }

  export function crisisTriggers(){
    if(get(state).mode != 'coop') return [];
    return [get(state).crisis_board.current_crisis, ...get(state).crisis_board.military, ...get(state).crisis_board.economic, ...get(state).delayedReactions].filter(c => c).map(c => c.lo ? {...lo(c), alreadyMatched: c.alreadyMatched || false} : c).filter(c => !c.id.startsWith('harbinger'));
  }

  export function checkTriggeredEffects(p, params, timing){
    if(get(state).noReactions) return;
    if(params.alreadyReacted) return;
    let all = false;
    if(p == 'all'){
      p = activePlayer();
      all = true;
    }
    if(get(state).mode == 'coop'){
      evaluateTriggers(p, params, timing, crisisTriggers(), 'resolve the Crisis $name$', (p, c) => {
        log({
          type: 'stats',
          crisis_removed: true,
          crisisRemovedViaTrigger: c.id,
          via: 'trigger',
          crisis: c.id
        }, p)
        log(`Resolved Crisis ${lo(c).name}`, p);
        moveBitTo(c, get(state).crisis_discards[`level_${c.level}`]);
        updateSkirmish(p);
      }, false);
    }

    let list = [];
    
    // NB if anything below should trigger outside of a player's turn, this can become for(let p of get(state).players)
    for(let p of (all ? get(state).players : [activePlayer()])){
      if(house(p).reactions) evaluateTriggers(p, params, timing, possArray(house(p).reactions), `trigger ${house(p).name}: $action$`)
      for(let t of p.techs){
        t = techs.find(tech => tech.id == t.id); // To reload from source if changed
        if(t.reactions) evaluateTriggers(p, params, timing, possArray(t.reactions).map(r => {return {name: t.name, ...r}}), `trigger [[${t.type}_tech]] $name$: $action$`)
      }
      for(let s of playerSectors(p)){
        if(s.reactions) evaluateTriggers(p, params, timing, possArray(s.reactions).map(r => {return {name: upperInitial(s.type), ...r}}), `trigger $name$ Sector: $action$`)
      }
    }/*
    if(all){
      
    }else{
      if(house(p).reactions) evaluateTriggers(p, params, timing, possArray(house(p).reactions), `trigger ${house(p).name}: $action$`)
      for(let t of p.techs){
        t = techs.find(tech => tech.id == t.id); // To reload from source if changed
        if(t.reactions) evaluateTriggers(p, params, timing, possArray(t.reactions).map(r => {return {name: t.name, ...r}}), `trigger [[${t.type}_tech]] $name$: $action$`)
      }
    }*/
    

    if(get(state).galactic_board.current_event){
      let event = lo(get(state).galactic_board.current_event);
      if(event.reactions) evaluateTriggers(p, params, timing, possArray(event.reactions), `[[galactic_event]]: $action$`)
    }

  }

  export function evaluateTriggers(p, params, timing, list, description, action = false, repeatable = true){
    // timing = before, after, afterFocus, duringFocus, beforeStep, afterStep, whenever – possible others? eg elective?
    
    let possible = list;
    let toProcess = [];
    for(let c of possible){
        if(c.alreadyMatched){ // For delayed reactions
          toProcess.push(c);
          continue;
        }
        if(c.whenever){
          // Always check this!
          if(c.whenever(p, params)){
            toProcess.push(c);
            continue;
          }
        }
        if(!c.hasOwnProperty(timing)) continue;
        let matchedAll = true;

        if(c.not){
          // Any exclusions
          let excluded = false;
          for(let k of Object.keys(c.not)){
            if(!params[k]) continue;
            if(c.not[k] == params[k]) excluded = true;
            if(Array.isArray(params[k]) && params[k].includes(c.not[k])) excluded = true;
            if(Array.isArray(c.not[k]) && possArray(params[k]).some(a => c.not[k].includes(a))) excluded = true; // so you can list possibilities to check
            if(params[k].id && params[k].id.startsWith(c.not[k]+'.')) excluded = true;; // May not work, but intended for specific to general
          }
          if(excluded) continue;
        }

        if(timing.includes('Focus') && params.verb == 'Leadership'){
          // Always matches
          toProcess.push(c);
          break;
        }

        for(let check of possArray(c[timing])){
          if(typeof check == 'string'){
            if(check == 'any'){
              toProcess.push(c);
              break;
            }else{
              check = { verb: check};
            }
            
          }
          if(typeof check == 'function'){
              // Direct condition check
              if(check(p, params)){
                  toProcess.push(c);
              }
              break;
          }

          let matchedAll = true;
          for(let k of Object.keys(check)){
              if(!params[k]){
                  matchedAll = false;
                  break;
              }
              if(check[k] == params[k]) continue;
              if(check[k] && check[k].min || check[k].max){
                if(testNum(check[k], params[k])) continue;
              }
              if(Array.isArray(params[k]) && params[k].includes(check[k])) continue;
              if(Array.isArray(check[k]) && possArray(params[k]).some(a => check[k].includes(a))) continue; // so you can list possibilities to check
              if(params[k].id && params[k].id.startsWith(check[k]+'.')) continue; // May not work, but intended for specific to general
              matchedAll = false;
          }
          if(!matchedAll) continue;
          toProcess.push(c); 
          break;
        }

    }


    for(let c of toProcess){
      if(c.condition && !c.condition(p, params)){
        if(timing && timing.includes('before')) continue; // Before is a spot check
        if(!c.canDelay) continue; // Only if explicitly allowed
        state.update(s => {
          s.delayedReactions.push({
            lo: 1,
            id: c.id,
            alreadyMatched: true
          })
          return s;
        })
        continue;
      }
      if(c.inPhase && !get(state).turnInfo.breadcrumbs.includes(`.${c.inPhase}`)) continue; //  For phase restrictions
      if(c.maxTimes){
        if(get(state).turnCache && get(state).turnCache.reactionCount && get(state).turnCache.reactionCount[c.id] >= c.maxTimes){
          continue; // Done it enough already
          // NB the above presumes turnCache will be refreshed in the right places
        }
      }
      let text = description.replaceAll(`$name$`, c.name);
      if(c.action){
        text = text.replaceAll(`$action$`, getReadableDescription(c.action))
      }else if(c.must){
        text = text.replaceAll(`$action$`, getReadableDescription(c.must))
      }
      // Need to handle musts in delayedReactions as well
      let savedCache = jsonpatch.deepClone(get(state).cache || {});
      if(!action) action = async (p, c) => await executeActions(p, c.action, {savedCache});
      let reaction;
      
      if(c.must){
          
            reaction = async () => {
            //let choice = await choose(`You can ${text} if you ${getReadableDescription(c.must)}. Do you want to proceed?`, ['Yes', 'No'], {foreground: c});
            //if(choice == 'No') return;
            for(let m of possArray(c.must)){
              if(!canDo(p, m)){
                await pause(`Unable to pay cost to ${text}!`);
                return;
              }
            }
            for(let m of possArray(c.must)){
              await executeActions(p, m, {compulsory: true, source: c.id, savedCache });
            }
            if(c.maxTimes){
                state.update(s => {
                  if(!s.turnCache) s.turnCache = {};
                  if(!s.turnCache.reactionCount) s.turnCache.reactionCount = {};
                  if(!s.turnCache.reactionCount[c.id]) s.turnCache.reactionCount[c.id] = 0;
                  s.turnCache.reactionCount[c.id]++;
                  return s;
                })
            }
            await action(p, c);
          }
          /*let choice = await choose(`You can resolve the Crisis *${c.name}* if you ${getReadableDescription(c.must)}. Do you want to proceed?`, ['Yes', 'No'], {foreground: c});
          if(choice == 'No') continue;
          //await doAction(p, c.must.verb, c.must);
          await executeActions(p, c.must, {compulsory: true});*/
      }else if(c.setParams){
        reaction = async () => {
          for(let k of Object.keys(c.setParams)){
            params[k] = c.setParams[k];
          }
          if(c.maxTimes){
              state.update(s => {
                if(!s.turnCache) s.turnCache = {};
                if(!s.turnCache.reactionCount) s.turnCache.reactionCount = {};
                if(!s.turnCache.reactionCount[c.id]) s.turnCache.reactionCount[c.id] = 0;
                s.turnCache.reactionCount[c.id]++;
                return s;
              })
          }
          await action(p, c);
        }
      }else{
        reaction = async () => {
          if(c.maxTimes){
              state.update(s => {
                if(!s.turnCache) s.turnCache = {};
                if(!s.turnCache.reactionCount) s.turnCache.reactionCount = {};
                if(!s.turnCache.reactionCount[c.id]) s.turnCache.reactionCount[c.id] = 0;
                s.turnCache.reactionCount[c.id]++;
                return s;
              })
          }
          await action(p, c);
        }
      }
      if(c.maxTimes){
        if(get(state).turnCache && get(state).turnCache.reactionCount && get(state).turnCache.reactionCount[c.id] >= c.maxTimes) continue; // Skip it
      }
      addReaction(p, text, c.id, reaction, c.id, c.mandatory, repeatable);
      // Presume we can now resolve it
      //moveBitTo(c, get(state).crisis_discards[`level_${c.level}`]);
    }
  }

  function availableTracks(){
    return ['military', 'economic'].filter(k => get(state).crisis_board[k].length < boardCosts[k].length);
  }

  export async function handleWar(p){
    let choices = ['Resolve Crisis board'];
    if(get(state).crisis_board.catastrophes.length < 3) choices.push('Take [[catastrophe]]');
    let chosen = choices[0];
    if(choices.length > 1){
      chosen = await choose(`Choose how to resolve War card`, choices)
    }
    if(chosen == 'Take [[catastrophe]]'){
      log(`Chose to take a [[catastrophe]] instead of facing War card`, p)
      await doAction(p, 'take_catastrophe');
      //moveBitTo(topToken('catastrophe'), get(state).crisis_board.catastrophes);
    }else{
      await resolveCrisis(p);//, get(state).crisis_board.current_alert[`cycle_${get(state).turn.cycle}_mods`]);
    }

    let current =  get(state).crisis_board.current_alert;
    if(current && current.type == 'war'){
      // Discard, don't just ditch
      moveBitTo(current, get(state).war_discard);
    }
  }

  export function totalHavenCapacity(){
    let total = 0;
    for(let h of get(state).havens){
      total += h.capacity - h.cubes.length;
    }
    return total;
  }

  export function getCrisisMilitaryBoost(){
    return boardCosts.military[get(state).crisis_board.military.length];
  }

  export async function resolveCrisis(p, options){
    //boosts.voidborn_power += getCrisisMilitaryBoost();
    await resolveSkirmish(p, options); //, boosts);

    let cost = boardCosts.economic[get(state).crisis_board.economic.length];
    await pay(p, cost, {purpose: 'resolve Crisis Board', onDeficit: (info, res, def) => {
        // We know it'll be food that is short
        // !!TODO could this be done by simple conversion rules with influence the fallback??
        // Probably not because it shouldn't be optional...
        log(`Paying ${def * 3} [[influence]] for being unable to satisfy ${renderCost(cost)}`);
        if(!info.influence){
            info.influence = {
                raw: 0,
                origCost: 0
            }
        }
        info.influence.raw += 3;
        return info;
    }});
  }

  export async function transferCurrentCrisis(p){
    // i.e. for the current crisis
    // Returns true if a decision was made, so the app knows whether or not to save an undo
    if(!get(state).crisis_board.current_crisis){
      log(`No current Crisis left to deal with`, p);
      return false; // Nothing to transfer!
    }
    let c = get(state).crisis_board.current_crisis;
    if(c.lo) c = lo(c);
    let choices = [];
    if(c.discard){
      choices.push({
        type: 'text',
        choice: `${getReadableDescription(c.discard)} to discard it`,
        disabled: !canDo(p, c.discard),
        value: 'discard'
      })
    }
    choices.push({
      type: 'text',
      choice: `Take a [[catastrophe]] to discard it`,
      disabled: get(state).crisis_board.catastrophes.length >= 3,
      value: 'catastrophe'
    })
    let eligible = ['military', 'economic'].filter(a => c.type == 'general' || c.type == a);
    if(get(state).crisis_board.catastrophes.length == 3) eligible = eligible.filter(a => get(state).crisis_board[a].length < boardCosts[a].length - 1)
    choices.push({
      type: 'text',
      choice: `Make it ongoing`,
      value: 'ongoing',
      disabled: eligible.length == 0
    })
    
    if(choices.every(c => c.disabled)){
      await pause(`Game over: nowhere to put the current Crisis and no way of discarding it!`);
        state.update(s => {
            s.winner = 'voidborn';
            s.catastropheLoss = true;
            return s;
        })
        await endGame();
        return false;
    }
    log('Handling current Crisis '+lo(c).name, p);
    let choice = await choose(`How do you want to handle the current Crisis?`, choices, {foreground: c, leaveForeground: true});
    if(choice == 'catastrophe'){
      log(`Chose to take a [[catastrophe]] to discard it`, p)
      await doAction(p, 'take_catastrophe');
      log({
        type: 'stats',
        crisis: c.id,
        crisis_removed: true,
        crisisRemovedViaCatastrophe: c.id,
        via: 'catastrophe'
      }, p)
      moveBitTo(c, get(state).crisis_discards[`level_${c.level}`]);
    }else if(choice == 'ongoing'){
      
      await doActionPause();
      if(eligible.length == 1){
        log(`Chose to move it onto the Crisis Board`, p);
        //moveBitTo(c, get(state).crisis_board[eligible[0]]);
        await addToCrisisBoard(p, c, 'Crisis Card', eligible[0])
      }else{
        let track = await choose(`Which track do you want to place the general Crisis on?`, eligible, {foreground: c});
        //moveBitTo(c, get(state).crisis_board[track]);
        log(`Chose to move it onto the ${track} track of the Crisis Board`, p);
        await addToCrisisBoard(p, c, 'Crisis Card', track);
      }
    }else if(choice == 'discard'){
      log(`Chose to take its discard effect`, p);
      await executeActions(p, c.discard);
      log({
        type: 'stats',
        crisis: c.id,
        crisis_removed: true,
        crisisRemovedViaDiscardEffect: c.id,
        via: 'discard_effect'
      }, p)
      moveBitTo(c, get(state).crisis_discards[`level_${c.level}`]);
    }
    return true;
  }

  export function getCrisisHarbingers(){
    let h = [];
    for(let c of [...get(state).crisis_board.economic, ...get(state).crisis_board.military]){
        if(c && c.id.startsWith('harbinger')) h.push(c);
    }
    return h;
  }

  export async function addToCrisisBoard(p, item, type, track){
    if(get(state).crisis_board[track].length == boardCosts[track].length - 1){
      // Fall off!
      log(`Placing ${type} on this track causes the last item to fall off, so player must take a [[catastrophe]]`, p);
      await pause(`Placing ${type} on this track causes the last item to fall off - take a [[catastrophe]]!`);
      let last = get(state).crisis_board[track][get(state).crisis_board[track].length - 2];
      if(last.id.startsWith('harbinger')){
        await returnToken(last);
      }else{
        moveBitTo(last, get(state).spare_cards)
      }
      moveBitTo(item, get(state).crisis_board[track], 0);
      await doAction(p, 'take_catastrophe');
    }else{
      let index = 0;
      if(type != '[[harbinger]]' && get(state).crisis_board[track].some(i => i.id.startsWith('harbinger'))){
        // Place it past the harbingers
        if(!get(state).crisis_board[track].some(i => !i.id.startsWith('harbinger'))){
          index = -1; // Place at end
        }else{
          index = get(state).crisis_board[track].findIndex(i => !i.id.startsWith('harbinger'))
        }
      }
      moveBitTo(item, get(state).crisis_board[track], index);
    }
    updateSkirmish(p);
  }

  export async function setupCoopAlertDeck(cycle){
    let deck = [...get(state).crisis_board.alert_deck, ...makeAlertDeck(cycle)];
    console.log(`Alert deck for cycle: ${deck.length} cards`, deck);
    shuffle(deck);
    state.update(s => {
      s.crisis_board.alert_deck = deck;
      return s;
    })
    assembleList(get(state).crisis_board.alert_deck, get(state).crisis_board, 'alert_deck', `state.crisis_board.alert_deck`, true); // Because of shuffling
    let setup = difficultyLevels[get(state).difficulty][`cycle_${cycle}`].setup;
    if(setup){
      for(let s of setup){
        if(s == 'harbinger'){
          let h = topToken('harbinger');
          if(!h) continue; // If you run out, lucky you
          let available = ['military', 'economic']
          let choices = available.map(a => {
            return {
              type: 'text',
              choice: `${a}`,
              value: a
            }
          })
          let track = await choose(`Select track to place [[harbinger]] on:`, choices);
          await addToCrisisBoard(get(state).players[0], h, '[[harbinger]]', track) // Who gets the catastrophe if it fails?
        }else{
          logEvent({
            type: 'stats',
            crisis: get(state).crisis_decks.level_0[0].id,
            crisis_added: true
          })
          logAvailable(get(state).crisis_decks.level_0[0]);
          moveBitTo(get(state).crisis_decks.level_0[0], get(state).crisis_board[s]);
        }
      }
    }
  }

  export async function revealAlert(){
    await newInformation();
    if(get(state).crisis_board.current_alert && get(state).crisis_board.alert_deck.some(a => get(state).crisis_board.current_alert.id == a.id)){
      console.log('Error: duplicate alert card. Cleaning up');
      alert('Duplicate alert card - should not happen!')
      state.update(s => {
        s.crisis_board.alert_deck = s.crisis_board.alert_deck.filter(a => get(state).crisis_board.current_alert.id != a.id);
        return s;
      })
    }
    if(get(state).crisis_board.current_alert) moveBitTo(get(state).crisis_board.current_alert, get(state).spare_cards);
    /*state.update(s => {
      s.crisis_board.current_alert = false;
      return s;
    })*/
    await doActionPause();
    if(get(state).crisis_board.alert_deck.some(a => get(state).spare_cards.some(al => al.id == a.id))){
      console.log('Error: alert cards not disappearing!')
      state.update(s => {
        s.crisis_board.alert_deck = s.crisis_board.alert_deck.filter(a => !get(state).spare_cards.some(al => al.id == a.id));
        return s;
      })
    }
    let alert = get(state).crisis_board.alert_deck[0];
    logEvent({
      type: 'stats',
      alert: alert.id
    })
    if(alert.type == 'war'){
      logEvent(`War Card revealed: level ${alert.ref.split('_').slice(0, -1).join('/')}`)
    }else{
      logEvent(`Level ${alert.level} Alert Card revealed`);
    }

    await pause(`Alert card for this round`, {foreground: alert, beforeAdvancing: () => {
      moveBitTo(alert, get(state).crisis_board, 'current_alert');
    }});
  }

  export async function revealCrisis(){
    await newInformation();
    let a = get(state).crisis_board.current_alert;
    if(a.type == 'war'){
      log(`You are at war: no new crisis revealed`);
      return;
    }
    let deck = get(state).crisis_decks[`level_${a.level}`];
    if(deck.length == 0){
      // move them back!
      for(let c of randomElements(get(state).crisis_discards[`level_${a.level}`])){ // !! TODO best way?
        moveBitTo(c, get(state).crisis_decks[`level_${a.level}`]); //
      }
    }
    let crisis = deck[0];
    if(get(ui).specifyCrisis && get(ui).nextCrisis) crisis = at(get(ui).nextCrisis)
    logEvent({
      type: 'stats',
      crisis: crisis.id,
      crisis_added: true
    })
    logAvailable(crisis);
    logEvent(`Crisis card ${lo(crisis).name} revealed`);
    await pause(`Crisis card for this turn`, {foreground: crisis, beforeAdvancing: () => {
      moveBitTo(crisis, get(state).crisis_board, 'current_crisis');
    }});
    
  }

  export function makeAlertDeck(cycle){
    // Returns them for another func to do the actual moving
    // Moving means adding to the alert deck, not starting from scratch
    let deck = [];
    let level = difficultyLevels[get(state).difficulty]
    let info = level[`cycle_${cycle}`];
    for(let k of Object.keys(info)){
      if(k == 'war'){
        if(get(state).war_deck.length == 0){
          for(let d of get(state).war_discard){
            moveBitTo(d, get(state).war_deck);
          }
        }
        deck.push(...randomElements(get(state).war_deck, info[k]));
        state.update(s => {
          s.war_deck = s.war_deck.filter(w => !deck.some(c => c.id == w.id));
          return s;
        })
      }else{
        let num = parseInt(k.split('_')[1]);
        for(let i = 0; i < info[k]; i++){
          let add = {
            id: `alert_cards.${num}#${cycle}0${i}`,
            type: 'situation',
            level: num
          }
          deck.push(add);
        }
      }
    }
    // shuffle(deck); // Not needed now that it's shuffled elsewhere
    
    return deck;
  }

  export async function showDifficultyInfo(){
    ui.update(ui => {
      ui.showing.Difficulty = !ui.showing.Difficulty;
      return ui;
    })
    return;
    let deck = [...get(state).crisis_board.alert_deck.sort((a,b) => (a.level || 0) - (b.level || 0))];
    let breakdown = {
      'War cards': 0
    };
    for(let d of deck){
      if(d.level){
        if(!breakdown.hasOwnProperty(`Level ${d.level} Crisis`)) breakdown[`Level ${d.level} Crisis`] = 0;
        breakdown[`Level ${d.level} Crisis`]++;
      }else{
        breakdown['War cards']++;
      }
    }
    let info = `<h3>Difficulty ${get(state).difficulty}</h3>
    <div>Situation cards left in deck:
    ${Object.keys(breakdown).sort().map(k => `<ul>${k}: ${breakdown[k]}</ul>`).join('')}
    </div>`;
    await pause(info, {once: true})
    //await pause(info, {foreground: get(state).difficultyCard});
  }