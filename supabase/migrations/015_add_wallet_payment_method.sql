-- wallet_purchase creates orders with payment_method='wallet' but the enum was missing it.
-- Without this, wallet_purchase always fails with "invalid input value for enum payment_method".

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';
