import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { getDashboardData } from '../services/githubService';
import type { ContributorStats, Repo, DashboardData } from '../types';
import { Loader } from './Loader';

interface DashboardViewProps {
    repo: Repo;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-surface/80 backdrop-blur-sm border border-muted/50 rounded-lg shadow-lg">
                <p className="font-bold text-text-primary mb-2">{`${label}`}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value}`}</p>
                ))}
            </div>
        );
    }
    return null;
};

const ContributorCard: React.FC<{ contributor: ContributorStats, rank: number }> = ({ contributor, rank }) => {
    const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
    return (
        <div className="bg-surface/50 p-4 rounded-lg flex items-center space-x-4">
            <span className={`text-2xl font-bold w-8 text-center ${rank < 3 ? rankColors[rank] : 'text-text-secondary'}`}>
                {rank + 1}
            </span>
            <img src={`https://i.pravatar.cc/40?u=${contributor.name}`} alt={contributor.name} className="w-10 h-10 rounded-full" />
            <div className="flex-1">
                <p className="font-semibold text-text-primary">{contributor.name}</p>
                <div className="flex items-center text-sm text-text-secondary mt-1 space-x-2">
                    <span>{contributor.commits} commits</span>
                    <span className="text-green-500">+{contributor.additions}</span>
                    <span className="text-red-500">-{contributor.deletions}</span>
                </div>
            </div>
        </div>
    );
}

const DashboardPanel: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div className="bg-surface/50 backdrop-blur-sm border border-muted/50 rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-text-primary">{title}</h3>
        {children}
    </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ repo }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const dashboardData = await getDashboardData(repo.url);
                setData(dashboardData);
            } catch (err) {
                setError("Failed to fetch dashboard data.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [repo.url]);

    if (isLoading) {
        return <Loader text="Analyzing project metrics..." />;
    }

    if (error) {
        return <div className="text-red-500 p-4 bg-red-900/50 rounded-lg">{error}</div>;
    }

    if (!data) {
        return <div className="text-text-secondary">No dashboard data available.</div>;
    }

    const sortedContributors = [...data.contributors].sort((a, b) => b.commits - a.commits);
    
    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Project Dashboard</h2>
                <p className="text-text-secondary">Analytics for <span className="font-semibold text-primary">{repo.name}</span></p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardPanel title="PR Velocity">
                     <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.prVelocity}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="name" stroke="#94A3B8" />
                            <YAxis stroke="#94A3B8" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                            <Legend wrapperStyle={{ color: '#F8FAFC' }}/>
                            <Line type="monotone" dataKey="opened" stroke="#8B5CF6" strokeWidth={2} />
                            <Line type="monotone" dataKey="merged" stroke="#EC4899" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </DashboardPanel>
                
                <DashboardPanel title="Code Churn">
                    <ResponsiveContainer width="100%" height={300}>
                         <AreaChart data={data.codeChurn}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="name" stroke="#94A3B8" />
                            <YAxis stroke="#94A3B8" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                            <Legend wrapperStyle={{ color: '#F8FAFC' }}/>
                            <Area type="monotone" dataKey="additions" stackId="1" stroke="#4CAF50" fill="#4CAF50" fillOpacity={0.3} />
                            <Area type="monotone" dataKey="deletions" stackId="1" stroke="#F44336" fill="#F44336" fillOpacity={0.3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </DashboardPanel>

                <DashboardPanel title="Contribution Graph">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.contributors}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="name" stroke="#94A3B8" />
                            <YAxis stroke="#94A3B8" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                            <Legend wrapperStyle={{ color: '#F8FAFC' }}/>
                            <Bar dataKey="commits" fill="#6366F1" />
                            <Bar dataKey="additions" fill="#4CAF50" />
                            <Bar dataKey="deletions" fill="#F44336" />
                        </BarChart>
                    </ResponsiveContainer>
                </DashboardPanel>

                <DashboardPanel title="Contributor Leaderboard">
                    <div className="space-y-3 h-[300px] overflow-y-auto pr-2">
                        {sortedContributors.map((contributor, index) => (
                            <ContributorCard key={contributor.name} contributor={contributor} rank={index} />
                        ))}
                    </div>
                </DashboardPanel>
            </div>
        </div>
    );
};
