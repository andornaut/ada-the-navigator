FROM node:24.22.2

COPY --from=koalaman/shellcheck:v0.11.0 /bin/shellcheck /usr/local/bin/shellcheck

RUN install -d -m 0755 -o 19001 -g 19001 /opt/check
COPY --chown=19001:19001 package.json package-lock.json /opt/check/
USER 19001:19001
ENV HOME=/tmp CI=true WRANGLER_SEND_METRICS=false
WORKDIR /opt/check
RUN npm ci --ignore-scripts --no-audit --no-fund --maxsockets=1
COPY --chown=19001:19001 tests/container/check /opt/check/run
COPY --chown=19001:19001 tests/container/check.mjs /opt/check/check.mjs
WORKDIR /work
ENTRYPOINT []
