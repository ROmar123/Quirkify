export type Rarity = 'Common' | 'Limited' | 'Rare' | 'Super Rare' | 'Unique';
export type ProductCondition = 'New' | 'Like New' | 'Pre-owned' | 'Refurbished';

export interface ItemStats {
  quirkiness: number;
  rarity: number;
  utility: number;
  hype: number;
}

export interface AllocationSnapshot {
  store: number;
  auction: number;
  packs: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  priceRange: {
    min: number;
    max: number;
  };
  retailPrice: number;
  markdownPercentage: number;
  discountPrice: number;
  confidenceScore: number;
  imageUrl: string;
  imageUrls?: string[];
  status: 'pending' | 'approved' | 'rejected';
  listingType: 'store' | 'auction' | 'both';
  condition: ProductCondition;

  // Inventory
  stock: number; // backwards compatibility
  totalStock: number; // canonical total physical inventory
  allocations: AllocationSnapshot; // required, enforced
  reserved?: AllocationSnapshot; // for in-progress transactions

  // Metadata
  isPaused?: boolean;
  isReserved?: boolean;
  rarity?: Rarity; // legacy, kept for Pack compatibility
  stats?: ItemStats;
  serialNumber?: string;
  maxSupply?: number;
  marketData?: {
    location: string;
    trend: 'up' | 'down' | 'stable';
  };

  // Timestamps
  createdAt: string;
  updatedAt?: string;
  approvalDate?: string;

  // User
  authorUid: string;

  // Versioning
  version?: number;
  previousVersionIds?: string[]; // Store IDs of previous versions
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
  };
  stats: {
    itemsCollected: number;
    auctionsWon: number;
    totalBids: number;
  };
  badges: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'payment_failed';
  shippingInfo: {
    email: string;
    address: string;
    city: string;
    zip: string;
    phone?: string;
    trackingNumber?: string;
    carrier?: string;
  };
  paymentInfo?: {
    paymentId: string;
    method: string;
    status: string;
  };
  createdAt: any;
  orderType: 'store' | 'auction' | 'pack';

  // For audit trail - capture allocations at purchase time
  inventorySnapshot?: {
    products: {
      [productId: string]: {
        allocations: AllocationSnapshot;
        stock: number;
      };
    };
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
  ownerId: string;
  productId: string;
  acquiredAt: string;
  purchasePrice: number;
  product?: Product;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;

  // Link to products
  linkedProductIds: string[]; // Products this pack draws from

  contents: {
    rarityProbabilities: { [key in Rarity]: number };
    itemCount: number;
  };

  status: 'available' | 'sold-out';
  stock?: number; // Remaining packs available

  // Metadata
  createdAt: string;
  createdBy: string; // Admin who created this pack
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  suggestedProducts: string[];
  status: 'draft' | 'active' | 'completed';
  type: 'sale' | 'auction' | 'social';
  createdAt: string;
}

export interface Auction {
  id: string;
  productId: string;
  product?: Product; // Joined data (denormalized)

  sellerId: string;
  startPrice: number;
  currentBid: number;
  highestBidderId: string | null;

  startTime: string;
  endTime: string;

  status: 'active' | 'ended' | 'cancelled';
  endReason?: 'time-expired' | 'no-bids' | 'inventory-depleted' | 'manual-cancel';
  bidCount: number;

  // Snapshot for audit trail
  productSnapshot?: Pick<Product, 'name' | 'imageUrl' | 'allocations' | 'stock'>;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  timestamp: string;
}

export interface LiveSession {
  id: string;
  hostId: string;
  title: string;
  description: string;
  status: 'live' | 'ended' | 'scheduled';
  currentAuctionId?: string;
  startTime: string;
  endTime?: string;
  viewerCount: number;
  thumbnailUrl?: string;
  hostName: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  type: 'text' | 'bid' | 'system';
}
