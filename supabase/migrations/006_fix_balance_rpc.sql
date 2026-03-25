-- Fix: Create parameterless wrapper for get_balance_summary that uses auth.uid()

CREATE OR REPLACE FUNCTION get_balance_summary()
RETURNS TABLE (
  total_balance NUMERIC,
  total_available NUMERIC,
  account_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(a.current_balance), 0) AS total_balance,
    COALESCE(SUM(a.available_balance), 0) AS total_available,
    COUNT(*)::INTEGER AS account_count
  FROM accounts a
  WHERE a.user_id = auth.uid()
    AND a.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_balance_summary() TO authenticated;
