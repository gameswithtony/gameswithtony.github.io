// Short labels. The UI leans on icons + numbers; these are captions, tooltips and screen-reader text.

export const ACTION = {
    pod: { ic: 'pod', name: 'Pod', long: 'Landing Pod: travel to Mars now' },
    blueprint: { ic: 'blueprint', name: 'Blueprint', long: 'Take a blueprint (+1 per boost)' },
    tech: { ic: 'tech', name: 'Tech', long: 'Learn a tech (+1 per boost)' },
    rnd: { ic: 'develop', name: 'R&D', long: 'Develop twice (+1 per boost)' },
    resupply: { ic: 'warehouse', name: 'Supply', long: 'Take from the warehouse (+1 per boost)' },
    construct: { ic: 'shelter', name: 'Build', long: 'Construct a building near your bots' },
    upgrade: { ic: 'upgrade', name: 'Upgrade', long: 'Upgrade a building with a blueprint' },
    hire: { ic: 'scientist', name: 'Hire', long: 'Hire a scientist or take a contract' },
    control: { ic: 'rover', name: 'Move', long: 'Move bots 2 + rover 2 (crystals add moves)' },
    ship: { ic: 'ship', name: 'Ship', long: 'Welcome a ship: plant + water (+1 per boost)' },
};
export const EXEC = {
    develop: { ic: 'develop', name: 'Develop', long: 'Develop a tech once, free' },
    rover: { ic: 'rover', name: 'Rover', long: 'Move your rover 2' },
    blueprint: { ic: 'blueprint', name: 'Blueprint', long: 'Take a blueprint' },
    upgrade: { ic: 'upgrade', name: 'Upgrade', long: 'Upgrade a building' },
    mineral: { ic: 'mineral', name: 'Mineral', long: 'Gain a mineral' },
    bots: { ic: 'bot', name: 'Bots', long: 'Move your bots 2' },
    warehouse: { ic: 'warehouse', name: 'Supply', long: 'Take 1 from the warehouse' },
    adv: { ic: 'adv', name: 'Advanced', long: 'Use an advanced building' },
};
export const BP_EX = {
    upgrade1: { ic: 'upgrade', long: 'Upgrade 1 (+1 per boost)' },
    build: { ic: 'shelter', long: 'Construct this type (boost = tech levels)' },
    produce: { ic: 'production', long: 'All your advanced buildings & miners produce' },
    ship: { ic: 'ship', long: 'Welcome a ship: 2 colonists + bot, or 3 colonists' },
    warehouse: { ic: 'warehouse', long: 'Take 1 from the warehouse (+1 per boost)' },
    tech: { ic: 'tech', long: 'Learn a tech (+1 per boost)' },
    casino: { ic: 'crystal', long: 'Gain 2 crystals (+1 per boost)' },
    op2: { ic: 'op', long: 'Score 2 OP' },
    contract: { ic: 'contract', long: 'Take a contract (pay 1 crystal)' },
    radar: { ic: 'discovery', long: 'Keep a discovery tile here; use its benefit' },
    drone: { ic: 'upgrade', long: 'Upgrade anywhere on Mars' },
    research: { ic: 'develop', long: 'Develop twice, paying (+1 per boost)' },
    aqueduct: { ic: 'retrieve', long: 'Move 2 colonists from work area home' },
    resort: { ic: 'retrieve', long: 'Recall your colonists from one side' },
    trade: { ic: 'swap', long: 'Spend 1 resource, gain 2 (+1 per boost)' },
    recycle: { ic: 'bot', long: 'Bots move 2 and collect like rovers' },
    elevator: { ic: 'travel', long: 'Travel to orbit' },
    library: { ic: 'blueprint', long: 'Take a blueprint (+1 per boost)' },
    command: { ic: 'rover', long: 'Rover moves up to the top rover tech level' },
};
export const DISC = {
    build: 'Construct this type', buildAny: 'Construct any type', develop2: 'Develop ×2 (pay)', blueprints2: 'Take 2 blueprints',
    tech1: 'Take a tech (pay)', upgrade2: 'Upgrade ×2 (pay)', hire: 'Hire / contract (pay)', warehouse2: 'Warehouse ×2', gain: 'Gain',
};
export const GOAL = {
    blueprints4: 'Have 4 blueprints', shelters3: 'Have 3 shelters', mines3: '3 mines with your colonist or marker',
    discovery3: 'Rover took 3 discovery tiles', advComplex4: 'Advanced marker on a complex of 4+', sameRes4: '4 of one resource (not mineral)',
    adv3: '3 advanced buildings', level3: 'Colony level 3', colonists7: '7 colonists at home', techs5: '5 techs',
    ships3: '3 ships in hangar', research2: '2 research tiles', sciContract: 'A scientist + a completed contract',
    labSpaces: 'Techs on lab spaces 4-middle, 5-top, 5-bottom', progress3: '3 progress cubes', adv2Complex3: 'Advanced markers on 2 complexes of 3+',
};
export const GOAL_R = {
    develop2: 'Develop ×2 free', upgrade2: 'Upgrade ×2 free', colonists2: '+2 colonists home', minerals3: '+3 minerals', rover5: 'Rover moves 5',
    contract: 'Free contract', res3: '+3 resources', ship: 'Free ship', retrieve2: 'Retrieve 2 colonists', travel: 'Travel now',
    scientist: 'Free scientist', crystals3: '+3 crystals',
};
export const LSS_TILE = {
    techLevel: { ic: 'tech', per: '×', long: 'OP = your best tech level' }, ships: { ic: 'ship', per: '2', long: '2 OP per ship in hangar' },
    advMarkers: { ic: 'adv', per: '2', long: '2 OP per advanced building' }, mines: { ic: 'mine', per: '2', long: '2 OP per mine you work or upgraded' },
    bots: { ic: 'bot', per: '2', long: '2 OP per bot on Mars' }, discovery: { ic: 'discovery', per: '2', long: '2 OP per discovery tile' },
    shelters: { ic: 'shelter', per: '2', long: '2 OP per shelter' }, colonists: { ic: 'colonist', per: '1', long: '1 OP per colonist at home' },
};
export const LSS_BEN = { bots: { ic: 'bot', long: 'Bots move 2' }, mineral: { ic: 'mineral', long: '+1 mineral' }, crystal: { ic: 'crystal', long: '+1 crystal' }, retrieve: { ic: 'retrieve', long: 'Retrieve a colonist' } };
export const SPACE = { warehouse: { ic: 'warehouse', long: 'Take 1 from warehouse' }, tech: { ic: 'tech', long: 'Take a tech (pay)' }, colonist: { ic: 'colonist', long: 'Pay water/plant: +1 colonist home' }, bots: { ic: 'bot', long: 'Bots move 2' }, blueprint: { ic: 'blueprint', long: 'Take a blueprint' } };
export const LAB_BEN = { warehouse: 'warehouse', crystal: 'crystal', mineral: 'mineral', bots: 'bot', upgrade: 'upgrade', blueprint: 'blueprint' };
export const BLOCK = { busy: 'Your colonist is already there', colonist: 'No colonist at home', cost: "Can't pay", none: 'Nothing possible', level: 'Ship limit = colony level', ship: 'Locked by a ship', full: 'Storage full',
    labFull: 'Lab column 1 full', noMarker: 'No markers left', noSupply: 'No colonists in supply', lqFull: 'Living quarters full' };
