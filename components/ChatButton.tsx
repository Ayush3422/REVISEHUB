import React from 'react';
import { CommentIcon } from './icons/CommentIcon';

interface ChatButtonProps {
  onClick: () => void;
}

export const ChatButton: React.FC<ChatButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 bg-primary h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary/80 transition-transform transform hover:scale-110"
      aria-label="Open chat"
    >
      <CommentIcon className="w-8 h-8" />
    </button>
  );
};