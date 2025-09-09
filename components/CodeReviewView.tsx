import React, { useState, useEffect, useCallback } from 'react';
import type { PullRequest, Repo, CodeSuggestion, CodeDiff } from '../types';
import { getPullRequestDiff } from '../services/githubService';
import { reviewCode } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';
import { Loader } from './Loader';
import { SuggestionCard } from './SuggestionCard';

interface CodeReviewViewProps {
  repo: Repo;
  pullRequest: PullRequest;
  onBack: () => void;
}

export const CodeReviewView: React.FC<CodeReviewViewProps> = ({ repo, pullRequest, onBack }) => {
  const [diff, setDiff] = useState<CodeDiff | null>(null);
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchDiff = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedDiff = await getPullRequestDiff(pullRequest.id, pullRequest.title);
      setDiff(fetchedDiff);
    } catch (err) {
      setError('Failed to fetch code diff.');
    } finally {
      setIsLoading(false);
    }
  }, [pullRequest.id, pullRequest.title]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const handleReviewCode = useCallback(async () => {
    if (!diff) return;
    setIsReviewing(true);
    setError(null);
    try {
      const result = await reviewCode(diff.diff);
      setSuggestions(result);
    } catch (err) {
      setError('Failed to get AI review. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  }, [diff]);

  const renderDiff = () => {
    if (!diff) return null;
    return diff.diff.split('\n').map((line, index) => {
      const color = line.startsWith('+') ? 'bg-green-500/10 text-green-300' : 
                    line.startsWith('-') ? 'bg-red-500/10 text-red-300' : 
                    'text-text-secondary';
      const sign = line.startsWith('+') ? '+' : line.startsWith('-') ? '-' : ' ';
      return (
        <div key={index} className={`flex ${color}`}>
          <span className="w-12 text-right pr-4 select-none text-muted">{index + 1}</span>
          <span className="w-4 text-center select-none text-muted">{sign}</span>
          <pre className="flex-1 whitespace-pre-wrap font-mono">{line.substring(1)}</pre>
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="mb-6">
        <button onClick={onBack} className="text-primary hover:underline mb-4">&larr; Back to Changes Required</button>
        <h2 className="text-3xl font-bold text-white">{pullRequest.title} <span className="text-text-secondary">#{pullRequest.id}</span></h2>
        <div className="flex items-center mt-2 text-text-secondary">
          <img src={pullRequest.authorAvatar} alt={pullRequest.author} className="w-6 h-6 rounded-full mr-2"/>
          <span><span className="font-semibold text-text-primary">{pullRequest.author}</span> wants to merge <span className="font-mono bg-surface px-1.5 py-0.5 rounded-md text-secondary">{pullRequest.branch}</span></span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        <div className="bg-surface/50 border border-muted/50 rounded-xl overflow-auto flex flex-col">
          <div className="p-4 border-b border-muted/50 sticky top-0 bg-surface/80 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white">Code Changes</h3>
          </div>
          {isLoading ? <Loader text="Loading diff..." /> : 
            <div className="p-4 font-mono text-sm flex-1">
              {renderDiff()}
            </div>
          }
        </div>

        <div className="bg-surface/50 border border-muted/50 rounded-xl overflow-auto flex flex-col">
          <div className="p-4 border-b border-muted/50 flex justify-between items-center sticky top-0 bg-surface/80 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white">AI Review</h3>
            <button
              onClick={handleReviewCode}
              disabled={isReviewing || !diff}
              className="flex items-center bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-muted disabled:cursor-not-allowed shadow-lg shadow-primary/30"
            >
              <SparklesIcon className={`mr-2 h-5 w-5 ${isReviewing ? 'animate-spin' : ''}`} />
              {isReviewing ? 'Reviewing...' : 'Run AI Review'}
            </button>
          </div>
          <div className="p-4 space-y-4 flex-1">
            {isReviewing && <Loader text="Analyzing code with Gemini..." />}
            {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}
            {!isReviewing && suggestions.length === 0 && !error && (
              <div className="text-center text-text-secondary h-full flex flex-col justify-center items-center">
                 <SparklesIcon className="w-16 h-16 text-muted mb-4" />
                 <p>Click "Run AI Review" to get started.</p>
              </div>
            )}
            {suggestions.map((suggestion, index) => (
              <SuggestionCard key={index} suggestion={suggestion} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};