FROM node:18-alpine
WORKDIR /src/index
COPY . .
EXPOSE 8004
RUN npm install
RUN npm install -g nodemon
CMD ["npm", "run", "dev"]