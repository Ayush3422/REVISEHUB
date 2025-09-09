import React, { useState, useEffect } from 'react';
import { getPullRequests } from '../services/githubService';
import type { PullRequest, Repo } from '../types';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { Loader } from './Loader';

interface PullRequestViewProps {
  repo: Repo;
  onSelectPullRequest: (pr: PullRequest) => void;
}

export const PullRequestView: React.FC<PullRequestViewProps> = ({ repo, onSelectPullRequest }) => {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPullRequests = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const prs = await getPullRequests(repo.url);
        setPullRequests(prs);
      } catch (err) {
        setError('Failed to fetch pull requests.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPullRequests();
  }, [repo.url]);

  if (isLoading) {
    return <Loader text="Fetching proposed changes..." />;
  }

  if (error) {
    return <div className="text-red-500 p-4 bg-red-900/50 rounded-lg">{error}</div>;
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-2">Changes Required</h2>
      <p className="text-text-secondary mb-6">Select a change to review its details and get AI feedback.</p>
      <div className="bg-surface/50 border border-muted/50 rounded-xl shadow-lg">
        <ul className="divide-y divide-muted/50">
          {pullRequests.map((pr) => (
            <li key={pr.id}>
              <button onClick={() => onSelectPullRequest(pr)} className="w-full flex items-center p-4 hover:bg-surface transition-colors duration-200">
                <div className="flex-1 text-left">
                  <p className="font-semibold text-text-primary">{pr.title} <span className="text-text-secondary">#{pr.id}</span></p>
                  <div className="flex items-center text-sm text-text-secondary mt-1">
                    <img src={pr.authorAvatar} alt={pr.author} className="w-5 h-5 rounded-full mr-2" />
                    <span>{pr.author}</span>
                    <span className="mx-2">&middot;</span>
                    <span className="font-mono bg-background px-1.5 py-0.5 rounded-md text-secondary text-xs">{pr.branch}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm ml-4">
                    <span className="text-green-400 mr-2">+{pr.additions}</span>
                    <span className="text-red-400 mr-4">-{pr.deletions}</span>
                    <ChevronRightIcon className="w-5 h-5 text-muted" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};