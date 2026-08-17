import React, { useState } from 'react';
import { useChronQ } from './hooks/useChronQ';
import { Layout } from './components/Layout';
import { KPICard } from './components/KPICard';
import { JobTable } from './components/JobTable';
import { WorkerGrid } from './components/WorkerGrid';
import { CreateJobModal } from './components/CreateJobModal';
import { ClearQueueModal } from './components/ClearQueueModal';
import { GenerateWorkloadModal } from './components/GenerateWorkloadModal';
import { IconServer, IconQueue, IconActivity, IconAlertTriangle } from './components/Icons';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'workers'>('overview');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const {
    jobs,
    workers,
    metrics,
    connectionStatus,
    lastUpdated,
    createJob,
    generateWorkload,
    scaleWorkers,
    clearQueue,
    toggleSimulation,
    refreshData,
  } = useChronQ();

  const queuedJobsCount = metrics.queued_jobs !== undefined 
    ? metrics.queued_jobs 
    : jobs.filter((j) => j.status === 'queued').length;
  const activeWorkersCount = workers.filter((w) => w.status === 'running' || w.status === 'processing').length;
  const failedJobsCount = jobs.filter((j) => j.status === 'failed').length;
  const totalJobsCount = jobs.length;
  const failureRatePercent = totalJobsCount > 0 ? ((failedJobsCount / totalJobsCount) * 100).toFixed(1) : '0.0';

  const handleClearQueue = async () => {
    try {
      setIsClearing(true);
      const res = await clearQueue();
      setIsClearModalOpen(false);
      setNotification(`Successfully cleared ${res.cleared_count} queued ${res.cleared_count === 1 ? 'job' : 'jobs'}.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear queue');
    } finally {
      setIsClearing(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (targetJob) {
      await createJob({
        name: targetJob.name,
        priority: targetJob.priority,
        payload: targetJob.payload,
        max_retries: targetJob.max_retries,
      });
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      connectionStatus={connectionStatus}
      lastUpdated={lastUpdated}
      onRefresh={refreshData}
      onOpenCreateJob={() => setIsCreateModalOpen(true)}
      onOpenGenerateWorkload={() => setIsGenerateModalOpen(true)}
    >
      {notification && (
        <div className="p-3 bg-[var(--color-status-success-bg)] border border-[var(--color-status-success)]/30 text-[var(--color-status-success)] text-xs rounded-md font-medium">
          {notification}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Active Workers"
          value={workers.length}
          subValue={`${activeWorkersCount} Processing`}
          statusIndicator="success"
          icon={<IconServer className="w-4 h-4" />}
        />
        <KPICard
          label="Queued Jobs"
          value={queuedJobsCount}
          subValue="Awaiting assignment"
          statusIndicator="neutral"
          icon={<IconQueue className="w-4 h-4" />}
        />
        <KPICard
          label="Throughput"
          value={`${metrics.throughput_per_minute || jobs.filter((j) => j.status === 'completed').length} /m`}
          subValue="Real-time execution"
          statusIndicator="neutral"
          icon={<IconActivity className="w-4 h-4" />}
        />
        <KPICard
          label="Failure Rate"
          value={`${metrics.failure_rate !== undefined ? metrics.failure_rate : failureRatePercent}%`}
          subValue={`${failedJobsCount} failed attempts`}
          statusIndicator={failedJobsCount > 0 ? 'warning' : 'success'}
          icon={<IconAlertTriangle className="w-4 h-4" />}
        />
      </section>

      {(activeTab === 'overview' || activeTab === 'jobs') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-chronq-medium)] font-mono">
              {activeTab === 'overview' ? 'Recent Queue Telemetry' : 'All Scheduled & Processed Jobs'}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-chronq-gray)] font-mono">
                {jobs.length} tracked ({queuedJobsCount} queued)
              </span>
              <button
                type="button"
                disabled={queuedJobsCount === 0}
                onClick={() => setIsClearModalOpen(true)}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded border border-[var(--color-status-error)]/40 text-[var(--color-status-error)] hover:bg-[var(--color-status-error-bg)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Clear Queue
              </button>
            </div>
          </div>
          <JobTable
            jobs={activeTab === 'overview' ? jobs.slice(0, 10) : jobs}
            onRetry={handleRetryJob}
            onSimulateFailure={() => toggleSimulation(true)}
          />
        </section>
      )}

      {(activeTab === 'overview' || activeTab === 'workers') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-chronq-medium)] font-mono">
              Worker Fleet Overview
            </h3>
            <span className="text-xs text-[var(--color-chronq-gray)] font-mono">{workers.length} nodes active</span>
          </div>
          <WorkerGrid workers={workers} onScaleWorkers={scaleWorkers} />
        </section>
      )}

      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          await createJob(data);
        }}
      />

      <GenerateWorkloadModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={async (config) => {
          const res = await generateWorkload(config);
          setNotification(`Successfully enqueued ${res.generated_count} demo jobs.`);
          setTimeout(() => setNotification(null), 4000);
        }}
      />

      <ClearQueueModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClearQueue}
        queuedCount={queuedJobsCount}
        isClearing={isClearing}
      />
    </Layout>
  );
};

export default App;