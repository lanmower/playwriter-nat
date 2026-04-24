FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and build
RUN npm ci && npm run build

# Copy source files for verification
COPY src ./src
COPY bin.js ./

# Make bin.js executable
RUN chmod +x bin.js

# Environment defaults (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV REFLECTOR_HOST=localhost

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { if (r.statusCode === 200) console.log('OK'); process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))" || exit 1

# Start the server
CMD ["node", "dist/index.js"]
