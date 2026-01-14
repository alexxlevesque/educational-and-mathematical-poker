// ============================================================================
// UI CONTROLLER
// ============================================================================

class UIController {
    constructor(game) {
        this.game = game;
        this.elements = this.cacheElements();
        this.setupEventListeners();
        this.currentBetAmount = 50;
    }

    cacheElements() {
        return {
            // Community cards
            communityCards: Array.from({ length: 5 }, (_, i) =>
                document.getElementById(`community-card-${i}`)
            ),

            // Pot
            potAmount: document.getElementById('pot-amount'),

            // Player seats
            seats: Array.from({ length: 6 }, (_, i) => ({
                container: document.getElementById(`seat-${i}`),
                name: document.querySelector(`#seat-${i} .player-name`),
                stack: document.querySelector(`#seat-${i} .player-stack`),
                cards: document.querySelectorAll(`#seat-${i} .player-cards .card-slot`),
                bet: document.querySelector(`#seat-${i} .player-bet`),
                status: document.querySelector(`#seat-${i} .player-status`),
                dealerButton: document.querySelector(`#seat-${i} .dealer-button`)
            })),

            // Action buttons
            btnFold: document.getElementById('btn-fold'),
            btnCheck: document.getElementById('btn-check'),
            btnCall: document.getElementById('btn-call'),
            btnBet: document.getElementById('btn-bet'),
            btnRaise: document.getElementById('btn-raise'),
            btnAllIn: document.getElementById('btn-all-in'),

            // Bet controls
            betSlider: document.getElementById('bet-slider'),
            betAmountValue: document.getElementById('bet-amount-value'),

            // Action log
            logContent: document.getElementById('log-content'),

            // Modal
            resultModal: document.getElementById('result-modal'),
            resultTitle: document.getElementById('result-title'),
            resultDetails: document.getElementById('result-details'),
            resultClose: document.getElementById('result-close')
        };
    }

