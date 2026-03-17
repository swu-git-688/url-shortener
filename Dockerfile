# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source
COPY . .

COPY student_id.txt ./

# Read student ID from file
RUN STUDENT_ID=$(cat student_id.txt) && \
    echo "export STUDENT_ID='$STUDENT_ID'" >> /etc/profile

# Set build timestamp as environment variable
# Accept BUILD_TIME as build argument
ARG BUILD_TIME

# If BUILD_TIME not provided, generate it during build and save to file
# If provided, use it and save to file
RUN if [ -z "$BUILD_TIME" ]; then \
      BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ"); \
    fi && \
    echo "$BUILD_TIME" > /app/build_time.txt && \
    echo "Build Time: $BUILD_TIME"

# Read build time from file and set as ENV
RUN BUILD_TIME=$(cat /app/build_time.txt) && \
    echo "export BUILD_TIME='$BUILD_TIME'" >> /etc/profile

ENV STUDENT_ID_FILE=/app/student_id.txt
ENV BUILD_TIME_FILE=/app/build_time.txt

# Display build info
RUN if [ -f student_id.txt ]; then echo "Student ID: $(cat student_id.txt)"; fi && \
    if [ -f build_time.txt ]; then echo "Build Time: $(cat build_time.txt)"; fi

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
