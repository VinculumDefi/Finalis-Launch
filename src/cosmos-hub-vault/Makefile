.PHONY: fmt lint test build optimize schema clean

fmt:
	cargo fmt --all

lint:
	cargo clippy --all-targets -- --deny warnings

test:
	cargo test --workspace --release

build:
	rustup target add wasm32-unknown-unknown
	cargo build --release --target wasm32-unknown-unknown --lib

optimize: build
	docker run --rm -v "$(CURDIR)/target/wasm32-unknown-unknown/release:/code" \
		cosmwasm/rust-optimizer:0.16.0

schema:
	cargo run --bin schema

clean:
	cargo clean