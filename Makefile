.PHONY: test test-headed playwright-install

test:
	npm test

test-headed:
	npm run test:headed

playwright-install:
	npx playwright install chromium
