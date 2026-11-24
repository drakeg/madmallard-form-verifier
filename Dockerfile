FROM mcr.microsoft.com/playwright:v1.65.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY demo.mjs verify.mjs ./
ENV HOST=0.0.0.0
USER pwuser
CMD ["npm", "start"]
