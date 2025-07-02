import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authService } from '@/lib/hipaa-auth-singleton';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Authenticate using our HIPAA auth service
          const result = await authService.authenticate(credentials.email, credentials.password);
          
          if (!result.success) {
            return null;
          }

          return {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      await authService.logEvent({
        userId: user.id,
        action: 'SIGN_IN',
        outcome: 'SUCCESS'
      });
    },
    async signOut({ token }) {
      if (token?.id) {
        await authService.logEvent({
          userId: token.id as string,
          action: 'SIGN_OUT',
          outcome: 'SUCCESS'
        });
      }
    }
  }
});

export { handler as GET, handler as POST };
