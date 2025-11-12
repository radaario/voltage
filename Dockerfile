FROM node:20.19.5

RUN apt update
RUN apt install -y build-essential cmake
RUN apt install -y ffmpeg
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY ./ ./

RUN npm install
RUN npx nodejs-whisper download

RUN npm run build

EXPOSE ${APP_PORT}
CMD ["npm", "start"]