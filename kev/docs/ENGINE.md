# KEV engine notes

KEV plays the official solo mode (Reference Book pp 2-5) as `/kanbanev/` implements it. `/kanbanev/` told you what each Colleague does; KEV carries it out, so every placement, pick and tie-break the helper left to you needs a rule. This file lists those rules, and every value read off an image rather than text.

## Engine interpretations (for Tony to approve)

1. **Colleague Parts on the start space score 2.** The Upgrade Value track's first space is unlabelled; the Reference Book says Colleague Parts score "2 to 6 PP".
2. **Performance Goal 30 counts Parts Vouchers.** The card shows the Voucher icon; the Reference Book text says "Part".
3. **The basic 5th-garage tile gives all four** (Voucher, Speech token, Book, Banked Shift). Its icons are split by a plus sign.
4. **End-of-day Recycling runs every day** (Reference Book "End of day"). `/kanbanev/` only drew that Selection card when Sandra reached her desk. *Disagreement with /kanbanev/.*
5. **Colleagues place one Speech token per Meeting turn**, in Certification order, and pass when out of tokens or cards.
6. **Goals you play in a Meeting join the table to the right** of the room's four. Mr Lacerda reads left to right, Mr Turczi right to left.
7. **Nice Sandra keeps the solo start of 15 PP.** The variant says 0; the solo setup says 15.
8. **A Colleague's Demand bonus (+1 PP) needs a token on the Demand tile.**
9. **Colleague upgrade space:** highest PP, then Banked Shift, then Book, then blank; leftmost on ties (`/kanbanev/` text).
10. **Mr Turczi's claim tie** (two cars of the best Model): the one closest to the Pace Car.
11. **A Colleague's Upgrade is lost** if the shared stack is empty or its Part is out of the supply; the tile stays on top.
12. **Colleague Assembly:** a Selection Part missing from the supply draws the next Part. If no car can take the Part, the action is lost (Reference Book).
13. **Colleague Collect:** a Part with no warehouse stock draws the next Part; lost only when every warehouse is empty.
14. **Colleague Design column:** they take whatever tiles are in it. Taking the last tile of a First Office stack refills it from the Central stack (as for Advanced Design).
15. **Certified Mr Lacerda in Design** takes the Central stack's top tile after the two column tiles.
16. **Occupied workstations** include workers who have not moved yet that day (as `/kanbanev/`).
17. **Final Goal tokens are spent automatically** on met achievements, highest first (each is worth 6 to 8 PP; a kept token is worth 1).
18. **Generic Speech tokens beside your board swap in automatically** after a Meeting.
19. **Speedcharger ability 1** still costs the Upgrade's Shift; it only supplies the Part, once per R&D visit.
20. **Special garage tiles that act "in a future turn"** unlock from your next turn after parking in garage 5. Train-in-2 and take-a-Design are free actions in any department; take-a-Design uses the display (with its column bonus).
21. **Delayed Tuning:** the 5th-garage tile still pays out when you park there.
22. **Without The Planner** you may park in any empty garage (garage order matters for Performance Goals 19 to 21).
23. **Your starting Certification benefit** is usable on day 1.
24. **The special Speech-token tile** holds one of your tokens; it works like a board token in a Meeting, then goes beside your board.
25. **Forced Overtime with no Banked Shifts** does nothing.
26. **Keeping Up** (difficulty 8) scores once per End of Week; the log credits it to Mr Lacerda.
27. **A Colleague first to Expert** scores 1 PP for the Speech token (if still there) and 3 PP for being first.
28. **Performance Goal 32** counts the tokens left on your board after the one being placed.

## Read off images, not text

- Test track (3-player overlay, solo): 8 spaces, striped spaces opposite each other, so a Meeting every 4 Pace Car moves.
- Upgrade Value track: unlabelled start, then 2, 3, 4, 5, 6.
- Upgrade spaces (top row, bottom row). City: Shift ×3; 4 PP, 3 PP, Book. SUV: Shift ×2, blank; 3 PP, 2 PP, Book. Truck: Shift ×2, blank; 2 PP, blank, Book. Sports: Shift, blank ×2; 1 PP, blank, Book. Concept: Shift, blank ×2; blank ×2, Book.
- Assembly: rows Concept, SUV, City, Truck, Sports; 4, 3, 3, 3, 4 assembly spaces; exits 1, 2, 1 PP; vertical conveyors point toward the middle row.
- Kanban cards: three rows of two; row one the pair, row two always Drivetrain + Motor (the 12 cards are in `js/data.js`).
- Workstations: 2 and 3 Shifts; Admin 1 and 2.
- Certification track benefits by section (in `js/data.js`).
- Player board: 4 desk spaces, 5 storage spaces, 4 Speech slots, each +1 with Design, Logistics, Admin certification.
- Design display: columns 3 and 4 give a Banked Shift and a Book.
- Garage tiles. Basic: Speech token, 2 Shifts, 2 Books, 2 Vouchers, 5th: all four. Expert: nothing, Book, Shift, Voucher, 5th: Speech token.
- Award tiles: 5 each of Book, 2 PP, Banked Shift, Parts Voucher.
- Factory Goals: 2, 3, 4, 5 in each group (cars, Upgraded Designs, certifications).
- Demand tokens: City 3, SUV 3, Truck 2, Sports 1, Concept 1.

## Testing

- `node --test tests/*.test.js`: rules tests.
- `node sim/run.js [games] [seed] [builder|random]`: random play with invariants after every answer (parts and cars conserved, caps, one worker per workstation, no duplicate Designs). Add `fire` as a 5th argument to allow firing; by default the sim plays on below 0 PP so it reaches the end.
- `node sim/explain.js [games]`: builds the explanation for every legal answer and data point.
- `node dev/contrast.js`: WCAG AA check of the theme tokens, both themes.
