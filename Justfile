build:
    zola build --output-dir ./dist --force
    subfont --root public --recursive --no-fallbacks --in-place --debug dist/index.html
    minify -r -a -o dist/ dist/

lighthouse: build
    npx @lhci/cli@0.15.0 autorun

lighthouse-open:
    npx @lhci/cli@0.15.0 open

ci: build lighthouse

test:
    npx run test:docker-compose

update-snapshots:
    npx run test:update-snapshots

clean:
    rm -rf dist/ public/ .lighthouseci/
