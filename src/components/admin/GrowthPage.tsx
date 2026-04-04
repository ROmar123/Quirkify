import { useState } from 'react';
import { cn } from '../../lib/utils';
import CampaignManager from './CampaignManager';
import SocialIntegration from './SocialIntegration';
import LiveStreamManager from './LiveStreamManager';

type Tab = 'campaigns' | 'social' | 'streams';

export default function GrowthPage() {
  const [tab, setTab] = useState<Tab>('campaigns');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'social',    label: 'Social' },
    { id: 'streams',   label: 'Live Streams' },
  ];

  return (
    <div>
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-b border-purple-100 px-4 py-3">
        <div className="flex gap-2 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-black transition-all',
                tab === t.id ? 'text-white shadow-md' : 'bg-purple-50 text-purple-400 hover:bg-purple-100'
              )}
              style={tab === t.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'campaigns' && <CampaignManager />}
      {tab === 'social'    && <SocialIntegration />}
      {tab === 'streams'   && <LiveStreamManager />}
    </div>
  );
}
