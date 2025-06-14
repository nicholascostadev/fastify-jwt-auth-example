# Fastify JWT Auth Example

A simple, secure JWT authentication example built with Fastify and TypeScript, demonstrating best practices for token-based authentication with refresh token support.

## Features

- **JWT Authentication** - Secure access and refresh token implementation
- **HttpOnly Cookies** - Refresh tokens stored securely in HttpOnly cookies
- **Token Refresh** - Automatic access token renewal using refresh tokens
- **Protected Routes** - Route protection with JWT verification
- **TypeScript** - Full TypeScript support with proper typing
- **Comprehensive Tests** - Full test suite using Vitest and Supertest
- **Token Rotation** - Refresh tokens are rotated on each use for security

## Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nicholascostadev/fastify-jwt-auth-example
   cd fastify-jwt-auth-example
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start the development server**
   ```bash
   pnpm run start:dev
   ```

The server will start on `http://localhost:8080`

## API Endpoints

### Authentication

#### `POST /auth`
Authenticate a user with email and password.

**Request Body:**
```json
{
  "email": "john@doe.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Set:**
- `refreshToken` - HttpOnly, Secure, SameSite=Strict (30 days)

#### `POST /auth/refresh`
Refresh an expired access token using the refresh token stored in cookies.

**Request:** Requires `refreshToken` cookie

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Updated:**
- `refreshToken` - New refresh token (rotated for security)

### Protected Routes

#### `GET /private`
Access a protected resource that requires valid JWT authentication.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "message": "This is a protected route!",
  "user": {
    "userId": "user123",
    "type": "access",
    "id": "uuid",
    "iat": 1234567890,
    "exp": 1234567890
  }
}
```

## Usage Examples

### 1. Login and Get Access Token

```bash
curl -X POST http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "john@doe.com", "password": "123456"}' \
  -c cookies.txt
```

### 2. Access Protected Route

```bash
curl -X GET http://localhost:8080/private \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Refresh Access Token

```bash
curl -X POST http://localhost:8080/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

## Security Features

- **Access Token Expiry**: 15 minutes (short-lived for security)
- **Refresh Token Expiry**: 30 days (long-lived for user convenience)
- **HttpOnly Cookies**: Refresh tokens stored in HttpOnly cookies to prevent XSS
- **Token Rotation**: Refresh tokens are rotated on each use
- **Type Validation**: Separate token types for access and refresh
- **Unique Token IDs**: Each token has a unique ID to prevent replay attacks

## Development

### Available Scripts

- `pnpm run start:dev` - Start development server with hot reload
- `pnpm run build` - Build TypeScript to JavaScript
- `pnpm run start` - Start production server
- `pnpm run test` - Run tests once
- `pnpm run test:watch` - Run tests in watch mode

### Testing

The project includes comprehensive tests covering:

- Authentication with valid/invalid credentials
- Refresh token functionality
- Protected route access
- Token expiry and validation
- Security edge cases

Run tests with:
```bash
pnpm test
```

### Code Quality

The project uses:
- **Biome** for code formatting and linting
- **TypeScript** for type safety
- **Vitest** for testing

## Production Considerations

Before deploying to production:

1. **Change JWT Secret**: Replace `"your-jwt-secret-key"` with a strong, random secret
2. **Enable HTTPS**: Set `secure: true` for cookies in production
3. **Environment Variables**: Use environment variables for sensitive configuration
4. **Database Integration**: Replace hardcoded credentials with proper user management
5. **Rate Limiting**: Add rate limiting to prevent brute force attacks
6. **Logging**: Configure appropriate logging for monitoring

## Author

Nicholas Costa
