// ============================================================================
// BOT AI SYSTEM
// ============================================================================

// Bot personality types
const BOT_PERSONALITIES = {
    TIGHT_AGGRESSIVE: 'tight_aggressive',
    LOOSE_AGGRESSIVE: 'loose_aggressive',
    TIGHT_PASSIVE: 'tight_passive',
    LOOSE_PASSIVE: 'loose_passive',
    ADAPTIVE: 'adaptive'
};

// ============================================================================
// HAND STRENGTH CALCULATOR
// ============================================================================

class HandStrengthCalculator {
    // Pre-flop hand strength using simplified Chen formula
    static evaluatePreFlop(card1, card2) {
        const high = Math.max(card1.value, card2.value);
        const low = Math.min(card1.value, card2.value);
        const gap = high - low - 1;
        const suited = card1.suit === card2.suit;
        const paired = card1.value === card2.value;

        let score = 0;

        // Base score for high card
        if (high === 14) score = 10; // Ace
        else if (high === 13) score = 8; // King
        else if (high === 12) score = 7; // Queen
        else if (high === 11) score = 6; // Jack
        else score = high / 2;

        // Pair bonus
        if (paired) {
            score *= 2;
            if (score < 5) score = 5;
        }

        // Suited bonus
        if (suited) score += 2;

        // Gap penalty
        if (gap === 1) score += 1; // Connector bonus
        else if (gap === 2) score -= 1;
        else if (gap === 3) score -= 2;
        else if (gap >= 4) score -= 4;

        // Normalize to 0-1 range (approximately)
        return Math.min(Math.max(score / 20, 0), 1);
    }

    // Post-flop hand strength (simplified Monte Carlo)
    static evaluatePostFlop(holeCards, communityCards, numOpponents = 5) {
        // For performance, use a simplified heuristic instead of full Monte Carlo
        const allCards = [...holeCards, ...communityCards];

        try {
            const currentHand = HandEvaluator.evaluateHand(allCards);

            // Base strength on hand ranking
            let strength = currentHand.ranking / 10;

            // Adjust based on top card value
            if (currentHand.values && currentHand.values.length > 0) {
                strength += (currentHand.values[0] / 14) * 0.1;
            }

            // Reduce strength based on number of opponents
            strength *= Math.pow(0.95, numOpponents - 1);

            // Check for draws
            const drawPotential = this.evaluateDrawPotential(holeCards, communityCards);
            strength += drawPotential * 0.15;

            return Math.min(Math.max(strength, 0), 1);
        } catch (e) {
            // Not enough cards yet, return pre-flop strength
            return this.evaluatePreFlop(holeCards[0], holeCards[1]);
        }
    }

    static evaluateDrawPotential(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];

        // Check for flush draw
        const suitCounts = {};
        for (let card of allCards) {
            suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        }
        const maxSuitCount = Math.max(...Object.values(suitCounts));

        // Check for straight draw
        const values = allCards.map(c => c.value).sort((a, b) => a - b);
        const uniqueValues = [...new Set(values)];
        let maxConsecutive = 1;
        let currentConsecutive = 1;

        for (let i = 1; i < uniqueValues.length; i++) {
            if (uniqueValues[i] - uniqueValues[i - 1] === 1) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 1;
            }
        }

        let drawStrength = 0;

        // Flush draw (4 cards of same suit)
        if (maxSuitCount === 4) drawStrength += 0.35;

        // Open-ended straight draw (4 consecutive cards)
        if (maxConsecutive === 4) drawStrength += 0.32;

        // Gutshot straight draw (3 consecutive with gap)
        if (maxConsecutive === 3) drawStrength += 0.15;

        return Math.min(drawStrength, 1);
    }
}

// ============================================================================
// POT ODDS CALCULATOR
// ============================================================================

class PotOddsCalculator {
    static calculate(potSize, callAmount) {
        if (callAmount === 0) return Infinity;
        return potSize / callAmount;
    }

    static getRequiredEquity(potOdds) {
        return 1 / (potOdds + 1);
    }

    static shouldCall(handStrength, potSize, callAmount) {
        const potOdds = this.calculate(potSize, callAmount);
        const requiredEquity = this.getRequiredEquity(potOdds);

        // Add some variance for realism
        const adjustedStrength = handStrength + (Math.random() - 0.5) * 0.1;

        return adjustedStrength >= requiredEquity;
    }
}

