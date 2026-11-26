FROM node:24-bookworm-slim AS demo
WORKDIR /app
COPY demo.mjs ./
ENV HOST=0.0.0.0
USER node
CMD ["node", "demo.mjs"]

FROM mcr.microsoft.com/playwright:v1.65.1-noble AS verify
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY demo.mjs verify.mjs ./
USER pwuser
CMD ["node", "verify.mjs"]
