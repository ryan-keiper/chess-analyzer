# WikiBooks API Test Commands
# Test these individually to see what's working vs broken

echo "=== 1. DISCOVERY CALL - Get Chess Opening Theory Pages ==="
echo "This should return a JSON list of all pages in the category"

# Test the exact call your script is making
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:Book:Chess%20Opening%20Theory&cmlimit=10&cmnamespace=0" | jq .

echo -e "\n=== Alternative Category Names to Test ==="
echo "If the above fails, try these variations:"

# Test alternative category 1
echo -e "\n--- Testing: Category:Chess Opening Theory ---"
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:Chess%20Opening%20Theory&cmlimit=10&cmnamespace=0" | jq .

# Test alternative category 2  
echo -e "\n--- Testing: Category:Chess_Opening_Theory ---"
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:Chess_Opening_Theory&cmlimit=10&cmnamespace=0" | jq .

# Test a known working category for comparison
echo -e "\n--- Testing: Category:Chess (should definitely work) ---"
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:Chess&cmlimit=5&cmnamespace=0" | jq .

echo -e "\n=== 2. CONTENT RETRIEVAL - Get page content ==="
echo "This gets the actual text content of a specific page"

# Test getting content for a specific chess opening page
echo -e "\n--- Getting content for: Chess Opening Theory/1. e4 ---"
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&titles=Chess%20Opening%20Theory/1.%20e4&prop=extracts&explaintext=1&exsectionformat=plain" | jq .

# Test getting content for the main chess page (should definitely work)
echo -e "\n--- Getting content for: Chess (main page) ---"
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&titles=Chess&prop=extracts&explaintext=1&exsectionformat=plain" | jq .

echo -e "\n=== 3. SEARCH-BASED DISCOVERY (Alternative approach) ==="
echo "If categories aren't working, try searching for chess opening pages"

# Search for chess opening theory pages
curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=search&srsearch=Chess%20Opening%20Theory&srnamespace=0&srlimit=10" | jq .

echo -e "\n=== 4. ALL PAGES STARTING WITH (Another alternative) ==="
echo "Get all pages that start with 'Chess Opening Theory'"

curl -s "https://en.wikibooks.org/w/api.php?action=query&format=json&list=allpages&apprefix=Chess%20Opening%20Theory&aplimit=10&apnamespace=0" | jq .

echo -e "\n=== DEBUGGING NOTES ==="
echo "If you get HTML instead of JSON, the API endpoint might be wrong"
echo "If you get empty results, the category name might be incorrect"
echo "If you get 'badcontinue' errors, the pagination parameters are wrong"
echo "If you get timeouts, the WikiBooks API might be temporarily down"