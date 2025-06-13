import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

const fastify = Fastify({ logger: true });

fastify.register(cookie);
fastify.register(jwt, {
  secret: 'your-jwt-secret-key'
});

const VALID_EMAIL = 'john@doe.com';
const VALID_PASSWORD = '123456';

const refreshTokens: string[] = [];

function generateTokens(userId: string) {
  const accessToken = fastify.jwt.sign(
    { userId },
    { expiresIn: '15m' }
  );
  
  const refreshToken = fastify.jwt.sign(
    { userId, type: 'refresh' },
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
}

function removeRefreshToken(refreshToken: string) {
  const tokenIndex = refreshTokens.indexOf(refreshToken);
  if (tokenIndex > -1) {
    refreshTokens.splice(tokenIndex, 1);
  }
}

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
	try {
		await request.jwtVerify();
} catch {
		return reply.status(401).send({ message: "Unauthorized" });
	}
}

fastify.post('/auth', async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as { email: string; password: string };
  
  if (email !== VALID_EMAIL || password !== VALID_PASSWORD) {
    return reply.status(401).send({ message: 'Invalid credentials' });
  }
  
  const { accessToken, refreshToken } = generateTokens('user123');
  
  refreshTokens.push(refreshToken);
  
  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
  
  return { accessToken };
});

fastify.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
  const refreshToken = request.cookies.refreshToken;
  
  if (!refreshToken || !refreshTokens.includes(refreshToken)) {
    return reply.status(401).send({ message: 'Invalid refresh token' });
  }
  
  try {
    const decoded = fastify.jwt.verify(refreshToken) as any;
    
    if (decoded.type !== 'refresh') {
      return reply.status(401).send({ message: 'Invalid refresh token' });
    }
    
    removeRefreshToken(refreshToken)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens('user123')

    refreshTokens.push(newRefreshToken)

    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return reply.status(200).send({ accessToken });
  } catch (error) {
    return reply.status(401).send({ message: 'Invalid refresh token' });
  }
});

fastify.get('/private', { 
  preHandler: [verifyJwt] 
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user;
  return { 
    message: 'This is a protected route!', 
    user: user 
  };
});

const start = async () => {
  try {
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
  } catch (err) {
    process.exit(1);
  }
};

start();