# Goldman Sachs Value Accelerator Team Scraper

This Playwright script scrapes team member data from the Goldman Sachs Value Accelerator website.

## Features

- **Automatic pagination**: Navigates through all 6 pages of team members
- **Complete data extraction**: Captures all required fields for each person
- **Smart scrolling**: Scrolls within modals to capture full descriptions
- **Dual output**: Saves data in both JSON and CSV formats
- **Error handling**: Continues scraping even if individual items fail
- **Progress logging**: Shows real-time progress in console

## Data Fields Extracted

For each team member, the scraper extracts:

1. **Name** - Full name
2. **Team** - Role/team designation (e.g., "Advisor", "Value Accelerator Core")
3. **Region** - Geographic region (e.g., "Americas", "EMEA", "APAC")
4. **Center of Excellence** - Area of expertise (e.g., "Operational Excellence", "Scaling Revenue")
5. **Investment Strategy** - Investment focus (e.g., "Infrastructure", "Private Equity")
6. **Description** - Full biographical description (scrolled to capture complete text)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install-browsers
```

## Usage

Run the scraper:
```bash
npm run scrape
```

Or directly with Node:
```bash
node scraper.js
```

## Output

The scraper generates two files:

- **`team_data.json`** - JSON format with all team member data
- **`team_data.csv`** - CSV format for easy import into spreadsheets

### Sample JSON Output
```json
[
  {
    "name": "Adam Beauchamp",
    "team": "Advisor",
    "region": "Americas",
    "centerOfExcellence": "Operational Excellence",
    "investmentStrategy": "Infrastructure",
    "description": "Adam is an international business leader focused on strategic development..."
  }
]
```

## How It Works

1. **Navigate to site**: Opens the Goldman Sachs Value Accelerator homepage and waits for full load
2. **Scroll to team section**: Automatically scrolls to the team directory (`#our-team-top`)
3. **Detect pagination**: Identifies the number of pages (typically 6 pages for ~138 experts)
4. **Iterate through pages**: For each page:
   - Finds all person card images (`.experts-grid .expert-card img`)
   - Clicks each image to open the person's modal
   - Waits for modal content to appear
   - **Scrolls within the modal** to ensure the complete description is visible
   - Extracts all 6 data fields using smart label-value pair detection
   - Closes the modal using the close button (`.fa-close`)
   - Handles any errors gracefully and continues
5. **Handle pagination**: Clicks the next page button and repeats until all pages are processed
6. **Export data**: Saves all collected data to both JSON and CSV files

## Configuration

You can modify the scraper behavior by editing `scraper.js`:

- **Headless mode**: Change `headless: false` to `headless: true` to run without showing browser
- **Timeouts**: Adjust `waitForTimeout()` values if your connection is slower
- **Selectors**: Update CSS selectors if the website structure changes

## Troubleshooting

**Browser doesn't launch:**
```bash
npx playwright install chromium
```

**Timeouts or slow loading:**
- Increase timeout values in the script
- Check your internet connection
- Try running with `headless: false` to see what's happening

**Missing data:**
- The script logs each person it processes
- Check console output for specific errors
- Verify the website structure hasn't changed

## Dependencies

- **Node.js** (v14 or higher)
- **Playwright** (v1.40.0 or higher)

## Notes

- The scraper runs with the browser visible by default (`headless: false`) so you can monitor progress
- Expected runtime: 5-10 minutes for all 138+ team members
- The script includes delays to avoid overwhelming the server
- All CSV fields are properly escaped for special characters and line breaks

