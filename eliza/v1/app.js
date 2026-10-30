function rollDie(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// toString for names of spaces by industries
function spaceToString(space) {
    let toStringResult = _.join(space.types, ' / ');

    let replacedString = toStringResult.replace(/0|1|2|3|4|5/gi, function(matched){
    return industryStringMap[matched];
    });

    return replacedString;
}

function romanize(level) {
    if (level === 1) return "I";
    if (level === 2) return "II";
    if (level === 3) return "III";
    if (level === 4) return "IV";
    if (level === 5) return "V";
    if (level === 6) return "VI";
    if (level === 7) return "VII";
    if (level === 8) return "VIII";

    throw new Exception("Level must be between 1 and 8");
}

// player boards (hold tiles)
const INITIAL_HUMAN_BOARD = _.cloneDeep(INDUSTRY_TILES);

const INITIAL_AI_BOARD = _.filter(INDUSTRY_TILES, function(p) {
    return p.level > 1 && !(p.industrytype === INDUSTRY.Manufacturer && p.level <= 2) && !(p.industrytype === INDUSTRY.Pottery && p.level <= 2);
});

// players
const HUMAN_PLAYER = {
    id: 0,
    name: "You",
    player_type: PLAYER_TYPE.Human,
    color: null,
    board: _.cloneDeep(INITIAL_HUMAN_BOARD),
    linktile: _.cloneDeep(LINK_TILE),
    nextLinkTileId: 0,
    canalTileVP: 0,
    canalLinkVP: 0,
    railTileVP: 0,
    railLinkVP: 0,
    canalTotalVP: 0,
    totalVP: 0,
    turnOrder: 0,
    currentRoundComplete: false,
    amountSpentThisRound: 0,
    totalUsedNetworkTiles: 0,
    currentTurnIndex: 0, // human player takes two actions
    actionStep: null, // guides showing appropriate UI for the chosen action
    nextAction: { action: null, actiondata: { consumedata: [] }, actiondesc: []} // intended action
};

// AI player 1
const ELIZA = {
    id: 1,
    name: "Eliza",
    player_type: PLAYER_TYPE.Eliza_AI,
    color: PLAYER_COLOR.Gray,
    board: _.cloneDeep(INITIAL_AI_BOARD),
    linktile: _.cloneDeep(LINK_TILE),
    nextLinkTileId: 0,
    deckType: AI_DECK_TYPES.Balanced,
    cards: null,
    currentCard1: null,
    currentCard2: null,
    difficulty: DIFFICULTY_LEVEL.Apprentice,
    canalTileVP: 0,
    canalLinkVP: 0,
    railTileVP: 0,
    railLinkVP: 0,
    canalTotalVP: 0,
    totalVP: 0,
    turnOrder: 1,
    currentRoundComplete: false,
    soldInCanalEra: false,
    soldInRailEra: false,
    amountSpentThisRound: null,
    totalUsedNetworkTiles: 0,
    nextAction: { action: null, actiondata: { consumedata: [] }, actiondesc: []} // intended action
}

// optional AI player 2
const ELEANOR = {
    id: 2,
    name: "Eleanor",
    player_type: PLAYER_TYPE.Eleanor_AI,
    color: PLAYER_COLOR.Yellow,
    board: _.cloneDeep(INITIAL_AI_BOARD),
    linktile: _.cloneDeep(LINK_TILE),
    nextLinkTileId: 0,
    deckType: AI_DECK_TYPES.Balanced,
    cards: null,
    currentCard1: null,
    currentCard2: null,
    difficulty: DIFFICULTY_LEVEL.Apprentice,
    canalTileVP: 0,
    canalLinkVP: 0,
    railTileVP: 0,
    railLinkVP: 0,
    canalTotalVP: 0,
    totalVP: 0,
    turnOrder: 2,
    currentRoundComplete: false,
    soldInCanalEra: false,
    soldInRailEra: false,
    amountSpentThisRound: null,
    totalUsedNetworkTiles: 0,
    nextAction: { action: null, actiondata: { consumedata: [] }, actiondesc: []} // intended action
}

var app = new Vue({
    el: '#eliza',
    data: {
        computedUpdater: 0,
        numberOfPlayers: 2,
        useTurnOrder: false,
        gameHasStarted: false,
        currentRound: 1,
        currentGameStep: GAME_STEPS.Setup,
        currentEra: ERA.Canal,
        currentPlayerType: null,
        board: _.cloneDeep(INITIAL_BOARD),
        humanPlayer: _.cloneDeep(HUMAN_PLAYER),
        eliza: _.cloneDeep(ELIZA),
        eleanor: _.cloneDeep(ELEANOR),
        showBoardState: false,
        humanActionStringMap: _.cloneDeep(humanActionStringMap),
        undoState: null,
        isDisabledButton: false,
        isAIThinking: false,
        isCalculatingScore: false,
        finishedCanalScore: false,
        finishedRailScore: false,
        error: null,
        isGameStateOpen: false,
        gameState: "",
        appVersion: '1.3'
    },
    mounted: function() {
        if (localStorage.getItem(LOCALSTORAGENAME)) {
            let gameState = JSON.parse(LZString.decompress(localStorage.getItem(LOCALSTORAGENAME)));
            this.numberOfPlayers = gameState.numberOfPlayers;
            this.gameHasStarted = gameState.gameHasStarted;
            this.useTurnOrder = gameState.useTurnOrder;
            this.soldInCanalEra = gameState.soldInCanalEra;
            this.soldInRailEra = gameState.soldInRailEra;
            this.currentRound = gameState.currentRound;
            this.currentGameStep = gameState.currentGameStep;
            this.currentEra = gameState.currentEra;
            this.currentPlayerType = gameState.currentPlayerType;
            this.board = gameState.board;
            this.humanPlayer = gameState.humanPlayer;
            this.eliza = gameState.eliza;
            this.eleanor = gameState.eleanor;
            this.showBoardState = gameState.showBoardState;
            this.undoState = gameState.undoState;
            this.error = gameState.error;

        } else {
            this.setPlayerColor(0);
        }
    },
    computed: {
        currentPlayer: function () {
            let player = this.getPlayerFromType(this.currentPlayerType);
            return player;
        },
        nextButtonText: function () {
            this.computedUpdater++;
            return this.isAIThinking ? "Please wait..." : "Next >>";
        },
        playersInOrder: function () {
            let players = [];

            if (this.numberOfPlayers == '2') {
                players = [
                    this.humanPlayer,
                    this.eliza
                ];
            } else {
                players = [
                    this.humanPlayer,
                    this.eliza,
                    this.eleanor
                ];
            }

            let sortedPlayers = _.sortBy(players, "turnOrder");

            return sortedPlayers;
        },
        totalEmptyMarketCoalSpaces: function () {
            return this.board.market.totalPossibleCoal - this.board.market.coalInMarket;
        },
        totalEmptyMarketIronSpaces: function () {
            return this.board.market.totalPossibleIron - this.board.market.ironInMarket;
        },
        validHumanBuildLocations: function () {
            let locations = [];
            let self = this;
            if (this.currentEra === ERA.Canal) {
                // locations where the player hasn't built or can overbuild
                locations = _.filter(self.board.locations, function (l) {
                    let canBuildHere = true;
                    _.forEach(l.spaces, function (s) {
                        if (s.tile && s.tile.color === self.humanPlayer.color) {
                            let nextTileOfSameType = self.findNextTileFromPlayerBoard(PLAYER_TYPE.Human, s.tile.industrytype);
    
                            // OVERBUILD: Next tile on player board must be higher level than tile being replaced
                            if (s.tile.level >= nextTileOfSameType.level) {
                                canBuildHere = false;
                            }
                        }
                    });

                    return canBuildHere;
                });
            } else {
                // all locations for the number of players
                let cardsForNumberOfPlayers = _.filter(CARDS, function (c) {
                    return c.type === CARD_TYPES.Location; // all locations valid because of wild cards
                });

                _.forEach(cardsForNumberOfPlayers, function (c) {
                    locations.push(self.findLocationById(c.locationid));
                });

                // include locations in network
                locations = _.unionBy(locations, self.findAllLocationsInNetwork(PLAYER_TYPE.Human), function (l) {
                    return l.id;
                });
            }

            let sortedLocations = _.sortBy(locations, 'name');

            return sortedLocations;
        },
        validHumanBuildLocationsForIndustryType: function () {
            this.computedUpdater++;
            let spacesWithLocations = [];
            let self = this;
            let industrytype = this.humanPlayer.nextAction.actiondata.buildindustrytype;

            _.forEach(self.validHumanBuildLocations, function (l) {
                let singleSpaceAvailable = (_.filter(l.spaces, function (s) {
                    return !s.tile && _.includes(s.types, industrytype) && s.types.length === 1;
                })).length > 0;

                let resourcesAvailable = true;
                let tile = self.humanPlayer.nextAction.actiondata.buildtile;

                let isConnectedToMarket = self.isConnectedToMarket(l.id, PLAYER_TYPE.Human);

                if (tile.coalCost > 0) {
                    let allConnectedCoal = self.findAllConnectedCoal(l.id, PLAYER_TYPE.Human);

                    if (!isConnectedToMarket && (!Object.keys(allConnectedCoal) || Object.keys(allConnectedCoal).length === 0)) {
                        resourcesAvailable = false;
                    }
                }

                if (tile.ironCost > 0) {
                    // you don't need to be connected to the iron market
                    // so nothing to do here!
                }

                if (resourcesAvailable) {

                    let isCanalEraOverbuild = false;
                    let isCanalEraInvalidSpace = false;
                    if (self.currentEra === ERA.Canal) {
                        // only show one space in the Canal era, so if the location is valid due to overbuilding only show the overbuilding space

                        _.forEach(l.spaces, function (s) {
                            if (_.includes(s.types, industrytype)) {
                                if (s.tile && s.tile.color === self.humanPlayer.color) {
                                    isCanalEraOverbuild = true;
                                }
                            } else {
                                if (s.tile && s.tile.color === self.humanPlayer.color) {
                                    isCanalEraInvalidSpace = true;
                                }
                            }
                        });
                    }

                    _.forEach(l.spaces, function (s) {
                        let isOverbuild = (s.tile !== null && s.tile !== undefined && s.tile.color === self.humanPlayer.color);
                        
                        let isAIPlayersTile = (s.tile !== null && s.tile !== undefined && s.tile.color !== self.humanPlayer.color);

                        if (_.includes(s.types, industrytype) && !isAIPlayersTile && !(isCanalEraOverbuild && !isOverbuild) && !isCanalEraInvalidSpace) {
                            if (s.types.length === 1) {
                                // prefer single spaces
                                spacesWithLocations.push({
                                    locationid: l.id,
                                    spaceid: s.id + 1,
                                    name: l.name,
                                    industrytype: industrytype,
                                    isOverbuild: isOverbuild
                                });
                            } else {
                                if (!singleSpaceAvailable) {
                                    spacesWithLocations.push({
                                        locationid: l.id,
                                        spaceid: s.id + 1,
                                        name: l.name,
                                        industrytype: industrytype,
                                        isOverbuild: isOverbuild
                                    });
                                }
                            }
                        }
                    });
                }
            });

            let sortedSpacesWithLocations = _.sortBy(spacesWithLocations, 'name', 'space');
            return sortedSpacesWithLocations;
        },
        findPlayerUnflippedSellableIndustries: function () {
            // for: Sell, step 1
            let player_type = this.currentPlayer.player_type;
            let player = this.getPlayerFromType(player_type);

            let playerUnflippedSellableIndustryLocations = [];

            let self = this;
            _.forEach(self.board.locations, function(o) {
                if (o.type === LOCATIONTYPE.Industries) {
                    o.spaceswithtiles = [];
                    _.forEach(o.spaces, function(p) {
                        if (p.tile && p.tile.color === player.color && !p.tile.flipped && (p.tile.industrytype === INDUSTRY.Manufacturer || p.tile.industrytype === INDUSTRY.CottonMill || p.tile.industrytype === INDUSTRY.Pottery)) {
                            o.spaceswithtiles.push({
                                spaceid: p.id,
                                tile: p.tile
                            });
                            playerUnflippedSellableIndustryLocations.push(o);
                        }
                    });
                }
            });

            return playerUnflippedSellableIndustryLocations;
        },
        findPlayerUnflippedSellableIndustriesConnectedToMarket: function () {
            // for: Sell, step 1 and 2
            let player_type = this.currentPlayer.player_type;
            let playerUnflippedSellableIndustryLocations = this.findPlayerUnflippedSellableIndustries;

            let playerUnflippedSellableIndustriesConnectedToMarket = [];

            let self = this;
            _.forEach(playerUnflippedSellableIndustryLocations, function (l) {
                let connectedMarkets = self.findAllConnectedMarkets(l.id, player_type);

                if (connectedMarkets && connectedMarkets.length > 0) {
                    // find tiles connected to a matching market
                    _.forEach(l.spaceswithtiles, function (t) {
                        // check each market connected to the tile's location
                        let isConnectedToMatchingMarket = false;
                        let connectedMarketsWithTiles = [];
                        _.forEach(connectedMarkets, function (m) {
                            _.forEach(m.spaces, function (s) {
                                if (s.tile) {
                                    if (_.includes(s.tile.industryTypes, t.tile.industrytype)) {
                                        isConnectedToMatchingMarket = true;
                                        connectedMarketsWithTiles.push({
                                            market: m,
                                            space: s
                                        });
                                    }
                                }
                            });
                        });

                        if (isConnectedToMatchingMarket) {
                            playerUnflippedSellableIndustriesConnectedToMarket.push({
                                selected: false,
                                locationid: l.id,
                                name: l.name,
                                spaceid: t.spaceid,
                                tile: t.tile,
                                comboid: l.id + " - " + t.spaceid,
                                connectedMarketsWithTiles: connectedMarketsWithTiles
                            });
                        }
                    });
                }
            });

            return _.uniqBy(playerUnflippedSellableIndustriesConnectedToMarket, "comboid");
        }
    },
    methods: {
        getGameState: function () {
            this.gameState = btoa(LZString.decompress(localStorage.getItem(LOCALSTORAGENAME)));
            this.isGameStateOpen = true;
            return this.gameState;
        },
        copyGameState() {
            navigator.clipboard.writeText(this.gameState)
            .then(() => {
              alert('Save game copied to clipboard');
            })
            .catch(err => {
              alert('Error in copying text: ', err);
            });
        },
        next: function () {
            this.isGameStateOpen = false;
            if (this.isDisabledButton) return;
            this.isDisabledButton = true;

            // if starting game
            if (this.currentGameStep === 0) {
                this.currentGameStep = GAME_STEPS.Round;
            }

            // if coming from new round screen or setup rail era screen
            if (this.currentGameStep === GAME_STEPS.EndOfRound || this.currentGameStep === GAME_STEPS.SetupRailEra) {
                let players = [];

                if (this.numberOfPlayers == '2') {
                    players = [
                        this.humanPlayer,
                        this.eliza
                    ];
                } else {
                    players = [
                        this.humanPlayer,
                        this.eliza,
                        this.eleanor
                    ];
                }

                // clear amount spent
                let self = this;
                _.forEach(players, function (p) {
                    p.amountSpentThisRound = null;
                });

                if (this.currentGameStep === GAME_STEPS.SetupRailEra) {
                    if (this.currentPlayerType === PLAYER_TYPE.Eliza_AI || this.currentPlayerType === PLAYER_TYPE.Eleanor_AI) {
                        this.computedUpdater++;
                        this.isAIThinking = true;
                        setTimeout(function() { Vue.nextTick(function() { self.setupRailEra(); self.calculateAIAction(self.currentPlayerType); self.currentGameStep = GAME_STEPS.Round; self.saveGameState(); window.scrollTo(0,0); } ); }, 0);
                    } else {
                        this.setupRailEra();
                        this.currentGameStep = GAME_STEPS.Round;
                        this.saveGameState();
                        window.scrollTo(0,0);
                    }
                } else {
                    this.currentGameStep = GAME_STEPS.Round;
                    this.saveGameState();
                    window.scrollTo(0,0);
                }

                setTimeout(() => {
                    this.isDisabledButton = false;
                }, 1000);
                return;
            }

            let wasHumanPlayer = false;
            if (this.currentPlayerType === 0) {
                wasHumanPlayer = true;
                
                // NOTE: Actions handled in opposite order since actionStep is incremented

                // if executing confirmed human action
                if (this.currentPlayer.actionStep === '03' || this.currentPlayer.actionStep === '13' || this.currentPlayer.actionStep === '22' || this.currentPlayer.actionStep === '32' || this.currentPlayer.actionStep === '55') {
                    this.executeNextHumanAction();
                    this.calculateNextPlayer();
                }

                // if scout or loan
                if (this.currentPlayer.actionStep === '40') {
                    this.calculateNextPlayer();
                }

                // if human choosing consumption
                if (this.currentPlayer.actionStep === '02' || this.currentPlayer.actionStep === '12' || this.currentPlayer.actionStep === '21' || this.currentPlayer.actionStep === '31' || this.currentPlayer.actionStep === '54') {
                    if (this.humanPlayer.nextAction.actiondata.consumelocations.coal) {
                        let totalChosenCoal = _.sumBy(this.humanPlayer.nextAction.actiondata.consumelocations.coal.coalLocations, function (l) {
                            return l.chosenCoal;
                        });

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.coal.coalNeeded > totalChosenCoal) {
                            alert("You have not chosen enough coal.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.coal.coalNeeded < totalChosenCoal) {
                            alert("You have chosen too much coal.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }
                    }

                    if (this.humanPlayer.nextAction.actiondata.consumelocations.iron) {
                        let totalChosenIron = _.sumBy(this.humanPlayer.nextAction.actiondata.consumelocations.iron.ironLocations, function (l) {
                            return l.chosenIron;
                        });

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.iron.ironNeeded > totalChosenIron) {
                            alert("You have not chosen enough iron.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.iron.ironNeeded < totalChosenIron) {
                            alert("You have chosen too much iron.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }
                    }

                    if (this.humanPlayer.nextAction.actiondata.consumelocations.beer) {
                        let totalChosenBeer = _.sumBy(this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerLocations, function (l) {
                            return l.chosenBeer;
                        });

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerNeeded > totalChosenBeer) {
                            alert("You have not chosen enough beer.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        if (this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerNeeded < totalChosenBeer) {
                            alert("You have chosen too much beer.");
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }
                    }

                    // Move to next step
                    if (this.currentPlayer.actionStep === '02') {
                        this.currentPlayer.actionStep = '03';
                        this.saveGameState();
                    }

                    if (this.currentPlayer.actionStep === '12') {
                        this.currentPlayer.actionStep = '13';
                        this.saveGameState();
                    }

                    if (this.currentPlayer.actionStep === '21') {
                        let freedevelops = [];
                        _.forEach(this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerLocations, function (l) {
                            if (l.chosenBeer > 0) {
                                if (l.isMerchant) {
                                    if (l.bonusType === BONUSTYPE.Develop) {
                                        freedevelops.push({
                                            isFreeDevelop: true
                                        });
                                    }
                                }
                            }
                        });

                        if (freedevelops.length > 0) {
                            this.humanPlayer.nextAction.actiondata.freedevelops = freedevelops;
                            this.humanPlayer.nextAction.actiondata.developabletiles = this.findAllNextDevelopableTilesFromPlayerBoard(PLAYER_TYPE.Human);
                            this.currentPlayer.actionStep = '23';
                            this.saveGameState();
                            window.scrollTo(0,0);
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        } else {
                            this.currentPlayer.actionStep = '22';
                        }
                        
                        this.saveGameState();
                    }

                    if (this.currentPlayer.actionStep === '31') {
                        this.currentPlayer.actionStep = '32';
                        this.saveGameState();
                    }

                    if (this.currentPlayer.actionStep === '54') {
                        this.currentPlayer.actionStep = '55';
                        this.saveGameState();
                    }
                }

                // if sell
                if (this.currentPlayer.actionStep === '20') {
                    this.humanPlayer.nextAction.actiondata.freedevelops = null;
                    this.setSelectedTilesToSell();
                }
            
                // if developing
                if (this.currentPlayer.actionStep === '30' || this.currentPlayer.actionStep === '23') {

                    let developabletiles = this.humanPlayer.nextAction.actiondata.developabletiles;

                    let selectedtiles = [];
                    _.forEach(developabletiles, function (i) {
                        _.forEach(i.tiles, function (t) {
                            if (t.selected) {
                                selectedtiles.push(t.developabletile);
                            }
                        });
                    });

                    if (this.currentPlayer.actionStep === '30') {
                        if (selectedtiles.length === 0) {
                            alert('You must choose at least one tile to develop.');
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        if (selectedtiles.length > 2) {
                            alert('You cannot choose more than 2 tiles to develop.');
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        let consumeLocations = this.humanConsumeLocations(null, 0, selectedtiles.length, null);
                        this.humanPlayer.nextAction.actiondata.consumelocations = consumeLocations;

                        this.currentPlayer.actionStep = '31';
                        this.saveGameState();
                    }

                    if (this.currentPlayer.actionStep === '23') {

                        if (selectedtiles.length === 0) {
                            alert('You must choose at least one tile to develop.');
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        let freedevelops = this.humanPlayer.nextAction.actiondata.freedevelops ? this.humanPlayer.nextAction.actiondata.freedevelops.length : 0;
                        if (selectedtiles.length > freedevelops) {
                            alert('You cannot choose more than ' + freedevelops + ' tiles to develop.');
                            setTimeout(() => {
                                this.isDisabledButton = false;
                            }, 1000);
                            return;
                        }

                        this.currentPlayer.actionStep = '22';
                        this.saveGameState();
                    }
                }
            }
                

            // execute AI action if moving on from showing them
            if (!wasHumanPlayer && (this.currentPlayerType === 1 || this.currentPlayerType === 2)) {
                this.executeNextAIAction();
                this.calculateNextPlayer();
            }

            this.saveGameState();
            window.scrollTo(0,0);

            setTimeout(() => {
                this.isDisabledButton = false;
            }, 1000);
        },
        setPlayerColor: function (color) {
            this.humanPlayer.color = color;
            this.saveGameState();
        },
        currentPlayerColorClass: function () {
            return "player-icon-" + this.colorString(this.currentPlayer.color);
        },
        roundsPerEra: function () {
            return this.numberOfPlayers == '2' ? TOTAL_ROUNDS_2PLAYER : TOTAL_ROUNDS_3PLAYER;
        },
        roundToStartGuaranteedSale: function () {
            let roundsPerEra = this.numberOfPlayers == '2' ? TOTAL_ROUNDS_2PLAYER : TOTAL_ROUNDS_3PLAYER;
            return (roundsPerEra - ROUNDS_LEFT_START_GUARANTEED_SALE) + 1;
        },
        startGame: function() {
            if (!this.humanPlayer.color) {
                alert("You must choose a color.");
                return false;
            }

            this.gameHasStarted = true;
            this.currentPlayerType = PLAYER_TYPE.Human;

            // Set link and tile colors
            let self = this;
            this.humanPlayer.linktile.color = this.humanPlayer.color;
            
            _.forEach(this.humanPlayer.board, function(p) {
                p.color = self.humanPlayer.color;
            });

            this.eliza.linktile.color = this.eliza.color;
            _.forEach(this.eliza.board, function(p) {
                p.color = self.eliza.color;
            });

            this.eleanor.linktile.color = this.eleanor.color;
            _.forEach(this.eleanor.board, function(p) {
                p.color = self.eleanor.color;
            });

            // shuffle cards
            this.shuffleAICards();

            // Setup merchant tiles
            this.setupMerchantTiles();


            // --- TEMPORARY
            // Setup board
            //this.debugSetupTestBoard();
            // --- END TEMPORARY

            this.saveGameState();
        },

        // UI functions
        setHumanAction(actionStep) {
            this.isGameStateOpen = false;
            this.currentPlayer.actionStep = actionStep;

            if (actionStep === '20') {
                this.humanPlayer.nextAction.action = HUMAN_ACTION.Sell;
                this.humanPlayer.nextAction.actiondata.freedevelops = null;
                this.humanPlayer.nextAction.actiondata.sellabletiles = this.findPlayerUnflippedSellableIndustriesConnectedToMarket;
            }

            if (actionStep === '30') {
                this.humanPlayer.nextAction.action = HUMAN_ACTION.Develop;
                this.setHumanDevelopableTiles();
            }

            this.saveGameState();
        },
        showNextButton() {
            return (this.gameHasStarted && !this.showBoardState && (this.currentGameStep === 0 || this.currentGameStep === 3 || (this.currentPlayer.actionStep === '03' || this.currentPlayer.actionStep === '02' || this.currentPlayer.actionStep === '12' || this.currentPlayer.actionStep === '13' || this.currentPlayer.actionStep === '31' || this.currentPlayer.actionStep === '40') || this.currentPlayer.actionStep === '20') || this.currentPlayer.actionStep === '21' || this.currentPlayer.actionStep === '22' || this.currentPlayer.actionStep === '23' || this.currentPlayer.actionStep === '30' || this.currentPlayer.actionStep === '32' || this.currentPlayer.actionStep === '54' || this.currentPlayer.actionStep === '55' || this.currentPlayerType === 1 || this.currentPlayerType === 2 || this.currentGameStep === 2);
        },
        prevHumanAction: function () {
            if (this.humanPlayer.actionStep === '03') {
                this.prevBuildActionConfirm();
            }

            if (this.humanPlayer.actionStep === '13' || this.humanPlayer.actionStep === '55') {
                this.prevNetworkActionConfirm();
            }

            if (this.humanPlayer.actionStep === '32' || this.humanPlayer.actionStep === '21') {
                this.prevDevelopActionConfirm();
            }

            if (this.humanPlayer.actionStep === '22') {
                this.prevSellActionConfirm();
            }
        },

        // UI: Build
        prevSetHumanAction: function () {
            if (this.humanPlayer.actionStep === '52') {
                this.setHumanAction('51')
            } else {
                this.setHumanAction(null);
            }
        },
        prevBuildActionConfirm: function () {
            let tile = this.humanPlayer.nextAction.actiondata.buildtile;

            // get consumption options
            if (tile.coalCost > 0 || tile.ironCost > 0) {
                this.setHumanAction('02');
            } else {
                this.setHumanAction('01');
                this.saveGameState();
            }
        },
        setHumanBuildIndustryType: function(industrytype, tileid) {
            this.humanPlayer.nextAction.action = HUMAN_ACTION.Build;
            this.humanPlayer.nextAction.actiondata.buildindustrytype = industrytype;
            let tile = this.findPlayerBoardIndustryTileById(this.humanPlayer.player_type, tileid);
            this.humanPlayer.nextAction.actiondata.buildtile = tile; 
            this.computedUpdater++;
            this.setHumanAction('01');
        },
        prevHumanBuildIndustryType: function() {
            this.humanPlayer.nextAction.action = null;
            this.humanPlayer.nextAction.actiondata.buildindustrytype = null;
            this.humanPlayer.nextAction.actiondata.buildtile = null;
            this.setHumanAction('00');
            return false;
        },
        setHumanBuildLocationAndSpace(locationid, spaceid) {
            let location = this.findLocationById(locationid);
            this.humanPlayer.nextAction.actiondata.buildlocationid = locationid;
            this.humanPlayer.nextAction.actiondata.buildspaceid = spaceid - 1;
            this.humanPlayer.nextAction.actiondata.buildlocationname = location.name;

            // determine needed consumption
            let tile = this.humanPlayer.nextAction.actiondata.buildtile;

            // get consumption options
            if (tile.coalCost > 0 || tile.ironCost > 0) {
                let consumeLocations = this.humanConsumeLocations(locationid, tile.coalCost, tile.ironCost, null);
                this.humanPlayer.nextAction.actiondata.consumelocations = consumeLocations;
                this.setHumanAction('02');
            } else {
                this.humanPlayer.nextAction.actiondata.consumelocations = {};
                this.setHumanAction('03');
            }
        },

        // UI: Network
        validHumanNetworkLocations: function() {
            let locations = this.findAllLocationsInNetwork(PLAYER_TYPE.Human);
            let self = this;

            let validLocations = _.filter(locations, function (l) {
                let edges = [];
                if (self.currentEra === ERA.Canal) {
                    edges = l.edgesCanal;
                } else {
                    edges = l.edgesRail;
                }

                return _.filter(edges, function (e) {
                    return !e.tile && !e.isToSouthernFarm;
                }).length > 0;
            });

            if (this.humanPlayer.actionStep === '52') {
                let locationid = this.humanPlayer.nextAction.actiondata.networktolocationid;

                if (locationid) {
                    let location = this.findLocationById(locationid);
                    validLocations.push(location);

                    validLocations = _.uniqBy(validLocations, "id");
                }
            }
            
            return _.sortBy(validLocations, 'name');
        },
        setNetworkLocationFrom: function (locationid) {
            if (this.currentPlayer.actionStep === '50') {
                this.humanPlayer.nextAction.action = HUMAN_ACTION.DoubleNetwork;
                this.humanPlayer.nextAction.actiondata.networkfromlocationid = locationid;
                this.setHumanAction('51');
            } else if (this.currentPlayer.actionStep === '52') {
                this.humanPlayer.nextAction.actiondata.networkfromlocationid2 = locationid;
                this.setHumanAction('53');
            } else {
                this.humanPlayer.nextAction.action = HUMAN_ACTION.Network;
                this.humanPlayer.nextAction.actiondata.networkfromlocationid = locationid;
                this.setHumanAction('11');
            }
        },
        prevNetworkLocationFrom: function () {
            if (this.currentPlayer.actionStep === '51') {
                this.humanPlayer.nextAction.actiondata.networkfromlocationid = null;
                this.setHumanAction('50');
            } else if (this.currentPlayer.actionStep === '53') {
                this.humanPlayer.nextAction.actiondata.networkfromlocationid2 = null;
                this.setHumanAction('52');
            } else {
                this.humanPlayer.nextAction.actiondata.networkfromlocationid = null;
                this.setHumanAction('10');
            }
        },
        setNetworkLocationTo: function (locationid) {
            if (this.currentPlayer.actionStep === '51') {
                this.humanPlayer.nextAction.actiondata.networktolocationid = locationid;
                this.setHumanAction('52');
            } else if (this.currentPlayer.actionStep === '53') {
                this.humanPlayer.nextAction.actiondata.networktolocationid2 = locationid;

                let locationids = [
                    this.humanPlayer.nextAction.actiondata.networkfromlocationid,
                    this.humanPlayer.nextAction.actiondata.networktolocationid,
                    this.humanPlayer.nextAction.actiondata.networkfromlocationid2,
                    this.humanPlayer.nextAction.actiondata.networktolocationid2
                ];
                let consumeLocations = this.humanConsumeLocations(locationids, 2, null, 1);
                this.humanPlayer.nextAction.actiondata.consumelocations = consumeLocations;
                this.setHumanAction('54');
            } else {
                this.humanPlayer.nextAction.actiondata.networktolocationid = locationid;

                if (this.currentEra === ERA.Rail) {
                    let locationids = [
                        this.humanPlayer.nextAction.actiondata.networkfromlocationid,
                        this.humanPlayer.nextAction.actiondata.networktolocationid = locationid
                    ];
                    let consumeLocations = this.humanConsumeLocations(locationids, 1, null, null);
                    this.humanPlayer.nextAction.actiondata.consumelocations = consumeLocations;
                    this.setHumanAction('12');
                    return;
                }
                this.humanPlayer.nextAction.actiondata.consumelocations = {};
                this.setHumanAction('13');
            }
        },
        prevNetworkActionConfirm: function () {
            if (this.currentPlayer.actionStep === '55') {
                this.humanPlayer.nextAction.actiondata.networktolocationid2 = null;
                this.setHumanAction('54');
            } else {
                this.humanPlayer.nextAction.actiondata.networktolocationid = null;
                this.setHumanAction('11');
            }
        },

        // UI: Sell
        setSelectedTilesToSell: function () {
            let selectedTiles = _.filter(this.humanPlayer.nextAction.actiondata.sellabletiles, function (t) {
                return t.selected;
            });

            if (selectedTiles.length === 0) {
                alert("You must select at least one industry to sell.");
                return;
            }

            let locationids = _.uniqBy(_.map(selectedTiles, "locationid"), "locationid");

            let totalBeerNeeded = _.sumBy(selectedTiles, function (t) {
                return t.tile.beerCost;
            });

            if (totalBeerNeeded === 0) {
                this.setHumanAction('22');
                return;
            }
            
            this.humanPlayer.nextAction.actiondata.consumelocations = this.humanConsumeLocations(locationids, 0, 0, totalBeerNeeded);

            this.setHumanAction('21');
        },
        prevSelectedTilesToSell: function () {
            this.setHumanAction('20');
        },
        prevSetIndustriesToSell: function () {
            this.humanPlayer.nextAction.actiondata.sellabletiles = null;
            this.setHumanAction('00');
        },
        prevSellActionConfirm: function () {
            let freedevelops = this.humanPlayer.nextAction.actiondata.freedevelops ? this.humanPlayer.nextAction.actiondata.freedevelops.length : 0;

            if (freedevelops > 0) {
                this.setHumanAction('23');
            } else {
                this.setHumanAction('21');
            }
        },

        // UI: Develop
        setHumanDevelopableTiles: function () {
            this.humanPlayer.nextAction.action = HUMAN_ACTION.Develop;
            this.humanPlayer.nextAction.actiondata.developabletiles = this.findAllNextDevelopableTilesFromPlayerBoard(PLAYER_TYPE.Human);
        },
        prevDevelopAction: function () {
            this.humanPlayer.nextAction.actiondata.developabletiles = null;
            if (this.humanPlayer.actionStep === '30') {
                this.setHumanAction(null);
            }
            if (this.humanPlayer.actionStep === '23') {
                this.setHumanAction('21');
            }
        },
        prevDevelopActionConfirm: function () {
            this.setHumanAction('30');
        },

        // UI: Consume
        humanConsumeLocations(locationids, totalCoalNeeded, totalIronNeeded, totalBeerNeeded) {
            let locationid = null;
            let self = this;
            if (locationids && !locationids.length) {
                locationid = locationids;
            }
            let consumeLocations = {};

            if (totalCoalNeeded && totalCoalNeeded > 0) {
                consumeLocations.coal = {
                    coalNeeded: totalCoalNeeded,
                    coalLocations: []
                };

                let allConnectedCoal = this.findAllConnectedCoal(locationids, this.currentPlayer.player_type);

                let totalCoalAvailable = 0;
                let distance = 0;
                let prevdistance = null;
                _.forEach(allConnectedCoal, function (ccl) {
                    _.forEach(ccl, function (l) {
                        distance = l.distance;
                        if (!prevdistance) { prevdistance = l.distance; }

                        _.forEach(l.coalspaces, function (pcs) {
                            // if still need coal, or this is a double network
                            if ((totalCoalAvailable < totalCoalNeeded) || distance === prevdistance || locationids.length && locationids.length === 4) {
                                let resourceArray = [];
                                for (let i=0;i<=pcs.tile.availableCoal;i++) {
                                    resourceArray.push(i);
                                }

                                consumeLocations.coal.coalLocations.push({
                                    locationid: l.id,
                                    name: l.name,
                                    spaceid: pcs.id + 1,
                                    coalAvailable: pcs.tile.availableCoal,
                                    chosenCoal: 0,
                                    resourceArray: resourceArray,
                                    id: l.id + '-' + pcs.id
                                });

                                totalCoalAvailable = totalCoalAvailable + pcs.tile.availableCoal;
                            }
                        });

                        prevdistance = ccl.distance;
                    });
                });

                // Include market
                if ((totalCoalAvailable < totalCoalNeeded) || (locationids.length && locationids.length === 4)) {
                    let isConnectedToCoal = false;
                    if (locationid) {
                        isConnectedToCoal = self.isConnectedToMarket(locationid, PLAYER_TYPE.Human);
                    } else {
                        if (locationids.length) {
                            for (let i=0;i<locationids.length;i++) {
                                if (self.isConnectedToMarket(locationids[i], PLAYER_TYPE.Human)) {
                                    isConnectedToCoal = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (isConnectedToCoal) {
                        let resourceArray = [];
                        if (locationids.length && locationids.length === 4) {
                            for (let i=0;i<=2;i++) {
                                resourceArray.push(i);
                            }
                        } else {
                            for (let i=0;i<=totalCoalNeeded - totalCoalAvailable;i++) {
                                resourceArray.push(i);
                            }
                        }

                        consumeLocations.coal.coalLocations.push({
                            locationid: -1,
                            name: "Coal Market",
                            spaceid: -1,
                            coalAvailable: totalCoalNeeded - totalCoalAvailable,
                            chosenCoal: 0,
                            resourceArray: resourceArray,
                            isMarket: true,
                            id: -1000
                        });
                    }
                }
            }

            if (totalIronNeeded && totalIronNeeded > 0) {
                consumeLocations.iron = {
                    ironNeeded: totalIronNeeded,
                    ironLocations: []
                };

                let allUnflippedIron = this.findAllUnflippedIronWorks();

                let totalIronAvailable = 0;
                _.forEach(allUnflippedIron, function (l) {
                    _.forEach(l.ironspaces, function (is) {
                        let resourceArray = [];
                        for (let i=0;i<=is.tile.availableIron;i++) {
                            resourceArray.push(i);
                        }

                        consumeLocations.iron.ironLocations.push({
                            locationid: l.id,
                            name: l.name,
                            spaceid: is.id + 1,
                            ironAvailable: is.tile.availableIron,
                            chosenIron: 0,
                            resourceArray: resourceArray,
                            id: l.id + '-' + is.id
                        });

                        totalIronAvailable = totalIronAvailable + is.tile.availableIron;
                    });
                });

                // Include market
                if (totalIronAvailable < totalIronNeeded) {
                    let resourceArray = [];
                    for (let i=0;i<=totalIronNeeded - totalIronAvailable;i++) {
                        resourceArray.push(i);
                    }

                    consumeLocations.iron.ironLocations.push({
                        locationid: -2,
                        name: "Iron Market",
                        spaceid: -1,
                        coalAvailable: totalIronNeeded - totalIronAvailable,
                        chosenIron: 0,
                        resourceArray: resourceArray,
                        isMarket: true,
                        id: -2000
                    });
                }
            }

            if (totalBeerNeeded && totalBeerNeeded > 0) {
                consumeLocations.beer = {
                    beerNeeded: totalBeerNeeded,
                    beerLocations: []
                };

                let consumableBeer = this.findConsumableBeer(locationids, PLAYER_TYPE.Human);

                _.forEach(consumableBeer, function (l) {
                    _.forEach(l.beerspaces, function (bs) {
                        let resourceArray = [];
                        for (let i=0;i<=bs.tile.availableBeer;i++) {
                            resourceArray.push(i);
                        }

                        consumeLocations.beer.beerLocations.push({
                            locationid: l.id,
                            name: l.name,
                            spaceid: bs.id + 1,
                            beerAvailable: bs.tile.availableBeer,
                            chosenBeer: 0,
                            resourceArray: resourceArray,
                            id: l.id + '-' + bs.id
                        });
                    });
                });

                if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Sell) {
                    let selectedTiles = _.filter(this.humanPlayer.nextAction.actiondata.sellabletiles, function (t) {
                        return t.selected;
                    });

                    let marketsWithBeer = [];
                    let marketsWithTiles = [];
                    _.forEach(selectedTiles, function (t) {
                        marketsWithBeer = _.union(marketsWithBeer, t.connectedMarketsWithTiles);
                    });

                    marketsWithTiles = _.uniqBy(marketsWithBeer, function (m) {
                        return m.market.id + '-' + m.space.id;
                    });

                    _.forEach(marketsWithTiles, function (m) {
                        let resourceArray = [];
                        for (let i=0;i<=m.space.tile.totalBeer;i++) {
                            resourceArray.push(i);
                        }

                        consumeLocations.beer.beerLocations.push({
                            locationid: m.market.id,
                            name: m.market.name + ' (Merchant)',
                            spaceid: m.space.id + 1,
                            beerAvailable: m.space.tile.totalBeer,
                            chosenBeer: 0,
                            resourceArray: resourceArray,
                            id: m.market.id + '-' + m.space.id,
                            isMerchant: true,
                            bonus: m.market.bonus,
                            bonusType: m.market.bonusType
                        });
                    });
                }
            }

            return consumeLocations;
        },
        setPrevConsume: function() {
            if (this.humanPlayer.nextAction.actiondata.buildindustrytype !== null && this.humanPlayer.nextAction.actiondata.buildindustrytype !== undefined) {
                this.humanPlayer.nextAction.actiondata.buildlocationid = null;
                this.humanPlayer.nextAction.actiondata.buildspaceid = null;
                this.humanPlayer.nextAction.actiondata.buildlocationname = null;
                this.setHumanAction('01');
            }

            if (this.humanPlayer.nextAction.actiondata.developabletiles) {
                if (this.humanPlayer.actionStep === '31') {
                    this.setHumanAction('30');
                } else if (this.humanPlayer.actionStep === '21') {
                    this.setHumanAction('20');
                }
            }

            if (this.humanPlayer.nextAction.actiondata.networkfromlocationid) {
                if (this.humanPlayer.actionStep === '31') {
                    this.setHumanAction('30');
                } else if (this.humanPlayer.actionStep === '54') {
                    this.setHumanAction('53');
                } else {
                    this.setHumanAction('11');
                }
            }

            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Sell) {
                if (this.humanPlayer.actionStep === '21') {
                    this.setHumanAction('20');
                }
            }
        },
        // human action description
        getHumanActionDescription: function () {
            let actions = [];
            let self = this;

            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Build) {
                let actionstring = '';

                // If Build
                let location = this.findLocationById(this.humanPlayer.nextAction.actiondata.buildlocationid);
                actionstring = actionstring + 'Build ' + this.tileToString(this.humanPlayer.nextAction.actiondata.buildtile) + ' in ' + location.name + ' (Space ' + (this.humanPlayer.nextAction.actiondata.buildspaceid + 1) + ').';

                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });

                actionstring = 'Pay £' + this.humanPlayer.nextAction.actiondata.buildtile.poundsCost + '.';
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });

                // Note coal moving to market
                if (this.humanPlayer.nextAction.actiondata.buildtile.industrytype === INDUSTRY.CoalMine) {
                    if (this.totalEmptyMarketCoalSpaces > 0 && this.isConnectedToMarket(this.humanPlayer.nextAction.actiondata.buildlocationid, PLAYER_TYPE.Human)) {
                        let coalMoved = 0;

                        if (this.totalEmptyMarketCoalSpaces > this.humanPlayer.nextAction.actiondata.buildtile.availableCoal) {
                            coalMoved = this.humanPlayer.nextAction.actiondata.buildtile.availableCoal;
                        } else {
                            coalMoved = this.totalEmptyMarketCoalSpaces;
                        }

                        actionstring = 'Move ' + coalMoved + ' coal to the market (leaving ' + (this.humanPlayer.nextAction.actiondata.buildtile.availableCoal - coalMoved) + ' coal on the tile).';

                        if (coalMoved === this.humanPlayer.nextAction.actiondata.buildtile.availableCoal) {
                            actionstring = actionstring + ' [[ Flips the tile! ]]';
                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });

                            actionstring = '';
                            actionstring = actionstring + 'Increase your income by ' + this.humanPlayer.nextAction.actiondata.buildtile.income + '.';
                            this.humanPlayer.nextAction.actiondata.flipIncomeIncrease = this.humanPlayer.nextAction.actiondata.buildtile.income;
                        }

                        actions.push({
                            actionDone: false,
                            actionDesc: actionstring
                        });        
                    }
                }

                // Note iron moving to market
                if (this.humanPlayer.nextAction.actiondata.buildtile.industrytype === INDUSTRY.IronWorks) {
                    if (this.totalEmptyMarketIronSpaces > 0) {
                        let ironMoved = 0;

                        if (this.totalEmptyMarketIronSpaces > this.humanPlayer.nextAction.actiondata.buildtile.availableIron) {
                            ironMoved = this.humanPlayer.nextAction.actiondata.buildtile.availableIron;
                        } else {
                            ironMoved = this.totalEmptyMarketIronSpaces;
                        }

                        actionstring = 'Move ' + ironMoved + ' iron to the market (leaving ' + (this.humanPlayer.nextAction.actiondata.buildtile.availableIron - ironMoved) + ' iron on the tile).';

                        if (ironMoved === this.humanPlayer.nextAction.actiondata.buildtile.availableIron) {
                            actionstring = actionstring + ' [[ Flips the tile! ]]';
                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });

                            actionstring = '';
                            actionstring = actionstring + 'Increase your income by ' + this.humanPlayer.nextAction.actiondata.buildtile.income + '.';
                            this.humanPlayer.nextAction.actiondata.flipIncomeIncrease = this.humanPlayer.nextAction.actiondata.buildtile.income;
                        }

                        actions.push({
                            actionDone: false,
                            actionDesc: actionstring
                        });        
                    }
                }
            }

            // If Network
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Network) {
                let actionstring = '';
                let locationfrom = this.findLocationById(this.humanPlayer.nextAction.actiondata.networkfromlocationid);
                let locationto = this.findLocationById(this.humanPlayer.nextAction.actiondata.networktolocationid);

                actionstring = actionstring + 'Network from ' + locationfrom.name + ' to ' + locationto.name + '.';
                
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });

                actionstring = '';
                actionstring = actionstring + 'Pay £' + (this.currentEra === ERA.Canal ? CANALERANETWORKCOST : RAILERANETWORKCOST) + '.';
                
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });
            }

            // If Double Network
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.DoubleNetwork) {
                let actionstring = '';
                let locationfrom = this.findLocationById(this.humanPlayer.nextAction.actiondata.networkfromlocationid);
                let locationto = this.findLocationById(this.humanPlayer.nextAction.actiondata.networktolocationid);

                actionstring = actionstring + 'Network from ' + locationfrom.name + ' to ' + locationto.name + '.';
                
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });

                actionstring = '';
                let locationfrom2 = this.findLocationById(this.humanPlayer.nextAction.actiondata.networkfromlocationid2);
                let locationto2 = this.findLocationById(this.humanPlayer.nextAction.actiondata.networktolocationid2);

                actionstring = actionstring + 'Network from ' + locationfrom2.name + ' to ' + locationto2.name + '.';
                
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });

                actionstring = '';
                actionstring = actionstring + 'Pay £' + RAILERADOUBLENETWORKCOST + '.';
                
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });
            }

            // If Sell
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Sell) {
                let self = this;
                let selectedTiles = _.filter(this.humanPlayer.nextAction.actiondata.sellabletiles, function (t) {
                    return t.selected;
                });
                let totalIncomeIncrease = 0;
                let actionstring = '';

                _.forEach(selectedTiles, function (t) {
                    actionstring = '';
                    actionstring = actionstring + 'Sell ' + t.name + ' (Space ' + (t.spaceid + 1) + ')'
                    actionstring = actionstring + ' [[ Flips the tile! ]].';

                    totalIncomeIncrease = totalIncomeIncrease + t.tile.income;

                    actions.push({
                        actionDone: false,
                        actionDesc: actionstring
                    });
                });

                if (totalIncomeIncrease > 0) {
                    actionstring = '';
                    actionstring = actionstring + 'Increase your income by ' + totalIncomeIncrease + '.';
                    actions.push({
                        actionDone: false,
                        actionDesc: actionstring
                    });
                }
            }

            // If Develop
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Develop) {
                let developabletiles = this.humanPlayer.nextAction.actiondata.developabletiles;

                let selectedtiles = [];
                _.forEach(developabletiles, function (i) {
                    _.forEach(i.tiles, function (t) {
                        if (t.selected) {
                            let actionstring = '';

                            actionstring = actionstring + 'Develop ' + self.tileToString(t.developabletile) + '.';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }
                    });
                });
            }

            // If Coal consumption
            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.coal) {
                let actionstring = '';

                _.forEach(this.humanPlayer.nextAction.actiondata.consumelocations.coal.coalLocations, function (l) {
                    if (l.chosenCoal > 0) {
                        actionstring = '';
                        actionstring = actionstring + 'Consume ' + l.chosenCoal + ' coal from ' + l.name;
                        
                        if (l.spaceid != -1) {
                            actionstring = actionstring + ' (Space ' + (l.spaceid) + ')';
                        }

                        if (l.coalAvailable === l.chosenCoal && !l.isMarket) {
                            actionstring = actionstring + ' [[ Flips the tile! ]].';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });

                            let location = self.findLocationById(l.locationid);
                            let tile = location.spaces[l.spaceid - 1].tile;

                            if (tile.color === self.humanPlayer.color) {
                                actionstring = '';
                                actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                actions.push({
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                            }
                            
                        } else {
                            actionstring = actionstring + '.';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }

                        if (l.isMarket) {
                            let totalMarketResourceCost = self.getTotalMarketResourceCost(l.chosenCoal, RESOURCETYPE.Coal);
                            actionstring = '';
                            actionstring = 'Pay £' + totalMarketResourceCost + '.';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }
                    }
                });
            }

            // If iron consumption
            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.iron) {
                let actionstring = '';

                _.forEach(this.humanPlayer.nextAction.actiondata.consumelocations.iron.ironLocations, function (l) {
                    if (l.chosenIron > 0) {
                        actionstring = '';
                        actionstring = actionstring + 'Consume ' + l.chosenIron + ' iron from ' + l.name;
                        
                        if (l.spaceid != -1) {
                            actionstring = actionstring + ' (Space ' + (l.spaceid) + ')';
                        }

                        if (l.ironAvailable === l.chosenIron) {
                            actionstring = actionstring + ' [[ Flips the tile! ]].';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });

                            let location = self.findLocationById(l.locationid);
                            let tile = location.spaces[l.spaceid - 1].tile;

                            if (tile.color === self.humanPlayer.color) {
                                actionstring = '';
                                actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                actions.push({
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                            }
                            
                        } else {
                            actionstring = actionstring + '.';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }

                        if (l.isMarket) {
                            let totalMarketResourceCost = self.getTotalMarketResourceCost(l.chosenIron, RESOURCETYPE.Iron);
                            actionstring = '';
                            actionstring = 'Pay £' + totalMarketResourceCost + '.';

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }
                    }
                });
            }

            // If beer consumption
            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.beer) {
                _.forEach(this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerLocations, function (l) {
                    if (l.chosenBeer > 0) {
                        actionstring = '';
                        actionstring = actionstring + 'Consume ' + l.chosenBeer + ' beer from ' + l.name;
                        
                        actionstring = actionstring + ' (Space ' + (l.spaceid) + ')';

                        if (!l.isMerchant) {
                            if (l.beerAvailable === l.chosenBeer) {
                                actionstring = actionstring + ' [[ Flips the tile! ]].';

                                actions.push({
                                    actionDone: false,
                                    actionDesc: actionstring
                                });

                                let location = self.findLocationById(l.locationid);
                                let tile = location.spaces[l.spaceid - 1].tile;

                                if (tile.color === self.humanPlayer.color) {
                                    actionstring = '';
                                    actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                    actions.push({
                                        actionDone: false,
                                        actionDesc: actionstring
                                    });
                                }
                                
                            } else {
                                actionstring = actionstring + '.';

                                actions.push({
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                            }
                        }

                        if (l.isMerchant) {
                            actionstring = 'Merchant Beer Bonus: ';
                            if (l.bonusType === BONUSTYPE.Pounds) {
                                actionstring = actionstring + '£' + l.bonus + '.';
                            }

                            if (l.bonusType === BONUSTYPE.VPs) {
                                actionstring = actionstring + l.bonus + 'VPs.';
                            }

                            if (l.bonusType === BONUSTYPE.Income) {
                                actionstring = actionstring + l.bonus + ' income steps.';
                            }
                            
                            if (l.bonusType === BONUSTYPE.Develop) {
                                actionstring = actionstring + l.bonus + ' free develop.';
                            }

                            actions.push({
                                actionDone: false,
                                actionDesc: actionstring
                            });
                        }
                    }
                });
            }

            return actions;
        },
        // UI: Scores
        getSortedScores: function () {
            // TODO: Get all scores sorted by score, add a hook to winner for CSS class
        },
        executeNextHumanAction: function () {
            this.saveUndoState();
            
            let self = this; 

            // BUILD
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Build) {
                this.layIndustryTile(PLAYER_TYPE.Human, this.humanPlayer.nextAction.actiondata.buildtile.id, this.humanPlayer.nextAction.actiondata.buildlocationid, this.humanPlayer.nextAction.actiondata.buildspaceid);

                if (!this.humanPlayer.amountSpentThisRound) {
                    this.humanPlayer.amountSpentThisRound = this.humanPlayer.nextAction.actiondata.buildtile.poundsCost;
                } else {
                    this.humanPlayer.amountSpentThisRound = this.humanPlayer.amountSpentThisRound + this.humanPlayer.nextAction.actiondata.buildtile.poundsCost;
                }
            }

            // NETWORK
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Network) {
                this.layNetworkTile(PLAYER_TYPE.Human, this.humanPlayer.nextAction.actiondata.networkfromlocationid, this.humanPlayer.nextAction.actiondata.networktolocationid);

                let networkcost = this.currentEra === ERA.Canal ? CANALERANETWORKCOST : RAILERANETWORKCOST;

                if (!this.humanPlayer.amountSpentThisRound) {
                    this.humanPlayer.amountSpentThisRound = networkcost;
                } else {
                    this.humanPlayer.amountSpentThisRound = this.humanPlayer.amountSpentThisRound + networkcost;
                }
            }

            // DOUBLE NETWORK
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.DoubleNetwork) {
                this.layNetworkTile(PLAYER_TYPE.Human, this.humanPlayer.nextAction.actiondata.networkfromlocationid, this.humanPlayer.nextAction.actiondata.networktolocationid);

                this.layNetworkTile(PLAYER_TYPE.Human, this.humanPlayer.nextAction.actiondata.networkfromlocationid2, this.humanPlayer.nextAction.actiondata.networktolocationid2);

                let networkcost = RAILERADOUBLENETWORKCOST;

                if (!this.humanPlayer.amountSpentThisRound) {
                    this.humanPlayer.amountSpentThisRound = networkcost;
                } else {
                    this.humanPlayer.amountSpentThisRound = this.humanPlayer.amountSpentThisRound + networkcost;
                }
            }

            // SELL
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Sell) {
                let selectedTiles = _.filter(this.humanPlayer.nextAction.actiondata.sellabletiles, function (t) {
                    return t.selected;
                });

                _.forEach(selectedTiles, function (t) {
                    let location = self.findLocationById(t.locationid);
                    let tile = location.spaces[t.spaceid].tile;
                    tile.flipped = true;
                    if (!location.totalLinkVPs) {
                        location.totalLinkVPs = tile.LinkVPs;
                    } else {
                        location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                    }
                });
            }
            // check free develop
            let freedevelops = this.humanPlayer.nextAction.actiondata.freedevelops ? this.humanPlayer.nextAction.actiondata.freedevelops.length : 0;

            // DEVELOP
            if (this.humanPlayer.nextAction.action === HUMAN_ACTION.Develop || freedevelops > 0) {
                let developabletiles = this.humanPlayer.nextAction.actiondata.developabletiles;

                let selectedtiles = [];
                _.forEach(developabletiles, function (i) {
                    _.forEach(i.tiles, function (t) {
                        if (t.selected) {
                            let developabletile = t.developabletile;

                            _.remove(self.humanPlayer.board, function (t) {
                                return t.id === developabletile.id;
                            });
                        }
                    });
                });
            }

            // CONSUME
            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.coal) {
                _.forEach(self.humanPlayer.nextAction.actiondata.consumelocations.coal.coalLocations, function (l) {
                    if (l.locationid === -1) {
                        // market
                        let totalMarketResourceCost = self.getTotalMarketResourceCost(l.chosenCoal, RESOURCETYPE.Coal);

                        if (!self.humanPlayer.amountSpentThisRound) {
                            self.humanPlayer.amountSpentThisRound = totalMarketResourceCost;
                        } else {
                            self.humanPlayer.amountSpentThisRound = self.humanPlayer.amountSpentThisRound + totalMarketResourceCost;
                        }

                        let coalInMarket = self.board.market.coalInMarket;

                        if (l.chosenCoal > coalInMarket) {
                            self.board.market.coalInMarket = 0;
                        } else {
                            self.board.market.coalInMarket = coalInMarket - l.chosenCoal;
                        }
                    } else {
                        let location = self.findLocationById(l.locationid);
                        let tile = location.spaces[l.spaceid - 1].tile;
                        tile.availableCoal = tile.availableCoal - l.chosenCoal;
                        if (tile.availableCoal === 0) {
                            tile.flipped = true;
                            if (!location.totalLinkVPs) {
                                location.totalLinkVPs = tile.LinkVPs;
                            } else {
                                location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                            }
                        }
                    }
                });
            }

            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.iron) {
                _.forEach(self.humanPlayer.nextAction.actiondata.consumelocations.iron.ironLocations, function (l) {
                    if (l.locationid === -2) {
                        // market
                        let totalMarketResourceCost = self.getTotalMarketResourceCost(l.chosenIron, RESOURCETYPE.Iron);

                        if (!self.humanPlayer.amountSpentThisRound) {
                            self.humanPlayer.amountSpentThisRound = totalMarketResourceCost;
                        } else {
                            self.humanPlayer.amountSpentThisRound = self.humanPlayer.amountSpentThisRound + totalMarketResourceCost;
                        }

                        let ironInMarket = self.board.market.ironInMarket;

                        if (l.chosenIron > ironInMarket) {
                            self.board.market.ironInMarket = 0;
                        } else {
                            self.board.market.ironInMarket = ironInMarket - l.chosenIron;
                        }
                    } else {
                        let location = self.findLocationById(l.locationid);
                        let tile = location.spaces[l.spaceid - 1].tile;
                        tile.availableIron = tile.availableIron - l.chosenIron;
                        if (tile.availableIron === 0) {
                            tile.flipped = true;
                            if (!location.totalLinkVPs) {
                                location.totalLinkVPs = tile.LinkVPs;
                            } else {
                                location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                            }
                        }
                    }
                });
            }

            if (this.humanPlayer.nextAction.actiondata.consumelocations && this.humanPlayer.nextAction.actiondata.consumelocations.beer) {
                let self = this;
                _.forEach(this.humanPlayer.nextAction.actiondata.consumelocations.beer.beerLocations, function (l) {
                    if (l.chosenBeer > 0) {
                        let location = self.findLocationById(l.locationid);
                        let tile = location.spaces[l.spaceid - 1].tile;

                        if (location.type === LOCATIONTYPE.Merchants) {
                            tile.totalBeer = tile.totalBeer - l.chosenBeer;
                        } else {
                            tile.availableBeer = tile.availableBeer - l.chosenBeer;
                        }

                        if (!l.isMerchant) {
                            if (l.beerAvailable === l.chosenBeer) {
                                tile.flipped = true;
                                if (!location.totalLinkVPs) {
                                    location.totalLinkVPs = tile.LinkVPs;
                                } else {
                                    location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                                }
                            }
                        }

                        if (l.isMerchant) {
                            if (l.bonusType === BONUSTYPE.VPs) {
                                self.currentPlayer.totalVP = self.currentPlayer.totalVP + l.bonus;
                            }
                        }
                    }
                });
            }
        },
        resetHumanAction: function () {
            this.humanPlayer.nextAction.action = null;
            this.humanPlayer.nextAction.actiondata = {};
            this.humanPlayer.actionStep = null;
        },
        playerAmountSpent: function (player) {
            if (player.currentRoundComplete) {
                return player.amountSpentThisRound ? player.amountSpentThisRound : 0;
            }
            return null;
        },
        
        // Primary action functions
        calculateNextPlayer: function () {
            let self = this;
            if (this.currentPlayerType === PLAYER_TYPE.Human) {
                if (this.humanPlayer.currentTurnIndex === 0 && (this.currentRound > 1 || this.currentEra === ERA.Rail)) { 
                    this.humanPlayer.currentTurnIndex = 1;
                    this.resetHumanAction();
                    this.saveGameState();
                    return;
                } else {
                    this.humanPlayer.currentRoundComplete = true;
                }
            }

            let players = [];

            if (this.numberOfPlayers == '2') {
                players = [
                    this.humanPlayer,
                    this.eliza
                ];
            } else {
                players = [
                    this.humanPlayer,
                    this.eliza,
                    this.eleanor
                ];
            }

            let sortedPlayers = _.sortBy(players, "turnOrder");

            let nextPlayer = _.find(sortedPlayers, function (p) {
                return !p.currentRoundComplete;
            });

            if (!nextPlayer) {
                this.currentRound = this.currentRound + 1;

                // calculate new turn order
                let newSortedPlayers = _.sortBy(sortedPlayers, function (p) {
                    return p.amountSpentThisRound ? p.amountSpentThisRound : 0;
                });
                _.forEach(newSortedPlayers, function (p, index) {
                    let player = self.getPlayerFromType(p.player_type);
                    player.turnOrder = index;
                    player.currentRoundComplete = false;
                });

                this.humanPlayer.currentTurnIndex = 0;
                this.resetHumanAction();

                this.currentPlayerType = newSortedPlayers[0].player_type;

                // check if end of era
                if (this.currentRound > this.roundsPerEra()) {
                    if (this.currentEra === ERA.Canal) {
                        this.isCalculatingScore = true;
                        setTimeout(function() { Vue.nextTick(function() { self.calculateScore(); } ); }, 0);
                        this.currentGameStep = GAME_STEPS.SetupRailEra;
                    } else {
                        this.isCalculatingScore = true;
                        setTimeout(function() { Vue.nextTick(function() { self.calculateScore(); } ); }, 0);
                        this.currentGameStep = GAME_STEPS.FinalScore;
                    }
                } else {
                    if (this.currentPlayerType === PLAYER_TYPE.Eliza_AI || this.currentPlayerType === PLAYER_TYPE.Eleanor_AI) {
                        this.computedUpdater++;
                        this.isAIThinking = true;
                        setTimeout(function() { Vue.nextTick(function() { self.calculateAIAction(self.currentPlayerType) } ); }, 0);
                    }
                    this.currentGameStep = 2;
                }
            } else {
                this.currentPlayerType = nextPlayer.player_type;

                if (nextPlayer.player_type === PLAYER_TYPE.Eliza_AI || nextPlayer.player_type === PLAYER_TYPE.Eleanor_AI) {
                    this.computedUpdater++;
                    this.currentPlayer.nextAction.action = AI_ACTION.Thinking;
                    this.currentPlayer.nextAction.actiondata = {};
                    this.currentPlayer.nextAction.actiondesc = [];
                    this.isAIThinking = true;
                    setTimeout(function() { Vue.nextTick(function() { self.calculateAIAction(self.currentPlayerType) } ); }, 0);
                    return;
                }
            }
        },
        shuffleAICards: function () {
            this.eliza.cards = _.shuffle(_.cloneDeep(getAIDeck(this.eliza.deckType, this.numberOfPlayers)));
            this.eleanor.cards = _.shuffle(_.cloneDeep(getAIDeck(this.eleanor.deckType, this.numberOfPlayers)));
        },
        calculateAIAction: function (player_type) {
            this.error = null;

            try {
                // this function builds the 'nextAction' object attached to the player object. It does not execute any actions.

                let player = this.getPlayerFromType(player_type);
                let action = null;

                player.nextAction.action = null;
                player.nextAction.actiondata = {};

                // data package, start with storing the current round
                // use action data to describe what the AI will do and then eventually do it
                let actiondata = {
                    round: this.currentRound,
                    neededCoal: 0,
                    neededIron: 0,
                    neededBeer: 0,
                    consumedata: {}
                };

                // draw two cards
                player.currentCard1 = this.findCardById(player.cards.shift());
                player.currentCard2 = this.findCardById(player.cards.shift());

                let sell = false;

                // don't try to sell quickly early in the era
                if (this.currentRound < 4) {
                    while (!player.currentCard1.locationid && !player.currentCard2.locationid) {
                        // put cards back
                        player.cards.push(player.currentCard1.id);
                        player.cards.push(player.currentCard2.id);
                        player.cards = _.shuffle(player.cards);

                        player.currentCard1 = this.findCardById(player.cards.shift());
                        player.currentCard2 = this.findCardById(player.cards.shift());
                    }
                }

                // if both cards are industry (non-null industry type) then SELL
                if (!player.currentCard1.locationid && !player.currentCard2.locationid) {
                    sell = true;
                }
                else {
                    // --- BEGIN guaranteed sale logic ---
                    let hasSoldThisEra = this.currentEra === ERA.Canal ? player.soldInCanalEra : player.soldInRailEra;

                    if (this.currentRound >= this.roundToStartGuaranteedSale()) {
                        if (!hasSoldThisEra) {
                            let diff = this.roundsPerEra() - this.currentRound;

                            // if the last round of the era, guaranteed sale, otherwise chance at sale
                            let diceRoll = rollDie(1, (diff + 1));

                            if (diceRoll === 1 && this.findPlayerUnflippedSellableIndustriesConnectedToMarket.length > 0) {
                                sell = true;
                            }
                        }
                    }
                    // --- END guaranteed sale logic ---

                    // TRY BUILD (first card, then second card)
                    if (!sell) {
                        let build = false;
                        let actioncards = [player.currentCard1, player.currentCard2];

                        // try each card
                        for (let cardi = 0; cardi < actioncards.length; cardi++) {
                            let othercardi = cardi === 0 ? 1 : 0;

                            let card = actioncards[cardi];
                            let othercard = actioncards[othercardi];

                            // if location card
                            if (card.locationid) {
                                let availablespaceid = null;

                                // first try brewery
                                availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.Brewery, false);

                                if (availablespaceid) {
                                    // if a brewery can be built in the location, then check if AI has unflipped breweries
                                    if (!this.playerHasUnflippedBrewery(player_type)) {
                                        build = true;

                                        actiondata.locationid = card.locationid;
                                        actiondata.spaceid = availablespaceid;
                                        actiondata.industrytype = INDUSTRY.Brewery;
                                    }
                                }

                                if (!build) {
                                    // then try coal mine
                                    availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.CoalMine, false);

                                    if (availablespaceid) {
                                        // if a coal mine can be built in the location, then check if AI has unflipped coal mine
                                        if (!this.playerHasUnflippedCoalMine(player_type) && this.findNextTileFromPlayerBoard(player_type, INDUSTRY.CoalMine)) {
                                            build = true;
            
                                            actiondata.locationid = card.locationid;
                                            actiondata.spaceid = availablespaceid;
                                            actiondata.industrytype = INDUSTRY.CoalMine;

                                            let emptyMarketCoal = this.board.market.totalPossibleCoal - this.board.market.coalInMarket;
                                            if (emptyMarketCoal > 0) {
                                                let isConnectedToMarket = this.isConnectedToMarket(card.locationid, player_type);

                                                if (isConnectedToMarket) {
                                                    // Find tile to place from player board
                                                    let industrytile = this.findNextTileFromPlayerBoard(player_type, actiondata.industrytype);
                                                    
                                                    if (emptyMarketCoal > industrytile.availableCoal) {
                                                        actiondata.coalMoved = industrytile.availableCoal;
                                                        actiondata.willFlip = true;
                                                    }
                                                    else {
                                                        actiondata.coalMoved =  emptyMarketCoal;
                                                        actiondata.willFlip = false;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (!build) {
                                    // then try iron works
                                    availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.IronWorks, false);

                                    if (availablespaceid) {
                                        // if an iron works can be built in the location, then check if AI has unflipped iron works
                                        if (!this.playerHasUnflippedIronWorks(player_type) && this.findNextTileFromPlayerBoard(player_type, INDUSTRY.IronWorks)) {
                                            build = true;
            
                                            actiondata.locationid = card.locationid;
                                            actiondata.spaceid = availablespaceid;
                                            actiondata.industrytype = INDUSTRY.IronWorks;

                                            let emptyMarketIron = this.board.market.totalPossibleIron - this.board.market.ironInMarket;
                                            if (emptyMarketIron > 0) {
                                                // Find tile to place from player board
                                                let industrytile = this.findNextTileFromPlayerBoard(player_type, actiondata.industrytype);
                                                
                                                if (emptyMarketIron > industrytile.availableIron) {
                                                    actiondata.ironMoved = industrytile.availableIron;
                                                    actiondata.willFlip = true;
                                                }
                                                else {
                                                    actiondata.ironMoved = emptyMarketIron;
                                                    actiondata.willFlip = false;
                                                }
                                            }
                                        }
                                    }
                                }

                                if (!build) {
                                    // then try pottery
                                    availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.Pottery, false);

                                    if (availablespaceid && this.findNextTileFromPlayerBoard(player_type, INDUSTRY.Pottery)) {
                                        build = true;
            
                                        actiondata.locationid = card.locationid;
                                        actiondata.spaceid = availablespaceid;
                                        actiondata.industrytype = INDUSTRY.Pottery;
                                    }
                                }

                                if (!build) {
                                    // then try cotton mill
                                    availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.CottonMill, false);

                                    if (availablespaceid && this.findNextTileFromPlayerBoard(player_type, INDUSTRY.CottonMill)) {
                                        build = true;
            
                                        actiondata.locationid = card.locationid;
                                        actiondata.spaceid = availablespaceid;
                                        actiondata.industrytype = INDUSTRY.CottonMill;
                                    }
                                }

                                if (!build) {
                                    // then try manufactured goods
                                    availablespaceid = this.findAvailableIndustrySpaceInLocation(card.locationid, INDUSTRY.Manufacturer, false);

                                    if (availablespaceid && this.findNextTileFromPlayerBoard(player_type, INDUSTRY.Manufacturer)) {
                                        build = true;
            
                                        actiondata.locationid = card.locationid;
                                        actiondata.spaceid = availablespaceid;
                                        actiondata.industrytype = INDUSTRY.Manufacturer;
                                    }
                                }
                            } else {
                                // if industry card, try sellable goods in adjacent locations
                                let adjacentIndustryLocations = this.findAdjacentIndustryLocationsForAI(othercard.locationid);
                                let availablespaceid = null;
                                
                                let self = this;
                                _.forEach(adjacentIndustryLocations, function (l) {
                                    if (!build) {
                                        // then try pottery
                                        availablespaceid = self.findAvailableIndustrySpaceInLocation(l.id, INDUSTRY.Pottery, false);
            
                                        if (availablespaceid && self.findNextTileFromPlayerBoard(player_type, INDUSTRY.Pottery)) {
                                            build = true;
                
                                            actiondata.locationid = l.id;
                                            actiondata.spaceid = availablespaceid;
                                            actiondata.industrytype = INDUSTRY.Pottery;
                                        }
                                    }
            
                                    if (!build) {
                                        // then try cotton mill
                                        availablespaceid = self.findAvailableIndustrySpaceInLocation(l.id, INDUSTRY.CottonMill, false);
            
                                        if (availablespaceid && self.findNextTileFromPlayerBoard(player_type, INDUSTRY.CottonMill)) {
                                            build = true;
                
                                            actiondata.locationid = l.id;
                                            actiondata.spaceid = availablespaceid;
                                            actiondata.industrytype = INDUSTRY.CottonMill;
                                        }
                                    }
            
                                    if (!build) {
                                        // then try manufactured goods
                                        availablespaceid = self.findAvailableIndustrySpaceInLocation(l.id, INDUSTRY.Manufacturer, false);
            
                                        if (availablespaceid && self.findNextTileFromPlayerBoard(player_type, INDUSTRY.Manufacturer)) {
                                            build = true;
                
                                            actiondata.locationid = l.id;
                                            actiondata.spaceid = availablespaceid;
                                            actiondata.industrytype = INDUSTRY.Manufacturer;
                                        }
                                    }

                                    // once we found a build, no more searching needed
                                    if (build) {
                                        return false;
                                    }
                                });
                            }

                            if (build) {
                                // Find tile to place from player board
                                let industrytile = this.findNextTileFromPlayerBoard(player_type, actiondata.industrytype);
                                actiondata.industrytile = industrytile;
                            
                                actiondata.neededCoal = actiondata.neededCoal + industrytile.coalCost;
                                actiondata.neededIron = actiondata.neededIron + industrytile.ironCost;

                                // Calculate network
                                let addVPNoLink = 5;
                                let addVPRailEra = 5;
                                let currentPlayer = this.getPlayerFromType(player_type);
                                let closestWithPath = null; // closest unconnected

                                if (currentPlayer.totalUsedNetworkTiles === 14) {
                                    actiondata.addVP = addVPNoLink;
                                } else {
                                    actiondata.addVP = 0;

                                    // if brewery, coal mine, or iron works
                                    if (actiondata.industrytype === 0 || actiondata.industrytype === 4 || actiondata.industrytype === 5) {
                                        closestWithPath = this.findClosestUnconnectedUnflippedIndustryWithPath(actiondata.locationid, player_type);

                                        if (!closestWithPath) {
                                            closestWithPath = this.findClosestUnconnectedFlippedIndustryWithPath(actiondata.locationid, player_type, true);

                                            if (!closestWithPath) {
                                                actiondata.addVP = addVPNoLink;
                                            /* build = false;
                                                sell = true;
                                                actiondata.locationid = null;
                                                actiondata.spaceid = null;
                                                actiondata.industrytype = null;
                                                actiondata.neededCoal = 0;
                                                actiondata.neededIron = 0; */
                                            }
                                        } 
                                    }
                                    
                                    // if pottery, cotton mill, or manufactured goods
                                    if (actiondata.industrytype === 1 || actiondata.industrytype === 2 || actiondata.industrytype === 3) {
                                        closestWithPath = this.findClosestUnconnectedMerchantWithPath(actiondata.locationid, actiondata.industrytype, player_type);

                                        if (!closestWithPath) {
                                            closestWithPath = this.findClosestUnconnectedUnflippedIndustryWithPath(actiondata.locationid, player_type, true);

                                            if (!closestWithPath) {
                                                closestWithPath = this.findClosestUnconnectedFlippedIndustryWithPath(actiondata.locationid, player_type, true);

                                                if (!closestWithPath) {
                                                    actiondata.addVP = addVPNoLink;
                                                /* build = false;
                                                    sell = true;
                                                    actiondata.locationid = null;
                                                    actiondata.spaceid = null;
                                                    actiondata.industrytype = null;
                                                    actiondata.neededCoal = 0;
                                                    actiondata.neededIron = 0; */
                                                }
                                            }
                                        } 
                                    }
                                }

                                // find tile to lay (first missing tile along the path)
                                if (closestWithPath) {
                                    let path = closestWithPath.path;
                                    for (let i=0;i<path.length;i++) {
                                        let currentlocation = path[i];
                                        let nexttargetlocation = path[i+1];

                                        let edges = null;
                                        if (this.currentEra === ERA.Canal) {
                                            edges = currentlocation.edgesCanal;
                                        } else {
                                            edges = currentlocation.edgesRail;
                                        }

                                        // check if there is a tile on this portion of the path
                                        let edge = _.find(edges, function (e) {
                                            return e.toId === nexttargetlocation.id;
                                        });

                                        if (!edge.tile) {
                                            actiondata.linktargetlocationid1 = currentlocation.id;
                                            actiondata.linktargetlocationid2 = nexttargetlocation.id;
                                            break;
                                        }
                                    }
                                }

                                // if we are linking in the rail era, a coal will be needed
                                if (actiondata.linktargetlocationid1 !== null && actiondata.linktargetlocationid1 !== undefined && this.currentEra === ERA.Rail) {
                                    // for now, no 5vp per network
                                    //actiondata.addVP = actiondata.addVP + addVPRailEra;
                                    actiondata.neededCoal = actiondata.neededCoal + 1;
                                }

                                // calculate iron and coal consumption
                                let coalConsumption = null;
                                let ironConsumption = null;

                                if (actiondata.neededCoal > 0) {
                                    coalConsumption = this.generateAICoalConsumption(actiondata.locationid, player_type, actiondata.neededCoal);
                                    actiondata.consumedata.coalConsumption = coalConsumption;
                                }

                                if (actiondata.neededIron > 0) {
                                    ironConsumption = this.generateAIIronConsumption(actiondata.locationid, player_type, actiondata.neededIron);
                                    actiondata.consumedata.ironConsumption = ironConsumption;
                                }
                            }

                            if (build || sell) {
                                break;
                            }
                        }

                        // if built, set the nextaction 
                        if (build) {
                            action = AI_ACTION.BuildAndNetwork;
                            
                            player.nextAction.action = action;
                            player.nextAction.actiondata = actiondata;
                        } else {
                            // if neither card could be built, sell
                            sell = true;
                        }
                    }
                }

                // SELL
                if (sell) {
                    action = AI_ACTION.Sell;

                    // find sellable market-connected industries
                    let playerunflippedsellableindustriesconnectedtomarket = this.findPlayerUnflippedSellableIndustriesConnectedToMarket;

                    actiondata.industriestosell = playerunflippedsellableindustriesconnectedtomarket;

                    let neededBeer = _.sumBy(playerunflippedsellableindustriesconnectedtomarket, function (m) {
                        return m.tile.beerCost;
                    });

                    if (neededBeer > 0) {
                        let marketsWithBeer = [];
                        let marketsWithTiles = [];
                        _.forEach(playerunflippedsellableindustriesconnectedtomarket, function (t) {
                            marketsWithBeer = _.union(marketsWithBeer, t.connectedMarketsWithTiles);
                        });

                        marketsWithTiles = _.uniqBy(marketsWithBeer, function (m) {
                            return m.market.id + '-' + m.space.id;
                        });

                        let locationids = _.uniqBy(_.map(playerunflippedsellableindustriesconnectedtomarket, "locationid"), "locationid");
                        let beerConsumption = this.generateAIBeerConsumption(locationids, player_type, neededBeer, marketsWithTiles);
                        actiondata.consumedata.beerConsumption = beerConsumption;
                    }

                    if (playerunflippedsellableindustriesconnectedtomarket.length === 0) {
                        // couldn't sell, first check if can get some points networking

                        let networkLocations = this.findAllLocationsInNetwork(this.currentPlayer.player_type);

                        let sortedLocationsByLinkVP = [];
                        let locationsWithTotalLinkVPs = _.filter(networkLocations, function (l) {
                            return l.totalLinkVPs;
                        });

                        sortedLocationsByLinkVP = _.orderBy(networkLocations, [function (l) { return (new Number(l.possibleLinkVPs ? l.possibleLinkVPs : 0) + new Number(l.totalLinkVPs ? l.totalLinkVPs : 0)) }], ['desc']);

                        if (this.currentRound == this.roundsPerEra()) {
                            // if the last round, prefer locations with flipped industries, otherwise stick with locations with unflipped
                            if (locationsWithTotalLinkVPs.length > 0) {
                                sortedLocationsByLinkVP = _.orderBy(locationsWithTotalLinkVPs, [function (l) { return l.totalLinkVPs }], ['desc']);
                            }
                        }

                        if (sortedLocationsByLinkVP.length > 0 && player.totalUsedNetworkTiles < 14) {
                            let locationfromid = null;
                            let locationtoid = null;
                            let locationfromid2 = null;
                            let locationtoid2 = null;

                            let l = sortedLocationsByLinkVP[0];
                            let self2 = this;
                            _.forEach(sortedLocationsByLinkVP, function (l) {
                                if (locationtoid === null || locationtoid === undefined || locationtoid2 === null || locationtoid2 === undefined) {
                                    let edges = [];
                                    let sellAdjacentIndustryLocations = [];
            
                                    if (self2.currentEra === ERA.Canal) {
                                        edges = l.edgesCanal;
                                    } else {
                                        edges = l.edgesRail;
                                    }
            
                                    // get adjacent locations with no link
                                    _.forEach(edges, function (e) {
                                        let adjacentlocation = self2.findLocationById(e.toId);
            
                                        if (!adjacentlocation.isSouthernFarm && !e.tile) {
                                            sellAdjacentIndustryLocations.push(adjacentlocation);
                                        }
                                    });

                                    // find best adjacent
                                    let sortedAdjacentLocationsByLinkVP = [];
                                    let adjacentLocationsWithTotalLinkVPs = _.filter(sellAdjacentIndustryLocations, function (lvp) {
                                        return lvp.totalLinkVPs;
                                    });
                                    
                                    sortedAdjacentLocationsByLinkVP = _.orderBy(sellAdjacentIndustryLocations, [function (lvp) { return (new Number(lvp.possibleLinkVPs ? lvp.possibleLinkVPs : 0) + new Number(lvp.totalLinkVPs ? lvp.totalLinkVPs : 0)) }], ['desc']);

                                    if (self2.currentRound == self2.roundsPerEra()) {
                                        // if the last round, prefer adjacent locations with flipped industries, otherwise stick with locations with unflipped
                                        if (adjacentLocationsWithTotalLinkVPs.length > 0) {
                                            sortedAdjacentLocationsByLinkVP = _.orderBy(adjacentLocationsWithTotalLinkVPs, [function (lvp) { return lvp.totalLinkVPs }], ['desc']);
                                        }
                                    }

                                    if (sortedAdjacentLocationsByLinkVP.length > 0) {
                                        if (locationtoid === null || locationtoid === undefined) {
                                            locationfromid = l.id;
                                            locationtoid = sortedAdjacentLocationsByLinkVP[0].id;
                                        } else {
                                            locationfromid2 = l.id;
                                            locationtoid2 = sortedAdjacentLocationsByLinkVP[0].id;

                                            // prevent both network actions from being duplicates
                                            if ((locationfromid === locationfromid2 && locationtoid === locationtoid2) || (locationfromid === locationtoid2 && locationtoid === locationfromid2)) {
                                                if (sortedAdjacentLocationsByLinkVP.length > 1) {
                                                    locationtoid2 = sortedAdjacentLocationsByLinkVP[1].id;
                                                } else {
                                                    locationfromid2 = null;
                                                    locationtoid2 = null;
                                                }
                                            }
                                        }
                                    }
                                }
                            });

                            if (!(locationfromid === null || locationfromid === undefined) && !(locationtoid === null || locationtoid === undefined)) {
                                action = AI_ACTION.NetworkCouldntSell;
                                actiondata.linktargetlocationid1 = locationfromid;
                                actiondata.linktargetlocationid2 = locationtoid;

                                if (!(locationtoid2 === null || locationtoid2 === undefined)) {
                                    actiondata.linktargetlocationid3 = locationfromid2;
                                    actiondata.linktargetlocationid4 = locationtoid2;
                                }
                            } else {
                                actiondata.addVP = 5;
                            }
                        } else {
                            actiondata.addVP = 5;
                        }
                    }

                    player.nextAction.action = action;
                    player.nextAction.actiondata = actiondata;
                }

                this.saveGameState();
                this.computedUpdater++;
                this.isAIThinking = false;
            } catch (e) {
                this.error = e.name + ': ' + e.message;
                this.saveGameState();
            }
            //console.log(player.nextAction);
        },
        getAIActionDescription: function () {
            let self = this;
            let actions = [];

            if (this.currentPlayer.nextAction.action === AI_ACTION.Thinking) {
                actions.push({
                    id: 1,
                    actionDone: false,
                    actionDesc: 'Thinking about it...'
                });
                return actions;
            }

            let actionid = new Number((this.currentPlayerType + 1) + '0' + this.currentRound).valueOf();

            if (this.currentPlayer.nextAction.action === AI_ACTION.BuildAndNetwork || this.currentPlayer.nextAction.action === AI_ACTION.NetworkCouldntSell) {
                let actionstring = '';

                if (this.currentPlayer.nextAction.action === AI_ACTION.BuildAndNetwork) {
                    // If Build and Network
                    let location = this.findLocationById(this.currentPlayer.nextAction.actiondata.locationid);
                    actionstring = actionstring + 'Build ' + this.tileToString(this.currentPlayer.nextAction.actiondata.industrytile) + ' in ' + location.name + ' (Space ' + (this.currentPlayer.nextAction.actiondata.spaceid + 1) + ').';

                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                }

                /*actionstring = 'Spends £' + this.currentPlayer.nextAction.actiondata.industrytile.poundsCost + '.';
                actions.push({
                    actionDone: false,
                    actionDesc: actionstring
                });*/

                // Note move of coal to market
                if (this.currentPlayer.nextAction.actiondata.coalMoved && this.currentPlayer.nextAction.actiondata.coalMoved > 0) {
                    actionstring = '';
                    actionstring = 'Move ' + this.currentPlayer.nextAction.actiondata.coalMoved + ' coal to the market (leaving ' + (this.currentPlayer.nextAction.actiondata.industrytile.availableCoal - this.currentPlayer.nextAction.actiondata.coalMoved) + ' coal on the tile.)';

                    if (this.currentPlayer.nextAction.actiondata.industrytile.availableCoal == this.currentPlayer.nextAction.actiondata.coalMoved) {
                        actionstring = actionstring + ' [[ Flips the tile! ]]';
                    }
                    
                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                }

                // Note move of iron to market
                if (this.currentPlayer.nextAction.actiondata.ironMoved && this.currentPlayer.nextAction.actiondata.ironMoved > 0) {
                    actionstring = '';
                    actionstring = 'Move ' + this.currentPlayer.nextAction.actiondata.ironMoved + ' iron to the market (leaving ' + (this.currentPlayer.nextAction.actiondata.industrytile.availableIron - this.currentPlayer.nextAction.actiondata.ironMoved) + ' iron on the tile).';

                    if (this.currentPlayer.nextAction.actiondata.industrytile.availableIron == this.currentPlayer.nextAction.actiondata.ironMoved) {
                        actionstring = actionstring + ' [[ Flips the tile! ]]';
                    }
                    
                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                }

                // Network
                actionstring = '';
                // Add VP
                if (this.currentPlayer.nextAction.actiondata.addVP && this.currentPlayer.nextAction.actiondata.addVP > 0) {
                    actionstring = actionstring + 'Could not network, so gains ' + this.currentPlayer.nextAction.actiondata.addVP + 'VP (now has ' + (this.currentPlayer.totalVP + this.currentPlayer.nextAction.actiondata.addVP) + 'VP in total).';

                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                } else {
                    if (this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== undefined && this.currentPlayer.nextAction.actiondata.linktargetlocationid2 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid2 !== undefined) {
                        let locationfrom = this.findLocationById(this.currentPlayer.nextAction.actiondata.linktargetlocationid1);
                        let locationto = this.findLocationById(this.currentPlayer.nextAction.actiondata.linktargetlocationid2);

                        actionstring = actionstring + 'Network from ' + locationfrom.name + ' to ' + locationto.name;

                        if (this.currentEra === ERA.Rail && this.currentPlayer.nextAction.action === AI_ACTION.NetworkCouldntSell) {
                            actionstring = actionstring + ' ||| AI tried to sell and couldn\'t, so by special AI rule, this action costs no coal';
                        }

                        actionstring = actionstring + '.';

                        actions.push({
                            id: actionid,
                            actionDone: false,
                            actionDesc: actionstring
                        });
                        actionid = actionid + 1;
                    }

                    if (this.currentPlayer.nextAction.actiondata.linktargetlocationid3 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid3 !== undefined && this.currentPlayer.nextAction.actiondata.linktargetlocationid4 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid4 !== undefined) {
                        actionstring = '';
                        let locationfrom = this.findLocationById(this.currentPlayer.nextAction.actiondata.linktargetlocationid3);
                        let locationto = this.findLocationById(this.currentPlayer.nextAction.actiondata.linktargetlocationid4);

                        actionstring = actionstring + 'Network from ' + locationfrom.name + ' to ' + locationto.name;

                        if (this.currentEra === ERA.Rail && this.currentPlayer.nextAction.action === AI_ACTION.NetworkCouldntSell) {
                            actionstring = actionstring + ' ||| AI tried to sell and couldn\'t, so by special AI rule, this action costs no coal';
                        }

                        actionstring = actionstring + '.';

                        actions.push({
                            id: actionid,
                            actionDone: false,
                            actionDesc: actionstring
                        });
                        actionid = actionid + 1;
                    }
                }

                // Coal consumption
                if (this.currentPlayer.nextAction.actiondata.consumedata && this.currentPlayer.nextAction.actiondata.consumedata.coalConsumption) {
                    _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.coalConsumption, function (c) {
                        actionstring = '';
                        actionstring = actionstring + 'Consume ' + c.coalConsumed + ' coal from ' + c.locationname;
                        
                        if (c.spaceid != -1) {
                            actionstring = actionstring + ' (Space ' + (c.spaceid + 1) + ')';

                            let location = self.findLocationById(c.locationid);
                            let tile = location.spaces[c.spaceid].tile;
                            let leftOverCoal = tile.availableCoal - c.coalConsumed;

                            if (leftOverCoal === 0) {
                                actionstring = actionstring + ' [[ Flips the tile! ]].';
                                actions.push({
                                    id: actionid,
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                                actionid = actionid + 1;

                                if (tile.color === self.humanPlayer.color) {
                                    actionstring = '';
                                    actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                    actions.push({
                                        actionDone: false,
                                        actionDesc: actionstring
                                    });
                                    actionid = actionid + 1;
                                }
                            } else {
                                actionstring = actionstring + '.';

                                actions.push({
                                    id: actionid,
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                                actionid = actionid + 1;
                            }
                        } else {
                            actionstring = actionstring + '.';

                            actions.push({
                                id: actionid,
                                actionDone: false,
                                actionDesc: actionstring
                            });
                            actionid = actionid + 1;
                        }
                    });
                }

                // Iron consumption
                if (this.currentPlayer.nextAction.actiondata.consumedata && this.currentPlayer.nextAction.actiondata.consumedata.ironConsumption) {
                    _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.ironConsumption, function (c) {
                        actionstring = '';
                        actionstring = actionstring + 'Consume ' + c.ironConsumed + ' iron from ' + c.locationname;

                        if (c.spaceid != -1) {
                            actionstring = actionstring + ' (Space ' + (c.spaceid + 1) + ')';

                            let location = self.findLocationById(c.locationid);
                            let tile = location.spaces[c.spaceid].tile;
                            let leftOverIron = tile.availableIron - c.ironConsumed;

                            if (leftOverIron === 0) {
                                actionstring = actionstring + ' [[ Flips the tile! ]].';
                                actions.push({
                                    id: actionid,
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                                actionid = actionid + 1;

                                if (tile.color === self.humanPlayer.color) {
                                    actionstring = '';
                                    actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                    actions.push({
                                        actionDone: false,
                                        actionDesc: actionstring
                                    });
                                    actionid = actionid + 1;
                                }
                            } else {
                                actionstring = actionstring + '.';

                                actions.push({
                                    id: actionid,
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                                actionid = actionid + 1;
                            }
                        } else {
                            actionstring = actionstring + '.';

                            actions.push({
                                id: actionid,
                                actionDone: false,
                                actionDesc: actionstring
                            });
                            actionid = actionid + 1;
                        }
                    });
                }
            }

            if (this.currentPlayer.nextAction.action === AI_ACTION.Sell) {
                _.forEach(this.currentPlayer.nextAction.actiondata.industriestosell, function (l) {
                    let actionstring = '';

                    actionstring = actionstring + 'Sell ' + self.tileToString(l.tile) + ' in ' + l.name + ' (Space ' + (l.spaceid + 1) + ') [[ Flips the tile! ]].';
                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                });

                if (this.currentPlayer.nextAction.actiondata.industriestosell.length === 0) {
                    let actionstring = '';

                    actionstring = actionstring + 'Could not sell, so gains ' + this.currentPlayer.nextAction.actiondata.addVP + 'VP (now has ' + (this.currentPlayer.totalVP + this.currentPlayer.nextAction.actiondata.addVP) + 'VP in total).';
                    actions.push({
                        id: actionid,
                        actionDone: false,
                        actionDesc: actionstring
                    });
                    actionid = actionid + 1;
                }
            }

            // Beer consumption
            if (this.currentPlayer.nextAction.actiondata.consumedata.beerConsumption && this.currentPlayer.nextAction.actiondata.consumedata.beerConsumption.length > 0) {
                _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.beerConsumption, function (c) {
                    actionstring = '';
                    actionstring = actionstring + 'Consume ' + c.beerConsumed + ' beer from ' + c.name;

                    if (c.spaceid != -1) {
                        actionstring = actionstring + ' (Space ' + (c.spaceid) + ')';

                        let location = self.findLocationById(c.locationid);
                        let tile = location.spaces[c.spaceid - 1].tile;
                        let leftOverBeer = tile.availableBeer - c.beerConsumed;

                        if (leftOverBeer === 0) {
                            actionstring = actionstring + ' [[ Flips the tile! ]].';
                            actions.push({
                                id: actionid,
                                actionDone: false,
                                actionDesc: actionstring
                            });
                            actionid = actionid + 1;

                            if (tile.color === self.humanPlayer.color) {
                                actionstring = '';
                                actionstring = actionstring + 'Increase your income by ' + tile.income + '.';
                                actions.push({
                                    actionDone: false,
                                    actionDesc: actionstring
                                });
                                actionid = actionid + 1;
                            }
                        } else {
                            actionstring = actionstring + '.';

                            actions.push({
                                id: actionid,
                                actionDone: false,
                                actionDesc: actionstring
                            });
                            actionid = actionid + 1;
                        }
                    } else {
                        actionstring = actionstring + '.';

                        actions.push({
                            id: actionid,
                            actionDone: false,
                            actionDesc: actionstring
                        });
                        actionid = actionid + 1;
                    }
                });
            }

            return actions;
        },
        executeNextAIAction: function () {
            this.saveUndoState();

            let self = this;
            // use 'currentPlayer'
            this.currentPlayer.currentRoundComplete = true;

            // If Build/Network
            if (this.currentPlayer.nextAction.action === AI_ACTION.BuildAndNetwork || this.currentPlayer.nextAction.action === AI_ACTION.NetworkCouldntSell) {

                if (this.currentPlayer.nextAction.action === AI_ACTION.BuildAndNetwork) {
                    let industrytile = this.currentPlayer.nextAction.actiondata.industrytile;

                    // Build
                    this.layIndustryTile(this.currentPlayer.player_type, industrytile.id, this.currentPlayer.nextAction.actiondata.locationid, this.currentPlayer.nextAction.actiondata.spaceid);

                    if (!this.currentPlayer.amountSpentThisRound) {
                        this.currentPlayer.amountSpentThisRound = industrytile.poundsCost;
                    } else {
                        this.currentPlayer.amountSpentThisRound = this.currentPlayer.amountSpentThisRound + industrytile.poundsCost;
                    }
                }

                // Network
                if (this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== undefined) {
                    this.layNetworkTile(this.currentPlayer.player_type, this.currentPlayer.nextAction.actiondata.linktargetlocationid1, this.currentPlayer.nextAction.actiondata.linktargetlocationid2);

                    let networkcost = this.currentEra === ERA.Canal ? CANALERANETWORKCOST : RAILERANETWORKCOST;

                    if (!this.currentPlayer.amountSpentThisRound) {
                        this.currentPlayer.amountSpentThisRound = networkcost;
                    } else {
                        this.currentPlayer.amountSpentThisRound = this.currentPlayer.amountSpentThisRound + networkcost;
                    }
                }

                if (this.currentPlayer.nextAction.actiondata.linktargetlocationid3 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid3 !== undefined && this.currentPlayer.nextAction.actiondata.linktargetlocationid4 !== null && this.currentPlayer.nextAction.actiondata.linktargetlocationid4 !== undefined) {
                    this.layNetworkTile(this.currentPlayer.player_type, this.currentPlayer.nextAction.actiondata.linktargetlocationid3, this.currentPlayer.nextAction.actiondata.linktargetlocationid4);

                    let networkcost = this.currentEra === ERA.Canal ? CANALERANETWORKCOST : RAILERANETWORKCOST;

                    if (!this.currentPlayer.amountSpentThisRound) {
                        this.currentPlayer.amountSpentThisRound = networkcost;
                    } else {
                        this.currentPlayer.amountSpentThisRound = this.currentPlayer.amountSpentThisRound + networkcost;
                    }
                }

                // Moving coal and iron to market is handled inside LayIndustryTile
            }

            // SELL
            if (this.currentPlayer.nextAction.action === AI_ACTION.Sell) {
                // flip tiles
                let didFlipTiles = false;
                _.forEach(this.currentPlayer.nextAction.actiondata.industriestosell, function (t) {
                    let location = self.findLocationById(t.locationid);
                    let tile = location.spaces[t.spaceid].tile;
                    tile.flipped = true;
                    if (!location.totalLinkVPs) {
                        location.totalLinkVPs = tile.LinkVPs;
                    } else {
                        location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                    }
                    didFlipTiles = true;
                });

                if (didFlipTiles) {
                    if (this.currentEra === ERA.Canal) {
                        this.currentPlayer.soldInCanalEra = true;
                    }

                    if (this.currentEra === ERA.Rail) {
                        this.currentPlayer.soldInRailEra = true;
                    }
                }

                // consume beer
                if (this.currentPlayer.nextAction.actiondata.consumedata && this.currentPlayer.nextAction.actiondata.consumedata.beerConsumption) {
                    let self = this;
                    _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.beerConsumption, function (l) {
                        if (l.beerConsumed > 0) {
                            let location = self.findLocationById(l.locationid);
                            let tile = location.spaces[l.spaceid - 1].tile;
    
                            if (location.type === LOCATIONTYPE.Merchants) {
                                tile.totalBeer = tile.totalBeer - l.beerConsumed;

                                if (tile.totalBeer < 0) {
                                    tile.totalBeer = 0;
                                }
                            } else {
                                tile.availableBeer = tile.availableBeer - l.beerConsumed;
                            }
    
                            if (!l.isMerchant) {
                                if (l.beerAvailable === l.beerConsumed) {
                                    tile.flipped = true;
                                    if (!location.totalLinkVPs) {
                                        location.totalLinkVPs = tile.LinkVPs;
                                    } else {
                                        location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                                    }
                                }
                            }
    
                            // no merchant beer bonus for AI
                            /*if (l.isMerchant) {
                                if (l.bonusType === BONUSTYPE.VPs) {
                                    self.currentPlayer.totalVP = self.currentPlayer.totalVP + l.bonus;
                                }
                            }*/
                        }
                    });
                }
            }

            // Coal consumption
            if (this.currentPlayer.nextAction.actiondata.consumedata && this.currentPlayer.nextAction.actiondata.consumedata.coalConsumption) {
                _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.coalConsumption, function (c) {
                    if (c.spaceid != -1) {
                        // consume from tile
                        let location = self.findLocationById(c.locationid);
                        let tile = location.spaces[c.spaceid].tile;
                        tile.availableCoal = tile.availableCoal - c.coalConsumed;
                        
                        if (tile.availableCoal === 0) {
                            tile.flipped = true;
                        }
                    } else {
                        // market
                        let totalMarketResourceCost = self.getTotalMarketResourceCost(c.coalConsumed, RESOURCETYPE.Coal);

                        if (!self.currentPlayer.amountSpentThisRound) {
                            self.currentPlayer.amountSpentThisRound = totalMarketResourceCost;
                        } else {
                            self.currentPlayer.amountSpentThisRound = self.currentPlayer.amountSpentThisRound + totalMarketResourceCost;
                        }

                        let coalInMarket = self.board.market.coalInMarket;

                        if (c.coalConsumed > coalInMarket) {
                            self.board.market.coalInMarket = 0;
                        } else {
                            self.board.market.coalInMarket = coalInMarket - c.coalConsumed;
                        }
                    }
                });
            }
            
            // Iron consumption
            if (this.currentPlayer.nextAction.actiondata.consumedata && this.currentPlayer.nextAction.actiondata.consumedata.ironConsumption) {
                _.forEach(this.currentPlayer.nextAction.actiondata.consumedata.ironConsumption, function (c) {
                    if (c.spaceid != -1) {
                        // consume from tile
                        let location = self.findLocationById(c.locationid);
                        let tile = location.spaces[c.spaceid].tile;
                        tile.availableIron = tile.availableIron - c.ironConsumed; 
                        
                        if (tile.availableIron === 0) {
                            tile.flipped = true;
                        }
                    } else {
                        // market
                        let totalMarketResourceCost = self.getTotalMarketResourceCost(c.ironConsumed, RESOURCETYPE.Iron);

                        if (!self.currentPlayer.amountSpentThisRound) {
                            self.currentPlayer.amountSpentThisRound = totalMarketResourceCost;
                        } else {
                            self.currentPlayer.amountSpentThisRound = self.currentPlayer.amountSpentThisRound + totalMarketResourceCost;
                        }

                        let ironInMarket = self.board.market.ironInMarket;

                        if (c.ironConsumed > ironInMarket) {
                            self.board.market.ironInMarket = 0;
                        } else {
                            self.board.market.ironInMarket = ironInMarket - c.ironConsumed;
                        }
                    }
                });
            }

            // Add VP
            if (this.currentPlayer.nextAction.actiondata.addVP && this.currentPlayer.nextAction.actiondata.addVP > 0) {
                this.currentPlayer.totalVP = this.currentPlayer.totalVP + this.currentPlayer.nextAction.actiondata.addVP;
            }
        },
        calculateScore: function () {
            let self = this;

            let finishedScore = false;
            if (this.currentEra === ERA.Canal) {
                finishedScore = this.finishedCanalScore;
            } else {
                finishedScore = this.finishedRailScore;
            }

            if (!finishedScore) {
                _.forEach(this.playersInOrder, function (p) {
                    // calculate flipped industry tile scores
                    _.forEach(self.board.locations, function (l) {
                        if (l.type === LOCATIONTYPE.Industries) {
                            _.forEach(l.spaces, function (s) {
                                if (s.tile && s.tile.color === p.color && s.tile.flipped) {
                                    if (self.currentEra === ERA.Canal) {
                                        p.canalTileVP = p.canalTileVP + s.tile.VPs;
                                    } else {
                                        p.railTileVP = p.railTileVP + s.tile.VPs;
                                    }
                                }
                            });
                        }
                    });

                    if (self.currentEra === ERA.Canal) {
                        p.totalVP = p.totalVP + p.canalTileVP;
                    } else {
                        p.totalVP = p.totalVP + p.railTileVP;
                    }

                    // calculate link scores
                    _.forEach(self.board.locations, function (l) {
                        let edges = [];
                        if (self.currentEra === ERA.Canal) {
                            edges = l.edgesCanal;
                        } else {
                            edges = l.edgesRail;
                        }

                        let locationLinkVPs = 0;
                        if (l.type === LOCATIONTYPE.Merchants) {
                            locationLinkVPs = 2;
                        }

                        if (l.type === LOCATIONTYPE.Industries) {
                            _.forEach(l.spaces, function (s) {
                                if (s.tile && s.tile.flipped) {
                                    locationLinkVPs = locationLinkVPs + s.tile.LinkVPs;
                                }
                            });
                        }

                        _.forEach(edges, function (e) {
                            if (e.tile && e.tile.color === p.color && !e.isToSouthernFarm && !e.isSecondSouthernFarmLink) {
                                if (self.currentEra === ERA.Canal) {
                                    p.canalLinkVP = p.canalLinkVP + locationLinkVPs;
                                } else {
                                    p.railLinkVP = p.railLinkVP + locationLinkVPs;
                                }
                            }
                        });
                    });

                    if (self.currentEra === ERA.Canal) {
                        p.totalVP = p.totalVP + p.canalLinkVP;
                    } else {
                        p.totalVP = p.totalVP + p.railLinkVP;
                    }

                    if (self.currentEra === ERA.Canal) {
                        p.canalTotalVP = p.totalVP;
                    }
                });

                if (self.currentEra === ERA.Canal) {
                    this.finishedCanalScore = true;
                } else {
                    this.finishedRailScore = true;
                }
            }
            this.saveGameState();
            this.isCalculatingScore = false;
        },
        getPlayersWithScores: function () {
            let players = [];

            if (this.numberOfPlayers == '2') {
                players = [
                    this.humanPlayer,
                    this.eliza
                ];
            } else {
                players = [
                    this.humanPlayer,
                    this.eliza,
                    this.eleanor
                ];
            }
            
            let finalPlayersScoreOrder = _.cloneDeep(_.orderBy(players, [function (p) { return p.totalVP }], ['desc']));
            finalPlayersScoreOrder[0].isWinning = true;
            return finalPlayersScoreOrder;
        },
        setupRailEra: function () {
            this.currentEra = ERA.Rail;
            this.currentRound = 1;
            this.shuffleAICards();

            // clear level 1 industry tiles
            _.forEach(this.board.locations, function (l) {
                if (l.type === LOCATIONTYPE.Industries) {
                    _.forEach(l.spaces, function (s) {
                        if (s.tile && s.tile.level === 1) {
                            l.possibleLinkVPs = l.possibleLinkVPs - s.tile.LinkVPs;

                            if (s.tile.flipped) {
                                l.totalLinkVPs = l.totalLinkVPs - s.tile.LinkVPs;
                            }
                            
                            s.tile = null;
                        }
                    });
                }
            });

            this.humanPlayer.totalUsedNetworkTiles = 0;
            this.eliza.totalUsedNetworkTiles = 0;
            this.eleanor.totalUsedNetworkTiles = 0;

            // reset merchant beer
            _.forEach(this.board.locations, function (l) {
                if (l.type === LOCATIONTYPE.Merchants) {
                    _.forEach(l.spaces, function (s) {
                        if (s.tile) {
                            if (s.tile.industryTypes) {
                                s.tile.totalBeer = 1;
                            }
                        }
                    });
                }
            });

            this.saveGameState();

            // NOTE: don't need to clear link tiles, because each era has its own array of connections
        },
        // end: Primary action functions

        getMerchantLocationIds: function () {
            let merchantLocationIds = [13, 24, 26];
    
            if (this.numberOfPlayers == 3) {
                merchantLocationIds.push(0);
            }

            if (this.numberOfPlayers == 4) {
                merchantLocationIds.push(7);
            }

            return _.sortBy(merchantLocationIds);
        },
        setupMerchantTiles: function () {
            let self = this;
            let merchantTiles = _.shuffle(_.filter(MERCHANT_TILES, function (t) {
                return t.minPlayers <= self.numberOfPlayers;
            }));

            // lay tiles in each merchant location
            let merchantLocationIds = this.getMerchantLocationIds();

            _.forEach(merchantLocationIds, function (id) {
                let location = self.findLocationById(id);

                // lay merchant tile
                _.forEach(location.spaces, function (s) {
                    let merchantTile = merchantTiles.shift();
                    s.tile = merchantTile;

                    if (merchantTile.industryTypes) {
                        s.tile.totalBeer = 1;
                    }
                });
            });
        },
        layIndustryTile: function (player_type, tileid, locationid, spaceid) {
            // This function does no error checking. 'tryHumanBuildAction' does error checking, and is otherwise used by the AI bots directly.

            let player = this.getPlayerFromType(player_type);

            // find the tile on the player's player board
            let tile = _.find(player.board, function(p) {
                return p.id === tileid;
            });

            if (tile !== null && tile !== undefined) {
                // place the tile on the game board
                let location = this.findLocationById(locationid);
                let space = _.find(location.spaces, function (p) {
                    return p.id === spaceid;
                });

                // OVERBUILD: If overbuilding
                if (space.tile) {
                    space.tile = null;
                }

                space.tile = _.cloneDeep(tile);
                // increment the possible link VPs
                if (!location.possibleLinkVPs) {
                    location.possibleLinkVPs = tile.LinkVPs;
                } else {
                    location.possibleLinkVPs = location.possibleLinkVPs + tile.LinkVPs;
                }

                // If building beer, update availableBeer to 2 if in Rail Era
                if (space.tile.industrytype === INDUSTRY.Brewery && this.currentEra === ERA.Rail) {
                    space.tile.availableBeer = 2;
                }

                // Move coal to market (if applicable)
                if (space.tile.industrytype === INDUSTRY.CoalMine) {
                    if (this.totalEmptyMarketCoalSpaces > 0 && this.isConnectedToMarket(locationid, player_type)) {
                        let coalMoved = 0;

                        if (this.totalEmptyMarketCoalSpaces >= space.tile.availableCoal) {
                            coalMoved = space.tile.availableCoal;
                            space.tile.flipped = true;
                            if (!location.totalLinkVPs) {
                                location.totalLinkVPs = tile.LinkVPs;
                            } else {
                                location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                            }
                        } else {
                            coalMoved = this.totalEmptyMarketCoalSpaces;
                        }

                        space.tile.availableCoal = space.tile.availableCoal - coalMoved;
                        
                        this.board.market.coalInMarket = this.board.market.coalInMarket + coalMoved;
                    }
                }

                // Move iron to market (if applicable)
                if (space.tile.industrytype === INDUSTRY.IronWorks) {
                    if (this.totalEmptyMarketIronSpaces > 0) {
                        let ironMoved = 0;

                        if (this.totalEmptyMarketIronSpaces >= space.tile.availableIron) {
                            ironMoved = space.tile.availableIron;
                            space.tile.flipped = true;
                            if (!location.totalLinkVPs) {
                                location.totalLinkVPs = tile.LinkVPs;
                            } else {
                                location.totalLinkVPs = location.totalLinkVPs + tile.LinkVPs;
                            }
                        } else {
                            ironMoved = this.totalEmptyMarketIronSpaces;
                        }
                        
                        space.tile.availableIron = space.tile.availableIron - ironMoved;
                        
                        this.board.market.ironInMarket = this.board.market.ironInMarket + ironMoved;
                    }
                }

                // remove the tile from the player's board
                _.remove(player.board, function (p) {
                    return p.id === tileid;
                });

                this.computedUpdater++;
            }
        },
        layNetworkTileBase: function (player_type, locationid1, locationid2) {
            let player = this.getPlayerFromType(player_type);

            let linktile = player.linktile;

            // add the tile to the edges
            let location1 = this.findLocationById(locationid1);
            let location2 = this.findLocationById(locationid2);

            let edges1 = null;
            let edges2 = null;

            if (this.currentEra === ERA.Canal) {
                edges1 = location1.edgesCanal;
                edges2 = location2.edgesCanal;
            } else {
                edges1 = location1.edgesRail;
                edges2 = location2.edgesRail;
            }

            // assume the edges sent are valid
            let edge1 = _.find(edges1, function(p) {
                return p.toId === locationid2;
            });

            let edge2 = _.find(edges2, function(p) {
                return p.toId === locationid1;
            });

            // update both edges and remove the tile from the player
            let linktile1 = _.cloneDeep(linktile);
            linktile1.id = player.nextLinkTileId;
            player.nextLinkTileId = player.nextLinkTileId + 1;
            linktile1.toId1 = locationid1;
            linktile1.toId2 = locationid2;

            let linktile2 = _.cloneDeep(linktile);
            linktile2.id = player.nextLinkTileId;
            player.nextLinkTileId = player.nextLinkTileId + 1;
            linktile2.toId1 = locationid2;
            linktile2.toId2 = locationid1;

            edge1.tile = linktile1;
            edge2.tile = linktile2;

            this.computedUpdater++;
        },
        layNetworkTile: function (player_type, locationid1, locationid2) {
            this.layNetworkTileBase(player_type, locationid1, locationid2);

            if ((locationid1 === 21 && locationid2 === 25) || (locationid1 === 25 && locationid2 === 21)) {
                this.layNetworkTileBase(player_type, 21, 22);
                this.layNetworkTileBase(player_type, 25, 22);
            }

            if (locationid1 === 22) {
                this.layNetworkTileBase(player_type, 21, 25);
                this.layNetworkTileBase(player_type, 22, 21);
                this.layNetworkTileBase(player_type, 22, 25);
            }

            if (locationid2 === 22) {
                this.layNetworkTileBase(player_type, 21, 25);
            }

            let player = this.getPlayerFromType(player_type);
            if (player.totalUsedNetworkTiles === null || player.totalUsedNetworkTiles === undefined) {
                player.totalUsedNetworkTiles = 0;
            }
            player.totalUsedNetworkTiles = player.totalUsedNetworkTiles + 1;
        },
        updateTurnOrder: function () {
            // Calculate turn order based on amount spent
            if (this.useTurnOrder) {

            }
        },

        // -- Eliza rule support
        playerHasUnflippedBrewery: function (player_type) {
            // for: Build (Location Card), step 1
            let playerUnflippedBreweries = this.findPlayerUnflippedBreweries(player_type);

            return (playerUnflippedBreweries && playerUnflippedBreweries.length > 0);
        },
        playerHasUnflippedCoalMine: function (player_type) {
            // for: Build (Location Card), step 2
            let playerUnflippedCoalMines = this.findPlayerUnflippedCoalMines(player_type);

            return (playerUnflippedCoalMines && playerUnflippedCoalMines.length > 0);
        },
        playerHasUnflippedIronWorks: function (player_type) {
            // for: Build (Location Card), step 3
            let playerUnflippedIronWorks = this.findPlayerUnflippedIronWorks(player_type);

            return (playerUnflippedIronWorks && playerUnflippedIronWorks.length > 0);
        },
        findAvailableIndustrySpaceInLocation: function (locationid, industrytype, canOverbuild) {
            // for: Build (Location Card), step 4 and Build (Industry Card), step 2
            // return: the spaceid

            let location = this.findLocationById(locationid);
            let validSpaces = [];
            let self = this;

            let canBuildHere = true;
            if (this.currentEra === ERA.Canal) {
                _.forEach(location.spaces, function (s) {
                    if (s.tile && s.tile.color === self.currentPlayer.color) {
                        canBuildHere = false;
                    }
                });
            }

            if (canBuildHere) {
                _.forEach(location.spaces, function (s) {
                    if (_.includes(s.types, industrytype)) {
                        if (canOverbuild || s.tile === null) {
                            validSpaces.push(s);
                        }
                    }
                });
            }

            let sortedSpaces = _.sortBy(validSpaces, function (s) {
                return s.types.length; // sort single type to the top
            });

            if (sortedSpaces.length > 0) {
                return sortedSpaces[0].id; // choose single type over double
            } else {
                return null;
            }
        },
        findClosestUnconnectedUnflippedIndustryWithPath: function (locationid, player_type, findBelongingToPlayer) {
            // for: Network (after build Coal Mine, Iron Works, or Brewery)
            // if findBelongingToPlayer is true then only find the player's, otherwise find any other than the player's (this allows for both checks in the logic)
            let player = this.getPlayerFromType(player_type);

            let unflippedIndustryLocations = this.findAllUnflippedIndustries(findBelongingToPlayer);

            let chosenLocationWithPath = null;
            let tempNeededTiles = null;
            let self = this;
            _.forEach(unflippedIndustryLocations, function (l) {
                let path = self.findOptimalAIPathBetweenUnconnectedLocations(locationid, l.id, player_type);

                // if an unflipped location is unconnected, check it
                if (path) {
                    let location = l;
                    l.neededTiles = path.distance - path.numberOfLinks;
                    l.path = path;

                    if (!tempNeededTiles || (l.neededTiles < tempNeededTiles)) {
                        tempNeededTiles = l.neededTiles;
                        chosenLocationWithPath = l;
                    }
                }
            });

            return chosenLocationWithPath;
        },
        findClosestUnconnectedFlippedIndustryWithPath: function (locationid, player_type, findBelongingToPlayer) {
            // for: Network (after build Coal Mine, Iron Works, or Brewery)
            // if findBelongingToPlayer is true then only find the player's, otherwise find any other than the player's (this allows for both checks in the logic)
            let player = this.getPlayerFromType(player_type);

            let flippedIndustryLocations = this.findAllFlippedIndustries(findBelongingToPlayer);

            let chosenLocationWithPath = null;
            let tempNeededTiles = null;
            let self = this;
            _.forEach(flippedIndustryLocations, function (l) {
                let path = self.findOptimalAIPathBetweenUnconnectedLocations(locationid, l.id, player_type);

                // if an flipped location is unconnected, check it
                if (path) {
                    let location = l;
                    l.neededTiles = path.distance - path.numberOfLinks;
                    l.path = path;

                    if (!tempNeededTiles || (l.neededTiles < tempNeededTiles)) {
                        tempNeededTiles = l.neededTiles;
                        chosenLocationWithPath = l;
                    }
                }
            });

            return chosenLocationWithPath;
        },
        findClosestUnconnectedMerchantWithPath: function (locationid, industrytype, player_type) {
            // for: Network (after build Coal Mine, Iron Works, or Brewery)
            // for: Network (after build Pottery, Cotton Mill, or Manufacturer)
            // if industrytype is passed then only find matching merchants

            let merchantLocations = this.findAllMerchants();
            let closestUnconnectedMerchantLocation = null;

            let chosenLocationWithPath = null;
            let tempNeededTiles = null;
            let self = this;
            _.forEach(merchantLocations, function (l) {
                let checkMerchant = true;
                // check if required to match
                if (industrytype) {
                    checkMerchant = false;
                    _.forEach(l.spaces, function (s) {
                        if (s.tile && _.includes(s.tile.industryTypes, industrytype)) {
                            checkMerchant = true;
                            return false;
                        }
                    });
                }

                if (checkMerchant) {
                    let path = self.findOptimalAIPathBetweenUnconnectedLocations(locationid, l.id, player_type);

                    // if a location is unconnected, check it
                    if (path) {
                        let location = l;
                        l.neededTiles = path.distance - path.numberOfLinks;
                        l.path = path;

                        if (!tempNeededTiles || (l.neededTiles < tempNeededTiles)) {
                            tempNeededTiles = l.neededTiles;
                            chosenLocationWithPath = l;
                        }
                    }
                }
            });

            return chosenLocationWithPath;
        },
        findAllUnflippedIndustries: function (findBelongingToPlayer) {
            let unflippedIndustryLocations = [];
            let self = this;

            unflippedIndustryLocations = _.filter(this.board.locations, function(o) {
                let spaces = _.find(o.spaces, function(p) {
                    if (p.tile) {
                        if (findBelongingToPlayer) {
                            return p.tile.color === self.currentPlayer.color && !p.tile.flipped;
                        } else {
                            return !p.tile.flipped;
                        }
                    }
                    return false;
                });
                return o.type === LOCATIONTYPE.Industries && spaces;
            });

            return unflippedIndustryLocations;
        },
        findAllFlippedIndustries: function (findBelongingToPlayer) {
            let flippedIndustryLocations = [];
            let self = this;

            flippedIndustryLocations = _.filter(this.board.locations, function(o) {
                let spaces = _.find(o.spaces, function(p) {
                    if (p.tile) {
                        if (findBelongingToPlayer) {
                            return p.tile.color === self.currentPlayer.color && p.tile.flipped;
                        } else {
                            return p.tile.flipped;
                        }
                    }
                    return false;
                });
                return o.type === LOCATIONTYPE.Industries && spaces;
            });

            return flippedIndustryLocations;
        },
        findAllMerchants: function () {
            let merchantLocations = [];

            merchantLocations = _.filter(this.board.locations, function(o) {
                return o.type === LOCATIONTYPE.Merchants;
            });

            return merchantLocations;
        },
        findAllMerchantsWithTiles: function () {
             let merchantLocations = _.filter(this.board.locations, function(o) {
                return o.type === LOCATIONTYPE.Merchants;
            });

            let merchantLocationsWithTiles = _.filter(merchantLocations, function (l) {
                let spacesWithTiles = _.filter(l.spaces, function (s) {
                    return s.tile;
                });
                return spacesWithTiles.length > 0;
            });

            return merchantLocationsWithTiles;
        },
        findOptimalAIPathBetweenUnconnectedLocations: function (locationid, targetlocationid, player_type) {

            let self = this;
            let paths = self.findAllPathsBetweenLocations(locationid, targetlocationid, false, player_type);

            let connectedPaths = _.filter(paths, function (p) {
                return p.distance === p.numberOfLinks;
            });
            if (connectedPaths.length > 0) { // return null if connected
                return null;
            }

            let filteredPaths = _.filter(paths, function (p) {
                return p.distance > p.numberOfLinks;
            });
            if (filteredPaths && filteredPaths.length > 0) {
                // sort paths
                let sortedPaths = _.sortBy(filteredPaths, function (p) {
                    return p.distance - p.numberOfLinks;
                });

                return sortedPaths[0];
            }
        },
        // end: Eliza rule support


        // -- Eliza consumption support
        generateAICoalConsumption: function (locationid, player_type, neededCoal) {
            // for Build (all eras) and Network (Rail Era)
            let player = this.getPlayerFromType(player_type);
            let consumedCoal = 0;
            let coalConsumption = [];

            let connectedCoalLocations = this.findAllConnectedCoal(locationid, player_type);

            // get all coal in order of distance, player's first
            _.forEach(connectedCoalLocations, function (ccl) {
                _.forEach(ccl, function (l) {
                    let playerCoalSpaces = _.filter(l.coalspaces, function (pcs) {
                        return pcs.tile.color === player.color;
                    });

                    let opponentCoalSpaces = _.filter(l.coalspaces, function (pcs) {
                        return pcs.tile.color !== player.color;
                    });

                    _.forEach(playerCoalSpaces, function (pcs) {
                        if (neededCoal > consumedCoal) {
                            let spaceConsumeData = {
                                locationid: l.id,
                                locationname: l.name,
                                spaceid: pcs.id,
                                coalConsumed: 0,
                                willFlip: false
                            };
                            
                            for (let i=0; i < pcs.tile.availableCoal; i++) {
                                if (neededCoal > consumedCoal) {
                                    spaceConsumeData.coalConsumed = spaceConsumeData.coalConsumed + 1;
                                    consumedCoal++;
                                }
                            }
                            spaceConsumeData.willFlip = (spaceConsumeData.coalConsumed === pcs.tile.availableCoal);
                            coalConsumption.push(spaceConsumeData);
                        }
                    });

                    _.forEach(opponentCoalSpaces, function (ocs) {
                        if (neededCoal > consumedCoal) {
                            let spaceConsumeData = {
                                locationid: l.id,
                                locationname: l.name,
                                spaceid: ocs.id,
                                coalConsumed: 0,
                                willFlip: false
                            };
                            
                            for (let i=0; i < ocs.tile.availableCoal; i++) {
                                if (neededCoal > consumedCoal) {
                                    spaceConsumeData.coalConsumed = spaceConsumeData.coalConsumed + 1;
                                    consumedCoal++;
                                }
                            }
                            spaceConsumeData.willFlip = (spaceConsumeData.coalConsumed === ocs.tile.availableCoal);
                            coalConsumption.push(spaceConsumeData);
                        }
                    });
                });
            });

            // whatever is left take from market
            if (neededCoal > consumedCoal) {
                let spaceConsumeData = {
                    locationid: -1,
                    locationname: 'Coal Market',
                    spaceid: -1,
                    coalConsumed: 0,
                    willFlip: false
                }
                for (let i=0; i <= neededCoal - consumedCoal; i++) {
                    spaceConsumeData.coalConsumed = spaceConsumeData.coalConsumed + 1;
                    consumedCoal++;
                }
                coalConsumption.push(spaceConsumeData);
            }

            return coalConsumption;
        },
        generateAIIronConsumption: function (locationid, player_type, neededIron) {
            // for Build

            let player = this.getPlayerFromType(player_type);
            let consumedIron = 0;
            let ironConsumption = [];

            let unflippedIronLocations = this.findAllUnflippedIronWorks();

            _.forEach(unflippedIronLocations, function (l) {
                let playerIronSpaces = _.filter(l.ironspaces, function (pis) {
                    return pis.tile.color === player.color;
                });
                let sortedPlayerIronSpaces = _.sortBy(playerIronSpaces, function (s) {
                    return s.tile.availableIron;
                });

                let opponentIronSpaces = _.filter(l.ironspaces, function (pis) {
                    return pis.tile.color !== player.color;
                });
                let sortedOpponentIronSpaces = _.orderBy(opponentIronSpaces, [function (s) { return s.tile.availableIron }], ['desc']);

                _.forEach(sortedPlayerIronSpaces, function (pcs) {
                    if (neededIron > consumedIron) {
                        let spaceConsumeData = {
                            locationid: l.id,
                            locationname: l.name,
                            spaceid: pcs.id,
                            ironConsumed: 0,
                            willFlip: false
                        };
                        
                        for (let i=0; i < pcs.tile.availableIron; i++) {
                            if (neededIron > consumedIron) {
                                spaceConsumeData.ironConsumed = spaceConsumeData.ironConsumed + 1;
                                consumedIron++;
                            }
                        }
                        spaceConsumeData.willFlip = (spaceConsumeData.ironConsumed === pcs.tile.availableIron);
                        ironConsumption.push(spaceConsumeData);
                    }
                });

                _.forEach(sortedOpponentIronSpaces, function (ois) {
                    if (neededIron > consumedIron) {
                        let spaceConsumeData = {
                            locationid: l.id,
                            locationname: l.name,
                            spaceid: ois.id,
                            ironConsumed: 0,
                            willFlip: false
                        };
                        
                        for (let i=0; i < ois.tile.availableIron; i++) {
                            if (neededIron > consumedIron) {
                                spaceConsumeData.ironConsumed = spaceConsumeData.ironConsumed + 1;
                                consumedIron++;
                            }
                        }
                        spaceConsumeData.willFlip = (spaceConsumeData.ironConsumed === ois.tile.availableIron);
                        ironConsumption.push(spaceConsumeData);
                    }
                });
            });

            // whatever is left take from market
            if (neededIron > consumedIron) {
                let spaceConsumeData = {
                    locationid: -1,
                    locationname: 'Iron Market',
                    spaceid: -1,
                    ironConsumed: 0,
                    willFlip: false
                }
                for (let i=0; i <= neededIron - consumedIron; i++) {
                    spaceConsumeData.ironConsumed = spaceConsumeData.ironConsumed + 1;
                    consumedIron++;
                }
                ironConsumption.push(spaceConsumeData);
            }

            return ironConsumption;
        },
        generateAIBeerConsumption: function (locationids, player_type, neededBeer, marketsWithTiles) {
            // for: Sell, step 2

            let beerLocations = [];
            let usedBeer = 0;
            // start with merchant beer (using matching industry types)
            _.forEach(marketsWithTiles, function (m) {
                if (usedBeer < neededBeer && m.space.tile.totalBeer > 0) {
                    beerLocations.push({
                        locationid: m.market.id,
                        name: m.market.name + ' (Merchant)',
                        spaceid: m.space.id + 1,
                        beerAvailable: m.space.tile.totalBeer,
                        beerConsumed: 1,
                        id: m.market.id + '-' + m.space.id,
                        isMerchant: true,
                        bonus: m.market.bonus,
                        bonusType: m.market.bonusType
                    });
                    usedBeer = usedBeer + 1;
                }
            });

            if (usedBeer < neededBeer) {
                // continue with player and opponent beer (connected or not, closest to flipping first)
                let playerUnflippedBreweries = this.findPlayerUnflippedBreweries(player_type);
                
                _.forEach(playerUnflippedBreweries, function (l) {
                    _.forEach(l.beerspaces, function (bs) {
                        if (usedBeer < neededBeer) {
                            let beerConsumed = 1;

                            if (bs.tile.availableBeer === 2 && (neededBeer - usedBeer > 1)) {
                                beerConsumed = 2;
                            }

                            beerLocations.push({
                                locationid: l.id,
                                name: l.name,
                                spaceid: bs.id + 1,
                                beerAvailable: bs.tile.availableBeer,
                                beerConsumed: beerConsumed,
                                id: l.id + '-' + bs.id
                            });
                            usedBeer = usedBeer + beerConsumed;
                        }
                    });
                });
            }

            if (usedBeer < neededBeer) {
                // continue with opponent beer (connected, furthest from flipping first)
                let connectedOpponentBeerLocations = this.findOpponentConnectedBeer(locationids, player_type);

                _.forEach(connectedOpponentBeerLocations, function (l) {
                    _.forEach(l.beerspaces, function (bs) {
                        if (usedBeer < neededBeer) {
                            let beerConsumed = 1;

                            if (bs.tile.availableBeer === 2 && (neededBeer - usedBeer > 1)) {
                                beerConsumed = 2;
                            }

                            beerLocations.push({
                                locationid: l.id,
                                name: l.name,
                                spaceid: bs.id + 1,
                                beerAvailable: bs.tile.availableBeer,
                                beerConsumed: beerConsumed,
                                id: l.id + '-' + bs.id
                            });
                            usedBeer = usedBeer + beerConsumed;
                        }
                    });
                });
            }

            return beerLocations;
        },
        findPlayerUnflippedBreweries: function (player_type) {
            let player = this.getPlayerFromType(player_type);
            let playerUnflippedBreweryLocations = [];

            _.forEach(this.board.locations, function(o) {
                let beerSpaces = _.filter(o.spaces, function(p) {
                    if (p.tile) {
                        return p.tile.industrytype === INDUSTRY.Brewery && p.tile.availableBeer > 0 && p.tile.color === player.color;
                    }
                    return false;
                });

                if (beerSpaces.length > 0) {
                    o.beerspaces = beerSpaces;
                    playerUnflippedBreweryLocations.push(o);
                }
            });

            return playerUnflippedBreweryLocations;
        },
        findPlayerUnflippedCoalMines: function (player_type) {
            let player = this.getPlayerFromType(player_type);
            let playerUnflippedCoalMineLocations = [];

            playerUnflippedCoalMineLocations = _.filter(this.board.locations, function(o) {
                let coalSpaces = _.find(o.spaces, function(p) {
                    if (p.tile) {
                        return p.tile.industrytype === INDUSTRY.CoalMine && p.tile.availableCoal > 0 && p.tile.color === player.color;
                    }
                    return false;
                });
                return coalSpaces;
            });

            return playerUnflippedCoalMineLocations;
        },
        findPlayerUnflippedIronWorks: function (player_type) {
            let player = this.getPlayerFromType(player_type);
            let playerUnflippedIronWorksLocations = [];

            playerUnflippedIronWorksLocations = _.filter(this.board.locations, function(o) {
                let ironSpaces = _.find(o.spaces, function(p) {
                    if (p.tile) {
                        return p.tile.industrytype === INDUSTRY.IronWorks && p.tile.availableIron > 0 && p.tile.color === player.color;
                    }
                    return false;
                });
                return ironSpaces;
            });

            return playerUnflippedIronWorksLocations;
        },
        // end: Eliza consumption support

        // -- Human player consumption support
        findAllConnectedCoal: function (locationids, player_type) {
            let locationid = null;
            if (locationids && !locationids.length) {
                locationid = locationids;
            }

            let connectedLocations = [];

            if (!locationids.length) {
                connectedLocations = this.findAllConnectedLocations(locationids, player_type, NEEDSCONNECTIONTYPE.Coal);
            } else {
                // Support looking for coal from either end of a placed link(s). Note that for a double network action,
                // this may allow consuming both coal at one link, even if the coal is not connected to the second link.
                // We may want to fix this in the future but for now it's up to the human player to only select legal
                // coal sources for consumption.
                let self = this;
                connectedLocations = _.uniqBy(_.flatMap(locationids, function(lid) {
                    return self.findAllConnectedLocations(lid, player_type, NEEDSCONNECTIONTYPE.Coal);
                }), "id");
            }

            let connectedCoalLocations = [];

            if (connectedLocations && connectedLocations.length > 0) {
                _.forEach(connectedLocations, function(o) {
                    let coalSpaces = _.filter(o.spaces, function(p) {
                        if (p.tile) {
                            return p.tile.industrytype === INDUSTRY.CoalMine && p.tile.availableCoal > 0;
                        }
                        return false;
                    });

                    if (coalSpaces && coalSpaces.length > 0) {
                        o.coalspaces = coalSpaces;
                        connectedCoalLocations.push(o);
                    }
                });
           }

           let groupedConnectedLocations = _.groupBy(connectedCoalLocations, 'distance');
           return groupedConnectedLocations;
        },
        findAllUnflippedIronWorks: function () {
            let playerIronWorksLocations = [];

            _.forEach(this.board.locations, function(o) {
                let ironSpaces = _.filter(o.spaces, function(p) {
                    if (p.tile) {
                        return p.tile.industrytype === INDUSTRY.IronWorks && p.tile.availableIron > 0;
                    }
                    return false;
                });

                if (ironSpaces && ironSpaces.length > 0) {
                    o.ironspaces = ironSpaces;
                    playerIronWorksLocations.push(o);
                }
            });

            return playerIronWorksLocations;
        },
        findOpponentConnectedBeer: function (locationids, player_type) {
            let locationid = null;
            if (locationids && !locationids.length) {
                locationid = locationids;
            }

            let connectedLocations = [];

            if (locationids && !locationids.length) {
                connectedLocations = this.findAllConnectedLocations(locationids, player_type, NEEDSCONNECTIONTYPE.Beer);
            } else {
                // support looking for beer from either end of a placed link and for multiple sell locations
                let allLocations = [];
                for (let i=0;i<locationids.length;i++) {
                    let connectedLocations1 = this.findAllConnectedLocations(locationids[i], player_type, NEEDSCONNECTIONTYPE.Beer);
                    allLocations = _.union(connectedLocations1, allLocations)
                }

                connectedLocations = _.uniqBy(allLocations, "id");
            }

            let player = this.getPlayerFromType(player_type);
            let connectedOpponentBeerLocations = [];

            if (connectedLocations && connectedLocations.length > 0) {
                _.forEach(connectedLocations, function(o) {
                    let beerSpaces = _.filter(o.spaces, function(p) {
                        if (p.tile) {
                            return p.tile.industrytype === INDUSTRY.Brewery && p.tile.availableBeer > 0 && p.tile.color !== player.color;
                        }
                        return false;
                    });

                    if (beerSpaces.length > 0) {
                        o.beerspaces = beerSpaces;
                        connectedOpponentBeerLocations.push(o);
                    }
                });
           }

           return connectedOpponentBeerLocations;
        },
        findConsumableBeer: function (locationids, player_type) {
            let locationid = null;
            if (locationids && !locationids.length) {
                locationid = locationids;
            }

            let consumableBeerLocations = [];

            // connected opponent beer
            let connectedOpponentBeerLocations = this.findOpponentConnectedBeer(locationids, player_type);

            // all player beer
            let playerUnflippedBreweries = this.findPlayerUnflippedBreweries(player_type);

            // union and unique select, getting all consumable beer locations
            consumableBeerLocations = _.uniqBy(_.union(playerUnflippedBreweries, connectedOpponentBeerLocations), 'id');

            return consumableBeerLocations;
        },
        // end: Human player consumption support

        // -- Supporting logical methods
        isLocationInNetwork: function (locationid, player_type) {
            let player = this.getPlayerFromType(player_type);
            let location = this.findLocationById(locationid);

            // check industries
            let playerIndustries = _.filter(location.spaces, function (p) {
                return p.tile !== null && p.tile !== undefined && p.tile.color === player.color;
            });
            if (playerIndustries && playerIndustries.length > 0) return true;

            // check links
            let edges = null;
            if (this.currentEra === ERA.Canal) {
                edges = location.edgesCanal;
            } else {
                edges = location.edgesRail;
            }

            let playerLinks = _.filter(edges, function (p) {
                return p.tile !== null && p.tile !== undefined && p.tile.color === player.color;
            });
            if (playerLinks && playerLinks.length > 0) return true;

            return false;
        },
        findAllLocationsInNetwork: function (player_type) {
            let player = this.getPlayerFromType(player_type);
            let locationsInPlayerNetwork = [];

            if (this.playerHasNoTilesOnBoard(player_type)) {
                locationsInPlayerNetwork = this.board.locations;
            } else {
                let self = this;
                _.forEach(this.board.locations, function (p) {
                    if (self.isLocationInNetwork(p.id, player_type)) {
                        locationsInPlayerNetwork.push(p);
                    }
                });
            }

            return _.uniqBy(locationsInPlayerNetwork, 'id');
        },
        playerHasNoTilesOnBoard: function (player_type) {
            let player = this.getPlayerFromType(player_type);
            let playerHasNoTiles = true;

            let self = this;
            _.forEach(this.board.locations, function (l) {
                if (l.type === LOCATIONTYPE.Industries) {

                    // check industry tiles
                    _.forEach(l.spaces, function (s) {
                        if (s.tile && s.tile.color === player.color) {
                            playerHasNoTiles = false;
                            return false;
                        }
                    });

                    if (playerHasNoTiles) {
                        // check links
                        let edges = [];
                        if (self.currentEra === ERA.Canal) {
                            edges = l.edgesCanal;
                        } else {
                            edges = l.edgesRail;
                        }

                        _.forEach(edges, function (e) {
                            if (e.tile && e.tile.color === player.color) {
                                playerHasNoTiles = false;
                                return false;
                            }
                        });
                    }
                }
            });

            return playerHasNoTiles;
        },
        findAdjacentIndustryLocationsForAI: function (locationid) {
            let location = this.findLocationById(locationid);
            let edges = [];
            let adjacentIndustryLocations = [];

            if (this.currentEra === ERA.Canal) {
                edges = location.edgesCanal;
            } else {
                edges = location.edgesRail;
            }

            let self = this;
            _.forEach(edges, function (e) {
                if (!(self.numberOfPlayers == '2' && e.toId < 8)) { // AI in two-player game ignores everything north of Stafford
                    let adjacentlocation = self.findLocationById(e.toId);

                    if (adjacentlocation.type === LOCATIONTYPE.Industries) {
                        adjacentIndustryLocations.push(adjacentlocation);
                    }
                }
            });

            return adjacentIndustryLocations;
        },
        findAdjacentIndustryLocationsForHumanNetwork: function () {

            let locationid = null;
            if (this.humanPlayer.actionStep === '53') {
                locationid = this.humanPlayer.nextAction.actiondata.networkfromlocationid2;
            } else {
                locationid = this.humanPlayer.nextAction.actiondata.networkfromlocationid;
            }

            let location = this.findLocationById(locationid);
            let edges = [];
            let adjacentIndustryLocations = [];

            if (this.currentEra === ERA.Canal) {
                edges = location.edgesCanal;
            } else {
                edges = location.edgesRail;
            }

            let self = this;
            _.forEach(edges, function (e) {
                let adjacentlocation = self.findLocationById(e.toId);

                if (!adjacentlocation.isSouthernFarm && !e.tile) {
                    adjacentIndustryLocations.push(adjacentlocation);
                }
            });

            return _.sortBy(adjacentIndustryLocations, 'name');
        },
        findAllPathsBetweenLocations: function (locationid1, targetlocationid, requireLinks, player_type) {
            // do a depth-first search to connect all locations
            // the resulting array of paths can then be used for various checks
            // this is and findAllPathsUtil is a fundamental function for all
            // other connection-related checks.
            // set "requireLinks" to true to only find paths with placed links (i.e. "connected")
            
            let visited = [locationid1];
            let paths = [];
            let path = [this.findLocationById(locationid1)];
            let pathFound = [false]; // want by reference
            path.numberOfLinks = 0;
            path.hasOnlyPlayerLinks = true;

            this.findAllPathsUtil(locationid1, targetlocationid, visited, paths, path, requireLinks, player_type, pathFound);

            // sort shortest paths to the top
            let sortedPaths = _.sortBy(paths, function(a) {
                return a.length;
            });

            // include distance between nodes
            _.forEach(sortedPaths, function (p) {
                p.distance = p.length - 1;
            });

            /*console.log({
                locationid: locationid1,
                targetlocid: targetlocationid,
                length: sortedPaths.length,
                paths: sortedPaths
            });*/

            return sortedPaths;
        },
        findAllPathsUtil: function (locationid, targetlocationid, visited, paths, path, requireLinks, player_type, pathFound) {

            let player = this.getPlayerFromType(player_type);
            
            if (locationid === targetlocationid) {
                let clonedPath = _.cloneDeep(path);
                clonedPath.numberOfLinks = path.numberOfLinks;
                clonedPath.hasOnlyPlayerLinks = path.hasOnlyPlayerLinks;
                paths.push(clonedPath);

                if (requireLinks) { // if links are required (i.e. we are looking for connected locations) than the first path is the best one
                    pathFound[0] = true;
                }
            } else  {
                if (!pathFound[0]) {
                    let location = this.findLocationById(locationid);
                    let edges = [];

                    if (this.currentEra === ERA.Canal) {
                        edges = location.edgesCanal;
                    } else {
                        edges = location.edgesRail;
                    }

                    // optionally, only include edges with links placed on them
                    if (requireLinks) {
                        edges = _.filter(edges, function (e) {
                            return e.tile;
                        });
                    }

                    let self = this;
                    _.forEach(edges, function(e) { 
                        if (!(self.numberOfPlayers == '2' && player.player_type !== PLAYER_TYPE.Human && e.toId < 8)) { // AI in two-player game ignores everything north of Stafford
                            let edgeloc = self.findLocationById(e.toId);
                            if (!_.includes(visited, e.toId) && !edgeloc.isSouthernFarm) {
                                visited.push(e.toId);
                                path.push(edgeloc);

                                if (path.length > LONGESTCONNECTIONPATHTOSEARCH) {
                                    visited.pop();
                                    path.pop();
                                } else {
                                    if (e.tile) {
                                        path.numberOfLinks++;

                                        if (e.tile.color !== player.color) {
                                            path.hasOnlyPlayerLinks = false;
                                        }
                                    }

                                    self.findAllPathsUtil(e.toId, targetlocationid, visited, paths, path, requireLinks, player_type, pathFound);
                                    visited.pop();

                                    if (e.tile) {
                                        path.numberOfLinks--;
                                        if (e.tile.color !== player.color) {
                                            path.hasOnlyPlayerLinks = true;
                                        }
                                    }
                                    path.pop();
                                }
                            }
                        }
                    });
                }
            }
        },
        findAllConnectedLocations: function (locationid, player_type, needsConnectionType) {
            let connectedLocations = [];

            let self = this;

            let locations = [];

            if (needsConnectionType === NEEDSCONNECTIONTYPE.Coal) {
                // get all locations with coal
                locations = _.filter(this.board.locations, function(o) {
                    let coalSpaces = _.find(o.spaces, function(p) {
                        if (p.tile) {
                            return p.tile.industrytype === INDUSTRY.CoalMine && p.tile.availableCoal > 0;
                        }
                        return false;
                    });
                    return coalSpaces;
                });
            } else if (needsConnectionType === NEEDSCONNECTIONTYPE.Beer) {
                // get all locations with beer
                locations = _.filter(this.board.locations, function(o) {
                    let coalSpaces = _.find(o.spaces, function(p) {
                        if (p.tile) {
                            return p.tile.industrytype === INDUSTRY.Brewery && p.tile.availableBeer > 0;
                        }
                        return false;
                    });
                    return coalSpaces;
                });
            } else if (needsConnectionType === NEEDSCONNECTIONTYPE.Merchants) {
                // get all merchant locations
                locations = this.findAllMerchants();
            }

            _.forEach(locations, function (p) {
                let paths = self.findAllPathsBetweenLocations(locationid, p.id, true, player_type);
                if (paths && paths.length > 0) {
                    p.distance = paths[0].distance;
                    p.numberOfLinks = paths[0].numberOfLinks;
                    p.hasOnlyPlayerLinks = paths[0].hasOnlyPlayerLinks;
                    connectedLocations.push(p);
                }
            });

            // return closest locations, clockface tiebreaker
            return _.sortBy(_.uniqBy(connectedLocations, 'id'), 'distance', 'id');
        },
        findAllConnectedMarkets: function (locationid, player_type) {
            let connectedLocations = this.findAllConnectedLocations(locationid, player_type, NEEDSCONNECTIONTYPE.Merchants);
            let connectedMarketLocations = [];

            if (connectedLocations && connectedLocations.length > 0) {
                 connectedMarketLocations = _.filter(connectedLocations, function (p) {
                    return p.type === LOCATIONTYPE.Merchants;
                 });
            }

            return connectedMarketLocations;
        },
        isConnectedToMarket: function (locationid, player_type) {
            let isConnected = this.findAllConnectedMarkets(locationid, player_type).length > 0;
            return isConnected;
        },
        findLocationsByIndustry: function (industry) {
            // find locations that have a particular industry type
            return _.filter(this.board.locations, function(o) {
                let findSpaces = _.find(o.spaces, function(p) {
                    return _.includes(p.types, industry);
                });
                return findSpaces;
            });
        },
        findLocationById: function (id) {
            return _.find(this.board.locations, function(o) {
                return o.id === id;
            });
        },
        findPlayerBoardIndustryTileById: function(player_type, id) {
            let player = this.getPlayerFromType(player_type);

            return _.find(player.board, function (o) {
                return o.id === id;
            });
        },
        findNextTileFromPlayerBoard: function (player_type, industrytype) {
            let player = this.getPlayerFromType(player_type);

            let nextTile = _.find(player.board, function (t) {
                return t.industrytype === industrytype;
            });

            if (!nextTile) {
                return null;
            }

            if (!(this.currentEra === ERA.Rail && nextTile.canalOnly)) {
                return nextTile;
            } else {
                return null;
            }
        },
        findAllNextTilesFromPlayerBoard: function (player_type) {
            let allNextTiles = [];
            
            for (let i=0;i<6;i++) {
                let nextTile = this.findNextTileFromPlayerBoard(player_type, i);

                if (nextTile) {
                    allNextTiles.push(nextTile);
                }
            }

            let self = this;
            return _.sortBy(allNextTiles, function (t) {
                return self.tileToString(t);
            });
        },
        findDevelopableTilesFromPlayerBoard: function (player_type, industrytype) {
            let player = this.getPlayerFromType(player_type);

            let tiles = _.filter(player.board, function (t) {
                return t.industrytype === industrytype;
            });

            developabletiles = [];
            if (tiles && tiles.length > 0) {
                if (!tiles[0].cannotDevelop) {
                    developabletiles.push({
                        selected: false,
                        developabletile: tiles[0]
                    });

                    if (tiles.length > 1) {
                        if (!tiles[1].cannotDevelop) {
                            developabletiles.push({
                                selected: false,
                                developabletile: tiles[1]
                            });
                        }
                    }
                }
            }

            return developabletiles;
        },
        findAllNextDevelopableTilesFromPlayerBoard: function (player_type) {
            let allNextTiles = [];
            
            for (let i=0;i<6;i++) {
                let tileGroup = {
                    industrytype: i,
                    industrytypename: industryStringMap[i],
                    tiles: this.findDevelopableTilesFromPlayerBoard(player_type, i)
                };
                if (tileGroup.tiles.length > 0) {
                    allNextTiles.push(tileGroup);
                }
            }

            return allNextTiles;
        },
        findMainBoardIndustryTileById: function(locationid, tileid) {
            let self = this;
            let location = this.findLocationById(locationid);
            let space = _.find(location.spaces, function (s) {
                return s.tile && s.tile.id === tileid;
            });

            return space.tile;
        },
        findSpacesWithTiles: function (spaces) {
            return _.filter(spaces, function (s) {
                return s.tile;
            });
        },
        reportAdjacentLocations: function (locationid) {
            let location = this.findLocationById(locationid);

            let edges = [];
            let adjacentIndustryLocations = [];

            if (this.currentEra === ERA.Canal) {
                edges = location.edgesCanal;
            } else {
                edges = location.edgesRail;
            }

            let self = this;
            _.forEach(edges, function (e) {
                if (e.tile) {
                    let adjacentlocation = self.findLocationById(e.toId);
                    adjacentlocation.color = e.tile.color;
                    adjacentlocation.colorString = self.colorString(e.tile.color);
                    adjacentIndustryLocations.push(adjacentlocation);
                }
            });

            return adjacentIndustryLocations;
        },
        getPlayerFromType: function (player_type) {
            switch (player_type) {
                case PLAYER_TYPE.Human: return this.humanPlayer;
                case PLAYER_TYPE.Eliza_AI: return this.eliza;
                case PLAYER_TYPE.Eleanor_AI: return this.eleanor;
            }
        },
        getPlayerStringFromColor: function (color) {
            if (color === this.humanPlayer.color) {
                return 'Your';
            }

            if (color === this.eliza.color) {
                return 'Eliza';
            }

            if (color === this.eleanor.color) {
                return 'Eleanor';
            }
        },
        colorString: function (color) {
            return colorMap[color];
        },
        findCardById: function (id) {
            let card = _.find(CARDS, function(c) {
                return c.id === id;
            });

            return _.cloneDeep(card);
        },
        boardIndustryTileToString: function (locationid, tileid) {
            let tile = this.findMainBoardIndustryTileById(locationid, tileid);
            return this.tileToString(tile);
        },
        tileToString: function (tile) {
            return industryStringMap[tile.industrytype] + ' (Level ' + romanize(tile.level) + ')';
        },
        eraToString: function (tile) {
            return eraStringMap[this.currentEra];
        },
        boardIndustryTileToStringWithResources: function (locationid, tileid, includeTotalBeerOnMerchantTile) {
            let tile = this.findMainBoardIndustryTileById(locationid, tileid);
            let tilestring = '';

            if (tile.isMerchantTile) {

                if (tile.industryTypes) {

                    tilestring = tilestring + 'Merchant Tile [';

                    _.forEach(tile.industryTypes, function (i, index, arr) {
                        tilestring = tilestring + industryStringMap[i];

                        if (index !== arr.length - 1) {
                            tilestring = tilestring + ', ';
                        }
                    });

                    tilestring = tilestring + ']';

                    if (includeTotalBeerOnMerchantTile) {
                        tilestring = tilestring + ' (' + tile.totalBeer + ' beer left)';
                    }

                } else {
                    tilestring = tilestring + 'Merchant Tile (Empty)';
                }

            } else {

                tilestring = industryStringMap[tile.industrytype] + ' (Level ' + romanize(tile.level) + ')';

                if (tile.availableCoal > 0) {
                    tilestring = tilestring + ' | ' + tile.availableCoal + ' coal left';
                }

                if (tile.availableIron > 0) {
                    tilestring = tilestring + ' | ' + tile.availableIron + ' iron left';
                }

                if (tile.availableBeer > 0) {
                    tilestring = tilestring + ' | ' + tile.availableBeer + ' beer left';
                }

                tilestring = tilestring + (tile.flipped ? ' (Flipped!)' : ' (Unflipped)');

            }

            return tilestring;
        },
        // -- end Supporting logical methods

        getTotalMarketResourceCost: function (totalAmountConsumed, resourcetype) {
            let totalCost = 0;
            let emptyMarketSpaces = resourcetype === RESOURCETYPE.Coal ? this.totalEmptyMarketCoalSpaces : this.totalEmptyMarketIronSpaces;

            for (let i=0;i<totalAmountConsumed;i++) {
                if (emptyMarketSpaces >= 0 && emptyMarketSpaces <= 1) {
                    totalCost = totalCost + 1;
                }

                if (emptyMarketSpaces >= 2 && emptyMarketSpaces <= 3) {
                    totalCost = totalCost + 2;
                }

                if (emptyMarketSpaces >= 4 && emptyMarketSpaces <= 5) {
                    totalCost = totalCost + 3;
                }

                if (emptyMarketSpaces >= 6 && emptyMarketSpaces <= 7) {
                    totalCost = totalCost + 4;
                }

                if (emptyMarketSpaces >= 8 && emptyMarketSpaces <= 9) {
                    totalCost = totalCost + 5;
                }

                if (resourcetype === RESOURCETYPE.Iron) {
                    if (emptyMarketSpaces >= 10) {
                        totalCost = totalCost + 6;
                    }
                } else {
                    if (emptyMarketSpaces >= 10 && emptyMarketSpaces <= 11) {
                        totalCost = totalCost + 6;
                    }

                    if (emptyMarketSpaces >= 12 && emptyMarketSpaces <= 13) {
                        totalCost = totalCost + 7;
                    }

                    if (emptyMarketSpaces >= 14) {
                        totalCost = totalCost + 8;
                    }
                }

                emptyMarketSpaces++;
            }

            return totalCost;
        },
        toggleShowBoardState: function () {
            this.showBoardState = this.showBoardState ? false : true;
            return false;
        },
        reset: function () {
            this.numberOfPlayers = 2;
            this.gameHasStarted = false;
            this.useTurnOrder = false;
            this.soldInCanalEra = false;
            this.soldInRailEra = false;
            this.currentRound = 1;
            this.currentGameStep = GAME_STEPS.Setup;
            this.currentEra = ERA.Canal;
            this.currentPlayerType = PLAYER_TYPE.Human;
            this.board = _.cloneDeep(INITIAL_BOARD);
            this.humanPlayer = _.cloneDeep(HUMAN_PLAYER);
            this.eliza = _.cloneDeep(ELIZA);
            this.eleanor = _.cloneDeep(ELEANOR);
            this.showBoardState = false;
            this.finishedCanalScore = false;
            this.finishedRailScore = false;
            this.undoState = null;
            this.error = null;
            this.saveGameState();
        },
        newGame: function () {
            if (confirm('Are you sure you want to start a NEW GAME?')) { this.reset(); };
        },
        saveUndoState: function () {
            let undoState = {};
            undoState.numberOfPlayers = this.numberOfPlayers;
            undoState.gameHasStarted = this.gameHasStarted;
            undoState.useTurnOrder = this.useTurnOrder;
            undoState.soldInCanalEra = this.soldInCanalEra;
            undoState.soldInRailEra = this.soldInRailEra;
            undoState.currentRound = this.currentRound;
            undoState.currentGameStep = this.currentGameStep;
            undoState.currentEra = this.currentEra;
            undoState.currentPlayerType = this.currentPlayerType;
            undoState.board = _.cloneDeep(this.board);
            undoState.humanPlayer = _.cloneDeep(this.humanPlayer);
            undoState.eliza = _.cloneDeep(this.eliza);
            undoState.eleanor = _.cloneDeep(this.eleanor);
            undoState.showBoardState = this.showBoardState;
            undoState.finishedCanalScore = this.finishedCanalScore;
            undoState.finishedRailScore = this.finishedRailScore;
            undoState.undoState = null;
            this.undoState = undoState;
        },
        loadUndoState: function() {
            this.numberOfPlayers = this.undoState.numberOfPlayers;
            this.gameHasStarted = this.undoState.gameHasStarted;
            this.useTurnOrder = this.undoState.useTurnOrder;
            this.soldInCanalEra = this.undoState.soldInCanalEra;
            this.soldInRailEra = this.undoState.soldInRailEra;
            this.currentRound = this.undoState.currentRound;
            this.currentGameStep = this.undoState.currentGameStep;
            this.currentEra = this.undoState.currentEra;
            this.currentPlayerType = this.undoState.currentPlayerType;
            this.board = _.cloneDeep(this.undoState.board);
            this.humanPlayer = _.cloneDeep(this.undoState.humanPlayer);
            this.eliza = _.cloneDeep(this.undoState.eliza);
            this.eleanor = _.cloneDeep(this.undoState.eleanor);
            this.showBoardState = this.undoState.showBoardState;
            this.finishedCanalScore = this.undoState.finishedCanalScore;
            this.finishedRailScore = this.undoState.finishedRailScore;
            this.undoState = null;
            this.error = null;
            this.saveGameState();
        },
        undo: function () {
            if (confirm('Are you sure you want to UNDO?\nThis will take you back to the previous action\'s confirm screen.')) { this.loadUndoState(); }
        },
        saveGameState: function () {
            let gameState = {};
            gameState.numberOfPlayers = this.numberOfPlayers;
            gameState.gameHasStarted = this.gameHasStarted;
            gameState.useTurnOrder = this.useTurnOrder;
            gameState.soldInCanalEra = this.soldInCanalEra;
            gameState.soldInRailEra = this.soldInRailEra;
            gameState.currentRound = this.currentRound;
            gameState.currentGameStep = this.currentGameStep;
            gameState.currentEra = this.currentEra;
            gameState.currentPlayerType = this.currentPlayerType;
            gameState.board = this.board;
            gameState.humanPlayer = this.humanPlayer;
            gameState.eliza = this.eliza;
            gameState.eleanor = this.eleanor;
            gameState.showBoardState = this.showBoardState;
            gameState.undoState = this.undoState;
            gameState.finishedCanalScore = this.finishedCanalScore;
            gameState.finishedRailScore = this.finishedRailScore;
            gameState.error = this.error;
            
            localStorage.setItem(LOCALSTORAGENAME, LZString.compress(JSON.stringify(gameState)));
        },


        debugSetupTestBoard: function () {            
            // SCENARIO: Connected to Eliza's beer
            /*this.layIndustryTile(PLAYER_TYPE.Eliza_AI, 18, 16, 1); // beer on Walsall
            this.layIndustryTile(PLAYER_TYPE.Human, 18, 14, 0); // beer on Coalbrookdale
            this.layNetworkTile(PLAYER_TYPE.Human, 16, 15);
            this.layNetworkTile(PLAYER_TYPE.Human, 15, 14);
            this.layNetworkTile(PLAYER_TYPE.Human, 14, 13);
            this.layIndustryTile(PLAYER_TYPE.Human, 34, 15, 0); // Manufacturing on Wolverhampton */
            // END SCENARIO

            // SCENARIO: Connected to Eliza's beer after double link (assumes 2nd era)
            /*
            this.layIndustryTile(PLAYER_TYPE.Eliza_AI, 18, 16, 1); // beer on Walsall
            this.layIndustryTile(PLAYER_TYPE.Human, 18, 14, 0); // beer on Coalbrookdale
            this.layNetworkTile(PLAYER_TYPE.Human, 14, 13);
            this.layIndustryTile(PLAYER_TYPE.Human, 34, 15, 0); // Manufacturing on Wolverhampton
            */
            // END SCENARIO

            // SCENARIO: Eliza connected to player beer, merchant doesn't have beer, and Eliza sells on first turn
            /*
            // first, clear merchant beer
            let self = this;
            let merchantTiles = _.shuffle(_.filter(MERCHANT_TILES, function (t) {
                return t.minPlayers <= self.numberOfPlayers;
            }));
            let merchantLocationIds = this.getMerchantLocationIds();

            _.forEach(merchantLocationIds, function (id) {
                let location = self.findLocationById(id);

                // lay merchant tile
                _.forEach(location.spaces, function (s) {
                    let merchantTile = merchantTiles.shift();
                    s.tile = merchantTile;

                    if (merchantTile.industryTypes) {
                        s.tile.totalBeer = 0;
                    }
                });
            });

            // make all cards industry cards 
            _.forEach(CARDS, function (c) {
                c.locationid = null;
            });

            // needs to be at least round 5 for Eliza to sell
            this.currentRound = 5;

            // setup board
            this.layIndustryTile(PLAYER_TYPE.Human, 18, 16, 1); // beer on Walsall
            //this.layIndustryTile(PLAYER_TYPE.Eliza_AI, 18, 14, 0); // beer on Coalbrookdale
            this.layNetworkTile(PLAYER_TYPE.Eliza_AI, 16, 15);
            this.layNetworkTile(PLAYER_TYPE.Eliza_AI, 15, 14);
            this.layNetworkTile(PLAYER_TYPE.Eliza_AI, 14, 13);
            this.layIndustryTile(PLAYER_TYPE.Eliza_AI, 38, 15, 0); // Manufacturing on Wolverhampton
            */
            // END SCENARIO

            // SCENARIO: Eliza has 14 network tiles on the board
            /*
            this.layNetworkTile(PLAYER_TYPE.Human, 13, 14);
            this.layNetworkTile(PLAYER_TYPE.Human, 14, 15);
            this.layNetworkTile(PLAYER_TYPE.Human, 15, 16);
            this.layNetworkTile(PLAYER_TYPE.Human, 16, 19);
            this.layNetworkTile(PLAYER_TYPE.Human, 12, 19);
            this.layNetworkTile(PLAYER_TYPE.Human, 20, 19);
            this.layNetworkTile(PLAYER_TYPE.Human, 24, 19);
            this.layNetworkTile(PLAYER_TYPE.Human, 25, 19);
            this.layNetworkTile(PLAYER_TYPE.Human, 14, 21);
            this.layNetworkTile(PLAYER_TYPE.Human, 25, 21);
            this.layNetworkTile(PLAYER_TYPE.Human, 11, 16);
            this.layNetworkTile(PLAYER_TYPE.Human, 11, 8);
            this.layNetworkTile(PLAYER_TYPE.Human, 4, 8);
            this.layNetworkTile(PLAYER_TYPE.Eliza_AI, 4, 1);
            */
            // END SCENARIO

            // SCENARIO: Double network from disconnected locations that both have access to coal.
            // It should be possible to perform a double network action placing a link from Dudley
            // and another link from Burton-on-Trent, consuming coal from the respective starting
            // spots.
            /*
            this.setupRailEra();
            this.layIndustryTile(PLAYER_TYPE.Human, 1, 18, 0);  // One coal in Dudley
            this.findLocationById(18).spaces[0].tile.availableCoal = 1;

            this.layIndustryTile(PLAYER_TYPE.Human, 2, 9, 0);  // Coal in Burton-on-Trent
            this.layIndustryTile(PLAYER_TYPE.Human, 18, 9, 1);  // Beer in Burton-on-Trent
            */
            // END SCENARIO
        },
        // --- BEGIN: may not truly need these ---
        /*
        findCoalClosestToFlipping: function (locationid, player_type) {
            let connectedCoalLocations = this.findAllConnectedCoal(locationid, player_type);
            let player = this.getPlayerFromType(player_type);

            let closestToFlippingLocationId = null;
            let closestToFlippingSpaceId = null;
            let closestToFlippingColor = null;
            let tempAvailableCoal = null;
            let location = null;
            _.forEach(connectedCoalLocations, function (c) {
                _.forEach(c.spaces, function (s) {
                    if (s.tile && s.tile.industrytype === INDUSTRY.CoalMine && s.tile.availableCoal > 0) {
                        if (!tempAvailableCoal) {
                            tempAvailableCoal = s.tile.availableCoal;
                            closestToFlippingLocationId = c.id;
                            closestToFlippingSpaceId = s.id;
                            closestToFlippingColor = s.tile.color;
                        } else {
                            if (s.tile.availableCoal < tempAvailableCoal) {
                                tempAvailableCoal = s.tile.availableCoal;
                                closestToFlippingLocationId = c.id;
                                closestToFlippingSpaceId = s.id;
                                closestToFlippingColor = s.tile.color;
                            }

                            // player's coal wins tie breaks
                            if (s.tile.availableCoal === tempAvailableCoal) {
                                if (s.tile.color === player.color && closestToFlippingColor !== player.color) {
                                    tempAvailableCoal = s.tile.availableCoal;
                                    closestToFlippingLocationId = c.id;
                                    closestToFlippingSpaceId = s.id;
                                }
                            }
                        }
                    }
                });
            });

            if (closestToFlippingLocationId) {
                location = this.findLocationById(closestToFlippingLocationId);
            }

            return {
                closestToFlippingLocation: location,
                closestToFlippingSpaceId: closestToFlippingSpaceId
            }
        },
        findBeerClosestToFlipping: function (locationid) {
            let connectedBeerLocations = this.findAllConnectedBeer(locationid);

            let closestToFlippingLocationId = null;
            let closestToFlippingSpaceId = null;
            let tempAvailableBeer = null;
            let location = null;
            _.forEach(connectedBeerLocations, function (c) {
                _.forEach(c.spaces, function (s) {
                    if (s.tile && s.tile.industrytype === INDUSTRY.Brewery && s.tile.availableBeer > 0) {
                        if (!tempAvailableBeer) {
                            tempAvailableBeer = s.tile.tempAvailableBeer;
                            closestToFlippingLocationId = c.id;
                            closestToFlippingSpaceId = s.id;
                        } else {
                            if (s.tile.availableBeer < tempAvailableBeer) {
                                tempAvailableBeer = s.tile.availableBeer;
                                closestToFlippingLocationId = c.id;
                                closestToFlippingSpaceId = s.id;
                            }
                        }
                    }
                });
            });

            if (closestToFlippingLocationId) {
                location = this.findLocationById(closestToFlippingLocationId);
            }

            return {
                closestToFlippingLocation: location,
                closestToFlippingSpaceId: closestToFlippingSpaceId
            }
        }
        */
        // --- END: may not truly need these ---
    }
});