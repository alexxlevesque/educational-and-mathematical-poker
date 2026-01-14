// ============================================================================
// GAME STATE & ORCHESTRATION
// ============================================================================

const GAME_STATES = {
    WAITING: 'waiting',
    PRE_FLOP: 'pre_flop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown',
    HAND_COMPLETE: 'hand_complete'
};

const PLAYER_ACTIONS = {
    FOLD: 'fold',
    CHECK: 'check',
    CALL: 'call',
    BET: 'bet',
    RAISE: 'raise',
    ALL_IN: 'all-in'
};

class Player {
    constructor(id, name, stack, isHuman = false, personality = null) {
        this.id = id;
        this.name = name;
        this.stack = stack;
        this.isHuman = isHuman;
        this.personality = personality;
        this.holeCards = [];
        this.currentBet = 0;
        this.totalBet = 0;
        this.folded = false;
        this.allIn = false;
        this.isActive = true;
        this.lastAction = null;
    }

    reset() {
        this.holeCards = [];
        this.currentBet = 0;
        this.totalBet = 0;
        this.folded = false;
        this.allIn = false;
        this.lastAction = null;
    }

    bet(amount) {
        const actualBet = Math.min(amount, this.stack);
        this.stack -= actualBet;
        this.currentBet += actualBet;
        this.totalBet += actualBet;

        if (this.stack === 0) {
            this.allIn = true;
        }

        return actualBet;
    }

    win(amount) {
        this.stack += amount;
    }

    canAct() {
        return !this.folded && !this.allIn && this.stack > 0;
    }
}

class TexasHoldemGame {
    constructor(eventCallback = null) {
        this.players = [];
        this.deck = new Deck();
        this.communityCards = [];
        this.potManager = new PotManager();
        this.state = GAME_STATES.WAITING;
        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        this.currentBet = 0;
        this.minRaise = 0;
        this.smallBlind = 5;
        this.bigBlind = 10;
        this.handNumber = 0;
        this.actionHistory = [];
        this.eventCallback = eventCallback || (() => { });
        this.waitingForHumanAction = false;
        this.currentBets = {};
        this.playersActedThisRound = {};
    }

    initializePlayers() {
        // Create human player
        this.players.push(new Player(0, 'You', 1000, true));

        // Create 5 bot players with different personalities
        const botConfigs = [
            { name: 'Sarah', personality: BOT_PERSONALITIES.TIGHT_AGGRESSIVE },
            { name: 'Mike', personality: BOT_PERSONALITIES.LOOSE_AGGRESSIVE },
            { name: 'Emma', personality: BOT_PERSONALITIES.TIGHT_PASSIVE },
            { name: 'Jake', personality: BOT_PERSONALITIES.LOOSE_PASSIVE },
            { name: 'Alex', personality: BOT_PERSONALITIES.ADAPTIVE }
        ];

        for (let i = 0; i < botConfigs.length; i++) {
            const config = botConfigs[i];
            const personality = new BotPersonality(config.personality, config.name);
            const bot = new Player(i + 1, config.name, 1000, false, personality);
            bot.decisionEngine = new BotDecisionEngine(personality);
            this.players.push(bot);
        }

        this.emit('playersInitialized', { players: this.players });
    }

    startNewHand() {
        this.handNumber++;
        this.deck.reset();
        this.communityCards = [];
        this.potManager.reset();
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        this.actionHistory = [];
        this.currentBets = {};
        this.waitingForHumanAction = false;

        // Reset all players
        for (let player of this.players) {
            player.reset();
            this.currentBets[player.id] = 0;
        }

        // Remove eliminated players
        this.players = this.players.filter(p => p.stack > 0);

        if (this.players.length < 2) {
            this.emit('gameOver', { winner: this.players[0] });
            return;
        }

        // Rotate dealer button
        this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

        this.emit('newHand', {
            handNumber: this.handNumber,
            dealerIndex: this.dealerIndex
        });

        // Post blinds
        this.postBlinds();

        // Deal hole cards
        this.dealHoleCards();

        // Start pre-flop betting
        this.state = GAME_STATES.PRE_FLOP;
        this.startBettingRound();
    }

    postBlinds() {
        const sbIndex = (this.dealerIndex + 1) % this.players.length;
        const bbIndex = (this.dealerIndex + 2) % this.players.length;

        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];

