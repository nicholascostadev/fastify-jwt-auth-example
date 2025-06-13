import fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import jwt, { type FastifyJWT } from "@fastify/jwt";
import { randomUUID } from "node:crypto";

export const app = fastify({ logger: process.env.NODE_ENV === "development" });

app.register(cookie);
app.register(jwt, {
	secret: "your-jwt-secret-key",
});

const VALID_EMAIL = "john@doe.com";
const VALID_PASSWORD = "123456";

const refreshTokens = new Set<string>();

function generateTokens(userId: string) {
	const accessToken = app.jwt.sign(
		{ userId, type: "access", id: randomUUID() },
		{ expiresIn: "15m" },
	);

	const refreshToken = app.jwt.sign(
		{ userId, type: "refresh", id: randomUUID() },
		{ expiresIn: "30d" },
	);

	return { accessToken, refreshToken };
}

function removeRefreshToken(refreshToken: string) {
	refreshTokens.delete(refreshToken);
}

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
	try {
		await request.jwtVerify();
	} catch {
		return reply.status(401).send({ message: "Unauthorized" });
	}
}

app.post("/auth", async (request: FastifyRequest, reply: FastifyReply) => {
	const { email, password } = request.body as {
		email: string;
		password: string;
	};

	if (email !== VALID_EMAIL || password !== VALID_PASSWORD) {
		return reply.status(401).send({ message: "Invalid credentials" });
	}

	const { accessToken, refreshToken } = generateTokens("user123");

	refreshTokens.add(refreshToken);

	reply.setCookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: false, // Set to true in production with HTTPS
		sameSite: "strict",
		maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
	});

	return { accessToken };
});

app.post(
	"/auth/refresh",
	async (request: FastifyRequest, reply: FastifyReply) => {
		const refreshToken = request.cookies.refreshToken;

		if (!refreshToken || !refreshTokens.has(refreshToken)) {
			return reply.status(401).send({ message: "Invalid refresh token" });
		}

		try {
			const decoded = app.jwt.verify(refreshToken) as FastifyJWT["payload"];

			if (decoded.type !== "refresh") {
				return reply.status(401).send({ message: "Invalid refresh token" });
			}

			removeRefreshToken(refreshToken);
			const { accessToken, refreshToken: newRefreshToken } =
				generateTokens("user123");

			refreshTokens.add(newRefreshToken);

			reply.setCookie("refreshToken", newRefreshToken, {
				httpOnly: true,
				secure: false, // Set to true in production with HTTPS
				sameSite: "strict",
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			});

			return reply.status(200).send({ accessToken });
		} catch (error) {
			return reply.status(401).send({ message: "Invalid refresh token" });
		}
	},
);

app.get(
	"/private",
	{
		preHandler: [verifyJwt],
	},
	async (request: FastifyRequest) => {
		const user = request.user;
		return {
			message: "This is a protected route!",
			user: user,
		};
	},
);

async function start() {
	try {
		await app.listen({ port: 8080, host: "0.0.0.0" });
	} catch (err) {
		process.exit(1);
	}
}

start();
