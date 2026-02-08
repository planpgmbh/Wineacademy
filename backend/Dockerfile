FROM node:20-alpine

WORKDIR /app

# Abhängigkeiten installieren (peer-Conflicts erlauben, z. B. beim TipTap-Plugin)
COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Quellcode kopieren
COPY . .

# Sicherstellen, dass Upload-Verzeichnis existiert
RUN mkdir -p public/uploads && chown -R node:node /app

# Admin/Server build einmalig erstellen, damit `strapi start` funktioniert
RUN npm run build

ENV NODE_ENV=production
EXPOSE 1337

USER node

# Der Startbefehl kann bei Bedarf in den Compose-Dateien überschrieben werden
CMD ["npm", "run", "start"]
