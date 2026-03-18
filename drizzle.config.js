/** @type { import("drizzle-kit").Config } */
import * as dotenv from 'dotenv';
dotenv.config({path: '.env.local'}); // Load environment variables from .env.local file

//const DB_PATH = process.env.DATABASE_URL;
const DB_PATH = process.env.NEXT_PUBLIC_DRIZZLE_DB_URL;

if (!DB_PATH) {
    throw new Error("DATABASE_URL environment variable is not set or .env.local is not loaded.");
}

export default {
    schema: "./utils/schema.js",
    dialect: 'postgresql',
    dbCredentials: {
      url: DB_PATH,
    },
};