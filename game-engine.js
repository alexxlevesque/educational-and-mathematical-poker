// ============================================================================
// CARD & DECK SYSTEM
// ============================================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANK_VALUES[rank];
  }

  toString() {
    return `${this.rank}${this.suit}`;
  }

  isRed() {
    return this.suit === '♥' || this.suit === '♦';
  }
}

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates shuffle algorithm
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count = 1) {
    return this.cards.splice(0, count);
  }
}

// ============================================================================
// HAND EVALUATION SYSTEM
// ============================================================================

const HAND_RANKINGS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

class HandEvaluator {
  static evaluateHand(cards) {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate a hand');
    }

    // For 7 cards, find the best 5-card combination
    if (cards.length === 7) {
      return this.findBest5CardHand(cards);
    }

    // For 5 or 6 cards, evaluate all combinations
    if (cards.length === 6) {
      const combinations = this.getCombinations(cards, 5);
      let bestHand = null;
      for (let combo of combinations) {
        const hand = this.evaluate5Cards(combo);
        if (!bestHand || this.compareHands(hand, bestHand) > 0) {
          bestHand = hand;
        }
      }
      return bestHand;
    }

    return this.evaluate5Cards(cards);
  }

  static findBest5CardHand(cards) {
    const combinations = this.getCombinations(cards, 5);
    let bestHand = null;

    for (let combo of combinations) {
      const hand = this.evaluate5Cards(combo);
      if (!bestHand || this.compareHands(hand, bestHand) > 0) {
        bestHand = hand;
      }
    }

    return bestHand;
  }

  static getCombinations(arr, size) {
    const result = [];

    const combine = (start, combo) => {
      if (combo.length === size) {
        result.push([...combo]);
        return;
      }

      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    };

    combine(0, []);
    return result;
  }

  static evaluate5Cards(cards) {
    const sorted = [...cards].sort((a, b) => b.value - a.value);

    const isFlush = this.checkFlush(sorted);
    const straightValue = this.checkStraight(sorted);
    const groups = this.groupByRank(sorted);

    // Royal Flush
    if (isFlush && straightValue === 14) {
      return {
        ranking: HAND_RANKINGS.ROYAL_FLUSH,
        name: 'Royal Flush',
        values: [14],
        cards: sorted
      };
    }

    // Straight Flush
    if (isFlush && straightValue) {
      return {
        ranking: HAND_RANKINGS.STRAIGHT_FLUSH,
        name: 'Straight Flush',
        values: [straightValue],
        cards: sorted
      };
    }

    // Four of a Kind
    if (groups.length === 2 && groups[0].length === 4) {
      return {
        ranking: HAND_RANKINGS.FOUR_OF_A_KIND,
        name: 'Four of a Kind',
        values: [groups[0][0].value, groups[1][0].value],
        cards: sorted
      };
    }

    // Full House
    if (groups.length === 2 && groups[0].length === 3 && groups[1].length === 2) {
      return {
        ranking: HAND_RANKINGS.FULL_HOUSE,
        name: 'Full House',
        values: [groups[0][0].value, groups[1][0].value],
        cards: sorted
      };
    }

    // Flush
    if (isFlush) {
      return {
        ranking: HAND_RANKINGS.FLUSH,
        name: 'Flush',
        values: sorted.map(c => c.value),
        cards: sorted
      };
    }

    // Straight
    if (straightValue) {
      return {
        ranking: HAND_RANKINGS.STRAIGHT,
        name: 'Straight',
        values: [straightValue],
        cards: sorted
      };
    }

    // Three of a Kind
    if (groups.length === 3 && groups[0].length === 3) {
      return {
        ranking: HAND_RANKINGS.THREE_OF_A_KIND,
        name: 'Three of a Kind',
        values: [groups[0][0].value, groups[1][0].value, groups[2][0].value],
        cards: sorted
      };
    }

    // Two Pair
    if (groups.length === 3 && groups[0].length === 2 && groups[1].length === 2) {
      return {
        ranking: HAND_RANKINGS.TWO_PAIR,
        name: 'Two Pair',
        values: [groups[0][0].value, groups[1][0].value, groups[2][0].value],
        cards: sorted
      };
    }

    // Pair
    if (groups.length === 4 && groups[0].length === 2) {
      return {
        ranking: HAND_RANKINGS.PAIR,
        name: 'Pair',
        values: [groups[0][0].value, groups[1][0].value, groups[2][0].value, groups[3][0].value],
        cards: sorted
      };
    }

    // High Card
    return {
      ranking: HAND_RANKINGS.HIGH_CARD,
      name: 'High Card',
      values: sorted.map(c => c.value),
      cards: sorted
    };
  }

  static checkFlush(cards) {
    const suit = cards[0].suit;
    return cards.every(card => card.suit === suit);
  }

  static checkStraight(cards) {
    const values = cards.map(c => c.value).sort((a, b) => b - a);

    // Check for regular straight
    let isStraight = true;
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] !== 1) {
        isStraight = false;
        break;
      }
    }

    if (isStraight) {
      return values[0]; // Return high card of straight
    }

    // Check for A-2-3-4-5 (wheel)
    if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
      return 5; // In a wheel, the straight is to 5
    }

    return null;
  }

  static groupByRank(cards) {
    const groups = {};

    for (let card of cards) {
      if (!groups[card.value]) {
        groups[card.value] = [];
      }
      groups[card.value].push(card);
    }

    // Sort groups by size (descending), then by value (descending)
    return Object.values(groups).sort((a, b) => {
      if (b.length !== a.length) {
        return b.length - a.length;
      }
      return b[0].value - a[0].value;
    });
  }

  static compareHands(hand1, hand2) {
    // Compare rankings first
    if (hand1.ranking !== hand2.ranking) {
      return hand1.ranking - hand2.ranking;
    }

    // Same ranking, compare values (kickers)
    for (let i = 0; i < Math.max(hand1.values.length, hand2.values.length); i++) {
      const val1 = hand1.values[i] || 0;
      const val2 = hand2.values[i] || 0;

      if (val1 !== val2) {
        return val1 - val2;
      }
    }

    // Hands are identical
    return 0;
  }

  static getHandDescription(hand) {
    const highCard = RANKS[hand.values[0] - 2];

    switch (hand.ranking) {
      case HAND_RANKINGS.ROYAL_FLUSH:
        return 'Royal Flush';
      case HAND_RANKINGS.STRAIGHT_FLUSH:
        return `Straight Flush, ${highCard} high`;
      case HAND_RANKINGS.FOUR_OF_A_KIND:
        return `Four ${RANKS[hand.values[0] - 2]}s`;
      case HAND_RANKINGS.FULL_HOUSE:
        return `Full House, ${RANKS[hand.values[0] - 2]}s over ${RANKS[hand.values[1] - 2]}s`;
      case HAND_RANKINGS.FLUSH:
        return `Flush, ${highCard} high`;
      case HAND_RANKINGS.STRAIGHT:
        return `Straight, ${highCard} high`;
      case HAND_RANKINGS.THREE_OF_A_KIND:
        return `Three ${RANKS[hand.values[0] - 2]}s`;
      case HAND_RANKINGS.TWO_PAIR:
        return `Two Pair, ${RANKS[hand.values[0] - 2]}s and ${RANKS[hand.values[1] - 2]}s`;
      case HAND_RANKINGS.PAIR:
        return `Pair of ${RANKS[hand.values[0] - 2]}s`;
      case HAND_RANKINGS.HIGH_CARD:
        return `${highCard} high`;
      default:
        return 'Unknown hand';
    }
  }
}

