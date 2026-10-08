{
  description = "flake for my personal website :3";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      zolaRelease =
        {
          "x86_64-linux" = {
            target = "x86_64-unknown-linux-gnu";
            hash = "sha256:8f5132b3522412d04e395e0b25f6d68613ad272a873e54a2b3ebf664873024a4";
          };
          "aarch64-linux" = {
            target = "aarch64-unknown-linux-gnu";
            hash = "sha256:266448fffbf7c7004ca399d0e76dd699541771096d8a42aede98cebe2a029d02";
          };
          "x86_64-darwin" = {
            target = "x86_64-apple-darwin";
            hash = "sha256:79a4d0ab51a4d863c068e6e594c6fce36f0aa17429a414ea63066f5910d14460";
          };
          "aarch64-darwin" = {
            target = "aarch64-apple-darwin";
            hash = "sha256:cbffbd29b3f59c3f52633507c8cb945a7a02d8b1399b43b235f5932912297aa3";
          };
        }.${
          system
        };
      zola = pkgs.stdenvNoCC.mkDerivation {
        pname = "zola";
        version = "0.23.6";
        src = pkgs.fetchurl {
          url = "https://github.com/getzola/zola/releases/download/v0.23.6/zola-v0.23.6-${zolaRelease.target}.tar.gz";
          inherit (zolaRelease) hash;
        };
        installPhase = "install -Dm755 ../zola $out/bin/zola";
      };
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.default = pkgs.mkShell {
        nativeBuildInputs = with pkgs; [
          zola
          pre-commit
          just
          nodejs-slim_26
          chromium

          # Formatters
          treefmt
          prettier
          alejandra
          djlint

          # For minifying assets
          minify
          subfont
        ];

        shellHook = ''
          export CHROME_PATH=${pkgs.chromium}/bin/chromium
          # Install pre-commit hooks if not already installed
          if [ ! -f .git/hooks/pre-commit ]; then
            echo "Installing pre-commit hooks..."
            pre-commit install
          fi
        '';
      };
    });
}
