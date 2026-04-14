import { useState } from 'react';
import { motion } from 'motion/react';
import { Database, Zap, Camera, HardDrive, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ResourceMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  icon: any;
  color: string;
  textColor: string;
}

export default function ResourceMonitor() {
  const [metrics] = useState<ResourceMetric[]>([
    { name: 'Firestore Reads', current: 12450, limit: 50000, unit: 'ops/day', icon: Database, color: 'bg-blue-500', textColor: 'text-blue-500' },
    { name: 'Firestore Writes', current: 3200, limit: 20000, unit: 'ops/day', icon: Database, color: 'bg-indigo-500', textColor: 'text-indigo-500' },
    { name: 'Cloud Functions', current: 120000, limit: 2000000, unit: 'invoc/mo', icon: Zap, color: 'bg-yellow-500', textColor: 'text-yellow-500' },
    { name: 'Vision API', current: 450, limit: 1000, unit: 'units/mo', icon: Camera, color: 'bg-purple-500', textColor: 'text-purple-500' },
    { name: 'Cloud Storage', current: 1.2, limit: 5, unit: 'GB', icon: HardDrive, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  ]);

  const [alerts] = useState([
    { type: 'warning', message: 'Vision API usage at 45%. Consider batching intake.', timestamp: '10m ago' },
    { type: 'success', message: 'Firestore storage optimised. 2.4k stale docs archived.', timestamp: '1h ago' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-purple-500" />
        <h2 className="text-sm font-bold text-gray-900">Resource Usage</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => {
          const percentage = (metric.current / metric.limit) * 100;
          const isHigh = percentage > 80;

          return (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg bg-opacity-10', metric.color.replace('bg-', 'bg-') + '/10')}>
                    <metric.icon className={cn('w-3.5 h-3.5', metric.textColor)} />
                  </div>
                  <span className="section-label">{metric.name}</span>
                </div>
                {isHigh && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 animate-pulse" />}
              </div>

              <div className="flex items-end justify-between mb-2">
                <p className="text-xl font-bold text-gray-900">
                  {metric.current.toLocaleString()}
                  <span className="text-xs text-gray-400 font-normal ml-1">{metric.unit}</span>
                </p>
                <p className="text-xs font-semibold text-gray-400">{Math.round(percentage)}%</p>
              </div>

              <div className="progress-bar">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  transition={{ delay: idx * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                  className={cn('progress-bar-fill', isHigh ? 'bg-orange-500' : metric.color)}
                />
              </div>

              <p className="text-[10px] text-gray-400 mt-1.5">
                {metric.current.toLocaleString()} / {metric.limit.toLocaleString()}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="section-label mb-4">Cost Control Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-lg p-3 border text-xs',
                  alert.type === 'warning'
                    ? 'bg-orange-50 border-orange-100 text-orange-700'
                    : 'bg-green-50 border-green-100 text-green-700'
                )}
              >
                {alert.type === 'warning'
                  ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="font-semibold">{alert.message}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{alert.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="section-label mb-4">Feature Toggles</h3>
          <div className="space-y-4">
            {[
              { name: 'Live Auctions', status: 'Active', description: 'Real-time bidding engine' },
              { name: 'AI Vision Intake', status: 'Active', description: 'Auto-categorisation & tagging' },
              { name: 'Social Integration', status: 'Paused', description: 'TikTok & Instagram sync' },
            ].map((feature) => (
              <div key={feature.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{feature.name}</p>
                  <p className="text-xs text-gray-400">{feature.description}</p>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full',
                  feature.status === 'Active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  {feature.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
