I have a major game project for you.

I want to implement Vital Lacerda's On Mars as a mobile-friendly game engine. 

This will be a challenge as it is a very complex game with lots of things to look at on the board and player board and scientist board.

The resources folder gives you what you need to start.

## Resources
The images subfolder within the resources folder contains all the assets that were used in putting the game on Tabletop Simulator. Many file names are opaque but I've renamed a few like the game and player boards. 

You will need to examine them carefully and cross-examine with the reference book PDF to determine all the pieces and their values in the game.

*Create a reference markdown file listing every piece in the game, it's use, and values*.

There is also the rulebook which is coupled with an errata notes file.

*Create a markdown rules reference file.*

## AI
You will be implementing the exact Pathfinder solo mode from the Pathfinder PDF along with errata markdown. So you don't need to design an AI. We just need to have the AI play the rules from Pathfinder.

*Create a Pathfinder rules reference file*.

## Art and Style
Do not use ANY of the official art. Instead use the game in the "oppy" folder as inspiration for an art direction as well as dealing with a hexagonal board with pan and zoom in/out.

## UX
The real challenge here will be the UI. It needs to be *extremely* mobile-friendly. 

Look at the folders for eliza and mc especially to see ways to handle complex situations that are mobile-friendly. But the desktop should work great too.

On Mars playing solo means you're always on one side of the board or the other, but you need to be able to review/see what's on the other side. So I think there should be a constant presence of the shuttle to see when it's about to leave, but you focus on the side you're on. Then you can switch to the other side to see what's going on over there.

We need to be very text-low. Not much text. Mostly iconography and numbers. Very very clear iconography. But not the real iconography or graphics. Again look at oppy for ideas and extrapolate from there.

*Stay color-blind friendly on color choices. Never just rely on color for distinction. Always accompanied by icons or text (text only when absolutely needed)*.

The player board and the rest can work as popups like Eliza works. There may be a need for more text in some of those popups for mobile-friendliness, just be judicious about it.

Games should be saved in local storage as-you-go and support multiple undo steps, along with a move history, you should be able to start a new game with a confirm, grab your game state and share it (like Eliza) for bug reporting and load that game state (a secret admin URL).

## Goal
A player can, on their phone, play On Mars against the Pathfinder solo bot. They can clearly see all the decision space information. It's ok if there are clicks, but information must be clear.

However the desktop experience should take advantage of whatever space is available. That should be a great experience too.

In the end, be relentlessly focused on great UX for a player to understand the information and take actions.

Be a great UX designer, board game designer and enthusiast, and graphic designer.