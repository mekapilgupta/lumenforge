-- Enable row-level security UPDATE policy for order cancellation.
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/mmmtpheheqxdojbssapb/sql)

-- 1. Check if the policy already exists, and drop it if needed
DROP POLICY IF EXISTS "Users can cancel their own orders" ON public.orders;

-- 2. Create the update policy allowing authenticated users to cancel their own orders
CREATE POLICY "Users can cancel their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'cancelled'
);

-- Note: Ensure order logs can be inserted if there is a trigger/policy, 
-- but order status updates are handled directly on public.orders.
