CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE analyses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city             text NOT NULL,
  business_type    text,
  status           text NOT NULL DEFAULT 'completed',
  businesses_count integer NOT NULL,
  avg_rating       numeric(3,2),
  result           jsonb NOT NULL,
  cache_key        text GENERATED ALWAYS AS (
    lower(city) || ':' || lower(coalesce(business_type, '_all_'))
  ) STORED,
  mode             text NOT NULL DEFAULT 'market_research',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_analyses_cache_lookup ON analyses (cache_key, mode, created_at DESC);

CREATE TABLE user_credits (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits    integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT credits_non_negative CHECK (credits >= 0)
);

CREATE TABLE search_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city          text NOT NULL,
  business_type text,
  mode          text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_search_history_user ON search_history (user_id, created_at DESC);