        const sbAmount = sbPlayer.bet(this.smallBlind);
        const bbAmount = bbPlayer.bet(this.bigBlind);

        this.currentBets[sbPlayer.id] = sbAmount;
        this.currentBets[bbPlayer.id] = bbAmount;
        this.currentBet = this.bigBlind;

        this.addAction(sbPlayer, 'posts small blind', sbAmount);
        this.addAction(bbPlayer, 'posts big blind', bbAmount);

        this.emit('blindsPosted', {
            smallBlind: { player: sbPlayer, amount: sbAmount },
            bigBlind: { player: bbPlayer, amount: bbAmount }
        });
    }

    dealHoleCards() {
        for (let player of this.players) {
            player.holeCards = this.deck.deal(2);
        }

        this.emit('holeCardsDealt', { players: this.players });
    }

    startBettingRound() {
        // Reset action tracking for this betting round
        this.playersActedThisRound = {};
        for (let player of this.players) {
            this.playersActedThisRound[player.id] = false;
        }

        // Determine first player to act
        if (this.state === GAME_STATES.PRE_FLOP) {
            // Pre-flop: start after big blind
            this.currentPlayerIndex = (this.dealerIndex + 3) % this.players.length;
        } else {
            // Post-flop: start after dealer
            this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
            // Reset current bet for post-flop rounds
            this.currentBet = 0;
        }

        // Find first active player
        while (!this.players[this.currentPlayerIndex].canAct()) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }

        this.lastRaiserIndex = -1;
        this.processNextAction();
    }

    processNextAction() {
        const activePlayers = this.players.filter(p => p.canAct());

        if (activePlayers.length === 0) {
            // Everyone is all-in or folded
            this.completeBettingRound();
            return;
        }

        if (activePlayers.length === 1 && this.players.filter(p => !p.folded).length === 1) {
            // Only one player left (others folded)
            this.handleSinglePlayerWin();
            return;
        }

        // Check if betting round is complete
        if (this.isBettingRoundComplete()) {
            this.completeBettingRound();
            return;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];

        if (!currentPlayer.canAct()) {
            this.moveToNextPlayer();
            return;
        }

        if (currentPlayer.isHuman) {
            this.waitingForHumanAction = true;
        }

        this.emit('playerTurn', { player: currentPlayer });

        if (!currentPlayer.isHuman) {
            // Bot makes decision
            setTimeout(() => this.processBotAction(currentPlayer), 800);
        }
    }

    processBotAction(bot) {
        const gameState = this.getBotGameState(bot);
        const decision = bot.decisionEngine.makeDecision(gameState, bot);

        this.processPlayerAction(bot, decision.action, decision.amount || 0);
    }

    getBotGameState(bot) {
        const position = this.getPlayerPosition(bot);
        const activePlayers = this.players.filter(p => !p.folded);

        return {
            holeCards: bot.holeCards,
            communityCards: this.communityCards,
            potSize: this.getCurrentPotSize(),
            currentBet: this.currentBet,
            minRaise: this.minRaise,
            activePlayers: activePlayers,
            position: position,
            bigBlind: this.bigBlind
        };
    }

    getPlayerPosition(player) {
        const playerIndex = this.players.indexOf(player);
        const positionFromDealer = (playerIndex - this.dealerIndex + this.players.length) % this.players.length;

        if (positionFromDealer <= 2) return 'early';
        if (positionFromDealer <= 4) return 'middle';
        return 'late';
    }

    processPlayerAction(player, action, amount = 0) {
        const callAmount = this.currentBet - this.currentBets[player.id];

        // Mark that this player has acted in this round
        this.playersActedThisRound[player.id] = true;

        switch (action) {
            case PLAYER_ACTIONS.FOLD:
                player.folded = true;
                player.lastAction = 'fold';
                this.addAction(player, 'folds');
                break;

            case PLAYER_ACTIONS.CHECK:
                player.lastAction = 'check';
                this.addAction(player, 'checks');
                break;

            case PLAYER_ACTIONS.CALL:
                const actualCall = player.bet(callAmount);
                this.currentBets[player.id] += actualCall;
                player.lastAction = `call ${actualCall}`;
                this.addAction(player, 'calls', actualCall);
                break;

            case PLAYER_ACTIONS.BET:
                const betAmount = player.bet(amount);
                this.currentBets[player.id] += betAmount;
                this.currentBet = this.currentBets[player.id];
                this.minRaise = betAmount;
                this.lastRaiserIndex = this.currentPlayerIndex;
                player.lastAction = `bet ${betAmount}`;
                this.addAction(player, 'bets', betAmount);
                // Reset action tracking when someone bets
                for (let p of this.players) {
                    if (p.id !== player.id) {
                        this.playersActedThisRound[p.id] = false;
                    }
                }
                break;

            case PLAYER_ACTIONS.RAISE:
                const raiseAmount = player.bet(amount);
                this.currentBets[player.id] += raiseAmount;
                this.currentBet = this.currentBets[player.id];
                this.minRaise = raiseAmount - callAmount;
                this.lastRaiserIndex = this.currentPlayerIndex;
                player.lastAction = `raise to ${this.currentBet}`;
                this.addAction(player, 'raises to', this.currentBet);
                // Reset action tracking when someone raises
                for (let p of this.players) {
                    if (p.id !== player.id) {
                        this.playersActedThisRound[p.id] = false;
                    }
                }
                break;

            case PLAYER_ACTIONS.ALL_IN:
                const allInAmount = player.bet(player.stack);
                this.currentBets[player.id] += allInAmount;
                if (this.currentBets[player.id] > this.currentBet) {
                    this.currentBet = this.currentBets[player.id];
                    this.lastRaiserIndex = this.currentPlayerIndex;
                    // Reset action tracking when someone raises via all-in
                    for (let p of this.players) {
                        if (p.id !== player.id) {
                            this.playersActedThisRound[p.id] = false;
                        }
                    }
                }
                player.lastAction = 'all-in';
                this.addAction(player, 'goes all-in', allInAmount);
                break;
        }

        // Update adaptive bot stats
        for (let p of this.players) {
            if (p.personality && p.personality.isAdaptive && p.id !== player.id) {
                p.personality.updatePlayerStats(player.id, action, amount);
            }
        }

        this.emit('actionProcessed', { player, action, amount });

        this.validateGameState();

        this.moveToNextPlayer();
    }

    moveToNextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

        setTimeout(() => this.processNextAction(), 100);
    }

    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => p.canAct());

        if (activePlayers.length === 0) return true;

        // Check if all active players have acted at least once
        for (let player of this.players) {
            if (player.canAct() && !this.playersActedThisRound[player.id]) {
                return false;
            }
        }

        // Check if all active players have matched the current bet
        for (let player of this.players) {
            if (player.canAct()) {
                if (this.currentBets[player.id] < this.currentBet) {
                    return false;
                }
            }
        }

        return true;
    }

    completeBettingRound() {
        // Create pots from current bets
        this.potManager.createPots(this.players, this.currentBets);

        this.emit('bettingRoundComplete', {
            pot: this.potManager.getTotalPot()
        });

        // Reset current bets for next round
        for (let player of this.players) {
            this.currentBets[player.id] = 0;
        }
        this.currentBet = 0;

        // Progress to next state
        this.progressGameState();
    }

    progressGameState() {
        switch (this.state) {
            case GAME_STATES.PRE_FLOP:
                this.dealFlop();
                break;
            case GAME_STATES.FLOP:
                this.dealTurn();
                break;
            case GAME_STATES.TURN:
                this.dealRiver();
                break;
            case GAME_STATES.RIVER:
                this.showdown();
                break;
            case GAME_STATES.SHOWDOWN:
                this.completeHand();
                break;
        }
    }

    dealFlop() {
        this.deck.deal(1); // Burn card
        this.communityCards = this.deck.deal(3);
        this.state = GAME_STATES.FLOP;

        this.emit('flopDealt', { cards: this.communityCards });

        setTimeout(() => this.startBettingRound(), 1000);
    }

    dealTurn() {
        this.deck.deal(1); // Burn card
        this.communityCards.push(...this.deck.deal(1));
        this.state = GAME_STATES.TURN;

        this.emit('turnDealt', { card: this.communityCards[3] });

        setTimeout(() => this.startBettingRound(), 1000);
    }

    dealRiver() {
        this.deck.deal(1); // Burn card
        this.communityCards.push(...this.deck.deal(1));
        this.state = GAME_STATES.RIVER;

        this.emit('riverDealt', { card: this.communityCards[4] });

        setTimeout(() => this.startBettingRound(), 1000);
    }

    showdown() {
        this.state = GAME_STATES.SHOWDOWN;

        // Create pots from any remaining current bets before showdown
        this.potManager.createPots(this.players, this.currentBets);

        const activePlayers = this.players.filter(p => !p.folded);
        const handEvaluations = {};

        for (let player of activePlayers) {
            const allCards = [...player.holeCards, ...this.communityCards];
            handEvaluations[player.id] = HandEvaluator.evaluateHand(allCards);
        }

        this.emit('showdown', { players: activePlayers, handEvaluations });

        // Distribute pots
        const results = this.potManager.distributePots(this.players, handEvaluations);

        for (let result of results) {
            const player = this.players.find(p => p.id === result.playerId);
            player.win(result.amount);
        }

        this.emit('potsDistributed', { results, handEvaluations });

        this.validateGameState();

        setTimeout(() => this.completeHand(), 3000);
    }

    handleSinglePlayerWin() {
        const winner = this.players.find(p => !p.folded);

        // Create pots from any remaining current bets
        this.potManager.createPots(this.players, this.currentBets);

        // Get total pot amount
        const pot = this.potManager.getTotalPot();

        winner.win(pot);

        this.emit('singlePlayerWin', { winner, pot });

        setTimeout(() => this.completeHand(), 2000);
    }

    completeHand() {
        this.state = GAME_STATES.HAND_COMPLETE;

        this.emit('handComplete');

        setTimeout(() => this.startNewHand(), 2000);
    }

    getCurrentPotSize() {
        let total = this.potManager.getTotalPot();
        for (let playerId in this.currentBets) {
            total += this.currentBets[playerId];
        }
        return total;
    }

    addAction(player, action, amount = null) {
        const entry = {
            player: player.name,
            action: action,
            amount: amount,
            timestamp: Date.now()
        };
        this.actionHistory.push(entry);
        this.emit('actionLogged', entry);
    }

    emit(event, data) {
        this.eventCallback(event, data);
    }

    // Human player actions
    humanFold() {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.FOLD);
    }

    humanCheck() {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        const callAmount = this.currentBet - this.currentBets[human.id];
        if (callAmount > 0) return; // Can't check if there's a bet
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.CHECK);
    }

    humanCall() {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        const callAmount = this.currentBet - this.currentBets[human.id];
        if (callAmount >= human.stack) {
            this.humanAllIn();
            return;
        }
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.CALL, callAmount);
    }

    humanBet(amount) {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        if (amount >= human.stack) {
            this.humanAllIn();
            return;
        }
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.BET, amount);
    }

    humanRaise(amount) {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        if (amount >= human.stack) {
            this.humanAllIn();
            return;
        }
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.RAISE, amount);
    }

    humanAllIn() {
        if (!this.waitingForHumanAction) return;
        const human = this.players[0];
        this.waitingForHumanAction = false;
        this.processPlayerAction(human, PLAYER_ACTIONS.ALL_IN, human.stack);
    }

    validateGameState() {
        // 1. Verify total chips in play
        let currentTotal = 0;

        // Count chips in stacks
        for (let player of this.players) {
            currentTotal += player.stack;
        }

        // Count chips in current bets
        const currentBetsTotal = Object.values(this.currentBets).reduce((a, b) => a + b, 0);
        currentTotal += currentBetsTotal;

        // Count chips in pots
        currentTotal += this.potManager.getTotalPot();

        // Check if total matches starting total (6 players * 1000 = 6000)
        // Note: active implementations might have different starting stacks, 
        // so we ideally should track initial total. For now assuming 6000.
        const EXPECTED_TOTAL = 6000;

        if (currentTotal !== EXPECTED_TOTAL) {
            console.error(`INTEGRITY ERROR: Chip count mismatch! Expected ${EXPECTED_TOTAL}, found ${currentTotal}`);
            this.emit('integrityError', {
                type: 'CHIP_MISMATCH',
                message: `Expected ${EXPECTED_TOTAL}, found ${currentTotal}`
            });
        }

        // 2. Verify all-in state consistency
        for (let player of this.players) {
            if (player.stack === 0 && !player.allIn && !player.folded) {
                // Auto-correct state but warn
                console.warn(`State warning: Player ${player.name} has 0 stack but not marked all-in. Correcting.`);
                player.allIn = true;
            }
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TexasHoldemGame,
        Player,
        GAME_STATES,
        PLAYER_ACTIONS
    };
}
