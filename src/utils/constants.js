// src/utils/constants.js
export const GAME_MODES = {
  SINGLE_PLAYER: 'single-player',
  MULTIPLAYER: 'multiplayer',
  HEAD_TO_HEAD: 'head-to-head',
};

export const GAME_STATES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  PAUSED: 'paused',
  FINISHED: 'finished',
  SETUP: 'setup',
};

export const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'premier league', label: 'Premier League' },
  { value: 'nba', label: 'NBA' },
  { value: 'international football', label: 'International Football' },
];

export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Single player events
  START_SINGLE_PLAYER: 'start_single_player',
  SINGLE_PLAYER_STARTED: 'single_player_started',
  SINGLE_PLAYER_QUESTION: 'single_player_question',
  SINGLE_PLAYER_ANSWER: 'single_player_answer',
  ANSWER_RESULT: 'answer_result',
  SINGLE_PLAYER_ENDED: 'single_player_ended',
  PAUSE_SINGLE_PLAYER: 'pause_single_player',
  RESUME_SINGLE_PLAYER: 'resume_single_player',
  
  // Multiplayer events
  CREATE_ROOM: 'create_room',
  ROOM_CREATED: 'room_created',
  JOIN_ROOM: 'join_room',
  JOINED_ROOM: 'joined_room',
  LEAVE_ROOM: 'leave_room',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  START_GAME: 'start_game',
  GAME_STARTED: 'game_started',
  NEW_QUESTION: 'new_question',
  SUBMIT_ANSWER: 'submit_answer',
  ANSWER_SUBMITTED: 'answer_submitted',
  SCORES_UPDATE: 'scores_update',
  GAME_ENDED: 'game_ended',
  
  // Head-to-head events
  QUEUE_HEAD_TO_HEAD: 'queue_head_to_head',
  CANCEL_QUEUE: 'cancel_queue',
  QUEUE_STATUS: 'queue_status',
  MATCH_FOUND: 'match_found',
  CREATE_PRIVATE_HEAD_TO_HEAD: 'create_private_head_to_head',
  PRIVATE_ROOM_CREATED: 'private_room_created',
  JOIN_PRIVATE_HEAD_TO_HEAD: 'join_private_head_to_head',
  HEAD_TO_HEAD_STARTED: 'head_to_head_started',
  HEAD_TO_HEAD_SCORES: 'head_to_head_scores',
  HEAD_TO_HEAD_ENDED: 'head_to_head_ended',
  
  // Chat events
  CHAT_MESSAGE: 'chat_message',
  
  // Timer events
  TIMER_UPDATE: 'timer_update',
};

export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 200;
export const ROOM_CODE_LENGTH = 6;