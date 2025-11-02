/*
  # QR Tokens Table for Secure Customer Identification and Reward Redemption

  ## Overview
  Creates a secure, time-limited token system for QR code-based customer authentication
  and reward redemption in the loyalty program.

  ## Tables Created
  - `qr_tokens`
    - `id` (uuid, primary key) - Unique token identifier
    - `customer_id` (uuid, foreign key) - Links to customers table
    - `restaurant_id` (uuid, foreign key) - Links to restaurants table
    - `token` (text, unique) - Cryptographically secure random token
    - `reward_id` (uuid, nullable) - Optional link to specific reward for redemption QRs
    - `expires_at` (timestamptz) - Token expiration timestamp
    - `used` (boolean) - Whether token has been consumed
    - `created_at` (timestamptz) - Token creation timestamp

  ## Security
  - Row Level Security (RLS) enabled on qr_tokens table
  - Staff can verify tokens for their restaurant
  - Customers cannot directly access tokens (generated via service)
  - Tokens are single-use and time-limited (5-10 minutes)
  - Cryptographically secure random token generation

  ## Important Notes
  - Tokens expire automatically after specified time
  - Each token can only be used once (single-use)
  - Expired tokens should be cleaned up periodically
  - All QR codes are base64-encoded JSON payloads containing the token
*/

-- Create qr_tokens table
CREATE TABLE IF NOT EXISTS qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_customer ON qr_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_restaurant ON qr_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_used ON qr_tokens(used);

-- Enable RLS
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for token generation and verification)
CREATE POLICY "Service role full access to qr_tokens"
  ON qr_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can verify tokens for their restaurant
CREATE POLICY "Restaurant owners can verify tokens"
  ON qr_tokens
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Function to cleanup expired tokens (can be called via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_qr_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM qr_tokens
  WHERE expires_at < now() OR (used = true AND created_at < now() - interval '1 day');
END;
$$;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_expired_qr_tokens() TO authenticated;
