// automation.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

(async () => {
    // Initialize Supabase Client
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Function to query restaurants with statuses 1, 2, 3, 4, or 5 and state not 'UT'
    async function fetchRelevantRestaurants() {
        const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .in('status', [2, 3, 4, 5])
            .neq('state', 'UT'); // Exclude rows where state is 'UT'

        if (error) {
            console.error('Error fetching data:', error);
            return [];
        }

        console.log(`Fetched ${data.length} restaurants with statuses 1-5 excluding state 'UT'.`);
        return data;
    }

    // Puppeteer Automation
    const browser = await puppeteer.launch({ headless: false }); // Set to true to run in headless mode
    const page = await browser.newPage();

    try {
        // Navigate to the login page
        const loginUrl = "https://app.spotio2.com/login";
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Enter Email by Typing
        await page.waitForSelector('input[name="email"]', { timeout: 10000 });
        await page.type('input[name="email"]', process.env.SPOTIO_USERNAME, { delay: 100 });

        // Click the "Next" button
        await page.click('button.button.sign-content_button.-block.-preset-primary.-size-big');

        // Wait for Password Field
        await page.waitForSelector('input[name="password"]', { timeout: 60000 });

        // Enter Password by Typing
        await page.type('input[name="password"]', process.env.SPOTIO_PASSWORD, { delay: 100 });

        // Click the "Sign In" button
        await page.click('button.button.sign-content_button.-block.-preset-primary.-size-big');

        // Wait for Navigation after Sign In
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Navigate to the Pipeline Page
        const pipelineUrl = "https://app.spotio2.com/pipeline";
        await page.goto(pipelineUrl, { waitUntil: 'networkidle2' });

        // Wait for the Search Input to be available
        const searchInputSelector = 'input[preset="gray"][placeholder="Search for records"]';
        await page.waitForSelector(searchInputSelector, { timeout: 10000 });

        // Fetch Relevant Restaurants from Supabase
        const restaurants = await fetchRelevantRestaurants();

        for (const restaurant of restaurants) {
            // Build the full address string in the format: "854 S JACKSON ST, NAPPANEE, IN 46550"
            const address = restaurant.address || '';
            const city = restaurant.city || '';
            const state = restaurant.state || '';
            const zip5 = restaurant.zip5 || '';
            const fullAddress = `${address}, ${city}, ${state} ${zip5}`;

            console.log(`Processing Restaurant ID: ${restaurant.id}, Address: ${fullAddress}`);

            // Click on the Search Input to focus
            await page.click(searchInputSelector);

            // Clear the search input before pasting
            await page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = '';
                }
            }, searchInputSelector);

            // Set Clipboard to Full Address and Paste
            // Note: Puppeteer doesn't have direct access to the system clipboard.
            // To simulate paste, we'll use keyboard shortcuts after setting the clipboard in the page context.

            // Step 1: Set the clipboard in the page context
            await page.evaluate((address) => {
                navigator.clipboard.writeText(address).catch(err => {
                    console.error('Failed to write to clipboard:', err);
                });
            }, fullAddress);

            // Step 2: Simulate paste command (Control+V or Command+V)
            const isMac = process.platform === 'darwin';
            const pasteKey = isMac ? 'Meta' : 'Control';

            await page.keyboard.down(pasteKey);
            await page.keyboard.press('V');
            await page.keyboard.up(pasteKey);

            // Wait briefly to ensure paste is completed
            await page.waitForTimeout(500); // 0.5 seconds

            // Wait for the table row with class 'data-table_row' to appear
            const tableRowSelector = 'tr.data-table_row';
            try {
                await page.waitForSelector(tableRowSelector, { timeout: 10000 });
                console.log(`Table row found for address: ${fullAddress}`);

                // Click the table row
                await page.click(tableRowSelector);
                console.log(`Clicked on table row for address: ${fullAddress}`);
            } catch (err) {
                console.warn(`No table row found for address: ${fullAddress}. Skipping.`);
                continue; // Skip to the next restaurant if the row isn't found
            }

            // Wait for 5 seconds before processing the next address
            await page.waitForTimeout(5000);
        }

        console.log('Completed processing all restaurants.');

        // Wait for 60 Seconds before closing (as per initial instructions)
        await page.waitForTimeout(60000);

    } catch (error) {
        console.error('An error occurred during automation:', error);
    } finally {
        // Close the browser
        await browser.close();
    }
})();
