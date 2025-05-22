document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:5000'); // Ensure this matches your backend host and port

    // Screens
    const screens = {
        initialSetup: document.getElementById('initial-setup-screen'),
        modeSelect: document.getElementById('mode-select-screen'),
        singlePlayerCategorySelect: document.getElementById('singleplayer-category-select-screen'), // New screen
        headToHeadConfig: document.getElementById('head-to-head-config-screen'),
        multiplayerConfig: document.getElementById('multiplayer-config-screen'),
        multiplayerHostOptions: document.getElementById('multiplayer-host-options-screen'),
        gameLobby: document.getElementById('game-lobby-screen'),
        question: document.getElementById('question-screen'),
        gameOver: document.getElementById('game-over-screen'),
        leaderboard: document.getElementById('leaderboard-screen'),
        h2hGameFlexContainer: document.getElementById('h2h-game-flex-container'), // Added for H2H flex screen
    };

    // Buttons and Inputs
    const playerNameInput = document.getElementById('player-name');
    const goToModeSelectBtn = document.getElementById('go-to-mode-select');

    const modeButtons = document.querySelectorAll('.mode-button');
    const backToModeSelectBtns = document.querySelectorAll('.back-to-mode-select');

    // Single Player
    const categorySelectionArea = document.getElementById('category-selection-area');
    const selectAllCategoriesCheckbox = document.getElementById('select-all-categories');
    const startSinglePlayerWithCategoriesBtn = document.getElementById('start-singleplayer-with-categories');

    // Head-to-Head
    const h2hPrimaryActionSelect = document.getElementById('h2h-primary-action-select');
    const h2hJoinOptionsContainer = document.getElementById('h2h-join-options-container');
    const h2hGameIdInput = document.getElementById('h2h-game-id-input');
    const h2hCreateOptionsContainer = document.getElementById('h2h-create-options-container');
    const h2hOpponentSelectContainer = document.getElementById('h2h-opponent-select-container'); // Corrected variable name
    const h2hOpponentTypeSelect = document.getElementById('h2h-opponent-type-select');
    const h2hCategorySelect = document.getElementById('h2h-category-select');
    const h2hBotLevelOptionsContainer = document.getElementById('h2h-bot-level-options-container'); // Corrected variable name
    const h2hBotLevelSelect = document.getElementById('h2h-bot-level-select');
    const h2hFinalActionButton = document.getElementById('h2h-final-action-button');
    const h2hWaitingForPlayerDiv = document.getElementById('h2h-waiting-for-player');
    const h2hRoomCodeDisplay = document.getElementById('h2h-room-code-display');

    // Multiplayer
    const createMultiplayerRoomBtn = document.getElementById('create-multiplayer-room-btn');
    const multiplayerGameIdJoinInput = document.getElementById('multiplayer-game-id-join');
    const joinMultiplayerRoomBtn = document.getElementById('join-multiplayer-room-btn');
    const numBotsMultiplayerInput = document.getElementById('num-bots-multiplayer');
    const multiplayerRoomIdDisplay = document.getElementById('multiplayer-room-id-display');
    const hostRoomIdSpan = document.getElementById('host-room-id');
    const finalizeMultiplayerRoomSetupBtn = document.getElementById('finalize-multiplayer-room-setup');
    const multiplayerLobbyPlayersUl = document.getElementById('multiplayer-lobby-players');


    // Game Lobby
    const lobbyGameIdSpan = document.getElementById('lobby-game-id');
    const lobbyGameModeSpan = document.getElementById('lobby-game-mode');
    const lobbyPlayerCountSpan = document.getElementById('lobby-player-count');
    const lobbyMaxPlayersSpan = document.getElementById('lobby-max-players');
    const lobbyPlayersListUl = document.getElementById('lobby-players-list-ul');
    const startGameButton = document.getElementById('start-game-button');
    const waitingForHostMessage = document.getElementById('waiting-for-host-message');
    const leaveLobbyButton = document.querySelector('#game-lobby-screen .leave-lobby-button');


    // Question Screen
    const questionCounterSpan = document.getElementById('question-counter');
    const timerSpan = document.getElementById('timer');
    const currentScoreSpan = document.getElementById('current-score');
    const questionTextElem = document.getElementById('question-text');
    const questionCategoryImageContainer = document.getElementById('question-category-image-container');
    const answerButtons = document.querySelectorAll('#question-screen .answer-button'); // Scoped to question-screen
    const feedbackMessageElem = document.getElementById('feedback-message');

    // H2H Question Screen elements (New)
    const h2hQuestionCounterSpan = document.getElementById('h2h-question-counter');
    const h2hTimerSpan = document.getElementById('h2h-timer');
    const h2hCurrentScoreSpan = document.getElementById('h2h-current-score');
    const h2hQuestionTextElem = document.getElementById('h2h-question-text');
    const h2hQuestionCategoryImageContainer = document.getElementById('h2h-question-category-image-container');
    const h2hAnswerButtons = document.querySelectorAll('.h2h-question-area .answer-button'); // Scoped to .h2h-question-area CLASS
    const h2hFeedbackMessageElem = document.getElementById('h2h-feedback-message');

    // Game Over
    const finalScoresDiv = document.getElementById('final-scores'); // New container for scores
    const winnerMessageContainer = document.getElementById('winner-message-container'); // New container for winner message
    const playAgainBtn = document.getElementById('play-again-btn'); // Corrected ID
    const backToMainMenuBtn = document.getElementById('back-to-main-menu-from-game-over-btn'); // Corrected ID

    // Leaderboard
    const showLeaderboardInitialBtn = document.getElementById('show-leaderboard-initial');
    const showLeaderboardGameOverBtn = document.getElementById('show-leaderboard-gameover');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const backFromLeaderboardBtn = document.getElementById('back-from-leaderboard');

    // Chat (specific to H2H screen now)
    const h2hChatContainer = document.getElementById('h2h-chat-container');
    const h2hChatMessagesDiv = document.getElementById('h2h-chat-messages');
    const h2hChatMessageInput = document.getElementById('h2h-chat-message-input');
    const h2hSendChatMessageBtn = document.getElementById('h2h-send-chat-message-btn');

    // Exit Game Buttons (Class-based)
    const exitGameBtns = document.querySelectorAll('.exit-game-trigger');


    let currentPlayerName = '';
    let currentGameId = null;
    let currentGameMode = '';
    let isHost = false;
    let currentQuestionData = null;
    let playerScore = 0;
    let questionTimerInterval;
    let lastScreen = null; // For leaderboard back button
    let interQuestionInterval; // Timer for the 5-second wait period

    // --- Navigation ---
    function showScreen(screenName) {
        console.log("Showing screen:", screenName);
        for (const key in screens) {
            screens[key].classList.remove('active');
        }
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
            if (screenName !== 'leaderboard') { // Don't overwrite if going to leaderboard
                lastScreen = screenName;
            }
        } else {
            console.error("Screen not found:", screenName);
        }

        // Show/Hide H2H chat container based on screen
        if (h2hChatContainer) {
            if (screenName === 'h2hGameFlexContainer') {
                h2hChatContainer.style.display = 'block';
            } else {
                h2hChatContainer.style.display = 'none';
            }
        }
    }

    goToModeSelectBtn.addEventListener('click', () => {
        currentPlayerName = playerNameInput.value.trim() || 'Anonymous';
        playerNameInput.disabled = true; // Prevent name change mid-session
        showScreen('modeSelect');
    });

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            currentGameMode = mode;
            if (h2hChatContainer) h2hChatContainer.style.display = 'none'; // Hide H2H chat by default

            if (mode === 'singleplayer') {
                showScreen('singlePlayerCategorySelect'); // New screen
                fetchCategories(); // Fetch categories when entering this screen
            } else if (mode === 'head_to_head') {
                showScreen('headToHeadConfig');
                fetchAndPopulateH2HCategories(); // Populate categories for H2H
                updateH2HConfigScreenUI(); // New function to handle UI changes
                if (h2hWaitingForPlayerDiv) h2hWaitingForPlayerDiv.style.display = 'none'; // Hide waiting message
            } else if (mode === 'multiplayer') {
                showScreen('multiplayerConfig');
                multiplayerGameIdJoinInput.value = '';
            }
        });
    });

    backToModeSelectBtns.forEach(button => {
        button.addEventListener('click', () => {
            resetGameStatePartial();
            showScreen('modeSelect');
        });
    });

    if(leaveLobbyButton) {
        leaveLobbyButton.addEventListener('click', () => {
            if (currentGameId) {
                socket.emit('leave_game', { game_id: currentGameId }); // Server should handle this
                console.log("Emitted leave_game for game:", currentGameId);
            }
            resetGameStateFull();
            showScreen('modeSelect');
        });
    }


    // --- Single Player ---
    async function fetchCategories() {
        try {
            const response = await fetch('http://localhost:5000/api/categories');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const categories = await response.json();
            populateCategorySelection(categories);
        } catch (error) {
            console.error("Could not fetch categories:", error);
            categorySelectionArea.innerHTML = '<p>Error loading categories. Please try again.</p>';
        }
    }

    function populateCategorySelection(categories) {
        // Clear previous categories except for the "All Categories" checkbox
        while (categorySelectionArea.children.length > 1) {
            categorySelectionArea.removeChild(categorySelectionArea.lastChild);
        }

        categories.forEach(category => {
            const label = document.createElement('label');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = category;
            checkbox.name = 'category';
            checkbox.classList.add('category-checkbox');
            
            const textNode = document.createTextNode(category);
            
            label.appendChild(checkbox);
            label.appendChild(textNode); 
            categorySelectionArea.appendChild(label);
        });

        if (selectAllCategoriesCheckbox) {
            selectAllCategoriesCheckbox.checked = true; // Default to all selected
            toggleAllCategories(); // Ensure individual boxes match
            selectAllCategoriesCheckbox.onchange = toggleAllCategories;
        }
    }

    function toggleAllCategories() {
        const checkboxes = document.querySelectorAll('.category-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCategoriesCheckbox.checked;
        });
    }

    if (startSinglePlayerWithCategoriesBtn) {
        startSinglePlayerWithCategoriesBtn.addEventListener('click', () => {
            const selectedCategories = [];
            const checkboxes = document.querySelectorAll('.category-checkbox:checked');
            checkboxes.forEach(checkbox => {
                selectedCategories.push(checkbox.value);
            });

            if (selectedCategories.length === 0 && !selectAllCategoriesCheckbox.checked) {
                alert('Please select at least one category or choose "All Categories".');
                return;
            }

            isHost = true;
            socket.emit('create_game', {
                name: currentPlayerName,
                game_mode: 'singleplayer',
                categories: selectAllCategoriesCheckbox.checked ? ['all'] : selectedCategories // Send 'all' or specific list
            });
        });
    }

    // --- Head-to-Head ---
    function updateH2HConfigScreenUI() {
        if (!h2hPrimaryActionSelect || !h2hJoinOptionsContainer || !h2hCreateOptionsContainer || !h2hFinalActionButton || !h2hBotLevelOptionsContainer || !h2hOpponentTypeSelect) {
            console.error("H2H config UI elements missing for update.");
            return;
        }

        const selectedAction = h2hPrimaryActionSelect.value;

        if (selectedAction === 'join') {
            h2hJoinOptionsContainer.style.display = 'block';
            h2hCreateOptionsContainer.style.display = 'none';
            h2hFinalActionButton.textContent = 'Join Game';
        } else { // 'create'
            h2hJoinOptionsContainer.style.display = 'none';
            h2hCreateOptionsContainer.style.display = 'block';
            h2hFinalActionButton.textContent = 'Create Game';

            // Show/hide bot level based on opponent type within create options
            if (h2hOpponentTypeSelect.value === 'bot') {
                h2hBotLevelOptionsContainer.style.display = 'block';
            } else {
                h2hBotLevelOptionsContainer.style.display = 'none';
            }
        }
        h2hFinalActionButton.disabled = false; // Ensure button is enabled when switching options
        if (h2hWaitingForPlayerDiv) h2hWaitingForPlayerDiv.style.display = 'none'; // Hide waiting message
    }

    if (h2hPrimaryActionSelect) {
        h2hPrimaryActionSelect.addEventListener('change', updateH2HConfigScreenUI);
    }

    if (h2hOpponentTypeSelect) {
        h2hOpponentTypeSelect.addEventListener('change', () => {
            if (h2hPrimaryActionSelect.value === 'create') { // Only relevant if creating a game
                updateH2HConfigScreenUI(); // Re-run to show/hide bot level based on new opponent type
            }
        });
    }

    async function fetchAndPopulateH2HCategories() {
        try {
            const response = await fetch('http://localhost:5000/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const categories = await response.json();
            if (!h2hCategorySelect) {
                console.error("H2H Category select dropdown not found!");
                return;
            }
            h2hCategorySelect.innerHTML = ''; // Clear existing options

            // Add "All Categories" option
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.textContent = 'All Categories';
            h2hCategorySelect.appendChild(allOpt);

            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                h2hCategorySelect.appendChild(opt);
            });
        } catch (e) {
            console.error("Error fetching H2H categories:", e);
            h2hCategorySelect.innerHTML = '<option value="all">All Categories</option>'; // Fallback
        }
    }

    if (h2hFinalActionButton) {
        h2hFinalActionButton.addEventListener('click', () => {
            const action = h2hPrimaryActionSelect.value;

            if (action === 'create') {
                isHost = true;
                const selectedCategory = h2hCategorySelect.value;
                const opponentType = h2hOpponentTypeSelect.value;

                let gameConfig = {
                    name: currentPlayerName,
                    game_mode: 'head_to_head',
                    max_players: 2,
                    categories: [selectedCategory],
                };

                if (opponentType === 'bot') {
                    gameConfig.num_bots = 1;
                    gameConfig.bot_level = h2hBotLevelSelect.value || 'easy';
                } else { // Opponent is 'player'
                    gameConfig.num_bots = 0;
                }

                socket.emit('create_game', gameConfig);
                if (h2hChatContainer) h2hChatContainer.style.display = 'block';

                if (opponentType === 'player') {
                    if (h2hWaitingForPlayerDiv) h2hWaitingForPlayerDiv.style.display = 'block';
                    if (h2hFinalActionButton) h2hFinalActionButton.disabled = true;
                }
            } else if (action === 'join') {
                const gameIdToJoin = h2hGameIdInput.value.trim();
                if (gameIdToJoin) {
                    isHost = false;
                    socket.emit('join_game', {
                        name: currentPlayerName,
                        game_id: gameIdToJoin
                    });
                    if (h2hChatContainer) h2hChatContainer.style.display = 'block';
                } else {
                    alert('Please enter a Game ID to join.');
                }
            }
        });
    }

    // --- Multiplayer ---
    createMultiplayerRoomBtn.addEventListener('click', () => {
        isHost = true;
        socket.emit('create_game', {
            name: currentPlayerName,
            game_mode: 'multiplayer',
            max_players: 8 // Default for multiplayer
        });
    });

    socket.on('game_created', (data) => {
        currentGameId = data.game_id;
        console.log('Game created:', data);

        if (data.game_mode === 'head_to_head' && isHost && data.num_bots === 0) {
            if (h2hRoomCodeDisplay) h2hRoomCodeDisplay.textContent = data.game_id;
        } else if (data.game_mode === 'multiplayer' && isHost) {
            multiplayerRoomIdDisplay.textContent = currentGameId;
            hostRoomIdSpan.textContent = currentGameId;
            numBotsMultiplayerInput.value = "0"; // Reset
            updateMultiplayerLobbyPlayers(data.players || [{name: currentPlayerName, score:0, sid: socket.id, is_bot: false, is_host: true}]);
            showScreen('multiplayerHostOptions');
        } else {
            setupLobbyScreen(data.game_id, data.game_mode, data.players || [], isHost, data.max_players);
            showScreen('gameLobby');
            if (isHost && (data.game_mode === 'singleplayer' || (data.game_mode === 'head_to_head' && data.num_bots > 0))) {
                startGameButton.style.display = 'none'; // Hide start button
                waitingForHostMessage.textContent = 'Starting game...';
                socket.emit('start_game', { game_id: currentGameId });
            } else if (!isHost && data.game_mode === 'head_to_head') {
                waitingForHostMessage.textContent = 'Waiting for host to start the game...';
            }
        }
    });

    finalizeMultiplayerRoomSetupBtn.addEventListener('click', () => {
        if (!isHost || !currentGameId) return;
        const numBots = parseInt(numBotsMultiplayerInput.value) || 0;
        console.log(`Host starting multiplayer game ${currentGameId} from host options screen.`);
        socket.emit('start_game', { game_id: currentGameId });
    });

    joinMultiplayerRoomBtn.addEventListener('click', () => {
        const gameIdToJoin = multiplayerGameIdJoinInput.value.trim();
        if (gameIdToJoin) {
            isHost = false;
            socket.emit('join_game', {
                name: currentPlayerName,
                game_id: gameIdToJoin
            });
        } else {
            alert('Please enter a Game ID to join.');
        }
    });

    function setupLobbyScreen(gameId, mode, players, isClientHost, maxPlayers) {
        currentGameId = gameId;
        lobbyGameIdSpan.textContent = gameId;
        lobbyGameModeSpan.textContent = mode.replace('_', ' ');
        isHost = isClientHost; // Update global isHost based on this specific game join/create

        updateLobbyPlayersList(players);

        if (isHost) {
            if (mode === 'head_to_head' && players.length < 2) {
                startGameButton.style.display = 'none';
                waitingForHostMessage.textContent = 'Waiting for opponent to join...';
                waitingForHostMessage.style.display = 'block';
            } else {
                startGameButton.style.display = 'block';
                waitingForHostMessage.style.display = 'none';
            }
        } else {
            startGameButton.style.display = 'none';
            waitingForHostMessage.textContent = 'Waiting for host to start the game...';
            waitingForHostMessage.style.display = 'block';
        }
        lobbyMaxPlayersSpan.textContent = maxPlayers || (mode === 'singleplayer' ? 1 : (mode === 'head_to_head' ? 2 : 8));
    }

    function updateLobbyPlayersList(players) {
        lobbyPlayersListUl.innerHTML = '';
        players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-entry';
            let displayName = player.name;
            if (player.is_bot) {
                li.classList.add('is-bot');
                displayName += " (Bot)";
            }
            if (player.sid === socket.id && isHost) { // Check if current client is the host
                 li.classList.add('is-host');
                 displayName += " (Host)";
            }
            li.textContent = displayName;
            lobbyPlayersListUl.appendChild(li);
        });
        lobbyPlayerCountSpan.textContent = players.filter(p => !p.is_bot).length; // Count human players

        if (screens.multiplayerHostOptions.classList.contains('active')) {
            updateMultiplayerLobbyPlayers(players);
        }
    }

    function updateMultiplayerLobbyPlayers(players) {
        multiplayerLobbyPlayersUl.innerHTML = '';
         players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-entry';
            let displayName = player.name;
            if (player.is_bot) {
                li.classList.add('is-bot');
                displayName += " (Bot)";
            }
            if (player.sid === socket.id && isHost) { 
                li.classList.add('is-host');
                displayName = `<strong>${displayName} (You, Host)</strong>`;
            } else if (player.is_host) { 
                 li.classList.add('is-host');
                 displayName = `<strong>${displayName} (Host)</strong>`;
            }

            li.innerHTML = displayName; 
            multiplayerLobbyPlayersUl.appendChild(li);
        });
    }

    socket.on('game_joined', (data) => {
        console.log('Game joined:', data);
        setupLobbyScreen(data.game_id, currentGameMode, data.players, false, data.max_players); 
        showScreen('gameLobby');
        if (data.chat_history) {
            data.chat_history.forEach(msg => displayChatMessage(msg));
        }
    });

    socket.on('player_joined', (data) => {
        console.log('Player joined:', data);
        if (screens.gameLobby.classList.contains('active') || screens.multiplayerHostOptions.classList.contains('active')) {
            updateLobbyPlayersList(data.players);
            lobbyMaxPlayersSpan.textContent = data.max_players || lobbyMaxPlayersSpan.textContent;

            if (isHost && currentGameMode === 'head_to_head' && data.players.length === 2) {
                if (screens.gameLobby.classList.contains('active')) { // Host is on lobby screen
                    if(startGameButton) startGameButton.style.display = 'block';
                    if(waitingForHostMessage) waitingForHostMessage.style.display = 'none';
                } else if (screens.headToHeadConfig.classList.contains('active')) {
                    setupLobbyScreen(currentGameId, currentGameMode, data.players, true, data.max_players);
                    showScreen('gameLobby');
                    if(startGameButton) startGameButton.style.display = 'block';
                    if(waitingForHostMessage) waitingForHostMessage.style.display = 'none';
                    if(h2hWaitingForPlayerDiv) h2hWaitingForPlayerDiv.style.display = 'none';
                    if(h2hFinalActionButton) h2hFinalActionButton.disabled = false; // Re-enable config action button
                }
            }
        }
    });

    socket.on('player_left', (data) => {
        console.log('Player left:', data.name);
        if (screens.gameLobby.classList.contains('active') || screens.multiplayerHostOptions.classList.contains('active')) {
            let playerToRemove;
            if (screens.gameLobby.classList.contains('active')) {
                playerToRemove = Array.from(lobbyPlayersListUl.children).find(li => li.textContent.includes(data.name));
            } else if (screens.multiplayerHostOptions.classList.contains('active')) {
                playerToRemove = Array.from(multiplayerLobbyPlayersUl.children).find(li => li.textContent.includes(data.name));
            }
            if (playerToRemove) playerToRemove.remove();
            lobbyPlayerCountSpan.textContent = parseInt(lobbyPlayerCountSpan.textContent) -1; 
        }
    });

    startGameButton.addEventListener('click', () => {
        if (isHost && currentGameId) {
            socket.emit('start_game', { game_id: currentGameId });
        }
    });

    // --- Game Logic ---

    function displayQuestion(q) {
        let targetQuestionTextElem, targetQuestionCounterSpan, targetFeedbackElem, targetAnswersGridBtns, targetImageContainer;

        if (currentGameMode === 'head_to_head') {
            targetQuestionTextElem = h2hQuestionTextElem;
            targetQuestionCounterSpan = h2hQuestionCounterSpan;
            targetFeedbackElem = h2hFeedbackMessageElem;
            targetAnswersGridBtns = h2hAnswerButtons;
            targetImageContainer = h2hQuestionCategoryImageContainer;
        } else {
            targetQuestionTextElem = questionTextElem;
            targetQuestionCounterSpan = questionCounterSpan;
            targetFeedbackElem = feedbackMessageElem;
            targetAnswersGridBtns = answerButtons;
            targetImageContainer = questionCategoryImageContainer;
        }

        if (!targetQuestionTextElem || !targetQuestionCounterSpan || !targetFeedbackElem || !targetAnswersGridBtns || !targetImageContainer) {
            console.error("[displayQuestion] Critical UI elements not found for mode:", currentGameMode);
            return;
        }

        targetQuestionTextElem.textContent = q.question;
        targetQuestionCounterSpan.textContent = `Q: ${q.question_number}/${q.total_questions}`;
        targetFeedbackElem.textContent = '';
        targetFeedbackElem.className = ''; 

        console.log("[displayQuestion] Received category from backend:", q.category); 
        targetImageContainer.innerHTML = ''; // Clear previous image or text

        const categoryImageMapping = { 
            "NBA": "NBA",
            "Premier League": "Premier_League", 
            "International Football": "International" 
        };

        const categoryImageLists = {
            "NBA": ["doncic_sga.jpg", "ja.jpg", "jordan.jpg", "kobe.jpg", "kyrie_7.jpg", "lakers_old.jpg", "lbj_curry.jpg", "logo.png"],
            "Premier_League": ["adebayor.jpg", "aguero.jpg", "arsenal.jpg", "chris_manu.jpg", "drogba.jpg", "League_cup.jpg", "sheahrer.jpg"],
            "International": ["dejong.jpg", "donovan.jpg", "Maradona_hand_of_god.jpg", "messi.jpg", "ronaldo.jpg", "torres.jpg", "world_cup.png", "zidane.jpg"]
        };

        const imageFolderName = categoryImageMapping[q.category];
        console.log("[displayQuestion] Mapped to folder name:", imageFolderName); 

        if (imageFolderName && categoryImageLists[imageFolderName] && categoryImageLists[imageFolderName].length > 0) {
            const imageList = categoryImageLists[imageFolderName];
            const imageName = imageList[Math.floor(Math.random() * imageList.length)];
            const imagePath = `photos/${imageFolderName}/${imageName}`;
            console.log("[displayQuestion] Attempting to load random image from path:", imagePath); 

            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = q.category; 
            img.classList.add('question-category-image');

            img.onload = () => {
                console.log("[displayQuestion] Image loaded successfully:", imagePath);
            };
            img.onerror = () => {
                console.error("[displayQuestion] Error loading image at path:", imagePath);
                targetImageContainer.innerHTML = '';
                const categoryText = document.createElement('p');
                categoryText.textContent = `Category: ${q.category} (Image not found at ${imagePath})`;
                categoryText.classList.add('question-category-text-fallback');
                targetImageContainer.appendChild(categoryText);
            };
            targetImageContainer.appendChild(img);
        } else {
            console.log("[displayQuestion] No image folder mapping found for category:", q.category);
            const categoryText = document.createElement('p');
            categoryText.textContent = `Category: ${q.category}`;
            categoryText.classList.add('question-category-text-fallback');
            targetImageContainer.appendChild(categoryText);
        }

        targetAnswersGridBtns.forEach((button, index) => {
            button.textContent = q.answers[index];
            button.disabled = false;
            button.className = 'answer-button'; // Reset classes
            button.onclick = () => handleAnswerSubmit(q.answers[index], button); // Pass the button itself
        });
    }

    function handleAnswerSubmit(answer, clickedButton) { // Added clickedButton parameter
        clearInterval(questionTimerInterval);
        const currentAnswerButtons = currentGameMode === 'head_to_head' ? h2hAnswerButtons : answerButtons;
        
        // Disable all buttons and highlight the selected one
        currentAnswerButtons.forEach(button => {
            button.disabled = true;
            if (button === clickedButton) {
                button.classList.add('selected-answer'); // New class for highlighting
            }
        });

        socket.emit('submit_answer', {
            game_id: currentGameId,
            answer: answer,
            timestamp: new Date().toISOString() // Add timestamp
        });
    }

    socket.on('game_started', (data) => {
        console.log('Game started:', data);
        playerScore = 0; 
        updateScoreDisplay();
        if (currentGameMode === 'head_to_head') {
            showScreen('h2hGameFlexContainer');
            if (h2hChatContainer) h2hChatContainer.style.display = 'block'; // Ensure H2H chat is visible
        } else if (currentGameMode === 'multiplayer') {
            showScreen('question');
        } else {
            showScreen('question');
        }
    });

    socket.on('new_question', (question) => {
        console.log('New question:', question);
        currentQuestionData = question;
        clearTimeout(interQuestionInterval); // Clear any existing inter-question timer
        displayQuestion(question);
        startTimer(question.time_per_question || 15); // Use time_per_question from question data or default
    });

    socket.on('answer_result', (data) => {
        console.log('Answer result:', data);
        playerScore = data.your_total_score; 
        updateScoreDisplay();

        const currentAnswerButtons = currentGameMode === 'head_to_head' ? h2hAnswerButtons : answerButtons;
        const currentFeedbackElem = currentGameMode === 'head_to_head' ? h2hFeedbackMessageElem : feedbackMessageElem;

        // Highlight the correct answer regardless of selection
        currentAnswerButtons.forEach(button => {
            if (button.textContent === data.correct_answer) {
                button.classList.add('correct');
            }
        });

        if (data.correct) {
            currentFeedbackElem.textContent = `Correct! +${data.score_earned} points.`;
            currentFeedbackElem.className = 'feedback-correct';
        } else {
            currentFeedbackElem.textContent = `Wrong! The correct answer was: ${data.correct_answer}`;
            currentFeedbackElem.className = 'feedback-wrong';
        }
    });

    socket.on('show_answer_period_start', (data) => {
        console.log("Show answer period started:", data);
        clearInterval(questionTimerInterval); // Stop the question timer

        const currentAnswerButtons = currentGameMode === 'head_to_head' ? h2hAnswerButtons : answerButtons;
        const currentFeedbackElem = currentGameMode === 'head_to_head' ? h2hFeedbackMessageElem : feedbackMessageElem;
        const currentTimerSpan = currentGameMode === 'head_to_head' ? h2hTimerSpan : timerSpan;

        // Ensure all buttons are disabled
        currentAnswerButtons.forEach(button => {
            button.disabled = true;
            if (button.textContent === data.correct_answer) {
                button.classList.add('correct');
            } else {
                button.classList.remove('correct');
            }
        });

        if (currentFeedbackElem) {
            if (!currentFeedbackElem.textContent.includes("Correct answer was")) {
                 currentFeedbackElem.textContent = `The correct answer was: ${data.correct_answer}.`;
            }
            currentFeedbackElem.textContent += ` Next question in ${data.duration}s...`;
        }
        
        if(currentTimerSpan) currentTimerSpan.textContent = `Next in: ${data.duration}s`;

        let countdown = data.duration;
        clearTimeout(interQuestionInterval);
        interQuestionInterval = setInterval(() => {
            countdown--;
            if(currentTimerSpan) currentTimerSpan.textContent = `Next in: ${countdown}s`;
            if (countdown <= 0) {
                clearInterval(interQuestionInterval);
                if(currentTimerSpan) currentTimerSpan.textContent = "Loading...";
            }
        }, 1000);
    });

    socket.on('update_scores', (data) => {
        console.log('Scores updated:', data);
        if (screens.gameLobby.classList.contains('active') || screens.multiplayerHostOptions.classList.contains('active')) {
            if (data.player_list) { 
                updateLobbyPlayersListWithScores(data.player_list); 
            }
        }
    });

    function updateLobbyPlayersListWithScores(players) {
        lobbyPlayersListUl.innerHTML = ''; 
        players.forEach(player => {
            const li = document.createElement('li');
            let text = `${player.name}: ${player.score}`;
            if (player.is_bot) text += " (Bot)";
            if (player.sid === socket.id && isHost) text += " (Host)";
            li.textContent = text;
            lobbyPlayersListUl.appendChild(li);
        });
    }


    function startTimer(duration) {
        let timeLeft = duration;
        const currentTimerSpan = currentGameMode === 'head_to_head' ? h2hTimerSpan : timerSpan;
        const currentAnswerButtons = currentGameMode === 'head_to_head' ? h2hAnswerButtons : answerButtons;
        const currentFeedbackElem = currentGameMode === 'head_to_head' ? h2hFeedbackMessageElem : feedbackMessageElem;

        if (currentTimerSpan) currentTimerSpan.textContent = `Time: ${timeLeft}s`;

        clearInterval(questionTimerInterval);
        clearTimeout(interQuestionInterval);

        questionTimerInterval = setInterval(() => {
            timeLeft--;
            if (currentTimerSpan) currentTimerSpan.textContent = `Time: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(questionTimerInterval);
                if (currentTimerSpan) currentTimerSpan.textContent = "Time's up!";
                let answerSubmitted = false;
                currentAnswerButtons.forEach(button => {
                    if (button.classList.contains('selected-answer')) {
                        answerSubmitted = true;
                    }
                    button.disabled = true;
                });
                if (!answerSubmitted) {
                    if (currentFeedbackElem) {
                        currentFeedbackElem.textContent = "Time's up! No answer submitted.";
                        currentFeedbackElem.className = 'feedback-wrong';
                    }
                    socket.emit('submit_answer', { game_id: currentGameId, answer: "__TIMEOUT__", timestamp: new Date().toISOString() });
                } 
            }
        }, 1000);
    }

    function updateScoreDisplay() {
        if (currentGameMode === 'head_to_head') {
            if(h2hCurrentScoreSpan) h2hCurrentScoreSpan.textContent = `Score: ${playerScore}`;
        } else {
            if(currentScoreSpan) currentScoreSpan.textContent = `Score: ${playerScore}`;
        }
    }

    exitGameBtns.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Exit Game button clicked');
            if (socket && socket.connected) {
                socket.emit('leave_game', { game_id: currentGameId }); // Send game_id when leaving
                console.log('Emitted leave_game event for game:', currentGameId);
            }
            if (questionTimerInterval) {
                clearInterval(questionTimerInterval);
                questionTimerInterval = null;
                console.log('Question timer cleared');
            }
            resetGameStatePartial(); // Reset some game state
            showScreen('modeSelect');
            console.log('Navigated to modeSelect screen');
        });
    });

    // --- Game Over ---
    socket.on('game_over', (data) => {
        console.log('Game Over:', data);
        clearInterval(questionTimerInterval); 
        displayGameOver(data.scores, data.winner_info); // Pass scores and winnerInfo to displayGameOver
        showScreen('gameOver');
        if (currentGameMode === 'singleplayer') {
            socket.emit('request_leaderboard'); 
        }
    });

    function displayGameOver(scores, winnerInfo) { // Added winnerInfo
        if (!finalScoresDiv || !winnerMessageContainer) {
            console.error("Game over screen elements (finalScoresDiv or winnerMessageContainer) not found!");
            return;
        }
        finalScoresDiv.innerHTML = '<h3>Final Scores:</h3>';
        const scoreList = document.createElement('ul');
        scores.forEach(([name, score]) => {
            const li = document.createElement('li');
            li.textContent = `${name}: ${score}`;
            if (name === currentPlayerName) {
                li.innerHTML = `<strong>${name} (You): ${score}</strong>`;
            }
            scoreList.appendChild(li);
        });
        finalScoresDiv.appendChild(scoreList);

        winnerMessageContainer.innerHTML = ''; // Clear previous winner message
        if (winnerInfo) {
            if (winnerInfo.isDraw) {
                const p = document.createElement('p');
                p.textContent = "It's a draw!";
                winnerMessageContainer.appendChild(p);
            } else if (winnerInfo.winnerName) {
                const p = document.createElement('p');
                p.textContent = `${winnerInfo.winnerName} wins the game!`;
                if (winnerInfo.winnerName === currentPlayerName) {
                    p.innerHTML = `<strong>Congratulations, ${winnerInfo.winnerName}, you win!</strong>`;
                }
                winnerMessageContainer.appendChild(p);
            }
        } else {
            const p = document.createElement('p');
            p.textContent = "Game finished!";
            winnerMessageContainer.appendChild(p);
        }
    }

    playAgainBtn.addEventListener('click', () => {
        resetGameStatePartial(); 
        if (currentGameMode === 'singleplayer') {
            showScreen('singlePlayerCategorySelect'); 
            fetchCategories(); 
        } else if (currentGameMode === 'head_to_head') {
            showScreen('headToHeadConfig');
        } else if (currentGameMode === 'multiplayer') {
            showScreen('multiplayerConfig');
        } else {
            showScreen('modeSelect'); 
        }
    });

    backToMainMenuBtn.addEventListener('click', () => {
        resetGameStateFull();
        showScreen('modeSelect');
    });

    // --- Leaderboard ---
    function fetchAndShowLeaderboard() {
        socket.emit('request_leaderboard');
        showScreen('leaderboard');
    }

    showLeaderboardInitialBtn.addEventListener('click', () => {
        lastScreen = 'modeSelect'; 
        fetchAndShowLeaderboard();
    });
    showLeaderboardGameOverBtn.addEventListener('click', () => {
        lastScreen = 'gameOver'; 
        fetchAndShowLeaderboard();
    });

    socket.on('leaderboard_update', (leaderboardData) => {
        console.log('Leaderboard updated:', leaderboardData);
        leaderboardBody.innerHTML = ''; 
        leaderboardData.forEach((entry, index) => {
            const row = leaderboardBody.insertRow();
            row.insertCell().textContent = index + 1; 
            row.insertCell().textContent = entry.name;
            row.insertCell().textContent = entry.score;
            row.insertCell().textContent = new Date(entry.timestamp * 1000).toLocaleDateString();
        });
    });

    backFromLeaderboardBtn.addEventListener('click', () => {
        if (lastScreen) {
            showScreen(lastScreen);
        } else {
            showScreen('modeSelect'); 
        }
    });

    // --- Chat ---
    console.log('[Chat Setup] Initializing chat event listeners.');
    console.log('[Chat Setup] h2hSendChatMessageBtn (before if):', h2hSendChatMessageBtn);
    console.log('[Chat Setup] h2hChatMessageInput (before if):', h2hChatMessageInput);

    if (h2hSendChatMessageBtn && h2hChatMessageInput) {
        console.log('[Chat Setup] Inside if: h2hSendChatMessageBtn and h2hChatMessageInput are truthy.');
        console.log('[Chat Setup] h2hSendChatMessageBtn (inside if):', h2hSendChatMessageBtn);
        console.log('[Chat Setup] h2hChatMessageInput (inside if):', h2hChatMessageInput);
        try {
            h2hSendChatMessageBtn.addEventListener('click', sendH2HChatMessage);
            h2hChatMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendH2HChatMessage();
                }
            });

            const emojiButtons = document.querySelectorAll('.emoji-button');
            console.log('[Chat Setup] emojiButtons NodeList:', emojiButtons);
            emojiButtons.forEach((button, index) => {
                console.log(`[Chat Setup] Processing emojiButton ${index}:`, button);
                if (button) {
                    button.addEventListener('click', () => {
                        if (h2hChatMessageInput) {
                            h2hChatMessageInput.value += button.dataset.emoji;
                            h2hChatMessageInput.focus();
                        } else {
                            console.error('[Chat Setup] h2hChatMessageInput is null inside emoji button click listener.');
                        }
                    });
                } else {
                    console.error(`[Chat Setup] emojiButton at index ${index} is null or undefined.`);
                }
            });
            console.log('[Chat Setup] Successfully added all chat event listeners.');
        } catch (e) {
            console.error('[Chat Setup] Error during addEventListener setup:', e);
            console.error('[Chat Setup] h2hSendChatMessageBtn at time of error:', h2hSendChatMessageBtn);
            console.error('[Chat Setup] h2hChatMessageInput at time of error:', h2hChatMessageInput);
        }
    } else {
        console.warn('[Chat Setup] Skipped adding chat event listeners because h2hSendChatMessageBtn or h2hChatMessageInput is null/falsy.');
        console.log('[Chat Setup] h2hSendChatMessageBtn (in else):', h2hSendChatMessageBtn);
        console.log('[Chat Setup] h2hChatMessageInput (in else):', h2hChatMessageInput);
    }

    socket.on('new_chat_message', (message) => {
        displayChatMessage(message);
    });

    function sendH2HChatMessage() {
        const messageText = h2hChatMessageInput.value.trim();
        if (messageText && currentGameId) {
            socket.emit('send_chat_message', {
                game_id: currentGameId,
                message: messageText
            });
            h2hChatMessageInput.value = '';
        }
    }

    function displayChatMessage(msg) {
        if (!h2hChatMessagesDiv) {
            console.error("H2H Chat messages container not found!");
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');

        const senderSpan = document.createElement('span');
        senderSpan.classList.add('chat-sender');
        let senderName = msg.sender_name; // Changed from msg.sender
        if (msg.sender_sid === socket.id) {
            senderName = "You";
        }
        senderSpan.textContent = senderName + ": ";

        const contentSpan = document.createElement('span');
        contentSpan.classList.add('chat-content');
        contentSpan.textContent = msg.text; // Changed from msg.message

        messageElement.appendChild(senderSpan);
        messageElement.appendChild(contentSpan);

        h2hChatMessagesDiv.appendChild(messageElement);
        h2hChatMessagesDiv.scrollTop = h2hChatMessagesDiv.scrollHeight;
    }

    // --- Utility and State Management ---
    function resetGameStatePartial() { 
        currentGameId = null;
        isHost = false;
        currentQuestionData = null;
        playerScore = 0;
        clearInterval(questionTimerInterval);
        clearTimeout(interQuestionInterval); // Clear inter-question timer
        
        if(feedbackMessageElem) feedbackMessageElem.textContent = '';
        if(h2hFeedbackMessageElem) h2hFeedbackMessageElem.textContent = '';
        
        if(h2hChatMessagesDiv) h2hChatMessagesDiv.innerHTML = ''; 
    }

    function resetGameStateFull() { 
        resetGameStatePartial();
        playerNameInput.disabled = false; 
        currentGameMode = '';
        showScreen('initialSetup'); 
    }

    socket.on('error', (data) => {
        console.error('Server Error:', data.message);
        alert(`Error: ${data.message}`);
        if (screens.gameLobby.classList.contains('active') || screens.question.classList.contains('active')) {
            showScreen('modeSelect'); 
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server with SID:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        alert('Disconnected from server. Please refresh the page.');
        resetGameStateFull();
        showScreen('initialSetup');
    });


    // Initial setup
    showScreen('initialSetup');
});

