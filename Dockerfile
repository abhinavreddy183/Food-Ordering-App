# 1. Use a lightweight Node.js image as the base
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy only the package files first (to optimize Docker caching)
COPY package*.json ./

# 4. Install your Node.js dependencies
RUN npm install

# 5. Copy all the rest of your application files into the container
COPY . .

# 6. Expose the port your application uses (matching your .env)
EXPOSE 5000

# 7. Start the Node.js server using the script in your package.json
CMD ["npm", "start"]