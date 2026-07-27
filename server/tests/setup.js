/** Force JSON-file storage and demo billing during tests (before app modules load). */
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.BILLING_MODE = 'demo';
process.env.STARTING_CREDITS = '5';
process.env.CREDITS_PER_RENDER = '1';
