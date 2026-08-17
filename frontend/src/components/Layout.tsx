import React, { useState } from 'react';
import type { ConnectionStatus } from '../types/chronq';
import { IconQueue, IconServer, IconActivity, IconRefresh, IconPlus } from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'overview' | 'jobs' | 'workers';
  setActiveTab: (tab: 'overview' | 'jobs' | 'workers') => void;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date;
  onRefresh: () => void;
  onOpenCreateJob: () => void;
  onOpenGenerateWorkload: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  connectionStatus,
  lastUpdated,
  onRefresh,
  onOpenCreateJob,
  onOpenGenerateWorkload,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-status-success)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--color-status-success)]"></span>
            Telemetry Live
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-status-warning)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--color-status-warning)] animate-pulse"></span>
            Reconnecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-status-error)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--color-status-error)]"></span>
            Disconnected
          </span>
        );
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <IconActivity className="w-4 h-4" /> },
    { id: 'jobs', label: 'Jobs', icon: <IconQueue className="w-4 h-4" /> },
    { id: 'workers', label: 'Worker Fleet', icon: <IconServer className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-chronq-cream)] text-[var(--color-chronq-text)] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-[var(--color-chronq-espresso)] text-[var(--color-chronq-cream)] p-6 shrink-0 border-r border-[#3A2A20]">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-[#3A2A20]">
            <div className="w-7 h-7 bg-[var(--color-chronq-warm)] rounded flex items-center justify-center font-mono font-bold text-sm text-[var(--color-chronq-cream)]">
              CQ
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none text-[#FAF7F1]">ChronQ</h1>
              <p className="text-[11px] text-[var(--color-chronq-gray)] mt-1 font-mono">v1.2.0 • Orchestrator</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-[var(--color-chronq-deep)] text-[#FAF7F1] border-l-2 border-[var(--color-chronq-warm)]'
                      : 'text-[#E8DDCC] hover:bg-[#3A2A20]/50 hover:text-[#FAF7F1]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-[#3A2A20] text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--color-chronq-gray)]">System Status</span>
            {getStatusBadge()}
          </div>
          <div className="text-[10px] text-[var(--color-chronq-gray)] font-mono">
            Sync: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-[var(--color-chronq-espresso)] text-[#FAF7F1] p-4 flex items-center justify-between border-b border-[#3A2A20]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[var(--color-chronq-warm)] rounded flex items-center justify-center font-mono font-bold text-xs">
            CQ
          </div>
          <span className="font-bold text-sm">ChronQ</span>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded text-[var(--color-chronq-beige)] hover:bg-[#3A2A20]"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-chronq-deep)] p-4 border-b border-[#3A2A20] space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm ${
                activeTab === item.id
                  ? 'bg-[var(--color-chronq-espresso)] text-white font-semibold'
                  : 'text-[var(--color-chronq-beige)]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-[var(--color-chronq-cream)] border-b border-[var(--color-chronq-beige)] px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-chronq-text)] capitalize">
              {activeTab === 'overview' ? 'Infrastructure Overview' : activeTab}
            </h2>
            <p className="text-xs text-[var(--color-chronq-gray)] mt-0.5">
              Task queue and worker orchestration pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 border border-[var(--color-chronq-beige)] rounded-md text-[var(--color-chronq-medium)] hover:bg-[var(--color-chronq-light-beige)] transition-colors"
              title="Refresh telemetry snapshot"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenGenerateWorkload}
              className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-chronq-warm)] bg-[var(--color-chronq-light-beige)] text-[var(--color-chronq-espresso)] text-xs font-semibold rounded-md hover:bg-[var(--color-chronq-beige)] transition-colors shadow-xs"
            >
              <IconActivity className="w-3.5 h-3.5 text-[var(--color-chronq-warm)]" />
              <span>Generate Workload</span>
            </button>
            <button
              onClick={onOpenCreateJob}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-chronq-espresso)] text-[var(--color-chronq-cream)] text-xs font-semibold rounded-md hover:bg-[var(--color-chronq-deep)] transition-colors shadow-xs"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Submit Job</span>
            </button>
          </div>
        </header>

        <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};