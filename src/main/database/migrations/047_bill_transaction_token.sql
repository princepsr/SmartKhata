-- Add transaction_token for idempotency
ALTER TABLE bills ADD COLUMN transaction_token TEXT;
CREATE INDEX idx_bills_transaction_token ON bills(transaction_token);
