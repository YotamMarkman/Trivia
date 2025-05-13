// src/components/common/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import socket from '../../services/socket';
import { MAX_CHAT_MESSAGE_LENGTH } from '../../utils/constants';

const Chat = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listen for new messages
    socket.on('chat_message', (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    return () => {
      socket.off('chat_message');
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socket.emit('chat_message', {
      message: newMessage.trim(),
      room_id: roomId
    });

    setNewMessage('');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat</h3>
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="message">
              <span className="sender">{msg.sender}: </span>
              <span className="content">{msg.message}</span>
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
          placeholder="Type a message..."
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;