// ============================================================================
// BOT PERSONALITY DEFINITIONS
// ============================================================================

class BotPersonality {
    constructor(type, name) {
        this.type = type;
        this.name = name;

        // Personality parameters
        switch (type) {
            case BOT_PERSONALITIES.TIGHT_AGGRESSIVE:
                this.preFlopThreshold = 0.35; // Only plays strong hands
                this.aggressionFactor = 3.5; // Raises often
                this.bluffFrequency = 0.12;
                this.foldToPressure = 0.3;
                break;

            case BOT_PERSONALITIES.LOOSE_AGGRESSIVE:
                this.preFlopThreshold = 0.15; // Plays many hands
                this.aggressionFactor = 4.0; // Very aggressive
                this.bluffFrequency = 0.20;
                this.foldToPressure = 0.25;
                break;

            case BOT_PERSONALITIES.TIGHT_PASSIVE:
                this.preFlopThreshold = 0.40; // Very selective
                this.aggressionFactor = 1.2; // Rarely raises
                this.bluffFrequency = 0.03;
                this.foldToPressure = 0.55;
                break;

            case BOT_PERSONALITIES.LOOSE_PASSIVE:
                this.preFlopThreshold = 0.12; // Plays almost anything
                this.aggressionFactor = 1.0; // Calls more than raises
                this.bluffFrequency = 0.05;
                this.foldToPressure = 0.40;
                break;

            case BOT_PERSONALITIES.ADAPTIVE:
                this.preFlopThreshold = 0.25;
                this.aggressionFactor = 2.5;
                this.bluffFrequency = 0.10;
                this.foldToPressure = 0.35;
                this.isAdaptive = true;
                this.playerStats = {}; // Track opponent behavior
                break;
        }
    }

    // Adaptive bot learns from player behavior
    updatePlayerStats(playerId, action, amount) {
        if (!this.isAdaptive) return;

        if (!this.playerStats[playerId]) {
            this.playerStats[playerId] = {
                totalActions: 0,
                folds: 0,
                calls: 0,
                raises: 0,
                totalRaiseAmount: 0
            };
        }

        const stats = this.playerStats[playerId];
        stats.totalActions++;

        if (action === 'fold') stats.folds++;
        else if (action === 'call') stats.calls++;
        else if (action === 'raise' || action === 'bet') {
            stats.raises++;
            stats.totalRaiseAmount += amount;
        }

        // Adjust personality based on player aggression
        const playerAggression = stats.raises / Math.max(stats.totalActions, 1);
        const playerFoldRate = stats.folds / Math.max(stats.totalActions, 1);

        // If player is aggressive, tighten up
        if (playerAggression > 0.4) {
            this.preFlopThreshold = Math.min(0.55, this.preFlopThreshold + 0.05);
            this.foldToPressure = Math.min(0.50, this.foldToPressure + 0.05);
        }

        // If player folds a lot, increase aggression
        if (playerFoldRate > 0.6) {
            this.aggressionFactor = Math.min(4.0, this.aggressionFactor + 0.2);
            this.bluffFrequency = Math.min(0.25, this.bluffFrequency + 0.02);
        }
    }
}

// ============================================================================
// BOT DECISION ENGINE
// ============================================================================

class BotDecisionEngine {
    constructor(personality) {
        this.personality = personality;
    }

    makeDecision(gameState, botPlayer) {
        const {
            holeCards,
            communityCards,
            potSize,
            currentBet,
            minRaise,
            activePlayers,
            position,
            bigBlind
        } = gameState;

        const playerBet = botPlayer.currentBet || 0;
        const callAmount = currentBet - playerBet;
        const stack = botPlayer.stack;

        // Pre-flop decision
        if (communityCards.length === 0) {
            return this.makePreFlopDecision(holeCards, callAmount, stack, currentBet, position, bigBlind, potSize);
        }

        // Post-flop decision
        return this.makePostFlopDecision(
            holeCards,
            communityCards,
            callAmount,
            stack,
            currentBet,
            potSize,
            activePlayers.length,
            position
        );
    }

