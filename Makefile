.DEFAULT_GOAL := check

CHECK_TASKS := lint test build
BUILD_OUTPUTS := dist
TEST_OUTPUTS :=
CHECK_ADMISSION := tests/container/admit

override TEST_ARGS := $(value TEST_ARGS)
export CHECK_TASKS BUILD_OUTPUTS TEST_OUTPUTS TEST_ARGS CHECK_ADMISSION
export CHECK_TIMEOUT_SECONDS CHECK_MEMORY CHECK_SCRATCH_SIZE CHECK_WORK_SIZE CHECK_TMP_SIZE CHECK_NETWORK_LINT CONTAINER_IMAGE

.PHONY: check lint test build previews

check lint test build:
	@./tests/container/run $@

# Rebuilds the galaxy selector previews in public/previews/ from a fresh build.
previews:
	@mkdir -p public/previews
	@$(MAKE) --no-print-directory build
	@node tools/galaxy-previews.mjs dist
