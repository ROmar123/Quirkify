const API_BASE = '/api/ai';

export async function identifyProduct(base64Image: string) {
  const res = await fetch(`${API_BASE}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image }),
  });
  if (!res.ok) throw new Error('AI analysis failed');
  return res.json();
}

export async function suggestCampaign(
  topSellers: { id: string; name: string; category?: string; revenue?: number }[],
  opts?: { month?: string }
) {
  const res = await fetch(`${API_BASE}/campaign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topSellers, month: opts?.month }),
  });
  if (!res.ok) throw new Error('Campaign generation failed');
  const data = await res.json();
  const first = data.campaign ?? data.campaigns?.[0] ?? data;
  return {
    title: first.title ?? '',
    description: first.description ?? '',
    strategy: first.strategy ?? first.expectedImpact ?? '',
  };
}

export async function getHostTalkingPoints(productName: string, category: string) {
  const res = await fetch(`${API_BASE}/talking-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productName, category }),
  });
  if (!res.ok) throw new Error('Host talking points generation failed');
  return res.json();
}

export async function getPersonalizedRecommendations(products: { id: string; name: string; category?: string; retailPrice?: number }[], userInterests: string[] = []) {
  const res = await fetch(`${API_BASE}/personalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products, userInterests }),
  });
  if (!res.ok) throw new Error('Personalized recommendations failed');
  return res.json();
}
