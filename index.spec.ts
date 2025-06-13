import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "./index";
import { randomUUID } from "node:crypto";

describe("Fastify App", () => {
	beforeAll(async () => {
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	describe("POST /auth", () => {
		it("should authenticate with valid credentials", async () => {
			const response = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "123456",
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("accessToken");
			expect(typeof response.body.accessToken).toBe("string");

			expect(response.headers["set-cookie"]).toBeDefined();
			const cookieHeader = response.headers["set-cookie"][0];
			expect(cookieHeader).toMatch(
				/refreshToken=.*; HttpOnly; SameSite=Strict/,
			);
		});

		it("should reject invalid email", async () => {
			const response = await request(app.server).post("/auth").send({
				email: "invalid@email.com",
				password: "123456",
			});

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid credentials");
		});

		it("should reject invalid password", async () => {
			const response = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "wrongpassword",
			});

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid credentials");
		});

		it("should reject missing credentials", async () => {
			const response = await request(app.server).post("/auth").send({});

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid credentials");
		});
	});

	describe("POST /auth/refresh", () => {
		it("should refresh token with valid refresh token", async () => {
			// Get a fresh refresh token
			const authResponse = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "123456",
			});

			const cookieHeader = authResponse.headers["set-cookie"][0];
			const match = cookieHeader.match(/refreshToken=([^;]+)/);
			const refreshToken = match ? match[1] : "";

			const response = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", `refreshToken=${refreshToken}`);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("accessToken");
			expect(typeof response.body.accessToken).toBe("string");

			expect(response.headers["set-cookie"]).toBeDefined();
			const newCookieHeader = response.headers["set-cookie"][0];
			expect(newCookieHeader).toMatch(
				/refreshToken=.*; HttpOnly; SameSite=Strict/,
			);
		});

		it("should reject missing refresh token", async () => {
			const response = await request(app.server).post("/auth/refresh").send();

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid refresh token");
		});

		it("should reject invalid refresh token", async () => {
			const response = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", "refreshToken=invalid-token")
				.send();

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid refresh token");
		});

		it("should reject expired refresh token", async () => {
			// Create a token that expires in 1 millisecond, then wait for it to expire
			const shortLivedToken = app.jwt.sign(
				{ userId: "user123", type: "refresh", id: randomUUID() },
				{ expiresIn: "1ms" },
			);

			// Wait for token to expire
			await new Promise((resolve) => setTimeout(resolve, 10));

			const response = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", `refreshToken=${shortLivedToken}`)
				.send();

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid refresh token");
		});

		it("should reject access token used as refresh token", async () => {
			// Get an access token and try to use it as refresh token
			const authResponse = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "123456",
			});

			const accessToken = authResponse.body.accessToken;

			const response = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", `refreshToken=${accessToken}`)
				.send();

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Invalid refresh token");
		});

		it("should reject the same refresh token used twice", async () => {
			const authResponse = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "123456",
			});

			const refreshToken = authResponse.headers["set-cookie"][0];
			const match = refreshToken.match(/refreshToken=([^;]+)/);
			const refreshTokenValue = match ? match[1] : "";

			// First use should succeed
			const firstResponse = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", `refreshToken=${refreshTokenValue}`)
				.send();

			expect(firstResponse.status).toBe(200);

			// Second use should fail
			const secondResponse = await request(app.server)
				.post("/auth/refresh")
				.set("Cookie", `refreshToken=${refreshTokenValue}`)
				.send();

			expect(secondResponse.status).toBe(401);
		});
	});

	describe("GET /private", () => {
		let accessToken: string;

		beforeAll(async () => {
			const authResponse = await request(app.server).post("/auth").send({
				email: "john@doe.com",
				password: "123456",
			});

			accessToken = authResponse.body.accessToken;
		});

		it("should access protected route with valid token", async () => {
			const response = await request(app.server)
				.get("/private")
				.set("Authorization", `Bearer ${accessToken}`);

			expect(response.status).toBe(200);
			expect(response.body.message).toBe("This is a protected route!");
			expect(response.body).toHaveProperty("user");
		});

		it("should reject access without token", async () => {
			const response = await request(app.server).get("/private");

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Unauthorized");
		});

		it("should reject access with invalid token", async () => {
			const response = await request(app.server)
				.get("/private")
				.set("Authorization", "Bearer invalid-token");

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Unauthorized");
		});

		it("should reject access with malformed authorization header", async () => {
			const response = await request(app.server)
				.get("/private")
				.set("Authorization", "InvalidFormat");

			expect(response.status).toBe(401);
			expect(response.body.message).toBe("Unauthorized");
		});
	});
});
