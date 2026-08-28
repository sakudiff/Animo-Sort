<!-- research-readme template: project-README -->

# Animo Sort

Animo Sort is a client-side web application that converts De La Salle University Enrollment Assessment Form PDFs into a clean weekly timetable. The application runs entirely within the browser, ensuring student schedule data remains private and is never transmitted over a network.

## Overview

During enrollment, DLSU students receive an Enrollment Assessment Form from ArchersHub containing course codes, section numbers, meeting times, and room assignments. Animo Sort reads this document locally using client-side PDF parsing and generates an organized Monday through Saturday timetable grid.

## Core Features

- Client-side PDF parsing with vendored PDF.js
- Automatic term detection and course schedule extraction
- Campus building code expansions for physical classrooms
- Support for non-standard meeting intervals and split room allocations
- Toggle controls for full course titles
- High-resolution PNG timetable export
- Zero telemetry and zero external server dependencies

## Compatibility

Animo Sort supports official DLSU Enrollment Assessment Forms generated from [ArchersHub](https://archershub.dlsu.edu.ph/) starting from AY 2025-2026 Term 3. Legacy documents from Animo.sys are unsupported.

## Quickstart

Because Animo Sort is a static web application with no build steps, you can serve it with any local static web server.

```bash
# Clone the repository
git clone https://github.com/sakudiff/Animo-Sort.git
cd Animo-Sort

# Start a local static server
python3 -m http.server 8000
```

Open `http://localhost:8000` in your web browser to use the application.

## Deployment

Deploying to Netlify via GitHub requires zero build configuration because the repository includes a `netlify.toml` file.

1. Push your repository to GitHub.
2. Log in to Netlify and select Add new site, then Import an existing project.
3. Choose GitHub and select your repository.
4. Netlify will automatically detect the settings from `netlify.toml` with the publish directory set to `.`.
5. Click Deploy site. Any future commits pushed to your selected branch will deploy automatically.

## Usage

1. Open Animo Sort in your browser.
2. Select or drag your official ArchersHub EAF PDF into the upload area.
3. Review your timetable across Monday to Saturday.
4. Toggle full course titles or download a PNG image of your schedule.

## Project Structure

```
.
├── assets/
│   └── js/
│       ├── app.js          # Application controller and UI interactions
│       ├── eaf-parser.js   # PDF extraction, parsing, and room mapping
│       └── export.js       # SVG layout and PNG image generation
├── vendor/
│   └── pdfjs/              # Vendored PDF.js library builds
├── index.html              # Application markup and structure
├── styles.css              # Typography, layout, and component styling
├── print.css               # Print media rules
├── netlify.toml            # Netlify deployment configuration
├── package.json            # Project metadata
├── .gitignore              # Ignored files and directories
└── README.md
```

## Architecture

The project is structured into three vanilla JavaScript modules.

- `assets/js/eaf-parser.js` handles PDF text extraction, schedule row identification, zero-credit course support, and campus room translations.
- `assets/js/export.js` generates vector SVG representations and exports high-resolution timetable images.
- `assets/js/app.js` manages DOM event bindings, drag-and-drop file ingestion, timetable rendering, and client-side view toggles.

## Contributing

Contributions from the DLSU community and open-source contributors are welcome.

Follow these steps to submit a contribution.

1. Fork the repository on GitHub.
2. Create a feature branch for your changes.
3. Verify your changes across different EAF files and viewport widths.
4. Submit a pull request with a clear description of your solution.

## License

This project is licensed under the MIT License.