export const TITLE = {
    menu: ['play', 'Your turn'], boost: ['boost', 'Boost?'], slotCost: ['colonist', 'Slot cost'], blueprint: ['blueprint', 'Take blueprint'],
    tech: ['tech', 'Take tech'], labSpace: ['tech', 'Lab space'], develop: ['develop', 'Develop'], devTo: ['develop', 'Move to'],
    warehouse: ['warehouse', 'Warehouse'], pay: ['crystal', 'Pay with'], goalCrystal: ['goal', 'Spend goal card'], buildType: ['shelter', 'Build what?'],
    buildHex: ['shelter', 'Where?'], lssBen: ['lss', 'LSS bonus'], retrieve: ['retrieve', 'Retrieve from'], upgradeBp: ['upgrade', 'Which blueprint?'],
    upgradeHex: ['upgrade', 'Which building?'], useTech: ['tech', "Use Pathfinder's tech?"], hire: ['scientist', 'Hire / contract'],
    refill: ['contract', 'Refill with'], ship: ['ship', 'Unlock which action?'], shipGain: ['ship', 'Ship brings'], adv: ['adv', 'Advanced building'],
    side: ['retrieve', 'Recall from'], tradeOut: ['swap', 'Spend'], tradeIn: ['swap', 'Gain'], radar: ['discovery', 'Keep which tile?'],
    goalReward: ['goal', 'Goal reward'], techReward: ['tech', 'Your tech was used'], travel: ['shuttle', 'Travel?'], discPick: ['discovery', 'Which tile?'],
    discHex: ['discovery', 'Place tile'], space: ['clock', 'Turn order'], movePick: ['rover', 'Move'], moveTo: ['rover', 'Move to'],
    displace: ['bot', 'Displaced: move to'], placeBot: ['bot', 'Place new bot'], produceExtra: ['production', 'Produce again'],
    pfTurn: ['pf', 'Pathfinder'], over: ['trophy', 'Game over'], lost: ['lock', 'Bonus could not be used'],
};
export const RES_NAME = { mineral: 'Mineral', battery: 'Battery', water: 'Water', plant: 'Plant', oxygen: 'Oxygen', crystal: 'Crystal', colonist: 'Colonist', goal: 'Goal card', any: 'Any' };
export const TYPE_IC = { mine: 'mine', gen: 'gen', water: 'water', green: 'plant', oxy: 'oxygen', shelter: 'shelter' };
export const TYPE_RES = { mine: 'mineral', gen: 'battery', water: 'water', green: 'plant', oxy: 'oxygen', shelter: 'crystal' };
export const TECH_NAME = { mine: 'Mine', gen: 'Power', water: 'Water', green: 'Plants', oxy: 'Oxygen', shelter: 'Shelter', rover: 'Rover', colonist: 'Colonists', upgrade: 'Upgrade' };
export const TECH_IC ={ mine: 'mine', gen: 'gen', water: 'water', green: 'plant', oxy: 'oxygen', shelter: 'shelter', rover: 'rover', colonist: 'colonist', upgrade: 'upgrade' };
