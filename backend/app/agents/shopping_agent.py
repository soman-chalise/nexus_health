from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import logging
from typing import Dict, Optional
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ShoppingAgent:
    """AI Shopping Agent that autonomously finds and adds medicines to cart on PharmEasy"""
    
    def __init__(self):
        self.base_url = "https://pharmeasy.in"
        self.driver = None
        
        # Initialize Gemini for intelligent decision making
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)
            self.ai_model = genai.GenerativeModel('gemini-2.0-flash-exp')
        else:
            self.ai_model = None
            logger.warning("Gemini API not configured - using fallback logic")
    
    def _init_browser(self, headless: bool = True) -> webdriver.Chrome:
        """Initialize Chrome browser with appropriate options"""
        chrome_options = Options()
        
        if headless:
            chrome_options.add_argument('--headless=new')
        
        # Performance optimizations
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        # Enable images and CSS for proper page rendering
        chrome_options.add_argument('--disable-extensions')
        
        # Use webdriver-manager to auto-download correct ChromeDriver version
        logger.info("Using webdriver-manager to auto-download matching ChromeDriver...")
        service = Service(ChromeDriverManager().install())
        
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(30)
        
        return driver
    
    def search_and_add_to_cart(self, medicine_name: str, headless: bool = True) -> Dict:
        """
        Main agent function: Search for medicine and add to cart
        
        Args:
            medicine_name: Name of medicine to search for
            headless: Run browser in headless mode (default True)
            
        Returns:
            Dict with success status, cart URL, medicine details
        """
        try:
            logger.info(f"🤖 Shopping Agent activated for: {medicine_name}")
            
            # Initialize browser
            self.driver = self._init_browser(headless=headless)
            
            # Step 1: Navigate to PharmEasy
            logger.info("📍 Navigating to PharmEasy...")
            self.driver.get(self.base_url)
            time.sleep(3)  # Wait for PharmEasy to load
            
            # Handle cookie consent if present
            self._handle_popups()
            
            # Step 2: Search for medicine
            logger.info(f"🔍 Searching for: {medicine_name}")
            search_result = self._search_medicine(medicine_name)
            
            if not search_result["success"]:
                return search_result
            
            # Step 3: Select first relevant product
            logger.info("🎯 Selecting product...")
            product_result = self._select_product()
            
            if not product_result["success"]:
                return product_result
            
            # Step 4: Add to cart
            logger.info("🛒 Adding to cart...")
            cart_result = self._add_to_cart()
            
            if not cart_result["success"]:
                return cart_result
            
            # Step 5: Get cart URL
            cart_url = self.driver.current_url
            if "/cart" not in cart_url:
                cart_url = f"{self.base_url}/cart"
            
            logger.info(f"✅ Success! Cart URL: {cart_url}")
            
            return {
                "success": True,
                "medicine_name": medicine_name,
                "cart_url": cart_url,
                "message": f"Successfully added {medicine_name} to cart!",
                "price": product_result.get("price", "N/A")
            }
            
        except Exception as e:
            logger.error(f"❌ Shopping agent error: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to add medicine to cart: {str(e)}",
                "cart_url": None
            }
        
        finally:
            # Close browser
            if self.driver:
                self.driver.quit()
                logger.info("🔒 Browser closed")
    
    def _handle_popups(self):
        """Handle cookie consent and other popups"""
        try:
            # Common popup close buttons
            close_selectors = [
                "button.close",
                "button[aria-label='Close']",
                ".modal-close",
                "#close-popup"
            ]
            
            for selector in close_selectors:
                try:
                    close_btn = WebDriverWait(self.driver, 2).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    close_btn.click()
                    logger.info("Closed popup")
                    time.sleep(1)
                except:
                    continue
        except:
            pass
    
    def _search_medicine(self, medicine_name: str) -> Dict:
        """Search for medicine by directly navigating to search results URL"""
        try:
            logger.info(f"🔍 Searching for: {medicine_name}")
            
            # SMART APPROACH: Directly construct the search URL instead of using search box!
            # PharmEasy URL pattern: https://pharmeasy.in/search/all?name=Medicine%20Name
            import urllib.parse
            encoded_medicine = urllib.parse.quote(medicine_name)
            search_url = f"https://pharmeasy.in/search/all?name={encoded_medicine}"
            
            logger.info(f"📍 Navigating directly to search results: {search_url}")
            self.driver.get(search_url)
            
            # Wait for results to load (reduced for speed)
            time.sleep(3)
            
            logger.info("✅ Search results page loaded")
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            return {"success": False, "message": f"Search failed: {str(e)}"}
    
    def _select_product(self) -> Dict:
        """Select first medicine from search results"""
        try:
            # Wait for product listings to appear (PharmEasy + generic)
            product_selectors = [
                "#__next > main div[class*='c-PJLV'] a",  # Product cards in main content area from DevTools
                "#__next > main a[href*='medicine']",
                "div[class*='ProductCard']",
                "div[class*='Search_medicineLists']",
                "a[class*='ProductCard']",
                "div.style__product-card___1gbex",
                ".search-results .product-card",
                "div[class*='product']",
                "a[href*='/buy/']"
            ]
            
            product = None
            for selector in product_selectors:
                try:
                    product = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    break
                except:
                    continue
            
            if not product:
                return {"success": False, "message": "No products found"}
            
            # Try to extract price if visible
            price = "N/A"
            try:
                price_elem = product.find_element(By.CSS_SELECTOR, "span[class*='price'], div[class*='price']")
                price = price_elem.text
            except:
                pass
            
            # Click on first product
            product.click()
            time.sleep(3)  # Wait for product page to load
            
            return {"success": True, "price": price}
            
        except Exception as e:
            logger.error(f"Product selection error: {str(e)}")
            return {"success": False, "message": f"Failed to select product: {str(e)}"}
    
    def _add_to_cart(self) -> Dict:
        """Click 'Add to Cart' button"""
        try:
            logger.info("🔍 Searching for 'Add to Cart' button...")
            
            # Try multiple approaches to find the button
            add_button = None
            
            # Approach 1: Try XPath with various text variations
            xpath_queries = [
                "#__next > main div[class*='c-PJLV'] button",  # Buttons in main content area from DevTools
                "#__next > main button[class*='c-']",  # PharmEasy button pattern
                "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'add to cart')]",
                "//div[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'add to cart')]",
                "//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'add to cart')]",
                "//button[contains(@class, 'cart')]",
                "//div[contains(@class, 'addToCart')]",
                "//*[contains(text(), 'ADD TO CART')]",
                "//*[contains(text(), 'Add to Cart')]"
            ]
            
            for xpath in xpath_queries:
                try:
                    add_button = WebDriverWait(self.driver, 3).until(
                        EC.element_to_be_clickable((By.XPATH, xpath))
                    )
                    logger.info(f"✅ Found button using XPath: {xpath[:50]}...")
                    break
                except:
                    continue
            
            # Approach 2: Try CSS selectors if XPath failed
            if not add_button:
                css_selectors = [
                    "button[class*='cart']",
                    "div[class*='addToCart']",
                    "button.c-btn",
                    "button[type='button']",
                    ".add-to-cart-button",
                    "[data-sku-id]",
                    "button.btn-primary"
                ]
                
                for selector in css_selectors:
                    try:
                        add_button = WebDriverWait(self.driver, 2).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                        )
                        logger.info(f"✅ Found button using CSS: {selector}")
                        break
                    except:
                        continue
            
            if not add_button:
                # Take screenshot for debugging
                screenshot_path = "add_to_cart_failure.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"📸 Screenshot saved to {screenshot_path}")
                return {"success": False, "message": "Could not find 'Add to Cart' button"}
            
            # Scroll to button and click
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", add_button)
            time.sleep(1)
            
            # Try clicking, with fallback to JavaScript click
            try:
                add_button.click()
                logger.info("✅ Clicked Add to Cart button")
            except:
                logger.info("⚠️ Normal click failed, trying JavaScript click...")
                self.driver.execute_script("arguments[0].click();", add_button)
                logger.info("✅ JavaScript click successful")
            
            # Wait for cart update
            time.sleep(3)
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Add to cart error: {str(e)}")
            return {"success": False, "message": f"Failed to add to cart: {str(e)}"}


# Singleton instance
_shopping_agent_instance = None

def get_shopping_agent() -> ShoppingAgent:
    """Get or create shopping agent singleton"""
    global _shopping_agent_instance
    if _shopping_agent_instance is None:
        _shopping_agent_instance = ShoppingAgent()
    return _shopping_agent_instance
