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
    const opponentTypeSelect = document.getElementById('opponent-type');
    const h2hJoinGameOptionsDiv = document.getElementById('h2h-join-game-options');
    const h2hCreateGameOptionsDiv = document.getElementById('h2h-create-game-options');
    const h2hGameIdJoinInput = document.getElementById('h2h-game-id-join');
    const joinH2HGameBtn = document.getElementById('join-h2h-game-btn');
    const createH2HGameBtn = document.getElementById('create-h2h-game-btn');

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
    const questionCategoryImageContainer = document.getElementById('question-category-image-container'); // New container
    const answerButtons = document.querySelectorAll('.answer-button');
    const feedbackMessageElem = document.getElementById('feedback-message'); // Ensure this line is present and correct
    const exitGameBtn = document.getElementById('exit-game-btn'); // Added selector for the new button

    // Game Over
    const finalScoreDetailsDiv = document.getElementById('final-score-details');
    const playAgainBtn = document.getElementById('play-again');
    const backToMainMenuBtn = document.getElementById('back-to-main-menu');

    // Leaderboard
    const showLeaderboardInitialBtn = document.getElementById('show-leaderboard-initial');
    const showLeaderboardGameOverBtn = document.getElementById('show-leaderboard-gameover');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const backFromLeaderboardBtn = document.getElementById('back-from-leaderboard');

    // Chat
    const chatContainer = document.getElementById('chat-container');
    const chatMessagesDiv = document.getElementById('chat-messages');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageBtn = document.getElementById('send-chat-message-btn');


    let currentPlayerName = '';
    let currentGameId = null;
    let currentGameMode = '';
    let isHost = false;
    let currentQuestionData = null;
    let playerScore = 0;
    let questionTimerInterval;
    let lastScreen = null; // For leaderboard back button

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
            chatContainer.style.display = 'none'; // Hide chat by default

            if (mode === 'singleplayer') {
                showScreen('singlePlayerCategorySelect'); // New screen
                fetchCategories(); // Fetch categories when entering this screen
            } else if (mode === 'head_to_head') {
                showScreen('headToHeadConfig');
                // Reset H2H options
                opponentTypeSelect.value = 'player';
                h2hJoinGameOptionsDiv.style.display = 'block';
                h2hCreateGameOptionsDiv.style.display = 'none';
                h2hGameIdJoinInput.value = '';
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
    opponentTypeSelect.addEventListener('change', () => {
        if (opponentTypeSelect.value === 'bot') {
            h2hJoinGameOptionsDiv.style.display = 'none';
            h2hCreateGameOptionsDiv.style.display = 'block';
        } else {
            h2hJoinGameOptionsDiv.style.display = 'block';
            h2hCreateGameOptionsDiv.style.display = 'none';
        }
    });

    createH2HGameBtn.addEventListener('click', () => {
        isHost = true;
        socket.emit('create_game', {
            name: currentPlayerName,
            game_mode: 'head_to_head',
            num_bots: 1, // H2H vs Bot means 1 bot
            max_players: 2
        });
        chatContainer.style.display = 'block';
    });

    joinH2HGameBtn.addEventListener('click', () => {
        const gameIdToJoin = h2hGameIdJoinInput.value.trim();
        if (gameIdToJoin) {
            isHost = false;
            socket.emit('join_game', {
                name: currentPlayerName,
                game_id: gameIdToJoin
            });
            chatContainer.style.display = 'block';
        } else {
            alert('Please enter a Game ID to join.');
        }
    });

    // --- Multiplayer ---
    createMultiplayerRoomBtn.addEventListener('click', () => {
        isHost = true;
        // We don't send num_bots yet, host will configure this on next screen
        socket.emit('create_game', {
            name: currentPlayerName,
            game_mode: 'multiplayer',
            max_players: 8 // Default for multiplayer
        });
        chatContainer.style.display = 'block';
    });

    socket.on('game_created', (data) => {
        currentGameId = data.game_id;
        console.log('Game created:', data);

        if (data.game_mode === 'multiplayer' && isHost) {
            multiplayerRoomIdDisplay.textContent = currentGameId;
            hostRoomIdSpan.textContent = currentGameId;
            numBotsMultiplayerInput.value = "0"; // Reset
            updateMultiplayerLobbyPlayers(data.players || [{name: currentPlayerName, score:0, sid: socket.id, is_bot: false}]); // Show host in lobby
            showScreen('multiplayerHostOptions');
        } else {
            // For single player, H2H created by this client
            setupLobbyScreen(data.game_id, data.game_mode, data.players || [], isHost);
            showScreen('gameLobby');
            if (isHost && (data.game_mode === 'singleplayer' || (data.game_mode === 'head_to_head' && data.num_bots > 0))) {
                 // Auto-start for single player or H2H vs Bot if host
                startGameButton.style.display = 'none'; // Hide start button
                waitingForHostMessage.textContent = 'Starting game...';
                socket.emit('start_game', { game_id: currentGameId });
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
            chatContainer.style.display = 'block';
        } else {
            alert('Please enter a Game ID to join.');
        }
    });


    function setupLobbyScreen(gameId, mode, players, isClientHost) {
        currentGameId = gameId;
        lobbyGameIdSpan.textContent = gameId;
        lobbyGameModeSpan.textContent = mode.replace('_', ' ');
        isHost = isClientHost; // Update global isHost based on this specific game join/create

        updateLobbyPlayersList(players);

        if (isHost) {
            startGameButton.style.display = 'block';
            waitingForHostMessage.style.display = 'none';
        } else {
            startGameButton.style.display = 'none';
            waitingForHostMessage.style.display = 'block';
        }
        const gameData = players.length > 0 ? players[0].gameData : null; // Simplified
        lobbyMaxPlayersSpan.textContent = gameData ? gameData.max_players : (mode === 'singleplayer' ? 1 : (mode === 'head_to_head' ? 2 : 8));
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
        setupLobbyScreen(data.game_id, currentGameMode, data.players, false); 
        showScreen('gameLobby');
        if (data.chat_history) {
            data.chat_history.forEach(msg => displayChatMessage(msg));
        }
    });

    socket.on('player_joined', (data) => {
        console.log('Player joined:', data);
        if (screens.gameLobby.classList.contains('active') || screens.multiplayerHostOptions.classList.contains('active')) {
            updateLobbyPlayersList(data.players);
            lobbyMaxPlayersSpan.textContent = data.players.length > 0 && data.players[0].gameData ? data.players[0].gameData.max_players : lobbyMaxPlayersSpan.textContent;
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
    socket.on('game_started', (data) => {
        console.log('Game started:', data);
        playerScore = 0; 
        updateScoreDisplay();
        showScreen('question');
        if (currentGameMode === 'head_to_head' || currentGameMode === 'multiplayer') {
            chatContainer.style.display = 'block';
        } else {
            chatContainer.style.display = 'none';
        }
    });

    socket.on('new_question', (question) => {
        console.log('New question:', question);
        currentQuestionData = question;
        displayQuestion(question);
        startTimer(15); 
    });

    function displayQuestion(q) {
        questionTextElem.textContent = q.question;
        questionCounterSpan.textContent = `Q: ${q.question_number}/${q.total_questions}`;
        feedbackMessageElem.textContent = '';
        feedbackMessageElem.className = ''; 

        // --- Add Category Image ---
        console.log("[displayQuestion] Received category from backend:", q.category); 
        if (!questionCategoryImageContainer) {
            console.error("[displayQuestion] Error: questionCategoryImageContainer element not found!");
            return; // Stop if container is missing
        }
        questionCategoryImageContainer.innerHTML = ''; // Clear previous image or text

        const categoryImageMapping = { // Ensure these keys EXACTLY match q.category from backend
            "NBA": "NBA",
            "Premier League": "Premier_League", // Make sure this matches backend category name
            "International Football": "International" // Make sure this matches backend category name
        };

        // Lists of available images for each category folder
        const categoryImageLists = {
            "NBA": ["doncic_sga.jpg", "ja.jpg", "jordan.jpg", "kobe.jpg", "kyrie_7.jpg", "lakers_old.jpg", "lbj_curry.jpg", "logo.png"],
            "Premier_League": ["adebayor.jpg", "aguero.jpg", "arsenal.jpg", "chris_manu.jpg", "drogba.jpg", "League_cup.jpg", "sheahrer.jpg"],
            "International": ["dejong.jpg", "donovan.jpg", "Maradona_hand_of_god.jpg", "messi.jpg", "ronaldo.jpg", "torres.jpg", "world_cup.png", "zidane.jpg"]
        };

        const imageFolderName = categoryImageMapping[q.category];
        console.log("[displayQuestion] Mapped to folder name:", imageFolderName); 

        if (imageFolderName && categoryImageLists[imageFolderName] && categoryImageLists[imageFolderName].length > 0) {
            const imageList = categoryImageLists[imageFolderName];
            const imageName = imageList[Math.floor(Math.random() * imageList.length)]; // Select a random image
            
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
                // Display fallback text if image fails to load
                questionCategoryImageContainer.innerHTML = ''; // Clear again in case of error
                const categoryText = document.createElement('p');
                categoryText.textContent = `Category: ${q.category} (Image not found at ${imagePath})`;
                categoryText.classList.add('question-category-text-fallback');
                questionCategoryImageContainer.appendChild(categoryText);
            };

            questionCategoryImageContainer.appendChild(img);
        } else {
            console.log("[displayQuestion] No image folder mapping found for category:", q.category);
            const categoryText = document.createElement('p');
            categoryText.textContent = `Category: ${q.category}`; // Display category name if no mapping
            categoryText.classList.add('question-category-text-fallback');
            questionCategoryImageContainer.appendChild(categoryText);
        }
        // --- End Add Category Image ---

        answerButtons.forEach((button, index) => {
            button.textContent = q.answers[index];
            button.disabled = false;
            button.className = 'answer-button'; 
            button.onclick = () => handleAnswerSubmit(q.answers[index]);
        });
    }

    function handleAnswerSubmit(answer) {
        clearInterval(questionTimerInterval);
        answerButtons.forEach(button => button.disabled = true);
        socket.emit('submit_answer', {
            game_id: currentGameId,
            answer: answer
        });
    }

    socket.on('answer_result', (data) => {
        console.log('Answer result:', data);
        playerScore = data.your_total_score; 
        updateScoreDisplay();

        answerButtons.forEach(button => {
            if (button.textContent === data.correct_answer) {
                button.classList.add('correct');
            } else if (button.textContent !== data.correct_answer && button.disabled) { 
            }
        });

        if (data.correct) {
            feedbackMessageElem.textContent = `Correct! +${data.score_earned} points.`;
            feedbackMessageElem.className = 'feedback-correct';
        } else {
            feedbackMessageElem.textContent = `Wrong! The correct answer was: ${data.correct_answer}`;
            feedbackMessageElem.className = 'feedback-wrong';
        }

        if (currentGameMode !== 'singleplayer' && currentGameMode !== 'head_to_head') { 
            setTimeout(() => {
            }, 3000); 
        }
    });

    socket.on('update_scores', (data) => {
        console.log('Scores updated:', data);
        if (screens.question.classList.contains('active')) {
            console.log("All scores:", data.scores);
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
        timerSpan.textContent = `Time: ${timeLeft}s`;
        clearInterval(questionTimerInterval); 

        questionTimerInterval = setInterval(() => {
            timeLeft--;
            timerSpan.textContent = `Time: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(questionTimerInterval);
                timerSpan.textContent = "Time's up!";
                answerButtons.forEach(button => button.disabled = true);
                feedbackMessageElem.textContent = "Time's up! No answer submitted.";
                socket.emit('submit_answer', { game_id: currentGameId, answer: "__TIMEOUT__" });

            }
        }, 1000);
    }

    function updateScoreDisplay() {
        currentScoreSpan.textContent = `Score: ${playerScore}`;
    }

    if (exitGameBtn) {
        exitGameBtn.addEventListener('click', () => {
            console.log('Exit Game button clicked');
            if (socket && socket.connected) {
                socket.emit('leave_game');
                console.log('Emitted leave_game event');
            }
            if (questionTimerInterval) {
                clearInterval(questionTimerInterval);
                questionTimerInterval = null;
                console.log('Question timer cleared');
            }
            // Reset relevant game state variables
            currentQuestionData = null;
            playerScore = 0;
            // Navigate to mode selection screen
            showScreen('modeSelect');
            console.log('Navigated to modeSelect screen');
        });
    }

    // --- Game Over ---
    socket.on('game_over', (data) => {
        console.log('Game Over:', data);
        clearInterval(questionTimerInterval); 
        displayGameOver(data.scores);
        showScreen('gameOver');
        if (currentGameMode === 'singleplayer') {
            socket.emit('request_leaderboard'); 
        }
    });

    function displayGameOver(scores) {
        finalScoreDetailsDiv.innerHTML = '<h3>Final Scores:</h3>';
        const scoreList = document.createElement('ul');
        scores.forEach(([name, score]) => {
            const li = document.createElement('li');
            li.textContent = `${name}: ${score}`;
            if (name === currentPlayerName) {
                li.innerHTML = `<strong>${name} (You): ${score}</strong>`;
            }
            scoreList.appendChild(li);
        });
        finalScoreDetailsDiv.appendChild(scoreList);
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
    sendChatMessageBtn.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    function sendChatMessage() {
        const messageText = chatMessageInput.value.trim();
        if (messageText && currentGameId) {
            socket.emit('send_chat_message', {
                game_id: currentGameId,
                message: messageText
            });
            chatMessageInput.value = '';
        }
    }

    socket.on('new_chat_message', (message) => {
        displayChatMessage(message);
    });

    function displayChatMessage(msg) {
        const messageElem = document.createElement('div');
        messageElem.classList.add('chat-message');

        const senderSpan = document.createElement('span');
        senderSpan.classList.add('sender');
        senderSpan.textContent = `${msg.sender_name}: `;

        if (msg.is_bot) {
            messageElem.classList.add('bot');
        } else if (msg.sender_sid === socket.id) {
            messageElem.classList.add('own-message');
        }

        const textSpan = document.createElement('span');
        textSpan.classList.add('text');
        textSpan.textContent = msg.text;

        messageElem.appendChild(senderSpan);
        messageElem.appendChild(textSpan);
        chatMessagesDiv.appendChild(messageElem);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; 
    }


    // --- Utility and State Management ---
    function resetGameStatePartial() { 
        currentGameId = null;
        isHost = false;
        currentQuestionData = null;
        playerScore = 0;
        clearInterval(questionTimerInterval);
        feedbackMessageElem.textContent = '';
        chatMessagesDiv.innerHTML = ''; 
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