    makePreFlopDecision(holeCards, callAmount, stack, currentBet, position, bigBlind, potSize) {
        const handStrength = HandStrengthCalculator.evaluatePreFlop(holeCards[0], holeCards[1]);

        // Position adjustment (later position = more liberal)
        const positionMultiplier = position === 'late' ? 0.9 : position === 'middle' ? 1.0 : 1.1;
        const adjustedThreshold = this.personality.preFlopThreshold * positionMultiplier;

        // Fold weak hands
        if (handStrength < adjustedThreshold) {
            // Sometimes call with marginal hands if cheap
            if (callAmount <= bigBlind && handStrength > adjustedThreshold * 0.7) {
                return { action: 'call', amount: callAmount };
            }
            return { action: 'fold' };
        }

        // Strong hand - decide between call and raise
        if (callAmount === 0) {
            // No bet yet - check or bet
            if (Math.random() < handStrength * this.personality.aggressionFactor * 0.15) {
                const betSize = this.calculateBetSize(potSize, stack, handStrength);
                return { action: 'bet', amount: betSize };
            }
            return { action: 'check' };
        }

        // Facing a bet
        const shouldRaise = Math.random() < (handStrength - adjustedThreshold + 0.2) * this.personality.aggressionFactor * 0.2;

        if (shouldRaise && stack > callAmount * 2) {
            const raiseSize = this.calculateRaiseSize(currentBet, potSize, stack, handStrength);
            return { action: 'raise', amount: raiseSize };
        }

        // Call
        if (callAmount >= stack) {
            return { action: 'all-in', amount: stack };
        }

        return { action: 'call', amount: callAmount };
    }

    makePostFlopDecision(holeCards, communityCards, callAmount, stack, currentBet, potSize, numOpponents, position) {
        const handStrength = HandStrengthCalculator.evaluatePostFlop(holeCards, communityCards, numOpponents);

        // Check if we should bluff
        const shouldBluff = Math.random() < this.personality.bluffFrequency;
        const effectiveStrength = shouldBluff ? Math.min(handStrength + 0.3, 1) : handStrength;

        // Facing a bet
        if (callAmount > 0) {
            // Check pot odds
            const shouldCallByOdds = PotOddsCalculator.shouldCall(effectiveStrength, potSize, callAmount);

            // Fold to pressure based on personality
            const pressureRatio = callAmount / Math.max(stack, 1);
            if (pressureRatio > this.personality.foldToPressure && !shouldCallByOdds) {
                return { action: 'fold' };
            }

            // Strong hand or good odds - raise or call
            if (effectiveStrength > 0.55 && Math.random() < this.personality.aggressionFactor * 0.25) {
                const raiseSize = this.calculateRaiseSize(currentBet, potSize, stack, effectiveStrength);
                if (raiseSize <= stack) {
                    return { action: 'raise', amount: raiseSize };
                }
            }

            // Call if odds are good or hand is decent
            if (shouldCallByOdds || effectiveStrength > 0.4) {
                if (callAmount >= stack) {
                    return { action: 'all-in', amount: stack };
                }
                return { action: 'call', amount: callAmount };
            }

            return { action: 'fold' };
        }

        // No bet to us - check or bet
        if (effectiveStrength > 0.4 && Math.random() < this.personality.aggressionFactor * 0.2) {
            const betSize = this.calculateBetSize(potSize, stack, effectiveStrength);
            return { action: 'bet', amount: betSize };
        }

        return { action: 'check' };
    }

    calculateBetSize(potSize, stack, handStrength) {
        // Bet sizing: 40-75% of pot based on hand strength
        const basePercentage = 0.4 + (handStrength * 0.35);
        const betSize = Math.floor(potSize * basePercentage);

        // Minimum bet
        const minBet = Math.max(10, Math.floor(potSize * 0.3));

        return Math.min(Math.max(betSize, minBet), stack);
    }

    calculateRaiseSize(currentBet, potSize, stack, handStrength) {
        // Raise to 2.5-4x the current bet based on hand strength
        const multiplier = 2.5 + (handStrength * 1.5);
        const raiseSize = Math.floor(currentBet * multiplier);

        // Minimum raise is 2x current bet
        const minRaise = currentBet * 2;

        return Math.min(Math.max(raiseSize, minRaise), stack);
    }

    getPosition(seatIndex, dealerIndex, numPlayers) {
        const positionFromDealer = (seatIndex - dealerIndex + numPlayers) % numPlayers;

        if (positionFromDealer <= 2) return 'early';
        if (positionFromDealer <= 4) return 'middle';
        return 'late';
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BotPersonality,
        BotDecisionEngine,
        HandStrengthCalculator,
        PotOddsCalculator,
        BOT_PERSONALITIES
    };
}
