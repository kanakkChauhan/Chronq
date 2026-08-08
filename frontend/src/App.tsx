import { useEffect, useState } from 'react'

interface JobAttempt {
  attempt: number
  status: string
  error: string | null
}

interface Job {
  id: string
  type: string
  status: string
  priority: number
  error: string | null
  retries: number
  max_retries: number
  attempt_history: JobAttempt[]
}

interface WorkerState {
  status: 'IDLE' | 'BUSY'
  current_job: string | null
}

interface Metrics {
  active_workers: number
  queued: number
  running: number
  completed: number
  failed: number
  failure_rate: number
  throughput: number
  simulate_failures: boolean
  workers: Record<number, WorkerState>
}

export default function App() {
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [metrics, setMetrics] = useState<Metrics>({
    active_workers: 3,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    failure_rate: 0.0,
    throughput: 0.0,
    simulate_failures: false,
    workers: {}
  })

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWS = () => {
      // Swapped 'localhost' for '127.0.0.1' to bypass Mac IPv6 routing issues
      ws = new WebSocket('ws://127.0.0.1:8000/api/ws')

      ws.onopen = () => console.log("🟢 WebSocket Connected!")

      ws.onclose = () => {
        console.log("🔴 WebSocket Disconnected. Retrying in 2s...")
        reconnectTimer = setTimeout(connectWS, 2000)
      }

      ws.onerror = (err) => console.error("WebSocket Error:", err)

      ws.onmessage = (event) => {
        console.log("📥 RAW WS DATA:", event.data) // <--- ADD THIS LINE
        const data = JSON.parse(event.data)
        if (data.event === 'job_updated') {
          setJobs((prev) => ({
            ...prev,
            [data.job.id]: data.job
          }))
        }
      }
    }

    connectWS()

    const interval = setInterval(async () => {
      try {
        // Swapped to 127.0.0.1 here as well for consistency
        const res = await fetch('http://127.0.0.1:8000/api/observability')
        const data = await res.json()
        setMetrics(data)
      } catch (err) {
        // Silently catch fetch errors if backend is restarting
      }
    }, 1000)

    return () => {
      clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null // Prevent reconnect loop on unmount
        ws.close()
      }
      clearInterval(interval)
    }
  }, [])

  const triggerJob = async (type: string, priority: number) => {
    await fetch('http://127.0.0.1:8000/api/jobs', { // Changed to 127.0.0.1
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload: {}, priority })
    })
  }

  const scaleWorkers = async (newCount: number) => {
    if (newCount < 0 || newCount > 20) return
    await fetch('http://127.0.0.1:8000/api/workers/scale', { // Changed to 127.0.0.1
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: newCount })
    })
  }

  const toggleSimulation = async () => {
    await fetch('http://127.0.0.1:8000/api/simulation/toggle', { // Changed to 127.0.0.1
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !metrics.simulate_failures })
    })
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header & Controls */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TaskFlow Engine</h1>
            <p className="text-xs text-neutral-400 mt-1">Distributed Priority Queue & Worker Orchestrator</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleSimulation}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-colors border shadow-sm ${
                metrics.simulate_failures
                  ? 'bg-red-950 text-red-400 border-red-900 hover:bg-red-900/80'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${metrics.simulate_failures ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`}></div>
              Failure Simulation: {metrics.simulate_failures ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1.5 rounded-lg shadow-sm">
              <span className="text-xs text-neutral-400 px-2 font-medium">Worker Fleet:</span>
              <button
                onClick={() => scaleWorkers(Math.max(0, metrics.active_workers - 1))}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors"
              >
                -
              </button>
              <span className="text-sm font-mono font-bold px-2 text-emerald-400">{metrics.active_workers}</span>
              <button
                onClick={() => scaleWorkers(metrics.active_workers + 1)}
                className="bg-neutral-800 hover:bg-neutral-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Observability Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Active Workers</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">{metrics.active_workers}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Queued Jobs</p>
            <p className="text-2xl font-mono font-bold text-blue-400 mt-1">{metrics.queued + metrics.running}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Throughput</p>
            <p className="text-2xl font-mono font-bold text-purple-400 mt-1">{metrics.throughput} <span className="text-xs text-neutral-500 font-normal">jobs/s</span></p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Failure Rate</p>
            <p className="text-2xl font-mono font-bold text-amber-400 mt-1">{metrics.failure_rate}%</p>
          </div>
        </div>

        {/* Worker Fleet Status Panel */}
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Worker Fleet Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(metrics.workers).map(([id, worker]) => (
              <div key={id} className="bg-neutral-950 border border-neutral-800/80 p-3 rounded flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-bold text-neutral-300">Worker {id}</p>
                  <p className="text-[10px] text-neutral-500 font-mono truncate w-28 mt-0.5">
                    {worker.current_job ? worker.current_job : 'No active job'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${worker.status === 'BUSY' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`}></span>
                  <span className={`text-[10px] font-mono font-bold ${worker.status === 'BUSY' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                    {worker.status}
                  </span>
                </div>
              </div>
            ))}
            {Object.keys(metrics.workers).length === 0 && (
              <p className="text-xs text-neutral-500 col-span-4 py-2">No active workers in pool.</p>
            )}
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => triggerJob('api_request', 3)}
            className="bg-purple-600 hover:bg-purple-500 transition-colors px-4 py-2 rounded-md text-sm font-semibold shadow-sm"
          >
            + API Request
          </button>
          <button
            onClick={() => triggerJob('report_generation', 1)}
            className="bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded-md text-sm font-semibold shadow-sm"
          >
            + Generate Report
          </button>
        </div>

        {/* Live Job Feed with Failure Audit Trail */}
        <div className="flex flex-col gap-3">
          {Object.values(jobs).reverse().map((job) => (
            <div
              key={job.id}
              className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-neutral-200">{job.type}</p>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400">
                      PRIORITY {job.priority}
                    </span>
                    {job.retries > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/40 text-amber-300 border border-amber-800">
                        ATTEMPTS: {job.retries + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 font-mono mt-1">{job.id}</p>
                </div>

                <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider
                  ${job.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                    job.status === 'RUNNING' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                    job.status === 'FAILED' ? 'bg-red-950 text-red-400 border border-red-900' :
                    'bg-amber-950 text-amber-400 border border-amber-900'}`}>
                  {job.status}
                </span>
              </div>

              {/* Attempt History Audit Trail */}
              {job.attempt_history && job.attempt_history.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-800/80">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">Lifecycle Audit Trail</p>
                  <div className="flex flex-col gap-1.5 font-mono text-xs">
                    {job.attempt_history.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-neutral-950 px-3 py-1.5 rounded border border-neutral-800/50">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 font-bold">Attempt {att.attempt}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${att.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                            {att.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 truncate max-w-xs">
                          {att.error ? att.error : 'Success'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {Object.keys(jobs).length === 0 && (
            <div className="text-center py-12 border border-dashed border-neutral-800 rounded-lg text-neutral-500">
              Trigger a workload to watch the live failure audit trail in action.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}