    setupEventListeners() {
        // Action buttons
        this.elements.btnFold.addEventListener('click', () => this.game.humanFold());
        this.elements.btnCheck.addEventListener('click', () => this.game.humanCheck());
        this.elements.btnCall.addEventListener('click', () => this.game.humanCall());
        this.elements.btnBet.addEventListener('click', () => this.game.humanBet(this.currentBetAmount));
        this.elements.btnRaise.addEventListener('click', () => this.game.humanRaise(this.currentBetAmount));
        this.elements.btnAllIn.addEventListener('click', () => this.game.humanAllIn());

        // Bet slider
        this.elements.betSlider.addEventListener('input', (e) => {
            this.currentBetAmount = parseInt(e.target.value);
            this.elements.betAmountValue.textContent = this.currentBetAmount;
        });

        // Modal close
        this.elements.resultClose.addEventListener('click', () => {
            this.elements.resultModal.classList.remove('visible');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.game.waitingForHumanAction) return;

            switch (e.key.toLowerCase()) {
                case 'f':
                    this.game.humanFold();
                    break;
                case 'c':
                    if (!this.elements.btnCheck.disabled) {
                        this.game.humanCheck();
                    } else if (!this.elements.btnCall.disabled) {
                        this.game.humanCall();
                    }
                    break;
                case 'b':
                    if (!this.elements.btnBet.disabled) {
                        this.game.humanBet(this.currentBetAmount);
                    }
                    break;
                case 'r':
                    if (!this.elements.btnRaise.disabled) {
                        this.game.humanRaise(this.currentBetAmount);
                    }
                    break;
                case 'a':
                    this.game.humanAllIn();
                    break;
            }
        });
    }

    // ============================================================================
    // RENDERING METHODS
    // ============================================================================

    updatePlayerDisplay(player, seatIndex) {
        const seat = this.elements.seats[seatIndex];
        if (!seat) return;

        // Update stack
        seat.stack.textContent = `$${player.stack}`;

        // Update bet
        const betAmount = this.game.currentBets[player.id] || 0;
        if (betAmount > 0) {
            seat.bet.textContent = `$${betAmount}`;
            seat.bet.classList.add('visible');
        } else {
            seat.bet.classList.remove('visible');
        }

        // Update status
        if (player.lastAction) {
            seat.status.textContent = player.lastAction;
            seat.status.classList.add('visible');
        } else {
            seat.status.classList.remove('visible');
        }

        // Update folded state
        if (player.folded) {
            seat.container.classList.add('folded');
        } else {
            seat.container.classList.remove('folded');
        }

        // Update active state
        if (this.game.currentPlayerIndex === seatIndex && player.canAct()) {
            seat.container.classList.add('active');
        } else {
            seat.container.classList.remove('active');
        }
    }

    updateAllPlayers() {
        for (let i = 0; i < this.game.players.length; i++) {
            this.updatePlayerDisplay(this.game.players[i], i);
        }
    }

    renderCard(card, element) {
        element.innerHTML = '';

        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${card.isRed() ? 'red' : 'black'}`;
        cardDiv.textContent = card.toString();

        element.appendChild(cardDiv);
    }

    renderCardBack(element) {
        element.innerHTML = '';

        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';

        element.appendChild(cardBack);
    }

    clearCard(element) {
        element.innerHTML = '';
    }

    renderHoleCards(player, seatIndex) {
        const seat = this.elements.seats[seatIndex];
        if (!seat) return;

        if (player.isHuman) {
            // Show human player's cards
            player.holeCards.forEach((card, i) => {
                this.renderCard(card, seat.cards[i]);
            });
        } else {
            // Show card backs for bots
            if (player.holeCards.length > 0 && !player.folded) {
                seat.cards.forEach(cardSlot => {
                    this.renderCardBack(cardSlot);
                });
            }
        }
    }

    renderCommunityCards() {
        this.game.communityCards.forEach((card, i) => {
            this.renderCard(card, this.elements.communityCards[i]);
        });
    }

    updatePot() {
        const totalPot = this.game.getCurrentPotSize();
        this.elements.potAmount.textContent = `$${totalPot}`;
    }

    updateDealerButton() {
        // Hide all dealer buttons
        this.elements.seats.forEach(seat => {
            seat.dealerButton.classList.remove('visible');
        });

        // Show dealer button on current dealer
        const dealerSeat = this.elements.seats[this.game.dealerIndex];
        if (dealerSeat) {
            dealerSeat.dealerButton.classList.add('visible');
        }
    }

    updateActionButtons() {
        const human = this.game.players[0];
        const callAmount = this.game.currentBet - (this.game.currentBets[human.id] || 0);
        const canCheck = callAmount === 0;
        const canBet = this.game.currentBet === 0;
        const canRaise = this.game.currentBet > 0;

        // Update button states
        this.elements.btnFold.disabled = !this.game.waitingForHumanAction;
        this.elements.btnCheck.disabled = !this.game.waitingForHumanAction || !canCheck;
        this.elements.btnCall.disabled = !this.game.waitingForHumanAction || canCheck;
        this.elements.btnBet.disabled = !this.game.waitingForHumanAction || !canBet;
        this.elements.btnRaise.disabled = !this.game.waitingForHumanAction || !canRaise;
        this.elements.btnAllIn.disabled = !this.game.waitingForHumanAction;

        // Update call button text
        if (callAmount > 0) {
            this.elements.btnCall.textContent = `Call $${callAmount}`;
        } else {
            this.elements.btnCall.textContent = 'Call';
        }

        // Update bet slider range
        this.elements.betSlider.min = this.game.bigBlind;
        this.elements.betSlider.max = human.stack;
        this.elements.betSlider.value = Math.min(this.currentBetAmount, human.stack);
        this.currentBetAmount = parseInt(this.elements.betSlider.value);
        this.elements.betAmountValue.textContent = this.currentBetAmount;
    }

    addLogEntry(text) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = text;

        this.elements.logContent.appendChild(entry);

        // Auto-scroll to bottom
        this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;

        // Limit log entries to 50
        while (this.elements.logContent.children.length > 50) {
            this.elements.logContent.removeChild(this.elements.logContent.firstChild);
        }
    }

    clearCommunityCards() {
        this.elements.communityCards.forEach(slot => {
            this.clearCard(slot);
        });
    }

    clearAllCards() {
        this.clearCommunityCards();
        this.elements.seats.forEach(seat => {
            seat.cards.forEach(cardSlot => {
                this.clearCard(cardSlot);
            });
        });
    }

    showHandResult(results, handEvaluations) {
        let html = '<div style="margin-bottom: 20px;">';

        // Show each player's hand
        for (let player of this.game.players) {
            if (player.folded) continue;

            const evaluation = handEvaluations[player.id];

            // Find results for this player
            const playerResults = results.filter(r => r.playerId === player.id);
            const totalWon = playerResults.filter(r => r.type === 'win').reduce((sum, r) => sum + r.amount, 0);
            const totalReturned = playerResults.filter(r => r.type === 'return').reduce((sum, r) => sum + r.amount, 0);

            html += `<div style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">`;
            html += `<div style="font-weight: 600; color: #fbbf24; margin-bottom: 4px;">${player.name}</div>`;
            html += `<div style="color: rgba(255,255,255,0.8);">${HandEvaluator.getHandDescription(evaluation)}</div>`;

            if (totalWon > 0) {
                html += `<div style="font-weight: 700; color: #10b981; margin-top: 4px;">Won $${totalWon}</div>`;
            }

            if (totalReturned > 0) {
                html += `<div style="font-weight: 600; color: #60a5fa; margin-top: 4px; font-size: 0.9em;">(Returned uncalled bet: $${totalReturned})</div>`;
            }

            html += `</div>`;
        }

        html += '</div>';

        this.elements.resultTitle.textContent = 'Showdown';
        this.elements.resultDetails.innerHTML = html;
        this.elements.resultModal.classList.add('visible');

        // Show all bot cards during showdown
        for (let i = 0; i < this.game.players.length; i++) {
            const player = this.game.players[i];
            if (!player.folded && !player.isHuman) {
                const seat = this.elements.seats[i];
                player.holeCards.forEach((card, cardIndex) => {
                    this.renderCard(card, seat.cards[cardIndex]);
                });
            }
        }
    }

    showSinglePlayerWin(winner, pot) {
        const html = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 20px; font-weight: 600; color: #fbbf24; margin-bottom: 12px;">
          ${winner.name} wins!
        </div>
        <div style="font-size: 24px; font-weight: 700; color: #10b981;">
          $${pot}
        </div>
        <div style="margin-top: 12px; color: rgba(255,255,255,0.7);">
          All other players folded
        </div>
      </div>
    `;

        this.elements.resultTitle.textContent = 'Hand Complete';
        this.elements.resultDetails.innerHTML = html;
        this.elements.resultModal.classList.add('visible');
    }

    // ============================================================================
    // GAME EVENT HANDLERS
    // ============================================================================

    handleGameEvent(event, data) {
        switch (event) {
            case 'playersInitialized':
                this.updateAllPlayers();
                this.updateDealerButton();
                break;

            case 'newHand':
                this.clearAllCards();
                this.updateDealerButton();
                this.updatePot();
                this.addLogEntry(`<span style="color: #fbbf24; font-weight: 600;">━━━ Hand #${data.handNumber} ━━━</span>`);
                break;

            case 'blindsPosted':
                this.updateAllPlayers();
                this.updatePot();
                break;

            case 'holeCardsDealt':
                for (let i = 0; i < this.game.players.length; i++) {
                    this.renderHoleCards(this.game.players[i], i);
                }
                break;

            case 'playerTurn':
                this.updateAllPlayers();
                this.updateActionButtons();
                break;

            case 'actionProcessed':
                this.updatePlayerDisplay(data.player, this.game.players.indexOf(data.player));
                this.updatePot();
                break;

            case 'actionLogged':
                let logText = `<span class="player-name">${data.player}</span> ${data.action}`;
                if (data.amount) {
                    logText += ` <span class="amount">$${data.amount}</span>`;
                }
                this.addLogEntry(logText);
                break;

            case 'bettingRoundComplete':
                this.updatePot();
                // Clear current bets display
                this.elements.seats.forEach(seat => {
                    seat.bet.classList.remove('visible');
                });
                break;

            case 'flopDealt':
                this.renderCommunityCards();
                this.addLogEntry(`<span style="color: #3b82f6; font-weight: 600;">Flop dealt</span>`);
                break;

            case 'turnDealt':
                this.renderCommunityCards();
                this.addLogEntry(`<span style="color: #3b82f6; font-weight: 600;">Turn dealt</span>`);
                break;

            case 'riverDealt':
                this.renderCommunityCards();
                this.addLogEntry(`<span style="color: #3b82f6; font-weight: 600;">River dealt</span>`);
                break;

            case 'showdown':
                this.addLogEntry(`<span style="color: #fbbf24; font-weight: 600;">Showdown!</span>`);
                break;

            case 'potsDistributed':
                this.showHandResult(data.results, data.handEvaluations);
                this.updateAllPlayers();
                break;

            case 'singlePlayerWin':
                this.showSinglePlayerWin(data.winner, data.pot);
                this.updateAllPlayers();
                break;

            case 'handComplete':
                // Reset player statuses
                this.elements.seats.forEach(seat => {
                    seat.status.classList.remove('visible');
                });
                break;

            case 'gameOver':
                const html = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 24px; font-weight: 700; color: #fbbf24; margin-bottom: 16px;">
              Game Over!
            </div>
            <div style="font-size: 20px; color: #10b981;">
              ${data.winner.name} wins the game!
            </div>
          </div>
        `;
                this.elements.resultTitle.textContent = 'Victory!';
                this.elements.resultDetails.innerHTML = html;
                this.elements.resultModal.classList.add('visible');
                break;
        }
    }
}

// ============================================================================
// INITIALIZE GAME
// ============================================================================

let game;
let ui;

window.addEventListener('DOMContentLoaded', () => {
    // Create game instance
    game = new TexasHoldemGame((event, data) => {
        ui.handleGameEvent(event, data);
    });

    // Create UI controller
    ui = new UIController(game);

    // Initialize players
    game.initializePlayers();

    // Start first hand
    setTimeout(() => {
        game.startNewHand();
    }, 1000);
});
