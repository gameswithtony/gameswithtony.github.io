const MISSION_A = 'A';
const MISSION_B = 'B';
const MISSION_C = 'C';
const ORBITAL = 0;
const COLONY = 1;
const LOCALSTORAGENAME = 'onmarsgamestate';

function createCard(action, travel, mission) {
    return {
        action: action,
        travel: travel,
        mission: mission
    };
}

const soloDeck = [
    createCard(1, true, MISSION_A),
    createCard(1, true, MISSION_B),
    createCard(1, true, MISSION_B),
    createCard(1, true, MISSION_C),
    createCard(1, false, MISSION_C),
    createCard(2, true, MISSION_A),
    createCard(2, false, MISSION_A),
    createCard(2, true, MISSION_B),
    createCard(2, true, MISSION_C),
    createCard(3, true, MISSION_A),
    createCard(3, false, MISSION_B),
    createCard(3, true, MISSION_C)
];

var app = new Vue({
    el: '#onmars',
    data: {
      isDisabledButton: false,
      currentDeck: soloDeck,
      currentCard: soloDeck[0],
      showMission: false,
      currentSide: ORBITAL,
      tempSide: ORBITAL,
      showReference: false,
      showLacerdaRules: true,
      showPathfinderRules: true
    },
    mounted: function() {
        if (localStorage.getItem(LOCALSTORAGENAME)) {
            let gameState = JSON.parse(localStorage.getItem(LOCALSTORAGENAME));
            this.currentDeck = gameState.currentDeck;
            this.currentCard = gameState.currentCard;
            this.showMission = gameState.showMission;
            this.currentSide = gameState.currentSide;

            if (gameState.showLacerdaRules !== undefined && gameState.showLacerdaRules !== null) this.showLacerdaRules = gameState.showLacerdaRules;
            if (gameState.showPathfinderRules !== undefined && gameState.showPathfinderRules !== null) this.showPathfinderRules = gameState.showPathfinderRules;
        }
        else {
            this.reset();
        }
    },
    computed: {
        cardsLeft: function() {
            if (this.currentDeck.length > 0) {
                return this.currentDeck.length + " left";
            }
            return "Reshuffle";
        },
        gameHasNotStarted: function () {
            return this.currentDeck.length === 12 && !this.showMission;
        }
    },
    methods: {
      shuffle: function() {
        this.currentDeck = _.shuffle(soloDeck);
        this.saveGameState();
      },
      draw: function() {
          if (this.isDisabledButton) return;
          this.isDisabledButton = true;

          this.currentSide = this.tempSide;
          if (this.currentDeck.length === 0) {
              this.shuffle();
              this.showMission = true;
          }
          this.currentCard = this.currentDeck.shift();
          this.saveGameState();

          setTimeout(() => {
            this.isDisabledButton = false;
          }, 1000);
      },
      reset: function() {
          this.showMission = false;
          this.shuffle();
      },
      setSide: function(side) {
          if (this.gameHasNotStarted) {
            this.currentSide = side;
            this.tempSide = this.currentSide;
            this.saveGameState();
          } else {
              this.tempSide = side;
          }
      },
      turnOrderSpace: function() {
          if (!this.currentCard.travel) {
              return 4;
          }
          else {
              return this.currentCard.action;
          }
      },
      saveGameState: function() {
        let gameState = {};
        gameState.currentDeck = this.currentDeck;
        gameState.currentCard = this.currentCard;
        gameState.showMission = this.showMission;
        gameState.currentSide = this.currentSide;
        gameState.showLacerdaRules = this.showLacerdaRules;
        gameState.showPathfinderRules = this.showPathfinderRules;
        localStorage.setItem(LOCALSTORAGENAME, JSON.stringify(gameState));
      },
      actionImage: function (rule) {
          if (this.currentSide === ORBITAL) {
                switch (this.currentCard.action) {
                    case 1:
                        return rule ? "obtainblueprint.png" : this.getImage("obtainblueprint");
                        break;
                    case 2:
                        return rule ? "learnnewtechnology.png" : this.getImage("learnnewtechnology");
                        break;
                    case 3:
                        return rule ? "researchanddevelopment.png" : this.getImage("researchanddevelopment");
                        break;
                }
          }

          if (this.currentSide === COLONY) {
                switch (this.currentCard.action) {
                    case 1:
                        return rule ? "constructabuilding.png" : this.getImage("constructabuilding");
                        break;
                    case 2:
                        return rule ? "upgradeabuilding.png" : this.getImage("upgradeabuilding");
                        break;
                    case 3:
                        return rule ? "hireascientist.png" : this.getImage("hireascientist");
                        break;
                }
          }
      },
      showReferenceModal: function () {
        this.showReference = true;
      },
      hideReferenceModal: function () {
        this.showReference = false;
        this.saveGameState();
      },
      hexDirImage: function () {
          if (!this.currentCard.travel) {
              return this.getImage("bt-rl");
          }
          else {
              switch (this.currentCard.action) {
                  case 1:
                      return this.getImage("tb-lr");
                      break;
                  case 2:
                      return this.getImage("tb-rl");
                      break;
                  case 3:
                      return this.getImage("bt-lr");
                      break;
              }
          }
      },
      getImage: function (name) {
        return 'data:image/png;base64,' + IMAGES[name];
      }
    }
});