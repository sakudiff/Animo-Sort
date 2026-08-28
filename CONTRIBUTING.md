# Contributing to Animo Sort

Thank you for your interest in contributing to Animo Sort. We welcome bug reports, building code expansions, parser improvements, and user interface enhancements from the community.

## Core Project Guarantees

Before submitting a change, ensure your work respects the foundational principles of this project.

1. Strict client-side privacy. The application must never upload or transmit schedule files, student identifiers, or analytical telemetry to any server.
2. Zero build dependencies. The application is written in vanilla HTML, modern CSS, and ES modules. Do not introduce heavy frontend frameworks, package bundlers, or remote CDN scripts.
3. Accessible and responsive design. UI elements must support keyboard navigation and remain usable across both mobile screens and desktop monitors.

## Reporting Issues and Bugs

When reporting an issue on GitHub, keep the following guidelines in mind.

- Never post raw or unredacted EAF PDF files containing your real name, student ID number, or financial assessment data.
- State the academic year and term where the issue occurred.
- Provide the course code, meeting day, time string, and room text that caused unexpected parsing behavior.
- Describe what you expected to see and what actually happened.

## Submitting Pull Requests

Follow these steps to propose code changes.

1. Fork the repository and create a descriptive branch name such as `fix/room-expansion-velasco` or `feat/export-improvements`.
2. Keep changes minimal and focused on a single bug or enhancement.
3. Test your changes locally in a modern web browser.
4. Verify that non-standard meeting intervals, split rooms, and campus expansions continue to render properly.
5. Submit a pull request referencing any relevant issue.

## Adding Campus Building Codes

To add or update building code mappings, edit the building lookup table in `assets/js/eaf-parser.js`. Ensure the acronym matches official DLSU campus building designations before opening a pull request.
