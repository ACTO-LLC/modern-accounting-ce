# Quickstart, prebuilt images and CI (maintainer notes)

How the one-command start works and what keeps it working. For the user-facing walkthrough see [ce-boot.md](./ce-boot.md).

## Quickstart

`./scripts/quickstart.sh` creates `.env.ce` from `.env.ce.example` if missing, starts the `app` profile, waits for DAB (`:5000/`), chat-api (`:8080/api/health`) and the client (`:5173`), then prints the URL.

| Command | Effect |
|---|---|
| `./scripts/quickstart.sh` | Build every image from source (first run ~10-20 min on a cold cache) |
| `./scripts/quickstart.sh --images` | Pull prebuilt images from GHCR (no build) |
| `./scripts/quickstart.sh --down` | Stop the stack; the SQL data volume is kept |

`QUICKSTART_TIMEOUT` (seconds, default 1200) sets how long it waits for each service.

## Prebuilt images

`docker-compose.ce.images.yml` is an override layered on `docker-compose.ce.yml`. It only sets `image:` for the five built services, so the base file stays the source of truth.

Images are published to `ghcr.io/acto-llc/modern-accounting-ce/<service>` for `db-init`, `email-api`, `csv-import-api`, `chat-api` and `client`.

- `CE_IMAGE_TAG` selects a tag (default `latest`; releases are also tagged by version and short SHA).
- `CE_IMAGE_REPO` points at a different registry path, for example a fork.

`.github/workflows/publish-images.yml` builds and pushes them on every push to `main` and on `v*` tags.

### Making the packages public (one-time)

New GHCR packages are private, and anonymous `docker pull` (and `--images`) fails until they are public.

1. An org owner enables public packages: org **Settings**, **Packages**, **Package creation**, tick **Public**.
2. For each of the five packages, open **Package settings**, **Danger Zone**, **Change visibility**, **Public**.
3. Verify without logging in:

```bash
docker logout ghcr.io
```

```bash
docker pull ghcr.io/acto-llc/modern-accounting-ce/db-init:latest
```

Status: all five packages were confirmed public and pullable anonymously on 2026-10-28. Any new image added to the matrix in `publish-images.yml` needs the same one-time step.

## CI

`.github/workflows/ce-boot.yml` runs on pull requests and pushes to `main`:

- `paid-leak` runs `scripts/assert-ce-paid-leak.sh` (installs ripgrep, which the script requires).
- `boot` runs `./scripts/quickstart.sh` from a clean runner and curls `:5173`, `:5000/api/openapi` and `:8080/api/health`. It builds from source; it does not test the GHCR images.

`.github/workflows/ce-images-smoke.yml` covers the published images. It runs `./scripts/quickstart.sh --images` with the same endpoint checks, unauthenticated, so it also fails if a package goes private. It triggers after a successful "Publish CE images" run on `main`, weekly (Mondays 06:17 UTC), and manually from the Actions tab.

## Reproducible installs

- Lockfiles are committed for the root, `client/`, `chat-api/`, `email-api/` and `csv-import-api/`. All Dockerfiles use `npm ci`.
- `client/` installs with `--legacy-peer-deps`. Without it npm 10.9 crashes resolving the peer set while generating the lockfile, so keep the flag in both the Dockerfile and any lockfile regeneration (`npm install --package-lock-only --ignore-scripts --legacy-peer-deps`).
- `db-init` runs on Node 22 because the root lockfile resolves `tedious` 20, which requires Node 22 or later.

## Pinned versions

- DAB is pinned to `mcr.microsoft.com/azure-databases/data-api-builder:1.7.90` (a stable tag, replacing the `1.7.83-rc` release candidate). The `boot` job checks DAB responds, not that it handles queries for every entity. When bumping the tag, click through the app as well.

## Known gaps

- `ce-images-smoke` only runs after it lands on `main` (workflow_run and schedule triggers use the default branch), so it cannot be exercised from a PR. Run it once manually via **Actions**, **CE prebuilt images smoke**, **Run workflow**.
- The app starts with an empty database (schema only, no seed data).
