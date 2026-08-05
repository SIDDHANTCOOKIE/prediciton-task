import postgres from "postgres";
import "dotenv/config";

const sql = postgres(process.env.DATABASE_URL || "", {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // We use require to let it throw explicitly if connection URL is missing
});

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Database connections will fail.");
}

export { sql };
