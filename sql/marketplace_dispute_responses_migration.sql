-- Migration: Add seller dispute responses table
-- Purpose: Store seller responses to buyer disputes and support dispute resolution tracking

CREATE TABLE public.dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  explanation TEXT NOT NULL,
  evidence_url TEXT,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.dispute_responses (dispute_id);
CREATE INDEX ON public.dispute_responses (responder_id);
