import { config } from "dotenv";

// Tests always use the local test database and fake models, whatever the shell has set.
config({ override: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/ap_grader_test";
process.env.MODEL_MODE = "fake";
process.env.JOBS_DRIVER = "inline";
process.env.STORAGE_DRIVER = "local";
process.env.LOCAL_STORAGE_DIR = ".data/test-uploads";
process.env.APP_URL = "http://localhost:3000";
