# Mad Mallard Form Verifier

[![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/) [![Playwright](https://img.shields.io/badge/Playwright-1.65.1-2EAD33)](https://playwright.dev/) [![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](compose.yml)

[![Browser verification](https://github.com/drakeg/madmallard-form-verifier/actions/workflows/verification.yml/badge.svg)](https://github.com/drakeg/madmallard-form-verifier/actions/workflows/verification.yml) [![License](https://img.shields.io/github/license/drakeg/madmallard-form-verifier)](LICENSE) [![Issues](https://img.shields.io/github/issues/drakeg/madmallard-form-verifier)](https://github.com/drakeg/madmallard-form-verifier/issues) [![Pull requests](https://img.shields.io/github/issues-pr/drakeg/madmallard-form-verifier)](https://github.com/drakeg/madmallard-form-verifier/pulls)

A synthetic demo for agencies that maintain lead-generation sites. Two forms can show the same confirmation while only one produces a matching receipt.

## Run the demo

```sh
docker compose up --build -d demo
```

Open http://localhost:8098. Leave the synthetic email in place, submit, then select **Check this receipt** to verify delivery. Repeat with **Suppress receipt** to see how an accepted request can still have unverified delivery. The **Verify delivery** panel also accepts a test ID from an earlier submission. Devices on the same network can open `http://<docker-host-lan-ip>:8098`. Use `DEMO_PORT` to change the host port or `DEMO_BIND=127.0.0.1` to restrict access to the Docker host. The demo uses a lightweight Node.js image. The browser verification service uses the Playwright image. Receipts are held in memory and reset when the server restarts.

## Run the repeatable verification

```sh
mkdir -p evidence
DEMO_UID=$(id -u) DEMO_GID=$(id -g) docker compose run --build --rm verify
```

Open `evidence/report.html` for a single file with embedded screenshots. Open `evidence/report.pdf` for a ready-to-share PDF generated from the same report. The Markdown report and individual PNGs are also in `evidence/`. The script starts its own isolated synthetic server and attempts two valid submissions. The desktop case confirms a matching record. The mobile case deliberately drops delivery. The missing-field case checks that the browser blocks the POST. On a Node.js host you can also run `npm ci`, `npx playwright install chromium`, and `npm test`.

## Agency pilot

The pricing hypothesis is $249 for one authorized form and destination, three agreed cases and one retest. See [pilot scope and report template](PILOT.md). Pilot demand and pricing remain unvalidated. A generic browser QA check can establish what the user sees. This service also asks the agency to verify the matching destination record.

The project code is MIT. Playwright and its browser image are obtained separately through their upstream distributions. See the [Playwright Docker documentation](https://playwright.dev/docs/docker).
