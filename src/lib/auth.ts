import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Kullanıcı Adı', type: 'text' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { username: credentials.username } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as unknown as { role: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
};

/**
 * Server Actions are public POST endpoints keyed by action ID — the `/admin/*`
 * middleware only gates the page that renders the form, not the action itself.
 * Every admin-only Server Action must call this first, independent of middleware.
 */
export async function requireAdmin(): Promise<{ error: string } | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return { error: 'Bu işlem için yönetici girişi gerekli.' };
  }
  return null;
}
