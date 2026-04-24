export async function requestAiIntake(payload: {
  notes: string;
  categoryHint?: string;
  channelHint?: string;
  base64Image?: string;
}) {
  const response = await fetch('/api/ai/intake', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to run AI intake');
  }
  return data;
}

export async function identifyProduct(base64Image: string) {
  const response = await fetch('/api/ai/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ base64Image }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to identify product');
  }
  return data;
}

export async function requestGrowthPlan(payload: { goal: string; constraints: string }) {
  const response = await fetch('/api/ai/campaign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate growth plan');
  }
  return data;
}

export async function suggestCampaign(topSellers: any[]) {
  const response = await fetch('/api/ai/campaign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ topSellers }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate campaign');
  }
  return data;
}
