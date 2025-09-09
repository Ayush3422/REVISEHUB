import React, { useState } from 'react';
import type { Repo } from '../types';
import { GithubIcon } from './icons/GithubIcon';
import { LogoIcon } from './icons/LogoIcon';

interface RepoInputViewProps {
  onRepoSubmit: (repo: Repo) => void;
  isLoading: boolean;
}

export const RepoInputView: React.FC<RepoInputViewProps> = ({ onRepoSubmit, isLoading }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Updated function: More robustly extracts 'owner/repo' from various GitHub URL formats.
  const extractRepoName = (url: string): string | null => {
    const match = url.match(/github\.com\/([\w-]+\/[\w.-]+)/);
    if (match && match[1]) {
        return match[1].replace(/\.git$/, '');
    }
    return null; // Return null if no match is found
  };
  
  // Updated function: Uses extractRepoName for validation, making logic simpler and more reliable.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL.');
      return;
    }
    
    const repoName = extractRepoName(repoUrl);

    if (!repoName) {
        setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo).');
        return;
    }

    setError(null);
    onRepoSubmit({ url: repoUrl, name: repoName });
  };

  return (
    <div className="w-full max-w-lg m-auto flex flex-col items-center justify-center animate-fade-in">
        <div className="flex items-center mb-8">
            <LogoIcon className="w-16 h-16 text-primary" />
            <h1 className="text-5xl font-bold ml-4 text-white">ReviseHub</h1>
        </div>
        <p className="text-lg text-text-secondary mb-8 text-center">
            Your AI-powered co-pilot for intelligent code reviews.
        </p>

        <div className="w-full bg-surface/50 border border-muted/50 rounded-xl p-8 shadow-2xl backdrop-blur-sm">
            <form onSubmit={handleSubmit}>
                <label htmlFor="repoUrl" className="block text-sm font-medium text-text-primary mb-2">
                    Enter GitHub Repository URL
                </label>
                <div className="relative">
                    <GithubIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                        id="repoUrl"
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="e.g., https://github.com/facebook/react"
                        className="w-full bg-surface border border-muted/80 rounded-lg py-3 pl-10 pr-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        disabled={isLoading}
                    />
                </div>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-lg mt-6 transition duration-300 disabled:bg-muted disabled:cursor-wait flex items-center justify-center shadow-lg shadow-primary/30"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                            Analyzing...
                        </>
                    ) : (
                        'Analyze Repository'
                    )}
                </button>
            </form>
            <p className="text-center text-xs text-muted mt-6">
              Powered by Google Gemini
            </p>
        </div>
    </div>
  );
};