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
    const totalPeople = await page.evaluate(() => {
      return document.querySelectorAll('img[class*="cursor-pointer"]').length;
    });
    
    console.log(`Found ${totalPeople} total people in the DOM (all pages loaded)`);
    
    // Click each person and extract data
    for (let i = 0; i < totalPeople; i++) {
      try {
        console.log(`\nProcessing person ${i + 1} of ${totalPeople}...`);
        
        // Click the image to open modal (re-query each time to avoid stale elements)
        await page.evaluate((index) => {
          const images = document.querySelectorAll('img[class*="cursor-pointer"]');
          if (images[index]) {
            images[index].click();
          }
        }, i);
        
        await page.waitForTimeout(1000);
        
        // Wait for modal to be visible with data
        const modalVisible = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('div')).some(div => 
            div.textContent.includes('Name') && 
            div.textContent.includes('Team') && 
            div.textContent.includes('Region')
          );
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
          
          // Find the modal content container
          const modalContent = allDivs.find(div => {
            const text = div.textContent || '';
            return text.includes('Name') && text.includes('Team') && 
                   text.includes('Region') && text.includes('Center of Excellence');
          });
          
          if (!modalContent) return null;
          
          // Helper to find value after a label
          const findValue = (labelText) => {
            const children = Array.from(modalContent.querySelectorAll('div'));
            for (let i = 0; i < children.length; i++) {
              const div = children[i];
              const directText = Array.from(div.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .filter(t => t.length > 0)
                .join('');
              
              if (directText === labelText || div.textContent.trim() === labelText) {
                let nextEl = div.nextElementSibling;
                if (nextEl && !['Name', 'Team', 'Region', 'Center of Excellence', 'Investment Strategy'].includes(nextEl.textContent.trim())) {
                  return nextEl.textContent.trim();
                }
                
                if (div.parentElement) {
                  nextEl = div.parentElement.nextElementSibling;
                  if (nextEl && !['Name', 'Team', 'Region', 'Center of Excellence', 'Investment Strategy'].includes(nextEl.textContent.trim())) {
                    return nextEl.textContent.trim();
                  }
                }
              }
            }
            return '';
          };
          
          // Find description - it's the longest text block
          const findDescription = () => {
            const textDivs = Array.from(modalContent.querySelectorAll('div'))
              .filter(div => {
                const text = div.textContent.trim();
                const isLeaf = div.children.length === 0 || 
                              (div.children.length === 1 && div.children[0].tagName === 'BR');
                return isLeaf && text.length > 100 && 
                       !text.includes('Name') && !text.includes('Team') && 
                       !text.includes('Region');
              })
              .map(div => div.textContent.trim())
              .sort((a, b) => b.length - a.length);
            
            return textDivs.length > 0 ? textDivs[0] : '';
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
