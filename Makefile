.PHONY: dev clean

dev:
	@echo "Running NextJS Application in Development Mode"
	npm run dev

clean:
	@echo "Cleaning .next and cache..."
	rm .next -r