// ============================================================================
// POT MANAGEMENT
// ============================================================================

class PotManager {
  constructor() {
    this.pots = [];
  }

  reset() {
    this.pots = [];
  }

  createPots(players, currentBets) {
    this.pots = [];

    // Get all unique bet amounts (sorted ascending)
    const betLevels = [...new Set(Object.values(currentBets))].sort((a, b) => a - b);

    if (betLevels.length === 0 || betLevels[0] === 0) {
      return;
    }

    let previousLevel = 0;

    for (let level of betLevels) {
      const pot = {
        amount: 0,
        eligiblePlayers: []
      };

      // Add chips from each player who bet at least this level
      for (let player of players) {
        const playerBet = currentBets[player.id] || 0;

        if (playerBet >= level) {
          const contribution = Math.min(level, playerBet) - previousLevel;
          pot.amount += contribution;

          // Player is eligible if they contributed and haven't folded
          if (!player.folded && playerBet >= level) {
            if (!pot.eligiblePlayers.includes(player.id)) {
              pot.eligiblePlayers.push(player.id);
            }
          }
        }
      }

      if (pot.amount > 0) {
        this.pots.push(pot);
      }

      previousLevel = level;
    }
  }

  getTotalPot() {
    return this.pots.reduce((sum, pot) => sum + pot.amount, 0);
  }

  distributePots(players, handEvaluations) {
    const operations = []; // Changed from object to array of operations to support reliable ordering

    for (let pot of this.pots) {
      // Find eligible players for this pot
      const eligiblePlayers = players.filter(p =>
        pot.eligiblePlayers.includes(p.id) && !p.folded
      );

      if (eligiblePlayers.length === 0) continue;

      // START CHANGE: Check for uncalled bet refund
      if (eligiblePlayers.length === 1) {
        operations.push({
          playerId: eligiblePlayers[0].id,
          amount: pot.amount,
          type: 'return',
          hand: null
        });
        continue;
      }
      // END CHANGE

      // Find winner(s) among eligible players
      let bestHand = null;
      let winners = [];

      for (let player of eligiblePlayers) {
        const playerHand = handEvaluations[player.id];

        if (!bestHand) {
          bestHand = playerHand;
          winners = [player];
        } else {
          const comparison = HandEvaluator.compareHands(playerHand, bestHand);

          if (comparison > 0) {
            // New best hand
            bestHand = playerHand;
            winners = [player];
          } else if (comparison === 0) {
            // Tie
            winners.push(player);
          }
        }
      }

      // Split pot among winners
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;

      for (let i = 0; i < winners.length; i++) {
        const playerId = winners[i].id;
        let amount = share;

        // Give remainder to first winner (closest to dealer button)
        if (i === 0) {
          amount += remainder;
        }

        operations.push({
          playerId: playerId,
          amount: amount,
          type: 'win',
          hand: handEvaluations[playerId]
        });
      }
    }

    return operations;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Card,
    Deck,
    HandEvaluator,
    PotManager,
    HAND_RANKINGS,
    SUITS,
    RANKS,
    RANK_VALUES
  };
}
