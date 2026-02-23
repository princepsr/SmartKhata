-- Add address and email to customers
-- Version: 015
-- Description: Adds 'address' and 'email' columns to the 'customers' table

ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN email TEXT;
