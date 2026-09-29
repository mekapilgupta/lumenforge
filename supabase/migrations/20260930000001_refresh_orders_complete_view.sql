-- Migration: Create/refresh the orders_complete view
-- Includes advance_amount, cod_balance_due, payment_method, and customer info.
-- Safe to run multiple times (CREATE OR REPLACE).

create or replace view public.orders_complete as
select
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.payment_method,
  o.total_amount,
  o.subtotal,
  o.discount_amount,
  o.shipping_charges,
  o.cod_charges,
  o.gst_amount,
  o.coupon_code,
  o.shipping_address_id,
  o.razorpay_order_id,
  o.razorpay_payment_id,
  o.razorpay_signature,
  o.advance_amount,
  o.cod_balance_due,
  o.shiprocket_order_id,
  o.shiprocket_status,
  o.awb_code,
  o.courier_name,
  o.cancellation_status,
  o.cancellation_reason,
  o.has_active_return,
  o.estimated_delivery_date,
  o.delivered_at,
  o.payment_completed_at,
  o.payment_gateway_response,
  o.created_at,
  o.updated_at,
  -- Customer profile fields (flat, for easy table display)
  p.full_name  as customer_name,
  p.email      as customer_email,
  p.phone      as customer_phone,
  -- Aggregated order items (for drawer display)
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',          oi.id,
          'product_id',  oi.product_id,
          'product_name',oi.product_name,
          'variant_info',oi.variant_info,
          'sku',         oi.sku,
          'unit_price',  oi.unit_price,
          'quantity',    oi.quantity,
          'total',       oi.total_price,
          'image',       oi.product_image_url
        )
        order by oi.created_at asc
      )
      from public.order_items oi
      where oi.order_id = o.id
    ),
    '[]'::jsonb
  ) as items
from public.orders o
left join public.profiles p on p.id = o.user_id;

-- Grant select to authenticated users (admin RLS on the underlying orders table controls access)
grant select on public.orders_complete to authenticated;
grant select on public.orders_complete to anon;
