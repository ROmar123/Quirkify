# QUIRKIFY – MASTER PRODUCT, WORKFLOW & BUILD SPEC

## 0. CLAUDE READ THIS FIRST

This README is the single source of truth for Quirkify.

Do not invent workflows.
Do not add optional/future logic.
Do not create frontend-only states.
Do not patch random UI.
Do not redesign the product from scratch.

Claude must first:
1. Read this full README.
2. Audit the current repo against it.
3. Identify what exists, what partially works, what is missing, and what is broken.
4. Produce a gap analysis.
5. Then implement workflow by workflow.

Supabase is the only source of truth.

If a state, product, listing, order, wallet movement, bid, reservation, campaign, or stock movement is not persisted in Supabase, it is not real.

---

# 1. WHAT QUIRKIFY IS

Quirkify is a liquidation commerce platform.

It allows the business to:
- Intake products using AI or manual entry
- Review and approve products
- Manage inventory
- Allocate stock into store, auction, packs, or offline reservations
- Sell products through the customer-facing store
- Run real wallet-funded auctions
- Create product packs/bundles
- Track offline/marketplace sales
- Manage orders and fulfilment
- Connect delivery to The Courier Guy
- Allow Cape Town-only collection
- Manage customer wallets using Yoco top-ups
- Manage wallet withdrawals
- Run AI-assisted growth campaigns
- Send customer and employee emails

The app has two connected sides:

1. Employee/Admin side  
2. Customer side

The employee/admin side controls the business logic.
The customer side only displays approved, published, available stock.

---

# 2. CORE PRINCIPLE

Product is the master stock record.

Listing is how that stock is sold.

A product can feed:
- Store listing
- Auction listing
- Pack/bundle
- Offline reservation/sale

The same product can have quantities split across multiple selling routes.

Example:

Product quantity = 10

- Available: 2
- Store: 3
- Auction: 2
- Pack: 2
- Reserved offline: 1
- Sold: 0
- Removed: 0

Total must always reconcile.

---

# 3. SUPABASE SOURCE OF TRUTH

Supabase must own all business state.

Required logical entities:

- products
- product_images
- inventory_movements
- inventory_allocations
- store_listings
- auction_listings
- auction_bids
- packs
- pack_items
- offline_reservations
- carts
- orders
- order_items
- wallets
- wallet_transactions
- wallet_holds
- withdrawal_requests
- customer_addresses
- courier_shipments
- campaigns
- campaign_placements
- emails
- audit_logs

Claude must audit the current schema before creating anything new.

If tables already exist, align to them.
If tables are missing, propose changes before implementation.
Do not duplicate tables that already solve the same purpose.

---

# 4. PRODUCT STATES

Products must follow this lifecycle:

draft_review  
→ reviewed  
→ approved  
→ allocated  
→ live  
→ sold / removed / archived

Definitions:

draft_review:
Product has been created by AI intake or manual intake and is waiting for human review.

reviewed:
Admin has checked the product details but has not approved it for allocation.

approved:
Product is valid and can be allocated into store, auction, pack, or offline reserve.

allocated:
Some or all stock has been allocated.

live:
A store listing, auction listing, or pack containing this product is visible to customers.

sold:
Stock has been sold through store, auction, pack, or offline sale.

removed:
Stock has been removed from saleable inventory.

archived:
Product is hidden from active admin views but retained for history.

Sold items must not be deleted.

---

# 5. AI INTAKE WORKFLOW

## Purpose

AI Intake exists to:
- Identify the product from images
- Generate clean product details
- Estimate one realistic South African retail price
- Create a draft product for human review

AI Intake does not:
- Set quantity
- Set condition
- Allocate stock
- Publish products
- Create listings
- Create packs
- Create auctions
- Mark anything live

## Input

Admin uploads:
- Minimum 1 image
- Maximum 3 images

The uploaded images must represent one product only.

## AI Engine

Gemini must return exactly these fields:

- name
- description
- category
- retail_price
- confidence_score

No additional generated fields are required.

## Retail Price Rule

AI must estimate one retail price only.

Retail price must be based on South African online retailer pricing.

