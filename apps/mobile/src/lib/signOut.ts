import { clearLocalPin } from './pin';
import { supabase } from './supabase';

/** Full sign out of this device: forget the PIN, end the Supabase session. The Gate then clears cached data. */
export async function signOutDevice() {
  const { data } = await supabase.auth.getSession();
  if (data.session) await clearLocalPin(data.session.user.id);
  await supabase.auth.signOut();
}
