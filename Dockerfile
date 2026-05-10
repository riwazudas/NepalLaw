# ==========================================================
# STAGE 1: Builder
# ==========================================================
FROM node:20-alpine AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine 
# to understand why libc6-compat might be needed for Next.js.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency configuration first to cache layer
COPY web-app/package*.json ./web-app/

# Install dependencies in the web-app directory
WORKDIR /app/web-app
RUN npm ci

# Copy the rest of the Next.js web application source code
COPY web-app/ /app/web-app/

# Build the Next.js application for production
RUN npm run build

# Prune devDependencies to keep the runner image size small
RUN npm prune --production


# ==========================================================
# STAGE 2: Runner
# ==========================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Create a non-privileged system user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files and public assets from builder
COPY --from=builder /app/web-app/public ./public
COPY --from=builder /app/web-app/package.json ./package.json

# Copy server assets and production node_modules
COPY --from=builder --chown=nextjs:nodejs /app/web-app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/web-app/node_modules ./node_modules

# Ensure correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose the service port (Google Cloud Run default is 8080)
EXPOSE 8080

# Start the Next.js production server
CMD ["npm", "run", "start"]