Examples of relevant pricing references:
- Takealot
- Makro
- Game
- Builders
- Checkers
- Clicks
- Dis-Chem
- Incredible Connection
- iStore
- Leroy Merlin
- HiFi Corp
- Other South African online retailers relevant to the product category

Amazon or international pricing must not be used unless there is no South African equivalent, and even then the final price must be converted into a realistic South African retail estimate.

Not allowed:
- No lower retail
- No average retail
- No upper retail
- No price range
- No made-up pricing
- No international price copied directly into ZAR without local context

## Selling Price Rule

System calculates:

selling_price = retail_price * 0.6

This represents the default Quirkify discount model.

Admin can override selling price in review.

Discount must then recalculate automatically:

discount_percent = ((retail_price - selling_price) / retail_price) * 100

## AI Product Creation

AI-created products must be inserted into Supabase with:

- name
- description
- category
- retail_price
- selling_price
- discount_percent
- confidence_score
- source = ai_intake
- ai_generated = true
- status = draft_review

## Review Queue

All AI intake products must go to review queue.

No AI-created product can go directly live.

## Human Review Responsibilities

Admin must:
- Validate name
- Validate description
- Validate category
- Validate retail price
- Validate selling price
- Add quantity
- Add condition
- Decide allocation route

AI never sets quantity or condition.

---

# 6. MANUAL INTAKE WORKFLOW

Manual intake is the second product onboarding route.

Admin manually enters:

- name
- description
- category
- retail_price
- selling_price
- images

System calculates:

discount_percent = ((retail_price - selling_price) / retail_price) * 100

Manual intake products also go to review queue.

Manual intake must not bypass review.

Manual intake creates:

- source = manual_intake
- ai_generated = false
- status = draft_review

---

# 7. REVIEW QUEUE PAGE

The Review Queue is the main control point for product approval.

This page must show all products with status draft_review or reviewed.

Each review item must show:

- Product images
- Name
- Description
- Category
- Retail price
- Selling price
- Discount percentage
- AI confidence score if AI-generated
- Source: AI intake or manual intake
- Quantity input
- Condition dropdown
- Review status
- Approve action
- Reject action
- Delete action where allowed

Admin must be able to edit:
- Name
- Description
- Category
- Retail price
- Selling price
- Images

Admin must add:
- Quantity
- Condition

Condition values should include:
- New
- Like New
- Good
- Fair
- Damaged
- For Parts

Approval requires:
- name not blank
- description not blank
- category not blank
- retail_price greater than 0
- selling_price greater than 0
- quantity greater than 0
- condition selected
- at least one image

Once approved, product becomes available for allocation.

---

# 8. INVENTORY PAGE

The Inventory page shows approved products and their stock position.

It must show:

- Product
- Total quantity
- Available quantity
- Store allocated quantity
- Auction allocated quantity
- Pack allocated quantity
- Offline reserved quantity
- Sold quantity
- Removed quantity
- Condition
- Status
- Actions

Actions:
- Allocate to store
- Allocate to auction
- Add to pack
- Reserve offline
- Edit product
- Delete product where allowed
- Archive product where deletion is not allowed

Inventory must not be a static table.
It must reflect real Supabase stock movements.

---

# 9. STOCK ENGINE

Stock must always reconcile.

Formula:

total_quantity =
available_quantity
+ store_quantity
+ auction_quantity
+ pack_quantity
+ reserved_quantity
+ sold_quantity
+ removed_quantity

Every movement must create a stock movement record.

Examples:
- Review approval creates available stock
- Allocating to store moves available to store
- Allocating to auction moves available to auction
- Adding to pack moves available to pack
- Reserving offline moves available/store to reserved
- Sale moves store/auction/pack/reserved to sold
- Removing stock moves available to removed
- Releasing reservation moves reserved back to available or original source

Claude must prevent negative stock.

Claude must prevent selling more stock than available.

---

# 10. ALLOCATION WORKFLOW

Allocation happens after product approval.

Admin can allocate quantity to:
- Store
- Auction
- Pack
- Offline reserve

The allocation experience should feel like one workflow.

From an approved product, admin should be able to choose:

