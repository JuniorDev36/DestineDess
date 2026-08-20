// supabase-client.js
// Shared helper that creates a Supabase client authenticated with the
// signed-in student's Clerk session. Every page that needs to read/write
// data (register, student-portal) imports getSupabase() from here instead
// of duplicating the client setup.
//
// This uses Supabase's native Clerk integration: the `accessToken` option
// tells supabase-js to fetch a fresh Clerk session token on every request,
// which Supabase then verifies against the Third-Party Auth integration
// you connected in your dashboard. Row Level Security policies then check
// `auth.jwt() ->> 'sub'` (the Clerk user ID) against each row's
// `clerk_user_id` column.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getClerk } from './clerk-client.js';

const SUPABASE_URL = 'https://nviidicrnueaccqeovcy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IIm52aWlkaWNybnVlYWNjcWVvdmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODDcxOTUwMjQsImV4cCI6MjEwMMjc3MTAyNH0.WflTOK0Eiy0pzvfKuYbmlhOV4IU_-1RmJcRB1tVw8YA';

let supabaseClient = null;

export function getSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        accessToken: async () => {
            const clerk = await getClerk();
            return (await clerk.session?.getToken()) ?? null;
        },
    });

    return supabaseClient;
}
