-- The verified badge changes only together with its log entry: an UPDATE of app_user.verified_at must be matched by a
-- verification_event for that user, with the right action, written earlier in the same transaction. Whatever path
-- writes the column (the service, a script, a future admin tool), the append-only log can't be skipped.
CREATE OR REPLACE FUNCTION lastcall_verified_needs_event() RETURNS trigger AS $$
BEGIN
  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NOT EXISTS (
    SELECT 1 FROM "verification_event" e
    WHERE e.user_id = NEW.id
      AND e.xmin = ((txid_current() % 4294967296)::text)::xid
      AND e.action = (CASE WHEN NEW.verified_at IS NULL THEN 'REVOKE' ELSE 'GRANT' END)::"VerificationAction"
  ) THEN
    RAISE EXCEPTION 'lastcall: the verified badge changes only with a verification log entry' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER app_user_verified_logged BEFORE UPDATE OF verified_at ON "app_user" FOR EACH ROW EXECUTE FUNCTION lastcall_verified_needs_event();

-- A new account can't start verified (there's no log entry yet to match).
CREATE OR REPLACE FUNCTION lastcall_no_verified_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: accounts are verified through the verification log, not at creation' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER app_user_no_verified_insert BEFORE INSERT ON "app_user" FOR EACH ROW EXECUTE FUNCTION lastcall_no_verified_insert();