- Send to Store
- Send to Auction
- Add to Pack
- Reserve Offline

Allocation must ask for quantity.

Quantity cannot exceed available stock.

Allocation must update Supabase.

---

# 11. STORE LISTINGS PAGE

Store listings are fixed-price customer-facing listings.

A store listing must include:

- Product reference
- Listing title
- Listing description
- Images
- Retail price
- Selling price
- Discount percentage
- Quantity allocated
- Quantity remaining
- Status
- Published flag

Store listing statuses:
- draft
- published
- paused
- sold_out
- removed

Customer side only shows:
- published listings
- quantity remaining greater than 0

Store purchase must:
- Check wallet balance
- Debit wallet
- Create order
- Create order item
- Move stock from store to sold
- Update listing quantity remaining

---

# 12. AUCTION LISTINGS PAGE

Auctions are real customer-side auctions.

Employee side creates and manages auction listings.

Auction listing must include:

- Product reference or pack reference
- Auction title
- Auction description
- Images
- Quantity
- Start price
- Current highest bid
- Start time
- End time
- Duration
- Status
- Published flag

Auction statuses:
- draft
- scheduled
- live
- ended
- cancelled
- completed

Customer side only shows auctions that are:
- published
- live
- not ended

## Auction Bid Logic

Customer must have wallet funds before bidding.

When customer places a bid:

1. Check wallet available balance
2. Create wallet hold for bid amount
3. Record bid
4. If previous highest bidder exists, release their hold
5. Update current highest bid

If customer is outbid:
- Their held funds are released

When auction ends:
- Highest bidder wins
- Held amount converts to debit
- Order is created
- Stock moves to sold
- Auction status becomes completed

Admin cannot change start price, quantity, or end time after bids exist.

Admin can edit presentation fields while auction is live:
- Title
- Description
- Images

Auction cancellation after bids exist must be restricted and logged.

---

# 13. PACKS / BUNDLES PAGE

Packs are separate sellable entities created from approved available stock.

A pack can contain:
- Multiple units of the same product
- Different products grouped together

Pack creation must allow:
- Pack name
- Pack description
- Pack image
- Products included
- Quantity of each product used per pack
- Number of packs created
- Pack retail value
- Pack selling price
- Discount percentage

Pack pricing:
- System calculates total retail value from included products
- Admin sets pack selling price
- Discount recalculates automatically

Pack stock rules:
- Packs can only use available stock
- Creating packs reduces available stock
- Pack quantity cannot exceed available inventory
- Removing product from unsold pack releases stock back to available
- Sold pack contents remain locked for history

Pack can be listed as:
- Store pack listing
- Auction pack listing

Customer sees pack as one sellable item.

Pack detail page must show:
- Pack price
- Retail value
- Discount
- What is included
- Condition summary
- Quantity available

---

# 14. OFFLINE RESERVATION / MARKETPLACE SALES

Quirkify must support off-site selling while tracking stock in the app.

Use cases:
- Facebook Marketplace
- WhatsApp sales group
- Manual sale
- In-person sale

Admin can reserve stock offline.

Reservation must capture:
- Product or pack
- Quantity
- Channel
- Reserved price
- Buyer name
- Notes
- Reservation date
- Expiry date
- Status

Reservation statuses:
- reserved
- sold_offline
- released
- expired
- cancelled

When stock is reserved:
- It must be removed from customer availability
- It must not be purchasable online
- It must not be available for auction or pack allocation

If sold offline:
- Admin captures actual sold price
- Stock moves to sold
- Offline sale record is retained

If not sold:
- Admin releases reservation
- Stock returns to available or original source

Actual sold price must be captured.

---

# 15. CUSTOMER STORE PAGE

Customer store must display only live store listings.

Store page must show:
- Product cards
- Product images
- Name
- Selling price
- Retail price crossed out
- Discount badge
- Condition
- Quantity urgency
- Add to cart button

Customer must be able to:
- View product
- Add to cart
- Buy using wallet
- See insufficient balance message
- Top up wallet if needed

---

# 16. CUSTOMER AUCTIONS PAGE

Customer auctions must display only live auctions.

