import React, { useState } from 'react';
import { type ChatMessage, type Repo, type TreeNode } from '../types';
import { generateChatResponse } from '../services/geminiService'; // Import the new function

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  repo: Repo;      // Add repo prop
  tree: TreeNode[]; // Add tree prop
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, repo, tree }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'ai', text: 'Welcome! Ask me anything about this repository.' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false); // For loading state

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userInput.trim()) return;

    const userMessage: ChatMessage = { sender: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsAiThinking(true);

    try {
      // Call the actual AI function
      const aiResponseText = await generateChatResponse(tree, userInput);
      const aiResponse: ChatMessage = { sender: 'ai', text: aiResponseText };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorResponse: ChatMessage = { sender: 'ai', text: "Sorry, I couldn't get a response. Please try again." };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsAiThinking(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-surface border border-muted/50 rounded-xl shadow-2xl w-full max-w-lg flex flex-col h-[70vh]">
        {/* Header */}
        <div className="p-4 border-b border-muted/50 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-white">AI Assistant</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-text-primary text-2xl"
            aria-label="Close chat"
          >
            &times;
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-lg max-w-xs ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-muted/50 text-text-secondary'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isAiThinking && (
            <div className="flex justify-start">
              <div className="p-3 rounded-lg bg-muted/50 text-text-secondary">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-muted/50">
          <form className="flex gap-2" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 bg-background border border-muted text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-text-primary"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isAiThinking} // Disable input while AI is thinking
            />
            <button
              type="submit"
              className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-primary/80 disabled:bg-muted"
              disabled={isAiThinking} // Disable button while AI is thinking
            >
              {isAiThinking ? '...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};