import React from 'react';

interface LoaderProps {
  text: string;
}

export const Loader: React.FC<LoaderProps> = ({ text }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-surface/30 rounded-lg p-8">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      <p className="mt-4 text-lg text-text-secondary">{text}</p>
    </div>
  );
};