Auction card must show:
- Image
- Title
- Current bid
- Start price
- Countdown timer
- Bid button
- Wallet balance indicator

Auction detail must show:
- Current highest bid
- Bid history summary
- Time remaining
- Wallet balance
- Bid input
- Bid confirmation
- Winning/outbid state

Customer cannot bid above available wallet balance.

Customer cannot bid after auction ends.

---

# 17. CUSTOMER PACKS PAGE

Packs must appear as customer-facing sellable bundles.

Pack card must show:
- Pack image
- Pack name
- Pack selling price
- Pack retail value
- Discount badge
- Included item count
- Add to cart or bid button depending on listing type

Pack detail must show:
- What is inside
- Pack price
- Retail value
- Discount
- Quantity available
- Checkout action

---

# 18. CART AND CHECKOUT

Checkout currently works except Yoco integration.

Checkout must support wallet payment.

Checkout flow:

1. Customer adds store item or pack to cart
2. Customer reviews cart
3. Customer selects fulfilment method
4. Customer pays using wallet balance
5. Order is created
6. Stock is moved to sold
7. Customer receives order confirmation

Customer cannot checkout if wallet balance is insufficient.

Customer must be guided to top up wallet.

Cart must prevent:
- Out-of-stock checkout
- Duplicate invalid quantities
- Checkout of unpublished listings
- Checkout of expired auctions

---

# 19. CUSTOMER PROFILE PAGE

Customer profile must include:
- Personal details
- Addresses
- Wallet
- Orders
- Withdrawal requests

Address capture must use Mapbox.

Address fields:
- address_line_1
- address_line_2
- suburb
- city
- province
- postal_code
- country
- latitude
- longitude
- mapbox_place_id

Cape Town collection rule depends on address.

If customer city is Cape Town:
- Courier delivery available
- Collection available

If customer city is not Cape Town:
- Courier delivery only

---

# 20. WALLET SYSTEM

Wallet is central to Quirkify.

Customers use wallet balance for:
- Store purchases
- Pack purchases
- Auction bids

Wallet must include:
- Available balance
- Held balance
- Total balance

Available balance = funds customer can spend.

Held balance = funds reserved for active auction bids.

Total balance = available + held.

Wallet transactions must track:
- top_up
- purchase
- bid_hold
- bid_release
- auction_win
- refund
- withdrawal_request
- withdrawal_completed
- admin_adjustment

Wallet must never go negative.

---

# 21. YOCO TOP-UP

Customer tops up wallet using Yoco.

Flow:

1. Customer chooses top-up amount
2. Yoco payment initiated
3. Payment success callback/webhook received
4. Wallet credited
5. Wallet transaction recorded
6. Customer receives confirmation

Wallet must only be credited after confirmed successful payment.

Failed payment must not credit wallet.

---

# 22. WITHDRAWALS

Customer must be able to request withdrawal of wallet funds.

Withdrawal flow:

1. Customer requests withdrawal
2. Customer enters amount
3. System validates available balance
4. Withdrawal request created
5. Funds move into withdrawal hold
6. Admin reviews request
7. Admin pays manually outside system
8. Admin marks withdrawal completed
9. Wallet transaction records withdrawal completed

Withdrawal statuses:
- requested
- approved
- rejected
- paid
- cancelled

Rejected withdrawal releases funds back to available balance.

---

# 23. ORDERS PAGE – CUSTOMER SIDE

Customer orders page must show:
- Order number
- Order date
- Items
- Total paid
- Fulfilment method
- Order status
- Tracking number if courier
- Collection status if collection

Order status flow:

order_placed
→ payment_confirmed
→ processing
→ packed
→ courier_booked / ready_for_collection
→ out_for_delivery / awaiting_collection
→ delivered / collected
→ completed

Customer must see simple 4-step progress, even if backend has more statuses.

Customer display steps:
1. Order placed
2. Processing
3. On the way / Ready for collection
4. Completed

---

# 24. COMMERCE PAGE – ADMIN SIDE

Commerce page is where employees manage orders.

