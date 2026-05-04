-- Migration: add addon_pack to payment_attempts
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS addon_pack TEXT;

COMMENT ON COLUMN public.payment_attempts.addon_pack IS
  'Reminder pack identifier: "200" or "500". Set when payment_type = ''ADDON''.';
