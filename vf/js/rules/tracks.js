// Rules reference adapted from Mark Hutchinson’s Voidfall solo app. See ../../docs/SOURCES.md.
import { ongoingPlayer } from "./game.js";

let tierThresholds = [
    {
        tier: 1,
        threshold: 3, // i.e. if your index would go to 3 you are at this tier
        //effect: 'unlock_tech' // not really necessary but seems more future-proof
    },
    {
        tier: 2,
        threshold: 5,
        //effect: 'unlock_tech'
    },
    {
        tier: 3,
        threshold: 6,
        cost: {
            deactivate: 1
        }
    },
    {
        tier: 4,
        threshold: 7,
        cost: {
            deactivate: 2
        }
    }
]

export function costToRise(p, track){
    // Checks whether at threshold
    if(ongoingPlayer(p).includes('free_tier_increase')) return false; // all free!
    let index = p.tracks[track].index;
    for(let t of tierThresholds){
        if(index + 1 == t.threshold){
            // We are here!
            return t.cost;
        }
    }
    return false;
}

export function getTier(p, track){
    let i = p.tracks[track].index;
    let tier = 0;
    for(let t of tierThresholds){
        if(i >= t.threshold && t.tier > tier) tier = t.tier;
    }
    return tier;
}

export function allTiers(p){
    let tiers = [];
    for(let t of Object.keys(p.tracks)){
        tiers.push(getTier(p, t));
    }
    return tiers;
}

export function highestTier(p){
    return Math.max(allTiers(p));
}

export function lowestTier(p){
    return Math.min(allTiers(p));
}

export let basicTracks = {
    'society': [
        null,
        {
            verb: 'gain_resource',
            type: ['credits', 'science']
        },
        {
            verb: 'increase_population', // always by 1 unless obj is num
        },
        {
            verb: 'gain_agenda'
        },
        {
            verb: 'increase_population', // always by 1 unless obj is num
        },
        {
            verb: 'increase_population', // always by 1 unless obj is num
        },
        [ // Array = and/or (straight OR is done via an object called 'choice')
            {
                verb: 'increase_population', // always by 1 unless obj is num
            },
            {
                verb: 'remove_corruption'
            }
        ],
        {
            verb: 'gain_influence', // always by 1 unless obj is num
            num: 20
        },
    ],
    statecraft: [
        null,
        {
            verb: 'activate'
        },
        {
            verb: 'gain_tech'
        },
        {
            verb: 'gain_agenda'
        },
        {
            verb: 'remove_corruption'
        },
        {
            verb: 'gain_tech'
        },
        [
            {
                verb: 'upgrade_glory',
            },
            {
                verb: 'gain_influence',
                per: 'total_glory' // i.e. total glory value, not number of tokens
            }
        ],
        {
            verb: 'score_agenda',
            num: 1 
        }
    ],
    economy: [
        null,
        {
            verb: 'advance_track',
            obj: 'economy',
            noCheck: true
        },
        {
            verb: 'gain_trade'
        },
        {
            verb: 'establish'
        },
        {
            verb: 'gain_trade'
        },
        {
            verb: 'gain_agenda'
        },
        [
            {
                verb: 'establish'
            },
            {
                verb: 'gain_trade'
            }
        ],
        {
            verb: 'gain_influence',
            num: 2,
            per: 'guild',
            restriction: 'pure'
        }
    ]
}

