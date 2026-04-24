import type { AuctionStatus, ChannelAllocations, ChannelReservations, Product, ProductCondition, SalesChannel } from '../types';

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function defaultAllocations(channel: SalesChannel, quantity: number): ChannelAllocations {
  return {
    store: channel === 'store' ? quantity : 0,
    auction: channel === 'auction' ? quantity : 0,
    packs: channel === 'pack' ? quantity : 0,
  };
}

export function emptyReservations(): ChannelReservations {
  return { store: 0, auction: 0, packs: 0 };
}

export function labelCondition(condition: ProductCondition) {
  switch (condition) {
    case 'like_new':
    case 'Like New':
      return 'Like new';
    case 'pre_owned':
    case 'Pre-owned':
      return 'Pre-owned';
    case 'refurbished':
    case 'Refurbished':
      return 'Refurbished';
    default:
      return 'New';
  }
}

export function currency(amount: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(value?: string | null) {
  if (!value) return 'Schedule pending';
  return new Intl.DateTimeFormat('en-ZA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function availableUnits(product: Product, channel: SalesChannel = 'store') {
  const onHand = Number(product.inventory?.onHand ?? product.stock ?? 0);
  const reserved = Number(product.inventory?.reserved?.[channel] ?? 0);
  const sold = Number(product.inventory?.sold?.[channel] ?? 0);
  return Math.max(onHand - reserved - sold, 0);
}

export function totalReservedUnits(product: Product) {
  return (
    Number(product.inventory?.reserved?.store ?? 0) +
    Number(product.inventory?.reserved?.auction ?? 0) +
    Number(product.inventory?.reserved?.packs ?? 0)
  );
}

export function formatCountdown(value?: string | null, now = Date.now()) {
  if (!value) return 'Schedule pending';
  const remaining = new Date(value).getTime() - now;
  if (remaining <= 0) return 'Closing now';

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m remaining`;
}

export function auctionStatusLabel(status: AuctionStatus) {
  switch (status) {
    case 'live':
    case 'active':
      return 'Live now';
    case 'scheduled':
      return 'Scheduled';
    case 'closed':
    case 'ended':
    case 'completed':
      return 'Closed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Auction';
  }
}
