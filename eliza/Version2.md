I have a major project for you.

In the sub-folder Eliza you will work. There is all the information you need between data.js and the board.jpg, cardcounts.webp, and playerboard.webp as well as the rulebook in the root of the Eliza folder.

The UX of this web app to play solo (on a physical board while entering your moves into the web app) is perfect. It's accessible and clear.

What we need is entirely new guts.

GOAL
For the AI player(s) to follow the exact same rules as a human. We want the experience of playing Brass: Birmingham to be just like playing a human.

CHALLENGES / APPROACH
I believe the core challenge is *balance*. The game is balanced by the cards used per number of players.

The problem is the human player(s) have a physical deck, which is separate from the AI deck. So the balance is off. 

This is solved currently via randomness and custom rules for the AI.

In order for the AI to work, it needs to make good decisions but limited by the appropriate probabilities.

I wonder if, for example, one change needs to be that not only the human player says what they did but which card they used to do it (the current app just asks what they did) as there is a small set of possible cards for each action (except for the action that allows for any card). But that isn't really necessary it would be better because it adds less overhead and clicks to the turn.

Ultimately we're building an engine to make good decisions and have good "moments" of this game. Moments of interaction (negative and positive).

MOMENTS
The real goal of any app like this (any solo board game AI) is to mimic the best of player interaction. With Brass: Birmingham that's things like someone using your resource which helps you, or using a resource you needed which hurts you.

Making choices of how much to spend to change turn order as well, and especially driving up the income track to allow for bigger moves.

RESEARCH
Do research on Brass: Birmingham tips and strategies. We don't want to hammer one strategy but play broadly well.

TESTING
We need a test harness for two AIs to play against each other and see how many "moments" of player interaction and influence happen and general score ranges.

This needs to be headless and able to produce lots of data to tune the AIs quickly. Play, tune, play, tune, etc.

MANUAL TESTING
Here's a bigger lift. I want a player to be able to play only from the phone (no board). That would be a special mode from the start of the game. We can't use any of the game's assets and it needs to be extremely mobile friendly. But you play against the AI in the same way, but you can see a map, see your board in some way, and your hand of cards, and your income and points, and choose your card to pay your action.

RULES
Brass: Birmingham has a number of careful rules. Iron, coal, beer. Be sure you understand them. 

Build your model of the game first. Understand your approach. 

Save-as-you-go in markdown files in a sub-folder so you can return and continue if we run out of tokens.

I believe in your as an amazing game AI creator and board game solo AI expert.

Let's go!!!!!!!