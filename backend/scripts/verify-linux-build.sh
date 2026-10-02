#!/usr/bin/env bash
# Builds a clean export of HEAD inside a Linux Node 22 container (like Vercel's build image) and checks that
# sharp's Linux binary is file-traced into the server output and can re-encode an image from there.
set -euo pipefail
mkdir -p "$HOME/.cache"
# Under $HOME: Docker VMs like Colima only share the home directory with containers.
WORK="$(mktemp -d "$HOME/.cache/nostos-linux.XXXXXX")"
# Export only this folder (backend/) of the two-folder repo.
git archive "HEAD:$(git rev-parse --show-prefix)" | tar -x -C "$WORK"
docker run --rm -v "$WORK":/app -w /app node:22-bookworm bash -lc '
  set -e
  corepack enable >/dev/null 2>&1
  corepack prepare pnpm@11.22.0 --activate >/dev/null 2>&1
  cp .env.example .env
  pnpm install --frozen-lockfile >/dev/null
  NEXT_OUTPUT_STANDALONE=1 DISABLE_JOBS=1 pnpm exec next build >/dev/null
  echo "traced sharp binaries:"; find .next/standalone -path "*@img/sharp-linux*" -name "*.node" | sed "s#.*/node_modules/#  #"
  cd .next/standalone
  node -e "
    const sharp = require(require.resolve(\"sharp\", { paths: [process.cwd() + \"/node_modules/next\"] }));
    sharp({ create: { width: 3000, height: 1000, channels: 3, background: \"#ff3d6e\" } }).jpeg().withExif({ IFD0: { Make: \"X\" } }).toBuffer()
      .then((b) => sharp(b).rotate().resize({ width: 2048, height: 2048, fit: \"inside\" }).jpeg().toBuffer())
      .then((b) => sharp(b).metadata())
      .then((m) => { console.log(\"sharp re-encode from traced output:\", m.width + \"x\" + m.height, \"exif:\", m.exif === undefined ? \"stripped\" : \"present\"); });
  "
'
rm -rf "$WORK"