Commerce must show:
- All orders
- Order status
- Customer details
- Items
- Fulfilment method
- Payment status
- Courier status
- Actions

Admin actions:
- Mark packed
- Book courier
- Mark ready for collection
- Mark collected
- Mark delivered
- Resolve fulfilment issue
- View order detail

Commerce must connect to The Courier Guy for courier orders.

---

# 25. DELIVERY AND COLLECTION

Fulfilment methods:

1. Courier delivery
2. Collection

Courier is available nationally.

Collection is available only for Cape Town customers.

Checkout must decide available fulfilment methods from customer address.

Collection cannot be shown to non-Cape Town customers.

---

# 26. THE COURIER GUY INTEGRATION

The Courier Guy integration must support semi-automated fulfilment.

Initial flow:

1. Order is paid
2. Admin marks packed
3. Admin clicks Book Courier
4. Courier Guy API creates shipment
5. Tracking number is saved
6. Customer can track order
7. Courier status updates order

Courier shipment data must include:
- order_id
- provider = courier_guy
- booking_status
- tracking_number
- waybill_number
- courier_status
- booked_at
- delivered_at
- raw_response

Courier booking failure must:
- Show error in admin Commerce
- Not mark order as courier booked
- Allow retry

---

# 27. GROWTH PAGE

Growth is the AI-assisted marketing control room.

Purpose:
- Drive campaigns
- Promote inventory
- Push new drops
- Highlight auctions
- Highlight packs
- Generate customer-facing banners and campaign copy

UI banner spaces are hardcoded.
Campaign content is dynamic from Supabase.

Hardcoded banner spaces:
- Home hero
- Store banner
- Auction banner
- Pack banner
- Product section banner
- Checkout/thank-you banner

Campaign records must define:
- campaign name
- campaign title
- campaign message
- placement
- products included
- campaign image/banner
- start date
- end date
- status

Campaign statuses:
- draft
- review
- approved
- live
- ended

AI campaign generation must:
- Scan current inventory
- Identify products suitable for promotion
- Consider seasonality
- Consider slow-moving stock
- Consider new drops
- Suggest campaign title
- Suggest campaign copy
- Suggest product selection
- Suggest banner direction

Admin must approve campaign before it goes live.

AI must not auto-publish campaigns.

---

# 28. EMAIL SYSTEM

Emails must support both customer and employee workflows.

Customer emails:
- Welcome/account confirmation
- Wallet top-up confirmation
- Order confirmation
- Auction bid confirmation
- Outbid notification
- Auction won
- Auction lost
- Courier tracking
- Ready for collection
- Withdrawal request received
- Withdrawal completed
- Campaign/new drop emails

Employee emails:
- Product waiting for review
- New order placed
- Courier booking failed
- Withdrawal request received
- Auction ended
- Offline reservation expiring
- Low stock alert

Emails must be triggered by real Supabase events or workflow actions.

Emails must not be hardcoded UI-only messages.

---

# 29. DELETE, REMOVE, ARCHIVE RULES

Admin needs delete capability, but with controls.

Allowed deletion:
- Draft products
- Review products
- Approved products with no sales history
- Listings with no sales history

Not allowed deletion:
- Sold products
- Sold listings
- Completed orders
- Completed wallet transactions
- Completed auction sales

Where deletion is not allowed:
- Use archive
- Use remove from live
- Use deactivate

All delete/archive/remove actions must be logged.

---

# 30. POST-LIVE EDITING

Admin must be able to edit live items with guardrails.

Allowed after live:
- Name
- Description
- Category
- Images
- Retail price
- Selling price
- Discount recalculation
- Store visibility

Restricted after live:
- Stock already sold
- Completed orders
- Completed wallet transactions
- Auction start price after bids exist
- Auction end time after bids exist
- Auction quantity after bids exist

All sensitive edits must be logged.

---

# 31. ADMIN DASHBOARD PAGE

Admin dashboard must summarise:
- Products in review
- Approved products
- Live store listings
- Live auctions
- Active packs
- Orders needing action
- Courier issues
- Withdrawal requests
- Offline reservations
- Wallet activity
- Campaigns live

Dashboard must be action-oriented.

It should not be decorative only.

