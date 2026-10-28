const LOCALSTORAGENAME = "mcgamestate";

const TYPE = { MainScheme: 0, SideScheme: 1, Character: 2, CounterCard: 3 };

const PAGE_STATE = { Main: 0, Edit: 1, Load: 2 };

const updateHitPoints = function (points, event) {
    let totalpoints = new Number(this.hitpoints) + new Number(points);

    if (this.type != TYPE.SideScheme && totalpoints > this.maxhitpoints) {
        totalpoints = this.maxhitpoints;
    }

    if (this.type == TYPE.SideScheme && totalpoints > this.maxhitpoints) {
        this.maxhitpoints = totalpoints;
    }

    this.hitpoints = totalpoints;
    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const updateMaxHitPoints = function (points, event) {
    this.maxhitpoints = new Number(this.maxhitpoints) + new Number(points);

    if (this.hitpoints > this.maxhitpoints) {
        this.hitpoints = this.maxhitpoints;
    }

    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const updateCounter = function (diff, event) {
    let totalcounter = new Number(this.counter) + new Number(diff);
    this.counter = totalcounter;
    if (this.counter < 0) {
        this.counter = 0;
    }
    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const updateThreatCounter = function (diff, event) {
    let totalthreatcounter = new Number(this.threatcounter) + new Number(diff);
    this.threatcounter = totalthreatcounter;
    if (this.threatcounter < 0) {
        this.threatcounter = 0;
    }
    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const hideMe = function (event) {
    this.hide = true;

    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const showMe = function (event) {
    this.hide = false;

    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const toggleStatus = function (type, event) {
    if (type === 0) {
        this.isStunned = !this.isStunned;
    }

    if (type === 1) {
        this.isConfused = !this.isConfused;
    }

    if (type === 2) {
        this.isTough = !this.isTough;
    }

    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

// for characters that can hold several of one status card (Luke Cage's tough cards, steady enemies)
const changeStatusCount = function (status, diff, event) {
    let count = new Number(this[status + 'count'] || 0) + diff;
    count = Math.max(0, Math.min(this['max' + status], count));
    this[status + 'count'] = count;
    this['is' + _.capitalize(status)] = count > 0;

    app.saveGameState();
    event.preventDefault();
    app.$forceUpdate();
}

const STATUSES = ['stunned', 'confused', 'tough'];

function copyStatusLimits(entry, character) {
    STATUSES.forEach(function (status) {
        if (entry['max' + status] > 1) {
            character['max' + status] = entry['max' + status];
            character[status + 'count'] = 0;
        }
    });
}

function createCharacter(id, name, hitpoints, type) {
    return {
        id: id,
        name: name,
        hitpoints: hitpoints,
        maxhitpoints: hitpoints,
        counter: hitpoints,
        threatcounter: 0,
        hasThreatCounter: false,
        isThreat: false,
        hide: false,
        isStunned: false,
        isTough: false,
        isConfused: false,
        type: type,
        updateHitPoints: updateHitPoints,
        updateMaxHitPoints: updateMaxHitPoints,
        updateCounter: updateCounter,
        updateThreatCounter: updateThreatCounter,
        toggleStatus: toggleStatus,
        changeStatusCount: changeStatusCount,
        hideMe: hideMe,
        showMe: showMe
    };
}
let sampleScheme = createCharacter(0, 'Main Scheme', 7, TYPE.MainScheme);
sampleScheme.hitpoints = 0;

var app = new Vue({
    el: '#mc',
    data: {
        characters: [],
        pageState: PAGE_STATE.Main,
        showToggleButtons: true,
        charactersbeforeedit: null,
        numberOfPlayers: 1,
        heroes: heroes,
        villains: villains,
        main_schemes: main_schemes,
        side_schemes: side_schemes,
        minions: minions,
        allies: allies,
        modules: modules,
        aspects: aspects,
        countercards: countercards,
        hideListsForSetup: false,
        hideSideSchemes: false,
        hideAllies: false,
        hideMinions: false,
        hideCounters: false,
        autoFilterSideSchemesAndMinions: true,
        filterModule: "",
        filterAspect: "",
        computedUpdater: 1,
        version: "1.36",
        carddatadate: typeof carddatadate !== 'undefined' ? carddatadate : ''   // a cached older data.js won't have it
    },
    mounted: function() {
        this.computedUpdater++;
        if (localStorage.getItem(LOCALSTORAGENAME)) {
            let gameState = JSON.parse(localStorage.getItem(LOCALSTORAGENAME));
            this.characters = gameState.characters;

            if (gameState.hasOwnProperty("showToggleButtons")) {
                this.showToggleButtons = gameState.showToggleButtons;
            }

            if (gameState.hasOwnProperty("numberOfPlayers")) {
                this.numberOfPlayers = gameState.numberOfPlayers;
            }

            if (gameState.hasOwnProperty("hideListsForSetup")) {
                this.hideListsForSetup = gameState.hideListsForSetup;
            }

            if (gameState.hasOwnProperty("hideSideSchemes")) {
                this.hideSideSchemes = gameState.hideSideSchemes;
            }

            if (gameState.hasOwnProperty("hideAllies")) {
                this.hideAllies = gameState.hideAllies;
            }

            if (gameState.hasOwnProperty("hideMinions")) {
                this.hideMinions = gameState.hideMinions;
            }

            if (gameState.hasOwnProperty("hideCounters")) {
                this.hideCounters = gameState.hideCounters;
            }

            if (gameState.hasOwnProperty("autoFilterSideSchemesAndMinions")) {
                this.autoFilterSideSchemesAndMinions = gameState.autoFilterSideSchemesAndMinions;
            }

            if (gameState.hasOwnProperty("filterModule")) {
                this.filterModule = gameState.filterModule;
            }

            if (gameState.hasOwnProperty("filterAspect")) {
                this.filterAspect = gameState.filterAspect;
            }

            // card data updates can rename modules and aspects
            if (!_.some(this.modules, { name: this.filterModule })) {
                this.filterModule = "";
            }

            if (!_.some(this.aspects, { name: this.filterAspect })) {
                this.filterAspect = "";
            }

            for(let i=0; i < this.characters.length; i++) {
                this.characters[i].updateHitPoints = updateHitPoints;
                this.characters[i].updateMaxHitPoints = updateMaxHitPoints;
                this.characters[i].updateCounter = updateCounter;
                this.characters[i].updateThreatCounter = updateThreatCounter;
                this.characters[i].toggleStatus = toggleStatus;
                this.characters[i].changeStatusCount = changeStatusCount;
                this.characters[i].hideMe = hideMe;
                this.characters[i].showMe = showMe;
                
                // properties added after release...
                if (!this.characters[i].hasOwnProperty("id")) {
                    this.characters[i].id = i+1;
                }

                if (!this.characters[i].hasOwnProperty("hide")) {
                    this.characters[i].hide = false;
                }

                if (!this.characters[i].hasOwnProperty("maxhitpoints")) {
                    this.characters[i].maxhitpoints = 10;
                }

                if (!this.characters[i].hasOwnProperty("isStunned")) {
                    this.characters[i].isStunned = false;
                }

                if (!this.characters[i].hasOwnProperty("isTough")) {
                    this.characters[i].isTough = false;
                }

                if (!this.characters[i].hasOwnProperty("isConfused")) {
                    this.characters[i].isConfused = false;
                }

                if (!this.characters[i].hasOwnProperty("type")) {
                    this.characters[i].type = TYPE.Character;
                }

                if (!this.characters[i].hasOwnProperty("threatcounter")) {
                    this.characters[i].threatcounter = 0;
                }

                if (!this.characters[i].hasOwnProperty("hasThreatCounter")) {
                    this.characters[i].hasThreatCounter = false;
                }
            };
        }
    },
    computed: {
        hiddenCharacters: function () {
            let self = this;
            this.computedUpdater++;
            return _.filter(self.characters, function (c) {
                return c.hide === true;
            });
        },
        allSelectedMainCharacterNames: function () {
            let charactersAdded = _.filter(this.characters, function (c) {
                return c.isHero || c.isVillain
            });
            let charactersAddedNames = _.map(charactersAdded, 'name');

            let heroesSelected = _.filter(this.heroes, function (h) {
                return h.isSelected;
            });
            let heroesSelectedNames = _.map(heroesSelected, 'name');

            let villainsSelected = _.filter(this.villains, function (v) {
                return v.isSelected;
            });
            let villainsSelectedNames = _.map(villainsSelected, 'name');

            let charactersSelectedNames = _.union(heroesSelectedNames, villainsSelectedNames);

            return _.union(charactersAddedNames, charactersSelectedNames);
        },
        allSelectedOwnerNames: function () {
            // an aspect can bring encounter cards with it ('Pool brings the Dreadpool set)
            if (this.filterAspect == '') {
                return this.allSelectedMainCharacterNames;
            }

            return _.union(this.allSelectedMainCharacterNames, [ this.filterAspect ]);
        },
        filteredMainSchemes: function () {
            let self = this;
            if (!this.autoFilterSideSchemesAndMinions) {
                return this.main_schemes;
            }

            let filtered = _.filter(this.main_schemes, function (m) {
                let moduleMatch = true;

                if (self.filterModule != '') {
                    moduleMatch = (_.intersection(m.belongsto, [ self.filterModule ])).length > 0;
                }

                return (m.belongstotype === 'module' && moduleMatch) || (_.intersection(m.belongsto, self.allSelectedMainCharacterNames)).length > 0;
            });
            return filtered;
        },
        filteredSideSchemes: function () {
            let self = this;
            if (!this.autoFilterSideSchemesAndMinions) {
                return this.side_schemes;
            }

            let filtered = _.filter(this.side_schemes, function (s) {
                let moduleMatch = true;
                let aspectMatch = true;

                if (self.filterModule != '') {
                    moduleMatch = (_.intersection(s.belongsto, [ self.filterModule ])).length > 0;
                }

                if (self.filterAspect != '') {
                    aspectMatch = (_.intersection(s.belongsto, [ self.filterAspect ])).length > 0;
                }

                return (s.belongstotype === 'aspect' && (aspectMatch || s.belongsto[0] === 'Basic')) || (s.belongstotype === 'module' && moduleMatch) || (_.intersection(s.belongsto, self.allSelectedOwnerNames)).length > 0;
            });
            return filtered;
        },
        filteredMinions: function () {
            let self = this;
            if (!this.autoFilterSideSchemesAndMinions) {
                return this.minions;
            }
            
            let filtered = _.filter(this.minions, function (m) {
                let moduleMatch = true;

                if (self.filterModule != '') {
                    moduleMatch = (_.intersection(m.belongsto, [ self.filterModule ])).length > 0;
                }

                let belongstoisarray = _.isArray(m.belongstotype);
                return ((m.belongstotype === 'module' || (belongstoisarray && m.belongstotype[0] === 'module')) && moduleMatch) || (_.intersection(m.belongsto, self.allSelectedOwnerNames)).length > 0;
            });
            return filtered;
        },
        filteredCounterCards: function () {
            let self = this;
            if (!this.autoFilterSideSchemesAndMinions) {
                return this.countercards;
            }

            let filtered = _.filter(this.countercards, function (c) {
                // Keep cards that are explicitly selected
                if (c.isSelected) return true;
                
                // Keep cards that don't have a belongstotype property
                if (!c.belongstotype) return true;

                let moduleMatch = true;
                let aspectMatch = true;

                if (self.filterModule != '') {
                    moduleMatch = (_.intersection(c.belongsto, [ self.filterModule ])).length > 0;
                }

                if (self.filterAspect != '') {
                    aspectMatch = (_.intersection(c.belongsto, [ self.filterAspect ])).length > 0;
                }

                return (c.belongstotype === 'aspect' && (aspectMatch || c.belongsto[0] === 'Basic')) || (c.belongstotype === 'module' && moduleMatch) || (_.intersection(c.belongsto, self.allSelectedOwnerNames)).length > 0;
            });
            return filtered;
        },
    },
    methods: {
        edit: function () {
            this.pageState = PAGE_STATE.Edit;
            this.charactersbeforeedit = _.cloneDeep(this.characters);
            window.scrollTo(0,0);
        },
        save: function () {
            // check if current hitpoints are greater than any new max hitpoints
            for(let i=0; i < this.characters.length; i++) {
                if (this.characters[i].hitpoints > this.characters[i].maxhitpoints) {
                    this.characters[i].hitpoints = this.characters[i].maxhitpoints;
                }

                // status card counts typed on the edit page
                let character = this.characters[i];
                STATUSES.forEach(function (status) {
                    if (character['max' + status] > 1) {
                        let count = Math.max(0, Math.min(character['max' + status], Number(character[status + 'count']) || 0));
                        character[status + 'count'] = count;
                        character['is' + _.capitalize(status)] = count > 0;
                    }
                });

                // check if new max hit points are larger
                let currentid = this.characters[i].id;
                let matchingpreviouscharacter = this.charactersbeforeedit.find(function (c) { return c.id === currentid });
                if (matchingpreviouscharacter) {
                    let maxdiff = new Number(this.characters[i].maxhitpoints) - new Number(matchingpreviouscharacter.maxhitpoints);

                    if (maxdiff > 0 && this.characters[i].hitpoints < this.characters[i].maxhitpoints) {
                        this.characters[i].hitpoints = new Number(this.characters[i].hitpoints) + new Number(maxdiff);
                    }
                }  else {
                    // new schemes
                    if (this.characters[i].type == TYPE.MainScheme) {
                        this.characters[i].hitpoints = 0;
                    }

                    if (this.characters[i].type == TYPE.SideScheme) {
                        this.characters[i].hitpoints = this.characters[i].maxhitpoints;
                    }
                }
            }

            this.characters = _.sortBy(this.characters, "type");

            this.pageState = PAGE_STATE.Main;
            window.scrollTo(0,0);
            this.saveGameState();
        },
        add: function (event) {
            let newcharacter = createCharacter(this.characters.length + 1, '', 10, TYPE.Character);
            newcharacter.counter = 0;
            this.characters.push(newcharacter);

            // if there are counter cards, move this above them
            if (this.characters.length > 1) {
                startingindex = this.characters.length - 1;
                while (startingindex > 0 && this.characters[startingindex - 1].type === TYPE.CounterCard) {
                    this.moveup(startingindex, event);
                    startingindex--;
                }
            }

            event.preventDefault();
        },
        showOfficialList: function (event) {
            this.pageState = PAGE_STATE.Load;
            window.scrollTo(0,0);
            event.preventDefault();
        },
        addofficial: function () {
            for (let i=0;i<this.heroes.length;i++) {
                if (this.heroes[i].isSelected) {
                    let newcharacter = createCharacter(1000+i, this.heroes[i].name, this.heroes[i].hitpoints, TYPE.Character);

                    if (this.heroes[i].useCounter) {
                        newcharacter.useCounter = true;
                        newcharacter.counter = this.heroes[i].counter;
                    }

                    if (this.heroes[i].hasThreatCounter) {
                        newcharacter.hasThreatCounter = true;
                        newcharacter.threatcounter = 0;
                    }

                    copyStatusLimits(this.heroes[i], newcharacter);
                    newcharacter.isHero = true;
                    newcharacter.isGoodGuy = true;
                    this.characters.push(newcharacter);
                    this.heroes[i].isSelected = false;
                }
            }

            for (let i=0;i<this.villains.length;i++) {
                if (this.villains[i].isSelected) {
                    let villainhitpoints = this.villains[i].hitpoints;

                    if (this.villains[i].hitpointsper) {
                        villainhitpoints = new Number(this.villains[i].hitpoints) * new Number(this.numberOfPlayers);
                    }

                    let newcharacter = createCharacter(2000+i, this.villains[i].name, villainhitpoints, TYPE.Character);
                    copyStatusLimits(this.villains[i], newcharacter);
                    newcharacter.isVillain = true;
                    newcharacter.isBadGuy = true;
                    this.characters.push(newcharacter);
                    this.villains[i].isSelected = false;
                }
            }

            for (let i=0;i<this.main_schemes.length;i++) {
                if (this.main_schemes[i].isSelected) {
                    let threat = this.calculateThreat(this.main_schemes[i]);

                    let newcharacter = createCharacter(3000+i, this.main_schemes[i].name, threat, TYPE.MainScheme);

                    if (this.main_schemes[i].useCounter) {
                        newcharacter.useCounter = true;
                        newcharacter.counter = this.main_schemes[i].counter;
                    }

                    if (this.main_schemes[i].type === 'main_scheme' && this.main_schemes[i].basethreat > 0 && this.main_schemes[i].basethreatfixed) {
                        newcharacter.hitpoints = this.main_schemes[i].basethreat;
                    } else if (this.main_schemes[i].type === 'main_scheme' && this.main_schemes[i].basethreat > 0 && !this.main_schemes[i].basethreatfixed) {
                        newcharacter.hitpoints = this.main_schemes[i].basethreat * this.numberOfPlayers;
                    } else {
                        newcharacter.hitpoints = 0;
                    }
                    
                    this.characters.push(newcharacter);
                    this.main_schemes[i].isSelected = false;
                }
            }

            for (let i=0;i<this.side_schemes.length;i++) {
                if (this.side_schemes[i].isSelected) {
                    let threat = this.calculateThreat(this.side_schemes[i]);

                    let newcharacter = createCharacter(4000+i, this.side_schemes[i].name, threat, TYPE.SideScheme);

                    if (this.side_schemes[i].useCounter) {
                        newcharacter.useCounter = true;
                        newcharacter.counter = this.side_schemes[i].counter;
                    }

                    if (this.side_schemes[i].isPlayerSideScheme) {
                        newcharacter.isPlayerSideScheme = true;
                    }

                    this.characters.push(newcharacter);
                    this.side_schemes[i].isSelected = false;
                }
            }

            for (let i=0;i<this.allies.length;i++) {
                if (this.allies[i].isSelected) {
                    let newcharacter = createCharacter(5000+i, this.allies[i].name, this.allies[i].hitpoints, TYPE.Character);
                    if (this.allies[i].useCounter) {
                        newcharacter.useCounter = true;
                        newcharacter.counter = this.allies[i].counter;
                    }

                    copyStatusLimits(this.allies[i], newcharacter);
                    newcharacter.isAlly = true;
                    newcharacter.isGoodGuy = true;
                    this.characters.push(newcharacter);
                    this.allies[i].isSelected = false;
                }
            }

            for (let i=0;i<this.minions.length;i++) {
                if (this.minions[i].isSelected) {

                    let minionhitpoints = this.minions[i].hitpoints;

                    if (this.minions[i].hitpointsper) {
                        minionhitpoints = new Number(this.minions[i].hitpoints) * new Number(this.numberOfPlayers);
                    }

                    let newcharacter = createCharacter(6000+i, this.minions[i].name, minionhitpoints, TYPE.Character);
                    copyStatusLimits(this.minions[i], newcharacter);
                    newcharacter.isMinion = true;
                    newcharacter.isBadGuy = true;

                    if (this.minions[i].useCounter) {
                        newcharacter.useCounter = true;
                        newcharacter.counter = this.minions[i].counter;
                    }
                    
                    this.characters.push(newcharacter);
                    this.minions[i].isSelected = false;
                }
            }

            for (let i=0;i<this.countercards.length;i++) {
                if (this.countercards[i].isSelected) {
                    let newcharacter = createCharacter(7000+i, this.countercards[i].name, this.countercards[i].counter, TYPE.CounterCard);

                    if (this.countercards[i].isThreat === true) {
                        newcharacter.isThreat = true;
                    }

                    this.characters.push(newcharacter);
                    this.countercards[i].isSelected = false;
                }
            }
            
            this.characters = _.sortBy(this.characters, "type");

            window.scrollTo(0,0);
            this.saveGameState();
            this.pageState = PAGE_STATE.Main;
        },
        calculateThreat: function (scheme) {
            let threat = 0;
            let basethreat = 0;

            if (scheme.threat && scheme.type === 'main_scheme') {
                threat = scheme.threatfixed ? scheme.threat : scheme.threat * this.numberOfPlayers;
            }

            if (scheme.type === 'side_scheme') {
                if (scheme.basethreatfixed) {
                    basethreat = scheme.basethreat;
                } else {
                    if (scheme.basethreat) {
                        basethreat = scheme.basethreat * this.numberOfPlayers;
                    }
                }
            }

            return threat + basethreat;
        },
        moveup: function (index, event) {
            let tmp = _.cloneDeep(this.characters[index]);
            let prev = _.cloneDeep(this.characters[index - 1]);

            if (prev.type != 0 && prev.type != 1) {
                this.characters[index] = prev;
                this.characters[index - 1] = tmp;
            }

            this.$forceUpdate();
            event.preventDefault();
        },
        movedown: function (index, event) {
            if (this.characters.length > index + 1) {
                let tmp = _.cloneDeep(this.characters[index]);
                let next = _.cloneDeep(this.characters[index + 1]);

                if (next.type == 2) {
                    this.characters[index] = next;
                    this.characters[index + 1] = tmp;
                }
            }

            this.$forceUpdate();
            event.preventDefault();
        },
        remove: function (index, event) {
            if (confirm('Are you sure you want to remove ' + this.characters[index].name + '?')) {
                this.characters.splice(index, 1);
            }
            event.preventDefault();
        },
        removeAll: function (event) {
            if (confirm('Are you sure you want to clear the app?')) {
                this.characters = [];
            }
            
            window.scrollTo(0,0);
            event.preventDefault();
        },
        newgame: function (event) {
            if (confirm('Are you sure you want to clear the app?')) {
                this.characters = [];
                this.filterModule = '';
                this.filterAspect = '';
            }
            
            window.scrollTo(0,0);
            event.preventDefault();
            this.saveGameState();
        },
        toggleHide: function (index) {
            this.characters[index].hide = !this.characters[index].hide;
        },
        editmaxhitpoints: function(index, event) {
            this.pageState = PAGE_STATE.Edit;
            this.charactersbeforeedit = _.cloneDeep(this.characters);
            let self = this;
            Vue.nextTick(function () {
                console.log(self.$refs['maxhitpoints' + index]);
                self.$refs['maxhitpoints' + index][0].focus();
            });
        },
        edithide: function(index, event) {
            this.pageState = PAGE_STATE.Edit;
            this.charactersbeforeedit = _.cloneDeep(this.characters);
            let self = this;
            Vue.nextTick(function () {
                console.log(self.$refs['hide' + index]);
                self.$refs['hide' + index][0].focus();
            });
        },
        reset: function() {
            this.characters = [
                createCharacter(1, 'Villian', 14),
                createCharacter(2, 'Hero', 10)
            ];
            this.pageState = PAGE_STATE.Main;
            this.filterModule = '';
            this.filterAspect = '';
            this.saveGameState();
        },
        saveGameState: function() {
            let gameState = {};
            gameState.characters = this.characters;
            gameState.showToggleButtons = this.showToggleButtons;
            gameState.numberOfPlayers = this.numberOfPlayers;
            gameState.hideListsForSetup = this.hideListsForSetup;
            gameState.hideSideSchemes = this.hideSideSchemes;
            gameState.hideAllies = this.hideAllies;
            gameState.hideMinions = this.hideMinions;
            gameState.hideCounters = this.hideCounters;
            gameState.autoFilterSideSchemesAndMinions = this.autoFilterSideSchemesAndMinions;
            gameState.filterModule = this.filterModule;
            gameState.filterAspect = this.filterAspect;
            localStorage.setItem(LOCALSTORAGENAME, JSON.stringify(gameState));

            this.computedUpdater++;
        }
    }
});