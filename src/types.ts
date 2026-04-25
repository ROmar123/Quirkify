export type UserRole = 'customer' | 'seller' | 'admin';
export type IntakeSource = 'manual' | 'ai';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'active' | 'archived';
export type ProductCondition = 'new' | 'like_new' | 'pre_owned' | 'refurbished' | 'New' | 'Like New' | 'Pre-owned' | 'Refurbished';
export type SalesChannel = 'store' | 'auction' | 'pack';
export type Rarity = 'Common' | 'Limited' | 'Rare' | 'Super Rare' | 'Unique';
export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';
export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'manual_review';
export type ShippingStatus =
  | 'not_started'
  | 'packing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'returned';
export type AuctionStatus = 'scheduled' | 'live' | 'closed' | 'cancelled' | 'active' | 'ended' | 'completed';
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended';
export type CampaignStatus = 'draft' | 'approved' | 'rejected' | 'scheduled' | 'active';

export interface TimestampFields {
  createdAt: string;
  updatedAt: string;
}

export interface ChannelAllocations {
  store: number;
  auction: number;
  packs: number;
}

export interface ChannelReservations {
  store: number;
  auction: number;
  packs: number;
}

export type AllocationSnapshot = ChannelAllocations;

export interface InventoryLedger {
  onHand: number;
  allocated: ChannelAllocations;
  reserved: ChannelReservations;
  sold: ChannelAllocations;
}

export interface ProductMedia {
  url: string;
  path?: string;
  alt?: string;
}

export interface PricingSnapshot {
  listPrice: number;
  salePrice: number;
  compareAtPrice?: number;
  auctionStartPrice?: number;
  auctionReservePrice?: number;
}

export interface ProductDraft {
  title: string;
  description: string;
  category: string;
  condition: ProductCondition;
  tags?: string[];
  suggestedChannel: SalesChannel;
  pricing: PricingSnapshot;
  inventory: {
    onHand: number;
    allocated: ChannelAllocations;
  };
  merchandisingNotes?: string[];
  rarityNotes?: string[];
}

export interface Product extends TimestampFields {
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  description: string;
  category: string;
  condition: ProductCondition;
  status: ProductStatus;
  source?: IntakeSource;
  channels?: {
    store: boolean;
    auction: boolean;
    packComponent: boolean;
  };
  listingType?: 'store' | 'auction' | 'both' | SalesChannel;
  pricing?: PricingSnapshot;
  retailPrice?: number;
  markdownPercentage?: number;
  discountPrice?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  inventory?: InventoryLedger;
  stock?: number;
  totalStock?: number;
  allocations?: AllocationSnapshot;
  media?: ProductMedia[];
  imageUrl?: string;
  imageUrls?: string[];
  tags?: string[];
  merchandisingNotes?: string[];
  rarityNotes?: string[];
  aiConfidence?: number;
  confidenceScore?: number;
  aiNotes?: string[];
  featured?: boolean;
  sourceReviewId?: string;
  createdBy?: string;
  updatedBy?: string;
  authorUid?: string;
  approvalDate?: string;
  version?: number;
  rarity?: Rarity;
  serialNumber?: string;
  stats?: {
    quirkiness: number;
    rarity: number;
    utility: number;
    hype: number;
  };
}

export interface ReviewEntry extends TimestampFields {
  id: string;
  status: ReviewStatus;
  source: IntakeSource;
  sourceInput: {
    notes: string;
    categoryHint?: string;
    channelHint?: SalesChannel;
    media: ProductMedia[];
  };
  generatedDraft: ProductDraft;
  aiNotes: string[];
  confidenceMarkers: string[];
  confidenceScore: number;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  publishDecision?: SalesChannel;
  createdBy: string;
}

export interface PackComponent {
  productId: string;
  quantity: number;
  optional?: boolean;
}

export interface Pack extends TimestampFields {
  id: string;
  title: string;
  name?: string;
  description: string;
  heroImage?: string;
  imageUrl?: string;
  price: number;
  componentCount: number;
  components: PackComponent[];
  active: boolean;
  status?: 'available' | 'sold_out' | string;
  createdBy: string;
}

export interface Auction extends TimestampFields {
  id: string;
  productId: string;
  product?: Product;
  title: string;
  heroImage?: string;
  status: AuctionStatus;
  startsAt: string;
  endsAt: string;
  startTime?: string;
  endTime?: string;
  currentBid: number;
  startPrice: number;
  reservePrice?: number;
  increment: number;
  bidCount: number;
  highestBidderId?: string | null;
  winnerOrderId?: string | null;
  liveSessionId?: string | null;
  channelReservationQuantity?: number;
  createdBy?: string;
}

export interface Bid extends TimestampFields {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName: string;
  amount: number;
}

export interface LiveSession extends TimestampFields {
  id: string;
  title: string;
  status: LiveSessionStatus;
  hostId: string;
  hostName: string;
  auctionQueue: string[];
  currentAuctionId?: string | null;
  startedAt?: string;
  endedAt?: string;
  spotlightMessage?: string;
}

export interface OrderLineItem {
  type: 'product' | 'pack' | 'auction_win';
  refId: string;
  title: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  inventoryReservations: ChannelReservations;
  reservationBreakdown?: Array<{
    productId: string;
    channel: SalesChannel;
    quantity: number;
  }>;
}

export interface OrderEvent {
  id: string;
  type: string;
  note: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface Order extends TimestampFields {
  id: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: OrderLineItem[];
  orderType: 'store' | 'pack' | 'auction' | 'manual';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  notes?: string;
  adminNotes?: string;
  trackingNumber?: string;
  carrier?: string;
  checkoutUrl?: string;
  shippingAddress?: {
    line1: string;
    city: string;
    postalCode: string;
  };
  eventHistory: OrderEvent[];
}

export interface GrowthRecommendation {
  heroHeadline: string;
  featuredProductIds: string[];
  featuredAuctionIds: string[];
  featuredPackIds: string[];
  promotionalTheme: string;
  urgencyMoment: string;
  messagingDirection: string;
  operationalRecommendations: string[];
}

export interface CampaignDraft extends TimestampFields {
  id: string;
  status: CampaignStatus;
  goal: string;
  constraints: string;
  authoredBy: string;
  approvedBy?: string;
  approvedAt?: string;
  aiSummary: string;
  recommendation: GrowthRecommendation;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  featuredProductIds: string[];
  suggestedProducts?: string[];
  expectedImpact?: 'High' | 'Medium' | 'Low';
  strategy?: string;
  type?: string;
  status?: CampaignStatus | string;
  discountPercentage?: number;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile extends TimestampFields {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  xp: number;
  streak: number;
  wins: number;
  ordersCount: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  badges: string[];
  createdAt: string;
  updatedAt?: string;
  stats: {
    itemsCollected: number;
    auctionsWon: number;
    totalBids: number;
  };
}

export interface UserProgress {
  uid: string;
  xp: number;
  level: number;
  balance: number;
  collectionCount: number;
  badges: string[];
  lastActive: string;
}

export interface CollectionItem {
  id: string;
  ownerId?: string;
  productId: string;
  product?: Product;
  acquiredAt?: string;
  purchasePrice?: number;
}

export interface CartItem {
  kind: 'product' | 'pack';
  productId: string;
  title: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  maxStock?: number;
}
