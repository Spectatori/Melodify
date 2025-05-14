import { createCookieSessionStorage } from '@remix-run/node';
import { SESSION_SECRET } from "~/utils/envExports";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '_session',
    sameSite: 'lax',
    path: '/',
    httpOnly: true,
    secrets: [SESSION_SECRET!],
    secure: process.env.NODE_ENV === 'production'
  }
});