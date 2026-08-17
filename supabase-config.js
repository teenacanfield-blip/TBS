/* Where the accounts and reviews live.
 *
 * Fill these two in after making a Supabase project — REVIEWS-SETUP.md walks
 * through it. Until you do, the site keeps working exactly as it did before:
 * reviews stay in each visitor's own browser and no sign-in appears.
 *
 * Both values below are meant to be public. The anon key is designed to sit in
 * a web page where anyone can read it; what stops people writing whatever they
 * like is the security rules you paste into Supabase in step 3 of the setup,
 * NOT the secrecy of this key.
 *
 * Never put the "service_role" key here. That one bypasses every rule and would
 * let any visitor delete the whole database.
 */
const SUPABASE = {
  url: '',      // e.g. 'https://abcdefghijklm.supabase.co'
  anonKey: '',  // the long "anon public" key from Project Settings -> API
};