export let specialTracks = {
    Astoran: {
        society: ['establish', 'increase_population', ['increase_population', 'build'], ['increase_population', 'build'], {verb: 'gain_agenda', type: 'might'}, ['increase_population', 'remove_corruption'], {verb: 'gain_influence', num: 25}],
        statecraft: ['skip', {verb: 'gain_agenda', type: 'support'}, ['build', 'activate'], 'remove_corruption', 'gain_tech', [{verb: 'gain_agenda', type: 'dominance'}, 'remove_corruption'], {verb: 'gain_influence', num:2, per: 'installation', restriction: 'pure'}],
        economy: [
            {
                verb: 'gain_resource',
                types: {food: 1, energy: 1, materials: 1, credits: 1, science: 1}
            },
            'establish', 'skip', 'gain_agenda', {verb: 'produce', num: 2, restriction: 'different'}, {verb: 'gain_influence', per: 'fleets', restriction: 'pure'}, {verb: 'gain_influence', num: 15}
        ]
    },
    Fenrax: {
        society: ['increase_population', 'establish', {verb: 'gain_agenda', type: 'might'}, ['increase_population', 'establish'], ['increase_population', 'remove_corruption'], {verb: 'gain_influence', per: 'fleets', restriction: 'pure'}, 
        {
            simple_list: [
                {
                    verb: 'gain_influence',
                    num: 2,
                    per: 'fleets',
                    restriction: 'pure'
                },
                {
                    verb: 'gain_influence',
                    num: 2,
                    per: 'fleets',
                    filter: 'active'
                },
            ]
        }],
        statecraft: ['skip', 'activate', 'skip', {verb: 'deploy', deploy_per: 'shipyard'}, {verb: 'deploy', deploy_per: 'shipyard'}, 'gain_tech', 'gain_influence_18'],
        economy: [{verb: 'gain_resource', types: {credits: 1, science: 1}}, {verb: 'gain_tech', type: 'basic'}, 'skip', 'establish', 'gain_trade', ['gain_trade', 'remove_corruption'], 'gain_influence_18']
    },
    Kradmor: {
        society: ['increase_population', 'increase_population', 'skip', 'increase_population', ['increase_population', 'remove_corruption'], {verb: 'gain_agenda', type: 'might'}, {verb: 'gain_influence', num: 20}],
        statecraft: ['build', ['build', 'activate'], 'skip', ['build', 'activate'], 'gain_tech', ['build', {verb: 'gain_influence', per: 'total_glory'}], {verb: 'gain_influence', num: 20}],
        economy: ['gain_trade', {verb: 'gain_agenda', type: 'wealth'}, 'skip', 'gain_trade', {verb: 'produce', num: 2, restriction: 'different'}, ['gain_agenda', 'gain_trade'], {verb: 'gain_influence', num: 20}]
    },
    Marqualos: {
        society: ['skip', 'increase_population', 'increase_population', 'remove_corruption', {verb: 'gain_resource', types: {food: 2, credits: 2, science: 2}}, ['increase_population', 'remove_corruption'], 'score_agenda'],
        statecraft: ['remove_corruption', {verb: 'gain_tech', type: 'basic'}, {verb: 'gain_agenda', type: 'support'}, ['activate', 'gain_trade'], 'gain_tech', [{verb: 'gain_influence', num: 8}, 'regroup'], ['upgrade_glory', {verb: 'gain_influence', per: 'total_glory'}]],
        economy: ['gain_trade', 'establish', 'skip', 'establish', 'gain_trade', ['gain_agenda', 'gain_trade'], 'score_agenda']
    },
    Nervo: {
        society: ['increase_population', 'remove_corruption', 'skip', ['increase_population', 'remove_corruption'], 'gain_tech', ['increase_population', 'increase_population'], {verb: 'gain_influence', num: 8, per: 'sector', filter: {num: 6, type: 'population'}}],
        statecraft: [['build', 'activate'], 'establish', ['activate', 'deploy'], {verb: 'gain_agenda', type: 'support'}, 'remove_corruption', 'gain_tech', {verb: 'gain_influence', num: 6, per: 'techs', filter: 'improved'}],
        economy: [{verb: 'gain_resource', types: {credits: 2}}, 'establish', 'gain_trade', 'remove_corruption', [{verb: 'gain_agenda', type: 'wealth'}, 'gain_trade'], ['gain_trade', 'produce'], 'gain_influence_15']
    },
    Novaris: {
        society: ['skip', {verb: 'establish', type: 'engineers_guild'}, 'remove_corruption', {verb: 'gain_agenda', type: 'might'}, ['increase_population', 'remove_corruption'], ['increase_population', 'remove_corruption'], 'gain_influence_22'],
        statecraft: ['skip', {verb: 'gain_agenda', type: 'support'}, 'activate', {verb: 'gain_tech', type: 'basic'}, ['activate', 'remove_corruption'], 'gain_tech', 'gain_influence_24'],
        economy: ['skip', {verb: 'gain_resource', types: {energy: 1, materials: 1}}, 'gain_trade', 'gain_agenda', ['establish', 'regroup'], ['establish', 'gain_trade'], 'gain_influence_22']
    },
    Shiveus: {
        society: ['increase_population', ['increase_population', 'build'], 'skip', ['gain_trade', 'remove_corruption'], ['increase_population', {verb: 'gain_resource', types: {food: 3}}], 'skip', 'gain_influence_20'],
        statecraft: [{verb: 'activate', num: 2}, {verb: 'deploy', num: 2}, {verb: 'gain_tech', type: 'basic'}, 'remove_corruption', 'gain_tech', [{verb: 'gain_agenda', type: 'dominance'}, {verb: 'gain_influence', per: 'total_glory'}], {verb: 'gain_influence', num: 2, per: 'sector', restriction: 'pure'}],
        economy: [{verb: 'gain_resource', types: {credits: 2}}, ['gain_trade', 'activate'], 'produce', {verb: 'gain_agenda', type: 'wealth'}, {verb: 'gain_agenda', type: 'dominance'}, {verb: 'gain_influence', per: 'guild', restriction: 'pure'}, 'gain_influence_18']
    },
    Thegwyn: {
        society: ['skip', 'remove_corruption', {verb: 'gain_tech', type: 'basic'}, 'increase_population', ['increase_population', 'remove_corruption'], 'gain_tech', 'gain_influence_20'],
        statecraft: ['activate', {verb: 'establish', type: 'farmers_guild'}, 'gain_tech', {verb: 'activate', num: 2}, {verb: 'gain_agenda', type: 'support'}, [{verb: 'deploy', deploy_per: 'shipyard'}, {verb: 'gain_influence', per: 'total_glory'}], {verb: 'gain_influence', num: 3, per: 'sector', restriction: 'pure'}],
        economy: ['gain_trade', 'gain_trade', 'establish', 'produce', {verb: 'gain_agenda', type: 'wealth'}, 'score_agenda', {verb: 'gain_influence', num: 2, per: 'guild', restriction: 'pure'}]
    },
    Yarvek: {
        society: ['increase_population', {verb: 'gain_reclaim', place: 'home'}, {verb: 'gain_agenda', type: 'might'}, {verb: 'gain_reclaim', place: 'home'}, ['gain_bounty', 'remove_corruption'], ['gain_bounty', {verb: 'advance_track', obj: 'statecraft'}], null],
        statecraft: ['activate', 'build', [{verb: 'gain_tech', type: 'basic'}, 'activate'], ['activate', {verb: 'deploy', num: 2}], ['activate', 'activate'], [{verb: 'deploy', num: 2}, {verb: 'gain_influence', per: 'total_glory'}], null],
        economy: ['gain_bounty', {verb: 'gain_bounty', num: 2}, ['gain_bounty', 'gain_trade'], {verb: 'gain_agenda', type: 'wealth'}, ['gain_bounty', {verb: 'gain_resource', num: 4}], 'score_agenda', null]
    },
    Zenor: {
        society: ['increase_population', 'remove_corruption', {verb: 'gain_agenda', type: 'might'}, 'remove_corruption', ['increase_population', 'remove_corruption'], 'score_agenda', 'gain_influence_15'],
        statecraft: ['activate', ['build', 'activate'], 'skip', 'gain_tech', ['regroup', 'activate'], {verb: 'gain_agenda', type: 'dominance'}, {verb: 'gain_influence', num: 4, per: 'scientists_guild'}],
        economy: [{verb: 'gain_resource', types: {food: 1, energy: 1, materials: 1, science: 1}}, 'establish', 'skip', ['establish', 'gain_trade'], ['establish', 'gain_trade'], {verb: 'gain_influence', per: 'total_glory'}, {verb: 'gain_influence', num: 3, per: 'sector', restriction: 'pure', filter: {min: 1, type: 'guilds'}}]
    },
}

for(let k of Object.keys(specialTracks)){
    for(let t of Object.keys(specialTracks[k])){
        if(specialTracks[k][t][0] != null) specialTracks[k][t] = [null, ...specialTracks[k][t]]; // Always empty start
        for(let i = 0; i < specialTracks[k][t].length; i++){
            if(!specialTracks[k][t][i]) continue;
            if(specialTracks[k][t][i] == 'skip') specialTracks[k][t][i] = {verb: 'advance_track', obj: t, noCheck: true};
            if(typeof specialTracks[k][t][i] == 'string' && specialTracks[k][t][i].startsWith('gain_influence_')){
                let num = parseInt(specialTracks[k][t][i].slice('gain_influence_'.length));
                specialTracks[k][t][i] = {
                    verb: 'gain_influence',
                    num
                }
            }
        }
    }
}