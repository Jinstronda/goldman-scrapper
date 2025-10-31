const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeGoldmanSachsTeam() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  const allPeople = [];
  
  try {
    console.log('Navigating to the site...');
    await page.goto('https://valueaccelerator.gs.com/homepage.html', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    console.log('Navigating to team section...');
    await page.click('a[href="#our-team-top"]');
    await page.waitForTimeout(3000);
    
    console.log('Finding all team members (all loaded in DOM)...');
    
    // Get total count of people - all 138 are loaded at once
    // Find people by looking for divs with "Advisor" or "Value Accelerator Core" text
    const totalPeople = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const roleDivs = allDivs.filter(div => {
        const text = div.textContent.trim();
        return text === 'Advisor' || text === 'Value Accelerator Core';
      });
      return roleDivs.length;
    });
    
    console.log(`Found ${totalPeople} total people in the DOM (all pages loaded)`);
    
    // Click each person and extract data
    for (let i = 0; i < totalPeople; i++) {
      try {
        console.log(`\nProcessing person ${i + 1} of ${totalPeople}...`);
        
        // Close any existing modal first
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.fa-close, .close, [class*="close"]');
          if (closeBtn) {
            closeBtn.click();
          }
        });
        await page.waitForTimeout(300);
        
        // Click the person's card by finding the image associated with their role div
        await page.evaluate((index) => {
          const allDivs = Array.from(document.querySelectorAll('div'));
          const roleDivs = allDivs.filter(div => {
            const text = div.textContent.trim();
            return text === 'Advisor' || text === 'Value Accelerator Core';
          });
          
          if (roleDivs[index]) {
            const parent = roleDivs[index].parentElement;
            if (parent) {
              const img = parent.querySelector('img');
              if (img) {
                img.click();
              }
            }
          }
        }, i);
        
        // Wait longer for modal to appear
        await page.waitForTimeout(1500);
        
        // Check if modal appeared - look for a small container with the person's specific data
        const modalVisible = await page.evaluate(() => {
          const allDivs = Array.from(document.querySelectorAll('div'));
          const modals = allDivs.filter(div => {
            const text = div.textContent || '';
            return text.includes('Name') && text.includes('Team') && 
                   text.includes('Region') && text.includes('Center of Excellence') &&
                   text.includes('Investment Strategy');
          });
          
          // Should have at least 2 candidates (page + modal)
          return modals.length >= 2;
        });
        
        if (!modalVisible) {
          console.log(`⚠ Modal not detected for person ${i + 1}, skipping...`);
          continue;
        }
        
        // Scroll within modal to ensure complete description is visible
        await page.evaluate(() => {
          const allDivs = Array.from(document.querySelectorAll('div'));
          
          // Find modal by looking for the one with Name/Team/Region fields
          const modal = allDivs.find(div => {
            const text = div.textContent || '';
            return text.includes('Name') && text.includes('Team') && 
                   text.includes('Region') && text.includes('Center of Excellence');
          });
          
          if (modal) {
            // Scroll to bottom of modal
            modal.scrollTop = modal.scrollHeight;
            
            // Also try scrolling parent containers
            let parent = modal.parentElement;
            while (parent) {
              if (parent.scrollHeight > parent.clientHeight) {
                parent.scrollTop = parent.scrollHeight;
              }
              parent = parent.parentElement;
            }
          }
        });
        
        await page.waitForTimeout(500);
        
        // Extract data from modal
        const personData = await page.evaluate(() => {
          const allDivs = Array.from(document.querySelectorAll('div'));
          
          // Find the SPECIFIC modal popup (not the whole page)
          const modalCandidates = allDivs.filter(div => {
            const text = div.textContent || '';
            // Must have all these fields
            return text.includes('Name') && text.includes('Team') && 
                   text.includes('Region') && text.includes('Center of Excellence') &&
                   text.includes('Investment Strategy');
          });
          
          // Find the one with description (text length between 900-5000 chars)
          // Too small = just labels, too large = whole page container
          const modalPopup = modalCandidates.find(m => {
            return m.textContent.length > 900 && m.textContent.length < 5000;
          });
          
          if (!modalPopup) return null;
          
          // Get all leaf text nodes in order from the modal popup only
          const children = Array.from(modalPopup.querySelectorAll('div'));
          const allText = children
            .filter(div => div.children.length === 0)  // Only leaf divs
            .map(div => div.textContent.trim())
            .filter(text => text.length > 0);
          
          // Helper to find value after a label in the array
          const findValue = (labelText) => {
            const index = allText.findIndex(text => text === labelText);
            if (index !== -1 && index + 1 < allText.length) {
              return allText[index + 1];
            }
            return '';
          };
          
          // Find description - it's the longest text (> 200 chars)
          const findDescription = () => {
            const longTexts = allText.filter(text => text.length > 200);
            return longTexts.length > 0 ? longTexts[0] : '';
          };
          
          return {
            name: findValue('Name'),
            team: findValue('Team'),
            region: findValue('Region'),
            centerOfExcellence: findValue('Center of Excellence'),
            investmentStrategy: findValue('Investment Strategy'),
            description: findDescription()
          };
        });
        
        if (personData && personData.name) {
          console.log(`✓ ${personData.name} - ${personData.team} (${personData.description.substring(0, 50)}...)`);
          allPeople.push(personData);
        } else {
          console.log(`⚠ Failed to extract data for person ${i + 1}`);
        }
        
        // Close modal
        await page.evaluate(() => {
          const closeButton = document.querySelector('.fa-close, .close, [class*="close"]');
          if (closeButton) {
            closeButton.click();
          }
        });
        
        await page.waitForTimeout(500);
        
      } catch (error) {
        console.error(`Error processing person ${i + 1}:`, error.message);
        // Try to close modal if stuck
        try {
          await page.evaluate(() => {
            const closeBtn = document.querySelector('.fa-close, .close');
            if (closeBtn) closeBtn.click();
          });
          await page.waitForTimeout(300);
        } catch {}
      }
    }
    
    // Save to JSON
    const jsonOutput = JSON.stringify(allPeople, null, 2);
    fs.writeFileSync('team_data.json', jsonOutput, 'utf-8');
    console.log(`\n✅ Saved ${allPeople.length} people to team_data.json`);
    
    // Save to CSV
    const csv = convertToCSV(allPeople);
    fs.writeFileSync('team_data.csv', csv, 'utf-8');
    console.log(`✅ Saved ${allPeople.length} people to team_data.csv`);
    
    console.log('\n🎉 Scraping complete!');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await browser.close();
  }
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = ['Name', 'Team', 'Region', 'Center of Excellence', 'Investment Strategy', 'Description'];
  const rows = data.map(person => [
    escapeCsv(person.name),
    escapeCsv(person.team),
    escapeCsv(person.region),
    escapeCsv(person.centerOfExcellence),
    escapeCsv(person.investmentStrategy),
    escapeCsv(person.description)
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

function escapeCsv(value) {
  if (!value) return '""';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return `"${stringValue}"`;
}

// Run the scraper
scrapeGoldmanSachsTeam();
