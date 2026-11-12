# The toolchain stage is the scheduled gate image, named by its image ID in delivery-kit.json:
# Node, ShellCheck and the non-root check user, with no project dependencies. The gate runs its
# own npm ci, so a dependency change never changes the gate image.
FROM node:24.22.2@sha256:8fa96264f302f58bbb13aa7339c541547b56975766ce956c875da149452a3e40 AS toolchain

COPY --from=koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d /bin/shellcheck /usr/local/bin/shellcheck

RUN install -d -m 0755 -o 19001 -g 19001 /opt/check
USER 19001:19001
ENV HOME=/tmp CI=true WRANGLER_SEND_METRICS=false
WORKDIR /work
ENTRYPOINT []

# The check stage, the default target that make and tools/checks.mjs build on demand: the
# toolchain plus the locked dependencies and the inner dispatcher. delivery-kit.json never names it.
FROM toolchain AS check

WORKDIR /opt/check
COPY --chown=19001:19001 package.json package-lock.json /opt/check/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=19001:19001 tests/container/check /opt/check/run
COPY --chown=19001:19001 tests/container/check.mjs /opt/check/check.mjs
WORKDIR /work
