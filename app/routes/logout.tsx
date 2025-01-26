import { ActionFunctionArgs, redirect } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';
import { useEffect } from 'react';
import { Form } from '@remix-run/react';

export default function LogoutPage() {
  useEffect(() => {
    let isLoggedOut = false;
    
    if (!isLoggedOut) {
      isLoggedOut = true;
      const spotifyLogout = window.open('https://accounts.spotify.com/en/logout', '_blank');
      setTimeout(() => {
        spotifyLogout?.close();
        (document.getElementById('logout-form') as HTMLFormElement)?.submit();
      }, 100);
    }
  }, []);
 
  return <Form id="logout-form" method="post" />;
 }
 
 export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  
  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
      'Clear-Site-Data': '"cookies", "storage"'
    }
  });
 };