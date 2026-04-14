<<<<<<< HEAD
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3a0606b8-4950-4129-84f3-037b307d2152

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
=======
# Quirkify - Gamified Social Commerce Platform

South Africa's home for verified collectibles, limited drops, and pre-loved finds.

## Features

- **AI-Powered Product Verification**: Every item is AI-checked before approval
- **Live Auctions**: Bid on exclusive drops in real-time
- **Secure Payments**: Powered by Yoco
- **Order Tracking**: Full shipment tracking integration
- **Gamification**: Level up and earn rewards as you shop
- **Mobile-First**: Optimized for mobile experience

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Firebase (Firestore, Storage)
- Supabase (Auth, PostgreSQL)
- Motion (animations)
- Yoco (payments)

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ROmar123/Quirkify.git
cd Quirkify

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```bash
# Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Admin Emails (comma-separated)
VITE_ADMIN_EMAILS=admin@example.com
```

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Project Structure

```
src/
├── components/
│   ├── admin/          # Admin dashboard components
│   ├── auth/           # Authentication components
│   ├── inventory/      # Inventory management
│   ├── layout/         # Header, Footer, Navigation
│   ├── legal/          # Terms, Privacy, Returns
│   ├── live/           # Live streaming
│   ├── profile/        # User profile, Orders, Collection
│   ├── store/          # Storefront, Product details, Checkout
│   └── ui/             # Reusable UI components
├── context/            # React contexts (Cart, Mode)
├── hooks/              # Custom React hooks
├── lib/                # Utilities (security, retry, utils)
├── services/           # API services
├── types/              # TypeScript types
├── firebase.ts         # Firebase configuration
├── supabase.ts         # Supabase configuration
└── App.tsx             # Main app component
```

## Key Features Implemented

### Security
- XSS protection with input sanitization
- Rate limiting on API calls
- CSRF token generation
- Secure localStorage wrapper
- Content Security Policy headers

### Performance
- Code splitting with Vite
- Lazy loading for images
- Exponential backoff retry logic
- Circuit breaker pattern
- Cart persistence

### Accessibility
- Screen reader support
- Keyboard navigation
- Focus management
- ARIA labels
- Skip links

### Mobile
- 44px minimum touch targets
- Bottom navigation
- Safe area support
- Responsive grids
- Touch-optimized interactions

## Database Setup

### Supabase RLS Policy

Add this policy for public product access:

```sql
CREATE POLICY "Allow public read access to approved products"
ON products FOR SELECT
TO public
USING (status = 'approved');
```

## Deployment

### Vercel

1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy

### Manual

```bash
npm run build
# Upload dist/ to your hosting provider
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, email support@quirkify.co.za or join our Discord community.

---

Built with ❤️ in Cape Town, South Africa
>>>>>>> origin/main
