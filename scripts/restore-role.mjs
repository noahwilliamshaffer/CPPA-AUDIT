import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'shieldaudit.db'));
const r = db.prepare("UPDATE user_roles SET clerk_user_id = 'local-user' WHERE clerk_user_id = '_hidden'").run();
console.log('Restored', r.changes, 'row(s)');
db.close();
