# ---------- Build stage ----------
FROM gradle:8-jdk21 AS build

WORKDIR /app

# Copy build files first for layer caching
COPY build.gradle settings.gradle ./
RUN gradle dependencies --no-daemon || true

# Copy source and build
COPY src/ src/
RUN gradle installDist --no-daemon

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/build/install/playbyplay-stream-processor/ ./

USER appuser

CMD ["./bin/playbyplay-stream-processor"]
