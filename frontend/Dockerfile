FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run Vite development server, binding to 0.0.0.0 so Docker can map the port
CMD ["npm", "run", "dev", "--", "--host"]
