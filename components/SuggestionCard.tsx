import React, { useState } from 'react';
import type { CodeSuggestion, Comment } from '../types';
import { SuggestionCategory, SuggestionSeverity } from '../types';
import { ThumbsUpIcon } from './icons/ThumbsUpIcon';
import { ThumbsDownIcon } from './icons/ThumbsDownIcon';
import { CommentIcon } from './icons/CommentIcon';
import { BugIcon } from './icons/BugIcon';
import { StyleIcon } from './icons/StyleIcon';
import { DocIcon } from './icons/DocIcon';
import { OptimizeIcon } from './icons/OptimizeIcon';
import { ComplexityIcon } from './icons/ComplexityIcon';


const categoryDetails: Record<SuggestionCategory, { icon: React.FC<any>, color: string, label: string }> = {
    [SuggestionCategory.BUG]: { icon: BugIcon, color: 'text-red-400', label: 'Potential Bug' },
    [SuggestionCategory.STYLE]: { icon: StyleIcon, color: 'text-yellow-400', label: 'Style Suggestion' },
    [SuggestionCategory.DOCUMENTATION]: { icon: DocIcon, color: 'text-blue-400', label: 'Documentation' },
    [SuggestionCategory.OPTIMIZATION]: { icon: OptimizeIcon, color: 'text-green-400', label: 'Optimization' },
    [SuggestionCategory.COMPLEXITY]: { icon: ComplexityIcon, color: 'text-violet-400', label: 'Time Complexity' },
};

const severityDetails: Record<SuggestionSeverity, { color: string, label: string }> = {
    [SuggestionSeverity.LOW]: { color: 'bg-green-500', label: 'Low' },
    [SuggestionSeverity.MEDIUM]: { color: 'bg-yellow-500', label: 'Medium' },
    [SuggestionSeverity.HIGH]: { color: 'bg-red-500', label: 'High' },
};

export const SuggestionCard: React.FC<{ suggestion: CodeSuggestion }> = ({ suggestion }) => {
  const [votes, setVotes] = useState({ up: 0, down: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  const handleVote = (type: 'up' | 'down') => {
    setVotes(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };
  
  const handleAddComment = (e: React.FormEvent) => {
      e.preventDefault();
      if(newComment.trim()){
          setComments([...comments, {id: Date.now(), author: 'student1', text: newComment}]);
          setNewComment('');
      }
  }

  const { icon: CategoryIcon, color: categoryColor, label: categoryLabel } = categoryDetails[suggestion.category];
  const { color: severityColor, label: severityLabel } = severityDetails[suggestion.severity];

  return (
    <div className="bg-surface/50 border border-muted/50 rounded-lg p-4 animate-fade-in-up">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <CategoryIcon className={`w-6 h-6 ${categoryColor}`} />
          <h4 className="font-bold text-lg text-white">{categoryLabel}</h4>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-2 py-1 bg-surface rounded-full">
            <span className={`w-2 h-2 rounded-full ${severityColor}`}></span>
            <span>{severityLabel}</span>
        </div>
      </div>
      <p className="my-3 text-text-secondary">{suggestion.description}</p>
      
      <div className="bg-background p-3 rounded-md font-mono text-sm border border-muted/50">
        <p className="text-muted mb-1">// Suggested Fix</p>
        <pre className="text-green-300 whitespace-pre-wrap">{suggestion.suggestion}</pre>
      </div>

      <div className="mt-4 flex items-center justify-between text-text-secondary">
        <div className="flex items-center gap-4">
            <button onClick={() => handleVote('up')} className="flex items-center gap-1 hover:text-green-400 transition-colors">
                <ThumbsUpIcon className="w-4 h-4" /> {votes.up}
            </button>
            <button onClick={() => handleVote('down')} className="flex items-center gap-1 hover:text-red-400 transition-colors">
                <ThumbsDownIcon className="w-4 h-4" /> {votes.down}
            </button>
        </div>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 hover:text-blue-400 transition-colors">
            <CommentIcon className="w-4 h-4" /> {comments.length}
        </button>
      </div>
      {showComments && (
          <div className="mt-4 pt-4 border-t border-muted/80">
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
                {comments.map(c => (
                    <div key={c.id} className="text-sm bg-surface p-2 rounded-md">
                        <span className="font-semibold text-text-primary">{c.author}: </span>
                        <span className="text-text-secondary">{c.text}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
                <input 
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-surface border border-muted text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="submit" className="bg-primary text-white text-sm px-3 py-1 rounded-md hover:bg-primary/80">Post</button>
            </form>
          </div>
      )}
    </div>
  );
};