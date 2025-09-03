FROM node:20-alpine

WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm ci || npm install

# Quellcode kopieren
COPY . .

# Sicherstellen, dass Upload-Verzeichnis existiert
RUN mkdir -p public/uploads

# Admin/Server build einmalig erstellen, damit `strapi start` funktioniert
RUN npm run build

ENV NODE_ENV=production
EXPOSE 1337

# Für Dev wird der Befehl in docker-compose-dev.yml überschrieben
CMD ["npm", "run", "start"]
