-- Enforce append-only on audit_trail_entries.
-- No application-level code may ever UPDATE or DELETE from this table.
-- This trigger is a database-level safety net in addition to the application-level rule.

CREATE OR REPLACE FUNCTION prevent_audit_trail_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_trail_entries is immutable. INSERT only. Attempted: %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_trail_immutable
BEFORE UPDATE OR DELETE ON audit_trail_entries
FOR EACH ROW EXECUTE FUNCTION prevent_audit_trail_mutation();
