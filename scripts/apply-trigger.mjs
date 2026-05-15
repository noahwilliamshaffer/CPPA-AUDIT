import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE OR REPLACE FUNCTION prevent_audit_trail_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'audit_trail_entries is immutable. INSERT only. Attempted: %', TG_OP;
  END;
  $$ LANGUAGE plpgsql
`;

await sql`
  CREATE OR REPLACE TRIGGER audit_trail_immutable
  BEFORE UPDATE OR DELETE ON audit_trail_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_trail_mutation()
`;

console.log('Immutable audit trail trigger applied.');