---

# 32. CUSTOMER HOME PAGE

Customer home page must show:
- Hero campaign banner
- New drops
- Store deals
- Auctions ending soon
- Packs/bundles
- Featured campaign sections

Only published and available listings must appear.

No draft, review, unpublished, sold out, or removed items may appear.

---

# 33. UI AND COSMETIC DIRECTION

Do not redesign the app from scratch.

Keep the current look and feel.

Enhance it to production level.

Customer UI must feel:
- High energy
- Deal-driven
- Urgent
- Fun
- Trustworthy
- Mobile-first

Admin UI must feel:
- Clean
- Fast
- Operational
- Clear
- Action-first

Enhancements required:
- Better product cards
- Bold pricing
- Discount badges
- Crossed-out retail price
- Low stock indicators
- Countdown timers for auctions
- Status chips
- Clear wallet balance
- Better empty states
- Better loading states
- Better success/error feedback
- Better mobile responsiveness

Do not add cosmetic polish that breaks workflow clarity.

---

# 34. DESIGN RULES – CUSTOMER SIDE

Product cards must show:
- Image
- Product name
- Selling price large
- Retail price crossed out
- Discount badge
- Condition
- Stock urgency
- CTA button

Auction cards must show:
- Image
- Title
- Current bid
- Countdown
- Bid CTA
- Wallet-aware messaging

Pack cards must show:
- Image
- Pack name
- Pack price
- Retail value
- Discount
- Included item count

Wallet page must show:
- Available balance
- Held balance
- Top up CTA
- Withdraw CTA
- Transaction history

Orders page must show:
- Clean order cards
- 4-step progress
- Tracking link where available

---

# 35. DESIGN RULES – ADMIN SIDE

Admin pages must prioritise speed and clarity.

Use:
- Status chips
- Action buttons
- Clear tables
- Inline editing where sensible
- Confirmation modals for risky actions
- Filters by status
- Search
- Clear counts

Admin must always understand:
- What needs action
- What is live
- What is reserved
- What is sold
- What is broken
- What failed
- What needs review

---

# 36. BUILD ORDER

Claude must implement in this order:

1. Repo audit
2. Supabase schema/state audit
3. Inventory foundation
4. AI intake
5. Manual intake
6. Review queue
7. Stock engine
8. Allocation engine
9. Store listings
10. Customer store
11. Auction listings
12. Customer auctions
13. Packs
14. Customer packs
15. Offline reservations/sales
16. Wallet ledger
17. Yoco top-ups
18. Wallet withdrawals
19. Checkout hardening
20. Orders
21. Admin commerce
22. Mapbox address capture
23. Courier Guy integration
24. Customer order tracking
25. Growth campaigns
26. Emails
27. Admin dashboard
28. UI production enhancement

Do not skip order unless explicitly instructed.

---

# 37. GAP ANALYSIS REQUIRED BEFORE CODING

Claude must produce:

## Existing
What already works.

## Partial
What exists but is incomplete.

## Missing
What does not exist.

## Broken
What exists but is wrong.

## Supabase Gaps
Tables, columns, policies, functions, or triggers needed.

## UI Gaps
Pages or components needing changes.

## Workflow Gaps
Where the business flow breaks.

## Recommended First Implementation Step
The first workflow to fix.

---

# 38. FINAL COMPLETION RULE

A feature is only complete when:

- Supabase stores the state
- UI reads from Supabase
- UI writes to Supabase
- Stock is updated correctly
- Wallet is updated correctly where relevant
- Audit trail exists for sensitive actions
- Customer side reflects only valid published data
- Admin side can manage the full workflow
- Error states are handled
- Empty states are handled
- Success states are handled

---

# 39. CLAUDE EXECUTION COMMAND

Claude must follow this instruction:

Read this README fully.

Audit the Quirkify repo against this README.

Do not code immediately.

First produce:
1. Gap analysis
2. Workflow map of current repo
3. Proposed implementation order
4. Supabase changes required
5. UI changes required

Then implement only the first agreed workflow.

No random patching.
No frontend-only states.
No invented workflows.
No optional/future logic.
No drift.