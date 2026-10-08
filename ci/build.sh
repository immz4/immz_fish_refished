#!/usr/bin/env bash
set -euo pipefail

ZOLA_VERSION=0.23.6
MINIFY_VERSION=2.24.19

mkdir -p .ci-bin
export PATH="$PWD/.ci-bin:$PATH"

# minify
curl -sSL "https://github.com/tdewolff/minify/releases/download/v${MINIFY_VERSION}/minify_linux_amd64.tar.gz" \
  | tar -xz -C .ci-bin minify

# subfont
npm install -g subfont@7.2.3

zola build
subfont --root public --recursive --no-fallbacks --in-place public/index.html
minify -r -a -o public/ public/
