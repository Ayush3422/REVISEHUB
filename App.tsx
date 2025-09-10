import React, { useState } from 'react';
import type { Repo, PullRequest, TreeNode } from './types'; // Add TreeNode
import { RepoInputView } from './components/RepoInputView';
import { PullRequestView } from './components/PullRequestView';
import { CodeReviewView } from './components/CodeReviewView';
import { DashboardView } from './components/DashboardView';
import { AnalysisView } from './components/AnalysisView';
import { FileExplorerView } from './components/FileExplorerView';
import { ChatButton } from './components/ChatButton';
import { ChatModal } from './components/ChatModal';
import { getFileTree } from './services/githubService'; // Import getFileTree

import { LogoIcon } from './components/icons/LogoIcon';
import { CodeIcon } from './components/icons/CodeIcon';
import { DashboardIcon } from './components/icons/DashboardIcon';
import { LightbulbIcon } from './components/icons/LightbulbIcon';
import { FolderIcon } from './components/icons/FolderIcon';
import { SwitchIcon } from './components/icons/SwitchIcon';

type View = 'pr-list' | 'pr-review' | 'dashboard' | 'analysis' | 'files';

const App: React.FC = () => {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [selectedPullRequest, setSelectedPullRequest] = useState<PullRequest | null>(null);
  const [currentView, setCurrentView] = useState<View>('pr-list');
  const [isLoading, setIsLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]); // State for the file tree

  const handleRepoSubmit = async (submittedRepo: Repo) => {
    setIsLoading(true);
    setRepoError(null);
    try {
      // Fetch the file tree as soon as the repo is submitted
      const tree = await getFileTree(submittedRepo.url);
      setFileTree(tree);
      setRepo(submittedRepo);
      setCurrentView('pr-list');
    } catch (error: any) {
      console.error("Failed to load initial repo data:", error);
      setRepoError(
        error?.message?.includes('404')
          ? 'Repository not found or is private. Please check the URL or repository visibility.'
          : 'Failed to load repository data. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setRepo(null);
    setSelectedPullRequest(null);
    setFileTree([]); // Reset file tree
  };

  const handleSelectPullRequest = (pr: PullRequest) => {
    setSelectedPullRequest(pr);
    setCurrentView('pr-review');
  };

  const handleBackToPRList = () => {
    setSelectedPullRequest(null);
    setCurrentView('pr-list');
  };

  const renderCurrentView = () => {
    if (!repo) {
      return <RepoInputView onRepoSubmit={handleRepoSubmit} isLoading={isLoading} error={repoError} />;
    }

    switch (currentView) {
      case 'pr-list':
        return <PullRequestView repo={repo} onSelectPullRequest={handleSelectPullRequest} />;
      case 'pr-review':
        if (selectedPullRequest) {
          return <CodeReviewView repo={repo} pullRequest={selectedPullRequest} onBack={handleBackToPRList} />;
        }
        return null;
      case 'dashboard':
        return <DashboardView repo={repo} />;
      case 'analysis':
        return <AnalysisView repo={repo} />;
      case 'files':
        // Pass the already fetched tree to the FileExplorerView
        return <FileExplorerView repo={repo} initialTree={fileTree} />;
      default:
        return <PullRequestView repo={repo} onSelectPullRequest={handleSelectPullRequest} />;
    }
  };
  
  const NavItem: React.FC<{ icon: React.FC<any>, label: string, view: View }> = ({ icon: Icon, label, view }) => (
    <button 
      onClick={() => setCurrentView(view)} 
      className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${currentView === view ? 'bg-primary/20 text-primary' : 'hover:bg-surface text-text-secondary'}`}
    >
      <Icon className="w-6 h-6 mr-4" />
      <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="bg-background text-text-primary min-h-screen font-sans flex">
      {repo && (
        <nav className="w-64 bg-surface/30 p-4 border-r border-muted/50 flex-shrink-0 flex flex-col">
          <div>
            <div className="flex items-center mb-8 px-2">
              <LogoIcon className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold ml-3 text-white">ReviseHub</h1>
            </div>
            <div className="space-y-2">
              <NavItem icon={CodeIcon} label="Changes Required" view="pr-list" />
              <NavItem icon={DashboardIcon} label="Dashboard" view="dashboard" />
              <NavItem icon={LightbulbIcon} label="AI Analysis" view="analysis" />
              <NavItem icon={FolderIcon} label="File Explorer" view="files" />
            </div>
          </div>
          <div className="mt-auto">
            <button 
              onClick={handleReset} 
              className="flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 hover:bg-surface text-text-secondary"
            >
              <SwitchIcon className="w-6 h-6 mr-4" />
              <span className="font-semibold">Switch Project</span>
            </button>
            <div className="text-center text-xs text-muted mt-2">
              <p>Powered by Google Gemini</p>
            </div>
          </div>
        </nav>
      )}
      <main className={`flex-1 p-8 overflow-auto ${!repo ? 'flex' : ''}`}>
        {renderCurrentView()}
      </main>
      
      {repo && (
        <>
          <ChatButton onClick={() => setIsChatOpen(true)} />
          {/* Pass repo and fileTree to the modal */}
          <ChatModal 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            repo={repo} 
            tree={fileTree} 
          />
        </>
      )}
    </div>
  );
};

export default App;