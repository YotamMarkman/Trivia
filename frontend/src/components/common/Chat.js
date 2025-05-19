// src/components/common/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import socket from '../../services/socket';
import { MAX_CHAT_MESSAGE_LENGTH } from '../../utils/constants';

const Chat = ({ roomId, currentPlayerSessionId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [isChatDisabled, setIsChatDisabled] = useState(false);

  const allowedEmojis = ['👍', '😂', '❤️', '😮', '😢', '🤔', '🎉', '👋'];

  useEffect(() => {
    const handleNewMessage = (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    };

    const handleNewReaction = (reactionData) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: reactionData.sender_name,
          message: reactionData.reaction,
          type: 'emoji_reaction',
          timestamp: reactionData.timestamp,
          sender_id: reactionData.sender_id,
        },
      ]);
    };

    const handleMuteListUpdate = (update) => {
      console.log("Mute list updated:", update);
    };

    if (!isChatDisabled) {
      socket.on('chat_message', handleNewMessage);
      socket.on('emoji_reaction', handleNewReaction);
    }
    socket.on('mute_list_updated', handleMuteListUpdate);

    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      socket.off('chat_message', handleNewMessage);
      socket.off('emoji_reaction', handleNewReaction);
      socket.off('mute_list_updated', handleMuteListUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isChatDisabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isChatDisabled) return;

    socket.emit('chat_message', {
      message: newMessage.trim(),
      room_id: roomId
    });

    setNewMessage('');
  };

  const handleEmojiSelect = (emoji) => {
    if (isChatDisabled) return;
    socket.emit('emoji_reaction', {
      reaction: emoji,
      room_id: roomId
    });
    setShowEmojiPicker(false);
  };

  const toggleChatDisable = () => {
    setIsChatDisabled(!isChatDisabled);
    if (!isChatDisabled) {
      // Optionally clear messages or show a "Chat Disabled" message
    }
  };

  return (
    <div className={`chat-container ${isChatDisabled ? 'chat-disabled' : ''}`}>
      <div className="chat-header">
        <h3>Chat</h3>
        <button onClick={toggleChatDisable} className="toggle-chat-btn">
          {isChatDisabled ? 'Enable Chat' : 'Disable Chat'}
        </button>
      </div>
      <div 
        className="chat-messages"
        aria-live="polite" // Announce new messages
        aria-atomic="false" // Announce only new messages, not the whole region
      >
        {isChatDisabled ? (
          <p className="chat-status-message">Chat is currently disabled.</p>
        ) : messages.length === 0 ? (
          <p className="no-messages">No messages yet. Be the first!</p>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message ${msg.sender_id === currentPlayerSessionId ? 'own-message' : ''} ${msg.type === 'emoji_reaction' ? 'emoji-message' : ''}`}
            >
              <span className="sender">{msg.sender}: </span>
              {msg.type === 'emoji_reaction' ? (
                <span className="emoji-content">{msg.message}</span>
              ) : (
                <span className="content">{msg.message}</span>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={isChatDisabled ? "Chat is disabled" : "Type a message..."}
          aria-label="Chat message input" // Add aria-label for input
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          disabled={isChatDisabled}
        />
        <button 
          type="button" 
          className="emoji-button" 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Send an emoji"
          aria-label="Open emoji picker" // Add aria-label for emoji button
          disabled={isChatDisabled}
        >
          😊
        </button>
        <button type="submit" disabled={isChatDisabled} aria-label="Send chat message">Send</button>
      </form>
      {showEmojiPicker && !isChatDisabled && (
        <div className="emoji-picker" ref={emojiPickerRef}>
          {allowedEmojis.map(emoji => (
            <span 
              key={emoji} 
              onClick={() => handleEmojiSelect(emoji)}
              role="button"
              aria-label={`emoji ${emoji}`}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default Chat;