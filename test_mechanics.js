
const { PotManager, HandEvaluator, Card, Deck, SUITS, RANKS, RANK_VALUES } = require('./game-engine.js');
const { BotPersonality, BotDecisionEngine, BOT_PERSONALITIES } = require('./bot-ai.js');

// Make them global so main.js can find them (since it's written for browser)
global.Deck = Deck;
global.PotManager = PotManager;
global.BotPersonality = BotPersonality;
global.BotDecisionEngine = BotDecisionEngine;
global.BOT_PERSONALITIES = BOT_PERSONALITIES;

// Now require main.js
const { TexasHoldemGame, Player, GAME_STATES, PLAYER_ACTIONS } = require('./main.js');

// Mock event callback to log events
function eventLogger(event, data) {
    if (event === 'distributePots' || event === 'potsDistributed' || event === 'showdown' || event === 'actionProcessed') {
        // console.log(`[EVENT] ${event}:`, JSON.stringify(data, null, 2));
    }
}

async function testUncalledRaiseRefund() {
    console.log('\n--- Test: Uncalled Raise Refund ---');
    const game = new TexasHoldemGame(eventLogger);
    game.initializePlayers();
    game.startNewHand();

    // Setup scenario: 
    // Player 0 (You): Bets 100
    // Player 1 (Sarah): All-in 50 (Stack was 50)
    // Others fold

    // Reset players
    game.players[0].reset(); game.players[0].stack = 1000;
    game.players[1].reset(); game.players[1].stack = 50;
    for (let i = 2; i < 6; i++) { game.players[i].reset(); game.players[i].folded = true; }

    game.currentBets = {};

    // P0 Bets 100
    game.players[0].bet(100);
    game.currentBets[0] = 100;

    // P1 Calls All-in 50 (technically "bet" 50)
    game.players[1].bet(50);
    game.currentBets[1] = 50;

    console.log('Bets placed: P0: 100, P1: 50 (All-in)');

    // Create pots
    game.potManager.createPots(game.players, game.currentBets);

    const pots = game.potManager.pots;
    console.log('Pots created:', JSON.stringify(pots, null, 2));


    // Verify Pot Creation
    const refundPot = pots.find(p => p.amount === 50 && p.eligiblePlayers.length === 1 && p.eligiblePlayers[0] === 0);
    const mainPot = pots.find(p => p.amount === 100 && p.eligiblePlayers.includes(0) && p.eligiblePlayers.includes(1));

    if (refundPot && mainPot) {
        console.log('SUCCESS: Pot structure correct.');
    } else {
        console.log('FAILURE: Pot structure incorrect.');
    }

    // Verify Distribution (Mock hand evaluations)
    // P0 wins main pot (amount 100)
    // P0 gets refund (amount 50)
    const mockEvaluations = {
        0: { ranking: 2 }, // Pair
        1: { ranking: 1 }  // High Card
    };

    const results = game.potManager.distributePots(game.players, mockEvaluations);
    console.log('Distribution results:', JSON.stringify(results, null, 2));

    // Expect: 
    // 1. One 'return' of 50 to P0
    // 2. One 'win' of 100 to P0

    const refundOp = results.find(r => r.type === 'return' && r.amount === 50 && r.playerId === 0);
    const winOp = results.find(r => r.type === 'win' && r.amount === 100 && r.playerId === 0);

    if (refundOp && winOp) {
        console.log('SUCCESS: Distribution types (return/win) correct.');
    } else {
        console.log('FAILURE: Distribution types incorrect.');
    }
}

async function testSidePotsThreeWay() {
    console.log('\n--- Test: 3-Way Side Pots ---');
    const game = new TexasHoldemGame(eventLogger);
    game.initializePlayers();
    game.startNewHand();

    // P0: Deep stack, bets 200
    // P1: Stack 50, all-in
    // P2: Stack 100, all-in

    game.players[0].reset(); game.players[0].stack = 1000;
    game.players[1].reset(); game.players[1].stack = 50;
    game.players[2].reset(); game.players[2].stack = 100;
    [3, 4, 5].forEach(i => { game.players[i].reset(); game.players[i].folded = true; });

    game.currentBets = {};

    game.players[0].bet(200); game.currentBets[0] = 200;
    game.players[1].bet(50); game.currentBets[1] = 50; game.players[1].allIn = true;
    game.players[2].bet(100); game.currentBets[2] = 100; game.players[2].allIn = true;

    console.log('Bets: P0: 200, P1: 50 (AI), P2: 100 (AI)');

    game.potManager.createPots(game.players, game.currentBets);
    const pots = game.potManager.pots;

    console.log('Pots created:', JSON.stringify(pots, null, 2));

    // Checks
    // Pot 1: 50*3 = 150. Eligible: 0, 1, 2
    // Pot 2: (100-50)*2 = 100. Eligible: 0, 2
    // Pot 3: (200-100) = 100. Eligible: 0 (Refund)

    const p1 = pots.find(p => p.amount === 150 && p.eligiblePlayers.length === 3);
    const p2 = pots.find(p => p.amount === 100 && p.eligiblePlayers.length === 2);
    const p3 = pots.find(p => p.amount === 100 && p.eligiblePlayers.length === 1);

    if (p1 && p2 && p3) {
        console.log('SUCCESS: 3-Way side pots correct.');
    } else {
        console.log('FAILURE: 3-Way side pots incorrect.');
    }
}

async function testHandEvaluationTie() {
    console.log('\n--- Test: Hand Evaluation Tie ---');
    // Force specific cards for a chopped pot
    // Board: A K Q J 10 (Royal Flush on board? No, straight on board)
    // Board: 2h 3h 4h 5h 6d (Wait, straight flush possibility? No.)
    // Let's do a simple shared pair/kickers tie.
    // Board: Ah Kh Qh Jh 2d
    // P1: 2s 3s (Pair of 2s? No, Ace high straight? No.)
    // Board: As Ks Qs Js 9d
    // P1: 2c 3c -> Board plays (Ace High)
    // P2: 4c 5c -> Board plays (Ace High)
    // Tie.

    const board = [
        new Card('♠', 'A'), new Card('♠', 'K'), new Card('♠', 'Q'), new Card('♠', 'J'), new Card('♦', '9')
    ];

    const p1Cards = [new Card('♣', '2'), new Card('♣', '3')];
    const p2Cards = [new Card('♣', '4'), new Card('♣', '5')];

    const h1 = HandEvaluator.evaluateHand([...p1Cards, ...board]);
    const h2 = HandEvaluator.evaluateHand([...p2Cards, ...board]);

    const comparison = HandEvaluator.compareHands(h1, h2);
    console.log(`Hand 1: ${h1.name} (${h1.ranking}), Hand 2: ${h2.name} (${h2.ranking})`);
    console.log(`Comparison result: ${comparison} (0 means tie)`);

    if (comparison === 0) {
        console.log('SUCCESS: Tie detected correctly.');
    } else {
        console.log('FAILURE: Tie not detected.');
    }
}

// Run
testUncalledRaiseRefund();
testSidePotsThreeWay();
testHandEvaluationTie();
