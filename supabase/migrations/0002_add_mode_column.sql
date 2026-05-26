ALTER TABLE analyses ADD COLUMN mode text NOT NULL DEFAULT 'market_research';
DROP INDEX idx_analyses_cache_lookup;
CREATE INDEX idx_analyses_cache_lookup ON analyses (cache_key, mode, created_at DESC);
