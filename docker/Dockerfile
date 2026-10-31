# Test-runner image. The Playwright base image ships Node, Chromium, Firefox and WebKit with
# their system libraries; its tag must match the playwright version in package-lock.json.
#
#   docker build -f docker/Dockerfile -t healthcare-tests .
#   docker run --rm --ipc=host -v "$PWD/reports:/app/reports" healthcare-tests npm run test:healthcare
#
# No credentials are built into the image: pass them at run time (--env-file .env or CI secrets).
FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV CI=true \
    HEADLESS=true \
    NODE_ENV=test \
    npm_config_update_notifier=false

WORKDIR /app
RUN chown pwuser:pwuser /app
USER pwuser

COPY --chown=pwuser:pwuser package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY --chown=pwuser:pwuser . .

CMD ["npm", "test"]
