-- User search: username starting with the query (03 §7.1). Expression index on the text form of the citext column.
CREATE INDEX "user_profiles_username_trgm_idx" ON "user_profiles" USING GIN (("username"::text) gin_trgm_ops);
