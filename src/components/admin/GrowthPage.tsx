import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import CampaignManager from './CampaignManager';
import SocialIntegration from './SocialIntegration';
import LiveStreamManager from './LiveStreamManager';

type Tab = 'campaigns' | 'social' | 'streams';

export default function GrowthPage() {
  const { pathname } = useLocation();
  const initial: Tab = pathname === '/admin/social' ? 'social' : pathname === '/admin/streams' ? 'streams' : 'campaigns';
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'campaigns', label: 'Campaigns' },
    { id: 'social',    label: 'Social' },
    { id: 'streams',   label: 'Live Streams' },
  ];

  return (
    <div>
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('filter-pill', tab === t.id && 'active')}>
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
