'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

const LINKS = [['/', 'Today'], ['/goals', 'Goals'], ['/finance', 'Finance']] as const;

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  if (path === '/login') return null;
  return (
    <nav aria-label="Main">
      <strong style={{ fontFamily: 'Playfair Display, serif', marginRight: 12 }}>MY LIFE OS</strong>
      {LINKS.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>)}
      <button style={{ marginLeft: 'auto' }} onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>Sign out</button>
    </nav>
  );
}
