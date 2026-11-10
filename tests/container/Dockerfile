FROM node:24.22.2

RUN install -d -m 0755 -o 19001 -g 19001 /opt/check
COPY --chown=19001:19001 package.json package-lock.json /opt/check/
USER 19001:19001
ENV HOME=/tmp CI=true WRANGLER_SEND_METRICS=false
WORKDIR /opt/check
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=19001:19001 tests/container/check /opt/check/run
COPY --chown=19001:19001 tests/container/check.mjs /opt/check/check.mjs
WORKDIR /work
ENTRYPOINT ["/opt/check/run"]
