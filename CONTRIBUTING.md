# Contributing to Requestr

Thanks for helping out. This guide covers local setup and how changes land.

## Setup

This project uses [`bun`](https://bun.sh). Do not use `npm` or `yarn`.

```bash
bun install
bun run dev        # start the dev server
bun run lint:check # biome lint and format check
```

Run targeted tests for what you touched, for example `bunx vitest run <spec>`.

## Pull requests

- Branch from `main` and keep each PR focused.
- PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(chains): add retry block` or `fix(import): handle empty collections`.
- PRs are squash-merged, so the PR title becomes the commit on `main`. Release notes are generated from those titles.
- Make sure `bun run lint:check` passes before requesting review.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). It opens a release PR that bumps the version and updates the changelog.

- Release PRs are opened by `GITHUB_TOKEN`, and GitHub does not run CI workflows for PRs created that way. Close and reopen the release PR (or push an empty commit to its branch) to trigger CI before merging.
- Maintainers must enable the repository setting **Settings > Actions > General > Allow GitHub Actions to create and approve pull requests**, otherwise release-please cannot open the PR.

## Reporting problems

Use the issue forms for bugs, feature requests and feedback. Report security issues privately, see [SECURITY.md](SECURITY.md).

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
