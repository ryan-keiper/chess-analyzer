# Use Node.js LTS (Ubuntu-based for better compatibility)
FROM node:18-slim

# Install Stockfish from Ubuntu repos
RUN apt-get update && \
    apt-get install -y stockfish && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user (Debian/Ubuntu style)
RUN groupadd -r nodejs && \
    useradd -r -g nodejs nodejs

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    if (res.statusCode === 200) process.exit(0); else process.exit(1); \
  }).on('error', () => process.exit(1));"

# Set Stockfish path for container
ENV STOCKFISH_PATH=/usr/bin/stockfish

# Start the application
CMD ["npm", "start"]
