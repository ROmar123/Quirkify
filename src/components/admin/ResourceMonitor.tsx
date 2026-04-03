import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Zap, Camera, HardDrive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ResourceMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  icon: any;
  color: string;
}

export default function ResourceMonitor() {
  const [metrics, setMetrics] = useState<ResourceMetric[]>([
    { name: 'Firestore Reads', current: 12450, limit: 50000, unit: 'ops/day', icon: Database, color: 'bg-blue-500' },
    { name: 'Firestore Writes', current: 3200, limit: 20000, unit: 'ops/day', icon: Database, color: 'bg-indigo-500' },
    { name: 'Cloud Functions', current: 120000, limit: 2000000, unit: 'invoc/mo', icon: Zap, color: 'bg-yellow-500' },
    { name: 'Vision API', current: 450, limit: 1000, unit: 'units/mo', icon: Camera, color: 'bg-quirky' },
    { name: 'Cloud Storage', current: 1.2, limit: 5, unit: 'GB', icon: HardDrive, color: 'bg-cyber' },
  ]);

  const [alerts, setAlerts] = useState([
    { type: 'warning', message: 'Vision API usage at 45%. Consider batching intake.', timestamp: '10m ago' },
    { type: 'success', message: 'Firestore storage optimized. 2.4k stale docs archived.', timestamp: '1h ago' },
  ]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => {
          const percentage = (metric.current / metric.limit) * 100;
          const isHigh = percentage > 80;

          return (
            <div key={metric.name} className="p-6 bg-white border border-zinc-100 rounded-none shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-none", metric.color, "bg-opacity-10")}>
                    <metric.icon className={cn("w-4 h-4", metric.color.replace('bg-', 'text-'))} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{metric.name}</span>
                </div>
                {isHigh && <AlertTriangle className="w-4 h-4 text-hot animate-pulse" />}
              </div>

              <div className="flex items-end justify-between mb-2">
                <p className="text-2xl font-bold">{metric.current.toLocaleString()}<span className="text-[10px] text-zinc-400 font-normal ml-1">{metric.unit}</span></p>
                <p className="text-[10px] font-bold text-zinc-400">{Math.round(percentage)}%</p>
              </div>

              <div className="w-full h-1 bg-zinc-50 rounded-none overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  className={cn("h-full", isHigh ? "bg-hot" : metric.color)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 bg-zinc-50 border border-zinc-100 rounded-none">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-zinc-400">Cost Control Alerts</h3>
          <div className="space-y-4">
            {alerts.map((alert, i) => (
              <div key={i} className={cn(
                "p-4 border flex items-start gap-4",
                alert.type === 'warning' ? "bg-red-50/50 border-red-100 text-red-600" : "bg-green-50/50 border-green-100 text-green-600"
              )}>
                {alert.type === 'warning' ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-tight">{alert.message}</p>
                  <p className="text-[8px] opacity-60 font-bold uppercase tracking-widest mt-1">{alert.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 bg-white border border-zinc-100 rounded-none shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-zinc-400">Feature Toggles</h3>
          <div className="space-y-6">
            {[
              { name: 'Live Auctions', status: 'Active', description: 'Real-time bidding engine' },
              { name: 'AI Vision Intake', status: 'Active', description: 'Auto-categorization & tagging' },
              { name: 'Social Integration', status: 'Paused', description: 'TikTok & Instagram sync' },
            ].map((feature) => (
              <div key={feature.name} className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-tight">{feature.name}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{feature.description}</p>
                </div>
                <button className={cn(
                  "px-4 py-1 text-[8px] font-bold uppercase tracking-widest border",
                  feature.status === 'Active' ? "bg-black text-white border-black" : "bg-white text-zinc-400 border-zinc-100"
                )}>
                  {feature.status}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
