import { useEffect, useState } from 'react'

interface Job {
  id: string
  type: string
  status: string
  priority: number
  error: string | null
}

export default function App() {
  const [jobs, setJobs] = useState<Record<string, Job>>({})

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

    return () => ws.close()
  }, [])

  const triggerJob = async (type: string, priority: number) => {
    await fetch('http://localhost:8000/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload: {}, priority })
    })
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">TaskFlow Engine</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => triggerJob('api_request', 3)}
              className="bg-purple-600 hover:bg-purple-500 transition-colors px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm"
            >
              + API Sync (High)
            </button>
            <button 
              onClick={() => triggerJob('report_generation', 1)}
              className="bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm"
            >
              + Gen Report (Low)
            </button>
          </div>
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
                </div>
                <p className="text-xs text-neutral-500 font-mono mt-1">{job.id}</p>
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
              Run the stress test script to populate the queue.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}