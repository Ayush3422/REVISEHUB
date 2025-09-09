import React, { useState, useEffect } from 'react';
import { analyzeProject } from '../services/geminiService';
import { Loader } from './Loader';
import { getDashboardData, getPullRequests } from '../services/githubService';
import { LightbulbIcon } from './icons/LightbulbIcon';
import type { Repo } from '../types';

interface AnalysisViewProps {
  repo: Repo;
}

// Simple markdown-to-HTML parser
const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed">
      {lines.map((line, index) => {
        if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-text-primary">{line.substring(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-white">{line.substring(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold mt-8 mb-4 text-white">{line.substring(2)}</h1>;
        if (line.startsWith('- ')) return <li key={index} className="ml-6 list-disc">{line.substring(2)}</li>;
        if (line.trim() === '') return <br key={index} />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ repo }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getAnalysis = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch dynamic data first
        const [dashboardData, prs] = await Promise.all([
            getDashboardData(repo.url),
            getPullRequests(repo.url)
        ]);

        // Summarize the dynamic data for the model
        const prSummary = `Total PRs: ${prs.length}. Titles: ${prs.map(p => p.title).slice(0, 5).join(', ')}.`;
        const contributorSummary = JSON.stringify(dashboardData.contributors);
        const churnSummary = JSON.stringify(dashboardData.codeChurn);
        const velocitySummary = JSON.stringify(dashboardData.prVelocity);

        const result = await analyzeProject(prSummary, contributorSummary, churnSummary, velocitySummary);
        setAnalysis(result);
      } catch (err) {
        setError('Failed to get project analysis from AI. Please check your API key.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    getAnalysis();
  }, [repo]);

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-2">Project Health Analysis</h2>
      <p className="text-text-secondary mb-6">AI-generated insights for <span className="font-semibold text-primary">{repo.name}</span></p>

      <div className="bg-surface/50 backdrop-blur-sm border border-muted/50 rounded-xl p-6 shadow-lg min-h-[400px]">
        {isLoading && <Loader text="Generating project analysis..." />}
        {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}
        {!isLoading && !error && analysis && (
          <div>
            <div className="flex items-center text-2xl font-semibold text-white mb-4">
              <LightbulbIcon className="w-8 h-8 mr-3 text-yellow-400" />
              <span>Gemini's Insights</span>
            </div>
            <div className="space-y-4">
                <SimpleMarkdown text={analysis} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
