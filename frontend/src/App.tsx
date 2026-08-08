import { useEffect, useState } from 'react'

interface Job {
  id: string
  type: string
  status: string
  priority: number
  error: string | null
  retries: number
  max_retries: number
}

export default function App() {
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const [workerCount, setWorkerCount] = useState<number>(3)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/ws')
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.event === 'job_updated') {
        setJobs((prev) => ({
          ...prev,
          [data.job.id]: data.job
        }))
      }
    }

    // Fetch initial worker count
    fetch('http://localhost:8000/api/workers')
      .then(res => res.json())
      .then(data => {
        if (data.active_workers !== undefined) setWorkerCount(data.active_workers)
      })
      .catch(err => console.error("Failed to fetch workers:", err))

    return () => ws.close()
  }, [])

  const triggerJob = async (type: string, priority: number) => {
    await fetch('http://localhost:8000/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload: {}, priority })
    })
  }

  const scaleWorkers = async (newCount: number) => {
    if (newCount < 0 || newCount > 10) return
    setWorkerCount(newCount)
    await fetch('http://localhost:8000/api/workers/scale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: newCount })
    })
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TaskFlow Engine</h1>
            <p className="text-xs text-neutral-400 mt-1">Active Worker Fleet: <span className="text-emerald-400 font-mono font-bold">{workerCount}</span></p>
          </div>
          
          {/* Worker Scaler Controls */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1.5 rounded-lg shadow-sm">
            <span className="text-xs text-neutral-400 px-2 font-medium">Workers:</span>
            <button 
              onClick={() => scaleWorkers(Math.max(0, workerCount - 1))}
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors"
            >
              -
            </button>
            <span className="text-sm font-mono font-bold px-2">{workerCount}</span>
            <button 
              onClick={() => scaleWorkers(workerCount + 1)}
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-2.5 py-1 rounded text-xs font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex gap-2 mb-8">
          <button 
            onClick={() => triggerJob('api_request', 3)}
            className="bg-purple-600 hover:bg-purple-500 transition-colors px-3.5 py-2 rounded-md text-sm font-semibold shadow-sm"
          >
            + API Sync (Flaky)
          </button>
          <button 
            onClick={() => triggerJob('report_generation', 1)}
            className="bg-blue-600 hover:bg-blue-500 transition-colors px-3.5 py-2 rounded-md text-sm font-semibold shadow-sm"
          >
            + Gen Report (Low)
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          {Object.values(jobs).reverse().map((job) => (
            <div 
              key={job.id} 
              className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 flex justify-between items-center shadow-sm"
            >
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-neutral-200">{job.type}</p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400">
                    PRIORITY {job.priority}
                  </span>
                  {job.retries > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/40 text-amber-300 border border-amber-800">
                      RETRY {job.retries}/{job.max_retries}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 font-mono mt-1">{job.id}</p>
                {job.error && (
                  <p className="text-xs text-red-400 mt-1 font-mono">{job.error}</p>
                )}
              </div>
              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wider
                  ${job.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 
                    job.status === 'RUNNING' ? 'bg-blue-950 text-blue-400 border border-blue-900' : 
                    job.status === 'FAILED' ? 'bg-red-950 text-red-400 border border-red-900' :
                    'bg-amber-950 text-amber-400 border border-amber-900'}`}>
                  {job.status}
                </span>
              </div>
            </div>
          ))}
          
          {Object.keys(jobs).length === 0 && (
            <div className="text-center py-12 border border-dashed border-neutral-800 rounded-lg text-neutral-500">
              Trigger a workload to watch your elastic worker fleet process jobs.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}