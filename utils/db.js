import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "./schema";

const dbUrl = process.env.NEXT_PUBLIC_DRIZZLE_DB_URL;

// This check is good. It prevents a white screen if the key ever fails.
if (!dbUrl) {
    throw new Error("🔴 FATAL ERROR: DATABASE_URL environment variable is not defined. Check your .env.local file.");
}

const sql = neon(dbUrl); 
export const db = drizzle(sql,{schema});