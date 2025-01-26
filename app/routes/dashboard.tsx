import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { sessionStorage } from '~/services/session.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');

  if (!user) {
    return redirect('/login');
  }

  return user;
};

export default function Dashboard() {
  const user = useLoaderData<typeof loader>();
    
  return (
    <div>
      <h1>Welcome, {user.displayName}</h1>
      {user.profileImage && (
        <img 
          src={user.profileImage} 
          alt={`${user.displayName}'s profile`} 
          width={100} 
          height={100} 
        />
      )}
        <form action="/logout" method="post">
        <button 
          onClick={() => window.location.href = '/logout'} 
          type="button"
        >
          Logout
        </button>
        </form>
    </div>
  );
}