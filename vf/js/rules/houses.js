// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { basicTracks, specialTracks } from "./tracks.js";

export let houseOrder = ['Valnis', 'Belitan', 'Dunlork', 'Cortozaar', 'Zenor', 'Thegwyn', 'Shiveus', 'Yarvek', 'Nervo', 'Astoran', 'Fenrax', 'Kradmor', 'Marqualos', 'Novaris'];

export let houses = [
    {
      name: 'Astoran',
      cracked: true,
      techs: ['Deep Space Missiles', 'Sentries'],
      preferred: ['Conquest', 'Development'],
      complexity: 2,
      fallen: {
        pop: 2,
        effect: {
          verb: 'build',
          restriction: 'same_sector'
        }
      },
      baseUpkeep: 2,
      reactions: {
        beforePhase: 'evaluation phase',
        action: {
          verb: 'activate',
          num: 2
        }
      }
    },
    {
      name: 'Belitan',
      colour: '87A0A5',
      cracked: false,
      techs: ['Data Refinery', 'Targeting'],
      complexity: 1,
      tracks: basicTracks,
      preferred: ['Progress', 'Prosperity'],
      fallen: {
        pop: 2,
        effect: {
          verb: 'establish',
          type: 'bankers_guild',
          restriction: 'same_sector'
        }
      }
    },
    {
      name: 'Cortozaar',
      colour: '04744B',
      cracked: false,
      techs: ['Starbases','Torpedoes'],
      complexity: 1,
      tracks: basicTracks,
      preferred: ['Progress', 'Development'],
      fallen: {
        pop: 3,
        effect: {
          verb: 'deploy',
          restriction: 'same_sector'
        }
      }
    },
    {
      name: 'Dunlork',
      colour: '613B21',
      cracked: true,
      techs: ['Energy Cells','Orbital Docks'],
      complexity: 1,
      tracks: basicTracks,
      preferred: ['Progress', 'Reinforcement'],
      fallen: {
        pop: 3,
        effect: {
          verb: 'establish',
          type: 'engineers_guild',
          restriction: 'same_sector'
        }
      }
    },
    {
      name: 'Fenrax',
      cracked: false,
      techs: ['Carriers','Central Surveillance'],
      complexity: 4,
      preferred: ['Development', 'Conquest'],
      fallen: {
        pop: 2,
        effect: {
          verb: 'gain_reclaim',
        }
      },
      reactions: {
        beforePhase: 'evaluation phase',
        action: {
          simple_list: [
            {
              verb: 'gain_resource',
              type: 'credits',
              num: 2,
              per: 'sector',
              filter: {
                max: 2,
                type: 'population'
              }
            },
            {
              verb: 'gain_resource',
              type: 'credits',
              num: 1,
              per: 'sector',
              filter: {
                num: 3,
                type: 'population'
              }
            },
            {
              verb: 'gain_resource',
              type: 'science',
              num: 1,
              per: 'sector',
              filter: {
                num: 4,
                type: 'population'
              }
            },
            {
              verb: 'gain_resource',
              type: 'science',
              num: 2,
              per: 'sector',
              filter: {
                min: 5,
                type: 'population'
              }
            },
          ]
        }
      }
    },
    {
      name: 'Kradmor',
      cracked: false,
      techs: ['Purifier','Salvage Scanner'],
      complexity: 4,
      preferred: ['Conquest'],
      fallen: {
        pop: 1,
        effect: [
          'remove_corruption', 'upgrade_glory'
        ]
      },
      reactions: [
        {
          after: {
            verb: 'remove_corruption',
            from: 'house_mat'
          },
          action: {
            verb: 'gain_resource',
            type: 'energy',
            num: 2
          },

        },
        {
          after: {
            verb: 'remove_corruption',
            from: 'sector'
          },
          action: {
            verb: 'gain_resource',
            type: 'science',
            num: 2
          },
        }
      ]
    },
    {
      name: 'Marqualos',
      cracked: false,
      techs: ['Trade Nexus','Autonomous Drones'],
      complexity: 3,
      preferred: ['Politics', 'Scheme'],
      fallen: {
        pop: 1,
        effect: {
          verb: 'gain_resource',
          types: {
            food: 2,
            credits: 2
          }
        }
      }
    },
    {
      name: 'Nervo',
      cracked: false,
      techs: ['Ark Ships','Robotics'],
      complexity: 3,
      preferred: ['Production', 'Prosperity'],
      ongoing: ['nervo_conversion'],
      fallen: {
        pop: 3,
        effect: {
          verb: 'establish',
          type: 'miners_guild',
          restriction: 'same_sector'
        }
      }
    },
    {
      name: 'Novaris',
      cracked: false,
      techs: ['Cybernetics','Combat Replicators'],
      complexity: 4,
      preferred: ['Production', 'Innovation'],
      fallen: {
        pop: 3,
        effect: {
          verb: 'deploy',
          restriction: 'same_sector'
        }
      },
      reactions: {
        after: 'gain_corruption',
        action: {
          verb: 'produce',
          num: 1
        }
      }
    },
    {
      name: 'Shiveus',
      colour: 'DBA546', 
      cracked: true,
      techs: ['Dreadnoughts','Decontamination Chambers'],
      complexity: 3,
      preferred: ['Politics'],
      ongoing: ['extra_skirmish_power', 'skirmish_defend_influence'],
      fallen: {
        pop: 1,
        effect: ['remove_corruption', {
          verb: 'establish',
          type: 'scientists_guild',
          restriction: 'same_sector'
        }]
      }
    },
    {
      name: 'Thegwyn',
      colour: '476840',
      cracked: false,
      techs: ['Neural Matrix','Terraforming'],
      complexity: 2,
      preferred: ['Production', 'Development'],
      fallen: {
        pop: 3,
        effect: {
          cost: {
            materials: 1
          },
          action: {
            verb: 'establish',
            type: 'farmers_guild',
            restriction: 'same_sector'
          }
        }
      }
    },
    {
      name: 'Valnis',
      colour: 'C55D47',
      cracked: false,
      techs: ['Escape Pods','Shields'],
      complexity: 1,
      tracks: basicTracks,
      preferred: ['Progress', 'Politics'],
      fallen: {
        pop: 2,
        effect: {
          verb: 'gain_reclaim',
        }
      }
    },
    {
      name: 'Yarvek',
      cracked: true,
      techs: ['Hyperdrive','Tactical Transports'],
      complexity: 2,
      preferred: ['Reinforcement', 'Politics'],
      ongoing: ['yarvek_conversion'],
      anytime: [
        {
          confirm: 'Discard [[bounty]] to gain 1 [[credits]]/[[science]]',
          button: '[[discard_bounty]]: [[credits]]/[[science]]',
          cost: {
            bounty: 1
          },
          action: {
            verb: 'gain_resource',
            num: 1,
            available: ['credits', 'science']
          }
        }
      ],
      focusBoost: [
          {

            label: 'Yarvek',
            card: 'any',
            cost: {
                reclaim: 1
            },
            action: 'third_action'
        },
        {
          label: 'Yarvek',
          card: 'any',
          cost: {
            bounty: 1
          },
          action: {
            verb: 'gain_resource', 
            num: 1,
            available: ['credits', 'science']
          }
        }
      ],
      fallen: {
        pop: 2,
        effect: [
          {
            verb: 'gain_bounty',
          },
          {
            verb: 'build',
            type: 'shipyard',
            restriction: 'same_sector'
          }
        ]
      }
    },
    {
      name: 'Zenor',
      colour: '3A4863', 
      cracked: true,
      techs: ['Cloning','Destroyers'],
      complexity: 2,
      preferred: ['Progress', 'Reinforcement'],
      fallen: {
        pop: 2,
        effect: {
          cost: {
            science: 1
          },
          action: {
            verb: 'advance_track',
            lowest: true
          }
        }
      }
    },
  ]

  for(let h of houses){
    if(specialTracks.hasOwnProperty(h.name)) h.tracks = specialTracks[h.name];
    h.id = `house_${h.name}`;
  }

  export function house(p){
    return houses.find(h => p.house == h.name);
  }